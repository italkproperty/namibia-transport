import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { AdminShell } from "@/components/admin/shell";
import { ItineraryBuilder } from "@/components/admin/itinerary-builder";
import { QuoteForm } from "@/components/admin/quote-form";
import { pendingMigrations } from "@/lib/admin/migrations";
import { listVehicleClasses } from "@/lib/maps";
import { REGION_LABELS, PLACE_NODES } from "@/lib/network/nodes";
import { isBankTransferConfigured } from "@/lib/payments/bank";

export const metadata: Metadata = {
  title: "New quote",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  const [vehicleClasses, bankReady, pending] = await Promise.all([
    listVehicleClasses(),
    Promise.resolve(isBankTransferConfigured()),
    pendingMigrations(),
  ]);

  const places = PLACE_NODES.map((node) => ({
    slug: node.slug,
    name: node.name,
    region: REGION_LABELS[node.region],
    isAirport: node.isAirport,
  }));

  return (
    <AdminShell active="/admin/quotes">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link
            href="/admin/quotes"
            className="text-muted-foreground hover:text-foreground focus-ring inline-flex items-center gap-1.5 rounded-sm text-xs"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            Quotes
          </Link>
          <h1 className="mt-2 text-xl">Quote a trip</h1>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm text-pretty">
            Any two places in the country, or a whole itinerary with stops. The
            price comes from the road model — distance, surface and the nights a
            driver is away — and comes back as one link to send.
          </p>
        </div>

        {pending.length > 0 && (
          <div className="border-destructive/30 bg-destructive-subtle/50 rounded-xl border p-4">
            <p className="text-sm font-medium">
              The database is missing{" "}
              {pending.length === 1 ? "a column" : "columns"} this needs
            </p>
            <ul className="text-muted-foreground mt-1.5 grid gap-1 text-sm">
              {pending.map((item) => (
                <li key={item.column}>
                  <code className="text-foreground">{item.column}</code> —{" "}
                  {item.what}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-2 text-sm leading-snug">
              Run <code className="text-foreground">{pending[0].file}</code> in
              the Supabase SQL editor. It is safe to run twice.
            </p>
          </div>
        )}

        {!bankReady && (
          <div className="border-warning/30 bg-warning-subtle/50 rounded-xl border p-4">
            <p className="text-sm font-medium">
              Bank details are not set on this deployment
            </p>
            <p className="text-muted-foreground mt-1 text-sm leading-snug">
              The quote will show the trip and the fare, but no way to pay. Set{" "}
              <code className="text-foreground">BANK_ACCOUNT_NAME</code>,{" "}
              <code className="text-foreground">BANK_ACCOUNT_NUMBER</code> and{" "}
              <code className="text-foreground">BANK_BRANCH_CODE</code> in
              Vercel, then redeploy.
            </p>
          </div>
        )}

        <ItineraryBuilder places={places} />

        {/* The builder handles a single leg as a two-stop trip, so this is for
            the other case: a fare already settled on a call, where the model's
            number is not the one that was agreed. */}
        <details className="border-t pt-6">
          <summary className="cursor-pointer text-sm font-semibold">
            Or: one leg at a price already agreed
          </summary>
          <div className="mt-4">
            <QuoteForm
              places={places}
              vehicleClasses={vehicleClasses.map((vc) => ({
                id: vc.id,
                name: vc.name,
              }))}
            />
          </div>
        </details>
      </div>
    </AdminShell>
  );
}
