import type { Metadata } from "next";
import Link from "next/link";

import { AdminShell } from "@/components/admin/shell";
import { QuoteStatusSelect } from "@/components/admin/quote-status-select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  QUOTE_SERVICES,
  type QuoteService,
} from "@/lib/corporate/quote-pricing";
import { listCorporateQuotes } from "@/lib/corporate/quote-queries";
import { formatDate } from "@/lib/format";
import { formatNad } from "@/lib/money";

export const metadata: Metadata = {
  title: "Corporate quotes",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminQuotesPage() {
  const quotes = await listCorporateQuotes();

  const pipelineValue = quotes
    .filter((q) => !["rejected", "expired"].includes(q.status))
    .reduce((sum, q) => sum + Number(q.total), 0);
  const acceptedValue = quotes
    .filter((q) => ["accepted", "fulfilled"].includes(q.status))
    .reduce((sum, q) => sum + Number(q.total), 0);

  return (
    <AdminShell active="/admin/quotes">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl">Corporate quotes</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Every quotation is a lead. Move the status as the conversation
            moves — this is the data that shows which industries and routes
            corporate demand comes from.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Quotes issued" value={String(quotes.length)} />
          <Stat label="Open pipeline value" value={formatNad(pipelineValue)} />
          <Stat label="Accepted value" value={formatNad(acceptedValue)} />
        </div>

        {quotes.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
            No quotations yet.
          </p>
        ) : (
          <div className="bg-card rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Pax</TableHead>
                  <TableHead>Trips</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Valid until</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/corporate/quotes/${quote.quoteNumber}`}
                        className="hover:underline"
                      >
                        {quote.quoteNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(quote.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-44 truncate">
                      {quote.companyName}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-32 truncate">
                      {quote.industry ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-36 truncate">
                      {quote.contactName}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-48 truncate">
                      {(quote.services as QuoteService[])
                        .map((service) => QUOTE_SERVICES[service] ?? service)
                        .join(", ")}
                    </TableCell>
                    <TableCell className="tabular">
                      {quote.passengers ?? "—"}
                    </TableCell>
                    <TableCell className="tabular">{quote.tripsCount}</TableCell>
                    <TableCell className="tabular text-brand font-semibold">
                      {formatNad(quote.total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={quote.isEstimate ? "warning" : "success"}>
                        {quote.isEstimate ? "Estimate" : "Fixed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {quote.validUntil ? formatDate(quote.validUntil) : "—"}
                    </TableCell>
                    <TableCell>
                      <QuoteStatusSelect
                        quoteId={quote.id}
                        status={quote.status}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-muted-foreground text-xs">
          Showing up to 500 quotes, newest first. Line items are on each
          quote&rsquo;s public page (linked from the quote number).
        </p>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        {label}
      </p>
      <p className="tabular mt-1 text-2xl font-semibold tracking-tight">
        {value}
      </p>
    </div>
  );
}
