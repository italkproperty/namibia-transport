"use client";

import * as React from "react";
import Link from "next/link";

import { QuoteWidget } from "@/components/booking/quote-widget";
import { StickyBookBar } from "@/components/booking/sticky-book-bar";
import { useTrip } from "@/components/booking/use-trip";
import { formatDuration, shortPlace } from "@/lib/format";
import type { RouteView, VehicleClassView } from "@/lib/maps";
import { formatNad } from "@/lib/money";

/**
 * Widget, quick-select and sticky bar are three views of one selection, so
 * they share a single trip state. Tapping a route re-prices the widget in
 * place and scrolls it into view rather than navigating — the fastest path to
 * a booking is the one that never leaves the page.
 */
export function HomeQuote({
  routes,
  vehicleClasses,
}: {
  routes: RouteView[];
  vehicleClasses: VehicleClassView[];
}) {
  const trip = useTrip(routes, vehicleClasses);

  const selectRoute = React.useCallback(
    (slug: string) => {
      trip?.setRouteSlug(slug);
      document
        .getElementById("quote")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [trip]
  );

  if (!trip) return null;

  return (
    <>
      <QuoteWidget trip={trip} routes={routes} />

      {/* Quick-select: controls, not brochure cards. */}
      <div className="mt-4">
        <h2 className="text-muted-foreground mb-2 text-xs font-medium">
          Popular routes
        </h2>
        <ul className="grid gap-2 sm:grid-cols-3">
          {routes.map((route) => {
            const isSelected = route.slug === trip.routeSlug;
            const fare = trip.fares.get(trip.vehicleClass.id);
            const routeFare =
              route.slug === trip.routeSlug
                ? fare
                : Number(route.fixedPrice) *
                  Number(trip.vehicleClass.priceMultiplier);
            const duration = formatDuration(route.durationMin);

            return (
              <li key={route.slug}>
                <button
                  type="button"
                  onClick={() => selectRoute(route.slug)}
                  aria-pressed={isSelected}
                  className={[
                    "press bg-card focus-visible:ring-ring w-full rounded-lg border p-3 text-left focus-visible:ring-[3px] focus-visible:outline-none",
                    isSelected
                      ? "border-brand ring-brand/20 ring-2"
                      : "hover:border-foreground/25",
                  ].join(" ")}
                >
                  <span className="block text-sm leading-snug font-medium">
                    {shortPlace(route.originLabel)} → {route.destinationLabel}
                  </span>
                  <span className="mt-1.5 flex items-baseline gap-2">
                    <span className="tabular text-brand text-lg font-semibold">
                      {formatNad(Math.round(routeFare ?? 0))}
                    </span>
                    {duration && (
                      <span className="text-muted-foreground text-xs">
                        {duration}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="text-muted-foreground mt-2 text-xs">
          Prices are per vehicle.{" "}
          <Link
            href={`/transfers/${trip.route.slug}`}
            className="underline underline-offset-2"
          >
            Route details
          </Link>
        </p>
      </div>

      <StickyBookBar
        price={trip.price}
        href={trip.href}
        label={`${shortPlace(trip.route.originLabel)} → ${trip.route.destinationLabel}`}
      />
    </>
  );
}
