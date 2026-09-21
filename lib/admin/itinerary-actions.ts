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
  | { ok: true; quote: SerialisedQuote }
  | { ok: false; message: string }
  | null;

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

  const quote = priceItinerary(stops);
  if (!quote) {
    return {
      ok: false,
      message:
        "No road between two consecutive stops — or the same place twice in a row with no nights between.",
    };
  }

  return { ok: true, quote: serialise(quote) };
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
  if (!fullName) return { ok: false, message: "The traveller needs a name." };
  if (!whatsapp) {
    return {
      ok: false,
      message:
        "A WhatsApp number is required — it is how the quote reaches them.",
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

  const result = await saveItineraryQuote({
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
