/**
 * Costing a whole trip, both ways.
 *
 * These numbers were published in "The Idle Day" before they were code, and a
 * page is about to quote them at travellers. So the tests hold the module to
 * the paper: the classic nine-day circuit must come out at N$33,400 and the
 * camping 4×4 it is compared against at N$30,763, to the rand. If either
 * moves, either the analysis was wrong or the code is — and both are worth
 * stopping for.
 */
import {
  ITINERARY_PRESETS,
  SELF_DRIVE_CLASSES,
  WAIVER_PER_DAY,
  planItinerary,
  selfDriveCost,
} from "@/lib/network/itinerary";
import { CONTRIBUTION_RATE } from "@/lib/network/fare-model";

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

const classic = planItinerary(ITINERARY_PRESETS[0].stops)!;

/* --------------------------------------------- the shape of the journey */

console.log("\nthe classic nine-day circuit");

check("it plans", Boolean(classic));
check("five legs", classic.legs.length === 5, `${classic.legs.length}`);
check("1,823 km of transfer driving", Math.round(classic.km) === 1823, `${Math.round(classic.km)}`);
check("920 km of it gravel", Math.round(classic.gravelKm) === 920, `${Math.round(classic.gravelKm)}`);
check("850 km of local running", classic.localKm === 850, `${classic.localKm}`);
check("eight nights", classic.nights === 8, `${classic.nights}`);
check("nine days", classic.days === 9, `${classic.days}`);

/* ------------------------------------------- the number we would quote */

console.log("\nwhat we would charge, against the published analysis");

check(
  "driver, nine days and eight nights: N$10,800",
  classic.chauffeured.driverCost === 10800,
  `N$${classic.chauffeured.driverCost}`,
);
check(
  "car over 2,673 km: N$12,547",
  Math.round(classic.chauffeured.vehicleCost) === 12547,
  `N$${Math.round(classic.chauffeured.vehicleCost)}`,
);
check(
  "price: N$33,400",
  classic.chauffeured.price === 33400,
  `N$${classic.chauffeured.price}`,
);
check(
  "and the split reconciles exactly",
  Math.abs(
    classic.chauffeured.price -
      classic.chauffeured.payout -
      classic.chauffeured.contribution,
  ) < 0.005 &&
    Math.abs(
      classic.chauffeured.contribution / classic.chauffeured.price - CONTRIBUTION_RATE,
    ) < 0.001,
);

/* ------------------------------------------- what they would pay instead */

console.log("\nthe alternatives, against the published analysis");

const EXPECTED: Record<string, number> = {
  "soft-roader": 20403,
  "camper-low": 30763,
  "camper-high": 43678,
};
for (const cls of SELF_DRIVE_CLASSES) {
  const cost = selfDriveCost(classic, {
    dayRate: cls.dayRate,
    fuelPerKm: cls.fuelPerKm,
    waiverPerDay: WAIVER_PER_DAY,
  });
  check(
    `${cls.id}: N$${EXPECTED[cls.id].toLocaleString()}`,
    Math.round(cost.total) === EXPECTED[cls.id],
    `N$${Math.round(cost.total)}`,
  );
  check(
    `  ${cls.id}: the parts add up to the total`,
    Math.abs(cost.vehicle + cost.waiver + cost.fuel - cost.total) < 0.005,
  );
}

// The finding the page is built on.
const high = selfDriveCost(classic, {
  dayRate: SELF_DRIVE_CLASSES[2].dayRate,
  fuelPerKm: SELF_DRIVE_CLASSES[2].fuelPerKm,
  waiverPerDay: WAIVER_PER_DAY,
});
check(
  "in high season the chauffeured trip is N$10,278 cheaper",
  Math.round(high.total - classic.chauffeured.price) === 10278,
  `N$${Math.round(high.total - classic.chauffeured.price)}`,
);

/* ------------------------------------------------------- every preset */

console.log("\nevery preset is a real trip");

for (const preset of ITINERARY_PRESETS) {
  const plan = planItinerary(preset.stops);
  check(`${preset.id} plans`, Boolean(plan));
  if (!plan) continue;
  check(
    `  ${preset.id}: legs join end to end`,
    plan.legs.every(
      (leg, i) => i === 0 || plan.legs[i - 1].destination.slug === leg.origin.slug,
    ),
  );
  check(
    `  ${preset.id}: costs more than a day's driving and less than a house`,
    plan.chauffeured.price > 5000 && plan.chauffeured.price < 200000,
    `N$${plan.chauffeured.price}`,
  );
  check(
    `  ${preset.id}: longer trips cost more per trip but the driver is paid per day`,
    plan.chauffeured.driverCost === plan.days * 800 + plan.nights * 450,
  );
}

/* --------------------------------------------------------- refusals */

console.log("\nwhat it refuses");

check("a single stop is not a trip", planItinerary([{ slug: "windhoek", nights: 2 }]) === null);
check("nothing is not a trip", planItinerary([]) === null);
check(
  "an unknown place is refused rather than guessed",
  planItinerary([
    { slug: "windhoek", nights: 0 },
    { slug: "atlantis", nights: 2 },
  ]) === null,
);
check(
  "a longer stay at one place is a stay, not a drive",
  (() => {
    const plan = planItinerary([
      { slug: "hosea-kutako", nights: 0 },
      { slug: "swakopmund", nights: 2 },
      { slug: "swakopmund", nights: 2 },
      { slug: "windhoek", nights: 0 },
    ]);
    return plan !== null && plan.legs.length === 2 && plan.nights === 4;
  })(),
);
check(
  "negative nights are not a discount",
  (() => {
    const plan = planItinerary([
      { slug: "windhoek", nights: 0 },
      { slug: "swakopmund", nights: -5 },
    ]);
    return plan !== null && plan.nights === 0;
  })(),
);

/* ------------------------------------------------- the comparison holds */

console.log("\nthe comparison behaves");

const longer = planItinerary([
  { slug: "hosea-kutako", nights: 0 },
  { slug: "sossusvlei", nights: 4 },
  { slug: "windhoek", nights: 0 },
])!;
const shorter = planItinerary([
  { slug: "hosea-kutako", nights: 0 },
  { slug: "sossusvlei", nights: 1 },
  { slug: "windhoek", nights: 0 },
])!;
check(
  "more nights cost more, both ways",
  longer.chauffeured.price > shorter.chauffeured.price &&
    selfDriveCost(longer, { dayRate: 2445, fuelPerKm: 2.3, waiverPerDay: WAIVER_PER_DAY }).total >
      selfDriveCost(shorter, { dayRate: 2445, fuelPerKm: 2.3, waiverPerDay: WAIVER_PER_DAY }).total,
);
check(
  "the traveller's own quote is what gets compared",
  selfDriveCost(classic, { dayRate: 5000, fuelPerKm: 2.3, waiverPerDay: 0 }).total >
    selfDriveCost(classic, { dayRate: 2445, fuelPerKm: 2.3, waiverPerDay: 0 }).total,
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
