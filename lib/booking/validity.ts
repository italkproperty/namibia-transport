/**
 * When a quote stops being a quote.
 *
 * Every unpaid booking is a live price at a public URL, and nothing was
 * expiring them. A link sent in September could be opened in December and
 * paid at September's fare — after fuel, driver rates and the season had all
 * moved — and the first anyone would know is a transfer arriving for a trip
 * that now costs more to run than it earns.
 *
 * Two independent reasons a quote is dead, and both are derived rather than
 * stored. A stored `expires_at` is another column to migrate, another field to
 * forget to set, and a number that can disagree with the row it sits on.
 *
 *   1. The travel date has gone. A quote for 6 October is not a quote on
 *      7 October, whatever else is true.
 *   2. It is older than the window below. Prices move; a fare quoted two
 *      months ago is a guess about a different month.
 *
 * Neither applies once it is paid. Somebody who has paid has a booking, not a
 * quote, and it does not lapse underneath them.
 */

/** How long a fare is held. Long enough to think it over, short enough that
 *  the costs behind it have not moved. */
export const QUOTE_VALID_DAYS = 45;

/** Grace after the pickup time before the link dies, so a traveller running
 *  late on the day can still open their own booking. */
const TRAVEL_GRACE_HOURS = 12;

export type Validity =
  | { expired: false }
  | { expired: true; reason: "travelled" | "lapsed"; message: string };

export function quoteValidity(booking: {
  scheduledAt: Date;
  createdAt: Date;
  status: string;
}): Validity {
  // A paid or running trip is not a quote and cannot lapse.
  if (booking.status !== "pending_payment") return { expired: false };

  const now = Date.now();

  if (booking.scheduledAt.getTime() + TRAVEL_GRACE_HOURS * 3_600_000 < now) {
    return {
      expired: true,
      reason: "travelled",
      message:
        "This quote was for a date that has passed. Message us and we will price your new dates — it takes a minute.",
    };
  }

  const ageDays = (now - booking.createdAt.getTime()) / 86_400_000;
  if (ageDays > QUOTE_VALID_DAYS) {
    return {
      expired: true,
      reason: "lapsed",
      message: `This quote is more than ${QUOTE_VALID_DAYS} days old, so the fare is no longer current. Message us and we will re-price the same trip.`,
    };
  }

  return { expired: false };
}

/** The soonest a group of legs lapses — a trip is only as live as its first leg. */
export function groupValidity(
  legs: { scheduledAt: Date; createdAt: Date; status: string }[],
): Validity {
  for (const leg of legs) {
    const validity = quoteValidity(leg);
    if (validity.expired) return validity;
  }
  return { expired: false };
}
