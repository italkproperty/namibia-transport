/**
 * The places Namibian ground transport actually moves between.
 *
 * The catalogue enumerates eight routes, and every one of them starts at Hosea
 * Kutako or in Windhoek. That is a hub-and-spoke product in a country whose
 * travellers move in circuits: airport, dunes, coast, Damaraland, Etosha, back.
 * "Sossusvlei to Swakopmund" is the single most common leg of a Namibian
 * itinerary and we could not express it at all, let alone price it.
 *
 * Enumerating every pair is the obvious fix and the wrong one: n places need
 * n(n-1) hand-set prices, each of which drifts. So instead we model the thing
 * underneath — the road network — and derive distance, driving time and fare
 * from it. Namibia makes this unusually tractable: the trunk network is one
 * spine (B1), one arm to the coast (B2), and a handful of named gravel roads.
 * Roughly forty nodes covers everywhere a paying transfer goes.
 *
 * Coordinates are town centres, gates and terminals — the same convention the
 * catalogue uses, and they feed the same static maps. Where a place also
 * appears in lib/catalog.ts the coordinates are copied from there verbatim, so
 * a modelled journey and a curated route never draw two different points.
 */

export type Region =
  | "central"
  | "coast"
  | "namib"
  | "damaraland"
  | "north"
  | "zambezi"
  | "south";

export const REGION_LABELS: Record<Region, string> = {
  central: "Windhoek & central",
  coast: "The coast",
  namib: "Namib & Sossusvlei",
  damaraland: "Damaraland & Erongo",
  north: "North & Etosha",
  zambezi: "Kavango & Zambezi",
  south: "The south",
};

/** Regions in the order a traveller meets them, north-west then south. */
export const REGION_ORDER: Region[] = [
  "central",
  "coast",
  "namib",
  "damaraland",
  "north",
  "zambezi",
  "south",
];

export type PlaceNode = {
  slug: string;
  name: string;
  /** Shorter form for chips and breadcrumbs where the full name is too long. */
  shortName?: string;
  region: Region;
  lat: number;
  lng: number;
  /**
   * The share of return legs that find a paying fare rather than driving home
   * empty. This is the single most consequential number in the model: a car
   * that must come back from Sesriem with nobody in it costs twice the fuel
   * and twice the day, and the outbound fare is the only thing that can pay
   * for it.
   *
   * Windhoek and the airport are dense enough that a driver ending there is
   * effectively home. The coast is the second market. Regional trunk towns see
   * some traffic. Tourist termini and border posts see almost none.
   *
   * These are judgements, not measurements, and they should be replaced by
   * observed data the moment there are enough bookings to observe. Until then
   * they are deliberately conservative — under-estimating the backhaul prices
   * a trip high, which loses a booking; over-estimating it sends a driver on a
   * thousand kilometres for a loss.
   */
  backhaul: number;
  /** True where a booking is really an airport meet, not a town pickup. */
  isAirport?: boolean;
};

const BACKHAUL = {
  /** Windhoek and Hosea Kutako: the market. A car here will find work. */
  hub: 0.85,
  /** Swakopmund and Walvis Bay: the second market, roughly half the depth. */
  coastal: 0.55,
  /** Trunk-road towns with their own economy — Otjiwarongo, Keetmanshoop. */
  town: 0.35,
  /** Lodges, gates, borders. The car goes back empty and we must price for it. */
  terminus: 0.15,
} as const;

export const PLACE_NODES: PlaceNode[] = [
  /* ------------------------------------------------------------- central */
  {
    slug: "hosea-kutako",
    name: "Hosea Kutako International Airport (WDH)",
    shortName: "Hosea Kutako (WDH)",
    region: "central",
    lat: -22.4799,
    lng: 17.4709,
    backhaul: BACKHAUL.hub,
    isAirport: true,
  },
  {
    slug: "windhoek",
    name: "Windhoek",
    region: "central",
    lat: -22.5609,
    lng: 17.0658,
    backhaul: BACKHAUL.hub,
  },
  {
    slug: "eros-airport",
    name: "Eros Airport (ERS)",
    region: "central",
    lat: -22.6122,
    lng: 17.0804,
    backhaul: BACKHAUL.hub,
    isAirport: true,
  },
  {
    slug: "okahandja",
    name: "Okahandja",
    region: "central",
    lat: -21.9833,
    lng: 16.9167,
    backhaul: BACKHAUL.town,
  },
  {
    slug: "rehoboth",
    name: "Rehoboth",
    region: "central",
    lat: -23.3167,
    lng: 17.0833,
    backhaul: BACKHAUL.town,
  },
  {
    slug: "gobabis",
    name: "Gobabis",
    region: "central",
    lat: -22.45,
    lng: 18.9667,
    backhaul: BACKHAUL.town,
  },

  /* --------------------------------------------------------------- coast */
  {
    slug: "swakopmund",
    name: "Swakopmund",
    region: "coast",
    lat: -22.6792,
    lng: 14.5272,
    backhaul: BACKHAUL.coastal,
  },
  {
    slug: "walvis-bay",
    name: "Walvis Bay",
    region: "coast",
    lat: -22.9576,
    lng: 14.5053,
    backhaul: BACKHAUL.coastal,
  },
  {
    slug: "walvis-bay-airport",
    name: "Walvis Bay Airport (WVB)",
    region: "coast",
    lat: -22.9799,
    lng: 14.6453,
    backhaul: BACKHAUL.coastal,
    isAirport: true,
  },
  {
    slug: "henties-bay",
    name: "Henties Bay",
    region: "coast",
    lat: -22.1167,
    lng: 14.2833,
    backhaul: BACKHAUL.terminus,
  },

  /* --------------------------------------------------------------- namib */
  {
    slug: "sossusvlei",
    name: "Sossusvlei (Sesriem)",
    shortName: "Sossusvlei",
    region: "namib",
    // Copied from lib/catalog.ts so the modelled journey and the curated
    // route draw the same point on the same map.
    lat: -24.7272,
    lng: 15.3444,
    backhaul: BACKHAUL.terminus,
  },
  {
    slug: "solitaire",
    name: "Solitaire",
    region: "namib",
    lat: -23.8931,
    lng: 16.0064,
    backhaul: BACKHAUL.terminus,
  },
  {
    slug: "maltahohe",
    name: "Maltahöhe",
    region: "namib",
    lat: -24.8333,
    lng: 16.9833,
    backhaul: BACKHAUL.terminus,
  },
  {
    slug: "helmeringhausen",
    name: "Helmeringhausen",
    region: "namib",
    lat: -25.8667,
    lng: 16.8167,
    backhaul: BACKHAUL.terminus,
  },

  /* ---------------------------------------------------------- damaraland */
  {
    slug: "spitzkoppe",
    name: "Spitzkoppe",
    region: "damaraland",
    lat: -21.83,
    lng: 15.195,
    backhaul: BACKHAUL.terminus,
  },
  {
    slug: "uis",
    name: "Uis",
    region: "damaraland",
    lat: -21.2333,
    lng: 14.8667,
    backhaul: BACKHAUL.terminus,
  },
  {
    slug: "khorixas",
    name: "Khorixas",
    region: "damaraland",
    lat: -20.3667,
    lng: 14.9667,
    backhaul: BACKHAUL.terminus,
  },
  {
    slug: "twyfelfontein",
    name: "Twyfelfontein",
    region: "damaraland",
    lat: -20.5936,
    lng: 14.3722,
    backhaul: BACKHAUL.terminus,
  },
  {
    slug: "karibib",
    name: "Karibib",
    region: "damaraland",
    lat: -21.9394,
    lng: 15.85,
    backhaul: BACKHAUL.town,
  },
  {
    slug: "usakos",
    name: "Usakos",
    region: "damaraland",
    lat: -21.9986,
    lng: 15.5967,
    backhaul: BACKHAUL.town,
  },

  /* --------------------------------------------------------------- north */
  {
    slug: "otjiwarongo",
    name: "Otjiwarongo",
    region: "north",
    lat: -20.4637,
    lng: 16.6477,
    backhaul: BACKHAUL.town,
  },
  {
    slug: "waterberg",
    name: "Waterberg Plateau Park",
    shortName: "Waterberg",
    region: "north",
    lat: -20.5167,
    lng: 17.2333,
    backhaul: BACKHAUL.terminus,
  },
  {
    slug: "outjo",
    name: "Outjo",
    region: "north",
    lat: -20.1167,
    lng: 16.15,
    backhaul: BACKHAUL.town,
  },
  {
    slug: "etosha-okaukuejo",
    name: "Etosha — Andersson Gate (Okaukuejo)",
    shortName: "Etosha (Okaukuejo)",
    region: "north",
    // Also copied from lib/catalog.ts, where it is the Etosha route's point.
    lat: -19.1833,
    lng: 15.9167,
    backhaul: BACKHAUL.terminus,
  },
  {
    slug: "etosha-namutoni",
    name: "Etosha — Von Lindequist Gate (Namutoni)",
    shortName: "Etosha (Namutoni)",
    region: "north",
    lat: -18.81,
    lng: 16.98,
    backhaul: BACKHAUL.terminus,
  },
  {
    slug: "otavi",
    name: "Otavi",
    region: "north",
    lat: -19.65,
    lng: 17.3333,
    backhaul: BACKHAUL.town,
  },
  {
    slug: "tsumeb",
    name: "Tsumeb",
    region: "north",
    lat: -19.2333,
    lng: 17.7167,
    backhaul: BACKHAUL.town,
  },
  {
    slug: "grootfontein",
    name: "Grootfontein",
    region: "north",
    lat: -19.5667,
    lng: 18.1167,
    backhaul: BACKHAUL.town,
  },

  /* ------------------------------------------------------------- zambezi */
  {
    slug: "rundu",
    name: "Rundu",
    region: "zambezi",
    lat: -17.9333,
    lng: 19.7667,
    backhaul: BACKHAUL.town,
  },
  {
    slug: "divundu",
    name: "Divundu",
    region: "zambezi",
    lat: -18.1167,
    lng: 21.5667,
    backhaul: BACKHAUL.terminus,
  },
  {
    slug: "kongola",
    name: "Kongola",
    region: "zambezi",
    lat: -17.7833,
    lng: 23.3333,
    backhaul: BACKHAUL.terminus,
  },
  {
    slug: "katima-mulilo",
    name: "Katima Mulilo",
    region: "zambezi",
    lat: -17.5,
    lng: 24.2667,
    backhaul: BACKHAUL.town,
  },

  /* --------------------------------------------------------------- south */
  {
    slug: "mariental",
    name: "Mariental",
    region: "south",
    lat: -24.6333,
    lng: 17.9667,
    backhaul: BACKHAUL.town,
  },
  {
    slug: "keetmanshoop",
    name: "Keetmanshoop",
    region: "south",
    lat: -26.5833,
    lng: 18.1333,
    backhaul: BACKHAUL.town,
  },
  {
    slug: "aus",
    name: "Aus",
    region: "south",
    lat: -26.6667,
    lng: 16.25,
    backhaul: BACKHAUL.terminus,
  },
  {
    slug: "luderitz",
    name: "Lüderitz",
    region: "south",
    lat: -26.6481,
    lng: 15.1594,
    backhaul: BACKHAUL.terminus,
  },
  {
    slug: "fish-river-canyon",
    name: "Fish River Canyon (Hobas)",
    shortName: "Fish River Canyon",
    region: "south",
    lat: -27.5833,
    lng: 17.6167,
    backhaul: BACKHAUL.terminus,
  },
  {
    slug: "grunau",
    name: "Grünau",
    region: "south",
    lat: -27.7333,
    lng: 18.4,
    backhaul: BACKHAUL.terminus,
  },
  {
    slug: "noordoewer",
    name: "Noordoewer (South African border)",
    shortName: "Noordoewer",
    region: "south",
    lat: -28.75,
    lng: 17.6167,
    backhaul: BACKHAUL.terminus,
  },
];

export const NODES_BY_SLUG = new Map(
  PLACE_NODES.map((node) => [node.slug, node]),
);

export function findNode(slug: string): PlaceNode | null {
  return NODES_BY_SLUG.get(slug) ?? null;
}

/** What to call a place in a sentence: the short form when there is one. */
export function nodeLabel(node: PlaceNode): string {
  return node.shortName ?? node.name;
}

/** Nodes bucketed by region, in travel order, for grouped pickers. */
export function nodesByRegion(): { region: Region; nodes: PlaceNode[] }[] {
  return REGION_ORDER.map((region) => ({
    region,
    nodes: PLACE_NODES.filter((node) => node.region === region),
  })).filter((group) => group.nodes.length > 0);
}
