import type { Metadata } from "next";
import Link from "next/link";
import { PencilIcon } from "lucide-react";

import { BookingDetailsForm } from "@/components/booking/booking-details-form";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import {
  buildTripQuery,
  parseTripParams,
} from "@/lib/booking/trip-params";
import { formatDuration } from "@/lib/format";
import { listRoutes, listVehicleClasses } from "@/lib/maps";
import { formatNad } from "@/lib/money";
import { computeFare, unitFare } from "@/lib/pricing";
import { dropoffPlaces, pickupPlaces } from "@/lib/places";
import { routeTitle } from "@/lib/route-content";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Confirm your booking",
  description: `Complete your fixed-price transfer booking with ${SITE.name}.`,
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

  if (routes.length === 0 || vehicleClasses.length === 0) {
    return (
      <div className="flex min-h-svh flex-col">
        <SiteHeader />
        <main className="mx-auto flex max-w-md flex-1 flex-col justify-center px-4 py-16 text-center">
          <h1 className="text-xl">Bookings are not open yet</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            No routes are published. Please check back shortly.
          </p>
          <Link href="/" className="mt-5 text-sm underline underline-offset-4">
            Back to home
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const trip = parseTripParams(params, routes, vehicleClasses);
  const route = routes.find((r) => r.slug === trip.routeSlug) ?? routes[0];
  const vehicleClass =
    vehicleClasses.find((c) => c.id === trip.vehicleClassId) ?? vehicleClasses[0];

  // Display only. The Server Action recomputes this before writing anything.
  const fare = computeFare(route, vehicleClass, trip.passengers);
  const duration = formatDuration(route.durationMin);

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
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <h1 className="text-xl sm:text-2xl">Confirm your booking</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            One step. Nothing is charged today.
          </p>

          <div className="mt-5 grid gap-5 lg:grid-cols-[20rem_1fr] lg:items-start">
            {/* ------------------------------------------------ trip summary */}
            <aside className="bg-card rounded-xl border p-4 lg:sticky lg:top-20">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-semibold">{routeTitle(route)}</h2>
                <Link
                  href={`/?${buildTripQuery(trip)}#quote`}
                  className="text-muted-foreground hover:text-foreground press inline-flex shrink-0 items-center gap-1 text-xs underline underline-offset-2"
                >
                  <PencilIcon className="size-3" aria-hidden />
                  Change
                </Link>
              </div>

              <dl className="mt-3 space-y-1.5 text-sm">
                <Row label="Pickup">
                  {trip.date} at {trip.time}
                </Row>
                <Row label="Vehicle">{vehicleClass.name}</Row>
                <Row label="Passengers">{trip.passengers}</Row>
                {duration && <Row label="Journey">about {duration}</Row>}
              </dl>

              <div className="mt-4 border-t pt-3">
                <p className="text-muted-foreground text-xs font-medium">
                  Total, all in
                </p>
                <p className="tabular text-brand text-3xl leading-none font-semibold tracking-tight">
                  {formatNad(fare.customerPrice)}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {route.pricingUnit === "per_person"
                    ? `${formatNad(unitFare(route, vehicleClass))} per person × ${trip.passengers}`
                    : `per vehicle, up to ${vehicleClass.capacity} passengers`}
                </p>
              </div>
            </aside>

            {/* -------------------------------------------------- one form */}
            <div className="bg-card rounded-xl border p-4 sm:p-5">
              <BookingDetailsForm
                trip={trip}
                route={route}
                pickupPlaces={pickupPlaces(route)}
                dropoffPlaces={dropoffPlaces(route)}
                utm={utm}
              />
            </div>
          </div>
        </div>
      </main>

      <SiteFooter routes={routes} />
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
