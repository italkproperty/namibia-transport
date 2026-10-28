import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { AdminShell } from "@/components/admin/shell";
import { Button } from "@/components/ui/button";
import { getDb, isDatabaseConfigured } from "@/db";
import { invoicePayments, invoices } from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";
import { issueInvoice, recordInvoicePayment, updateInvoiceDraft } from "@/lib/admin/invoice-actions";
import { formatDate } from "@/lib/format";
import { formatNad } from "@/lib/money";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Invoice details",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function dateInput(value: Date | null): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Windhoek",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

export default async function InvoiceDetailPage({ params, searchParams }: PageProps) {
  const gate = await getAdminGateState();
  const { id } = await params;
  const query = await searchParams;
  const error = one(query.error);
  const issued = one(query.issued);
  const saved = one(query.saved);
  const payment = one(query.payment);

  if (gate.state !== "signed-in") {
    return <AdminShell active="/admin/invoices"><div /></AdminShell>;
  }
  if (!isDatabaseConfigured()) {
    return <AdminShell active="/admin/invoices"><p className="rounded-xl border border-dashed p-6 text-sm">The database is not configured.</p></AdminShell>;
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  let invoice: typeof invoices.$inferSelect;
  let paymentRows: Array<typeof invoicePayments.$inferSelect> = [];
  try {
    const db = getDb();
    const [found] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!found) notFound();
    invoice = found;
    if (found.status === "issued") {
      paymentRows = await db.select().from(invoicePayments)
        .where(eq(invoicePayments.invoiceId, id)).orderBy(asc(invoicePayments.paidAt));
    }
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error &&
        typeof (error as { digest?: unknown }).digest === "string" &&
        (error as { digest: string }).digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")) throw error;
    console.error("[admin] invoice detail failed", error);
    return <AdminShell active="/admin/invoices"><p role="alert" className="rounded-xl border border-destructive/40 p-6 text-sm">The invoice could not be loaded. Please retry later.</p></AdminShell>;
  }

  const paidAmount = paymentRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const balance = Math.max(0, Number(invoice.total) - paidAmount);
  const publicUrl = invoice.publicToken
    ? SITE.url.replace(/\/+$/, "") + "/invoice/" + encodeURIComponent(invoice.publicToken)
    : null;

  return (
    <AdminShell active="/admin/invoices">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin/invoices" className="text-sm text-muted-foreground hover:text-foreground">← All invoices</Link>
            <h1 className="mt-3 text-xl font-semibold">{invoice.invoiceNumber ?? "Draft invoice"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Created {formatDate(invoice.createdAt)} · {invoice.status === "issued" ? "Issued invoice — details are locked" : invoice.status === "void" ? "Voided invoice" : "Draft — editable until issue"}</p>
          </div>
          {publicUrl && <Button asChild variant="outline" size="sm"><a href={publicUrl} target="_blank" rel="noreferrer">Open client invoice ↗</a></Button>}
        </div>

        {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}
        {issued && <p role="status" className="rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-3 text-sm">Invoice issued. Its invoice number and issued details are now locked.</p>}
        {saved && <p role="status" className="rounded-lg border p-3 text-sm">Draft changes saved.</p>}
        {payment && <p role="status" className="rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-3 text-sm">Verified payment allocation recorded.</p>}

        <div className="grid gap-4 sm:grid-cols-[1fr_260px]">
          <div className="rounded-xl border p-5 sm:p-6">
            <h2 className="font-semibold">Invoice summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              <SummaryRow label="Bill to" value={invoice.billingName} />
              <SummaryRow label="Email" value={invoice.billingEmail ?? "—"} />
              <SummaryRow label="WhatsApp" value={invoice.billingWhatsapp ?? "—"} />
              <SummaryRow label="Billing address" value={invoice.billingAddress ?? "—"} />
              <SummaryRow label="Service" value={invoice.description} />
              <SummaryRow label="Due date" value={invoice.dueAt ? formatDate(invoice.dueAt) : "Not specified"} />
            </div>
            <div className="mt-6 border-t pt-4">
              <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatNad(invoice.subtotal)}</span></div>
              <div className="mt-2 flex justify-between gap-4 text-sm"><span className="text-muted-foreground">VAT</span><span>N$0.00</span></div>
              <div className="mt-3 flex justify-between gap-4 border-t pt-3 text-base font-semibold"><span>Total</span><span>{formatNad(invoice.total)}</span></div>
              <p className="mt-3 text-xs text-muted-foreground">Namibia Transport is not VAT-registered. No VAT has been charged.</p>
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">Document status</p>
              <p className="mt-1 font-semibold capitalize">{invoice.status}</p>
              <p className="mt-2 text-xs text-muted-foreground">{invoice.status === "draft" ? "No official number has been allocated yet." : "The issued document is immutable."}</p>
              {invoice.status === "issued" && <div className="mt-4 border-t pt-3 text-sm"><div className="flex justify-between gap-2"><span className="text-muted-foreground">Paid</span><span>{formatNad(paidAmount)}</span></div><div className="mt-2 flex justify-between gap-2 font-medium"><span>Outstanding</span><span>{formatNad(balance)}</span></div><p className="mt-2 text-xs text-muted-foreground">Only manually verified payments recorded by an administrator are included.</p></div>}
            </div>
            {publicUrl && <div className="rounded-xl border p-4">
              <p className="text-sm font-medium">Secure client link</p>
              <p className="mt-2 break-all text-xs text-muted-foreground">{publicUrl}</p>
              <p className="mt-2 text-xs text-muted-foreground">Share this link with the customer. The client page contains only the issued invoice snapshot.</p>
            </div>}
          </aside>
        </div>


        {invoice.status === "issued" && (
          <section className="space-y-4 rounded-xl border p-5 sm:p-6">
            <div>
              <h2 className="font-semibold">Payment allocations</h2>
              <p className="mt-1 text-sm text-muted-foreground">Record a payment only after verifying the funds in the bank or payment provider. This form does not verify gateway transactions automatically.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Invoice total" value={formatNad(Number(invoice.total))} />
              <Stat label="Payments recorded" value={formatNad(paidAmount)} />
              <Stat label="Outstanding balance" value={formatNad(balance)} />
            </div>
            {paymentRows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Method</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
                  <tbody className="divide-y">{paymentRows.map((row) => <tr key={row.id}><td className="px-3 py-2">{formatDate(row.paidAt)}</td><td className="px-3 py-2">{row.method.replace("_", " ")}</td><td className="px-3 py-2">{row.reference ?? "—"}</td><td className="px-3 py-2 text-right tabular-nums">{formatNad(row.amount)}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No payments have been allocated to this invoice yet.</p>}
            {balance > 0.000001 ? (
              <form action={recordInvoicePayment} className="space-y-4 rounded-lg bg-muted/30 p-4">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <h3 className="font-medium">Record verified payment</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Amount received (NAD)" name="amount" type="number" min="0.01" max={balance.toFixed(2)} step="0.01" required />
                  <Field label="Payment date" name="paidAt" type="date" defaultValue={dateInput(new Date())} required />
                  <div className="space-y-2"><label htmlFor="method" className="text-sm font-medium">Payment method</label><select id="method" name="method" required defaultValue="bank_transfer" className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"><option value="bank_transfer">Bank transfer</option><option value="card">Card / online gateway</option><option value="cash">Cash</option><option value="other">Other</option></select></div>
                  <Field label="Bank / gateway reference (optional)" name="reference" />
                </div>
                <div className="space-y-2"><label htmlFor="paymentNotes" className="text-sm font-medium">Internal notes (optional)</label><textarea id="paymentNotes" name="notes" rows={2} maxLength={1000} className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm" /></div>
                <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" name="confirmVerified" value="yes" required />I have independently verified that this payment was received and cleared.</label>
                <div className="flex justify-end"><Button type="submit">Record payment</Button></div>
              </form>
            ) : <p role="status" className="rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-3 text-sm">This invoice is fully paid based on recorded allocations.</p>}
          </section>
        )}

        {invoice.status === "draft" ? (
          <>
            <form action={updateInvoiceDraft} className="space-y-5 rounded-xl border p-5 sm:p-6">
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <h2 className="font-semibold">Edit draft</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Customer / company name" name="billingName" defaultValue={invoice.billingName} required />
                <Field label="Email address" name="billingEmail" type="email" defaultValue={invoice.billingEmail ?? ""} />
                <Field label="WhatsApp number" name="billingWhatsapp" type="tel" defaultValue={invoice.billingWhatsapp ?? ""} />
                <Field label="Billing address" name="billingAddress" defaultValue={invoice.billingAddress ?? ""} />
                <Field label="Total amount (NAD)" name="amount" type="number" min="0.01" max="99999999.99" step="0.01" defaultValue={invoice.total} required />
                <Field label="Due date" name="dueAt" type="date" defaultValue={dateInput(invoice.dueAt)} />
              </div>
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">Service description</label>
                <textarea id="description" name="description" rows={3} maxLength={1000} required defaultValue={invoice.description} className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm" />
              </div>
              <div className="space-y-2">
                <label htmlFor="terms" className="text-sm font-medium">Payment terms / notes</label>
                <textarea id="terms" name="terms" rows={3} maxLength={2000} defaultValue={invoice.terms ?? ""} className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end"><Button type="submit" variant="outline">Save draft changes</Button></div>
            </form>

            <form action={issueInvoice} className="rounded-xl border border-primary/30 p-5 sm:p-6">
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <h2 className="font-semibold">Issue invoice</h2>
              <p className="mt-1 text-sm text-muted-foreground">Issuing assigns a permanent number and locks the billing details and amount. Corrections after issue must use a controlled credit-note workflow.</p>
              <label className="mt-4 flex items-start gap-2 text-sm">
                <input className="mt-1" type="checkbox" name="confirmIssue" value="yes" required />
                I have checked the customer details, service description, total and payment terms.
              </label>
              <div className="mt-4 flex justify-end"><Button type="submit">Issue invoice</Button></div>
            </form>
          </>
        ) : invoice.status === "issued" ? (
          <div className="rounded-xl border p-5">
            <h2 className="font-semibold">Issued document</h2>
            <p className="mt-1 text-sm text-muted-foreground">Open the client-facing version and use the browser&apos;s Print / Save as PDF function. Automatic payment allocation and receipts are scheduled for the next finance phase.</p>
            {publicUrl && <Button asChild className="mt-4"><a href={publicUrl} target="_blank" rel="noreferrer">View / print invoice</a></Button>}
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums">{value}</p></div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 sm:grid-cols-[130px_1fr]"><span className="text-muted-foreground">{label}</span><span className="break-words">{value}</span></div>;
}

function Field({
  label, name, type = "text", required = false, defaultValue, min, max, step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  return <div className="space-y-2">
    <label htmlFor={name} className="text-sm font-medium">{label}{required ? " *" : ""}</label>
    <input id={name} name={name} type={type} required={required} defaultValue={defaultValue} min={min} max={max} step={step} className="border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm" />
  </div>;
}
