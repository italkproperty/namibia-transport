import "server-only";


import { getDb, isDatabaseConfigured } from "@/db";
import { bookings } from "@/db/schema";
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
import { resolveCustomer } from "@/lib/booking/customer";
import type { RunningCost } from "@/lib/pricing/cost-model";

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
  /** Index into the caller's `stops` this leg departs from. */
  fromStop: number;
  /** Index into the caller's `stops` this leg arrives at. */
  toStop: number;
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
export function priceItinerary(
  stops: QuoteStop[],
  runningCost?: RunningCost,
): ItineraryQuote | null {
  const itinerary = planItinerary(
    stops.map((stop) => ({ slug: stop.slug, nights: stop.nights })),
    runningCost,
  );
  if (!itinerary) return null;

  const labelFor = (slug: string, stopIndex: number): string => {
    const stop = stops[stopIndex];
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

    // Which stops this leg actually runs between — not `index` and `index + 1`,
    // because a pair of stops at the same place produces no leg at all.
    const { from: fromStop, to: toStop } = itinerary.legStops[index];

    legs.push({
      fromSlug: leg.origin.slug,
      toSlug: leg.destination.slug,
      fromLabel: labelFor(leg.origin.slug, fromStop),
      toLabel: labelFor(leg.destination.slug, toStop),
      fromStop,
      toStop,
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
  /**
   * The vehicle the fare was computed for. Stored on every leg, because a
   * quote naming one class beside a price computed for another is exactly the
   * confusion this engine exists to remove.
   */
  vehicleClassId?: string | null;
  /** That class's per-kilometre costs, so the saved total matches the quoted one. */
  runningCost?: RunningCost;
  notes?: string;
};

export type SaveResult =
  | { ok: true; groupRef: string; refs: string[]; total: number }
  | { ok: false; message: string };

/** `NT-G-XXXXXX`, so a group reference is never mistaken for a booking's. */
function generateGroupRef(): string {
  return generateBookingRef().replace("NT-", "NT-G-");
}

/**
 * Minutes after the first departure that leg `index` leaves.
 *
 * Not the leg index times a day. A stop with no nights is a lunch stop, not an
 * overnight, so it adds no day — the party drives on the same afternoon, which
 * is how "Solitaire for the apple pie, then Sesriem before the gate shuts"
 * actually runs, and is also what the pricing assumes (`days = nights + 1`).
 * And two stops at the same place produce no leg at all, so their nights would
 * otherwise go uncounted and the whole back half of the trip would be
 * scheduled early.
 *
 * So: every stop between where the previous leg arrived and where this one
 * departs contributes its nights. Legs sharing a day are spaced by the driving
 * time of the ones before them plus an hour on the ground, so dispatch never
 * sees one car in two places at once.
 */
const GROUND_TIME_MIN = 60;

export function departureOffset(
  stops: QuoteStop[],
  legs: PricedLeg[],
  index: number,
): number {
  let minutes = 0;
  for (let i = 0; i < index; i += 1) {
    let nights = 0;
    // Normally one stop; more when same-place stops were collapsed into a stay.
    for (let stop = legs[i].toStop; stop <= legs[i + 1].fromStop; stop += 1) {
      nights += Math.max(0, Math.floor(stops[stop]?.nights ?? 0));
    }
    minutes += nights > 0
      ? // Sleeping resets the clock: the next leg leaves at the same hour, n
        // days later, rather than drifting later and later down the itinerary.
        nights * 1440 - (minutes % 1440)
      : legs[i].minutes + GROUND_TIME_MIN;
  }
  return minutes;
}

export async function saveItineraryQuote(
  input: SaveItineraryInput,
): Promise<SaveResult> {
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "No database is configured." };
  }

  const quote = priceItinerary(input.stops, input.runningCost);
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
  const groupRef = generateGroupRef();
  const start = namibianLocalToInstant(input.startDate, input.startTime);

  try {
    // One transaction for the whole trip. A quote is only ever true as a whole:
    // legs that survived a failure halfway through would be separately payable,
    // and the quote page would total them and tell the traveller a smaller
    // number than the one they agreed.
    const refs = await db.transaction(async (tx) => {
      const { customer } = await resolveCustomer(tx, {
        fullName: input.fullName,
        whatsapp: input.whatsapp || null,
        email: input.email || null,
      });

      const saved: string[] = [];
      let allocated = 0;

      for (const [index, leg] of quote.legs.entries()) {
        const isLast = index === quote.legs.length - 1;
        const price = isLast ? total - allocated : Math.round(leg.price * scale);
        allocated += price;

        const payout = Math.round(price * (quote.totalPayout / quote.total));

        const departure = new Date(
          start.getTime() +
            departureOffset(input.stops, quote.legs, index) * 60_000,
        );

        let row;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          try {
            [row] = await tx
              .insert(bookings)
              .values({
                ref: generateBookingRef(),
                groupRef,
                customerId: customer.id,
                vehicleClassId: input.vehicleClassId ?? null,
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

        if (!row) throw new Error("Could not allocate a booking reference.");
        saved.push(row.ref);
      }

      return saved;
    });

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
