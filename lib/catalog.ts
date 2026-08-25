import type { NewRoute, NewVehicleClass } from "@/db/schema";

/**
 * The launch catalogue, in one place.
 *
 * This is both the input to `npm run db:seed` and the fallback the app renders
 * from when no database is reachable, so the marketing site and booking form
 * work before Supabase is provisioned. IDs are therefore fixed rather than
 * generated: a seeded row and its fallback twin must be the same row, or a
 * deep link would break the moment the database came online.
 *
 * The database is authoritative once connected. Editing a price here only
 * changes what a fresh seed writes — re-run the seed to publish a change.
 */

export const VEHICLE_CLASS_IDS = {
  sedan: "ee436195-7c01-5604-b31d-de90e000ff07",
  suv: "df7a4870-673c-5036-ab29-80015c3fa66f",
} as const;

export const ROUTE_IDS = {
  wdhWindhoek: "6bbb2bd7-7148-5977-952e-9cd2e38b8aaf",
  wdhSwakopmund: "a96d5856-218b-5043-8de1-623b918dadff",
  windhoekSwakopmund: "3257ef79-ee65-5257-979a-6ac229960513",
  wdhWalvisBay: "28b2c171-faaa-5b11-9a18-0292f9fa58ac",
  wdhSossusvlei: "1a05a09a-16ea-5770-91c0-d02545783b35",
  wdhEtosha: "464694f5-0780-582e-ab6b-636027c2ad7e",
  windhoekWalvisBay: "c3ead59c-a2c0-5e2f-b3ef-7715bc1ea9c4",
  corporateWindhoek: "c865481a-6632-5ce1-901c-79d798fc1042",
} as const;

export const CATALOG_VEHICLE_CLASSES: NewVehicleClass[] = [
  {
    id: VEHICLE_CLASS_IDS.sedan,
    slug: "private-sedan",
    name: "Private Sedan",
    description:
      "Air-conditioned sedan for up to 3 passengers. The standard choice for couples, solo travellers and business trips.",
    capacity: 3,
    luggageCapacity: 3,
    priceMultiplier: "1.00",
    sortOrder: 10,
  },
  {
    id: VEHICLE_CLASS_IDS.suv,
    slug: "suv-4x4",
    name: "SUV / 4x4",
    description:
      "Higher-clearance 4x4 for up to 5 passengers, with room for oversized luggage and camera gear.",
    capacity: 5,
    luggageCapacity: 5,
    priceMultiplier: "1.40",
    sortOrder: 20,
  },
];

export const CATALOG_ROUTES: NewRoute[] = [
  /* ---------------------------------------------------------------- active */
  {
    id: ROUTE_IDS.wdhWindhoek,
    slug: "hosea-kutako-to-windhoek",
    originLabel: "Hosea Kutako International Airport (WDH)",
    destinationLabel: "Windhoek CBD",
    category: "airport",
    /**
     * The airport shuttle sells per seat (N$650/person). Long-distance
     * routes below keep per-vehicle pricing — their fares were set as
     * whole-car prices, and per-person would silently multiply them.
     */
    pricingUnit: "per_person",
    fixedPrice: "650.00",
    defaultDriverPayout: "455.00",
    isActive: true,
    distanceKm: "45.00",
    durationMin: 45,
    sortOrder: 10,
    seoTitle:
      "Hosea Kutako Airport to Windhoek Transfer — Fixed Price Private Car",
    seoDescription:
      "Book a private transfer from Hosea Kutako International Airport (WDH) to Windhoek CBD. Fixed price, meet & greet in arrivals, flight monitoring and professional Namibian drivers.",
    seoBody:
      "Hosea Kutako International Airport sits about 45 kilometres east of Windhoek, a straight 45-minute run into the city on the B6. There is no train and no reliable scheduled shuttle, so a pre-booked private car is how most visitors make the trip. Your driver tracks your flight, waits in the arrivals hall with a name board, and helps with luggage — so a delayed landing costs you nothing and there is no queue to join at midnight.",
  },
  {
    id: ROUTE_IDS.wdhSwakopmund,
    slug: "hosea-kutako-to-swakopmund",
    originLabel: "Hosea Kutako International Airport (WDH)",
    destinationLabel: "Swakopmund",
    category: "airport",
    fixedPrice: "4200.00",
    defaultDriverPayout: "2940.00",
    isActive: true,
    distanceKm: "400.00",
    durationMin: 270,
    sortOrder: 20,
    seoTitle: "Hosea Kutako Airport to Swakopmund Transfer — Private Car",
    seoDescription:
      "Private door-to-door transfer from Hosea Kutako International Airport (WDH) to Swakopmund. One fixed price for the car, comfort stops en route, and professional Namibian drivers.",
    seoBody:
      "Swakopmund lies roughly 400 kilometres west of the airport, about four and a half hours of open road through the Khomas Hochland and across the Namib. Landing and driving straight to the coast is a common opening move for a Namibian itinerary, and it is far easier in a private vehicle than with a hire car after a long-haul flight. The price is for the whole car, not per seat, and includes comfort stops along the way.",
  },
  {
    id: ROUTE_IDS.windhoekSwakopmund,
    slug: "windhoek-to-swakopmund",
    originLabel: "Windhoek",
    destinationLabel: "Swakopmund",
    category: "intercity",
    fixedPrice: "3900.00",
    defaultDriverPayout: "2730.00",
    isActive: true,
    distanceKm: "360.00",
    durationMin: 240,
    sortOrder: 30,
    seoTitle: "Windhoek to Swakopmund Private Transfer — Fixed Price",
    seoDescription:
      "Private car from Windhoek to Swakopmund on the B2. Fixed price for the whole vehicle, hotel pickup, comfort stops and professional Namibian drivers.",
    seoBody:
      "The B2 from Windhoek to Swakopmund is a four-hour drive of about 360 kilometres, climbing out of the highlands and dropping through Karibib and Usakos before the coastal fog takes over near the sea. We collect you from your Windhoek hotel or guesthouse at a time you choose. Because the fare covers the vehicle rather than each seat, it works out well for couples, families and small groups alike.",
  },

  /* ----------------------------------------------- schema-ready, not listed */
  {
    id: ROUTE_IDS.wdhWalvisBay,
    slug: "hosea-kutako-to-walvis-bay",
    originLabel: "Hosea Kutako International Airport (WDH)",
    destinationLabel: "Walvis Bay",
    category: "airport",
    fixedPrice: "4400.00",
    defaultDriverPayout: "3080.00",
    isActive: false,
    distanceKm: "430.00",
    durationMin: 285,
    sortOrder: 40,
    seoTitle: "Hosea Kutako Airport to Walvis Bay Transfer — Private Car",
    seoDescription:
      "Private transfer from Hosea Kutako International Airport (WDH) to Walvis Bay, for the harbour, the lagoon and cruise departures.",
  },
  {
    id: ROUTE_IDS.wdhSossusvlei,
    slug: "hosea-kutako-to-sossusvlei",
    originLabel: "Hosea Kutako International Airport (WDH)",
    destinationLabel: "Sossusvlei",
    category: "airport",
    fixedPrice: "6500.00",
    defaultDriverPayout: "4550.00",
    isActive: false,
    distanceKm: "380.00",
    durationMin: 330,
    sortOrder: 50,
    seoTitle: "Hosea Kutako Airport to Sossusvlei Transfer — 4x4 Private Car",
    seoDescription:
      "Private 4x4 transfer from Hosea Kutako International Airport (WDH) to the Sossusvlei dune lodges, over the Spreetshoogte or Remhoogte pass.",
  },
  {
    id: ROUTE_IDS.wdhEtosha,
    slug: "hosea-kutako-to-etosha",
    originLabel: "Hosea Kutako International Airport (WDH)",
    destinationLabel: "Etosha National Park",
    category: "airport",
    fixedPrice: "6900.00",
    defaultDriverPayout: "4830.00",
    isActive: false,
    distanceKm: "450.00",
    durationMin: 330,
    sortOrder: 60,
    seoTitle: "Hosea Kutako Airport to Etosha Transfer — Private Car",
    seoDescription:
      "Private transfer from Hosea Kutako International Airport (WDH) to Etosha National Park and the Andersson and Von Lindequist gates.",
  },
  {
    id: ROUTE_IDS.windhoekWalvisBay,
    slug: "windhoek-to-walvis-bay",
    originLabel: "Windhoek",
    destinationLabel: "Walvis Bay",
    category: "intercity",
    fixedPrice: "4100.00",
    defaultDriverPayout: "2870.00",
    isActive: false,
    distanceKm: "395.00",
    durationMin: 260,
    sortOrder: 70,
    seoTitle: "Windhoek to Walvis Bay Private Transfer",
    seoDescription:
      "Private car from Windhoek to Walvis Bay for the harbour, the lagoon and cruise departures.",
  },
  {
    id: ROUTE_IDS.corporateWindhoek,
    slug: "corporate-windhoek-city",
    originLabel: "Windhoek CBD",
    destinationLabel: "Greater Windhoek",
    category: "corporate",
    fixedPrice: "550.00",
    defaultDriverPayout: "385.00",
    isActive: false,
    distanceKm: "20.00",
    durationMin: 30,
    sortOrder: 80,
    seoTitle: "Corporate Ground Transport in Windhoek",
    seoDescription:
      "Account-based ground transport for Windhoek businesses: staff runs, client collections and monthly billing.",
  },
];

/** Slug -> route, for O(1) fallback lookups. */
export const CATALOG_ROUTES_BY_SLUG = new Map(
  CATALOG_ROUTES.map((route) => [route.slug, route])
);
