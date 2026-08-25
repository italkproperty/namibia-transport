"use server";

import { randomInt } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import {
  corporateQuoteItems,
  corporateQuotes,
  type QuoteStatus,
} from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";
import { getVatRate } from "@/lib/company";
import { listRoutes, listVehicleClasses } from "@/lib/maps";
import { getMessenger } from "@/lib/messaging";
import { formatNad } from "@/lib/money";
import { toMoneyString } from "@/lib/money";

import { computeQuote, quoteMoney } from "./quote-pricing";
import {
  corporateQuoteSchema,
  type CorporateQuoteResult,
} from "./quote-schema";

/** Same unambiguous alphabet as booking refs — read aloud, typed by hand. */
const ALPHABET = "ABCDEFGHJKLMNPQRTUVWXY2346789";

function generateQuoteNumber(): string {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `NT-Q-${new Date().getFullYear()}-${code}`;
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sanitise(value: string | undefined, max = 200): string | null {
  if (!value) return null;
  const cleaned = Array.from(value)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f;
    })
    .join("")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, max) : null;
}

const QUOTE_VALIDITY_DAYS = 7;

/**
 * Prices the requirement from the routes table, persists the quotation with
 * its line items, and returns the quote number. Every request creates a lead:
 * the quote row is the CRM record, whatever the customer does next.
 */
export async function createCorporateQuote(
  input: unknown
): Promise<CorporateQuoteResult> {
  const parsed = corporateQuoteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Please check the form and try again.",
    };
  }
  const values = parsed.data;

  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      message:
        "Quotations cannot be saved yet — the database is not connected. Please contact us on WhatsApp.",
    };
  }

  // Server-side pricing from the database; the client's numbers are ignored.
  const [{ routes }, vehicleClasses] = await Promise.all([
    listRoutes({ activeOnly: true }),
    listVehicleClasses(),
  ]);

  const vatRate = getVatRate();
  const computation = computeQuote(
    {
      services: values.services,
      routeSlug: values.routeSlug || null,
      vehicleClassId: values.vehicleClassId || null,
      passengers: values.passengers,
      vehicles: values.vehicles,
      frequency: values.frequency,
      periodCount: values.periodCount,
      includeReturn: values.includeReturn,
      extraWaitingHours: values.extraWaitingHours,
      extraStops: values.extraStops,
    },
    routes,
    vehicleClasses,
    vatRate
  );

  if (computation.lines.length === 0) {
    return {
      ok: false,
      message: "Choose a route or a service so we have something to quote.",
    };
  }

  const money = quoteMoney(computation);
  const validUntil = new Date(
    Date.now() + QUOTE_VALIDITY_DAYS * 24 * 60 * 60 * 1000
  );

  try {
    const db = getDb();
    const quote = await insertQuoteWithUniqueNumber(db, {
      companyName: values.companyName,
      contactName: values.contactName,
      contactPosition: emptyToNull(values.contactPosition),
      email: emptyToNull(values.email),
      whatsapp: emptyToNull(values.whatsapp),
      industry: emptyToNull(values.industry),
      companyRegistration: emptyToNull(values.companyRegistration),
      billingAddress: emptyToNull(values.billingAddress),
      services: values.services,
      passengers: values.passengers,
      vehicles: values.vehicles,
      datesNote: emptyToNull(values.datesNote),
      frequency: values.frequency,
      tripsCount: computation.tripsCount,
      includeReturn: values.includeReturn,
      notes: emptyToNull(values.notes),
      subtotal: money.subtotal,
      vatRate: String(vatRate),
      vatAmount: money.vatAmount,
      total: money.total,
      isEstimate: !computation.isFormal,
      status: "quoted",
      validUntil,
      acquisitionSource: sanitise(values.acquisitionSource),
    });

    await db.insert(corporateQuoteItems).values(
      computation.lines.map((line, index) => ({
        quoteId: quote.id,
        description: line.description,
        quantity: line.quantity,
        unitPrice:
          line.unitPrice === null ? null : toMoneyString(line.unitPrice),
        lineTotal:
          line.lineTotal === null ? null : toMoneyString(line.lineTotal),
        sortOrder: index,
      }))
    );

    // Stubbed for now: logs the message it would send.
    await getMessenger().send({
      to: {
        fullName: values.contactName,
        whatsapp: quote.whatsapp,
        email: quote.email,
      },
      channel: quote.whatsapp ? "whatsapp" : "email",
      template: "corporate_quote_issued",
      subject: `Quotation ${quote.quoteNumber} — ${values.companyName}`,
      variables: {
        quoteNumber: quote.quoteNumber,
        total: formatNad(money.total),
      },
      body:
        `Thanks ${values.contactName} — quotation ${quote.quoteNumber} for ${values.companyName} ` +
        `comes to ${formatNad(money.total)}${computation.isFormal ? "" : " (estimate; some items are scoped with the final quotation)"}. ` +
        `It is valid for ${QUOTE_VALIDITY_DAYS} days. We will follow up within 24 hours on WhatsApp/email.`,
    });

    return { ok: true, quoteNumber: quote.quoteNumber };
  } catch (error) {
    console.error("[corporate] failed to create quote", error);
    return {
      ok: false,
      message: "Something went wrong saving your quotation. Please try again.",
    };
  }
}

/** Marks a quote accepted — the customer's side of the pipeline. */
export async function acceptCorporateQuote(
  quoteNumber: string
): Promise<{ ok: boolean }> {
  if (!isDatabaseConfigured()) return { ok: false };

  try {
    const db = getDb();
    const [quote] = await db
      .update(corporateQuotes)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(corporateQuotes.quoteNumber, quoteNumber))
      .returning();

    if (!quote) return { ok: false };

    await getMessenger().send({
      to: {
        fullName: quote.contactName,
        whatsapp: quote.whatsapp,
        email: quote.email,
      },
      channel: quote.whatsapp ? "whatsapp" : "email",
      template: "corporate_quote_accepted",
      subject: `Quotation ${quote.quoteNumber} accepted`,
      body:
        `${quote.contactName} accepted quotation ${quote.quoteNumber} for ${quote.companyName} ` +
        `(${formatNad(quote.total)}). Operations to confirm scheduling and invoicing.`,
    });

    return { ok: true };
  } catch (error) {
    console.error("[corporate] failed to accept quote", error);
    return { ok: false };
  }
}

/**
 * Admin-side pipeline move. Server actions are public endpoints, so the gate
 * is enforced here as well as by the page in front of it.
 */
export async function updateQuoteStatus(
  quoteId: string,
  status: QuoteStatus
): Promise<{ ok: boolean }> {
  if (!isDatabaseConfigured()) return { ok: false };

  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false };

  try {
    await getDb()
      .update(corporateQuotes)
      .set({ status, updatedAt: new Date() })
      .where(eq(corporateQuotes.id, quoteId));
    return { ok: true };
  } catch (error) {
    console.error("[corporate] failed to update quote status", error);
    return { ok: false };
  }
}

type QuoteInsert = typeof corporateQuotes.$inferInsert;

async function insertQuoteWithUniqueNumber(
  db: ReturnType<typeof getDb>,
  values: Omit<QuoteInsert, "quoteNumber">
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const [row] = await db
        .insert(corporateQuotes)
        .values({ ...values, quoteNumber: generateQuoteNumber() })
        .returning();
      return row;
    } catch (error) {
      const isDuplicate =
        error instanceof Error &&
        /corporate_quotes_number_key/.test(error.message);
      if (!isDuplicate || attempt === 4) throw error;
    }
  }
  throw new Error("Could not allocate a unique quote number");
}
