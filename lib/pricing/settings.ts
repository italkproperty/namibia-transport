import "server-only";

import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { pricingSettings, vehicleClasses } from "@/db/schema";
import { READ_DEADLINE_MS, withDeadline } from "@/lib/deadline";
import {
  BASELINE_PROFILE,
  DEFAULT_CONSTANTS,
  DEFAULT_MINIMUM_DRIVER_NEED,
  DEFAULT_RUNNING_COST,
  type PricingConstants,
  type VehicleCostProfile,
} from "./cost-model";

/**
 * The cost constants, as the operator sets them.
 *
 * These were literals in a source file, which meant that diesel going up was a
 * code change and a deploy. They now live in one row of `pricing_settings`,
 * with the literals as the fallback so a database that has never been written
 * to prices exactly as before.
 *
 * ## Bounds are the whole point
 *
 * One number here multiplies 2,352 journeys. A running cost typed as 38
 * instead of 3.8 does not throw, does not look wrong in a form field, and
 * quietly quotes every route in the country at ten times its price — and the
 * only person who finds out is a traveller who goes somewhere else. The FX
 * rates already learned this lesson (`lib/currency-rates.ts`); the same
 * discipline applies here, with one difference: a rejected rate hides a
 * conversion, a rejected cost would hide a fare. So a value outside its band
 * is refused *at the form*, before it is stored, rather than ignored at read
 * time — an operator must never be able to save a number the site will then
 * decline to use.
 *
 * Every bound below is wide enough to be uncontroversial and narrow enough to
 * catch a misplaced decimal, which is the actual failure mode.
 */

export {
  CONSTANT_BOUNDS,
  CLASS_BOUNDS,
  checkBound,
  type Bound,
  type FieldError,
} from "./bounds";

/* ------------------------------------------------------------- reading */

export type PricingConfig = {
  constants: PricingConstants;
  profiles: Map<string, VehicleCostProfile>;
  /** False when nothing has been saved and the built-in defaults are in use. */
  stored: boolean;
  updatedAt: Date | null;
};

function profileFromRow(row: {
  slug: string;
  runningCostTar: string | null;
  runningCostGravel: string | null;
  minimumDriverNeed: string | null;
  priceMultiplier: string;
}): VehicleCostProfile {
  // Falling back through the multiplier keeps a class that has never been
  // given per-kilometre costs priced roughly where it was, rather than
  // silently dropping to the baseline the moment this ships. It is a bridge,
  // not a model: the admin page marks such a class as not yet costed.
  const multiplier = Number(row.priceMultiplier) || 1;

  return {
    slug: row.slug,
    runningCost: {
      tar: Number(row.runningCostTar) || DEFAULT_RUNNING_COST.tar * multiplier,
      gravel:
        Number(row.runningCostGravel) || DEFAULT_RUNNING_COST.gravel * multiplier,
    },
    minimumDriverNeed:
      Number(row.minimumDriverNeed) || DEFAULT_MINIMUM_DRIVER_NEED * multiplier,
  };
}

/**
 * The live pricing configuration.
 *
 * Degrades to the built-in constants rather than throwing: a database that is
 * unreachable must cost us a settings screen, never the ability to quote. A
 * quote produced from the defaults is the quote the site produced last week,
 * which is a far better outcome than a page that cannot price at all.
 */
export async function getPricingConfig(): Promise<PricingConfig> {
  const fallback: PricingConfig = {
    constants: DEFAULT_CONSTANTS,
    profiles: new Map([[BASELINE_PROFILE.slug, BASELINE_PROFILE]]),
    stored: false,
    updatedAt: null,
  };

  if (!isDatabaseConfigured()) return fallback;

  try {
    const db = getDb();
    const [rows, classes] = await withDeadline(
      "pricing settings",
      READ_DEADLINE_MS,
      () =>
        Promise.all([
          db.select().from(pricingSettings).where(eq(pricingSettings.id, 1)).limit(1),
          db.select().from(vehicleClasses),
        ]),
    );

    const row = rows[0];
    const constants: PricingConstants = row
      ? {
          driverHourly: Number(row.driverHourly),
          sameDayLimitHours: Number(row.sameDayLimitHours),
          overnightAllowance: Number(row.overnightAllowance),
          handlingHours: Number(row.handlingHours),
          contributionRate: Number(row.contributionRate),
          priceStep: Number(row.priceStep),
        }
      : DEFAULT_CONSTANTS;

    const profiles = new Map<string, VehicleCostProfile>([
      [BASELINE_PROFILE.slug, BASELINE_PROFILE],
    ]);
    for (const vehicleClass of classes) {
      profiles.set(vehicleClass.slug, profileFromRow(vehicleClass));
    }

    return {
      constants,
      profiles,
      stored: Boolean(row),
      updatedAt: row?.updatedAt ?? null,
    };
  } catch (error) {
    console.error(
      "[pricing] could not read settings — quoting from built-in defaults",
      error,
    );
    return fallback;
  }
}

/** The profile for a class, or the baseline when it is unknown. */
export function profileFor(
  config: PricingConfig,
  slug: string | null | undefined,
): VehicleCostProfile {
  return (slug && config.profiles.get(slug)) || BASELINE_PROFILE;
}
