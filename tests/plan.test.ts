/**
 * The assignment optimiser.
 *
 * Two things are being claimed here and both have to be shown rather than
 * asserted. First, that the assignment algorithm finds the actual minimum —
 * checked against brute force on hundreds of random matrices, including ones
 * with impossible pairings, which is where clever implementations go wrong.
 * Second, that the resulting plan is one a fleet could really drive: every
 * chain is walked end to end and every leg checked for whether the car could
 * physically be there.
 *
 * The third claim is the commercial one — that this beats what a dispatcher
 * does with a dropdown. That one is measured, not assumed, and it is measured
 * carefully: greedy can post a lower empty-kilometre figure by the simple
 * method of dropping a booking it cannot place, so coverage is compared first.
 */
import { minimumCostAssignment } from "@/lib/fleet/hungarian";
import { planAssignments, type PlanDriver, type PlanJob } from "@/lib/fleet/plan";
import { findNode, PLACE_NODES, type PlaceNode } from "@/lib/network/nodes";
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

let seed = 424242;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];

/* ------------------------------------ the algorithm finds the real minimum */

console.log("\nthe assignment algorithm");

function brute(costs: number[][]): number {
  const rows = costs.length;
  const cols = costs[0].length;
  let best = Infinity;
  const used = new Array(cols).fill(false);
  const walk = (i: number, total: number) => {
    if (total >= best) return;
    if (i === rows) {
      best = Math.min(best, total);
      return;
    }
    for (let j = 0; j < cols; j++) {
      if (used[j] || !Number.isFinite(costs[i][j])) continue;
      used[j] = true;
      walk(i + 1, total + costs[i][j]);
      used[j] = false;
    }
  };
  walk(0, 0);
  return best;
}

let matched = 0;
let mismatched = 0;
let refusedCorrectly = 0;
for (let trial = 0; trial < 600; trial++) {
  const rows = 1 + Math.floor(rand() * 5);
  const cols = rows + Math.floor(rand() * 3);
  const costs = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () =>
      // One pairing in six is impossible. This is the case that separates a
      // correct implementation from one that happens to work.
      rand() < 0.17 ? Infinity : Math.round(rand() * 500),
    ),
  );
  const exact = brute(costs);
  const got = minimumCostAssignment(costs);

  if (!Number.isFinite(exact)) {
    if (got.unassignedRows.length > 0) refusedCorrectly += 1;
    else mismatched += 1;
    continue;
  }
  if (got.unassignedRows.length === 0 && Math.abs(got.cost - exact) < 1e-9) matched += 1;
  else mismatched += 1;
}

check(
  `${matched} random cost matrices matched brute force exactly`,
  mismatched === 0,
  `${mismatched} disagreed`,
);
check(
  `and ${refusedCorrectly} unsolvable ones were refused rather than faked`,
  refusedCorrectly > 0 && mismatched === 0,
);

check("an empty problem is not an error", minimumCostAssignment([]).cost === 0);
check(
  "a row with nowhere to go is reported",
  minimumCostAssignment([[Infinity, Infinity]]).unassignedRows.length === 1,
);

/* ------------------------------------------------------------- fixtures */

const T0 = Date.parse("2026-09-10T00:00:00Z");
const hoursAfter = (h: number) => new Date(T0 + h * 3_600_000);

function job(
  ref: string,
  from: string,
  to: string,
  startHour: number,
  passengers = 2,
): PlanJob {
  const road = findRoad(from, to)!;
  return {
    bookingId: ref,
    ref,
    label: `${from} → ${to}`,
    from: findNode(from)!,
    to: findNode(to)!,
    startsAt: hoursAfter(startHour),
    endsAt: new Date(hoursAfter(startHour).getTime() + road.minutes * 60_000),
    passengers,
  };
}

function driver(
  id: string,
  base: string,
  seats: number | null = 5,
  freeFromHour = 0,
  committed: PlanJob[] = [],
): PlanDriver {
  const node = findNode(base)!;
  return {
    id,
    fullName: id,
    at: node,
    base: node,
    freeFrom: hoursAfter(freeFromHour),
    seats,
    committed,
  };
}

/** Walks a chain the way a car would drive it, and says if it could. */
function chainRuns(chain: {
  driver: PlanDriver;
  jobs: PlanJob[];
}): boolean {
  let at: PlaceNode = chain.driver.at;
  let time = chain.driver.freeFrom.getTime();
  const day = [...chain.driver.committed, ...chain.jobs].sort(
    (a, b) => +a.startsAt - +b.startsAt,
  );
  for (const leg of day) {
    if (chain.driver.seats !== null && chain.driver.seats < leg.passengers) return false;
    const hop = at.slug === leg.from.slug ? 0 : findRoad(at.slug, leg.from.slug)?.minutes;
    if (hop === undefined) return false;
    if (time + hop * 60_000 > leg.startsAt.getTime()) return false;
    at = leg.to;
    time = leg.endsAt.getTime();
  }
  return true;
}

/* ------------------------------------------------ the plan can be driven */

console.log("\nthe plan is a plan a car could actually drive");

const simple = planAssignments(
  [
    job("A", "hosea-kutako", "windhoek", 8),
    job("B", "windhoek", "swakopmund", 12),
    job("C", "swakopmund", "walvis-bay", 20),
  ],
  [driver("Johannes", "windhoek"), driver("Selma", "swakopmund")],
);

check("every booking is placed", simple.placed === 3, `${simple.placed} of 3`);
check("every chain runs end to end", simple.chains.every(chainRuns));
check(
  "no booking is on two drivers at once",
  new Set(simple.chains.flatMap((c) => c.jobs.map((j) => j.bookingId))).size ===
    simple.placed,
);
check(
  "and nothing is silently lost",
  simple.placed + simple.unplaced.length === 3,
);
check(
  "chains are in the order they are driven",
  simple.chains.every((c) =>
    c.jobs.every((j, i) => i === 0 || c.jobs[i - 1].startsAt <= j.startsAt),
  ),
);

/* -------------------------------------- where the dropdown loses a booking */

console.log("\nthe case a dispatcher gets wrong");

// Two drivers, two bookings, and only one car big enough for the second.
// Handing the first booking to the nearest driver — which is the obviously
// right move, taken one booking at a time — is what loses the second.
const bigParty = planAssignments(
  [
    job("SMALL", "swakopmund", "walvis-bay", 8, 2),
    job("LARGE", "swakopmund", "windhoek", 9, 5),
  ],
  [driver("Johannes", "windhoek", 3), driver("Selma", "swakopmund", 5)],
);

check(
  "the plan places both bookings",
  bigParty.placed === 2,
  `${bigParty.placed} placed, ${bigParty.unplaced.map((u) => u.job.ref).join(", ")} not`,
);
check(
  "where taking them one at a time places only one",
  bigParty.greedyPlaced === 1,
  `${bigParty.greedyPlaced} placed greedily`,
);
check(
  "and it does so with a schedule that runs",
  bigParty.chains.every(chainRuns),
);
check(
  "the big party goes to the only car that seats them",
  bigParty.chains.some(
    (c) => c.jobs.some((j) => j.ref === "LARGE") && (c.driver.seats ?? 0) >= 5,
  ),
);
// Greedy drove fewer empty kilometres here, purely by losing a booking.
check(
  "a lower empty-kilometre figure earned by dropping a booking is not a saving",
  bigParty.savedKm === 0 || bigParty.placed >= bigParty.greedyPlaced,
  `saved ${bigParty.savedKm} km with ${bigParty.placed} vs ${bigParty.greedyPlaced} placed`,
);

/* ---------------------------------------------- work slotted into a gap */

console.log("\na driver busy on Thursday and Saturday is free on Friday");

// The trap this was written for: treating a driver as unavailable until after
// their last commitment. Johannes has work either side of Friday, and Friday
// is exactly when the new booking is.
const thursday = job("FIXED-1", "windhoek", "swakopmund", 8);
const saturday = job("FIXED-2", "swakopmund", "windhoek", 56);
const busyDriver = driver("Johannes", "windhoek", 5, 0, [thursday, saturday]);
const idleDriver = driver("Selma", "luderitz", 5, 0);

const gapFilled = planAssignments(
  [job("NEW", "swakopmund", "walvis-bay", 30)],
  [busyDriver, idleDriver],
);

check(
  "the Friday booking is placed",
  gapFilled.placed === 1,
  gapFilled.unplaced[0]?.reason,
);
check(
  "and it goes to the driver who is already at the coast",
  gapFilled.chains[0]?.driver.id === "Johannes",
  gapFilled.chains[0]?.driver.fullName,
);
check(
  "the whole day, fixed work included, still runs",
  gapFilled.chains.every(chainRuns),
);
check(
  "and it is costed on what it adds, not on the driver's whole week",
  gapFilled.chains[0]!.emptyKm < 100,
  `${Math.round(gapFilled.chains[0]!.emptyKm)} km added`,
);

// Work that would collide with something already fixed must still be refused.
const collision = planAssignments(
  [job("CLASH", "etosha-okaukuejo", "windhoek", 9)],
  [busyDriver],
);
check(
  "a booking that collides with fixed work is refused",
  collision.placed === 0,
  collision.chains[0]?.jobs.map((j) => j.ref).join(","),
);

// A driver whose fixed schedule already cannot run is not struck off. The
// board flags that separately; refusing them all new work as well would leave
// the fleet's busiest driver idle for a problem nobody asked this to solve.
const brokenAlready = driver("Broken", "windhoek", 5, 0, [
  job("OLD-1", "windhoek", "hosea-kutako", 8),
  // 350 km away, an hour later. This cannot happen and never could.
  job("OLD-2", "sossusvlei", "windhoek", 10),
]);
const stillUsable = planAssignments(
  [job("FRESH", "windhoek", "swakopmund", 60)],
  [brokenAlready],
);
check(
  "a driver with an already-impossible schedule can still take new work",
  stillUsable.placed === 1,
  stillUsable.unplaced[0]?.reason,
);

/* -------------------------------------------------- what cannot be placed */

console.log("\nwhat it refuses, and why");

const impossible = planAssignments(
  [job("HUGE", "windhoek", "swakopmund", 8, 9)],
  [driver("Johannes", "windhoek", 3)],
);
check("a party no vehicle seats is not placed", impossible.placed === 0);
check(
  "and the reason names the problem",
  impossible.unplaced[0]?.reason.includes("seats 9"),
  impossible.unplaced[0]?.reason,
);

const noDrivers = planAssignments([job("A", "windhoek", "swakopmund", 8)], []);
check("no drivers means nothing placed, not a crash", noDrivers.placed === 0);
check("and no phantom saving", noDrivers.savedKm === 0);

const tooSoon = planAssignments(
  // Sossusvlei is five hours from Windhoek; the driver is free an hour before.
  [job("RUSH", "sossusvlei", "swakopmund", 1)],
  [driver("Johannes", "windhoek", 5, 0)],
);
check(
  "a pickup nobody can reach in time is refused",
  tooSoon.placed === 0,
  tooSoon.unplaced[0]?.reason,
);

/* ---------------------------------------------- the invariants, at random */

console.log("\nthe invariants hold on 300 random fleets");

const HUBS = ["windhoek", "swakopmund", "hosea-kutako", "walvis-bay", "otjiwarongo"];
let infeasibleChains = 0;
let lostJobs = 0;
let duplicated = 0;
let coveredWorse = 0;
let dearerAtEqualCover = 0;
let falseSaving = 0;

for (let trial = 0; trial < 300; trial++) {
  const drivers = Array.from(
    { length: 1 + Math.floor(rand() * 4) },
    (_, i) => driver(`d${i}`, pick(HUBS), rand() < 0.25 ? 3 : 5, Math.floor(rand() * 6)),
  );
  const jobs = Array.from({ length: 1 + Math.floor(rand() * 7) }, (_, i) => {
    const from = pick(PLACE_NODES).slug;
    let to = pick(PLACE_NODES).slug;
    while (to === from) to = pick(PLACE_NODES).slug;
    return job(`j${i}`, from, to, 6 + Math.floor(rand() * 60), rand() < 0.2 ? 5 : 2);
  });

  const plan = planAssignments(jobs, drivers);

  if (!plan.chains.every(chainRuns)) infeasibleChains += 1;

  const placedIds = plan.chains.flatMap((c) => c.jobs.map((j) => j.bookingId));
  if (new Set(placedIds).size !== placedIds.length) duplicated += 1;
  if (placedIds.length + plan.unplaced.length !== jobs.length) lostJobs += 1;

  // The property that makes this worth running at all.
  if (plan.placed < plan.greedyPlaced) coveredWorse += 1;
  if (plan.placed === plan.greedyPlaced && plan.emptyKm > plan.greedyEmptyKm + 0.001) {
    dearerAtEqualCover += 1;
  }
  if (plan.savedKm > 0 && plan.placed < plan.greedyPlaced) falseSaving += 1;
}

check("every chain in every plan could be driven", infeasibleChains === 0, `${infeasibleChains} could not`);
check("no booking is ever assigned twice", duplicated === 0, `${duplicated} plans duplicated one`);
check("no booking ever disappears", lostJobs === 0, `${lostJobs} plans lost one`);
check(
  "the plan never covers fewer bookings than the dropdown",
  coveredWorse === 0,
  `${coveredWorse} plans covered fewer`,
);
check(
  "and at equal coverage it never drives further empty",
  dearerAtEqualCover === 0,
  `${dearerAtEqualCover} plans drove further`,
);
check("a saving is never claimed against worse coverage", falseSaving === 0);

/* ------------------------------ how close to perfect, measured not claimed */

console.log("\nagainst exhaustive search on instances small enough to enumerate");

/** Every possible assignment of jobs to drivers, including leaving jobs out. */
function exhaustive(
  jobs: PlanJob[],
  drivers: PlanDriver[],
): { placed: number; emptyKm: number } {
  const ordered = [...jobs].sort((a, b) => +a.startsAt - +b.startsAt);
  const choice = new Array(ordered.length).fill(-1);
  let bestPlaced = -1;
  let bestEmpty = Infinity;

  const dutyCost = (driver: PlanDriver, only: PlanJob[]): number | null => {
    const list = [...driver.committed, ...only].sort(
      (a, b) => +a.startsAt - +b.startsAt,
    );
    if (list.length === 0) return 0;
    let at = driver.at;
    let time = driver.freeFrom.getTime();
    let total = 0;
    for (const leg of list) {
      if (driver.seats !== null && driver.seats < leg.passengers) return null;
      const hop =
        at.slug === leg.from.slug ? 0 : findRoad(at.slug, leg.from.slug)?.minutes;
      if (hop === undefined) return null;
      if (time + hop * 60_000 > leg.startsAt.getTime()) return null;
      total +=
        at.slug === leg.from.slug ? 0 : (findRoad(at.slug, leg.from.slug)?.km ?? 0);
      at = leg.to;
      time = leg.endsAt.getTime();
    }
    return (
      total +
      (at.slug === driver.base.slug
        ? 0
        : (findRoad(at.slug, driver.base.slug)?.km ?? 0))
    );
  };

  const evaluate = () => {
    const lists: PlanJob[][] = drivers.map(() => []);
    let placed = 0;
    ordered.forEach((leg, i) => {
      if (choice[i] >= 0) {
        lists[choice[i]].push(leg);
        placed += 1;
      }
    });
    let total = 0;
    for (let d = 0; d < drivers.length; d++) {
      const cost = dutyCost(drivers[d], lists[d]);
      if (cost === null) return;
      total += cost;
    }
    if (placed > bestPlaced || (placed === bestPlaced && total < bestEmpty)) {
      bestPlaced = placed;
      bestEmpty = total;
    }
  };

  const walk = (i: number) => {
    if (i === ordered.length) {
      evaluate();
      return;
    }
    for (let d = -1; d < drivers.length; d++) {
      choice[i] = d;
      walk(i + 1);
    }
    choice[i] = -1;
  };
  walk(0);

  return { placed: bestPlaced, emptyKm: bestEmpty };
}

let exact = 0;
let coverageShort = 0;
let totalGapKm = 0;
let worstGapKm = 0;
const TRIALS = 200;
for (let trial = 0; trial < TRIALS; trial++) {
  const drivers = Array.from({ length: 2 + Math.floor(rand() * 2) }, (_, i) =>
    driver(`d${i}`, pick(HUBS), rand() < 0.3 ? 3 : 5, Math.floor(rand() * 8)),
  );
  const jobs = Array.from({ length: 2 + Math.floor(rand() * 4) }, (_, i) => {
    const from = pick(PLACE_NODES).slug;
    let to = pick(PLACE_NODES).slug;
    while (to === from) to = pick(PLACE_NODES).slug;
    return job(`j${i}`, from, to, 6 + Math.floor(rand() * 80), rand() < 0.2 ? 5 : 2);
  });

  const best = exhaustive(jobs, drivers);
  const plan = planAssignments(jobs, drivers);

  if (plan.placed < best.placed) coverageShort += 1;
  const gap = plan.emptyKm - best.emptyKm;
  if (plan.placed === best.placed && Math.abs(gap) < 1) exact += 1;
  else if (plan.placed === best.placed) {
    totalGapKm += gap;
    worstGapKm = Math.max(worstGapKm, gap);
  }
}

check(
  "it never places fewer bookings than the best possible",
  coverageShort === 0,
  `${coverageShort} instances covered less than the optimum`,
);
check(
  `it found the exact optimum on ${exact} of ${TRIALS} instances`,
  exact >= TRIALS * 0.95,
  `${((exact / TRIALS) * 100).toFixed(0)}% exact, mean gap ${(totalGapKm / TRIALS).toFixed(1)} km, worst ${worstGapKm.toFixed(0)} km`,
);
// The second phase is a heuristic, so the residual is stated rather than
// hidden. Against a typical two thousand empty kilometres a week, nine is
// noise — but it is measured noise, and a change that made it worse would
// fail here rather than quietly cost money.
check(
  "and where it is not exact, the residual is small",
  totalGapKm / TRIALS < 20,
  `mean gap ${(totalGapKm / TRIALS).toFixed(1)} km`,
);
console.log(
  `       ${((exact / TRIALS) * 100).toFixed(0)}% exact · mean gap ${(totalGapKm / TRIALS).toFixed(1)} km · worst ${worstGapKm.toFixed(0)} km`,
);

/* ------------------------------------------------------- what it is worth */

console.log("\nwhat it is worth on a week that looks like ours");

// The classic circuit's legs, plus airport work, across four drivers.
const week = [
  job("W1", "hosea-kutako", "windhoek", 7),
  job("W2", "windhoek", "sossusvlei", 30),
  job("W3", "sossusvlei", "swakopmund", 78),
  job("W4", "swakopmund", "walvis-bay", 100),
  job("W5", "hosea-kutako", "swakopmund", 54),
  job("W6", "etosha-okaukuejo", "windhoek", 126),
  job("W7", "windhoek", "etosha-okaukuejo", 102),
  job("W8", "walvis-bay", "windhoek", 126),
];
const fleet = [
  driver("Johannes", "windhoek"),
  driver("Selma", "swakopmund"),
  driver("Petrus", "windhoek"),
  driver("Maria", "otjiwarongo"),
];
const real = planAssignments(week, fleet);

console.log(
  `  ${real.placed}/${week.length} placed · ${Math.round(real.emptyKm)} km empty · ` +
    `dropdown: ${real.greedyPlaced}/${week.length} placed, ${Math.round(real.greedyEmptyKm)} km empty`,
);
check("it places the whole week", real.placed === week.length);
check("every duty runs", real.chains.every(chainRuns));
check(
  "and it drives no further empty than the dropdown does",
  real.emptyKm <= real.greedyEmptyKm + 0.001,
  `${Math.round(real.emptyKm)} vs ${Math.round(real.greedyEmptyKm)} km`,
);
check("the local search finished rather than ran out of budget", real.converged);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
