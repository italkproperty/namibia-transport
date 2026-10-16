"use server";

import { revalidatePath } from "next/cache";

import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { charterVehicleCostProfiles, pricingSettings, vehicleClasses } from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";
import { withDeadline } from "@/lib/deadline";

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
async function saveCharterCostSettingsUnsafe(
  _previous: CharterSettingsSaveResult | null,
  form: FormData,
): Promise<CharterSettingsSaveResult> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Sign in to change charter cost settings." };
  if (!isDatabaseConfigured()) return { ok: false, message: "No database is configured on this deployment." };

  const fieldErrors: Record<string, string> = {};
  const margin = boundedNumber(form, "targetContributionMargin", "Target contribution margin (%)", 5, 75);
  const fee = boundedNumber(form, "paymentFeeRate", "Payment fee (%)", 0, 15);
  if ("error" in margin) fieldErrors.targetContributionMargin = margin.error;
  if ("error" in fee) fieldErrors.paymentFeeRate = fee.error;
  if (Object.keys(fieldErrors).length || "error" in margin || "error" in fee) return { ok: false, message: "Nothing was saved. Correct the highlighted fields.", fieldErrors };

  try {
    const db = getDb();
    await db.insert(pricingSettings).values({
      id: 1,
      charterTargetContributionMargin: (margin.value / 100).toFixed(3),
      charterPaymentFeeRate: (fee.value / 100).toFixed(3),
    }).onConflictDoUpdate({
      target: pricingSettings.id,
      set: {
        charterTargetContributionMargin: (margin.value / 100).toFixed(3),
        charterPaymentFeeRate: (fee.value / 100).toFixed(3),
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[charter-pricing] global settings save failed", error);
    return { ok: false, message: "The database refused the change. Confirm db/manual/RUN-ME.sql has been applied." };
  }

  revalidatePath("/admin/pricing");
  revalidatePath("/admin/quotes/charter");
  return { ok: true };
}

/** Save one vehicle profile independently so an incomplete SUV profile cannot block a Polo save (or vice versa). */
async function saveCharterVehicleCostProfileUnsafe(
  _previous: CharterSettingsSaveResult | null,
  form: FormData,
): Promise<CharterSettingsSaveResult> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Sign in to change charter vehicle costs." };
  if (!isDatabaseConfigured()) return { ok: false, message: "No database is configured on this deployment." };

  const vehicleClassId = read(form, "vehicleClassId");
  const fuelType = read(form, "fuelType");
  const consumption = boundedNumber(form, "litresPer100Km", "Fuel consumption", 2, 40);
  const fuelPrice = boundedNumber(form, "fuelPricePerLitre", "Fuel price per litre", 10, 80);
  const nonFuel = boundedNumber(form, "nonFuelRunningCostPerKm", "Non-fuel running cost per kilometre", 0, 20);
  const fieldErrors: Record<string, string> = {};
  if (!vehicleClassId) fieldErrors.vehicleClassId = "Choose a vehicle class.";
  if (fuelType !== "diesel" && fuelType !== "petrol") fieldErrors.fuelType = "Choose diesel or petrol.";
  if ("error" in consumption) fieldErrors.litresPer100Km = consumption.error;
  if ("error" in fuelPrice) fieldErrors.fuelPricePerLitre = fuelPrice.error;
  if ("error" in nonFuel) fieldErrors.nonFuelRunningCostPerKm = nonFuel.error;
  if (Object.keys(fieldErrors).length || "error" in consumption || "error" in fuelPrice || "error" in nonFuel) return { ok: false, message: "Nothing was saved. Correct the highlighted fields.", fieldErrors };

  try {
    const db = getDb();
    const [vehicle] = await db.select({ id: vehicleClasses.id }).from(vehicleClasses).where(eq(vehicleClasses.id, vehicleClassId)).limit(1);
    if (!vehicle) return { ok: false, message: "That vehicle class no longer exists. Refresh the pricing page." };
    await db.insert(charterVehicleCostProfiles).values({
      vehicleClassId,
      fuelType,
      litresPer100Km: consumption.value.toFixed(2),
      fuelPricePerLitre: fuelPrice.value.toFixed(2),
      nonFuelRunningCostPerKm: nonFuel.value.toFixed(2),
    }).onConflictDoUpdate({
      target: charterVehicleCostProfiles.vehicleClassId,
      set: {
        fuelType,
        litresPer100Km: consumption.value.toFixed(2),
        fuelPricePerLitre: fuelPrice.value.toFixed(2),
        nonFuelRunningCostPerKm: nonFuel.value.toFixed(2),
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[charter-pricing] vehicle profile save failed", error);
    return { ok: false, message: "This vehicle profile was not saved. Confirm db/manual/RUN-ME.sql has been applied." };
  }

  revalidatePath("/admin/pricing");
  revalidatePath("/admin/quotes/charter");
  return { ok: true };
}


/**
 * Keep failures at the server-action boundary. A rejected auth/database call
 * must be rendered as an inline form error rather than taking down the entire
 * admin pricing page. The deadline is shorter than the Vercel function limit.
 */
export async function saveCharterCostSettings(
  previous: CharterSettingsSaveResult | null,
  form: FormData,
): Promise<CharterSettingsSaveResult> {
  try {
    return await withDeadline("save shared charter pricing rules", 8_000, () =>
      saveCharterCostSettingsUnsafe(previous, form),
    );
  } catch (error) {
    console.error("[charter-pricing] shared settings action crashed or timed out", error);
    return {
      ok: false,
      message: "The save did not complete. The server or database did not respond in time. No successful save was confirmed; retry once, and if it repeats check the Vercel function logs.",
    };
  }
}

export async function saveCharterVehicleCostProfile(
  previous: CharterSettingsSaveResult | null,
  form: FormData,
): Promise<CharterSettingsSaveResult> {
  try {
    return await withDeadline("save charter vehicle cost profile", 8_000, () =>
      saveCharterVehicleCostProfileUnsafe(previous, form),
    );
  } catch (error) {
    console.error("[charter-pricing] vehicle profile action crashed or timed out", error);
    return {
      ok: false,
      message: "This vehicle profile was not saved. The server or database did not respond in time. No successful save was confirmed; retry once, and if it repeats check the Vercel function logs.",
    };
  }
}
