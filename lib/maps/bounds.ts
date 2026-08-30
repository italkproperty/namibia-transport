import type { LatLng } from "./types";

/**
 * Namibia, as a box.
 *
 * A dropped pin is free-form input, and free-form input arrives wrong: a
 * mis-drag, a stale marker, or someone poking the Server Action directly. A
 * coordinate in the Atlantic or in Europe is not a precision upgrade over the
 * curated pick-list, it is a driver sent nowhere — so anything outside the
 * country is rejected rather than stored.
 *
 * Generous on purpose. The real border is not a rectangle, and a pin a few
 * kilometres into Botswana on the Trans-Kalahari is a legitimate drop-off; a
 * pin in Cape Town is not.
 */
export const NAMIBIA_BOUNDS = {
  minLat: -29.5,
  maxLat: -16.5,
  minLng: 11.0,
  maxLng: 26.5,
} as const;

export function isInNamibia(point: LatLng): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= NAMIBIA_BOUNDS.minLat &&
    point.lat <= NAMIBIA_BOUNDS.maxLat &&
    point.lng >= NAMIBIA_BOUNDS.minLng &&
    point.lng <= NAMIBIA_BOUNDS.maxLng
  );
}

/**
 * Six decimal places is about 11 cm — far past what a dropped pin means, and
 * past what any driver can act on. Rounding keeps the stored figure honest
 * about its own precision and keeps the URLs short.
 */
export function roundCoord(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** A link any driver's phone will open, whatever they have installed. */
export function mapsLink(point: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${roundCoord(point.lat)},${roundCoord(point.lng)}`;
}
