/**
 * The cost model, and the argument it exists to settle.
 *
 * `vehicle_classes.price_multiplier` multiplied a finished fare. A fare is
 * distance × running cost + hours × driver rate + nights × a bed, and only the
 * first of those is a function of the car. Multiplying the total charged 40%
 * more for the driver's hours and 40% more for a hotel room in Otjiwarongo
 * because the vehicle outside had low range.
 *
 * Two things therefore have to hold, and neither is visible in a type:
 *
 *   The move must not have repriced anything. The baseline class must produce
 *   exactly the figures the old model produced, including the N$650 airport
 *   fare that is published and agreed.
 *
 *   A vehicle class must move the distance term and nothing else. That is the
 *   entire claim, and a regression would be invisible — prices would still
 *   look plausible, they would just be wrong in the direction of the longest
 *   and most valuable journeys.
 */
import {
  BASELINE_PROFILE,
  DEFAULT_CONSTANTS,
  effectiveMultiplier,
  modelCost,
  modelPayout,
  type PricingConstants,
  type VehicleCostProfile,
} from "@/lib/pricing/cost-model";
import { CLASS_BOUNDS, CONSTANT_BOUNDS, checkBound } from "@/lib/pricing/settings";
import { findRoad } from "@/lib/network/roads";

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

function road(from: string, to: string) {
  const found = findRoad(from, to);
  if (!found) throw new Error(`no road ${from} → ${to}`);
  return found;
}

/* ------------------------------------------------------ the published fare */

/**
 * The one price in the catalogue we are most confident in, because it is
 * advertised, agreed and paid. The model reproduces it rather than being
 * fitted around it, and if that stops being true the model is wrong — not the
 * price.
 */
console.log("the airport fare the model has to reproduce");

const airport = modelCost(road("hosea-kutako", "windhoek"));
check("Hosea Kutako to Windhoek is N$650", airport.price === 650, String(airport.price));
check(
  "and it is the turn-out floor that sets it, not the distance",
  airport.atFloor,
  `raw need ${Math.round(airport.rawDriverNeed)} vs floor ${BASELINE_PROFILE.minimumDriverNeed}`,
);
check(
  "payout and contribution reconcile to the price exactly",
  airport.payout + airport.contribution === airport.price,
  `${airport.payout} + ${airport.contribution} != ${airport.price}`,
);

/* -------------------------------------------- nothing was repriced by this */

/**
 * The figures the previous model produced, recorded here before the move.
 * A refactor of a pricing engine that changes a price is not a refactor.
 */
console.log("\nthe baseline prices did not move");

const BEFORE: [string, string, number][] = [
  ["hosea-kutako", "windhoek", 650],
  ["windhoek", "swakopmund", 3800],
  ["windhoek", "sossusvlei", 6700],
  ["windhoek", "etosha-okaukuejo", 5750],
  ["swakopmund", "sossusvlei", 7400],
];

for (const [from, to, expected] of BEFORE) {
  const now = modelCost(road(from, to)).price;
  check(`${from} → ${to} is still ${expected}`, now === expected, String(now));
}

/* ------------------------------------------- the dimension a class may move */

/**
 * THE claim. A class changes the per-kilometre running cost and its own
 * turn-out floor. It must not change the driver's hourly, the bed, or the
 * duty hours — and the test is constructed so a flat multiplier would fail it.
 */
console.log("\na vehicle class moves distance cost and nothing else");

const heavy: VehicleCostProfile = {
  slug: "heavy",
  runningCost: { tar: 5.4, gravel: 7.3 },
  minimumDriverNeed: BASELINE_PROFILE.minimumDriverNeed,
};

const longRoad = road("windhoek", "sossusvlei");
const base = modelCost(longRoad, BASELINE_PROFILE);
const big = modelCost(longRoad, heavy);

check(
  "THE RULE: the time cost is identical across classes",
  base.timeCost === big.timeCost,
  `${base.timeCost} vs ${big.timeCost}`,
);
check(
  "THE RULE: the overnight cost is identical across classes",
  base.overnightCost === big.overnightCost && base.nights === big.nights,
  `${base.overnightCost} vs ${big.overnightCost}`,
);
check(
  "duty hours do not depend on the vehicle",
  base.dutyHours === big.dutyHours,
);
check(
  "only the running cost differs, and it differs upward",
  big.runningCost > base.runningCost,
  `${Math.round(base.runningCost)} vs ${Math.round(big.runningCost)}`,
);
check(
  "the whole difference in driver need is the running cost",
  Math.abs(
    big.rawDriverNeed - base.rawDriverNeed - (big.runningCost - base.runningCost),
  ) < 0.001,
);

/**
 * The consequence that makes this worth doing: a flat multiplier is not just
 * wrong, it is wrong by an amount that varies with the journey. If the
 * effective multiplier were constant there would be no argument for any of
 * this — a single number would do.
 */
console.log("\nthe error a flat multiplier makes is not constant");

const shortMult = effectiveMultiplier(road("hosea-kutako", "windhoek"), {
  ...heavy,
  minimumDriverNeed: 640,
});
const longMult = effectiveMultiplier(longRoad, { ...heavy, minimumDriverNeed: 640 });

check(
  "THE RULE: the effective multiplier falls as the journey lengthens",
  shortMult > longMult,
  `short ${shortMult.toFixed(2)} vs long ${longMult.toFixed(2)}`,
);
check(
  "and the gap is material, not rounding",
  shortMult - longMult > 0.1,
  `${(shortMult - longMult).toFixed(2)}`,
);

/* ------------------------------------------------------------- the floor */

console.log("\nthe turn-out floor");

const scarce: VehicleCostProfile = {
  slug: "scarce",
  runningCost: BASELINE_PROFILE.runningCost,
  minimumDriverNeed: 900,
};
const floored = modelCost(road("hosea-kutako", "windhoek"), scarce);
check(
  "a scarcer vehicle may have a higher floor",
  floored.price > airport.price && floored.atFloor,
  `${floored.price}`,
);
check(
  "but the floor stops mattering once the distance exceeds it",
  !modelCost(longRoad, scarce).atFloor,
);

/* ------------------------------------------------- the constants are live */

console.log("\nthe constants are inputs, not literals");

const dearerDiesel: PricingConstants = { ...DEFAULT_CONSTANTS, driverHourly: 220 };
check(
  "doubling the driver hourly raises a long fare",
  modelCost(longRoad, BASELINE_PROFILE, dearerDiesel).price > base.price,
);
check(
  "but leaves a fare that is at its floor alone",
  modelCost(road("hosea-kutako", "windhoek"), BASELINE_PROFILE, {
    ...DEFAULT_CONSTANTS,
    driverHourly: 120,
  }).price === 650,
);

/**
 * Shortening the day puts more journeys into an overnight, which is the change
 * most likely to surprise an operator — hence the preview table.
 *
 * Etosha, not Sossusvlei: the first version of this test used Sossusvlei and
 * failed, because its 10.1 duty hours need one night at a 10-hour limit and
 * still only one at a 6-hour limit. That was the test being wrong rather than
 * the model, and it is the exact reason the preview shows six journeys of
 * different shapes: a change to this constant moves some fares violently and
 * leaves others untouched, and which is which is not obvious.
 */
const etosha = road("windhoek", "etosha-okaukuejo");
const shortDay: PricingConstants = { ...DEFAULT_CONSTANTS, sameDayLimitHours: 6 };
const sameDay = modelCost(etosha, BASELINE_PROFILE);
const overnight = modelCost(etosha, BASELINE_PROFILE, shortDay);

check(
  "a 9-hour duty is a same day at a 10-hour limit",
  sameDay.nights === 0,
  String(sameDay.nights),
);
check(
  "shortening the same-day limit adds a night and raises the fare",
  overnight.nights === 1 && overnight.price > sameDay.price,
  `${sameDay.nights}/${sameDay.price} -> ${overnight.nights}/${overnight.price}`,
);
check(
  "and leaves a journey that already needed a night where it was",
  modelCost(longRoad, BASELINE_PROFILE, shortDay).nights === base.nights,
);

check(
  "rounding is always up, so a payout is never short of the drive",
  modelCost(longRoad).price % DEFAULT_CONSTANTS.priceStep === 0 &&
    modelCost(longRoad).price >=
      modelCost(longRoad).driverNeed / (1 - DEFAULT_CONSTANTS.contributionRate),
);
check(
  "payout plus contribution equals price on every reference journey",
  BEFORE.every(([from, to]) => {
    const cost = modelCost(road(from, to));
    return (
      Math.abs(cost.payout + cost.contribution - cost.price) < 0.005 &&
      cost.payout === modelPayout(cost.price, DEFAULT_CONSTANTS.contributionRate)
    );
  }),
);

/* ---------------------------------------------------------- the guardrails */

/**
 * One number here multiplies 2,352 journeys. A running cost typed as 38
 * instead of 3.8 does not throw and does not look wrong in a form field.
 */
console.log("\nbounds catch the misplaced decimal");

const hourly = CONSTANT_BOUNDS.find((b) => b.key === "driverHourly")!;
check("a plausible driver hourly is accepted", "value" in checkBound("driverHourly", "x", 110, hourly));
check(
  "THE RULE: a tenfold typo is refused",
  "error" in checkBound("driverHourly", "x", 1100, hourly),
);
check("a tenfold typo the other way is refused", "error" in checkBound("driverHourly", "x", 11, hourly));
check("text is refused", "error" in checkBound("driverHourly", "x", "about a hundred", hourly));
check(
  "the message names the band, so an operator can spot their own decimal",
  (() => {
    const result = checkBound("driverHourly", "Driver hourly", 1100, hourly);
    return "error" in result && /between 40 and 600/.test(result.error.message);
  })(),
);
check(
  "every constant declares a band",
  CONSTANT_BOUNDS.every((b) => b.min < b.max && b.step > 0),
);
check(
  "every constant explains what it does to a fare",
  CONSTANT_BOUNDS.every((b) => b.meaning.length > 30),
);
check(
  "a running cost of 38 N$/km is refused",
  "error" in checkBound("runningCostTar", "x", 38, CLASS_BOUNDS.runningCostTar),
);
check(
  "and 3.8 is accepted",
  "value" in checkBound("runningCostTar", "x", 3.8, CLASS_BOUNDS.runningCostTar),
);

/* ------------------------------------------------- storage round trip */

/**
 * The constants survive Postgres and come back as the same numbers.
 *
 * `numeric` columns arrive as strings, and `contribution_rate` is
 * numeric(4,3) — a rate stored as 0.3 and read back as "0.300" is fine, one
 * quietly truncated to "0.30" and parsed as 0.3 is also fine, and one that
 * comes back as NaN prices every journey in the country at the rounding step.
 * That is a guarantee about rows, so it is tested against rows.
 */
async function storageChecks() {
  console.log("\nthe constants survive the database");

  if (!process.env.DATABASE_URL) {
    console.log("  -- skipped, no DATABASE_URL");
    return;
  }

  const { getDb } = await import("@/db");
  const { pricingSettings } = await import("@/db/schema");
  const { getPricingConfig } = await import("@/lib/pricing/settings");
  const { eq } = await import("drizzle-orm");

  const db = getDb();
  const [before] = await db
    .select()
    .from(pricingSettings)
    .where(eq(pricingSettings.id, 1))
    .limit(1);

  try {
    await db
      .insert(pricingSettings)
      .values({
        id: 1,
        driverHourly: "137.50",
        sameDayLimitHours: "9.50",
        overnightAllowance: "525.00",
        handlingHours: "1.25",
        contributionRate: "0.275",
        priceStep: "25.00",
      })
      .onConflictDoUpdate({
        target: pricingSettings.id,
        set: {
          driverHourly: "137.50",
          sameDayLimitHours: "9.50",
          overnightAllowance: "525.00",
          handlingHours: "1.25",
          contributionRate: "0.275",
          priceStep: "25.00",
        },
      });

    const config = await getPricingConfig();
    check("the row is found", config.stored);
    check(
      "every constant round-trips as a finite number",
      Object.values(config.constants).every(Number.isFinite),
      JSON.stringify(config.constants),
    );
    check(
      "a fractional hourly is not truncated",
      config.constants.driverHourly === 137.5,
      String(config.constants.driverHourly),
    );
    check(
      "THE RULE: a three-decimal rate survives numeric(4,3)",
      config.constants.contributionRate === 0.275,
      String(config.constants.contributionRate),
    );
    check(
      "and the stored constants actually price a journey",
      modelCost(road("windhoek", "swakopmund"), BASELINE_PROFILE, config.constants)
        .price > 0,
    );

    // The singleton is the point: two rows would be two answers to what a
    // kilometre costs, and the losing one would surface as a fare nobody
    // could reproduce.
    let refused = false;
    try {
      await db.insert(pricingSettings).values({ id: 2 as never });
    } catch {
      refused = true;
    }
    check("THE RULE: a second settings row is refused by the database", refused);
  } finally {
    if (before) {
      await db
        .update(pricingSettings)
        .set(before)
        .where(eq(pricingSettings.id, 1));
    } else {
      await db.delete(pricingSettings).where(eq(pricingSettings.id, 1));
    }
  }
}

storageChecks()
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
