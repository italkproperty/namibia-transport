"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { pricingRules, pricingSettings, routes, vehicleClasses } from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";
import { DEFAULT_CONSTANTS } from "./cost-model";
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

/**
 * Changes the customer-facing price of one published route.
 *
 * Route price is the commercial price of record. The cost model above is an
 * operating model and recommendation engine; it must not silently overwrite a
 * price the business has deliberately published.
 *
 * The payout is derived from the current contribution target so a route price
 * change cannot accidentally create a second, hidden margin decision.
 */
export async function savePublishedRoutePrice(
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

  const routeId = String(form.get("routeId") ?? "").trim();
  const rawPrice = String(form.get("price") ?? "").trim();

  if (!routeId) {
    return { ok: false, message: "No route was selected." };
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(rawPrice)) {
    return { ok: false, message: "Enter a fare as a whole Namibian dollar amount." };
  }

  const price = Number(rawPrice);
  if (!Number.isFinite(price) || !Number.isInteger(price) || price < 100 || price > 50000) {
    return {
      ok: false,
      message: "Published fares must be whole rands between N$100 and N$50,000.",
    };
  }

  try {
    const db = getDb();
    const [settings] = await db
      .select({ contributionRate: pricingSettings.contributionRate })
      .from(pricingSettings)
      .where(eq(pricingSettings.id, 1))
      .limit(1);

    const contributionRate = Number(
      settings?.contributionRate ?? DEFAULT_CONSTANTS.contributionRate,
    );

    if (
      !Number.isFinite(contributionRate) ||
      contributionRate < 0.05 ||
      contributionRate > 0.6
    ) {
      return {
        ok: false,
        message: "The pricing contribution target is invalid. Fix the pricing settings first.",
      };
    }

    const payout =
      Math.round(price * (1 - contributionRate) * 100) / 100;

    const [route] = await db
      .update(routes)
      .set({
        fixedPrice: price.toFixed(2),
        defaultDriverPayout: payout.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(routes.id, routeId))
      .returning({
        slug: routes.slug,
        fixedPrice: routes.fixedPrice,
        defaultDriverPayout: routes.defaultDriverPayout,
      });

    if (!route) {
      return { ok: false, message: "That route no longer exists." };
    }

    revalidatePath("/admin/pricing");
    revalidatePath("/");
    revalidatePath("/transfers");
    revalidatePath(`/transfers/${route.slug}`);

    return { ok: true };
  } catch (error) {
    console.error("[pricing] published route price save failed", error);
    return {
      ok: false,
      message: "The database refused the fare change, so nothing was saved.",
    };
  }
}

/** Save a route-specific vehicle price as a multiplier rule. */
async function savePublishedVehiclePriceUnsafe(
  _prev: SaveResult | null,
  form: FormData,
): Promise<SaveResult> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Sign in to change pricing." };
  if (!isDatabaseConfigured()) return { ok: false, message: "No database is configured on this deployment." };

  const routeId = String(form.get("routeId") ?? "").trim();
  const vehicleClassId = String(form.get("vehicleClassId") ?? "").trim();
  const rawPrice = String(form.get("price") ?? "").trim();

  if (!routeId || !vehicleClassId) {
    return { ok: false, message: "Choose a route and vehicle class." };
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(rawPrice)) {
    return { ok: false, message: "Enter a fare as a whole Namibian dollar amount." };
  }

  const price = Number(rawPrice);
  if (!Number.isFinite(price) || !Number.isInteger(price) || price < 100 || price > 50000) {
    return { ok: false, message: "Vehicle fares must be whole rands between N$100 and N$50,000." };
  }

  try {
    const db = getDb();
    const [route] = await db
      .select({ fixedPrice: routes.fixedPrice, defaultDriverPayout: routes.defaultDriverPayout, slug: routes.slug })
      .from(routes)
      .where(eq(routes.id, routeId))
      .limit(1);

    const [vehicleClass] = await db
      .select({ id: vehicleClasses.id, name: vehicleClasses.name })
      .from(vehicleClasses)
      .where(eq(vehicleClasses.id, vehicleClassId))
      .limit(1);

    if (!route || !vehicleClass) {
      return { ok: false, message: "That route or vehicle class no longer exists." };
    }

    const base = Number(route.fixedPrice);
    if (!Number.isFinite(base) || base <= 0) {
      return { ok: false, message: "That route has no valid baseline fare." };
    }

    const multiplier = price / base;
    if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 99.9999) {
      return { ok: false, message: "That fare cannot be represented safely." };
    }

    const storedMultiplier = Number(multiplier.toFixed(4));
    const checkPrice = Math.round(base * storedMultiplier);
    if (checkPrice !== price) {
      return {
        ok: false,
        message: "That fare cannot be represented exactly by the route pricing rule. Try a nearby whole-rand amount.",
      };
    }

    await db
      .update(pricingRules)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(pricingRules.routeId, routeId),
          eq(pricingRules.vehicleClassId, vehicleClassId),
          eq(pricingRules.ruleType, "multiplier"),
          eq(pricingRules.isActive, true),
        ),
      );

    await db.insert(pricingRules).values({
      name: `${route.slug} — ${vehicleClass.name} published fare`,
      routeId,
      vehicleClassId,
      ruleType: "multiplier",
      amount: storedMultiplier.toFixed(4),
      priority: 100,
      isActive: true,
      updatedAt: new Date(),
    });

    revalidatePath("/admin/pricing");
    revalidatePath("/");
    revalidatePath("/book");
    revalidatePath("/transfers");
    revalidatePath(`/transfers/${route.slug}`);
    return { ok: true };
  } catch (error) {
    console.error("[pricing] vehicle fare save failed", error);
    return { ok: false, message: "The database refused the vehicle fare change, so nothing was saved." };
  }
}

/** Public action boundary: a failed save must return an inline error, never crash the pricing page. */
export async function savePublishedVehiclePrice(
  prev: SaveResult | null,
  form: FormData,
): Promise<SaveResult> {
  try {
    return await savePublishedVehiclePriceUnsafe(prev, form);
  } catch (error) {
    console.error("[pricing] vehicle fare action crashed", error);
    return {
      ok: false,
      message: "The fare could not be saved because the server or database failed. No successful save was confirmed; please try again shortly.",
    };
  }
}

/** Remove a route-specific vehicle fare and return to the class multiplier. */
export async function resetPublishedVehiclePrice(
  _prev: SaveResult | null,
  form: FormData,
): Promise<SaveResult> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Sign in to change pricing." };
  if (!isDatabaseConfigured()) return { ok: false, message: "No database is configured on this deployment." };

  const routeId = String(form.get("routeId") ?? "").trim();
  const vehicleClassId = String(form.get("vehicleClassId") ?? "").trim();

  if (!routeId || !vehicleClassId) return { ok: false, message: "Choose a route and vehicle class." };

  try {
    await getDb()
      .update(pricingRules)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(pricingRules.routeId, routeId),
          eq(pricingRules.vehicleClassId, vehicleClassId),
          eq(pricingRules.ruleType, "multiplier"),
          eq(pricingRules.isActive, true),
        ),
      );

    revalidatePath("/admin/pricing");
    revalidatePath("/");
    revalidatePath("/book");
    revalidatePath("/transfers");
    return { ok: true };
  } catch (error) {
    console.error("[pricing] vehicle fare reset failed", error);
    return { ok: false, message: "The database refused the reset." };
  }
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
