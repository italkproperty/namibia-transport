import type { PricingConstants } from "./cost-model";

/**
 * The bands every pricing number has to fall inside.
 *
 * Deliberately apart from `settings.ts`, which is `server-only` because it
 * reads the database. The admin form is a client component and needs the same
 * bands — the browser should refuse a tenfold typo before a round trip, and
 * the server must refuse it again because a Server Action is a public
 * endpoint. Two copies of a band is how they drift, so there is one, here,
 * importable from both sides. Exactly the split `lib/currency.ts` and
 * `lib/currency-rates.ts` already use, and for the same reason.
 *
 * ## Why bands at all
 *
 * One number here multiplies 2,352 journeys. A running cost typed as 38
 * instead of 3.8 does not throw, does not look wrong in a form field, and
 * quietly quotes the entire country at ten times its price — and the only
 * person who finds out is a traveller who books with somebody else. Every
 * band below is wide enough to be uncontroversial and narrow enough to catch
 * a misplaced decimal, which is the actual failure mode.
 */

export type Bound = {
  key: keyof PricingConstants;
  label: string;
  /** What this number means in the fare, in one line an operator can check. */
  meaning: string;
  unit: string;
  min: number;
  max: number;
  step: number;
};

export const CONSTANT_BOUNDS: Bound[] = [
  {
    key: "driverHourly",
    label: "Driver hourly",
    meaning:
      "What an hour behind the wheel has to be worth for a driver to take the job. Multiplied by the whole duty, both directions.",
    unit: "N$/hour",
    min: 40,
    max: 600,
    step: 5,
  },
  {
    key: "sameDayLimitHours",
    label: "Same-day limit",
    meaning:
      "A round trip longer than this needs a bed. Lowering it puts more journeys into an overnight and raises long fares sharply.",
    unit: "hours",
    min: 6,
    max: 16,
    step: 0.5,
  },
  {
    key: "overnightAllowance",
    label: "Overnight allowance",
    meaning:
      "What a night away costs the driver. The same bed whatever vehicle is parked outside it, so it never varies by class.",
    unit: "N$/night",
    min: 150,
    max: 2500,
    step: 50,
  },
  {
    key: "handlingHours",
    label: "Handling",
    meaning:
      "Loading, greeting and handover at both ends. Real hours, so real money — this is most of the airport fare.",
    unit: "hours",
    min: 0,
    max: 4,
    step: 0.25,
  },
  {
    key: "contributionRate",
    label: "Our share",
    meaning:
      "The share of every fare we keep. The driver gets the rest. Raising it raises the fare rather than lowering the payout.",
    unit: "fraction",
    min: 0.05,
    max: 0.6,
    step: 0.01,
  },
  {
    key: "priceStep",
    label: "Rounding step",
    meaning:
      "Fares are published in round money. Always rounded up: rounding down can leave a payout short of what the drive costs.",
    unit: "N$",
    min: 1,
    max: 500,
    step: 1,
  },
];

/** Per-vehicle-class bounds. The only dimension a class is allowed to move. */
export const CLASS_BOUNDS = {
  runningCostTar: { label: "Running cost, tar", unit: "N$/km", min: 1, max: 30, step: 0.05 },
  runningCostGravel: { label: "Running cost, gravel", unit: "N$/km", min: 1, max: 40, step: 0.05 },
  minimumDriverNeed: { label: "Minimum turn-out", unit: "N$", min: 100, max: 5000, step: 5 },
} as const;

export type FieldError = { field: string; message: string };

/**
 * Checks one number against its band.
 *
 * Returns the reason rather than a boolean: an operator who is told "invalid"
 * will try the same number again, and an operator who is told the band will
 * spot their own decimal point.
 */
export function checkBound(
  field: string,
  label: string,
  raw: unknown,
  bound: { min: number; max: number; unit: string },
): { value: number } | { error: FieldError } {
  const value = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());

  if (!Number.isFinite(value)) {
    return { error: { field, message: `${label} must be a number.` } };
  }
  if (value < bound.min || value > bound.max) {
    return {
      error: {
        field,
        message: `${label} must be between ${bound.min} and ${bound.max} ${bound.unit}. A misplaced decimal here reprices every journey in the country.`,
      },
    };
  }
  return { value };
}

