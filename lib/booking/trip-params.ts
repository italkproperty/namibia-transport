import type { RouteView, VehicleClassView } from "@/lib/maps";

import { smallestFittingClass } from "./eligibility";
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
  /** Large cases. Changes the required class, so it must travel with the quote. */
  luggage: number;
  vehicleClassId: string;
};

export const TRIP_KEYS = {
  route: "route",
  date: "date",
  time: "time",
  passengers: "pax",
  luggage: "bags",
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
    [TRIP_KEYS.luggage]: String(trip.luggage),
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

  const rawDate = one(params[TRIP_KEYS.date]);
  const date =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : defaultTripDate();

  const rawTime = one(params[TRIP_KEYS.time]);
  const time =
    rawTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime) ? rawTime : DEFAULT_TIME;

  const rawPassengers = Number(one(params[TRIP_KEYS.passengers]));
  const passengers =
    Number.isInteger(rawPassengers) && rawPassengers >= 1 ? rawPassengers : 1;

  const rawLuggage = Number(one(params[TRIP_KEYS.luggage]));
  const luggage =
    Number.isInteger(rawLuggage) && rawLuggage >= 0 ? rawLuggage : 1;

  /**
   * The class must be able to carry the party. A deep link that pairs five
   * passengers with the sedan is upgraded to the smallest class that fits;
   * a party no class can carry keeps the requested numbers so the page can
   * route it to an enquiry rather than render a price — never silently sell
   * a vehicle that cannot take the people or their luggage.
   */
  const requestedClass = one(params[TRIP_KEYS.vehicleClass]);
  const requested =
    vehicleClasses.find((c) => c.id === requestedClass) ?? vehicleClasses[0];
  const fitting = smallestFittingClass(vehicleClasses, passengers, luggage);
  const vehicleClass =
    requested &&
    fitting &&
    passengers <= requested.capacity &&
    luggage <= requested.luggageCapacity
      ? requested
      : (fitting ?? requested);

  return {
    routeSlug: route?.slug ?? "",
    date,
    time,
    passengers,
    luggage,
    vehicleClassId: vehicleClass?.id ?? "",
  };
}

/** True when no vehicle class can carry this party — enquiry, not a price. */
export function partyTooLarge(
  trip: Pick<TripParams, "passengers" | "luggage">,
  vehicleClasses: VehicleClassView[]
): boolean {
  return (
    smallestFittingClass(vehicleClasses, trip.passengers, trip.luggage) === null
  );
}

/** Half-hour slots: enough granularity for a transfer, short enough to scan. */
export const TIME_SLOTS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});
