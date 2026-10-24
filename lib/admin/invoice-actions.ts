"use server";

import { and, eq, or, sql, type SQL } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb, isDatabaseConfigured } from "@/db";
import { customers, invoiceLines, invoiceSequences, invoices } from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";

function textField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function parseAmount(raw: string): string | null {
  const value = raw.replace(/[\s,]/g, "");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0") || "0");
  if (cents <= 0n || cents > 9999999999n) return null;
  return (BigInt(whole).toString()) + "." + fraction.padEnd(2, "0");
}

function dueDate(raw: string): Date | null {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error("Choose a valid due date.");
  const [year, month, day] = raw.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    throw new Error("Choose a real calendar date.");
  }
  return new Date(raw + "T23:59:59+02:00");
}

function safeAdminRedirect(path: string, message: string): never {
  redirect(path + "?error=" + encodeURIComponent(message));
}

async function requireAdmin(): Promise<void> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") redirect("/admin/invoices?error=Please%20sign%20in%20again.");
}

export async function createInvoiceDraft(formData: FormData): Promise<void> {
  await requireAdmin();
  if (!isDatabaseConfigured()) safeAdminRedirect("/admin/invoices/new", "The database is not configured.");

  const billingName = textField(formData, "billingName");
  const billingEmail = textField(formData, "billingEmail");
  const billingWhatsapp = textField(formData, "billingWhatsapp");
  const billingAddress = textField(formData, "billingAddress");
  const description = textField(formData, "description");
  const amount = parseAmount(textField(formData, "amount"));
  const dueAtRaw = textField(formData, "dueAt");
  const terms = textField(formData, "terms");

  if (!billingName) safeAdminRedirect("/admin/invoices/new", "Enter the customer's billing name.");
  if (!description) safeAdminRedirect("/admin/invoices/new", "Enter a description of the service.");
  if (!amount) safeAdminRedirect("/admin/invoices/new", "Enter a valid positive amount, such as 850.00.");
  if (!billingEmail && !billingWhatsapp) {
    safeAdminRedirect("/admin/invoices/new", "Enter at least one customer contact: email or WhatsApp.");
  }

  let dueAt: Date | null;
  try {
    dueAt = dueDate(dueAtRaw);
  } catch (error) {
    safeAdminRedirect("/admin/invoices/new", error instanceof Error ? error.message : "Invalid due date.");
  }

  const db = getDb();
  try {
    const contactConditions: SQL[] = [];
    if (billingWhatsapp) contactConditions.push(eq(customers.whatsapp, billingWhatsapp));
    if (billingEmail) contactConditions.push(eq(customers.email, billingEmail));
    const [matchedCustomer] = contactConditions.length
      ? await db.select({ id: customers.id }).from(customers)
          .where(contactConditions.length === 1 ? contactConditions[0] : or(...contactConditions))
          .limit(1)
      : [];

    const invoice = await db.transaction(async (tx) => {
      const [created] = await tx.insert(invoices).values({
        customerId: matchedCustomer?.id ?? null,
        billingName,
        billingEmail: billingEmail || null,
        billingWhatsapp: billingWhatsapp || null,
        billingAddress: billingAddress || null,
        description,
        currency: "NAD",
        subtotal: amount,
        discountAmount: "0.00",
        total: amount,
        dueAt,
        terms: terms || null,
        status: "draft",
      }).returning({ id: invoices.id });

      await tx.insert(invoiceLines).values({
        invoiceId: created.id,
        description,
        quantity: "1.00",
        unitPrice: amount,
        lineTotal: amount,
        currency: "NAD",
        sortOrder: 0,
      });

      return created;
    });

    revalidatePath("/admin/invoices");
    redirect("/admin/invoices/" + invoice.id);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error &&
        typeof (error as { digest?: unknown }).digest === "string" &&
        (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")) throw error;
    console.error("[invoices] draft creation failed", error);
    safeAdminRedirect("/admin/invoices/new", "The invoice draft could not be saved. Please retry; no invoice was issued.");
  }
}

export async function updateInvoiceDraft(formData: FormData): Promise<void> {
  await requireAdmin();
  if (!isDatabaseConfigured()) safeAdminRedirect("/admin/invoices", "The database is not configured.");

  const id = textField(formData, "invoiceId");
  if (!/^[0-9a-f-]{36}$/i.test(id)) safeAdminRedirect("/admin/invoices", "Invalid invoice reference.");

  const billingName = textField(formData, "billingName");
  const billingEmail = textField(formData, "billingEmail");
  const billingWhatsapp = textField(formData, "billingWhatsapp");
  const billingAddress = textField(formData, "billingAddress");
  const description = textField(formData, "description");
  const amount = parseAmount(textField(formData, "amount"));
  const dueAtRaw = textField(formData, "dueAt");
  const terms = textField(formData, "terms");

  if (!billingName || !description || !amount || (!billingEmail && !billingWhatsapp)) {
    safeAdminRedirect("/admin/invoices/" + id, "Complete the billing name, service description, valid amount and at least one contact method.");
  }

  let dueAt: Date | null;
  try {
    dueAt = dueDate(dueAtRaw);
  } catch {
    safeAdminRedirect("/admin/invoices/" + id, "Choose a valid due date.");
  }

  try {
    await getDb().transaction(async (tx) => {
      const [invoice] = await tx.select({ id: invoices.id, status: invoices.status })
        .from(invoices).where(eq(invoices.id, id)).limit(1);
      if (!invoice) throw new Error("Invoice not found.");
      if (invoice.status !== "draft") throw new Error("Issued invoices cannot be edited.");

      const contactConditions = [];
      if (billingWhatsapp) contactConditions.push(eq(customers.whatsapp, billingWhatsapp));
      if (billingEmail) contactConditions.push(eq(customers.email, billingEmail));
      const [matchedCustomer] = contactConditions.length
        ? await tx.select({ id: customers.id }).from(customers)
            .where(contactConditions.length === 1 ? contactConditions[0] : or(...contactConditions))
            .limit(1)
        : [];

      await tx.update(invoices).set({
        customerId: matchedCustomer?.id ?? null,
        billingName,
        billingEmail: billingEmail || null,
        billingWhatsapp: billingWhatsapp || null,
        billingAddress: billingAddress || null,
        description,
        subtotal: amount,
        total: amount,
        dueAt,
        terms: terms || null,
        updatedAt: new Date(),
      }).where(eq(invoices.id, id));

      await tx.update(invoiceLines).set({
        description,
        quantity: "1.00",
        unitPrice: amount,
        lineTotal: amount,
        currency: "NAD",
      }).where(eq(invoiceLines.invoiceId, id));
    });
    revalidatePath("/admin/invoices");
    revalidatePath("/admin/invoices/" + id);
  } catch (error) {
    console.error("[invoices] draft update failed", error);
    safeAdminRedirect("/admin/invoices/" + id, error instanceof Error && error.message === "Issued invoices cannot be edited."
      ? error.message
      : "The draft could not be updated. Check the details and retry.");
  }

  redirect("/admin/invoices/" + id + "?saved=1");
}

export async function issueInvoice(formData: FormData): Promise<void> {
  await requireAdmin();
  if (!isDatabaseConfigured()) safeAdminRedirect("/admin/invoices", "The database is not configured.");

  const id = textField(formData, "invoiceId");
  if (!/^[0-9a-f-]{36}$/i.test(id)) safeAdminRedirect("/admin/invoices", "Invalid invoice reference.");
  if (textField(formData, "confirmIssue") !== "yes") {
    safeAdminRedirect("/admin/invoices/" + id, "Confirm that you reviewed the invoice before issuing it.");
  }

  try {
    await getDb().transaction(async (tx) => {
      const [invoice] = await tx.select({
        id: invoices.id,
        status: invoices.status,
      }).from(invoices).where(eq(invoices.id, id)).limit(1);

      if (!invoice) throw new Error("Invoice not found.");
      if (invoice.status === "issued") return;
      if (invoice.status !== "draft") throw new Error("Only a draft can be issued.");

      const year = Number(new Intl.DateTimeFormat("en", {
        timeZone: "Africa/Windhoek",
        year: "numeric",
      }).format(new Date()));

      const [sequence] = await tx.insert(invoiceSequences)
        .values({ year, lastNumber: 1, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: invoiceSequences.year,
          set: {
            lastNumber: sql.raw('"last_number" + 1'),
            updatedAt: new Date(),
          },
        })
        .returning({ lastNumber: invoiceSequences.lastNumber });

      const invoiceNumber = "NT-INV-" + year + "-" + String(sequence.lastNumber).padStart(5, "0");
      const token = randomBytes(32).toString("base64url");

      const [updated] = await tx.update(invoices).set({
        invoiceNumber,
        publicToken: token,
        status: "issued",
        issuedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(invoices.id, id), eq(invoices.status, "draft")))
        .returning({ id: invoices.id });

      if (!updated) throw new Error("Invoice changed while issuing. Reload and try again.");
    });
  } catch (error) {
    console.error("[invoices] issue failed", error);
    safeAdminRedirect("/admin/invoices/" + id, "The invoice could not be issued. Refresh and try again.");
  }

  revalidatePath("/admin/invoices");
  revalidatePath("/admin/invoices/" + id);
  redirect("/admin/invoices/" + id + "?issued=1");
}
