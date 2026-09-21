import "server-only";

import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings } from "@/db/schema";
import { namibianLocalToInstant } from "@/lib/booking/time";
import { PLACE_NODES } from "@/lib/network/nodes";

/**
 * The details only the traveller knows.
 *
 * A quote is raised before anyone knows what time the flight lands, which room
 * they are in, or that one of them is in a wheelchair. Asking for all of it on
 * the phone is how a quote takes twenty minutes; asking for none of it is how a
 * driver arrives at the wrong gate. So the quote page collects it afterwards,
 * from the person who actually has the answers.
 *
 * ## What this is allowed to change
 *
 * The booking link is the only thing standing between the public and this
 * action — there is no account, and a reference is guessable in principle. So
 * the rule is that anyone holding a link may edit the things a traveller would
 * know and nothing else:
 *
 *   - the pick-up time, while the trip is still ahead of us
 *   - the flight number
 *   - the exact pick-up spot, as a *detail* beside the place we priced
 *   - a note to the driver
 *
 * It cannot touch the fare, the payout, the status, the route, or the place
 * the leg was priced between. `pickup_detail` sits alongside `pickup_label`
 * rather than replacing it precisely so that a traveller correcting "which
 * gate" can never silently move the leg the price was computed for.
 *
 * The worst an attacker with a guessed reference can do is change a pick-up
 * time on somebody else's trip — visible to the operator, reversible, and
 * worth far less than making a traveller phone in their flight number.
 */

const REF_PATTERN = /^NT-[ABCDEFGHJKLMNPQRTUVWXY2346789]{6}$/;

export type DetailsResult =
  | { ok: true; groupRef: string | null }
  | { ok: false; message: string };

function text(data: FormData, key: string, max: number): string | null {
  const value = String(data.get(key) ?? "").trim();
  return value ? value.slice(0, max) : null;
}

export async function updateTripDetails(
  formData: FormData,
): Promise<DetailsResult> {
  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      message: "We cannot save that right now — please message us.",
    };
  }

  const ref = String(formData.get("ref") ?? "")
    .trim()
    .toUpperCase();
  if (!REF_PATTERN.test(ref)) {
    return { ok: false, message: "We could not find that booking." };
  }

  const db = getDb();

  const [booking] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      scheduledAt: bookings.scheduledAt,
      groupRef: bookings.groupRef,
    })
    .from(bookings)
    .where(eq(bookings.ref, ref))
    .limit(1);

  if (!booking)
    return { ok: false, message: "We could not find that booking." };
  if (booking.status === "cancelled") {
    return { ok: false, message: "That booking has been cancelled." };
  }
  if (booking.status === "completed") {
    return { ok: false, message: "That trip has already run." };
  }

  const patch: {
    pickupDetail: string | null;
    travellerNotes: string | null;
    flightNumber: string | null;
    detailsUpdatedAt: Date;
    scheduledAt?: Date;
  } = {
    pickupDetail: text(formData, "pickupDetail", 300),
    travellerNotes: text(formData, "travellerNotes", 1000),
    flightNumber: text(formData, "flightNumber", 20),
    detailsUpdatedAt: new Date(),
  };

  // The time is optional: leaving it alone keeps whatever was quoted. A date
  // is deliberately not accepted — moving a leg to another day changes what
  // the driver was scheduled for and is a conversation, not a form field.
  const time = String(formData.get("pickupTime") ?? "").trim();
  if (time) {
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return {
        ok: false,
        message: "Give the time as HH:MM, for example 09:30.",
      };
    }

    // The existing date, in Namibian terms, with the new time on it.
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Windhoek",
    }).format(booking.scheduledAt);

    try {
      const moved = namibianLocalToInstant(date, time);
      if (moved.getTime() < Date.now() - 86_400_000) {
        return { ok: false, message: "That time is in the past." };
      }
      patch.scheduledAt = moved;
    } catch {
      return { ok: false, message: "That time did not make sense." };
    }
  }

  try {
    await db.update(bookings).set(patch).where(eq(bookings.id, booking.id));
  } catch (error) {
    console.error("[booking] saving traveller details failed", error);
    return {
      ok: false,
      message:
        "We could not save that. If it keeps happening, send it to us on WhatsApp instead.",
    };
  }

  return { ok: true, groupRef: booking.groupRef };
}

/**
 * Does this leg touch an airport, and therefore want a flight number?
 *
 * Decided from the node pair, never from the labels shown on screen: a leg
 * from Hosea Kutako displayed as "Etango Ranch Guest Farm" is still a leg from
 * an airport, and asking the one traveller whose flight we most need to know
 * about for everything except their flight is exactly backwards.
 */
export function isAirportLeg(
  journeySlug: string | null,
  ...labels: string[]
): boolean {
  if (journeySlug) {
    const airports = PLACE_NODES.filter((node) => node.isAirport).map(
      (node) => node.slug,
    );
    if (airports.some((slug) => journeySlug.includes(slug))) return true;
  }

  // A hand-written quote has no node pair, so fall back to the words.
  return /airport|\bWDH\b|Hosea Kutako|Eros/i.test(labels.join(" "));
}
