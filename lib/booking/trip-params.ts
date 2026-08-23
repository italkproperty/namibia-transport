import type { RouteView, VehicleClassView } from "@/lib/maps";

import { namibianToday } from "./time";

/**
 * The trip half of a booking travels through the URL, so the widget on the
 * home page and the details step on /book are the same journey rather than two
 * forms. One place defines the parameter names and the defaults, so a deep
 * link built anywhere is read the same way everywhere.
 */

export type TripParams = {
  routeSlug: string;
  date: string;
  time: string;
  passengers: number;
  vehicleClassId: string;
};

export const TRIP_KEYS = {
  route: "route",
  date: "date",
  time: "time",
  passengers: "pax",
  vehicleClass: "class",
} as const;

/** Tomorrow in Namibia — nobody books an airport transfer for ten minutes' time. */
export function defaultTripDate(): string {
  const today = namibianToday();
  const next = new Date(`${today}T12:00:00+02:00`);
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}

export const DEFAULT_TIME = "12:00";

export function buildTripQuery(trip: TripParams): string {
  const query = new URLSearchParams({
    [TRIP_KEYS.route]: trip.routeSlug,
    [TRIP_KEYS.date]: trip.date,
    [TRIP_KEYS.time]: trip.time,
    [TRIP_KEYS.passengers]: String(trip.passengers),
    [TRIP_KEYS.vehicleClass]: trip.vehicleClassId,
  });
  return query.toString();
}

export function bookingHref(trip: TripParams): string {
  return `/book?${buildTripQuery(trip)}`;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Reads a trip out of search params, falling back to sane defaults rather than
 * failing — a hand-edited or truncated link should still land on a bookable
 * page instead of an error.
 */
export function parseTripParams(
  params: Record<string, string | string[] | undefined>,
  routes: RouteView[],
  vehicleClasses: VehicleClassView[]
): TripParams {
  const requestedRoute = one(params[TRIP_KEYS.route]);
  const route =
    routes.find((r) => r.slug === requestedRoute) ?? routes[0];

  const requestedClass = one(params[TRIP_KEYS.vehicleClass]);
  const vehicleClass =
    vehicleClasses.find((c) => c.id === requestedClass) ?? vehicleClasses[0];

  const rawDate = one(params[TRIP_KEYS.date]);
  const date =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : defaultTripDate();

  const rawTime = one(params[TRIP_KEYS.time]);
  const time =
    rawTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime) ? rawTime : DEFAULT_TIME;

  const rawPassengers = Number(one(params[TRIP_KEYS.passengers]));
  const capacity = vehicleClass?.capacity ?? 3;
  const passengers =
    Number.isInteger(rawPassengers) && rawPassengers >= 1
      ? Math.min(rawPassengers, capacity)
      : 1;

  return {
    routeSlug: route?.slug ?? "",
    date,
    time,
    passengers,
    vehicleClassId: vehicleClass?.id ?? "",
  };
}

/** Half-hour slots: enough granularity for a transfer, short enough to scan. */
export const TIME_SLOTS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});
