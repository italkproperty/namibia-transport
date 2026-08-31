/**
 * The position calendar.
 *
 * This is the first thing we have built that tells an operator something they
 * did not type in — where a car will be on Thursday is derived, not recorded.
 * Derived facts are the ones that go wrong quietly, so the cases below are
 * mostly schedules that cannot physically happen: two trips at once, a gap too
 * short to drive 400 km, a driver given four hours' sleep. Each of those is
 * currently discovered by a driver at six in the morning.
 */
import {
  baseNodeFor,
  buildTimeline,
  idleByPlace,
  idleWindows,
  type CommittedLeg,
  type Window,
} from "@/lib/fleet/timeline";
import { findNode } from "@/lib/network/nodes";
import { findRoad } from "@/lib/network/roads";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const at = (iso: string) => new Date(iso);
const hours = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3_600_000;

const WINDOW: Window = {
  from: at("2026-09-01T00:00:00Z"),
  to: at("2026-09-08T00:00:00Z"),
};

const DRIVER = { id: "d1", fullName: "Johannes", baseNode: "windhoek" };
const COASTAL = { id: "d2", fullName: "Selma", baseNode: "swakopmund" };

function leg(
  ref: string,
  from: string | null,
  to: string | null,
  startsAt: string,
  durationMin: number | null = null,
): CommittedLeg {
  return {
    bookingId: `b-${ref}`,
    ref,
    customerName: `${from} → ${to}`,
    passengers: 2,
    startsAt: at(startsAt),
    durationMin,
    from: from ? findNode(from) : null,
    to: to ? findNode(to) : null,
  };
}

/* ------------------------------------------------------------------ bases */

console.log("\nwhere a driver lives");

check("no recorded base means Windhoek", baseNodeFor(null).slug === "windhoek");
check("an unknown base falls back rather than throwing", baseNodeFor("atlantis").slug === "windhoek");
check("a recorded base is used", baseNodeFor("swakopmund").slug === "swakopmund");

/* ----------------------------------------------------------- an empty week */

console.log("\na driver with nothing booked");

const empty = buildTimeline(DRIVER, [], WINDOW);
check("is one idle stretch", empty.segments.length === 1 && empty.segments[0].kind === "idle");
check("spanning the whole window", empty.idle[0]?.hours === 168, `${empty.idle[0]?.hours}h`);
check("standing at their base", empty.idle[0]?.at.slug === "windhoek");
check("with no busy hours", empty.busyHours === 0);
check("and nothing wrong", empty.conflicts.length === 0);

/* ------------------------------------------------- one trip out and back */

console.log("\none trip away from base");

const oneTrip = buildTimeline(
  DRIVER,
  [leg("NT-1", "windhoek", "swakopmund", "2026-09-02T08:00:00Z", 240)],
  WINDOW,
);
const kinds = oneTrip.segments.map((s) => s.kind).join(",");
check(
  "reads idle, trip, drive home, idle",
  kinds === "idle,trip,reposition,idle",
  kinds,
);
check(
  "the trip lasts what was sold",
  oneTrip.segments[1].kind === "trip" &&
    hours(oneTrip.segments[1].startsAt, oneTrip.segments[1].endsAt) === 4,
);
check(
  "the drive home is the road back",
  oneTrip.segments[2].kind === "reposition" &&
    Math.round(oneTrip.segments[2].km) ===
      Math.round(findRoad("swakopmund", "windhoek")!.km),
);
check(
  "the empty return home counts as busy, not idle",
  oneTrip.busyHours > 4,
  `${oneTrip.busyHours.toFixed(1)}h`,
);
check("no conflicts", oneTrip.conflicts.length === 0);

// The whole point: after the trip and the drive home, what is left is sellable.
check(
  "two idle windows remain, both at base",
  oneTrip.idle.length === 2 && oneTrip.idle.every((w) => w.at.slug === "windhoek"),
);

/* ------------------------------------------- repositioning to the pickup */

console.log("\na pickup somewhere the car is not");

const repo = buildTimeline(
  DRIVER,
  [leg("NT-2", "swakopmund", "walvis-bay", "2026-09-03T09:00:00Z", 40)],
  WINDOW,
);
const repoSeg = repo.segments.find((s) => s.kind === "reposition");
check("an empty drive to the pickup is inserted", Boolean(repoSeg));
check(
  "it arrives exactly when the trip starts",
  repoSeg?.kind === "reposition" &&
    repoSeg.endsAt.getTime() === at("2026-09-03T09:00:00Z").getTime(),
);
check(
  "and it leaves late enough to sit idle at base first",
  repo.segments[0].kind === "idle" && repo.segments[0].at?.slug === "windhoek",
);

// A driver who lives on the coast does not make that drive at all.
const coastal = buildTimeline(
  COASTAL,
  [leg("NT-2", "swakopmund", "walvis-bay", "2026-09-03T09:00:00Z", 40)],
  WINDOW,
);
check(
  "a coastal driver needs no repositioning for a coastal pickup",
  !coastal.segments.some((s) => s.kind === "reposition" && s.ref === "NT-2"),
);
check(
  "which is the whole reason a base is recorded",
  coastal.busyHours < repo.busyHours,
  `${coastal.busyHours.toFixed(1)}h vs ${repo.busyHours.toFixed(1)}h`,
);

/* ------------------------------------------- schedules that cannot happen */

console.log("\nschedules that cannot happen");

const overlap = buildTimeline(
  DRIVER,
  [
    leg("NT-A", "windhoek", "swakopmund", "2026-09-02T08:00:00Z", 240),
    leg("NT-B", "swakopmund", "walvis-bay", "2026-09-02T10:00:00Z", 40),
  ],
  WINDOW,
);
check(
  "two trips at once is flagged impossible",
  overlap.conflicts.some((c) => c.kind === "overlap" && c.severity === "impossible"),
);
check("and it names the second booking", overlap.conflicts[0]?.ref === "NT-B");

const unreachable = buildTimeline(
  DRIVER,
  [
    leg("NT-C", "windhoek", "hosea-kutako", "2026-09-04T06:00:00Z", 45),
    // Sossusvlei is five and a half hours from the airport. One hour is not
    // enough, and a board that did not say so would send a car nobody meets.
    leg("NT-D", "sossusvlei", "swakopmund", "2026-09-04T08:00:00Z", 354),
  ],
  WINDOW,
);
check(
  "a gap too short for the road is flagged impossible",
  unreachable.conflicts.some(
    (c) => c.kind === "unreachable" && c.severity === "impossible",
  ),
  unreachable.conflicts.map((c) => c.kind).join(","),
);
check(
  "and the empty drive still shows, so the lateness is visible",
  unreachable.segments.some(
    (s) => s.kind === "reposition" && s.endsAt.getTime() > at("2026-09-04T08:00:00Z").getTime(),
  ),
);

const tired = buildTimeline(
  DRIVER,
  [
    leg("NT-E", "windhoek", "swakopmund", "2026-09-05T14:00:00Z", 240),
    leg("NT-F", "swakopmund", "windhoek", "2026-09-05T22:00:00Z", 240),
  ],
  WINDOW,
);
check(
  "four hours between drives is flagged, but only as tight",
  tired.conflicts.some((c) => c.kind === "no-rest" && c.severity === "tight"),
  tired.conflicts.map((c) => `${c.kind}:${c.severity}`).join(","),
);

check(
  "an unreachable leg raises one alarm, not two",
  unreachable.conflicts.filter((c) => c.ref === "NT-D").length === 1,
  unreachable.conflicts.map((c) => `${c.ref}:${c.kind}`).join(","),
);

const nowhere = buildTimeline(
  DRIVER,
  [leg("NT-G", null, null, "2026-09-06T09:00:00Z", 90)],
  WINDOW,
);
check(
  "a booking whose places we cannot place is flagged, not dropped",
  nowhere.conflicts.some((c) => c.kind === "unknown-place") &&
    nowhere.segments.some((s) => s.kind === "trip"),
);
check(
  "and the car is still treated as busy for its duration",
  Math.abs(nowhere.busyHours - 1.5) < 0.01,
  `${nowhere.busyHours}h`,
);

/* ------------------------------------------------------- the invariants */

console.log("\nthe timeline is a timeline");

const busy = buildTimeline(
  DRIVER,
  [
    leg("NT-H", "hosea-kutako", "windhoek", "2026-09-01T09:00:00Z", 45),
    leg("NT-I", "windhoek", "sossusvlei", "2026-09-02T07:00:00Z", 314),
    leg("NT-J", "sossusvlei", "swakopmund", "2026-09-04T08:00:00Z", 354),
    leg("NT-K", "swakopmund", "windhoek", "2026-09-06T09:00:00Z", 234),
  ],
  WINDOW,
);

let ordered = true;
let gapless = true;
for (let i = 1; i < busy.segments.length; i++) {
  const previous = busy.segments[i - 1];
  const current = busy.segments[i];
  if (current.startsAt.getTime() < previous.startsAt.getTime()) ordered = false;
  if (current.startsAt.getTime() !== previous.endsAt.getTime()) gapless = false;
}
check("segments run in order", ordered);
check("and leave no unaccounted time", gapless);
check(
  "every segment sits inside the window",
  busy.segments.every(
    (s) =>
      s.endsAt.getTime() > WINDOW.from.getTime() &&
      s.startsAt.getTime() < WINDOW.to.getTime(),
  ),
);
check("a full week has no conflicts", busy.conflicts.length === 0, busy.conflicts.map((c) => c.message).join(" | "));

// A car that drove itself to Sossusvlei and waited two days is exactly the
// inventory the analysis said to sell.
const waited = busy.idle.find((w) => w.at.slug === "sossusvlei");
check(
  "the two days waiting at Sossusvlei are recorded as idle there",
  Boolean(waited) && waited!.hours > 24,
  waited ? `${waited.hours.toFixed(1)}h` : "none found",
);

/* --------------------------------------------------------- the inventory */

console.log("\nwhat is sellable");

// Two airport runs either side of a two-hour gap. The gap is real, and it is
// not inventory: nobody can be taken anywhere and brought back in two hours.
const shuttling = buildTimeline(
  { id: "d3", fullName: "Petrus", baseNode: "windhoek" },
  [
    leg("NT-M", "hosea-kutako", "windhoek", "2026-09-03T06:00:00Z", 45),
    leg("NT-N", "windhoek", "hosea-kutako", "2026-09-03T08:45:00Z", 45),
  ],
  WINDOW,
);
const shortGap = shuttling.idle.find(
  (w) => w.hours > 0 && w.hours < 4 && w.at.slug === "windhoek",
);
check("a two-hour gap is recorded", Boolean(shortGap), `${shuttling.idle.map((w) => w.hours.toFixed(1)).join(", ")}h`);

const fleet = [busy, oneTrip, coastal, shuttling];
const all = idleWindows(fleet, 0);
const real = idleWindows(fleet, 4);
check(
  "but it is not offered as inventory",
  all.length - real.length >= 1 && !real.some((w) => w.hours < 4),
  `${all.length} gaps, ${real.length} sellable`,
);
check("every window offered is at least four hours", real.every((w) => w.hours >= 4));
check(
  "and they are offered soonest first",
  real.every((w, i) => i === 0 || real[i - 1].startsAt <= w.startsAt),
);

// The board shows today from midnight, but nobody can sell this morning.
const midWeek = at("2026-09-04T00:00:00Z");
const ahead = idleWindows(fleet, 4, midWeek);
check(
  "hours already gone are not offered",
  ahead.every((w) => w.startsAt.getTime() >= midWeek.getTime()),
);
check(
  "a window straddling the cutoff is trimmed, not dropped",
  ahead.some((w) => w.startsAt.getTime() === midWeek.getTime()),
  ahead.map((w) => w.startsAt.toISOString()).join(", "),
);
check(
  "and its length is measured from the cutoff",
  ahead
    .filter((w) => w.startsAt.getTime() === midWeek.getTime())
    .every((w) => Math.abs(w.hours - hours(midWeek, w.endsAt)) < 0.01),
);

const places = idleByPlace(real);
check("windows group by place", places.length > 0);
check(
  "the place with the most standing time comes first",
  places.every((p, i) => i === 0 || places[i - 1].hours >= p.hours),
);
check(
  "and Sossusvlei is among them, because a car waited there",
  places.some((p) => p.at.slug === "sossusvlei"),
  places.map((p) => p.at.slug).join(","),
);

/* ----------------------------------------------------- duration fallback */

console.log("\nwhen a booking never recorded its duration");

const noDuration = buildTimeline(
  DRIVER,
  [leg("NT-L", "windhoek", "swakopmund", "2026-09-02T08:00:00Z", null)],
  WINDOW,
);
const trip = noDuration.segments.find((s) => s.kind === "trip")!;
check(
  "the road supplies one",
  hours(trip.startsAt, trip.endsAt) * 60 === findRoad("windhoek", "swakopmund")!.minutes,
  `${hours(trip.startsAt, trip.endsAt) * 60} min`,
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
