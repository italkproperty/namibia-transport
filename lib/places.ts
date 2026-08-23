import type { RouteView } from "@/lib/maps";

/**
 * Curated pick-lists instead of street-address autocomplete.
 *
 * Namibian address data is sparse and inconsistent, so free text produces
 * destinations a driver cannot find. Travellers pick a known area and add a
 * landmark in their own words; the driver confirms on WhatsApp.
 */

const AREAS: Record<string, string[]> = {
  "Windhoek CBD": [
    "Windhoek CBD hotel or guesthouse",
    "Klein Windhoek",
    "Eros",
    "Ludwigsdorf",
    "Olympia",
    "Pioneers Park",
    "Katutura",
    "Windhoek Country Club",
  ],
  Windhoek: [
    "Windhoek CBD hotel or guesthouse",
    "Klein Windhoek",
    "Eros",
    "Ludwigsdorf",
    "Olympia",
    "Pioneers Park",
    "Katutura",
    "Windhoek Country Club",
  ],
  Swakopmund: [
    "Swakopmund town centre hotel or guesthouse",
    "The Strand / beachfront",
    "Vineta",
    "Kramersdorf",
    "Mile 4 / Long Beach",
  ],
  "Walvis Bay": [
    "Walvis Bay town centre",
    "The Lagoon / Esplanade",
    "Walvis Bay harbour / cruise terminal",
    "Walvis Bay Airport (WVB)",
  ],
  "Greater Windhoek": [
    "Windhoek CBD office",
    "Prosperita",
    "Northern Industrial",
    "Windhoek Country Club",
  ],
};

/** Always available, so a traveller is never blocked by a missing entry. */
const OTHER = "Somewhere else — I'll describe it in the notes";

function optionsFor(label: string): string[] {
  const curated = AREAS[label];
  if (curated) return [...curated, OTHER];

  // Unknown destination (a route added straight to the database) still works.
  return [
    `${label} — hotel or guesthouse`,
    `${label} — private address`,
    OTHER,
  ];
}

/**
 * Airport pickups happen in one place, so there is nothing to choose. Every
 * other origin gets the same curated treatment as a destination.
 */
export function pickupOptions(route: RouteView): string[] {
  if (route.category === "airport") {
    return [`${route.originLabel} — arrivals hall`];
  }
  return optionsFor(route.originLabel);
}

export function dropoffOptions(route: RouteView): string[] {
  return optionsFor(route.destinationLabel);
}
