import { SPEED_KMH, type Road, type Surface } from "./roads";

/**
 * What a journey costs, derived rather than looked up.
 *
 * The catalogue's eight prices were set by hand. Hand-set prices do not
 * generalise: they cannot tell you what Sossusvlei to Swakopmund is worth, and
 * they cannot tell you whether the Sossusvlei price you already publish is a
 * good one. So this models the physics instead — a car and a driver moving
 * over a surface for a number of hours — and the eight published prices become
 * the test of the model rather than the source of it.
 *
 * The dominant term is not the distance out. It is the distance back. A car
 * dropped at Sesriem has to return, and unless somebody pays for that return
 * the outbound fare is buying two crossings of the Namib and selling one. Every
 * per-kilometre figure below is therefore multiplied by a return factor drawn
 * from the destination's backhaul, and that single number moves the price of a
 * long transfer more than fuel, wear and the driver's day combined.
 *
 * Where a curated route exists its published price wins — a price we have
 * advertised is a promise, and the model does not get to revise it. The model
 * prices the journeys nobody has priced by hand, which is almost all of them.
 */

/* ----------------------------------------------------------- the constants */

/**
 * What a kilometre costs the driver in fuel, tyres, servicing and the car's
 * own depreciation. Gravel is harder on everything, tyres worst of all, and
 * the difference is not marginal — a set of tyres is a month of margin.
 *
 * These are the partner driver's costs, not ours: we own no fleet. They are
 * what the payout has to cover before the driver has earned anything.
 */
export const RUNNING_COST_PER_KM: Record<Surface, number> = {
  tar: 3.8,
  gravel: 5.15,
};

/** What an hour behind the wheel has to be worth for a driver to take the job. */
const DRIVER_HOURLY = 110;

/**
 * A round trip longer than this cannot be done between one sunrise and the
 * next, so the driver sleeps somewhere and we pay for it. Ten hours of driving
 * is already a long day; beyond it, an Etosha run means a bed in Otjiwarongo.
 */
const SAME_DAY_LIMIT_HOURS = 10;
const OVERNIGHT_ALLOWANCE = 450;

/** Loading, greeting and handover, at both ends. Real hours, so real money. */
const HANDLING_HOURS = 1;

/**
 * The floor. Below about this a driver will not turn out at all — the trip to
 * the pickup, the wait and the return eat the fare whatever the distance. It
 * is exactly the payout on the shortest transfer we sell, the airport run into
 * Windhoek, which is where the number comes from rather than from a guess.
 */
const MINIMUM_DRIVER_NEED = 455;

/** Our share. The driver keeps the rest, and that ratio is in every route. */
export const CONTRIBUTION_RATE = 0.3;

/**
 * Fares are quoted in round money — nobody publishes N$4,213. Rounded up, not
 * to nearest: the step is smaller than the noise in the model, but rounding
 * down can leave the payout a few dollars short of what the drive actually
 * costs the driver, and a fare that does not cover its own fuel is the one
 * error here that compounds.
 */
const PRICE_STEP = 50;

/* -------------------------------------------------------------- the model */

export type FareBreakdown = {
  /** One-way distance, as driven. */
  km: number;
  /** Distance the car actually covers, outbound plus the unpaid return share. */
  drivenKm: number;
  /** Hours the driver is committed for, both ways, including handling. */
  dutyHours: number;
  /** 1.0 when the return is fully paid for, 2.0 when it is entirely empty. */
  returnFactor: number;
  /** What the driver has to clear: running costs, their hours, and any bed. */
  driverNeed: number;
  overnights: number;
  /** Baseline-class fare, rounded. Vehicle multipliers scale from here. */
  price: number;
  /** What we keep, at the baseline class. */
  contribution: number;
};

function roundUpToStep(amount: number): number {
  return Math.max(PRICE_STEP, Math.ceil(amount / PRICE_STEP) * PRICE_STEP);
}

/**
 * Prices one journey for the baseline vehicle class.
 *
 * `backhaul` is the destination's — the origin's does not matter, because the
 * car is already there. A returnFactor of 2 means the outbound fare carries
 * the whole empty return; 1.15 means the car is dropping someone in Windhoek
 * and will be earning again within the hour.
 */
export function modelFare(road: Road): FareBreakdown {
  const backhaul = Math.min(1, Math.max(0, road.destination.backhaul));
  const returnFactor = 2 - backhaul;

  const drivenTarKm = road.tarKm * returnFactor;
  const drivenGravelKm = road.gravelKm * returnFactor;

  const perKm = (surface: Surface) =>
    RUNNING_COST_PER_KM[surface] + DRIVER_HOURLY / SPEED_KMH[surface];

  const drivingHours =
    road.tarKm / SPEED_KMH.tar + road.gravelKm / SPEED_KMH.gravel;
  const dutyHours = drivingHours * returnFactor + HANDLING_HOURS;

  // A twenty-hour round trip is two nights away, not one.
  const overnights = Math.max(
    0,
    Math.ceil(dutyHours / SAME_DAY_LIMIT_HOURS) - 1,
  );

  const driverNeed = Math.max(
    MINIMUM_DRIVER_NEED,
    drivenTarKm * perKm("tar") +
      drivenGravelKm * perKm("gravel") +
      DRIVER_HOURLY * HANDLING_HOURS +
      overnights * OVERNIGHT_ALLOWANCE,
  );

  const price = roundUpToStep(driverNeed / (1 - CONTRIBUTION_RATE));

  return {
    km: road.km,
    drivenKm: drivenTarKm + drivenGravelKm,
    dutyHours,
    returnFactor,
    driverNeed,
    overnights,
    price,
    contribution: price - modelPayout(price),
  };
}

/**
 * The payout that goes with a modelled price. Derived from the price rather
 * than from `driverNeed`, so the rounding lands on our side of the split and
 * the two figures always reconcile: payout + contribution = price, exactly.
 */
export function modelPayout(price: number): number {
  return Math.round(price * (1 - CONTRIBUTION_RATE) * 100) / 100;
}
