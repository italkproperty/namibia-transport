"use server";

import { desc, eq } from "drizzle-orm";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb, isDatabaseConfigured } from "@/db";
import { charterQuoteVersions, charterQuotes } from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";
import { priceCharterItinerary } from "@/lib/charter/itinerary-costing";
import { getCharterCostSettings } from "@/lib/charter/settings";
import { listVehicleClasses } from "@/lib/maps";
import { routeCharterItinerary, searchCharterDestinations, type ResolvedDestination } from "@/lib/maps/charter-routing";

export type CharterSearchResult =
  | { ok: true; candidates: Awaited<ReturnType<typeof searchCharterDestinations>> }
  | { ok: false; message: string };

export async function searchCharterDestinationAction(query: string): Promise<CharterSearchResult> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Sign in to search destinations." };
  try {
    return { ok: true, candidates: await searchCharterDestinations(query) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Destination search failed." };
  }
}

export type CharterDraftRequest = {
  stops: ResolvedDestination[];
  vehicleClassId: string;
  positioningKm: number;
  localKm: number;
  driverDays: number;
  driverDailyRate: number;
  accommodationNights: number;
  accommodationRate: number;
  driverMealAllowanceDays: number;
  driverMealAllowanceRate: number;
  parkFees: number;
  otherCosts: number;
};

export type CharterPriceState =
  | { ok: true; result: ReturnType<typeof priceCharterItinerary>; vehicleName: string; request: CharterDraftRequest; signedCalculation: string }
  | { ok: false; message: string }
  | null;

export type SaveCharterDraftState =
  | { ok: true; id: string; quoteNumber: string }
  | { ok: false; message: string }
  | null;

function readNumber(form: FormData, key: string, label: string, max = 100000): number {
  const raw = String(form.get(key) ?? "").trim();
  const value = raw === "" ? 0 : Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > max) throw new Error(`${label} must be between 0 and ${max}.`);
  return value;
}

function validateStops(value: unknown): ResolvedDestination[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 10) {
    throw new Error("Select between 2 and 10 confirmed destinations before pricing.");
  }
  for (const stop of value) {
    if (!stop || typeof stop.label !== "string" || !stop.label.trim() ||
        !stop.coordinates || !Number.isFinite(stop.coordinates.lat) ||
        !Number.isFinite(stop.coordinates.lng) ||
        stop.coordinates.lat < -90 || stop.coordinates.lat > 90 ||
        stop.coordinates.lng < -180 || stop.coordinates.lng > 180 ||
        !["mapbox_geocoding", "openstreetmap_geocoding", "namibia_destination_catalog"].includes(stop.source) || typeof stop.providerId !== "string" || !stop.providerId) {
      throw new Error("One or more stops are invalid. Search and select each destination again.");
    }
  }
  return value as ResolvedDestination[];
}

async function calculateRequest(request: CharterDraftRequest) {
  const [settings, classes] = await Promise.all([getCharterCostSettings(), listVehicleClasses()]);
  const vehicle = classes.find((item) => item.id === request.vehicleClassId);
  if (!vehicle) throw new Error("Select a valid vehicle class.");
  // Emergency code-level fallback for the SUV while the pricing screen's
  // database save is unreliable. These match the values entered on the
  // operator's pricing screen (6.4 L/100 km, N$27/litre, N$0/km other costs),
  // using diesel as the selected operating assumption. No database or
  // published airport-transfer fare is changed by this fallback.
  const isSuv = vehicle.slug === "suv-4x4" || /suv|4x4/i.test(vehicle.name);
  const configuredProfile = settings.profiles.find((item) => item.vehicleClassId === request.vehicleClassId);
  // Reject obviously malformed stored fuel assumptions. A 1,991 km itinerary
  // at 38.5 L/100 km produces 767 L, which is not a credible default for this
  // SUV costing profile and inflates the customer price dramatically.
  const storedProfile = configuredProfile &&
    configuredProfile.litresPer100Km >= 3 &&
    configuredProfile.litresPer100Km <= 25 &&
    configuredProfile.fuelPricePerLitre > 0 &&
    configuredProfile.fuelPricePerLitre <= 100 &&
    configuredProfile.nonFuelRunningCostPerKm >= 0 &&
    configuredProfile.nonFuelRunningCostPerKm <= 100
      ? configuredProfile
      : null;
  const profile = storedProfile ?? (isSuv ? {
    vehicleClassId: vehicle.id,
    fuelType: "diesel" as const,
    litresPer100Km: 6.4,
    fuelPricePerLitre: 27,
    nonFuelRunningCostPerKm: 0,
  } : null);
  if (!profile) throw new Error(`No charter cost profile is saved for ${vehicle.name}. Go to Admin → Pricing and save its fuel and running-cost assumptions first.`);
  const route = await routeCharterItinerary(request.stops);
  const result = priceCharterItinerary({
    route,
    positioningKm: request.positioningKm,
    localKm: request.localKm,
    fuel: { fuelType: profile.fuelType, litresPer100Km: profile.litresPer100Km, pricePerLitre: profile.fuelPricePerLitre },
    nonFuelRunningCostPerKm: profile.nonFuelRunningCostPerKm,
    items: [
      { id: "driver-days", label: "Driver days", quantity: request.driverDays, unitCost: request.driverDailyRate, unit: "day" },
      { id: "accommodation", label: "Driver accommodation", quantity: request.accommodationNights, unitCost: request.accommodationRate, unit: "night" },
      { id: "driver-meals", label: "Driver meal allowance", quantity: request.driverMealAllowanceDays, unitCost: request.driverMealAllowanceRate, unit: "day" },
      { id: "park-fees", label: "Park and permit fees", quantity: 1, unitCost: request.parkFees, unit: "trip" },
      { id: "other-suppliers", label: "Other supplier costs", quantity: 1, unitCost: request.otherCosts, unit: "trip" },
    ],
    targetContributionMargin: settings.targetContributionMargin,
    paymentFeeRate: settings.paymentFeeRate,
  });
  return { settings, vehicle, profile, route, result };
}

type SignedCalculationPayload = {
  version: 1;
  issuedAt: number;
  request: CharterDraftRequest;
  calculated: Awaited<ReturnType<typeof calculateRequest>>;
};

function calculationSigningKey(): string {
  const key = process.env.ADMIN_PASSWORD?.trim();
  if (!key) throw new Error("Admin signing configuration is unavailable. Sign in again and retry.");
  return key;
}

/** Bind the server-verified route and cost snapshot to this admin session. */
function signCalculation(payload: SignedCalculationPayload): string {
  // Mapbox overview geometry can be large for multi-day Namibia itineraries.
  // It is useful for map display, but not needed to verify the deterministic
  // price or save the route legs. Excluding it keeps the hidden server-action
  // field comfortably below request-size limits.
  const compactPayload: SignedCalculationPayload = {
    ...payload,
    calculated: {
      ...payload.calculated,
      route: {
        ...payload.calculated.route,
        geometry: null,
        snappedWaypoints: [],
      },
    },
  };
  const encoded = Buffer.from(JSON.stringify(compactPayload)).toString("base64url");
  if (encoded.length > 80_000) {
    throw new Error("This itinerary is too large to save as one quote. Split the route into smaller sections or remove unnecessary stops.");
  }
  const signature = createHmac("sha256", calculationSigningKey()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifySignedCalculation(token: string): SignedCalculationPayload {
  if (!token || token.length > 100000) throw new Error("The quote calculation is missing or too large. Calculate the route again.");
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra) throw new Error("The quote calculation could not be verified. Calculate the route again.");
  const expected = createHmac("sha256", calculationSigningKey()).update(encoded).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(suppliedSignature, "base64url"); } catch { throw new Error("The quote calculation could not be verified. Calculate the route again."); }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("The quote calculation has changed or could not be verified. Calculate the route again.");
  }
  let payload: SignedCalculationPayload;
  try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SignedCalculationPayload; }
  catch { throw new Error("The quote calculation could not be read. Calculate the route again."); }
  if (payload.version !== 1 || !Number.isFinite(payload.issuedAt) || Date.now() - payload.issuedAt > 15 * 60 * 1000 || payload.issuedAt > Date.now() + 60_000) {
    throw new Error("This calculation has expired. Calculate the route again before saving.");
  }
  if (!payload.request || !payload.calculated?.route || !payload.calculated?.result || !payload.calculated?.vehicle || !Array.isArray(payload.request.stops)) {
    throw new Error("The verified calculation is incomplete. Calculate the route again.");
  }
  return payload;
}

export async function priceCharterItineraryAction(_previous: CharterPriceState, form: FormData): Promise<CharterPriceState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Sign in before calculating a charter quote." };
  try {
    const stops = validateStops(JSON.parse(String(form.get("stops") ?? "[]")));
    const request: CharterDraftRequest = {
      stops,
      vehicleClassId: String(form.get("vehicleClassId") ?? ""),
      positioningKm: readNumber(form, "positioningKm", "Empty positioning kilometres", 100000),
      localKm: readNumber(form, "localKm", "Local excursion kilometres", 100000),
      driverDays: readNumber(form, "driverDays", "Driver days", 365),
      driverDailyRate: readNumber(form, "driverDailyRate", "Driver daily rate"),
      accommodationNights: readNumber(form, "accommodationNights", "Accommodation nights", 365),
      accommodationRate: readNumber(form, "accommodationRate", "Accommodation rate"),
      driverMealAllowanceDays: readNumber(form, "driverMealAllowanceDays", "Driver meal-allowance days", 365),
      driverMealAllowanceRate: readNumber(form, "driverMealAllowanceRate", "Driver meal allowance per day"),
      parkFees: readNumber(form, "parkFees", "Park and permit fees"),
      otherCosts: readNumber(form, "otherCosts", "Other supplier costs"),
    };
    const calculated = await calculateRequest(request);
    const signedCalculation = signCalculation({ version: 1, issuedAt: Date.now(), request, calculated });
    return { ok: true, result: calculated.result, vehicleName: calculated.vehicle.name, request, signedCalculation };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The charter itinerary could not be priced." };
  }
}

/**
 * Saves a draft by re-running the route and deterministic pricing on the
 * server. The browser's displayed total is never trusted. Each saved draft
 * receives an immutable version-1 snapshot; no public token is issued here.
 */
export async function saveCharterQuoteDraftAction(_previous: SaveCharterDraftState, form: FormData): Promise<SaveCharterDraftState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Sign in before saving a charter quote." };
  if (!isDatabaseConfigured()) return { ok: false, message: "No database is configured on this deployment." };

  const customerName = String(form.get("customerName") ?? "").trim();
  const customerEmail = String(form.get("customerEmail") ?? "").trim();
  const customerWhatsapp = String(form.get("customerWhatsapp") ?? "").trim();
  const changeReason = String(form.get("changeReason") ?? "").trim();
  const rawAiBrief = String(form.get("aiBrief") ?? "").trim();
  let customerBrief: Record<string, unknown> | null = null;
  if (rawAiBrief) {
    if (rawAiBrief.length > 30000) return { ok: false, message: "The AI intake brief is too large to attach to this quote." };
    try {
      const parsed = JSON.parse(rawAiBrief) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid brief");
      customerBrief = parsed as Record<string, unknown>;
    } catch {
      return { ok: false, message: "The AI intake brief could not be read. Reapply it from the intake panel and try again." };
    }
  }
  if (customerName.length < 2 || customerName.length > 160) {
    return { ok: false, message: "Enter the customer's name (2–160 characters)." };
  }
  if (!customerEmail && !customerWhatsapp) {
    return { ok: false, message: "Enter at least one customer contact method: email or WhatsApp." };
  }
  if (customerEmail && (customerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))) {
    return { ok: false, message: "Enter a valid customer email address." };
  }
  if (customerWhatsapp.length > 40 || customerName.length > 160 || changeReason.length > 500) {
    return { ok: false, message: "One or more fields exceed the permitted length." };
  }

  try {
    // Reuse the signed server calculation produced by the pricing action.
    // Re-running Mapbox and configuration reads here doubled the work and
    // could exceed Vercel's server-action budget, leaving Save stuck on a 504.
    const signedCalculation = verifySignedCalculation(String(form.get("signedCalculation") ?? ""));
    const trustedRequest = signedCalculation.request;
    const calculated = signedCalculation.calculated;
    const year = new Date().getFullYear();
    const snapshot = {
      schemaVersion: 1,
      request: trustedRequest,
      route: calculated.route,
      vehicle: { id: calculated.vehicle.id, name: calculated.vehicle.name },
      vehicleCostProfile: calculated.profile,
      settings: {
        targetContributionMargin: calculated.settings.targetContributionMargin,
        paymentFeeRate: calculated.settings.paymentFeeRate,
      },
      result: calculated.result,
      requiresMarginReview: calculated.result.belowTargetMargin,
      customer: { name: customerName, email: customerEmail || null, whatsapp: customerWhatsapp || null },
      changeReason: changeReason || null,
      customerBrief,
      calculatedAt: new Date().toISOString(),
    };
    const db = getDb();
    let created: { id: string; quoteNumber: string } | undefined;
    // A quote-number uniqueness collision is rare, but retry that specific
    // conflict so an otherwise valid draft save does not fail unnecessarily.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const suffix = randomBytes(8).toString("hex").toUpperCase();
      const quoteNumber = `NT-CQ-${year}-${suffix}`;
      try {
        created = await db.transaction(async (tx) => {
          const [quote] = await tx.insert(charterQuotes).values({
            quoteNumber,
            status: "draft",
            customerName,
            customerEmail: customerEmail || null,
            customerWhatsapp: customerWhatsapp || null,
            vehicleClassId: calculated.vehicle.id,
            itinerarySnapshot: { stops: trustedRequest.stops, route: calculated.route, customerBrief },
            costSnapshot: { vehicleCostProfile: calculated.profile, costs: calculated.result.costs },
            pricingSnapshot: { settings: snapshot.settings, suggested: calculated.result.suggested, actual: calculated.result.actual },
            total: calculated.result.finalPrice.toFixed(2),
            currentVersion: 1,
          }).returning({ id: charterQuotes.id, quoteNumber: charterQuotes.quoteNumber });
          await tx.insert(charterQuoteVersions).values({
            quoteId: quote.id,
            version: 1,
            status: "draft",
            snapshot,
            total: calculated.result.finalPrice.toFixed(2),
            changeReason: changeReason || "Initial draft",
            actor: "admin",
          });
          return quote;
        });
        break;
      } catch (error) {
        const dbError = error as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
        const code = dbError.code ?? dbError.cause?.code;
        const constraint = dbError.constraint ?? dbError.cause?.constraint;
        if (code === "23505" && constraint === "charter_quotes_number_key" && attempt < 2) continue;
        throw error;
      }
    }
    if (!created) throw new Error("Could not allocate a unique charter quote number. Please try saving again.");
    revalidatePath("/admin/quotes");
    revalidatePath("/admin/quotes/charter/drafts");
    return { ok: true, id: created.id, quoteNumber: created.quoteNumber };
  } catch (error) {
    console.error("[charter-quote] draft save failed", error);
    const message = error instanceof Error ? error.message : "The charter draft could not be saved.";
    if (/charter_quotes|charter_quote_versions|relation .* does not exist/i.test(message)) {
      return { ok: false, message: "The quote tables are not in Supabase yet. Apply the updated db/manual/RUN-ME.sql migration, then try again." };
    }
    return { ok: false, message };
  }
}



export type SaveCharterCommercialPricingState = { ok: true; total: string; version: number; belowTargetMargin: boolean } | { ok: false; message: string } | null;

/**
 * Saves operator-edited customer line prices as a new immutable quote version.
 * Prices are validated and totals/margins are recomputed on the server.
 */
export async function saveCharterCommercialPricingAction(
  _previous: SaveCharterCommercialPricingState,
  form: FormData,
): Promise<SaveCharterCommercialPricingState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Sign in before editing charter prices." };
  if (!isDatabaseConfigured()) return { ok: false, message: "No database is configured on this deployment." };

  const id = String(form.get("quoteId") ?? "");
  const changeReason = String(form.get("changeReason") ?? "").trim();
  let input: unknown;
  try { input = JSON.parse(String(form.get("commercialPricing") ?? "")); }
  catch { return { ok: false, message: "The pricing lines could not be read. Refresh the draft and try again." }; }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, message: "The quote reference is invalid." };
  }
  if (changeReason.length > 500) return { ok: false, message: "The change reason must be 500 characters or fewer." };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, message: "Invalid pricing data." };

  const candidate = input as { legs?: unknown; extras?: unknown };
  if (!Array.isArray(candidate.legs) || candidate.legs.length < 1 || candidate.legs.length > 24 || !Array.isArray(candidate.extras) || candidate.extras.length > 30) {
    return { ok: false, message: "The itinerary pricing lines are invalid. Refresh the draft and try again." };
  }
  const legs: { from: string; to: string; price: number }[] = [];
  for (const [index, item] of candidate.legs.entries()) {
    if (!item || typeof item !== "object") return { ok: false, message: `Route leg ${index + 1} is invalid.` };
    const line = item as { from?: unknown; to?: unknown; price?: unknown };
    const price = Number(line.price);
    if (typeof line.from !== "string" || !line.from.trim() || typeof line.to !== "string" || !line.to.trim() || !Number.isFinite(price) || price < 0 || price > 100000000) {
      return { ok: false, message: `Enter a valid non-negative price for route leg ${index + 1}.` };
    }
    legs.push({ from: line.from.trim().slice(0, 300), to: line.to.trim().slice(0, 300), price: Math.round(price * 100) / 100 });
  }
  const extras: { id: string; label: string; quantity: number; unit: string; unitPrice: number; amount: number }[] = [];
  const seen = new Set<string>();
  for (const [index, item] of candidate.extras.entries()) {
    if (!item || typeof item !== "object") return { ok: false, message: `Additional line ${index + 1} is invalid.` };
    const line = item as { id?: unknown; label?: unknown; quantity?: unknown; unit?: unknown; unitPrice?: unknown };
    const idValue = typeof line.id === "string" ? line.id.trim() : "";
    const label = typeof line.label === "string" ? line.label.trim() : "";
    const unit = typeof line.unit === "string" ? line.unit.trim() : "";
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    if (!idValue || seen.has(idValue) || !label || label.length > 160 || !unit || unit.length > 40 ||
      !Number.isFinite(quantity) || quantity < 0 || quantity > 100000 ||
      !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000000) {
      return { ok: false, message: `Enter valid details for additional line ${index + 1}.` };
    }
    seen.add(idValue);
    extras.push({ id: idValue, label, quantity, unit, unitPrice: Math.round(unitPrice * 100) / 100, amount: Math.round(quantity * unitPrice * 100) / 100 });
  }

  const totalCents = legs.reduce((sum, line) => sum + Math.round(line.price * 100), 0) +
    extras.reduce((sum, line) => sum + Math.round(line.amount * 100), 0);
  const total = totalCents / 100;
  if (!Number.isSafeInteger(totalCents) || total <= 0 || total > 100000000) {
    return { ok: false, message: "The customer total must be greater than zero and within the supported range." };
  }

  try {
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [quote] = await tx.select().from(charterQuotes).where(eq(charterQuotes.id, id)).limit(1);
      if (!quote) throw new Error("The charter draft could not be found.");
      if (quote.status !== "draft" && quote.status !== "approved") {
        throw new Error("Only a private draft can be edited. Create a new draft revision rather than changing an issued quote.");
      }
      const [latest] = await tx.select().from(charterQuoteVersions)
        .where(eq(charterQuoteVersions.quoteId, id))
        .orderBy(desc(charterQuoteVersions.version)).limit(1);
      if (!latest) throw new Error("The saved quote version could not be found.");
      const snapshot = latest.snapshot && typeof latest.snapshot === "object" && !Array.isArray(latest.snapshot)
        ? { ...(latest.snapshot as Record<string, unknown>) } : {};
      const requestSnapshot = snapshot.request && typeof snapshot.request === "object" ? snapshot.request as Record<string, unknown> : {};
      const savedStops = Array.isArray(requestSnapshot.stops) ? requestSnapshot.stops as { label?: unknown }[] : [];
      const routeSnapshot = snapshot.route && typeof snapshot.route === "object" ? snapshot.route as Record<string, unknown> : {};
      const savedRouteLegs = Array.isArray(routeSnapshot.legs) ? routeSnapshot.legs as unknown[] : [];
      if (savedStops.length < 2 || savedRouteLegs.length !== legs.length || savedStops.length !== legs.length + 1) {
        throw new Error("The number of commercial prices must match the saved, verified itinerary. Recalculate the route before editing prices.");
      }
      for (let index = 0; index < legs.length; index += 1) {
        const from = typeof savedStops[index]?.label === "string" ? String(savedStops[index].label).trim() : "";
        const to = typeof savedStops[index + 1]?.label === "string" ? String(savedStops[index + 1].label).trim() : "";
        if (!from || !to || legs[index].from !== from || legs[index].to !== to) {
          throw new Error(`Route leg ${index + 1} does not match the saved itinerary order. Refresh the draft and try again.`);
        }
      }
      const resultSnapshot = snapshot.result && typeof snapshot.result === "object" ? snapshot.result as Record<string, unknown> : {};
      const costs = resultSnapshot.costs && typeof resultSnapshot.costs === "object" ? resultSnapshot.costs as Record<string, unknown> : {};
      const settings = snapshot.settings && typeof snapshot.settings === "object" ? snapshot.settings as Record<string, unknown> : {};
      const expectedCost = Number(costs.expectedCost);
      const feeRate = Number(settings.paymentFeeRate ?? 0);
      const marginTarget = Number(settings.targetContributionMargin ?? 0);
      if (!Number.isFinite(expectedCost) || expectedCost < 0 || !Number.isFinite(feeRate) || feeRate < 0 || feeRate > 0.3) {
        throw new Error("The saved cost assumptions are incomplete. Recalculate this quote before editing prices.");
      }
      const paymentFee = Math.round(total * feeRate * 100) / 100;
      const contribution = Math.round((total - expectedCost - paymentFee) * 100) / 100;
      const contributionMargin = total > 0 ? contribution / total : 0;
      const belowTargetMargin = contributionMargin + 1e-9 < marginTarget;
      const nextVersion = latest.version + 1;
      const commercialPricing = { currency: quote.currency, legs, extras, total: total.toFixed(2), editedAt: new Date().toISOString() };
      const nextSnapshot = {
        ...snapshot,
        commercialPricing,
        result: {
          ...resultSnapshot,
          finalPrice: total,
          actual: { paymentFee, contribution, contributionMargin },
          belowTargetMargin,
        },
        requiresMarginReview: belowTargetMargin,
        changeReason: changeReason || "Commercial line prices edited",
        calculatedAt: new Date().toISOString(),
      };
      await tx.insert(charterQuoteVersions).values({
        quoteId: id, version: nextVersion, status: quote.status, snapshot: nextSnapshot,
        total: total.toFixed(2), changeReason: changeReason || "Commercial line prices edited", actor: "admin",
      });
      await tx.update(charterQuotes).set({
        total: total.toFixed(2), currentVersion: nextVersion,
        pricingSnapshot: { ...((quote.pricingSnapshot && typeof quote.pricingSnapshot === "object" ? quote.pricingSnapshot : {}) as Record<string, unknown>), actual: { paymentFee, contribution, contributionMargin }, belowTargetMargin },
        updatedAt: new Date(),
      }).where(eq(charterQuotes.id, id));
      return { version: nextVersion, belowTargetMargin };
    });
    revalidatePath("/admin/quotes");
    revalidatePath("/admin/quotes/charter/drafts");
    revalidatePath(`/admin/quotes/charter/drafts/${id}`);
    return { ok: true, total: total.toFixed(2), version: result.version, belowTargetMargin: result.belowTargetMargin };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The quote prices could not be saved.";
    console.error("[charter-quote] commercial pricing save failed", error);
    return { ok: false, message };
  }
}

export type IssueCharterQuoteState = { ok: true; url: string; validUntil: string } | { ok: false; message: string } | null;

/** Issue a private draft as a customer-facing, revocable token link. */
export async function issueCharterQuoteAction(
  _previous: IssueCharterQuoteState,
  form: FormData,
): Promise<IssueCharterQuoteState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Sign in before issuing a charter quote." };
  if (!isDatabaseConfigured()) return { ok: false, message: "No database is configured on this deployment." };
  const id = String(form.get("quoteId") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, message: "The quote reference is invalid." };
  }
  try {
    const db = getDb();
    const [quote] = await db.select().from(charterQuotes).where(eq(charterQuotes.id, id)).limit(1);
    if (!quote) return { ok: false, message: "The charter draft could not be found." };
    if (quote.status === "paid" || quote.status === "cancelled") {
      return { ok: false, message: "A paid or cancelled quote cannot be issued again." };
    }
    const latest = await db.select().from(charterQuoteVersions)
      .where(eq(charterQuoteVersions.quoteId, id))
      .orderBy(desc(charterQuoteVersions.version)).limit(1);
    const snapshot = latest[0]?.snapshot as { requiresMarginReview?: boolean; result?: { belowTargetMargin?: boolean } } | undefined;
    if (snapshot?.requiresMarginReview || snapshot?.result?.belowTargetMargin) {
      return { ok: false, message: "This quote is below the target contribution margin. Review and correct the price before issuing it." };
    }
    const token = randomBytes(12).toString("base64url");
    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.update(charterQuotes).set({
      publicToken: token,
      status: "sent",
      issuedAt: new Date(),
      validUntil,
      updatedAt: new Date(),
    }).where(eq(charterQuotes.id, id));
    revalidatePath("/admin/quotes/charter/drafts");
    revalidatePath(`/admin/quotes/charter/drafts/${id}`);
    // Use this deployment host for preview links so a token issued against a preview database
    // is not sent to production, where that preview-only quote does not exist.
    const deploymentHost = process.env.VERCEL_URL?.trim();
    const origin = process.env.VERCEL_ENV !== "production" && deploymentHost
      ? `https://${deploymentHost}`
      : process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.namibiatransport.com";
    const cleanOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
    return { ok: true, url: `${cleanOrigin}/q/${token}`, validUntil: validUntil.toISOString() };
  } catch (error) {
    console.error("[charter-quote] issue failed", error);
    return { ok: false, message: "The quote could not be issued. No customer link was created; try again or check the server logs." };
  }
}
