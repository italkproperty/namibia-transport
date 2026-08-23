"use client";

import * as React from "react";

import {
  bookingHref,
  DEFAULT_TIME,
  defaultTripDate,
  type TripParams,
} from "@/lib/booking/trip-params";
import type { RouteView, VehicleClassView } from "@/lib/maps";
import { computeFare } from "@/lib/pricing";

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
  /** Price per vehicle class, so a toggle can show both figures at once. */
  fares: Map<string, number>;
  price: number;
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

  const fares = React.useMemo(() => {
    if (!route) return new Map<string, number>();
    return new Map(
      vehicleClasses.map((c) => [
        c.id,
        Number(computeFare(route, c).customerPrice),
      ])
    );
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
    price: fares.get(vehicleClass.id) ?? 0,
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
