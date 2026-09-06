"use client";

import * as React from "react";

import {
  bookingHref,
  DEFAULT_TIME,
  defaultTripDate,
  type TripParams,
} from "@/lib/booking/trip-params";
import type { RouteView, VehicleClassView } from "@/lib/maps";
import { classFits, smallestFittingClass } from "@/lib/booking/eligibility";
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
  /** Large cases — changes the required class, never the fare. */
  luggage: number;
  vehicleClassId: string;

  route: RouteView;
  vehicleClass: VehicleClassView;
  vehicleClasses: VehicleClassView[];
  /** Fare per vehicle class. Party size is not an input to a fare. */
  fares: Map<string, number>;
  /** Same numbers as `fares` — kept for the class toggle's call sites. */
  unitFares: Map<string, number>;
  price: number;
  /** Always "per vehicle" until a genuine shared shuttle exists. */
  unitLabel: string;
  maxPassengers: number;
  /**
   * True when no class can carry this party — the widget shows the enquiry
   * path instead of a price, because a booking must never complete for a
   * party the vehicle cannot carry.
   */
  overCapacity: boolean;
  href: string;
  trip: TripParams;

  setRouteSlug: (slug: string) => void;
  setDate: (date: string) => void;
  setTime: (time: string) => void;
  setPassengers: (count: number) => void;
  setLuggage: (count: number) => void;
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
  const [luggage, setLuggage] = React.useState(initial?.luggage ?? 1);
  const [vehicleClassId, setVehicleClassId] = React.useState(
    initial?.vehicleClassId ?? vehicleClasses[0]?.id ?? ""
  );

  const route = routes.find((r) => r.slug === routeSlug) ?? routes[0];
  const vehicleClass =
    vehicleClasses.find((c) => c.id === vehicleClassId) ?? vehicleClasses[0];

  // One fare per class. Passengers and luggage decide eligibility, not price.
  const fares = React.useMemo(() => {
    if (!route) return new Map<string, number>();
    return new Map(
      vehicleClasses.map((c) => [
        c.id,
        Number(computeFare(route, c).customerPrice),
      ])
    );
  }, [route, vehicleClasses]);

  const unitFares = React.useMemo(() => {
    if (!route) return new Map<string, number>();
    return new Map(vehicleClasses.map((c) => [c.id, unitFare(route, c)]));
  }, [route, vehicleClasses]);

  // A party the chosen class cannot carry — too many people OR too many
  // cases — moves the class, not errors. When nothing fits, the selection
  // stays put and `overCapacity` routes the widget to the enquiry path.
  React.useEffect(() => {
    if (!vehicleClass || classFits(vehicleClass, passengers, luggage)) return;
    const roomier = smallestFittingClass(vehicleClasses, passengers, luggage);
    if (roomier) setVehicleClassId(roomier.id);
  }, [passengers, luggage, vehicleClass, vehicleClasses]);

  if (!route || !vehicleClass) return null;

  const trip: TripParams = {
    routeSlug: route.slug,
    date,
    time,
    passengers,
    luggage,
    vehicleClassId: vehicleClass.id,
  };

  return {
    routeSlug: route.slug,
    date,
    time,
    passengers,
    luggage,
    vehicleClassId: vehicleClass.id,
    route,
    vehicleClass,
    vehicleClasses,
    fares,
    unitFares,
    price: fares.get(vehicleClass.id) ?? 0,
    unitLabel: pricingUnitLabel(route),
    maxPassengers: Math.max(...vehicleClasses.map((c) => c.capacity), 1),
    overCapacity:
      smallestFittingClass(vehicleClasses, passengers, luggage) === null,
    href: bookingHref(trip),
    trip,
    setRouteSlug,
    setDate,
    setTime,
    setPassengers,
    setLuggage,
    setVehicleClassId,
  };
}
