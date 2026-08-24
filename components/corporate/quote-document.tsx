import { BrandMark } from "@/components/brand/logo";
import { getCompanyInfo } from "@/lib/company";
import { QUOTE_SERVICES, type QuoteService } from "@/lib/corporate/quote-pricing";
import type { QuoteDetail } from "@/lib/corporate/quote-queries";
import { formatDate } from "@/lib/format";
import { formatNad } from "@/lib/money";
import { SITE } from "@/lib/site";

/**
 * The quotation as a document — letterhead, parties, line items, totals,
 * terms. Rendered identically on the web view and the A4 print route, so what
 * a procurement manager files is exactly what the customer saw.
 */
export function QuoteDocument({ detail }: { detail: QuoteDetail }) {
  const { quote, items } = detail;
  const company = getCompanyInfo();
  const vatRate = Number(quote.vatRate);
  const services = (quote.services as QuoteService[])
    .map((service) => QUOTE_SERVICES[service] ?? service)
    .join(", ");

  return (
    <div className="bg-card rounded-xl border p-6 sm:p-8 print:rounded-none print:border-0 print:p-0">
      {/* ------------------------------------------------------ letterhead */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3">
          <BrandMark size={44} />
          <div>
            <p className="text-lg leading-tight font-semibold tracking-tight">
              {SITE.name}
            </p>
            <p className="text-muted-foreground text-xs">
              {company.location}
              {company.registration ? ` · ${company.registration}` : ""}
            </p>
            <p className="text-muted-foreground text-xs">
              {[company.whatsapp && `WhatsApp ${company.whatsapp}`, company.email]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {quote.isEstimate ? "Estimate" : "Quotation"}
          </p>
          <p className="tabular text-xl font-semibold tracking-tight">
            {quote.quoteNumber}
          </p>
          <dl className="text-muted-foreground mt-1 space-y-0.5 text-xs">
            <div>
              <dt className="inline">Date: </dt>
              <dd className="text-foreground inline">
                {formatDate(quote.createdAt)}
              </dd>
            </div>
            {quote.validUntil && (
              <div>
                <dt className="inline">Valid until: </dt>
                <dd className="text-foreground inline">
                  {formatDate(quote.validUntil)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* --------------------------------------------------------- parties */}
      <div className="grid gap-6 border-b py-5 sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Prepared for
          </p>
          <p className="mt-1 font-semibold">{quote.companyName}</p>
          <p className="text-muted-foreground text-sm">
            {quote.contactName}
            {quote.contactPosition ? `, ${quote.contactPosition}` : ""}
          </p>
          <p className="text-muted-foreground text-sm">
            {[quote.email, quote.whatsapp].filter(Boolean).join(" · ")}
          </p>
          {quote.billingAddress && (
            <p className="text-muted-foreground text-sm">{quote.billingAddress}</p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Transport requirement
          </p>
          <ul className="text-muted-foreground mt-1 space-y-0.5 text-sm">
            <li>
              <span className="text-foreground">{services}</span>
            </li>
            {quote.passengers && (
              <li>
                {quote.passengers} passenger{quote.passengers === 1 ? "" : "s"}
                {quote.vehicles > 1 ? ` · ${quote.vehicles} vehicles` : ""}
              </li>
            )}
            <li>
              {quote.tripsCount} trip{quote.tripsCount === 1 ? "" : "s"}
              {quote.includeReturn ? " (including return legs)" : ""}
            </li>
            {quote.datesNote && <li>{quote.datesNote}</li>}
            {quote.notes && <li className="text-pretty">{quote.notes}</li>}
          </ul>
        </div>
      </div>

      {/* ------------------------------------------------------ line items */}
      <table className="w-full border-b text-sm">
        <thead>
          <tr className="text-muted-foreground text-left text-xs tracking-wider uppercase">
            <th className="py-3 font-medium">Item</th>
            <th className="tabular py-3 text-right font-medium">Qty</th>
            <th className="tabular py-3 text-right font-medium">Unit</th>
            <th className="tabular py-3 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t">
              <td className="max-w-md py-2.5 pr-4 leading-snug text-pretty">
                {item.description}
              </td>
              <td className="tabular py-2.5 text-right align-top">
                {item.unitPrice === null ? "—" : item.quantity}
              </td>
              <td className="tabular py-2.5 text-right align-top">
                {item.unitPrice === null ? "—" : formatNad(item.unitPrice)}
              </td>
              <td className="tabular py-2.5 text-right align-top font-medium">
                {item.lineTotal === null ? "TBC" : formatNad(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ----------------------------------------------------------- totals */}
      <div className="ml-auto max-w-xs py-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular font-medium">{formatNad(quote.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              {vatRate > 0 ? `VAT (${Math.round(vatRate * 100)}%)` : "VAT"}
            </dt>
            <dd className="tabular font-medium">
              {vatRate > 0 ? formatNad(quote.vatAmount) : "Not applicable"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between border-t pt-2">
            <dt className="font-semibold">Total</dt>
            <dd className="tabular text-brand text-2xl font-semibold tracking-tight">
              {formatNad(quote.total)}
            </dd>
          </div>
        </dl>
      </div>

      {/* ------------------------------------------------------------ terms */}
      <div className="text-muted-foreground border-t pt-4 text-xs leading-relaxed">
        <p className="text-foreground font-medium">Terms</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>
            {quote.isEstimate
              ? "This is an estimate: items marked TBC are scoped by our operations team and confirmed in the final quotation within 24 hours."
              : "This is a fixed quotation for the requirement described above."}
          </li>
          <li>
            Valid until {quote.validUntil ? formatDate(quote.validUntil) : "the date shown"};
            pricing thereafter on request.
          </li>
          <li>
            Invoicing monthly on account, or per engagement — payment details
            are confirmed on acceptance. No payment is due with this document.
          </li>
          <li>
            Transfers are fulfilled by vetted independent Namibian partner
            drivers under {SITE.name}&rsquo;s booking, standards and support.
          </li>
        </ul>
      </div>
    </div>
  );
}
