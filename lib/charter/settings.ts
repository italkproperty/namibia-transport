import "server-only";

import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { READ_DEADLINE_MS, withDeadline } from "@/lib/deadline";
import { charterVehicleCostProfiles, pricingSettings } from "@/db/schema";

export type CharterVehicleCostProfile = {
  vehicleClassId: string;
  fuelType: "diesel" | "petrol";
  litresPer100Km: number;
  fuelPricePerLitre: number;
  nonFuelRunningCostPerKm: number;
};

export type CharterCostSettings = {
  stored: boolean;
  targetContributionMargin: number;
  paymentFeeRate: number;
  profiles: CharterVehicleCostProfile[];
};

/**
 * Separate from the legacy fare settings. Missing charter configuration must
 * not change or block the current public transfer prices.
 */
export async function getCharterCostSettings(): Promise<CharterCostSettings> {
  const fallback: CharterCostSettings = {
    stored: false,
    targetContributionMargin: 0.25,
    paymentFeeRate: 0.048,
    profiles: [],
  };
  if (!isDatabaseConfigured()) return fallback;

  try {
    const db = getDb();
    const [settings, rows] = await withDeadline(
      "charter cost settings",
      READ_DEADLINE_MS,
      () =>
        Promise.all([
          db.select({
            targetContributionMargin: pricingSettings.charterTargetContributionMargin,
            paymentFeeRate: pricingSettings.charterPaymentFeeRate,
          }).from(pricingSettings).where(eq(pricingSettings.id, 1)).limit(1),
          db.select().from(charterVehicleCostProfiles),
        ]),
    );
    const row = settings[0];
    return {
      stored: Boolean(row),
      targetContributionMargin: Number(row?.targetContributionMargin ?? fallback.targetContributionMargin),
      paymentFeeRate: Number(row?.paymentFeeRate ?? fallback.paymentFeeRate),
      profiles: rows.flatMap((profile) => {
        if (profile.fuelType !== "diesel" && profile.fuelType !== "petrol") return [];
        return [{
          vehicleClassId: profile.vehicleClassId,
          fuelType: profile.fuelType,
          litresPer100Km: Number(profile.litresPer100Km),
          fuelPricePerLitre: Number(profile.fuelPricePerLitre),
          nonFuelRunningCostPerKm: Number(profile.nonFuelRunningCostPerKm),
        }];
      }),
    };
  } catch (error) {
    // The public pricing engine remains independent if the additive migration
    // has not been applied or the charter settings query stalls.
    console.warn("[charter-pricing] configuration unavailable; using safe defaults", error);
    return fallback;
  }
}
