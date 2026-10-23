import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";

import { Logo } from "@/components/brand/logo";
import { PrintInvoiceButton } from "@/components/invoice/print-button";
import { getDb, isDatabaseConfigured } from "@/db";
import { invoiceLines, invoices } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { formatNad } from "@/lib/money";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Invoice | Namibia Transport",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function PublicInvoicePage({ params }: PageProps) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token) || !isDatabaseConfigured()) notFound();

  let invoice;
  let lines;
  try {
    const db = getDb();
    const [found] = await db.select().from(invoices)
      .where(and(eq(invoices.publicToken, token), eq(invoices.status, "issued")))
      .limit(1);
    if (!found) notFound();
    invoice = found;
    lines = await db.select().from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, found.id))
      .orderBy(asc(invoiceLines.sortOrder));
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error &&
        typeof (error as { digest?: unknown }).digest === "string" &&
        (error as { digest: string }).digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")) throw error;
    console.error("[invoice] public invoice read failed", error);
    notFound();
  }

  return (
    <main className="min-h-svh bg-muted/30 px-4 py-8 sm:py-12 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/" aria-label="Namibia Transport home"><Logo /></Link>
          <PrintInvoiceButton />
        </div>

        <article className="rounded-2xl border bg-background p-6 shadow-sm sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Invoice</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">{invoice.invoiceNumber}</h1>
              <p className="mt-2 text-sm text-muted-foreground">Issued {invoice.issuedAt ? formatDate(invoice.issuedAt) : formatDate(invoice.createdAt)}</p>
            </div>
            <div className="text-left text-sm sm:text-right">
              <p className="font-semibold">Namibia Transport</p>
              <p className="mt-1 text-muted-foreground">Namibia</p>
              {SITE.supportWhatsapp && <p className="text-muted-foreground">WhatsApp: +{SITE.supportWhatsapp}</p>}
            </div>
          </header>

          <section className="grid gap-6 border-b py-6 sm:grid-cols-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill to</h2>
              <p className="mt-2 font-medium">{invoice.billingName}</p>
              {invoice.billingEmail && <p className="mt-1 text-sm text-muted-foreground">{invoice.billingEmail}</p>}
              {invoice.billingWhatsapp && <p className="text-sm text-muted-foreground">{invoice.billingWhatsapp}</p>}
              {invoice.billingAddress && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{invoice.billingAddress}</p>}
            </div>
            <div className="sm:text-right">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment details</h2>
              <p className="mt-2 text-sm">Currency: NAD</p>
              <p className="text-sm">Due date: {invoice.dueAt ? formatDate(invoice.dueAt) : "As agreed"}</p>
            </div>
          </section>

          <section className="py-6">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 text-right font-medium">Qty</th>
                  <th className="pb-3 text-right font-medium">Unit price</th>
                  <th className="pb-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-4 pr-3">{line.description}</td>
                    <td className="py-4 text-right tabular-nums">{Number(line.quantity).toLocaleString("en-NA", { maximumFractionDigits: 2 })}</td>
                    <td className="py-4 text-right tabular-nums">{formatNad(line.unitPrice)}</td>
                    <td className="py-4 text-right font-medium tabular-nums">{formatNad(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="ml-auto max-w-sm space-y-3 border-t pt-5">
            <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatNad(invoice.subtotal)}</span></div>
            {Number(invoice.discountAmount) > 0 && <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Discount</span><span>−{formatNad(invoice.discountAmount)}</span></div>}
            <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">VAT</span><span>N$0.00</span></div>
            <div className="flex justify-between gap-4 border-t pt-3 text-lg font-semibold"><span>Total due</span><span>{formatNad(invoice.total)}</span></div>
          </section>

          <section className="mt-8 space-y-3 border-t pt-5 text-sm">
            <p className="font-medium">VAT status</p>
            <p className="text-muted-foreground">Namibia Transport is not VAT-registered. No VAT has been charged on this invoice.</p>
            {invoice.terms && <><p className="pt-2 font-medium">Payment terms and notes</p><p className="whitespace-pre-line text-muted-foreground">{invoice.terms}</p></>}
          </section>

          <footer className="mt-8 border-t pt-4 text-xs text-muted-foreground">
            Please quote invoice number {invoice.invoiceNumber} when making payment or contacting us about this invoice.
          </footer>
        </article>

        <p className="mt-4 text-center text-xs text-muted-foreground print:hidden">Please quote the invoice number if you contact Namibia Transport about this document.</p>
      </div>
    </main>
  );
}
