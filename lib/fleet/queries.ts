import "server-only";

import { and, asc, gte, lte, ne, or, eq, isNull } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import {
  bookings,
  dispatchAssignments,
  drivers,
  routes,
  vehicleClasses,
  vehicles,
} from "@/db/schema";
import {
  nodePairForRoute,
  parseJourneySlug,
} from "@/lib/network/journey";
import type { PlaceNode } from "@/lib/network/nodes";
import { findRoad } from "@/lib/network/roads";

import { planAssignments, type FleetPlan, type PlanDriver, type PlanJob } from "./plan";
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


/* ------------------------------------------------------ the suggested plan */

/**
 * Everything in the window nobody is on yet, and where each driver ends up
 * once their existing work is done — the two halves of the assignment
 * problem. Bookings whose places the road network cannot resolve are left
 * out: the optimiser reasons about distance, and it must not reason about a
 * distance it does not have.
 */
export async function suggestedPlan(
  window: Window,
  timelines: DriverTimeline[],
): Promise<FleetPlan> {
  const empty: FleetPlan = {
    chains: [],
    unplaced: [],
    emptyKm: 0,
    ladenKm: 0,
    placed: 0,
    greedyEmptyKm: 0,
    greedyPlaced: 0,
    savedKm: 0,
    converged: true,
  };
  if (!isDatabaseConfigured() || timelines.length === 0) return empty;

  try {
    const db = getDb();

    const rows = await db
      .select({
        id: bookings.id,
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
      .from(bookings)
      .leftJoin(routes, eq(routes.id, bookings.routeId))
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
      )
      .orderBy(asc(bookings.scheduledAt));

    const jobs: PlanJob[] = [];
    for (const row of rows) {
      const { from, to } = nodesFor(row);
      if (!from || !to) continue;
      const startsAt = new Date(row.scheduledAt);
      const minutes =
        row.durationMin && row.durationMin > 0
          ? row.durationMin
          : (findRoad(from.slug, to.slug)?.minutes ?? 60);
      jobs.push({
        bookingId: row.id,
        ref: row.ref,
        label: `${row.pickupLabel} → ${row.dropoffLabel}`,
        from,
        to,
        startsAt,
        endsAt: new Date(startsAt.getTime() + minutes * 60_000),
        passengers: row.passengers,
      });
    }

    if (jobs.length === 0) return empty;

    const seats = await db
      .select({ driverId: vehicles.driverId, seats: vehicleClasses.capacity })
      .from(vehicles)
      .innerJoin(vehicleClasses, eq(vehicleClasses.id, vehicles.vehicleClassId))
      .where(eq(vehicles.isActive, true));
    const seatsByDriver = new Map(seats.map((row) => [row.driverId, row.seats]));

    /**
     * Each driver as the optimiser needs to see them: at their base from now,
     * carrying the trips already assigned to them as fixed points. Passing the
     * committed work rather than collapsing it into a "free from" time is what
     * lets new bookings be slotted into the gaps between existing ones — a
     * driver with a job on Thursday and another on Saturday is free on Friday.
     */
    const now = new Date();
    const floor = new Date(Math.max(now.getTime(), window.from.getTime()));
    const planDrivers: PlanDriver[] = timelines.map((timeline) => ({
      id: timeline.driverId,
      fullName: timeline.driverName,
      at: timeline.base,
      base: timeline.base,
      freeFrom: floor,
      seats: seatsByDriver.get(timeline.driverId) ?? null,
      committed: timeline.segments
        .filter((segment) => segment.kind === "trip")
        .flatMap((segment) =>
          segment.kind === "trip" && segment.from && segment.to
            ? [
                {
                  bookingId: segment.bookingId,
                  ref: segment.ref,
                  label: segment.customerName,
                  from: segment.from,
                  to: segment.to,
                  startsAt: segment.startsAt,
                  endsAt: segment.endsAt,
                  passengers: segment.passengers,
                },
              ]
            : [],
        ),
    }));

    return planAssignments(jobs, planDrivers);
  } catch (error) {
    console.error("[fleet] could not build a suggested plan", error);
    return empty;
  }
}
