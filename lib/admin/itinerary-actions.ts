"use server";

import { revalidatePath } from "next/cache";

import { getAdminGateState } from "@/lib/admin/auth";
import {
  priceItinerary,
  saveItineraryQuote,
  type ItineraryQuote,
  type QuoteStop,
} from "@/lib/admin/itinerary-quote";
import { SITE } from "@/lib/site";
import { listVehicleClasses } from "@/lib/maps";
import { getPricingConfig, profileFor } from "@/lib/pricing/settings";
import type { RunningCost } from "@/lib/pricing/cost-model";

/**
 * Pricing and saving an itinerary, both behind the admin gate.
 *
 * A server action is a public endpoint, so each one re-checks the session
 * itself. Pricing is here rather than in the browser for the same reason it is
 * everywhere else on this site: the client never computes or sends a fare, it
 * asks for one.
 */

function parseStops(raw: string): QuoteStop[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (stop): stop is { slug: string; label?: string; nights?: number } =>
          typeof stop === "object" &&
          stop !== null &&
          typeof (stop as { slug?: unknown }).slug === "string",
      )
      .map((stop) => ({
        slug: stop.slug,
        label:
          typeof stop.label === "string" ? stop.label.slice(0, 120) : undefined,
        nights: Number.isFinite(stop.nights)
          ? Math.max(0, Number(stop.nights))
          : 0,
      }));
  } catch {
    return [];
  }
}

export type PriceState =
  | { ok: true; quotes: PricedClass[] }
  | { ok: false; message: string }
  | null;

/**
 * The same itinerary, priced for one vehicle class.
 *
 * The builder used to return a single quote — the baseline — with no way to
 * say which vehicle it was for. An enquiry is almost never "what does one
 * car cost": it is two people with four bags asking what their options are,
 * and an operator who can only produce one number has to guess or go and
 * price it again. Every class comes back at once, and the one the operator
 * picks is stored on the legs, so the quote can never name a vehicle the
 * price was not computed for.
 */
export type PricedClass = {
  vehicleClassId: string;
  name: string;
  /** False when the class has no per-kilometre costs and is on the old
   *  multiplier — the figure is then an estimate of an estimate. */
  costed: boolean;
  quote: SerialisedQuote;
};

/** Only what the builder renders — an Itinerary carries node objects it does not need. */
export type SerialisedQuote = {
  total: number;
  nights: number;
  days: number;
  km: number;
  gravelKm: number;
  drivingMinutes: number;
  legs: {
    fromLabel: string;
    toLabel: string;
    km: number;
    minutes: number;
    gravelKm: number;
    price: number;
  }[];
  selfDrive: { id: string; label: string; total: number; note: string }[];
};

function serialise(quote: ItineraryQuote): SerialisedQuote {
  return {
    total: quote.total,
    nights: quote.nights,
    days: quote.days,
    km: quote.km,
    gravelKm: quote.itinerary.gravelKm,
    drivingMinutes: quote.drivingMinutes,
    legs: quote.legs.map((leg) => ({
      fromLabel: leg.fromLabel,
      toLabel: leg.toLabel,
      km: leg.km,
      minutes: leg.minutes,
      gravelKm: leg.gravelKm,
      price: leg.price,
    })),
    selfDrive: quote.selfDrive,
  };
}

export async function priceItineraryAction(
  _previous: PriceState,
  formData: FormData,
): Promise<PriceState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") {
    return { ok: false, message: "Sign in first." };
  }

  const stops = parseStops(String(formData.get("stops") ?? "[]"));
  if (stops.length < 2) {
    return { ok: false, message: "An itinerary needs at least two stops." };
  }

  const [config, classes] = await Promise.all([
    getPricingConfig(),
    listVehicleClasses(),
  ]);

  const quotes: PricedClass[] = [];
  for (const vehicleClass of classes) {
    const profile = profileFor(config, vehicleClass.slug);
    const quote = priceItinerary(stops, profile.runningCost);
    if (!quote) continue;
    quotes.push({
      vehicleClassId: vehicleClass.id,
      name: vehicleClass.name,
      costed: config.stored && config.profiles.has(vehicleClass.slug),
      quote: serialise(quote),
    });
  }

  if (quotes.length === 0) {
    // Either the pair has no road, or the vehicle catalogue is unseeded. Say
    // which, because the remedies are nothing alike.
    const baseline = priceItinerary(stops);
    return {
      ok: false,
      message: baseline
        ? "No vehicle classes are seeded, so there is nothing to price this in. Run `npm run db:seed`."
        : "No road between two consecutive stops — or the same place twice in a row with no nights between.",
    };
  }

  return { ok: true, quotes };
}

export type SaveState =
  | { ok: true; url: string; groupRef: string; legCount: number; total: number }
  | { ok: false; message: string }
  | null;

export async function saveItineraryAction(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") {
    return { ok: false, message: "Sign in first." };
  }

  const field = (key: string) => String(formData.get(key) ?? "").trim();

  const fullName = field("fullName");
  const whatsapp = field("whatsapp");
  const email = field("email");
  if (!fullName) return { ok: false, message: "The traveller needs a name." };
  // One channel, not a specific one — the same rule the rest of the booking
  // path follows. Demanding WhatsApp here refused enquiries from travellers
  // who sent a foreign mobile and an email address.
  if (!whatsapp && !email) {
    return {
      ok: false,
      message:
        "Give a WhatsApp number or an email address — one of the two, so the quote can reach them.",
    };
  }

  const stops = parseStops(field("stops"));
  if (stops.length < 2) {
    return { ok: false, message: "An itinerary needs at least two stops." };
  }

  const startDate = field("startDate");
  const startTime = field("startTime") || "08:00";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false, message: "Give the date the first leg departs." };
  }

  const agreedRaw = field("agreedTotal").replace(/[\s,]/g, "");
  const agreedTotal = agreedRaw ? Number(agreedRaw) : undefined;
  if (agreedRaw && (!Number.isFinite(agreedTotal) || (agreedTotal ?? 0) <= 0)) {
    return { ok: false, message: "The agreed total must be an amount." };
  }

  /**
   * Price the saved legs with the same class the operator was shown, not the
   * baseline. Without this the quote on screen and the quote in the database
   * are two different numbers whenever anything but the first class is chosen
   * — which is the whole point of offering a choice.
   */
  const vehicleClassId = field("vehicleClassId") || null;
  let runningCost: RunningCost | undefined;
  if (vehicleClassId) {
    const [config, classes] = await Promise.all([
      getPricingConfig(),
      listVehicleClasses(),
    ]);
    const chosen = classes.find((c) => c.id === vehicleClassId);
    if (!chosen) {
      return { ok: false, message: "That vehicle class no longer exists." };
    }
    runningCost = profileFor(config, chosen.slug).runningCost;
  }

  const result = await saveItineraryQuote({
    vehicleClassId,
    runningCost,
    fullName,
    whatsapp,
    email: field("email") || undefined,
    stops,
    startDate,
    startTime,
    passengers: Number(field("passengers") || "2"),
    luggageCount: Number(field("luggageCount") || "0"),
    agreedTotal,
    notes: field("notes") || undefined,
  });

  if (!result.ok) return result;

  revalidatePath("/admin/bookings");
  return {
    ok: true,
    groupRef: result.groupRef,
    legCount: result.refs.length,
    total: result.total,
    url: `${SITE.url.replace(/\/+$/, "")}/quote/${result.groupRef}`,
  };
}
