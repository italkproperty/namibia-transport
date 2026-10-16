"use server";

import { randomBytes } from "node:crypto";
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
  parkFees: number;
  otherCosts: number;
};

export type CharterPriceState =
  | { ok: true; result: ReturnType<typeof priceCharterItinerary>; vehicleName: string; request: CharterDraftRequest }
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
  const storedProfile = settings.profiles.find((item) => item.vehicleClassId === request.vehicleClassId);
  const isSuv = vehicle.slug === "suv-4x4" || /suv|4x4/i.test(vehicle.name);
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
      { id: "park-fees", label: "Park and permit fees", quantity: 1, unitCost: request.parkFees, unit: "trip" },
      { id: "other-suppliers", label: "Other supplier costs", quantity: 1, unitCost: request.otherCosts, unit: "trip" },
    ],
    targetContributionMargin: settings.targetContributionMargin,
    paymentFeeRate: settings.paymentFeeRate,
  });
  return { settings, vehicle, profile, route, result };
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
      parkFees: readNumber(form, "parkFees", "Park and permit fees"),
      otherCosts: readNumber(form, "otherCosts", "Other supplier costs"),
    };
    const calculated = await calculateRequest(request);
    return { ok: true, result: calculated.result, vehicleName: calculated.vehicle.name, request };
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
    const request = JSON.parse(String(form.get("request") ?? "")) as CharterDraftRequest;
    const stops = validateStops(request?.stops);
    if (!request || typeof request.vehicleClassId !== "string") throw new Error("The quote preview is missing. Calculate the route again before saving.");
    const bounded = (name: keyof CharterDraftRequest, max: number) => {
      const value = request[name];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) throw new Error(`Invalid ${name} value. Calculate the quote again.`);
      return value;
    };
    const trustedRequest: CharterDraftRequest = {
      stops,
      vehicleClassId: request.vehicleClassId,
      positioningKm: bounded("positioningKm", 100000),
      localKm: bounded("localKm", 100000),
      driverDays: bounded("driverDays", 365),
      driverDailyRate: bounded("driverDailyRate", 100000),
      accommodationNights: bounded("accommodationNights", 365),
      accommodationRate: bounded("accommodationRate", 100000),
      parkFees: bounded("parkFees", 100000),
      otherCosts: bounded("otherCosts", 100000),
    };
    const calculated = await calculateRequest(trustedRequest);
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
