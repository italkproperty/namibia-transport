import { CONTRIBUTION_RATE, RUNNING_COST_PER_KM } from "./fare-model";
import { findNode, type PlaceNode } from "./nodes";
import { findRoad, type Road } from "./roads";

/**
 * A whole trip, costed both ways.
 *
 * The road model prices one leg. A visitor planning Namibia is not buying one
 * leg — they are deciding whether to drive the country themselves, and the
 * honest answer needs both columns of the same arithmetic: what a hire car
 * really costs over their route, and what it costs to have somebody drive it.
 *
 * We are the only ones who can put those side by side, because the second
 * column needs a road network and nobody else has modelled one. That is the
 * whole reason this page can exist.
 */

/* --------------------------------------------------------- what we charge */

/** A guide-driver's day, whether they drive that day or wait at a lodge. */
const DRIVER_DAY = 800;
/** Their bed and food away from home. */
const DRIVER_NIGHT = 450;
/** Fares are quoted in round money, and rounded up so nothing is undersold. */
const PRICE_STEP = 50;

/**
 * Kilometres a party covers locally on a day they are not travelling — the
 * dunes at sunrise, a game drive, the run into town for dinner. On a
 * chauffeured trip our car does these, which is most of what people find
 * they miss when they compare only the transfers.
 */
const LOCAL_KM_PER_NIGHT: Record<string, number> = {
  sossusvlei: 130,
  "etosha-okaukuejo": 150,
  "etosha-namutoni": 150,
  twyfelfontein: 60,
  "fish-river-canyon": 70,
  spitzkoppe: 50,
};
const DEFAULT_LOCAL_KM_PER_NIGHT = 40;

export type ItineraryStop = { slug: string; nights: number };

export type Itinerary = {
  stops: { node: PlaceNode; nights: number }[];
  legs: Road[];
  km: number;
  tarKm: number;
  gravelKm: number;
  /** Time behind the wheel on the transfer legs, in minutes. */
  drivingMinutes: number;
  /** Local running while on the ground, which a self-driver also does. */
  localKm: number;
  nights: number;
  /** Every travel day ends in a night on the ground, except the last one home. */
  days: number;
  chauffeured: {
    vehicleCost: number;
    driverCost: number;
    need: number;
    price: number;
    payout: number;
    contribution: number;
  };
};

const roundUp = (amount: number) =>
  Math.max(PRICE_STEP, Math.ceil(amount / PRICE_STEP) * PRICE_STEP);

/**
 * Builds the trip. Null when a stop is unknown or two consecutive stops have
 * no road between them — better nothing than a confident wrong number.
 */
export function planItinerary(stops: ItineraryStop[]): Itinerary | null {
  if (stops.length < 2) return null;

  const resolved: { node: PlaceNode; nights: number }[] = [];
  for (const stop of stops) {
    const node = findNode(stop.slug);
    if (!node) return null;
    resolved.push({ node, nights: Math.max(0, Math.floor(stop.nights)) });
  }

  const legs: Road[] = [];
  for (let i = 0; i < resolved.length - 1; i++) {
    const road = findRoad(resolved[i].node.slug, resolved[i + 1].node.slug);
    // Two stops in a row at the same place is a longer stay, not a drive.
    if (!road) {
      if (resolved[i].node.slug === resolved[i + 1].node.slug) continue;
      return null;
    }
    legs.push(road);
  }
  if (legs.length === 0) return null;

  const km = legs.reduce((total, leg) => total + leg.km, 0);
  const gravelKm = legs.reduce((total, leg) => total + leg.gravelKm, 0);
  const drivingMinutes = legs.reduce((total, leg) => total + leg.minutes, 0);

  const localKm = resolved.reduce(
    (total, stop) =>
      total +
      stop.nights *
        (LOCAL_KM_PER_NIGHT[stop.node.slug] ?? DEFAULT_LOCAL_KM_PER_NIGHT),
    0,
  );

  const nights = resolved.reduce((total, stop) => total + stop.nights, 0);
  const days = nights + 1;

  const vehicleCost =
    legs.reduce(
      (total, leg) =>
        total +
        leg.tarKm * RUNNING_COST_PER_KM.tar +
        leg.gravelKm * RUNNING_COST_PER_KM.gravel,
      0,
    ) +
    localKm * RUNNING_COST_PER_KM.gravel;

  /**
   * One driver stays with the party for the whole trip. That is what we can
   * actually run today: the cheaper relay — where the car that drops you
   * picks up whoever is leaving — needs about two circuits a day of demand,
   * and quoting a price that depends on demand we do not have would be
   * quoting a price we cannot honour.
   */
  const driverCost = days * DRIVER_DAY + nights * DRIVER_NIGHT;
  const need = vehicleCost + driverCost;
  const price = roundUp(need / (1 - CONTRIBUTION_RATE));
  const payout = Math.round(price * (1 - CONTRIBUTION_RATE) * 100) / 100;

  return {
    stops: resolved,
    legs,
    km,
    tarKm: km - gravelKm,
    gravelKm,
    drivingMinutes,
    localKm,
    nights,
    days,
    chauffeured: {
      vehicleCost,
      driverCost,
      need,
      price,
      payout,
      contribution: price - payout,
    },
  };
}

/* ------------------------------------------------------- what they'd pay */

export type SelfDriveClass = {
  id: string;
  label: string;
  /** Namibian dollars a day, before insurance. */
  dayRate: number;
  /** Fuel at the pump, per kilometre driven. */
  fuelPerKm: number;
  note: string;
};

/**
 * Quoted 2026 rates from Windhoek operators, and aggregator averages for the
 * ordinary hire cars, converted at about N$17.5 to the dollar. They are
 * defaults, not assertions: the page lets a reader type in the quote they
 * have actually been given, which is both more persuasive and the only way
 * this stays true as rates move.
 */
export const SELF_DRIVE_CLASSES: SelfDriveClass[] = [
  {
    id: "soft-roader",
    label: "Hire car or soft-roader, staying in lodges",
    dayRate: 1383,
    fuelPerKm: 2.0,
    note: "Fine on tar. The gravel to Sesriem and Twyfelfontein is where these get returned damaged.",
  },
  {
    id: "camper-low",
    label: "Camping 4×4, low season",
    dayRate: 2445,
    fuelPerKm: 2.3,
    note: "A Hilux double cab with rooftop tents — what most Namibia itineraries are actually driven in.",
  },
  {
    id: "camper-high",
    label: "Camping 4×4, high season (July–October)",
    dayRate: 3880,
    fuelPerKm: 2.3,
    note: "The same vehicle in the four months everyone comes. Rates roughly half again.",
  },
];

/** Tyre-and-glass cover, per day. Without it a gravel puncture is billed whole. */
export const WAIVER_PER_DAY = 290;
/** What the traveller still carries after the waiver. */
export const REMAINING_EXCESS = 25000;

export type SelfDriveInput = {
  dayRate: number;
  fuelPerKm: number;
  waiverPerDay: number;
};

export type SelfDriveCost = {
  vehicle: number;
  waiver: number;
  fuel: number;
  total: number;
  /** Not a cost — a risk the traveller carries and we do not. */
  excessCarried: number;
};

export function selfDriveCost(
  itinerary: Itinerary,
  input: SelfDriveInput,
): SelfDriveCost {
  // Whole rand throughout. Nobody is quoted a hire car in cents, and a
  // comparison that shows N$30,762.90 against N$33,400 looks like a
  // spreadsheet rather than a price.
  const vehicle = Math.round(itinerary.days * input.dayRate);
  const waiver = Math.round(itinerary.days * input.waiverPerDay);
  const fuel = Math.round((itinerary.km + itinerary.localKm) * input.fuelPerKm);
  return {
    vehicle,
    waiver,
    fuel,
    total: vehicle + waiver + fuel,
    excessCarried: REMAINING_EXCESS,
  };
}

/* ------------------------------------------------------------- the presets */

export type Preset = {
  id: string;
  name: string;
  blurb: string;
  stops: ItineraryStop[];
};

/** The routings Namibian visitors actually book, so the page opens on a real trip. */
export const ITINERARY_PRESETS: Preset[] = [
  {
    id: "classic",
    name: "The classic, nine days",
    blurb: "Dunes, coast, Damaraland and Etosha — the first-time Namibia trip.",
    stops: [
      { slug: "hosea-kutako", nights: 0 },
      { slug: "sossusvlei", nights: 2 },
      { slug: "swakopmund", nights: 2 },
      { slug: "twyfelfontein", nights: 1 },
      { slug: "etosha-okaukuejo", nights: 3 },
      { slug: "windhoek", nights: 0 },
    ],
  },
  {
    id: "dunes-coast",
    name: "Dunes and coast, six days",
    blurb: "Sossusvlei and Swakopmund with none of the long northern legs.",
    stops: [
      { slug: "hosea-kutako", nights: 0 },
      { slug: "sossusvlei", nights: 2 },
      { slug: "swakopmund", nights: 3 },
      { slug: "windhoek", nights: 0 },
    ],
  },
  {
    id: "grand",
    name: "The grand tour, fourteen days",
    blurb: "Everything above plus the Kavango, for people with the time.",
    stops: [
      { slug: "hosea-kutako", nights: 0 },
      { slug: "sossusvlei", nights: 2 },
      { slug: "swakopmund", nights: 2 },
      { slug: "twyfelfontein", nights: 2 },
      { slug: "etosha-okaukuejo", nights: 3 },
      { slug: "grootfontein", nights: 1 },
      { slug: "rundu", nights: 1 },
      { slug: "windhoek", nights: 0 },
    ],
  },
];
