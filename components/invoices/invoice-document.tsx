import { BrandMark } from "@/components/brand/logo";
import type { Invoice } from "@/db/schema";
import { getCompanyInfo } from "@/lib/company";
import { formatDate } from "@/lib/format";
import type { InvoiceLine } from "@/lib/invoices/model";
import { formatNad } from "@/lib/money";
import { SITE } from "@/lib/site";

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Bank transfer",
  paytoday: "Card (PayToday)",
};

/**
 * The invoice as a document. Everything on it is read from the stored row —
 * the lines as printed, the totals as computed on the day — so reopening it
 * next year shows the same paper.
 */
export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const company = getCompanyInfo();
  const lines = (Array.isArray(invoice.lines) ? invoice.lines : []) as InvoiceLine[];
  const vatRate = Number(invoice.vatRate);
  const method = METHOD_LABEL[invoice.paymentMethod] ?? invoice.paymentMethod;

  return (
    <div className="bg-card rounded-xl border p-6 sm:p-8 print:rounded-none print:border-0 print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3">
          <BrandMark size={44} />
          <div>
            <p className="text-lg leading-tight font-semibold tracking-tight">{SITE.name}</p>
            <p className="text-muted-foreground text-xs">
              A trading name of Chrimson Investments CC
              {company.registration ? ` · ${company.registration}` : ""}
            </p>
            <p className="text-muted-foreground text-xs">{company.location}</p>
            <p className="text-muted-foreground text-xs">
              {[company.whatsapp && `WhatsApp ${company.whatsapp}`, company.email].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {vatRate > 0 ? "Tax invoice" : "Invoice"}
          </p>
          <p className="tabular text-xl font-semibold tracking-tight">{invoice.invoiceNumber}</p>
          <dl className="text-muted-foreground mt-1 space-y-0.5 text-xs">
            <div><dt className="inline">Issued: </dt><dd className="text-foreground inline">{formatDate(invoice.issuedAt)}</dd></div>
            <div><dt className="inline">Paid: </dt><dd className="text-foreground inline">{formatDate(invoice.paidAt)}</dd></div>
          </dl>
        </div>
      </div>

      <div className="grid gap-6 py-5 sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Invoiced to</p>
          <p className="mt-1 text-sm font-medium">{invoice.customerName}</p>
          {invoice.customerEmail && <p className="text-muted-foreground text-sm">{invoice.customerEmail}</p>}
          {invoice.customerWhatsapp && <p className="text-muted-foreground text-sm">{invoice.customerWhatsapp}</p>}
        </div>
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Payment</p>
          <p className="mt-1 text-sm font-medium">{method}</p>
          {invoice.paymentReference && (
            <p className="text-muted-foreground text-sm">Reference {invoice.paymentReference}</p>
          )}
          <p className="text-muted-foreground text-sm">Received {formatDate(invoice.paidAt)} · paid in full</p>
        </div>
      </div>

      <table className="w-full border-b text-sm">
        <thead>
          <tr className="text-muted-foreground text-left text-xs tracking-wider uppercase">
            <th className="py-3 font-medium">Description</th>
            {/* Quantity and unit price are hidden on a phone: every line here
                is one trip at its own price, and three numeric columns in
                360px ran into one another. The amount is the one that matters. */}
            <th className="tabular hidden py-3 pl-4 text-right font-medium sm:table-cell">Qty</th>
            <th className="tabular hidden py-3 pl-4 text-right font-medium sm:table-cell">Unit</th>
            <th className="tabular py-3 pl-4 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={index} className="border-t">
              <td className="max-w-md py-2.5 pr-4 leading-snug text-pretty">{line.description}</td>
              <td className="tabular hidden py-2.5 pl-4 text-right align-top sm:table-cell">{line.quantity}</td>
              <td className="tabular hidden py-2.5 pl-4 text-right align-top sm:table-cell">{formatNad(line.unitAmount)}</td>
              <td className="tabular py-2.5 pl-4 text-right align-top font-medium whitespace-nowrap">{formatNad(line.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto mt-4 max-w-xs space-y-1.5 text-sm">
        {vatRate > 0 && (
          <>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Subtotal (excl. VAT)</dt><dd className="tabular">{formatNad(invoice.subtotal)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">VAT at {(vatRate * 100).toFixed(0)}%</dt><dd className="tabular">{formatNad(invoice.vatAmount)}</dd></div>
          </>
        )}
        <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold">
          <dt>Total paid ({invoice.currency})</dt>
          <dd className="tabular">{formatNad(invoice.total)}</dd>
        </div>
      </dl>

      <p className="text-muted-foreground mt-6 border-t pt-4 text-xs leading-relaxed">
        Thank you for travelling with {SITE.name}. This invoice records a payment already received;
        nothing further is owed on it. Quote the booking reference in any message to us.
      </p>
    </div>
  );
}
