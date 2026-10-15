import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";

import { AdminShell } from "@/components/admin/shell";
import { getDb, isDatabaseConfigured } from "@/db";
import { charterQuotes } from "@/db/schema";
import { READ_DEADLINE_MS, withDeadline } from "@/lib/deadline";
import { formatDate } from "@/lib/format";
import { formatNad } from "@/lib/money";

export const metadata: Metadata = {
  title: "Charter quote drafts",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Snapshot = { stops?: { label?: string }[] };

export default async function CharterQuoteDraftsPage() {
  let quotes: (typeof charterQuotes.$inferSelect)[] = [];
  let unavailable = false;
  if (isDatabaseConfigured()) {
    try {
      quotes = await withDeadline("charter quote draft list", READ_DEADLINE_MS, () =>
        getDb().select().from(charterQuotes).orderBy(desc(charterQuotes.createdAt)).limit(100),
      );
    } catch (error) {
      unavailable = true;
      console.error("[charter-quotes] draft list unavailable", error);
    }
  } else {
    unavailable = true;
  }

  return (
    <AdminShell active="/admin/quotes">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/admin/quotes/charter" className="text-xs text-muted-foreground hover:underline">← Charter planner</Link>
            <h1 className="mt-2 text-xl font-semibold">Charter quote drafts</h1>
            <p className="mt-1 text-sm text-muted-foreground">Private drafts and their saved totals. Drafts are not approved or sent to customers.</p>
          </div>
          <Link href="/admin/quotes/charter" className="rounded-md border px-3 py-2 text-sm hover:bg-muted">Create charter draft</Link>
        </div>

        {unavailable && (
          <div role="alert" className="rounded-lg border border-amber-400/50 bg-amber-50 p-4 text-sm text-amber-950">
            Drafts could not be loaded. If the charter quote migration has not been applied, run the updated <code>db/manual/RUN-ME.sql</code> in the Supabase SQL editor. No existing bookings or fares are affected.
          </div>
        )}

        {!unavailable && quotes.length === 0 && (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-medium">No charter drafts saved yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Calculate a verified route and save it as a private draft to create the first record.</p>
          </div>
        )}

        {quotes.length > 0 && (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[52rem] text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground">
                <th className="p-3 font-medium">Quote</th><th className="p-3 font-medium">Created</th><th className="p-3 font-medium">Customer</th><th className="p-3 font-medium">Itinerary</th><th className="p-3 text-right font-medium">Total</th><th className="p-3 font-medium">Status</th><th className="p-3 text-right font-medium">Version</th>
              </tr></thead>
              <tbody>
                {quotes.map((quote) => {
                  const itinerary = quote.itinerarySnapshot as Snapshot;
                  const labels = (itinerary?.stops ?? []).map((stop) => stop.label).filter(Boolean);
                  return <tr key={quote.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{quote.quoteNumber}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(quote.createdAt)}</td>
                    <td className="p-3">{quote.customerName}<span className="block text-xs text-muted-foreground">{quote.customerEmail || quote.customerWhatsapp || "No contact"}</span></td>
                    <td className="max-w-80 p-3">{labels.length ? labels.join(" → ") : "Saved itinerary"} </td>
                    <td className="p-3 text-right font-semibold tabular-nums">{formatNad(quote.total)}</td>
                    <td className="p-3"><span className="rounded-full border px-2 py-1 text-xs capitalize">{quote.status}</span></td>
                    <td className="p-3 text-right tabular-nums">{quote.currentVersion}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Showing the latest 100 records. Customer-facing issue/send actions are intentionally not enabled in this increment.</p>
      </div>
    </AdminShell>
  );
}
