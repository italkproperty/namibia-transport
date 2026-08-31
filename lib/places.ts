import type { RouteView } from "@/lib/maps";
import { PLACE_NODES } from "@/lib/network/nodes";

/**
 * Where a traveller is actually going.
 *
 * This was a list of suburbs, which meant someone booked to "Windhoek CBD
 * hotel or guesthouse" and typed "Safari Hotel" into a notes box. The driver
 * got a neighbourhood and a hope. Naming the property is the whole point of a
 * curated list — it is what makes a pick-list better than street-address
 * autocomplete rather than worse.
 *
 * Still a curated list, never free-text address search: Namibian address data
 * is too sparse for autocomplete to return somewhere a driver can find. Areas
 * remain as fallbacks, and "somewhere else" plus a landmark note is always
 * available, so nobody is ever blocked by a property we have not listed yet.
 *
 * This belongs in the database with an admin screen behind it, so a new lodge
 * is a form submission rather than a deploy. It is a constant for now.
 */

export type PlaceKind = "hotel" | "guesthouse" | "area" | "landmark";

export type Place = {
  name: string;
  kind: PlaceKind;
  /** Groups the picker, and disambiguates two properties of the same name. */
  area?: string;
};

const place = (name: string, kind: PlaceKind, area?: string): Place => ({
  name,
  kind,
  area,
});

/**
 * Named properties come first because they are what people search for. The
 * list is deliberately short and checkable rather than exhaustive — an entry
 * nobody has confirmed is worse than an absence, since the traveller assumes a
 * listed hotel is one we know how to reach.
 */
const WINDHOEK: Place[] = [
  place("Hilton Windhoek", "hotel", "CBD"),
  place("Avani Windhoek Hotel & Casino", "hotel", "CBD"),
  place("Windhoek Country Club Resort", "hotel", "Olympia"),
  place("Safari Hotel & Safari Court", "hotel", "Ausspannplatz"),
  place("Hotel Heinitzburg", "hotel", "Klein Windhoek"),
  place("Am Weinberg Boutique Hotel", "hotel", "Klein Windhoek"),
  place("Arebbusch Travel Lodge", "hotel", "Olympia"),
  place("Hotel Thule", "hotel", "Eros"),
  place("Olive Grove Guesthouse", "guesthouse", "Klein Windhoek"),
  place("Galton House", "guesthouse", "Eros"),
  place("Hosea Kutako International Airport (WDH)", "landmark"),
  place("Eros Airport (ERS)", "landmark"),
  place("Windhoek CBD — hotel or guesthouse", "area"),
  place("Klein Windhoek", "area"),
  place("Eros", "area"),
  place("Ludwigsdorf", "area"),
  place("Olympia", "area"),
  place("Pioneers Park", "area"),
  place("Katutura", "area"),
  place("Prosperita", "area"),
  place("Northern Industrial", "area"),
];

const SWAKOPMUND: Place[] = [
  place("Strand Hotel Swakopmund", "hotel", "The Mole"),
  place("Swakopmund Hotel & Entertainment Centre", "hotel", "Town centre"),
  place("Hansa Hotel", "hotel", "Town centre"),
  place("The Delight Swakopmund", "hotel", "Town centre"),
  place("Beach Lodge", "guesthouse", "Mile 4"),
  place("Cornerstone Guesthouse", "guesthouse", "Town centre"),
  place("Swakopmund town centre — hotel or guesthouse", "area"),
  place("The Strand / beachfront", "area"),
  place("Vineta", "area"),
  place("Kramersdorf", "area"),
  place("Mile 4 / Long Beach", "area"),
];

const WALVIS_BAY: Place[] = [
  place("Protea Hotel Walvis Bay Pelican Bay", "hotel", "The Lagoon"),
  place("Lagoon Lodge", "guesthouse", "The Lagoon"),
  place("Walvis Bay harbour / cruise terminal", "landmark"),
  place("Walvis Bay Airport (WVB)", "landmark"),
  place("Walvis Bay town centre", "area"),
  place("The Lagoon / Esplanade", "area"),
];

const SOSSUSVLEI: Place[] = [
  place("Sesriem gate", "landmark"),
  place("Sesriem — my lodge, named in the notes", "area"),
];

const ETOSHA: Place[] = [
  place("Andersson Gate (south — for Okaukuejo)", "landmark"),
  place("Von Lindequist Gate (east — for Namutoni)", "landmark"),
  place("Etosha — my camp, named in the notes", "area"),
];

/** Destination label as it appears on a route, mapped to its places. */
const BY_DESTINATION: Record<string, Place[]> = {
  "Windhoek CBD": WINDHOEK,
  Windhoek: WINDHOEK,
  "Greater Windhoek": WINDHOEK,
  Swakopmund: SWAKOPMUND,
  "Walvis Bay": WALVIS_BAY,
  Sossusvlei: SOSSUSVLEI,
  "Sossusvlei (Sesriem)": SOSSUSVLEI,
  "Etosha National Park": ETOSHA,
  "Etosha — Andersson Gate (Okaukuejo)": ETOSHA,
  "Etosha — Von Lindequist Gate (Namutoni)": ETOSHA,
};

/** Always offered, so a missing entry never blocks a booking. */
export const OTHER_PLACE = "Somewhere else — I'll describe it in the notes";

/**
 * An airport is one building, so there is nothing to choose — but which end of
 * it depends on which way you are going, and offering "hotel or guesthouse" at
 * Walvis Bay Airport would be nonsense. Modelled journeys made this reachable:
 * a route's category is "airport" when either end is one, so the category
 * cannot answer the question and the place has to.
 */
function airportPlaces(label: string, direction: "pickup" | "dropoff"): Place[] {
  return direction === "pickup"
    ? [place(`${label} — arrivals hall`, "landmark")]
    : [place(`${label} — departures`, "landmark")];
}

function isAirport(label: string): boolean {
  return PLACE_NODES.some((node) => node.name === label && node.isAirport);
}

function placesFor(label: string, direction: "pickup" | "dropoff"): Place[] {
  if (isAirport(label)) return airportPlaces(label, direction);

  const curated = BY_DESTINATION[label];
  if (curated) return [...curated, place(OTHER_PLACE, "area")];

  // A route added straight to the database, or a journey to a town we have not
  // listed properties for, still gets a usable form.
  return [
    place(`${label} — hotel or guesthouse`, "area"),
    place(`${label} — private address`, "area"),
    place(OTHER_PLACE, "area"),
  ];
}

export function pickupPlaces(route: RouteView): Place[] {
  return placesFor(route.originLabel, "pickup");
}

export function dropoffPlaces(route: RouteView): Place[] {
  return placesFor(route.destinationLabel, "dropoff");
}

/** Names only, for anything that still wants a plain list. */
export function pickupOptions(route: RouteView): string[] {
  return pickupPlaces(route).map((p) => p.name);
}

export function dropoffOptions(route: RouteView): string[] {
  return dropoffPlaces(route).map((p) => p.name);
}
