"use server";

import { getAdminGateState } from "@/lib/admin/auth";
import { searchCharterDestinations, routeCharterItinerary, type ResolvedDestination } from "@/lib/maps/charter-routing";
import { getCharterCostSettings } from "@/lib/charter/settings";
import { priceCharterItinerary } from "@/lib/charter/itinerary-costing";
import { listVehicleClasses } from "@/lib/maps";

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

export type CharterPriceState =
  | { ok: true; result: ReturnType<typeof priceCharterItinerary>; vehicleName: string }
  | { ok: false; message: string }
  | null;

function readNumber(form: FormData, key: string, label: string, max = 100000): number | null {
  const raw = String(form.get(key) ?? "").trim();
  const value = raw === "" ? 0 : Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > max) throw new Error(`${label} must be between 0 and ${max}.`);
  return value;
}

export async function priceCharterItineraryAction(_previous: CharterPriceState, form: FormData): Promise<CharterPriceState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Sign in before calculating a charter quote." };
  try {
    const stops = JSON.parse(String(form.get("stops") ?? "[]")) as ResolvedDestination[];
    if (!Array.isArray(stops) || stops.length < 2 || stops.length > 10) {
      return { ok: false, message: "Select between 2 and 10 confirmed destinations before pricing." };
    }
    for (const stop of stops) {
      if (!stop || typeof stop.label !== "string" || !stop.label.trim() ||
          !stop.coordinates || !Number.isFinite(stop.coordinates.lat) ||
          !Number.isFinite(stop.coordinates.lng) ||
          stop.coordinates.lat < -90 || stop.coordinates.lat > 90 ||
          stop.coordinates.lng < -180 || stop.coordinates.lng > 180) {
        return { ok: false, message: "One or more stops are invalid. Search and select each destination again." };
      }
    }

    const vehicleClassId = String(form.get("vehicleClassId") ?? "");
    const [settings, classes] = await Promise.all([getCharterCostSettings(), listVehicleClasses()]);
    const vehicle = classes.find((item) => item.id === vehicleClassId);
    const profile = settings.profiles.find((item) => item.vehicleClassId === vehicleClassId);
    if (!vehicle) return { ok: false, message: "Select a valid vehicle class." };
    if (!profile) return { ok: false, message: `No charter cost profile is saved for ${vehicle.name}. Go to Admin → Pricing and save its fuel and running-cost assumptions first.` };

    const route = await routeCharterItinerary(stops);
    const driverDays = readNumber(form, "driverDays", "Driver days", 365);
    const driverDailyRate = readNumber(form, "driverDailyRate", "Driver daily rate");
    const accommodationNights = readNumber(form, "accommodationNights", "Accommodation nights", 365);
    const accommodationRate = readNumber(form, "accommodationRate", "Accommodation rate");
    const parkFees = readNumber(form, "parkFees", "Park and permit fees");
    const otherCosts = readNumber(form, "otherCosts", "Other supplier costs");
    const positioningKm = readNumber(form, "positioningKm", "Empty positioning kilometres", 100000);
    const localKm = readNumber(form, "localKm", "Local excursion kilometres", 100000);

    const result = priceCharterItinerary({
      route,
      positioningKm: positioningKm!,
      localKm: localKm!,
      fuel: { fuelType: profile.fuelType, litresPer100Km: profile.litresPer100Km, pricePerLitre: profile.fuelPricePerLitre },
      nonFuelRunningCostPerKm: profile.nonFuelRunningCostPerKm,
      items: [
        { id: "driver-days", label: "Driver days", quantity: driverDays!, unitCost: driverDailyRate!, unit: "day" },
        { id: "accommodation", label: "Driver accommodation", quantity: accommodationNights!, unitCost: accommodationRate!, unit: "night" },
        { id: "park-fees", label: "Park and permit fees", quantity: 1, unitCost: parkFees!, unit: "trip" },
        { id: "other-suppliers", label: "Other supplier costs", quantity: 1, unitCost: otherCosts!, unit: "trip" },
      ],
      targetContributionMargin: settings.targetContributionMargin,
      paymentFeeRate: settings.paymentFeeRate,
    });
    return { ok: true, result, vehicleName: vehicle.name };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The charter itinerary could not be priced." };
  }
}
