/**
 * Invoices: the paper that follows the money.
 *
 * The pure checks hold the arithmetic — VAT carved out of a paid total, never
 * added on top of it, and nothing drifting past the cent. The row checks run
 * against a real Postgres and skip without DATABASE_URL: an invoice must be
 * issued once per paid trip however many times confirmation runs, carry the
 * whole itinerary, and total exactly what the bookings say.
 */
import { eq, inArray } from "drizzle-orm";

import {
  INVOICE_NUMBER_PATTERN,
  formatInvoiceNumber,
  invoiceLine,
  invoiceTotals,
} from "@/lib/invoices/model";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("invoice arithmetic");
{
  const lines = [invoiceLine("WDH to Windhoek", "650.00"), invoiceLine("Windhoek to WDH", "650.00")];
  const zero = invoiceTotals(lines, 0);
  check("two legs total the sum of the legs", zero.total === "1300.00", zero.total);
  check("at a VAT rate of zero the subtotal is the total", zero.subtotal === "1300.00" && zero.vatAmount === "0.00");

  const vat = invoiceTotals(lines, 0.15);
  check("THE RULE: VAT is carved out of what was paid, never added on top", vat.total === "1300.00", vat.total);
  check("subtotal + VAT reproduces the total to the cent", (Number(vat.subtotal) + Number(vat.vatAmount)).toFixed(2) === "1300.00", `${vat.subtotal} + ${vat.vatAmount}`);
  check("the VAT share is 15/115 of the total", vat.vatAmount === "169.57", vat.vatAmount);

  check("a nonsense rate is treated as none", invoiceTotals(lines, 1.5).vatAmount === "0.00");
  const line = invoiceLine("Three nights", "450.00", 3);
  check("a line multiplies in cents", line.amount === "1350.00" && line.unitAmount === "450.00");
  check("a float price is rounded, not carried", invoiceLine("x", 0.1 + 0.2).amount === "0.30");
  check("numbers are NT-INV-year-sequence", INVOICE_NUMBER_PATTERN.test(formatInvoiceNumber(2026, 7)) && formatInvoiceNumber(2026, 7) === "NT-INV-2026-0007");
}

async function rows() {
  console.log("\ninvoices against rows");
  if (!process.env.DATABASE_URL) {
    console.log("  -- skipped, no DATABASE_URL");
    return;
  }
  const { getDb } = await import("@/db");
  const { bookings, charterQuotePayments, charterQuotes, customers, invoices, payments } = await import("@/db/schema");
  const { issueInvoiceForBooking, issueInvoiceForCharter, getInvoiceByToken, invoiceLinksFor } = await import("@/lib/invoices/issue");
  const db = getDb();

  const CUSTOMER = "00000000-0000-4000-8000-00000000c0de";
  const REFS = ["NT-INVT1", "NT-INVT2", "NT-INVT3"];
  const GROUP = "GRP-INVT";
  const QUOTE_NO = "NT-CQ-TEST-INVOICE";

  const cleanup = async () => {
    await db.delete(invoices).where(eq(invoices.groupRef, GROUP));
    await db.delete(invoices).where(eq(invoices.groupRef, REFS[2]));
    const q = await db.select({ id: charterQuotes.id }).from(charterQuotes).where(eq(charterQuotes.quoteNumber, QUOTE_NO));
    for (const row of q) {
      await db.delete(invoices).where(eq(invoices.charterQuoteId, row.id));
      await db.delete(charterQuotePayments).where(eq(charterQuotePayments.quoteId, row.id));
      await db.delete(charterQuotes).where(eq(charterQuotes.id, row.id));
    }
    const b = await db.select({ id: bookings.id }).from(bookings).where(inArray(bookings.ref, REFS));
    if (b.length) await db.delete(payments).where(inArray(payments.bookingId, b.map((r) => r.id)));
    await db.delete(bookings).where(inArray(bookings.ref, REFS));
    await db.delete(customers).where(eq(customers.id, CUSTOMER));
  };
  await cleanup();

  try {
    await db.insert(customers).values({ id: CUSTOMER, fullName: "Invoice Test", email: null, whatsapp: "+264810000000" });
    const base = {
      customerId: CUSTOMER,
      pickupLabel: "Hosea Kutako International Airport (WDH)",
      dropoffLabel: "Windhoek",
      scheduledAt: new Date(Date.now() + 5 * 86_400_000),
      customerPrice: "650.00",
      driverPayout: "455.00",
      contribution: "195.00",
    };
    const [legA] = await db.insert(bookings).values({ ...base, ref: REFS[0], groupRef: GROUP, status: "confirmed" }).returning();
    const [legB] = await db.insert(bookings).values({ ...base, ref: REFS[1], groupRef: GROUP, status: "confirmed", customerPrice: "700.00" }).returning();
    const [single] = await db.insert(bookings).values({ ...base, ref: REFS[2], status: "confirmed" }).returning();

    // Nothing paid yet: there is nothing to invoice, and that is said.
    const premature = await issueInvoiceForBooking(legA.id);
    check("no confirmed payment means no invoice, with a reason", !premature.ok && /nothing to invoice/.test(premature.ok ? "" : premature.error));

    await db.insert(payments).values({ bookingId: legA.id, provider: "bank_transfer", status: "paid", amount: "1350.00", currency: "NAD", paidAt: new Date() });

    const first = await issueInvoiceForBooking(legA.id);
    check("a paid itinerary gets an invoice", first.ok && first.created, first.ok ? "" : first.error);
    if (!first.ok) throw new Error(first.error);
    check("numbered NT-INV-year-sequence", INVOICE_NUMBER_PATTERN.test(first.invoice.invoiceNumber), first.invoice.invoiceNumber);
    check("THE RULE: the invoice carries the whole trip, not the leg that was pressed", Array.isArray(first.invoice.lines) && (first.invoice.lines as unknown[]).length === 2);
    check("and totals what the legs say", first.invoice.total === "1350.00", first.invoice.total);
    check("keyed on the itinerary", first.invoice.groupRef === GROUP);
    check("records how it was paid", first.invoice.paymentMethod === "bank_transfer");

    const again = await issueInvoiceForBooking(legB.id);
    check("confirming the other leg finds the same invoice", again.ok && !again.created && again.invoice.id === first.invoice.id);
    const count = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.groupRef, GROUP));
    check("one row per paid trip, however many confirmations ran", count.length === 1, `${count.length} rows`);

    const byToken = await getInvoiceByToken(first.invoice.publicToken);
    check("the private link resolves", byToken?.id === first.invoice.id);
    check("a made-up token does not", (await getInvoiceByToken("not-a-real-token")) === null);
    const links = await invoiceLinksFor([GROUP, REFS[2], "GRP-NOPE"]);
    check("links are looked up by key, missing ones absent", links.get(GROUP)?.invoiceNumber === first.invoice.invoiceNumber && !links.has(REFS[2]) && !links.has("GRP-NOPE"));

    // A booking with no group is keyed on its own reference.
    await db.insert(payments).values({ bookingId: single.id, provider: "paytoday", providerReference: "PT-123", status: "paid", amount: "650.00", currency: "NAD", paidAt: new Date() });
    const solo = await issueInvoiceForBooking(single.id);
    check("a single booking is keyed on its own reference", solo.ok && solo.invoice.groupRef === REFS[2] && solo.invoice.total === "650.00");
    check("and names the gateway reference", solo.ok && solo.invoice.paymentReference === "PT-123");
    check("sequence numbers differ", solo.ok && solo.invoice.invoiceNumber !== first.invoice.invoiceNumber);

    // Charter: one line for the agreed figure.
    const [quote] = await db.insert(charterQuotes).values({
      quoteNumber: QUOTE_NO,
      status: "sent",
      customerName: "Jen Test",
      customerEmail: null,
      itinerarySnapshot: { stops: [{ label: "Namib Desert Lodge" }, { label: "Sossus Dune Lodge" }, { label: "Hilton Windhoek" }] },
      costSnapshot: {},
      pricingSnapshot: {},
      total: "44450.00",
      currency: "NAD",
    }).returning();
    const unpaidCharter = await issueInvoiceForCharter(quote.id);
    check("an unpaid charter has nothing to invoice", !unpaidCharter.ok);
    await db.insert(charterQuotePayments).values({ quoteId: quote.id, provider: "bank_transfer", providerReference: QUOTE_NO, status: "paid", amount: "44450.00", currency: "NAD", paidAt: new Date() });
    const charter = await issueInvoiceForCharter(quote.id);
    check("a paid charter gets one line for the agreed figure", charter.ok && charter.created && (charter.invoice.lines as unknown[]).length === 1 && charter.invoice.total === "44450.00", charter.ok ? "" : charter.error);
    check("the line names the route", charter.ok && /Namib Desert Lodge to Hilton Windhoek, 3 stops/.test((charter.invoice.lines as { description: string }[])[0].description));
    const charterAgain = await issueInvoiceForCharter(quote.id);
    check("and only once", charterAgain.ok && !charterAgain.created && charterAgain.invoice.id === (charter.ok ? charter.invoice.id : ""));
  } finally {
    await cleanup();
  }
}

rows()
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed\n`);
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error("threw:", error);
    process.exit(1);
  });
