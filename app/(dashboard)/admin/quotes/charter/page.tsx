import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { AdminShell } from "@/components/admin/shell";
import { CharterQuotePlanner } from "@/components/admin/charter-quote-planner";
import { listVehicleClasses } from "@/lib/maps";
import { getCharterCostSettings } from "@/lib/charter/settings";

export const metadata: Metadata = {
  title: "Charter quote planner",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CharterQuotePage() {
  const [classes, settings] = await Promise.all([
    listVehicleClasses(),
    getCharterCostSettings(),
  ]);
  const vehicles = classes.map((vehicle) => ({
    id: vehicle.id,
    name: vehicle.name,
    hasProfile: settings.profiles.some((profile) => profile.vehicleClassId === vehicle.id),
  }));

  return (
    <AdminShell active="/admin/quotes">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/admin/quotes/new"
          className="text-muted-foreground hover:text-foreground focus-ring inline-flex items-center gap-1.5 rounded-sm text-xs"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden />
          Standard quote builder
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="mt-2 text-xl">Charter quote planner</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              A separate route and cost model for bespoke multi-stop charters. This does not change existing public transfer fares.
            </p>
          </div>
          <Link href="/admin/quotes/charter/drafts" className="rounded-md border px-3 py-2 text-sm hover:bg-muted">Saved charter drafts</Link>
        </div>
        {!settings.stored && (
          <div className="rounded-lg border border-amber-400/50 bg-amber-50 p-4 text-sm text-amber-950">
            Charter settings have not been saved yet. Open <Link className="underline font-medium" href="/admin/pricing">Admin → Pricing</Link> and save the charter vehicle profiles before pricing.
          </div>
        )}
        <CharterQuotePlanner vehicles={vehicles} />
      </div>
    </AdminShell>
  );
}
