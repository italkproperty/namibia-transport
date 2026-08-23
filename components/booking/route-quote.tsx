"use client";

import { QuoteWidget } from "@/components/booking/quote-widget";
import { StickyBookBar } from "@/components/booking/sticky-book-bar";
import { useTrip } from "@/components/booking/use-trip";
import { shortPlace } from "@/lib/format";
import type { RouteView, VehicleClassView } from "@/lib/maps";

/**
 * The route page's booking control: the same widget with the route locked,
 * since arriving here is already a choice of route. "Book this transfer" goes
 * straight to the details step — there is no intermediate page.
 */
export function RouteQuote({
  route,
  vehicleClasses,
}: {
  route: RouteView;
  vehicleClasses: VehicleClassView[];
}) {
  const trip = useTrip([route], vehicleClasses);
  if (!trip) return null;

  return (
    <>
      <QuoteWidget
        trip={trip}
        routes={[route]}
        lockRoute
        cta="Book this transfer"
        className="lg:sticky lg:top-20"
      />
      <StickyBookBar
        price={trip.price}
        href={trip.href}
        label={`${shortPlace(route.originLabel)} → ${route.destinationLabel}`}
        cta="Book now"
      />
    </>
  );
}
