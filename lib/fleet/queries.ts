import "server-only";

import { and, asc, gte, lte, ne, or, eq, isNull } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, dispatchAssignments, drivers, routes } from "@/db/schema";
import {
  nodePairForRoute,
  parseJourneySlug,
} from "@/lib/network/journey";
import type { PlaceNode } from "@/lib/network/nodes";

import { buildTimeline, type CommittedLeg, type DriverTimeline, type Window } from "./timeline";

/**
 * The bookings that pin a car to a place and an hour.
 *
 * Cancelled bookings and cancelled assignments are excluded: a trip nobody is
 * taking does not occupy a car, and treating it as though it does would hide
 * exactly the idle window we are looking for.
 */

/** Where a booking starts and ends, on the road network. */
function nodesFor(row: {
  journeySlug: string | null;
  originLat: number | null;
  originLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
}): { from: PlaceNode | null; to: PlaceNode | null } {
  // A modelled journey names its places directly.
  const journey = parseJourneySlug(row.journeySlug ?? "");
  if (journey) return { from: journey.origin, to: journey.destination };

  // A curated route is matched to the network by its coordinates.
  const pair = nodePairForRoute({
    originLat: row.originLat,
    originLng: row.originLng,
    destinationLat: row.destinationLat,
    destinationLng: row.destinationLng,
  });
  if (pair) return { from: pair.origin, to: pair.destination };

  return { from: null, to: null };
}

export async function fleetTimelines(window: Window): Promise<DriverTimeline[]> {
  if (!isDatabaseConfigured()) return [];

  try {
    const db = getDb();

    const roster = await db
      .select({
        id: drivers.id,
        fullName: drivers.fullName,
        baseNode: drivers.baseNode,
        status: drivers.status,
      })
      .from(drivers)
      .where(or(eq(drivers.status, "active"), eq(drivers.status, "pending")))
      .orderBy(asc(drivers.fullName));

    if (roster.length === 0) return [];

    const rows = await db
      .select({
        driverId: dispatchAssignments.driverId,
        bookingId: bookings.id,
        ref: bookings.ref,
        scheduledAt: bookings.scheduledAt,
        durationMin: bookings.durationMin,
        passengers: bookings.passengers,
        journeySlug: bookings.journeySlug,
        pickupLabel: bookings.pickupLabel,
        dropoffLabel: bookings.dropoffLabel,
        originLat: routes.originLat,
        originLng: routes.originLng,
        destinationLat: routes.destinationLat,
        destinationLng: routes.destinationLng,
      })
      .from(dispatchAssignments)
      .innerJoin(bookings, eq(bookings.id, dispatchAssignments.bookingId))
      .leftJoin(routes, eq(routes.id, bookings.routeId))
      .where(
        and(
          ne(dispatchAssignments.status, "cancelled"),
          ne(bookings.status, "cancelled"),
          // A trip that started before the window can still be running inside
          // it, so reach back far enough to catch the longest drive we sell.
          gte(bookings.scheduledAt, new Date(window.from.getTime() - 36 * 3_600_000)),
          lte(bookings.scheduledAt, window.to),
        ),
      )
      .orderBy(asc(bookings.scheduledAt));

    const byDriver = new Map<string, CommittedLeg[]>();
    for (const row of rows) {
      const { from, to } = nodesFor(row);
      const leg: CommittedLeg = {
        bookingId: row.bookingId,
        ref: row.ref,
        // The board is a dispatch tool, so it shows where rather than who —
        // the label is what a driver needs and what identifies the trip.
        customerName: `${row.pickupLabel} → ${row.dropoffLabel}`,
        passengers: row.passengers,
        startsAt: new Date(row.scheduledAt),
        durationMin: row.durationMin,
        from,
        to,
      };
      const existing = byDriver.get(row.driverId);
      if (existing) existing.push(leg);
      else byDriver.set(row.driverId, [leg]);
    }

    return roster.map((driver) =>
      buildTimeline(driver, byDriver.get(driver.id) ?? [], window),
    );
  } catch (error) {
    console.error("[fleet] could not build the position calendar", error);
    return [];
  }
}

/** Bookings nobody is on yet — they are why an idle window may not be real. */
export async function unassignedCount(window: Window): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  try {
    const rows = await getDb()
      .select({ id: bookings.id })
      .from(bookings)
      .leftJoin(
        dispatchAssignments,
        and(
          eq(dispatchAssignments.bookingId, bookings.id),
          ne(dispatchAssignments.status, "cancelled"),
        ),
      )
      .where(
        and(
          isNull(dispatchAssignments.id),
          ne(bookings.status, "cancelled"),
          gte(bookings.scheduledAt, window.from),
          lte(bookings.scheduledAt, window.to),
        ),
      );
    return rows.length;
  } catch (error) {
    console.error("[fleet] could not count unassigned bookings", error);
    return 0;
  }
}
