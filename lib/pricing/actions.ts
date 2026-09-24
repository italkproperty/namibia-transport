"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { pricingSettings, vehicleClasses } from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";
import { CLASS_BOUNDS, CONSTANT_BOUNDS, checkBound, type FieldError } from "./settings";

/**
 * Saving the cost constants.
 *
 * Every export in a "use server" file is a public endpoint whether or not a
 * page calls it, so this re-checks the admin gate itself rather than trusting
 * that it was rendered behind one. Pricing is the highest-value write in the
 * application: an unauthenticated caller who can set the driver hourly to zero
 * can make the site quote every journey in Namibia at the rounding step.
 */

export type SaveResult =
  | { ok: true }
  | { ok: false; message: string; errors?: FieldError[] };

function numberField(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

export async function savePricingSettings(
  _prev: SaveResult | null,
  form: FormData,
): Promise<SaveResult> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") {
    return { ok: false, message: "Sign in to change pricing." };
  }

  if (!isDatabaseConfigured()) {
    return { ok: false, message: "No database is configured on this deployment." };
  }

  const errors: FieldError[] = [];
  const values: Record<string, number> = {};

  for (const bound of CONSTANT_BOUNDS) {
    const checked = checkBound(
      bound.key,
      bound.label,
      numberField(form, bound.key),
      bound,
    );
    if ("error" in checked) errors.push(checked.error);
    else values[bound.key] = checked.value;
  }

  if (errors.length > 0) {
    // Refused before storage, not ignored at read time. An operator must never
    // be able to save a number the site will then decline to use — that is a
    // setting that looks applied and is not, which is worse than a rejection.
    return { ok: false, message: "Nothing was saved.", errors };
  }

  try {
    const db = getDb();
    await db
      .insert(pricingSettings)
      .values({
        id: 1,
        driverHourly: values.driverHourly.toFixed(2),
        sameDayLimitHours: values.sameDayLimitHours.toFixed(2),
        overnightAllowance: values.overnightAllowance.toFixed(2),
        handlingHours: values.handlingHours.toFixed(2),
        contributionRate: values.contributionRate.toFixed(3),
        priceStep: values.priceStep.toFixed(2),
      })
      .onConflictDoUpdate({
        target: pricingSettings.id,
        set: {
          driverHourly: values.driverHourly.toFixed(2),
          sameDayLimitHours: values.sameDayLimitHours.toFixed(2),
          overnightAllowance: values.overnightAllowance.toFixed(2),
          handlingHours: values.handlingHours.toFixed(2),
          contributionRate: values.contributionRate.toFixed(3),
          priceStep: values.priceStep.toFixed(2),
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error("[pricing] save failed", error);
    return {
      ok: false,
      message:
        "The database refused the change, so nothing was saved. If pricing_settings does not exist yet, run db/manual/RUN-ME.sql.",
    };
  }

  revalidatePath("/admin/pricing");
  return { ok: true };
}

/** Per-kilometre costs for one vehicle class. */
export async function saveVehicleCost(
  _prev: SaveResult | null,
  form: FormData,
): Promise<SaveResult> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") {
    return { ok: false, message: "Sign in to change pricing." };
  }

  const slug = String(form.get("slug") ?? "").trim();
  if (!slug) return { ok: false, message: "No vehicle class given." };

  const errors: FieldError[] = [];
  const parsed: Record<string, number> = {};

  for (const [key, bound] of Object.entries(CLASS_BOUNDS)) {
    const checked = checkBound(key, bound.label, numberField(form, key), bound);
    if ("error" in checked) errors.push(checked.error);
    else parsed[key] = checked.value;
  }

  if (errors.length > 0) return { ok: false, message: "Nothing was saved.", errors };

  // Gravel is harder on a vehicle than tar for every vehicle ever built. A
  // gravel figure below the tar one is a transposition, and it would quietly
  // make the desert routes — the ones with the most gravel and the largest
  // fares — the cheapest per kilometre on the site.
  if (parsed.runningCostGravel < parsed.runningCostTar) {
    return {
      ok: false,
      message: "Nothing was saved.",
      errors: [
        {
          field: "runningCostGravel",
          message:
            "Gravel cannot cost less per kilometre than tar. Check the two have not been swapped — gravel is where tyres go.",
        },
      ],
    };
  }

  try {
    await getDb()
      .update(vehicleClasses)
      .set({
        runningCostTar: parsed.runningCostTar.toFixed(2),
        runningCostGravel: parsed.runningCostGravel.toFixed(2),
        minimumDriverNeed: parsed.minimumDriverNeed.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(vehicleClasses.slug, slug));
  } catch (error) {
    console.error("[pricing] class save failed", error);
    return { ok: false, message: "The database refused the change." };
  }

  revalidatePath("/admin/pricing");
  return { ok: true };
}
