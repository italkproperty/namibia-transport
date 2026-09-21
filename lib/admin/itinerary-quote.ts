import "server-only";

import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, customers } from "@/db/schema";
import { generateBookingRef } from "@/lib/booking/ref";
import { namibianLocalToInstant } from "@/lib/booking/time";
import {
  planItinerary,
  selfDriveCost,
  SELF_DRIVE_CLASSES,
  WAIVER_PER_DAY,
  type Itinerary,
} from "@/lib/network/itinerary";
import { findNode, type PlaceNode } from "@/lib/network/nodes";
import { journeySlug } from "@/lib/network/journey";

/**
 * Quoting a whole trip, not a single leg.
 *
 * The enquiries that arrive are itineraries: out to the dunes on the 6th, the
 * coast on the 9th, back to the airport on the 12th. Until now an operator
 * could quote one leg at a time and the traveller got three links and three
 * fares that did not add up to the number agreed on the phone.
 *
 * The pricing is not new — `planItinerary` already prices a multi-day driven
 * trip properly, including the days and nights the driver is away from home,
 * which is the part a per-leg sum silently loses. This wraps it in the two
 * things an operator actually needs: places that are not on the road network,
 * and a way to turn the result into bookings dispatch can run.
 *
 * ## Places the network does not know
 *
 * "Namib Desert Lodge" is not a node and never will be — there are hundreds of
 * lodges and the graph models the roads between towns. So a stop carries an
 * optional label, and is routed through the nearest node the network does
 * know. The traveller sees "Namib Desert Lodge"; the model prices Solitaire.
 * That is honest as long as the anchor is genuinely close, which is a
 * judgement the operator makes and the form asks for explicitly.
 *
 * ## One trip, several bookings
 *
 * Each leg is a separate driving job — its own car, day, driver and payout —
 * so each becomes its own booking row, and they share a `groupRef`. Dispatch
 * sees the jobs; the traveller sees one quote at `/quote/<groupRef>`.
 */

export type QuoteStop = {
  /** Node used for routing and pricing. */
  slug: string;
  /** What the traveller calls it, when that is not the node's own name. */
  label?: string;
  /** Nights spent here before moving on. */
  nights: number;
};

export type PricedLeg = {
  fromSlug: string;
  toSlug: string;
  fromLabel: string;
  toLabel: string;
  km: number;
  minutes: number;
  gravelKm: number;
  /** This leg's share of the trip price, in whole NAD. */
  price: number;
  payout: number;
};

export type ItineraryQuote = {
  itinerary: Itinerary;
  legs: PricedLeg[];
  /** What the traveller pays for the whole trip, driven. */
  total: number;
  totalPayout: number;
  nights: number;
  days: number;
  km: number;
  drivingMinutes: number;
  /** The same trip if they hired a car and drove it themselves. */
  selfDrive: { id: string; label: string; total: number; note: string }[];
};

function displayName(node: PlaceNode, label?: string): string {
  return label?.trim() || node.shortName || node.name;
}

/**
 * Prices an itinerary and splits the total across its legs.
 *
 * The split is proportional to each leg's driving time, with the rounding
 * remainder placed on the last leg so the parts sum to the quoted total
 * exactly. A traveller who adds up three bookings and gets a different number
 * from the one they agreed has been given two prices, and will believe the
 * larger one.
 */
export function priceItinerary(stops: QuoteStop[]): ItineraryQuote | null {
  const itinerary = planItinerary(
    stops.map((stop) => ({ slug: stop.slug, nights: stop.nights })),
  );
  if (!itinerary) return null;

  const labelFor = (slug: string, index: number): string => {
    const stop = stops[index];
    const node = findNode(slug);
    if (!node) return slug;
    return displayName(node, stop?.slug === slug ? stop.label : undefined);
  };

  const total = itinerary.chauffeured.price;
  const totalMinutes = itinerary.legs.reduce(
    (sum, leg) => sum + leg.minutes,
    0,
  );

  const legs: PricedLeg[] = [];
  let allocated = 0;

  itinerary.legs.forEach((leg, index) => {
    const isLast = index === itinerary.legs.length - 1;
    const share = isLast
      ? total - allocated
      : Math.round((total * leg.minutes) / Math.max(1, totalMinutes));
    allocated += share;

    legs.push({
      fromSlug: leg.origin.slug,
      toSlug: leg.destination.slug,
      fromLabel: labelFor(leg.origin.slug, index),
      toLabel: labelFor(leg.destination.slug, index + 1),
      km: leg.km,
      minutes: leg.minutes,
      gravelKm: leg.gravelKm,
      price: share,
      // The payout ratio is the trip's, so the legs reconcile to the whole.
      payout: Math.round(share * (itinerary.chauffeured.payout / total)),
    });
  });

  const selfDrive = SELF_DRIVE_CLASSES.map((klass) => ({
    id: klass.id,
    label: klass.label,
    note: klass.note,
    total: selfDriveCost(itinerary, {
      dayRate: klass.dayRate,
      fuelPerKm: klass.fuelPerKm,
      waiverPerDay: WAIVER_PER_DAY,
    }).total,
  }));

  return {
    itinerary,
    legs,
    total,
    totalPayout: itinerary.chauffeured.payout,
    nights: itinerary.nights,
    days: itinerary.days,
    km: itinerary.km,
    drivingMinutes: itinerary.drivingMinutes,
    selfDrive,
  };
}

export type SaveItineraryInput = {
  fullName: string;
  whatsapp: string;
  email?: string;
  stops: QuoteStop[];
  /** yyyy-mm-dd of the first departure. Each leg falls on the day after the
   *  previous stop's nights, which is how an itinerary actually runs. */
  startDate: string;
  /** HH:mm the first leg leaves, Namibian time. */
  startTime: string;
  passengers: number;
  luggageCount: number;
  /** Overrides the computed total when a figure was already agreed. */
  agreedTotal?: number;
  notes?: string;
};

export type SaveResult =
  | { ok: true; groupRef: string; refs: string[]; total: number }
  | { ok: false; message: string };

/** `NT-G-XXXXXX`, so a group reference is never mistaken for a booking's. */
function generateGroupRef(): string {
  return generateBookingRef().replace("NT-", "NT-G-");
}

export async function saveItineraryQuote(
  input: SaveItineraryInput,
): Promise<SaveResult> {
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "No database is configured." };
  }

  const quote = priceItinerary(input.stops);
  if (!quote) {
    return {
      ok: false,
      message:
        "That itinerary cannot be routed — check that consecutive stops are different places the network knows.",
    };
  }

  // An agreed figure overrides the model, and the legs are re-split against it
  // so the parts still sum to what the traveller was told.
  const total = input.agreedTotal ?? quote.total;
  const scale = total / quote.total;

  const db = getDb();

  try {
    const [existing] = await db
      .select()
      .from(customers)
      .where(eq(customers.whatsapp, input.whatsapp))
      .limit(1);

    const customer =
      existing ??
      (
        await db
          .insert(customers)
          .values({
            fullName: input.fullName,
            whatsapp: input.whatsapp,
            email: input.email || null,
            customerType: "tourist",
          })
          .returning()
      )[0];

    const groupRef = generateGroupRef();
    const refs: string[] = [];

    // Each leg departs the morning after the previous stop's nights are up.
    let dayOffset = 0;
    let allocated = 0;

    for (const [index, leg] of quote.legs.entries()) {
      const isLast = index === quote.legs.length - 1;
      const price = isLast ? total - allocated : Math.round(leg.price * scale);
      allocated += price;

      const payout = Math.round(price * (quote.totalPayout / quote.total));

      const departure = new Date(
        namibianLocalToInstant(input.startDate, input.startTime).getTime() +
          dayOffset * 86_400_000,
      );

      // Nights at the stop this leg arrives at push the next departure out.
      const arrivingStop = input.stops[index + 1];
      dayOffset += Math.max(1, arrivingStop?.nights ?? 1);

      let row;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          [row] = await db
            .insert(bookings)
            .values({
              ref: generateBookingRef(),
              groupRef,
              customerId: customer.id,
              journeySlug: journeySlug(leg.fromSlug, leg.toSlug),
              pickupLabel: leg.fromLabel,
              dropoffLabel: leg.toLabel,
              scheduledAt: departure,
              passengers: Math.max(1, input.passengers),
              luggageCount: Math.max(0, input.luggageCount),
              customerPrice: price.toFixed(2),
              driverPayout: payout.toFixed(2),
              contribution: (price - payout).toFixed(2),
              distanceKm: leg.km.toFixed(2),
              durationMin: leg.minutes,
              acquisitionSource: "admin-itinerary",
              status: "pending_payment",
              notes: index === 0 ? (input.notes ?? null) : null,
            })
            .returning();
          break;
        } catch (error) {
          const duplicate =
            error instanceof Error && /bookings_ref_key/.test(error.message);
          if (!duplicate || attempt === 4) throw error;
        }
      }

      if (!row)
        return { ok: false, message: "Could not allocate a reference." };
      refs.push(row.ref);
    }

    return { ok: true, groupRef, refs, total };
  } catch (error) {
    console.error("[admin] itinerary quote failed", error);
    const message = error instanceof Error ? error.message : String(error);
    // The most likely cause on a database that has not been migrated.
    if (/group_ref/.test(message)) {
      return {
        ok: false,
        message:
          "The bookings table has no group_ref column yet — run db/manual/RUN-ME.sql in Supabase, then try again.",
      };
    }
    return { ok: false, message };
  }
}
