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
  /** Search-only POI; never use its approximate pin for route matching or pricing. */
  searchOnly?: boolean;
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
  {
    slug: "gross-barmen",
    name: "Gross Barmen Resort",
    shortName: "Gross Barmen",
    region: "central",
    lat: -22.11145,
    lng: 16.74542,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "okonjima-lodge",
    name: "Okonjima Nature Reserve and Lodge",
    region: "north",
    lat: -20.8664,
    lng: 16.6394,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "onguma-the-fort",
    name: "Onguma The Fort",
    region: "north",
    lat: -18.7361,
    lng: 17.0428,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "gross-okandjou",
    name: "Gross Okandjou Guest Farm",
    region: "damaraland",
    lat: -21.1444,
    lng: 16.1433,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "grootberg-lodge",
    name: "Grootberg Lodge",
    region: "damaraland",
    lat: -19.8429,
    lng: 14.1283,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "haasenhof-guestfarm",
    name: "Haasenhof Guest Farm",
    region: "north",
    lat: -20.4665,
    lng: 16.5168,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "namib-desert-lodge",
    name: "Namib Desert Lodge",
    region: "namib",
    lat: -24.1167,
    lng: 15.9056,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "namibgrens",
    name: "Namibgrens Guest Farm",
    region: "namib",
    lat: -23.6181,
    lng: 16.2417,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "okonjima-plains-camp",
    name: "Okonjima Plains Camp",
    region: "north",
    lat: -20.8591,
    lng: 16.6403,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "ongula-village-lodge",
    name: "Ongula Village Homestead Lodge",
    region: "north",
    lat: -17.7413,
    lng: 16.142,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "onguma-bush-camp",
    name: "Onguma Bush Camp",
    region: "north",
    lat: -18.74,
    lng: 17.046,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "onguma-tented-camp",
    name: "Onguma Tented Camp",
    region: "north",
    lat: -18.731,
    lng: 17.05,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "cape-cross-lodge",
    name: "Cape Cross Lodge",
    region: "coast",
    lat: -21.764,
    lng: 13.9897,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "cape-cross-seal-reserve",
    name: "Cape Cross Seal Reserve",
    region: "coast",
    lat: -21.7598,
    lng: 13.9672,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "kolmanskop",
    name: "Kolmanskop Ghost Town",
    region: "south",
    lat: -26.7036,
    lng: 15.2283,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "spitzkoppe-campsites",
    name: "Spitzkoppe Rest Camp",
    region: "damaraland",
    lat: -21.8263,
    lng: 15.1957,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "brandberg-white-lady",
    name: "Brandberg White Lady",
    region: "damaraland",
    lat: -21.1167,
    lng: 14.5833,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "twylfelfontein-world-heritage",
    name: "Twyfelfontein UNESCO World Heritage Site",
    region: "damaraland",
    lat: -20.5936,
    lng: 14.3722,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "rocky-shore-cape-cross",
    name: "Cape Cross Coast",
    region: "coast",
    lat: -21.7598,
    lng: 13.9672,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "erindi-private-game-reserve",
    name: "Erindi Private Game Reserve",
    region: "damaraland",
    lat: -21.2,
    lng: 16.4,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "mount-etjo",
    name: "Mount Etjo Safari Lodge",
    region: "north",
    lat: -20.45,
    lng: 16.15,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "midgard",
    name: "Midgard Country Estate",
    region: "central",
    lat: -21.8,
    lng: 16.5,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "bagatelle-kalahari",
    name: "Bagatelle Kalahari Game Ranch",
    region: "south",
    lat: -24,
    lng: 18,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "namushasha",
    name: "Namushasha River Lodge",
    region: "zambezi",
    lat: -17.9,
    lng: 23.3,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "nunda-river-lodge",
    name: "Nunda River Lodge",
    region: "zambezi",
    lat: -18.1067,
    lng: 21.5933,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "mahangu-safari-lodge",
    name: "Mahangu Safari Lodge",
    region: "zambezi",
    lat: -18.14,
    lng: 21.7,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "kalizo-lodge",
    name: "Kalizo Lodge",
    region: "zambezi",
    lat: -17.54,
    lng: 24.57,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "mazambala-island-lodge",
    name: "Mazambala Island Lodge",
    region: "zambezi",
    lat: -17.81,
    lng: 23.35,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "nkwazi-lodge",
    name: "n'Kwazi Lodge",
    region: "zambezi",
    lat: -17.8678,
    lng: 19.9007,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "otjitotongwe-cheetah-farm",
    name: "Otjitotongwe Cheetah Guest Farm",
    region: "north",
    lat: -19.5913,
    lng: 15.0663,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "ombinda-country-lodge",
    name: "Ombinda Country Lodge",
    region: "north",
    lat: -20.12,
    lng: 16.15,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "lovedale-farm",
    name: "Lovedale Farm Holidays",
    region: "south",
    lat: -25.9125,
    lng: 16.6634,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "melrose-guest-farm",
    name: "Melrose Guest Farm",
    region: "central",
    lat: -22.8826,
    lng: 16.8985,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "oas-holiday-farm",
    name: "Oas Holiday Farm",
    region: "south",
    lat: -27.4953,
    lng: 19.2205,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "orange-river-lodge",
    name: "Orange River Lodge",
    region: "south",
    lat: -28.7439,
    lng: 17.6168,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "onguma-nature-reserve",
    name: "Onguma Nature Reserve",
    region: "north",
    lat: -18.7333,
    lng: 17.0486,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "halali-camp",
    name: "Halali Resort",
    region: "north",
    lat: -19.028,
    lng: 16.472,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "dolomite-camp",
    name: "Dolomite Camp",
    region: "north",
    lat: -19.3,
    lng: 14.4,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "onko shi-camp",
    name: "Onkoshi Camp",
    region: "north",
    lat: -18.7,
    lng: 16.9,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "hobas-lodge",
    name: "NWR Hobas Lodge",
    region: "south",
    lat: -27.5833,
    lng: 17.6167,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "sesriem-campsite",
    name: "Sesriem Campsite",
    region: "namib",
    lat: -24.4833,
    lng: 15.8,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "sossus-dune-lodge",
    name: "Sossus Dune Lodge",
    region: "namib",
    lat: -24.7333,
    lng: 15.3,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "naukluft-lodge",
    name: "Naukluft Lodge",
    region: "namib",
    lat: -24.25,
    lng: 16,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "terrace-bay-resort",
    name: "Terrace Bay Resort",
    region: "coast",
    lat: -19.98,
    lng: 13,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "ai-ais-resort",
    name: "Ai-Ais Resort",
    region: "south",
    lat: -27.9167,
    lng: 17.4833,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "waterberg-wilderness",
    name: "Waterberg Wilderness Lodge",
    region: "north",
    lat: -20.5167,
    lng: 17.2333,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "gobabeb",
    name: "Gobabeb Namib Research Institute",
    region: "namib",
    lat: -23.56,
    lng: 15.04,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "solitaire-guest-farm",
    name: "Solitaire Guest Farm Desert Ranch",
    region: "namib",
    lat: -23.89,
    lng: 16,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "ababis-guest-farm",
    name: "Ababis Guest Farm",
    region: "namib",
    lat: -23.4,
    lng: 15.9,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "duwisib-castle",
    name: "Duwisib Castle",
    region: "south",
    lat: -25.23,
    lng: 16.54,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "sesriem-gate",
    name: "Sesriem Gate",
    region: "namib",
    lat: -24.4833,
    lng: 15.8,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "deadvlei",
    name: "Deadvlei",
    region: "namib",
    lat: -24.75,
    lng: 15.29,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "big-daddy-dune",
    name: "Big Daddy Dune",
    region: "namib",
    lat: -24.75,
    lng: 15.29,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "sandwich-harbour",
    name: "Sandwich Harbour",
    region: "coast",
    lat: -23.37,
    lng: 14.45,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "walvis-bay-lagoon",
    name: "Walvis Bay Lagoon",
    region: "coast",
    lat: -22.97,
    lng: 14.51,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "moon-landscape",
    name: "Moon Landscape",
    region: "coast",
    lat: -22.56,
    lng: 14.95,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "welwitschia-plains",
    name: "Welwitschia Plains",
    region: "coast",
    lat: -22.35,
    lng: 14.95,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "cape-cross-lighthouse",
    name: "Cape Cross",
    region: "coast",
    lat: -21.7598,
    lng: 13.9672,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "hoba-meteorite",
    name: "Hoba Meteorite",
    region: "north",
    lat: -19.6,
    lng: 17.93,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "otjikoto-lake",
    name: "Lake Otjikoto",
    region: "north",
    lat: -19.2,
    lng: 17.58,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "meteorite-gibeon",
    name: "Gibeon Meteorites",
    region: "south",
    lat: -25.13,
    lng: 17.77,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "quiver-tree-forest",
    name: "Quiver Tree Forest",
    region: "south",
    lat: -26,
    lng: 19.75,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "giants-playground",
    name: "Giants Playground",
    region: "south",
    lat: -26,
    lng: 19.75,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "kokerboomkloof",
    name: "Kokerboomkloof",
    region: "south",
    lat: -26.9,
    lng: 16,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "naute-dam",
    name: "Naute Dam",
    region: "south",
    lat: -26.9,
    lng: 17.9,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "hardap-dam",
    name: "Hardap Dam Resort",
    region: "south",
    lat: -24.5,
    lng: 17.8,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "reiterdenkmal",
    name: "Reiterdenkmal Windhoek",
    region: "central",
    lat: -22.57,
    lng: 17.08,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "christuskirche",
    name: "Christuskirche Windhoek",
    region: "central",
    lat: -22.57,
    lng: 17.08,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "independence-museum",
    name: "Independence Memorial Museum",
    region: "central",
    lat: -22.57,
    lng: 17.08,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "tintenpalast",
    name: "Tintenpalast",
    region: "central",
    lat: -22.57,
    lng: 17.08,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "hero-acres",
    name: "Heroes Acre Namibia",
    region: "central",
    lat: -22.62,
    lng: 17.08,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "gross-barmen-hot-spring",
    name: "Gross Barmen Hot Spring",
    region: "central",
    lat: -22.1115,
    lng: 16.7454,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "gross-barmen-camp",
    name: "Gross Barmen Camp",
    region: "central",
    lat: -22.113,
    lng: 16.745,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
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
    searchOnly: true,
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
    searchOnly: true,
  },
  {
    slug: "solitaire",
    name: "Solitaire",
    region: "namib",
    lat: -23.8931,
    lng: 16.0064,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "maltahohe",
    name: "Maltahöhe",
    region: "namib",
    lat: -24.8333,
    lng: 16.9833,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "helmeringhausen",
    name: "Helmeringhausen",
    region: "namib",
    lat: -25.8667,
    lng: 16.8167,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },

  /* ---------------------------------------------------------- damaraland */
  {
    slug: "spitzkoppe",
    name: "Spitzkoppe",
    region: "damaraland",
    lat: -21.83,
    lng: 15.195,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "uis",
    name: "Uis",
    region: "damaraland",
    lat: -21.2333,
    lng: 14.8667,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "khorixas",
    name: "Khorixas",
    region: "damaraland",
    lat: -20.3667,
    lng: 14.9667,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "twyfelfontein",
    name: "Twyfelfontein",
    region: "damaraland",
    lat: -20.5936,
    lng: 14.3722,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
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
    searchOnly: true,
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
    searchOnly: true,
  },
  {
    slug: "etosha-namutoni",
    name: "Etosha — Von Lindequist Gate (Namutoni)",
    shortName: "Etosha (Namutoni)",
    region: "north",
    lat: -18.81,
    lng: 16.98,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
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
    searchOnly: true,
  },
  {
    slug: "kongola",
    name: "Kongola",
    region: "zambezi",
    lat: -17.7833,
    lng: 23.3333,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
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
    searchOnly: true,
  },
  {
    slug: "luderitz",
    name: "Lüderitz",
    region: "south",
    lat: -26.6481,
    lng: 15.1594,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "fish-river-canyon",
    name: "Fish River Canyon (Hobas)",
    shortName: "Fish River Canyon",
    region: "south",
    lat: -27.5833,
    lng: 17.6167,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "grunau",
    name: "Grünau",
    region: "south",
    lat: -27.7333,
    lng: 18.4,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "noordoewer",
    name: "Noordoewer (South African border)",
    shortName: "Noordoewer",
    region: "south",
    lat: -28.75,
    lng: 17.6167,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },

  /* ------------------- Kaokoland, the Owambo north, Erongo and Ai-Ais
   * Added September 2026, closing the genuine gaps in the graph. Purros
   * and the Marienfluss stay out on purpose: reaching them means convoy
   * 4x4 driving on tracks where hire insurance is void, and that is an
   * expedition product, not a transfer.
   */
  {
    slug: "kamanjab",
    name: "Kamanjab",
    region: "damaraland",
    lat: -19.6258,
    lng: 14.8446,
    backhaul: BACKHAUL.town,
  },
  {
    slug: "palmwag",
    name: "Palmwag",
    region: "damaraland",
    lat: -19.8833,
    lng: 13.9333,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "sesfontein",
    name: "Sesfontein",
    region: "damaraland",
    lat: -19.1333,
    lng: 13.6167,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "opuwo",
    name: "Opuwo",
    region: "north",
    lat: -18.0607,
    lng: 13.8401,
    backhaul: BACKHAUL.town,
  },
  {
    slug: "epupa",
    name: "Epupa Falls",
    region: "north",
    lat: -17.0,
    lng: 13.2333,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "ruacana",
    name: "Ruacana",
    region: "north",
    lat: -17.4167,
    lng: 14.2167,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
  {
    slug: "oshakati",
    name: "Oshakati",
    region: "north",
    lat: -17.7883,
    lng: 15.6983,
    backhaul: BACKHAUL.town,
  },
  {
    slug: "ondangwa",
    name: "Ondangwa",
    region: "north",
    lat: -17.9167,
    lng: 15.95,
    backhaul: BACKHAUL.town,
  },
  {
    slug: "omaruru",
    name: "Omaruru",
    region: "damaraland",
    lat: -21.4333,
    lng: 15.9333,
    backhaul: BACKHAUL.town,
  },
  {
    slug: "ai-ais",
    name: "Ai-Ais Hot Springs",
    shortName: "Ai-Ais",
    region: "south",
    lat: -27.9167,
    lng: 17.4833,
    backhaul: BACKHAUL.terminus,
    searchOnly: true,
  },
];

export const NODES_BY_SLUG = new Map(
  PLACE_NODES.map((node) => [node.slug, node]),
);

export function findNode(slug: string): PlaceNode | null {
  return NODES_BY_SLUG.get(slug) ?? null;
}

/** Common traveller spellings and shorthand, normalised for autocomplete. */
const NODE_SEARCH_ALIASES: Record<string, string[]> = {
  "hosea-kutako": ["wdh", "wdh airport", "windhoek airport", "hosea kutako airport"],
  "okonjima-lodge": ["okonjima","okonjima lodge","africat foundation"],
  "onguma-the-fort": ["onguma","onguma the fort","onguma nature reserve"],
  "gross-okandjou": ["gross okandjou","gross-okandjou"],
  "grootberg-lodge": ["grootberg","grootberg lodge"],
  "haasenhof-guestfarm": ["haasenhof","haasenhof guestfarm"],
  "namib-desert-lodge": ["namib desert lodge","namib desert"],
  "namibgrens": ["namibgrens","namibgrens guest farm"],
  "okonjima-plains-camp": ["plains camp","okonjima plains camp"],
  "ongula-village-lodge": ["ongula","ongula village homestead lodge"],
  "onguma-bush-camp": ["onguma bush camp"],
  "onguma-tented-camp": ["onguma tented camp"],
  "cape-cross-lodge": ["cape cross lodge"],
  "cape-cross-seal-reserve": ["cape cross","cape cross seal reserve","kaap kruis"],
  "kolmanskop": ["kolmanskop","kolmanskuppe","ghost town"],
  "spitzkoppe-campsites": ["spitzkoppe camp","spitzkoppe rest camp","pontok mountains"],
  "brandberg-white-lady": ["brandberg","white lady rock painting","white lady"],
  "twylfelfontein-world-heritage": ["twyfelfontein world heritage site","twyfelfontein rock engravings"],
  "rocky-shore-cape-cross": ["cape cross coast"],
  "erindi-private-game-reserve": ["erindi","erindi private game reserve","old traders lodge"],
  "mount-etjo": ["mount etjo","mount etjo safari lodge"],
  "midgard": ["midgard","midgard country estate","midgard guest farm"],
  "bagatelle-kalahari": ["bagatelle","bagatelle kalahari","bagatelle kalahari game ranch"],
  "namushasha": ["namushasha","namushasha river lodge"],
  "nunda-river-lodge": ["nunda","nunda river lodge"],
  "mahangu-safari-lodge": ["mahangu","mahangu safari lodge"],
  "kalizo-lodge": ["kalizo","kalizo lodge"],
  "mazambala-island-lodge": ["mazambala","mazambala island lodge"],
  "nkwazi-lodge": ["n kwazi","nkwazi lodge","n'kwazi"],
  "otjitotongwe-cheetah-farm": ["otjitotongwe","cheetah guest farm"],
  "ombinda-country-lodge": ["ombinda","ombinda country lodge"],
  "lovedale-farm": ["lovedale","lovedale farm holidays"],
  "melrose-guest-farm": ["melrose","melrose guest farm"],
  "oas-holiday-farm": ["oas holiday farm","oas holiday"],
  "orange-river-lodge": ["orange river lodge","noordoewer lodge"],
  "onguma-nature-reserve": ["onguma nature reserve"],
  "halali-camp": ["halali","halali resort","halali camp"],
  "dolomite-camp": ["dolomite camp","western etosha"],
  "onkoshi-camp": ["onkoshi", "onkoshi camp", "onkoshi campsite"],
  "hobas-lodge": ["hobas lodge","nwr hobas"],
  "sesriem-campsite": ["sesriem campsite","sesriem camp"],
  "sossus-dune-lodge": ["sossus dune lodge"],
  "naukluft-lodge": ["naukluft lodge"],
  "terrace-bay-resort": ["terrace bay","terrace bay resort"],
  "ai-ais-resort": ["ai ais resort","ai-ais resort"],
  "waterberg-wilderness": ["waterberg wilderness","waterberg lodge"],
  "gobabeb": ["gobabeb","gobabeb research station"],
  "solitaire-guest-farm": ["solitaire guest farm","solitaire desert ranch"],
  "ababis-guest-farm": ["ababis","ababis guest farm"],
  "duwisib-castle": ["duwisib","duwisib castle"],
  "sesriem-gate": ["sesriem gate","namib naukluft gate"],
  "deadvlei": ["dead vlei","deadvlei"],
  "big-daddy-dune": ["big daddy dune","big daddy"],
  "sandwich-harbour": ["sandwich harbour","sandwich harbor"],
  "walvis-bay-lagoon": ["walvis bay lagoon","flamingo lagoon"],
  "moon-landscape": ["moon landscape","moon valley"],
  "welwitschia-plains": ["welwitschia plains","welwitschia drive"],
  "cape-cross-lighthouse": ["cape cross lighthouse"],
  "hoba-meteorite": ["hoba meteorite","hoba meteorite site"],
  "otjikoto-lake": ["lake otjikoto","otjikoto"],
  "meteorite-gibeon": ["gibeon meteorites"],
  "quiver-tree-forest": ["quiver tree forest","giant's playground","giants playground"],
  "giants-playground": ["giants playground"],
  "kokerboomkloof": ["kokerboomkloof"],
  "naute-dam": ["naute dam","naute recreation resort"],
  "hardap-dam": ["hardap dam","hardap resort"],
  "reiterdenkmal": ["reiterdenkmal","windhoek equestrian monument"],
  "christuskirche": ["christuskirche","christ church windhoek"],
  "independence-museum": ["independence memorial museum","windhoek museum"],
  "tintenpalast": ["tintenpalast","parliament gardens"],
  "hero-acres": ["heroes acre","hero's acre"],
  "gross-barmen-hot-spring": ["gross barmen hot spring","gross barmen springs","otjikango"],
  "gross-barmen-camp": ["gross barmen campsite","gross barmen camp"],
  "gross-barmen": ["gross barmen", "gross barmen resort", "gross barmen hot springs", "gross barmen hot springs resort"],
  "eros-airport": ["ers", "ers airport"],
  "walvis-bay-airport": ["wvb", "wvb airport", "walvis bay airport"],
  sossusvlei: ["sossus vlei", "sesriem", "sesriem gate", "deadvlei", "dead vlei"],
  "etosha-okaukuejo": ["okaukuejo", "andersson gate", "etosha south gate"],
  "etosha-namutoni": ["namutoni", "von lindequist gate", "etosha east gate"],
  "fish-river-canyon": ["hobas", "fish river canyon hobas"],
  "ai-ais": ["ai ais", "ai-ais"],
  luderitz: ["luderitz", "lüderitz"],
  grunau: ["grunau", "grünau"],
  noordoewer: ["noordoewer", "noordoever"],
};

function normaliseSearch(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
/**
 * Search the verified instant-pricing road network by name, slug, region or
 * common traveller alias. This intentionally does not turn arbitrary free text
 * into a priced route; unknown places must go through the quote-request path.
 */
export function searchNodes(query: string, limit = 10): PlaceNode[] {
  const q = normaliseSearch(query);
  if (!q) return PLACE_NODES.slice(0, Math.max(0, limit));
  return PLACE_NODES.filter((node) => {
    const aliases = NODE_SEARCH_ALIASES[node.slug] ?? [];
    const searchable = [
      node.name,
      node.shortName ?? "",
      node.slug.replace(/-/g, " "),
      REGION_LABELS[node.region],
      ...aliases,
    ].map(normaliseSearch);
    return searchable.filter(Boolean).some((candidate) => candidate.includes(q) || q.includes(candidate));
  }).slice(0, Math.max(0, limit));
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
