import type { Metadata } from "next";
import Link from "next/link";

import { BookingForm } from "@/components/booking/booking-form";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { listRoutes, listVehicleClasses } from "@/lib/maps";
import { dropoffOptions, pickupOptions } from "@/lib/places";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Book a transfer",
  description: `Book a fixed-price private transfer with ${SITE.name}.`,
  robots: { index: false, follow: true },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BookPage({ searchParams }: PageProps) {
  const [{ routes }, vehicleClasses, params] = await Promise.all([
    listRoutes({ activeOnly: true }),
    listVehicleClasses(),
    searchParams,
  ]);

  // Pick-lists are derived per route on the server, so the client component
  // never has to know how destinations are curated.
  const routeOptions = routes.map((route) => ({
    route,
    pickupOptions: pickupOptions(route),
    dropoffOptions: dropoffOptions(route),
  }));

  const requestedSlug = firstValue(params.route);
  const initialSlug =
    routes.find((route) => route.slug === requestedSlug)?.slug ??
    routes[0]?.slug;

  const utm = ["utm_source", "utm_medium", "utm_campaign"]
    .map((key) => {
      const value = firstValue(params[key]);
      return value ? `${key}=${value}` : null;
    })
    .filter(Boolean)
    .join("&");

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          {routeOptions.length === 0 || !initialSlug ? (
            <div className="border-border mx-auto max-w-lg rounded-2xl border border-dashed p-10 text-center">
              <h1 className="font-display text-2xl">
                Bookings are not open yet
              </h1>
              <p className="text-muted-foreground mt-3 text-sm">
                No routes are published. Please check back shortly.
              </p>
              <Link
                href="/"
                className="mt-6 inline-block text-sm underline underline-offset-4"
              >
                Back to home
              </Link>
            </div>
          ) : (
            <>
              <header className="max-w-2xl">
                <h1 className="font-display text-4xl sm:text-5xl">
                  Book your transfer
                </h1>
                <p className="text-muted-foreground mt-4 text-pretty">
                  Takes about a minute. You will see the full price before you
                  confirm, and nothing is charged today.
                </p>
              </header>

              <div className="mt-10">
                <BookingForm
                  routeOptions={routeOptions}
                  vehicleClasses={vehicleClasses}
                  initialRouteSlug={initialSlug}
                  utm={utm}
                />
              </div>
            </>
          )}
        </div>
      </main>

      <SiteFooter routes={routes} />
    </div>
  );
}
