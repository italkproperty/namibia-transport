import { modelFare, modelPayout, RUNNING_COST_PER_KM } from "@/lib/network/fare-model";
import { journeySlug } from "@/lib/network/journey";
import { PLACE_NODES, type PlaceNode } from "@/lib/network/nodes";
import { findRoad, SPEED_KMH, type Road } from "@/lib/network/roads";

import type { IdleWindow } from "./timeline";

/**
 * What a leg costs when the car is already going that way.
 *
 * A standalone fare has to pay for the empty return — that is 42% of it. But a
 * car that has finished at Swakopmund and must be in Windhoek on Thursday is
 * driving those 356 km empty whether or not anybody is in it. Selling that
 * drive costs us almost nothing, and the fare is nearly all contribution.
 *
 * The rule is one subtraction: what the car will drive with the job, minus
 * what it was going to drive anyway. Everything interesting follows from it.
 * A detour that ends where the car was already headed is nearly free; a job
 * that has to come all the way back to where it started saves nothing at all,
 * which is why "there is an idle car" is not by itself a discount.
 */

/** Driver time is the other half of a kilometre's cost, and it is per hour. */
const DRIVER_HOURLY = 110;
const HANDLING = 110;

/**
 * Driving hours are not elapsed hours. Swakopmund to Katima Mulilo and back to
 * Windhoek is 28 hours behind the wheel, which does not fit in a two-day
 * window however the arithmetic is done — the driver has to sleep. Ten hours
 * is already a long day on Namibian roads, and each further day costs a bed.
 */
const MAX_DRIVING_HOURS_PER_DAY = 10;
const HOURS_OFF_BETWEEN_DAYS = 12;
const OVERNIGHT_ALLOWANCE = 450;

/** Elapsed hours a job actually consumes, sleep included. */
function elapsedHours(drivingHours: number): number {
  return drivingHours + nightsAway(drivingHours) * HOURS_OFF_BETWEEN_DAYS;
}

function nightsAway(drivingHours: number): number {
  return Math.max(0, Math.ceil(drivingHours / MAX_DRIVING_HOURS_PER_DAY) - 1);
}
/** The floor from the fare model: below this a driver will not turn out. */
const MINIMUM_NEED = 455;
const CONTRIBUTION_RATE = 0.3;

/**
 * A marginal fare never goes below this share of the standalone one.
 *
 * The subtraction below is honest and it is also dangerous: a car already
 * driving Swakopmund to Windhoek empty has an incremental cost of nothing, so
 * the maths says N$650 for a 356 km transfer we otherwise sell at N$3,050.
 * Offer that and the standalone price stops meaning anything — anyone who can
 * wait, waits. This is a commercial floor rather than a physical one, and it
 * is the reason these offers are an operator's tool and not a public price.
 */
const FLOOR_OF_STANDALONE = 0.5;

/** What one pass along a road costs the driver, car and hours together. */
function passCost(road: Road | null): number {
  if (!road) return 0;
  return (
    road.tarKm * (RUNNING_COST_PER_KM.tar + DRIVER_HOURLY / SPEED_KMH.tar) +
    road.gravelKm * (RUNNING_COST_PER_KM.gravel + DRIVER_HOURLY / SPEED_KMH.gravel)
  );
}

export type MarginalOffer = {
  window: IdleWindow;
  to: PlaceNode;
  /** The slug to quote or book it under. */
  slug: string;
  outbound: Road;
  /** Driving minutes for the job plus getting back on schedule. */
  minutes: number;
  /** Hours the driver is committed for, sleep included. */
  hoursAway: number;
  nights: number;
  /** Kilometres this adds over what the car was going to drive regardless. */
  extraKm: number;
  price: number;
  payout: number;
  contribution: number;
  /** What the same journey costs with nobody already there. */
  standalone: number;
  saving: number;
  /** True when the car was going to drive this exact road empty anyway. */
  onTheWay: boolean;
  /** Contribution per hour the driver spends on it — the only fair ranking. */
  contributionPerHour: number;
};

/**
 * Prices one journey out of a standing car. Null when it cannot be done inside
 * the window and still put the car where it has to be next.
 */
export function marginalOffer(
  window: IdleWindow,
  destination: PlaceNode,
): MarginalOffer | null {
  if (destination.slug === window.at.slug) return null;

  const outbound = findRoad(window.at.slug, destination.slug);
  if (!outbound) return null;

  const onward = findRoad(destination.slug, window.nextAt.slug);
  // Already where it needs to be next: no onward drive at all.
  const onwardMinutes = destination.slug === window.nextAt.slug ? 0 : onward?.minutes;
  if (onwardMinutes === undefined) return null;

  const minutes = outbound.minutes + onwardMinutes;
  const drivingHours = minutes / 60;
  const hoursAway = elapsedHours(drivingHours);
  const nights = nightsAway(drivingHours);

  const availableHours =
    (window.dueBy.getTime() - window.startsAt.getTime()) / 3_600_000;
  // A hair of tolerance, because a leg that exactly fills an empty drive is
  // the whole point and must not be lost to floating point.
  if (hoursAway > availableHours + 0.02) return null;

  // What the car was going to drive anyway, to be where it must be next.
  const anyway =
    window.nextAt.slug === window.at.slug
      ? null
      : findRoad(window.at.slug, window.nextAt.slug);

  const withJob =
    passCost(outbound) + (destination.slug === window.nextAt.slug ? 0 : passCost(onward));
  const without = passCost(anyway);

  // A marginal job that spans days still costs the driver a bed, and that is
  // not incremental to anything — nobody was paying for it before.
  const need = Math.max(
    MINIMUM_NEED,
    withJob - without + HANDLING + nights * OVERNIGHT_ALLOWANCE,
  );
  const standalone = modelFare(outbound).price;
  const price = Math.max(
    Math.ceil(need / (1 - CONTRIBUTION_RATE) / 50) * 50,
    Math.ceil((standalone * FLOOR_OF_STANDALONE) / 50) * 50,
  );
  const payout = modelPayout(price);

  const extraKm =
    outbound.km +
    (destination.slug === window.nextAt.slug ? 0 : (onward?.km ?? 0)) -
    (anyway?.km ?? 0);

  return {
    window,
    to: destination,
    slug: journeySlug(window.at.slug, destination.slug),
    outbound,
    minutes,
    hoursAway,
    nights,
    extraKm,
    price,
    payout,
    contribution: price - payout,
    standalone,
    saving: standalone - price,
    // The car was already driving to exactly this place, empty.
    onTheWay: destination.slug === window.nextAt.slug,
    // Per hour the driver is committed, not per hour driving — a job that
    // costs them a night away costs them the night.
    contributionPerHour: (price - payout) / Math.max(1, hoursAway),
  };
}

/**
 * Every journey each standing car could take, best first.
 *
 * Ranked by what the driver earns per hour they spend on it, not by the size
 * of the discount. Ranking on the discount alone puts a fifteen-hour run to
 * Lüderitz at the top of the board purely because southern fares are large,
 * which is not the job anyone should take. A leg the car was already driving
 * empty comes first regardless: that is the one with no cost at all.
 */
export function sellableLegs(
  windows: IdleWindow[],
  { minSaving = 500, perWindow = 3 }: { minSaving?: number; perWindow?: number } = {},
): MarginalOffer[] {
  const offers: MarginalOffer[] = [];

  for (const window of windows) {
    const forWindow = PLACE_NODES.map((node) => marginalOffer(window, node))
      .filter((offer): offer is MarginalOffer => offer !== null)
      .filter((offer) => offer.saving >= minSaving)
      .sort(rank)
      .slice(0, perWindow);
    offers.push(...forWindow);
  }

  return offers.sort(rank);
}

function rank(a: MarginalOffer, b: MarginalOffer): number {
  if (a.onTheWay !== b.onTheWay) return a.onTheWay ? -1 : 1;
  return b.contributionPerHour - a.contributionPerHour;
}
