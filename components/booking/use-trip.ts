"use client";

import * as React from "react";

import {
  bookingHref,
  DEFAULT_TIME,
  defaultTripDate,
  type TripParams,
} from "@/lib/booking/trip-params";
import type { RouteView, VehicleClassView } from "@/lib/maps";
import { computeFare, pricingUnitLabel, unitFare } from "@/lib/pricing";

/**
 * Shared trip state. The widget, the route quick-select and the sticky bar are
 * three views of one selection, so the state lives here and each of them reads
 * it — otherwise tapping a route chip would price one thing while the sticky
 * bar advertised another.
 */
export type TripState = {
  routeSlug: string;
  date: string;
  time: string;
  passengers: number;
  vehicleClassId: string;

  route: RouteView;
  vehicleClass: VehicleClassView;
  vehicleClasses: VehicleClassView[];
  /** Total per vehicle class at the current party size. */
  fares: Map<string, number>;
  /** Price for one unit (seat or vehicle) per class, party size ignored. */
  unitFares: Map<string, number>;
  price: number;
  /** "per person" | "per vehicle" for the selected route. */
  unitLabel: string;
  maxPassengers: number;
  href: string;
  trip: TripParams;

  setRouteSlug: (slug: string) => void;
  setDate: (date: string) => void;
  setTime: (time: string) => void;
  setPassengers: (count: number) => void;
  setVehicleClassId: (id: string) => void;
};

export function useTrip(
  routes: RouteView[],
  vehicleClasses: VehicleClassView[],
  initial?: Partial<TripParams>
): TripState | null {
  const [routeSlug, setRouteSlug] = React.useState(
    initial?.routeSlug ?? routes[0]?.slug ?? ""
  );
  const [date, setDate] = React.useState(initial?.date ?? defaultTripDate());
  const [time, setTime] = React.useState(initial?.time ?? DEFAULT_TIME);
  const [passengers, setPassengers] = React.useState(initial?.passengers ?? 1);
  const [vehicleClassId, setVehicleClassId] = React.useState(
    initial?.vehicleClassId ?? vehicleClasses[0]?.id ?? ""
  );

  const route = routes.find((r) => r.slug === routeSlug) ?? routes[0];
  const vehicleClass =
    vehicleClasses.find((c) => c.id === vehicleClassId) ?? vehicleClasses[0];

  // Totals for the current party size; unit prices for the class toggle.
  const fares = React.useMemo(() => {
    if (!route) return new Map<string, number>();
    return new Map(
      vehicleClasses.map((c) => [
        c.id,
        Number(computeFare(route, c, passengers).customerPrice),
      ])
    );
  }, [route, vehicleClasses, passengers]);

  const unitFares = React.useMemo(() => {
    if (!route) return new Map<string, number>();
    return new Map(vehicleClasses.map((c) => [c.id, unitFare(route, c)]));
  }, [route, vehicleClasses]);

  // A party too big for the chosen class should move the class, not error.
  React.useEffect(() => {
    if (!vehicleClass || passengers <= vehicleClass.capacity) return;
    const roomier = vehicleClasses.find((c) => c.capacity >= passengers);
    if (roomier) setVehicleClassId(roomier.id);
  }, [passengers, vehicleClass, vehicleClasses]);

  if (!route || !vehicleClass) return null;

  const trip: TripParams = {
    routeSlug: route.slug,
    date,
    time,
    passengers,
    vehicleClassId: vehicleClass.id,
  };

  return {
    routeSlug: route.slug,
    date,
    time,
    passengers,
    vehicleClassId: vehicleClass.id,
    route,
    vehicleClass,
    vehicleClasses,
    fares,
    unitFares,
    price: fares.get(vehicleClass.id) ?? 0,
    unitLabel: pricingUnitLabel(route),
    maxPassengers: Math.max(...vehicleClasses.map((c) => c.capacity), 1),
    href: bookingHref(trip),
    trip,
    setRouteSlug,
    setDate,
    setTime,
    setPassengers,
    setVehicleClassId,
  };
}
