/**
 * The figures an operator quotes from.
 *
 * This is the panel beside the fare box on the manual quote form, and it
 * exists because a real enquiry went out at a price typed from memory: the
 * same trip quoted twice produced two numbers, the vehicle named on the quote
 * had no relationship to the figure beside it, and the return leg became a
 * sentence in the notes. The traveller emailed to ask whether his return was
 * included.
 *
 * So the numbers here are the ones a client is told. They are checked rather
 * than eyeballed, and the checks below are the three that would each have
 * caused a real loss:
 *
 *   A return priced as a doubling rather than as its own leg. The backhaul is
 *   directional — out to the desert the car comes back empty, home to Windhoek
 *   it is earning again within the hour — so doubling overcharges the way back
 *   by thousands and loses the job.
 *
 *   A class comparison that is only a multiplier. The whole point of the cost
 *   model is that a bigger vehicle moves the distance term and not the
 *   driver's hours, so the gap between classes must narrow as a trip lengthens.
 *
 *   Silence about a class nobody has costed. An uncosted class is priced
 *   through the legacy multiplier, which is an estimate of an estimate, and
 *   the panel has to say so rather than presenting it like the rest.
 */
import {
  BASELINE_PROFILE,
  DEFAULT_CONSTANTS,
  DEFAULT_MINIMUM_DRIVER_NEED,
  DEFAULT_RUNNING_COST,
} from "@/lib/pricing/cost-model";
import { referenceQuote, type ClassProfile } from "@/lib/pricing/reference";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** The two classes as seeded: a sedan at 1.0 and an SUV at 1.4, neither costed. */
function legacy(id: string, name: string, multiplier: number): ClassProfile {
  return {
    id,
    name,
    costed: false,
    profile: {
      slug: id,
      runningCost: {
        tar: DEFAULT_RUNNING_COST.tar * multiplier,
        gravel: DEFAULT_RUNNING_COST.gravel * multiplier,
      },
      minimumDriverNeed: DEFAULT_MINIMUM_DRIVER_NEED * multiplier,
    },
  };
}

const SEDAN = legacy("sedan", "Private Car", 1);
const SUV = legacy("suv", "SUV / 4x4", 1.4);
const CLASSES = [SEDAN, SUV];

const quote = (from: string, to: string, returning = true) =>
  referenceQuote(from, to, returning, CLASSES, DEFAULT_CONSTANTS);

/* --------------------------------------------------- both classes at once */

console.log("a pair prices in every class");

const trip = quote("hosea-kutako", "sossusvlei");
check("the pair prices at all", trip !== null);
check(
  "THE RULE: every class gets a row, not just the baseline",
  trip?.rows.length === 2,
  `${trip?.rows.length}`,
);
check(
  "each row carries the class it belongs to",
  Boolean(trip?.rows.every((r) => r.id && r.name)),
);
check(
  "the bigger vehicle costs more",
  Boolean(trip && trip.rows[1].total > trip.rows[0].total),
  `${trip?.rows[0].total} vs ${trip?.rows[1].total}`,
);
check(
  "an uncosted class is flagged as such",
  Boolean(trip?.rows.every((r) => r.costed === false)),
);

/* ------------------------------------------------- the return is a leg */

/**
 * The expensive one. Hosea Kutako to Sossusvlei is N$7,250 out and N$3,850
 * back for a sedan, because the outbound carries an empty return across the
 * Namib and the homeward leg does not.
 */
console.log("\nthe return is its own leg, never a doubling");

const sedan = trip!.rows[0];
check(
  "outbound and return are priced separately",
  sedan.outbound > 0 && sedan.inbound > 0 && sedan.outbound !== sedan.inbound,
  `${sedan.outbound} / ${sedan.inbound}`,
);
check(
  "THE RULE: the way home is cheaper than the way out",
  sedan.inbound < sedan.outbound,
  `${sedan.inbound} vs ${sedan.outbound}`,
);
check(
  "the total is the two legs added",
  sedan.total === sedan.outbound + sedan.inbound,
);
check(
  "and it is materially below doubling the outbound",
  sedan.total < sedan.outbound * 2,
  `${sedan.total} vs ${sedan.outbound * 2} if doubled`,
);

const oneWay = quote("hosea-kutako", "sossusvlei", false)!;
check(
  "a one-way carries no return",
  oneWay.rows[0].inbound === 0 &&
    oneWay.rows[0].total === oneWay.rows[0].outbound,
);
check(
  "and the outbound is the same either way",
  oneWay.rows[0].outbound === sedan.outbound,
);

/* ------------------------------------------ the class gap is not a constant */

/**
 * If the gap between a sedan and an SUV were a fixed percentage, a multiplier
 * would do and the cost model would be pointless. It narrows with distance,
 * because more of a long fare is the driver's time, which the vehicle does not
 * change.
 */
console.log("\nthe gap between classes narrows with distance");

const shortHop = quote("hosea-kutako", "windhoek")!;
const shortGap = shortHop.rows[1].total / shortHop.rows[0].total;
const longGap = sedan.total > 0 ? trip!.rows[1].total / sedan.total : 0;

check(
  "THE RULE: the effective class premium falls on the longer trip",
  shortGap > longGap,
  `short ${shortGap.toFixed(2)} vs long ${longGap.toFixed(2)}`,
);

/* ---------------------------------------------------------- the road facts */

console.log("\nthe trip facts come from the road, not from prose");

check("distance is reported", trip!.km > 0);
check(
  "gravel is reported where there is gravel",
  trip!.gravelKm > 0,
  `${trip!.gravelKm}`,
);
check("driving hours are reported", trip!.hours > 0);
check(
  "nights away are reported from the model, not guessed",
  trip!.nights === referenceQuote(
    "hosea-kutako",
    "sossusvlei",
    true,
    [{ ...SEDAN, profile: BASELINE_PROFILE }],
    DEFAULT_CONSTANTS,
  )!.nights,
);

/* ------------------------------------------------------- refusing to quote */

console.log("\nit declines rather than inventing");

check("no destination, no quote", quote("hosea-kutako", "") === null);
check("the same place twice is not a trip", quote("windhoek", "windhoek") === null);
check(
  "an unknown place is refused",
  referenceQuote("windhoek", "atlantis", true, CLASSES, DEFAULT_CONSTANTS) === null,
);
check(
  "no classes, no rows",
  referenceQuote("windhoek", "swakopmund", true, [], DEFAULT_CONSTANTS) === null,
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
