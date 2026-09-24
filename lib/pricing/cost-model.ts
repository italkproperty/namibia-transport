import { SPEED_KMH, type Road, type Surface } from "@/lib/network/roads";

/**
 * What a journey costs, by vehicle class, from its parts.
 *
 * ## Why this replaces a multiplier
 *
 * A fare has three dimensions and they are not interchangeable:
 *
 *     driverNeed = km × running cost per km
 *                + hours × the driver's hourly
 *                + nights × a bed
 *
 * `vehicle_classes.price_multiplier` multiplied the *total* — so a 4x4 at 1.40
 * charged 1.40× the fuel, 1.40× the driver's hours and 1.40× the hotel room.
 * Only the first of those is true. A driver's hour costs what it costs whoever
 * is paying for the diesel, and a bed in Otjiwarongo does not get 40% dearer
 * because the car outside has low range.
 *
 * The error is not academic and it is not uniform — it grows with duration,
 * which is precisely where the large fares are. Against our own road model:
 *
 *     Hosea Kutako → Windhoek   45km, 1.5 duty hours
 *       multiplier: N$650 → N$910. The sedan fare is the minimum turn-out,
 *       not a fuel bill; the extra N$260 buys about seven litres of diesel.
 *
 *     Windhoek → Sossusvlei     350km, 10.1 duty hours, one night away
 *       multiplier: N$6,700 → N$9,380, of which several hundred is 40% added
 *       to ten hours of the same driver's time and to the same N$450 bed.
 *
 * So the class enters where it physically belongs — the per-kilometre running
 * cost — plus its own turn-out floor, because a scarcer vehicle genuinely does
 * not leave the yard for the same money. Everything else is shared.
 *
 * ## Why the numbers are operator-set
 *
 * Diesel moves, tyres move, what a driver will accept moves. These were
 * constants in a source file, which meant repricing 2,352 journeys was a
 * deploy. They now come from the database with these as the fallback, and
 * `lib/pricing/settings.ts` bounds every one of them — a misplaced decimal on
 * a per-kilometre figure misprices the entire country, silently, in a
 * direction nobody notices until the driver does.
 *
 * ## What this module is not allowed to do
 *
 * It does not read the database, and it does not import anything server-only.
 * The client preview and the server action call the same function, because a
 * customer shown one price and charged another is the worst failure this
 * codebase has. Settings arrive as an argument.
 */

/* --------------------------------------------------------------- the inputs */

/** What a kilometre costs this class, by surface. Gravel eats tyres. */
export type RunningCost = Record<Surface, number>;

export type VehicleCostProfile = {
  slug: string;
  /**
   * Fuel, tyres, servicing and depreciation per kilometre. The only term a
   * bigger vehicle legitimately changes.
   */
  runningCost: RunningCost;
  /**
   * The floor for this class: below it a driver will not turn out at all,
   * whatever the distance. Per class because a 4x4 that is one of four in the
   * city does not leave the yard for a sedan's minimum — that is a real
   * scarcity cost, unlike a multiplied fuel bill.
   */
  minimumDriverNeed: number;
};

/** The terms that do not vary by vehicle, because they are not about the car. */
export type PricingConstants = {
  /** What an hour behind the wheel has to be worth for a driver to take the job. */
  driverHourly: number;
  /** A round trip longer than this needs a bed somewhere. */
  sameDayLimitHours: number;
  /** What that bed costs. The same bed whatever is parked outside it. */
  overnightAllowance: number;
  /** Loading, greeting and handover at both ends. Real hours, so real money. */
  handlingHours: number;
  /** Our share. The driver keeps the rest. */
  contributionRate: number;
  /** Fares are published in round money — nobody quotes N$4,213. */
  priceStep: number;
};

/**
 * The constants as they stood when they lived in `fare-model.ts`, and the
 * fallback when the database has no row yet.
 *
 * `driverHourly` and `minimumDriverNeed` are not guesses: 455 is the payout on
 * the airport run into Windhoek, which is the shortest transfer we sell, and
 * 455 / (1 − 0.30) is exactly the N$650 published for it. The model reproduces
 * the one price we are confident in rather than being fitted around it, and
 * `tests/cost-model.test.ts` fails if that stops being true.
 */
export const DEFAULT_CONSTANTS: PricingConstants = {
  driverHourly: 110,
  sameDayLimitHours: 10,
  overnightAllowance: 450,
  handlingHours: 1,
  contributionRate: 0.3,
  priceStep: 50,
};

/** The baseline class: a sedan on tar, which is what 3.80/km was measured on. */
export const DEFAULT_RUNNING_COST: RunningCost = { tar: 3.8, gravel: 5.15 };

export const DEFAULT_MINIMUM_DRIVER_NEED = 455;

export const BASELINE_PROFILE: VehicleCostProfile = {
  slug: "baseline",
  runningCost: DEFAULT_RUNNING_COST,
  minimumDriverNeed: DEFAULT_MINIMUM_DRIVER_NEED,
};

/* -------------------------------------------------------------- the output */

export type CostBreakdown = {
  /** One-way distance, as driven. */
  km: number;
  /** What the car actually covers: outbound plus the unpaid share of the return. */
  drivenKm: number;
  /** Hours the driver is committed for, both ways, including handling. */
  dutyHours: number;
  /** 1.0 when the return is fully paid for, 2.0 when it is entirely empty. */
  returnFactor: number;
  nights: number;

  /* The three dimensions, kept apart so a price can be explained. */
  runningCost: number;
  timeCost: number;
  overnightCost: number;

  /** Before the floor is applied — what the journey actually costs to run. */
  rawDriverNeed: number;
  /** After the floor. What the driver has to clear. */
  driverNeed: number;
  /** True when the floor is what set the price, not the distance. */
  atFloor: boolean;

  price: number;
  payout: number;
  contribution: number;
};

function roundUpToStep(amount: number, step: number): number {
  return Math.max(step, Math.ceil(amount / step) * step);
}

/**
 * Prices one journey for one vehicle class.
 *
 * `backhaul` is the destination's: the origin's does not matter because the
 * car is already there. A return factor of 2 means this fare carries the whole
 * empty return; 1.15 means the car is dropping someone in Windhoek and will be
 * earning again within the hour. It remains the single largest lever on a
 * long transfer — larger than fuel, wear and the driver's day combined.
 */
export function modelCost(
  road: Road,
  profile: VehicleCostProfile = BASELINE_PROFILE,
  constants: PricingConstants = DEFAULT_CONSTANTS,
): CostBreakdown {
  const backhaul = Math.min(1, Math.max(0, road.destination.backhaul));
  const returnFactor = 2 - backhaul;

  const drivenTarKm = road.tarKm * returnFactor;
  const drivenGravelKm = road.gravelKm * returnFactor;

  const drivingHours =
    road.tarKm / SPEED_KMH.tar + road.gravelKm / SPEED_KMH.gravel;
  const dutyHours = drivingHours * returnFactor + constants.handlingHours;

  // A twenty-hour round trip is two nights away, not one.
  const nights = Math.max(
    0,
    Math.ceil(dutyHours / constants.sameDayLimitHours) - 1,
  );

  // The three dimensions, computed apart. This is the whole point of the
  // module: the class touches `runningCost` and nothing else.
  const runningCost =
    drivenTarKm * profile.runningCost.tar +
    drivenGravelKm * profile.runningCost.gravel;
  const timeCost = constants.driverHourly * dutyHours;
  const overnightCost = nights * constants.overnightAllowance;

  const rawDriverNeed = runningCost + timeCost + overnightCost;
  const driverNeed = Math.max(profile.minimumDriverNeed, rawDriverNeed);

  const price = roundUpToStep(
    driverNeed / (1 - constants.contributionRate),
    constants.priceStep,
  );
  const payout = modelPayout(price, constants.contributionRate);

  return {
    km: road.km,
    drivenKm: drivenTarKm + drivenGravelKm,
    dutyHours,
    returnFactor,
    nights,
    runningCost,
    timeCost,
    overnightCost,
    rawDriverNeed,
    driverNeed,
    atFloor: rawDriverNeed < profile.minimumDriverNeed,
    price,
    payout,
    contribution: price - payout,
  };
}

/**
 * The payout that goes with a modelled price.
 *
 * Derived from the rounded price rather than from `driverNeed`, so the
 * rounding lands on our side of the split and the two figures always
 * reconcile: payout + contribution = price, exactly. A fare that does not add
 * up is the one arithmetic error a driver will find before we do.
 */
export function modelPayout(price: number, contributionRate: number): number {
  return Math.round(price * (1 - contributionRate) * 100) / 100;
}

/**
 * The multiplier a class is *effectively* charging on a given journey.
 *
 * Exists for the admin preview, which has to show an operator what changing
 * from a flat multiplier to a cost model does to real prices. A single number
 * would hide the point: the effective multiplier is not constant, it falls as
 * the journey gets longer and more of the fare becomes time the class does not
 * affect. Seeing it move is the argument.
 */
export function effectiveMultiplier(
  road: Road,
  profile: VehicleCostProfile,
  constants: PricingConstants = DEFAULT_CONSTANTS,
): number {
  const baseline = modelCost(road, BASELINE_PROFILE, constants).price;
  if (baseline <= 0) return 1;
  return modelCost(road, profile, constants).price / baseline;
}
