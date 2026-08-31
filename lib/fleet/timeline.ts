import { findNode, type PlaceNode } from "@/lib/network/nodes";
import { findRoad } from "@/lib/network/roads";

/**
 * Where every car will be, and when.
 *
 * A booking is a commitment to have a particular car in a particular place at
 * a particular hour. Strung together in order, a driver's bookings therefore
 * describe their position through time — and, more usefully, the gaps between
 * them: the hours a paid-for car is standing somewhere with nothing to do.
 *
 * Those gaps are the thing the whole operation turns on. A car parked at
 * Swakopmund on a Tuesday costs the same as one driving, and the only way to
 * sell that Tuesday is to know it exists before somebody asks. Nothing here is
 * new data — every booking already carries a time and, since the road network,
 * a pair of places. This is the projection forward.
 *
 * It also catches the schedules that cannot physically happen. Two trips that
 * overlap, or a gap too short to drive the 350 km between them, are today
 * discovered by a driver at six in the morning. Here they are discovered when
 * the assignment is made.
 */

/** No driver starts a long day on less than this. Below it, flagged as tight. */
const MIN_REST_HOURS = 8;

/** Namibia's market, and where a driver with no recorded base is assumed to be. */
export const DEFAULT_BASE = "windhoek";

const MINUTE = 60_000;

export type CommittedLeg = {
  bookingId: string;
  ref: string;
  customerName: string;
  passengers: number;
  startsAt: Date;
  /** Snapshotted on the booking; the road is the fallback when it is null. */
  durationMin: number | null;
  /** Null when a booking's places do not resolve onto the road network. */
  from: PlaceNode | null;
  to: PlaceNode | null;
};

export type Segment =
  | {
      kind: "trip";
      startsAt: Date;
      endsAt: Date;
      from: PlaceNode | null;
      to: PlaceNode | null;
      ref: string;
      bookingId: string;
      customerName: string;
      passengers: number;
    }
  | {
      kind: "reposition";
      startsAt: Date;
      endsAt: Date;
      from: PlaceNode;
      to: PlaceNode;
      km: number;
      /** The leg this empty drive exists to reach. */
      ref: string;
    }
  | { kind: "idle"; startsAt: Date; endsAt: Date; at: PlaceNode | null };

export type Conflict = {
  kind: "overlap" | "unreachable" | "no-rest" | "unknown-place";
  /** "impossible" cannot happen at all; "tight" can, but only just. */
  severity: "impossible" | "tight";
  ref: string;
  at: Date;
  message: string;
};

export type IdleWindow = {
  driverId: string;
  driverName: string;
  at: PlaceNode;
  startsAt: Date;
  endsAt: Date;
  hours: number;
  /**
   * Where the car has to be when the waiting ends, and by when.
   *
   * This is what makes an idle window worth different amounts. A car standing
   * at Swakopmund that must be back at Swakopmund has to drive any job there
   * and back, and saves nothing. A car standing at Swakopmund that has to be
   * in Windhoek on Thursday is already going to drive those 356 km empty —
   * and anyone travelling that way rides for almost nothing.
   */
  nextAt: PlaceNode;
  dueBy: Date;
};

export type DriverTimeline = {
  driverId: string;
  driverName: string;
  base: PlaceNode;
  segments: Segment[];
  conflicts: Conflict[];
  idle: IdleWindow[];
  /** Hours committed to a trip or to repositioning, inside the window. */
  busyHours: number;
};

export type Window = { from: Date; to: Date };

/* ------------------------------------------------------------------ helpers */

const plus = (at: Date, minutes: number) => new Date(at.getTime() + minutes * MINUTE);
const hoursBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3_600_000;

/** The base a driver returns to. An unknown slug falls back rather than throws. */
export function baseNodeFor(slug: string | null | undefined): PlaceNode {
  return findNode(slug ?? DEFAULT_BASE) ?? findNode(DEFAULT_BASE)!;
}

/** How long a leg occupies the car: what was sold, or what the road says. */
function legMinutes(leg: CommittedLeg): number {
  if (leg.durationMin && leg.durationMin > 0) return leg.durationMin;
  if (leg.from && leg.to) {
    const road = findRoad(leg.from.slug, leg.to.slug);
    if (road) return road.minutes;
  }
  // An unknown trip still occupies the driver. An hour is the smallest
  // honest guess, and it is better than treating the car as instantly free.
  return 60;
}

/* ---------------------------------------------------------------- the build */

export function buildTimeline(
  driver: { id: string; fullName: string; baseNode: string | null },
  legs: CommittedLeg[],
  window: Window,
): DriverTimeline {
  const base = baseNodeFor(driver.baseNode);
  const segments: Segment[] = [];
  const conflicts: Conflict[] = [];

  const ordered = [...legs].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );

  let at: PlaceNode | null = base;
  let free = window.from;
  /**
   * When the driver last finished a trip. Rest is measured from here rather
   * than from the last kilometre driven, because an empty drive that runs
   * straight into a pickup is the same duty period, not a broken night.
   */
  let lastTripEnded: Date | null = null;

  const idleFrom = (start: Date, end: Date, where: PlaceNode | null) => {
    if (end.getTime() <= start.getTime()) return;
    segments.push({ kind: "idle", startsAt: start, endsAt: end, at: where });
  };

  for (const leg of ordered) {
    const ends = plus(leg.startsAt, legMinutes(leg));

    if (!leg.from || !leg.to) {
      conflicts.push({
        kind: "unknown-place",
        severity: "tight",
        ref: leg.ref,
        at: leg.startsAt,
        message:
          "This booking's pickup or drop-off is not a place the road network knows, so the car's position after it is a guess.",
      });
    }

    if (leg.startsAt.getTime() < free.getTime()) {
      conflicts.push({
        kind: "overlap",
        severity: "impossible",
        ref: leg.ref,
        at: leg.startsAt,
        message: `${leg.ref} starts while this driver is still on an earlier trip.`,
      });
    }

    // Getting to the pickup, if the car is not already standing there.
    let startsDrivingAt = leg.startsAt;
    if (at && leg.from && at.slug !== leg.from.slug) {
      const road = findRoad(at.slug, leg.from.slug);
      if (road) {
        const departBy = plus(leg.startsAt, -road.minutes);
        if (departBy.getTime() < free.getTime()) {
          conflicts.push({
            kind: "unreachable",
            severity: "impossible",
            ref: leg.ref,
            at: leg.startsAt,
            message: `${Math.round(road.km)} km from ${at.name} to the pickup takes ${Math.round(road.minutes / 60)}h, and there is not that much time before ${leg.ref} starts.`,
          });
        } else {
          idleFrom(free, departBy, at);
        }
        // Leaving as late as the road allows, or the moment they are free if
        // that is already too late — which is what makes the arrival, and so
        // the lateness, visible on the board.
        const departure = new Date(Math.max(free.getTime(), departBy.getTime()));
        const arrival = plus(departure, road.minutes);
        segments.push({
          kind: "reposition",
          startsAt: departure,
          endsAt: arrival,
          from: at,
          to: leg.from,
          km: road.km,
          ref: leg.ref,
        });
        startsDrivingAt = departure;
      }
    } else {
      idleFrom(free, leg.startsAt, at);
    }

    /**
     * Rest, measured from the end of the last trip to the wheel turning again.
     * A driver who finished at midnight cannot set off again at four.
     *
     * Skipped when this leg is already unreachable: the driver has no rest
     * because they are still driving to a pickup they cannot make, and two
     * alarms for one problem is how a board stops being read.
     */
    const alreadyImpossible = conflicts.some(
      (c) => c.ref === leg.ref && c.severity === "impossible",
    );
    if (lastTripEnded && !alreadyImpossible) {
      const rested = hoursBetween(lastTripEnded, startsDrivingAt);
      if (rested >= 0 && rested < MIN_REST_HOURS) {
        conflicts.push({
          kind: "no-rest",
          severity: "tight",
          ref: leg.ref,
          at: leg.startsAt,
          message: `Only ${rested.toFixed(1)}h off between the last trip and ${leg.ref}. Under ${MIN_REST_HOURS}h is a tired driver on a gravel road.`,
        });
      }
    }

    segments.push({
      kind: "trip",
      startsAt: leg.startsAt,
      endsAt: ends,
      from: leg.from,
      to: leg.to,
      ref: leg.ref,
      bookingId: leg.bookingId,
      customerName: leg.customerName,
      passengers: leg.passengers,
    });

    at = leg.to ?? at;
    free = ends.getTime() > free.getTime() ? ends : free;
    lastTripEnded = ends;
  }

  // The drive home, then standing at home for whatever is left of the window.
  if (at && at.slug !== base.slug && free.getTime() < window.to.getTime()) {
    const home = findRoad(at.slug, base.slug);
    if (home) {
      const arrives = plus(free, home.minutes);
      segments.push({
        kind: "reposition",
        startsAt: free,
        endsAt: arrives,
        from: at,
        to: base,
        km: home.km,
        ref: "home",
      });
      at = base;
      free = arrives;
    }
  }
  idleFrom(free, window.to, at);

  const clipped = segments
    .filter(
      (s) =>
        s.endsAt.getTime() > window.from.getTime() &&
        s.startsAt.getTime() < window.to.getTime(),
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const idle: IdleWindow[] = [];
  clipped.forEach((segment, index) => {
    if (segment.kind !== "idle" || segment.at === null) return;

    // What the waiting ends in decides what it is worth.
    const next = clipped[index + 1];
    let nextAt = base;
    let dueBy = window.to;
    if (next?.kind === "reposition") {
      nextAt = next.to;
      dueBy = next.endsAt;
    } else if (next?.kind === "trip" && next.from) {
      nextAt = next.from;
      dueBy = next.startsAt;
    }

    idle.push({
      driverId: driver.id,
      driverName: driver.fullName,
      at: segment.at,
      startsAt: segment.startsAt,
      endsAt: segment.endsAt,
      hours: hoursBetween(segment.startsAt, segment.endsAt),
      nextAt,
      dueBy,
    });
  });

  const busyHours = clipped
    .filter((s) => s.kind !== "idle")
    .reduce((total, s) => total + hoursBetween(s.startsAt, s.endsAt), 0);

  return {
    driverId: driver.id,
    driverName: driver.fullName,
    base,
    segments: clipped,
    conflicts,
    idle,
    busyHours,
  };
}

/**
 * Every sellable gap across the fleet, soonest first.
 *
 * `minHours` exists because not every gap is inventory: two hours at Sesriem
 * is a driver having lunch, not a car that can take anyone anywhere. Four
 * hours is the shortest window in which a real transfer can be started and
 * finished.
 */
export function idleWindows(
  timelines: DriverTimeline[],
  minHours = 4,
  /** Nothing before this is inventory. The board shows today from midnight,
      but the hours already gone are not for sale. */
  notBefore?: Date,
): IdleWindow[] {
  const floor = notBefore?.getTime() ?? -Infinity;

  return timelines
    .flatMap((t) => t.idle)
    .map((w) =>
      w.startsAt.getTime() >= floor
        ? w
        : {
            ...w,
            startsAt: new Date(floor),
            hours: hoursBetween(new Date(floor), w.endsAt),
          },
    )
    .filter((w) => w.hours >= minHours)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * The empty drives, dressed as windows so they can be priced the same way.
 *
 * These are the best inventory in the operation and they are not idle time at
 * all — a car driving 356 km from Swakopmund back to Windhoek with nobody in
 * it is already costing what it costs. Anyone travelling that way, or to
 * anywhere along that road, can be carried for the price of nothing extra.
 *
 * The window is exactly the drive: the car leaves when it leaves and has to
 * be where it is going when it gets there, so the only journeys that fit are
 * the ones that were happening anyway.
 */
export function deadheadWindows(timelines: DriverTimeline[]): IdleWindow[] {
  return timelines
    .flatMap((timeline) => {
      // A drive the board has already said cannot happen is not inventory.
      // Selling a seat on it would be selling a trip nobody is making.
      const broken = new Set(
        timeline.conflicts
          .filter((c) => c.severity === "impossible")
          .map((c) => c.ref),
      );

      return timeline.segments
        .filter(
          (segment): segment is Extract<Segment, { kind: "reposition" }> =>
            segment.kind === "reposition" && !broken.has(segment.ref),
        )
        .map((segment) => ({
          driverId: timeline.driverId,
          driverName: timeline.driverName,
          at: segment.from,
          nextAt: segment.to,
          startsAt: segment.startsAt,
          endsAt: segment.endsAt,
          hours: hoursBetween(segment.startsAt, segment.endsAt),
          dueBy: segment.endsAt,
        }));
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Idle hours grouped by place — where the standing capacity actually is. */
export function idleByPlace(
  windows: IdleWindow[],
): { at: PlaceNode; hours: number; windows: IdleWindow[] }[] {
  const map = new Map<string, { at: PlaceNode; hours: number; windows: IdleWindow[] }>();
  for (const window of windows) {
    const existing = map.get(window.at.slug);
    if (existing) {
      existing.hours += window.hours;
      existing.windows.push(window);
    } else {
      map.set(window.at.slug, {
        at: window.at,
        hours: window.hours,
        windows: [window],
      });
    }
  }
  return [...map.values()].sort((a, b) => b.hours - a.hours);
}
