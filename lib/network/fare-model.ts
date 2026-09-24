import {
  BASELINE_PROFILE,
  DEFAULT_CONSTANTS,
  DEFAULT_RUNNING_COST,
  modelCost,
  modelPayout as costModelPayout,
  type PricingConstants,
  type VehicleCostProfile,
} from "@/lib/pricing/cost-model";
import type { Road, Surface } from "./roads";

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
 * the outbound fare is buying two crossings of the Namib and selling one.
 *
 * Where a curated route exists its published price wins — a price we have
 * advertised is a promise, and the model does not get to revise it.
 *
 * ## This file is now a façade
 *
 * The arithmetic moved to `lib/pricing/cost-model.ts`, which prices per
 * vehicle class from per-kilometre running costs rather than multiplying a
 * finished fare. Two copies of a fare model is how a customer gets shown one
 * price and charged another, so there is exactly one: everything below
 * delegates, and `tests/cost-model.test.ts` pins the baseline output to the
 * figures this file produced before the move.
 */

export const RUNNING_COST_PER_KM: Record<Surface, number> = DEFAULT_RUNNING_COST;
export const CONTRIBUTION_RATE = DEFAULT_CONSTANTS.contributionRate;
export const PRICE_STEP = DEFAULT_CONSTANTS.priceStep;

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
  /** Baseline-class fare, rounded. */
  price: number;
  /** What we keep, at the baseline class. */
  contribution: number;
};

/**
 * Prices one journey. Defaults to the baseline class and the built-in
 * constants, which is what every existing caller wants; the admin preview
 * passes a class profile and operator-set constants instead.
 */
export function modelFare(
  road: Road,
  profile: VehicleCostProfile = BASELINE_PROFILE,
  constants: PricingConstants = DEFAULT_CONSTANTS,
): FareBreakdown {
  const cost = modelCost(road, profile, constants);

  return {
    km: cost.km,
    drivenKm: cost.drivenKm,
    dutyHours: cost.dutyHours,
    returnFactor: cost.returnFactor,
    driverNeed: cost.driverNeed,
    overnights: cost.nights,
    price: cost.price,
    contribution: cost.contribution,
  };
}

/** The payout that goes with a modelled price, at the default split. */
export function modelPayout(price: number): number {
  return costModelPayout(price, DEFAULT_CONSTANTS.contributionRate);
}
