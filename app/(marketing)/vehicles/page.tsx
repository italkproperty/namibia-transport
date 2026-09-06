import type { Metadata } from "next";
import Link from "next/link";

import { FleetSection } from "@/components/marketing/fleet";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { listRoutes, listVehicleClasses } from "@/lib/maps";
import { SITE } from "@/lib/site";

/**
 * The vehicles, on their own page.
 *
 * This used to be 1,747 px in the middle of the home page — the largest block
 * on it — for a choice the booking widget already presents, with the same
 * photographs and the prices attached. It is genuinely useful to somebody
 * deciding between the two classes, and useless to the other nine in ten who
 * have already decided. So it lives here and the widget links to it.
 */
export const metadata: Metadata = {
  title: "The vehicles",
  description: `The cars ${SITE.name} runs — a private car for tarred routes, an SUV or 4x4 for gravel, and a minibus for groups. What each one seats, and which routes it is right for.`,
  alternates: { canonical: "/vehicles" },
};

export const revalidate = 3600;

export default async function VehiclesPage() {
  const [{ routes }, vehicleClasses] = await Promise.all([
    listRoutes({ activeOnly: true }),
    listVehicleClasses(),
  ]);

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <FleetSection vehicleClasses={vehicleClasses} />

          <p className="text-muted-foreground mt-10 border-t pt-6 text-sm">
            Prices for each class are on{" "}
            <Link href="/transfers" className="text-foreground underline underline-offset-4">
              every route we run
            </Link>
            , or{" "}
            <Link href="/journey" className="text-foreground underline underline-offset-4">
              price any journey in Namibia
            </Link>
            .
          </p>
        </div>
      </main>

      <SiteFooter routes={routes} />
    </div>
  );
}
