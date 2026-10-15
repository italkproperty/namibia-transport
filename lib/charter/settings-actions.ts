"use server";

import { revalidatePath } from "next/cache";

import { getDb, isDatabaseConfigured } from "@/db";
import { charterVehicleCostProfiles, pricingSettings, vehicleClasses } from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";

export type CharterSettingsSaveResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function read(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function boundedNumber(
  form: FormData,
  key: string,
  label: string,
  min: number,
  max: number,
): { value: number } | { error: string } {
  const raw = read(form, key);
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value < min || value > max) {
    return { error: `${label} must be between ${min} and ${max}.` };
  }
  return { value };
}

/** Saves only charter-specific settings; legacy published fare settings are untouched. */
export async function saveCharterCostSettings(
  _previous: CharterSettingsSaveResult | null,
  form: FormData,
): Promise<CharterSettingsSaveResult> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") {
    return { ok: false, message: "Sign in to change charter cost settings." };
  }
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "No database is configured on this deployment." };
  }

  const fieldErrors: Record<string, string> = {};
  const margin = boundedNumber(form, "targetContributionMargin", "Target contribution margin", 0.05, 0.75);
  const fee = boundedNumber(form, "paymentFeeRate", "Payment fee rate", 0, 0.15);
  if ("error" in margin) fieldErrors.targetContributionMargin = margin.error;
  if ("error" in fee) fieldErrors.paymentFeeRate = fee.error;

  const db = getDb();
  const classes = await db.select({ id: vehicleClasses.id, name: vehicleClasses.name })
    .from(vehicleClasses).where(vehicleClasses.isActive);
  const profiles = classes.map((vehicleClass) => {
    const prefix = `profile:${vehicleClass.id}:`;
    const fuelType = read(form, `${prefix}fuelType`);
    const consumption = boundedNumber(form, `${prefix}litresPer100Km`, "Fuel consumption", 2, 40);
    const fuelPrice = boundedNumber(form, `${prefix}fuelPricePerLitre`, "Fuel price per litre", 10, 80);
    const nonFuel = boundedNumber(form, `${prefix}nonFuelRunningCostPerKm`, "Non-fuel running cost per kilometre", 0, 20);
    if (fuelType !== "diesel" && fuelType !== "petrol") {
      fieldErrors[`${prefix}fuelType`] = "Choose diesel or petrol.";
    }
    if ("error" in consumption) fieldErrors[`${prefix}litresPer100Km`] = consumption.error;
    if ("error" in fuelPrice) fieldErrors[`${prefix}fuelPricePerLitre`] = fuelPrice.error;
    if ("error" in nonFuel) fieldErrors[`${prefix}nonFuelRunningCostPerKm`] = nonFuel.error;
    return {
      vehicleClassId: vehicleClass.id,
      fuelType,
      litresPer100Km: "value" in consumption ? consumption.value : null,
      fuelPricePerLitre: "value" in fuelPrice ? fuelPrice.value : null,
      nonFuelRunningCostPerKm: "value" in nonFuel ? nonFuel.value : null,
    };
  });

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Nothing was saved. Correct the highlighted fields.", fieldErrors };
  }
  if (classes.length === 0) {
    return { ok: false, message: "No active vehicle classes were found." };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(pricingSettings).values({
        id: 1,
        charterTargetContributionMargin: margin.value.toFixed(3),
        charterPaymentFeeRate: fee.value.toFixed(3),
      }).onConflictDoUpdate({
        target: pricingSettings.id,
        set: {
          charterTargetContributionMargin: margin.value.toFixed(3),
          charterPaymentFeeRate: fee.value.toFixed(3),
          updatedAt: new Date(),
        },
      });

      for (const profile of profiles) {
        await tx.insert(charterVehicleCostProfiles).values({
          vehicleClassId: profile.vehicleClassId,
          fuelType: profile.fuelType,
          litresPer100Km: profile.litresPer100Km!.toFixed(2),
          fuelPricePerLitre: profile.fuelPricePerLitre!.toFixed(2),
          nonFuelRunningCostPerKm: profile.nonFuelRunningCostPerKm!.toFixed(2),
        }).onConflictDoUpdate({
          target: charterVehicleCostProfiles.vehicleClassId,
          set: {
            fuelType: profile.fuelType,
            litresPer100Km: profile.litresPer100Km!.toFixed(2),
            fuelPricePerLitre: profile.fuelPricePerLitre!.toFixed(2),
            nonFuelRunningCostPerKm: profile.nonFuelRunningCostPerKm!.toFixed(2),
            updatedAt: new Date(),
          },
        });
      }
    });
  } catch (error) {
    console.error("[charter-pricing] save failed", error);
    return {
      ok: false,
      message: "The database refused the change. Confirm db/manual/RUN-ME.sql has been applied.",
    };
  }

  revalidatePath("/admin/pricing");
  revalidatePath("/admin/quotes/new");
  return { ok: true };
}
