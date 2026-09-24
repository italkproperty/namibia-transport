"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, customers, vehicleClasses } from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";
import { generateBookingRef } from "@/lib/booking/ref";
import { namibianLocalToInstant } from "@/lib/booking/time";
import { modelPayout } from "@/lib/network/fare-model";
import { SITE } from "@/lib/site";
import { resolveCustomer } from "@/lib/booking/customer";

/**
 * Quotes an operator writes by hand, for the trips the model cannot price.
 *
 * Most of what we sell is priced from the road network, and that is the point
 * of the platform. But a real enquiry does not always fit it: "Etango Ranch
 * Guest Farm to Namib Desert Lodge, out on the 6th, back on the 9th, and my
 * budget is N$6,000" names two lodges the network does not model, prices a
 * return as one number, and has a figure already agreed on WhatsApp. Before
 * this there was nowhere to put that, so the conversation ended with a number
 * in a chat window and no way to pay it.
 *
 * What this produces is an ordinary booking at an agreed price, which means it
 * inherits everything bookings already have: a reference, a public page, a
 * payment record, the confirmation email, and a row in the dispatch board. The
 * operator sends one link.
 *
 * The price comes from the operator, which is the one place in the codebase a
 * human number overrides the model — so it is read from a signed-in admin
 * session and never from a traveller.
 */

export type QuoteFormState =
  | { ok: true; ref: string; url: string }
  | { ok: false; message: string }
  | null;

function field(data: FormData, key: string): string {
  return String(data.get(key) ?? "").trim();
}

/** Money as a decimal string, or null when it is not a usable amount. */
function parseMoney(raw: string): string | null {
  const cleaned = raw.replace(/[\s,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value.toFixed(2);
}

export async function createCustomQuote(
  _previous: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  // A server action is a public endpoint. The admin shell renders the form,
  // but nothing stops a POST arriving without it.
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") {
    return { ok: false, message: "Sign in first." };
  }

  if (!isDatabaseConfigured()) {
    return { ok: false, message: "No database is configured." };
  }

  const fullName = field(formData, "fullName");
  const whatsapp = field(formData, "whatsapp");
  const email = field(formData, "email");
  const pickupLabel = field(formData, "pickupLabel");
  const dropoffLabel = field(formData, "dropoffLabel");
  const scheduledAtRaw = field(formData, "scheduledAt");
  const returnAt = field(formData, "returnAt");
  const priceRaw = field(formData, "price");
  const payoutRaw = field(formData, "payout");
  const notes = field(formData, "notes");

  if (!fullName) return { ok: false, message: "The traveller needs a name." };
  if (!whatsapp) {
    return {
      ok: false,
      message:
        "A WhatsApp number is required — it is how the quote reaches them, and the customer record cannot exist without one.",
    };
  }
  if (!pickupLabel || !dropoffLabel) {
    return { ok: false, message: "Both ends of the trip are needed." };
  }

  const price = parseMoney(priceRaw);
  if (!price) {
    return {
      ok: false,
      message: "The fare must be an amount like 6000 or 6000.00.",
    };
  }

  // Payout defaults to the model's split so the economics stay comparable with
  // every other booking; an operator can override it when a partner has quoted
  // something specific.
  const payout = payoutRaw
    ? parseMoney(payoutRaw)
    : modelPayout(Number(price)).toFixed(2);
  if (!payout) {
    return {
      ok: false,
      message: "The driver payout must be an amount, or left blank.",
    };
  }
  if (Number(payout) > Number(price)) {
    return {
      ok: false,
      message:
        "The driver payout is more than the fare — that trip loses money.",
    };
  }

  const [datePart, timePart] = scheduledAtRaw.split("T");
  let scheduledAt: Date;
  try {
    scheduledAt = namibianLocalToInstant(datePart ?? "", timePart ?? "");
  } catch {
    return { ok: false, message: "Give the pickup date and time." };
  }

  const passengers = Number(field(formData, "passengers") || "1");
  const luggageCount = Number(field(formData, "luggageCount") || "0");

  const db = getDb();

  try {
    // Reuse a customer we already know, matched on whatsapp then email, so a
    // repeat traveller does not become a second row.
    const { customer } = await resolveCustomer(db, {
      fullName,
      whatsapp: whatsapp || null,
      email: email || null,
    });

    // A vehicle class is optional on a booking, but picking one keeps the
    // dispatch board able to say what car is needed.
    const requestedClass = field(formData, "vehicleClassId");
    const [vehicleClass] = requestedClass
      ? await db
          .select({ id: vehicleClasses.id })
          .from(vehicleClasses)
          .where(eq(vehicleClasses.id, requestedClass))
          .limit(1)
      : [];

    // The return leg is recorded on the booking rather than as a second one:
    // the traveller agreed one price for the round trip, and splitting it
    // across two bookings would mean two links, two payments and a fare that
    // no longer matches what was quoted.
    const returnNote = returnAt ? `Return leg: ${returnAt}.` : "";
    const composedNotes = [returnNote, notes].filter(Boolean).join(" ").trim();

    const contribution = (Number(price) - Number(payout)).toFixed(2);

    let row;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        [row] = await db
          .insert(bookings)
          .values({
            ref: generateBookingRef(),
            customerId: customer.id,
            vehicleClassId: vehicleClass?.id ?? null,
            pickupLabel,
            dropoffLabel,
            scheduledAt,
            passengers: Number.isFinite(passengers)
              ? Math.max(1, passengers)
              : 1,
            luggageCount: Number.isFinite(luggageCount)
              ? Math.max(0, luggageCount)
              : 0,
            customerPrice: price,
            driverPayout: payout,
            contribution,
            isReturn: Boolean(returnAt),
            acquisitionSource: "admin-quote",
            status: "pending_payment",
            notes: composedNotes || null,
          })
          .returning();
        break;
      } catch (error) {
        const duplicate =
          error instanceof Error && /bookings_ref_key/.test(error.message);
        if (!duplicate || attempt === 4) throw error;
      }
    }

    if (!row) return { ok: false, message: "Could not allocate a reference." };

    revalidatePath("/admin/bookings");
    return {
      ok: true,
      ref: row.ref,
      url: `${SITE.url.replace(/\/+$/, "")}/booking/${row.ref}`,
    };
  } catch (error) {
    console.error("[admin] custom quote failed", error);
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not create the quote.",
    };
  }
}

export type ConfirmTransferState = { ok: boolean; message?: string } | null;

/**
 * Marks a bank transfer as received. Separate from the quote form but the same
 * authorisation story: a server action re-checks the gate itself.
 *
 * It used to return void, which meant an admin session that had quietly lapsed
 * looked exactly like a success — the press did nothing, the row stayed where
 * it was, and the honest reading of that is "the button is broken", so the
 * next thing an operator does is press it again. Confirming money is the one
 * action on the page that must say whether it happened.
 */
export async function confirmTransferAction(
  _prev: ConfirmTransferState,
  formData: FormData,
): Promise<ConfirmTransferState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") {
    return {
      ok: false,
      message: "Your session has expired — sign in again, then confirm it.",
    };
  }

  const bookingId = String(formData.get("bookingId") ?? "").trim();
  if (!bookingId) return { ok: false, message: "No booking was named." };

  try {
    const { confirmTransfer } = await import("@/lib/payments/transfer");
    const result = await confirmTransfer(bookingId);
    if ("error" in result) return { ok: false, message: result.error };
  } catch (error) {
    console.error("[admin] confirming a transfer failed", error);
    return {
      ok: false,
      message:
        "The database refused that. Nothing has been marked paid — check the logs.",
    };
  }

  revalidatePath("/admin/bookings");
  return { ok: true };
}
