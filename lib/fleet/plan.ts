import type { PlaceNode } from "@/lib/network/nodes";
import { findRoad } from "@/lib/network/roads";

import { minimumCostAssignment } from "./hungarian";

/**
 * Who should drive what.
 *
 * Dispatch has always been a dropdown: a booking arrives, somebody picks a
 * driver who looks free. That is a greedy rule, and greedy rules on this
 * structure lose — the third booking is placed badly because the first two
 * were placed without knowing it existed. Assignment is the same problem as
 * pricing seen from the other end, because which driver takes a trip is what
 * decides how many empty kilometres the fleet drives to deliver it, and empty
 * kilometres are 42% of what we charge.
 *
 * So this solves them together. Every unassigned booking is a node that needs
 * a predecessor — either a driver starting a duty, or another booking that
 * ends in time and near enough to reach it — and the cheapest way to give
 * every booking a predecessor is exactly a minimum-cost assignment, solved
 * here rather than approximated. Phase one is optimal for the driving between
 * trips. Phase two is a local search that also weighs the drive home, which
 * the first phase cannot see because a chain does not know where it ends
 * until it has ended.
 *
 * It suggests; it never assigns. A dispatcher knows things this does not —
 * that a driver asked for Friday off, that a customer wants the man who drove
 * them last year — and a system that acted on its own arithmetic over that
 * would be wrong more often than it was right.
 */

const MINUTE = 60_000;

export type PlanJob = {
  bookingId: string;
  ref: string;
  label: string;
  from: PlaceNode;
  to: PlaceNode;
  startsAt: Date;
  endsAt: Date;
  passengers: number;
};

export type PlanDriver = {
  id: string;
  fullName: string;
  /** Where they are at the start of the window. */
  at: PlaceNode;
  /** And from when. */
  freeFrom: Date;
  base: PlaceNode;
  /** Null when no vehicle is on file; capacity then cannot be checked. */
  seats: number | null;
  /**
   * Trips already assigned to them, which are fixed and cannot be moved.
   *
   * These have to be here rather than collapsed into a single "free from"
   * time, because a driver with a job on Thursday and another on Saturday is
   * free on Friday — and treating them as busy until Saturday is exactly how
   * a fleet ends up with one car doing 1,800 empty kilometres while another
   * sits still. New work is interleaved with these, never on top of them.
   */
  committed: PlanJob[];
};

export type PlanChain = {
  driver: PlanDriver;
  jobs: PlanJob[];
  /** Empty kilometres this chain drives: to the first pickup, between trips,
      and home again. */
  emptyKm: number;
};

export type Unplaced = { job: PlanJob; reason: string };

export type FleetPlan = {
  chains: PlanChain[];
  unplaced: Unplaced[];
  emptyKm: number;
  ladenKm: number;
  /** Bookings this plan gets a driver onto. */
  placed: number;
  /** What "assign each booking to the nearest free driver, in turn" achieves. */
  greedyEmptyKm: number;
  greedyPlaced: number;
  /**
   * Empty kilometres saved — but only counted when the plan covers at least as
   * many bookings. Greedy can score fewer empty kilometres by the simple
   * method of dropping a booking it cannot place, and calling that a saving
   * would be the most expensive kind of wrong.
   */
  savedKm: number;
  /** True when the local search ran out of moves rather than out of budget. */
  converged: boolean;
};

/* ------------------------------------------------------------- primitives */

const km = (from: PlaceNode, to: PlaceNode): number | null => {
  if (from.slug === to.slug) return 0;
  return findRoad(from.slug, to.slug)?.km ?? null;
};

const minutes = (from: PlaceNode, to: PlaceNode): number | null => {
  if (from.slug === to.slug) return 0;
  return findRoad(from.slug, to.slug)?.minutes ?? null;
};

/** Can one trip follow another on the same car? */
function canFollow(first: PlanJob, second: PlanJob): boolean {
  if (first.bookingId === second.bookingId) return false;
  const travel = minutes(first.to, second.from);
  if (travel === null) return false;
  return first.endsAt.getTime() + travel * MINUTE <= second.startsAt.getTime();
}

/** New work merged into what the driver already has, in the order driven. */
function fullDay(driver: PlanDriver, jobs: PlanJob[]): PlanJob[] {
  return [...driver.committed, ...jobs].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
}

/**
 * Could this driver do all of it — the fixed work and the new work together?
 *
 * Only the joins that involve new work are judged. A driver whose existing
 * schedule already cannot run — two trips 350 km apart with an hour between
 * them — has a problem the calendar flags loudly elsewhere, and it is not one
 * this can fix. Insisting the fixed part be sound before anything may be added
 * to it silently strikes that driver off entirely, which is how the busiest
 * driver in the fleet ends up with nothing while another does 1,800 empty
 * kilometres.
 */
function chainIsFeasible(driver: PlanDriver, jobs: PlanJob[]): boolean {
  if (jobs.length === 0) return true;

  if (driver.seats !== null && jobs.some((job) => driver.seats! < job.passengers)) {
    return false;
  }

  const day = fullDay(driver, jobs);
  const fixed = new Set(driver.committed.map((job) => job.bookingId));
  const isNew = (job: PlanJob) => !fixed.has(job.bookingId);

  if (isNew(day[0])) {
    const reach = minutes(driver.at, day[0].from);
    if (reach === null) return false;
    if (driver.freeFrom.getTime() + reach * MINUTE > day[0].startsAt.getTime()) {
      return false;
    }
  }
  for (let i = 1; i < day.length; i++) {
    // A join between two trips that were both already booked is somebody
    // else's problem, already on the board, and not made worse by this.
    if (!isNew(day[i - 1]) && !isNew(day[i])) continue;
    if (!canFollow(day[i - 1], day[i])) return false;
  }
  return true;
}

/**
 * Empty kilometres over the driver's whole window — to the first pickup,
 * between every pair of trips, and home from the last. Counting the fixed
 * trips too is what lets new work be judged on where it slots in rather than
 * only on what comes after it.
 */
function chainEmptyKm(driver: PlanDriver, jobs: PlanJob[]): number {
  const day = fullDay(driver, jobs);
  if (day.length === 0) return 0;

  let total = km(driver.at, day[0].from) ?? 0;
  for (let i = 1; i < day.length; i++) {
    total += km(day[i - 1].to, day[i].from) ?? 0;
  }
  total += km(day[day.length - 1].to, driver.base) ?? 0;
  return total;
}

/** The empty running a driver does before any new work is added. */
function baselineEmptyKm(driver: PlanDriver): number {
  return chainEmptyKm(driver, []);
}

/** Whether a driver could start a duty with this trip at all. */
function driverCanStart(driver: PlanDriver, job: PlanJob): boolean {
  return chainIsFeasible(driver, [job]);
}

/* ------------------------------------------------- phase one: the optimum */

/**
 * Gives every job a predecessor at minimum total cost. A predecessor is either
 * a driver — meaning this job starts that driver's duty — or another job that
 * finishes in time and near enough to reach it.
 *
 * Rows are jobs, so every job is placed or explicitly refused; columns are the
 * possible predecessors, each usable once, which is what makes the result a
 * set of chains rather than a tangle.
 */
function solveChains(jobs: PlanJob[], drivers: PlanDriver[]): PlanChain[] {
  if (jobs.length === 0) return [];

  const costs = jobs.map((job) => {
    const row: number[] = [];
    for (const driver of drivers) {
      row.push(
        driverCanStart(driver, job)
          ? chainEmptyKm(driver, [job]) - baselineEmptyKm(driver)
          : Infinity,
      );
    }
    for (const predecessor of jobs) {
      row.push(
        canFollow(predecessor, job) ? (km(predecessor.to, job.from) ?? Infinity) : Infinity,
      );
    }
    return row;
  });

  const { columnForRow } = minimumCostAssignment(costs);

  /** For each job index, the job index that follows it. */
  const successor = new Array<number>(jobs.length).fill(-1);
  /** For each driver index, the job index that starts their duty. */
  const startsWith = new Array<number>(drivers.length).fill(-1);

  columnForRow.forEach((column, jobIndex) => {
    if (column === -1) return;
    if (column < drivers.length) startsWith[column] = jobIndex;
    else successor[column - drivers.length] = jobIndex;
  });

  // Walk each duty from its driver. A job never reached is one whose whole
  // chain was left rootless, and it is reported rather than quietly dropped.
  const chains: PlanChain[] = [];
  drivers.forEach((driver, driverIndex) => {
    const ordered: PlanJob[] = [];
    let cursor = startsWith[driverIndex];
    const seen = new Set<number>();
    while (cursor !== -1 && !seen.has(cursor)) {
      seen.add(cursor);
      ordered.push(jobs[cursor]);
      cursor = successor[cursor];
    }
    if (ordered.length > 0) {
      chains.push({
        driver,
        jobs: ordered,
        emptyKm: chainEmptyKm(driver, ordered) - baselineEmptyKm(driver),
      });
    }
  });

  return chains;
}

/* ------------------------------- phase two: which driver takes which duty */

/**
 * Phase one links trips to each other, which is the part it can solve exactly.
 * What it cannot see is the drive home — a duty does not know where it ends
 * until it has ended — nor whether the car that starts a duty seats everyone
 * later in it, because a link between two trips does not know whose car it is.
 *
 * Both are the same question: which driver should own which duty. That is
 * again an assignment problem, and again it is solved rather than guessed,
 * with the true cost this time: out to the first pickup, and home from the
 * last drop.
 */
function assignDrivers(
  duties: PlanJob[][],
  drivers: PlanDriver[],
): { chains: PlanChain[]; unplaced: PlanJob[] } {
  if (duties.length === 0) {
    return { chains: [], unplaced: [] };
  }

  const costs = duties.map((jobs) =>
    drivers.map((driver) =>
      chainIsFeasible(driver, jobs)
        ? chainEmptyKm(driver, jobs) - baselineEmptyKm(driver)
        : Infinity,
    ),
  );

  // More duties than drivers is normal; the surplus rows come back unassigned.
  const padded =
    drivers.length >= duties.length
      ? costs
      : costs.map((row) => [...row, ...new Array(duties.length - drivers.length).fill(Infinity)]);

  const { columnForRow } = minimumCostAssignment(padded);

  const chains: PlanChain[] = [];
  const unplaced: PlanJob[] = [];

  columnForRow.forEach((column, dutyIndex) => {
    if (column === -1 || column >= drivers.length) {
      unplaced.push(...duties[dutyIndex]);
      return;
    }
    const driver = drivers[column];
    chains.push({
      driver,
      jobs: duties[dutyIndex],
      emptyKm: chainEmptyKm(driver, duties[dutyIndex]) - baselineEmptyKm(driver),
    });
  });

  return { chains, unplaced };
}

/* --------------------------------------------------------- local search */

type Duty = { driver: PlanDriver; jobs: PlanJob[]; emptyKm: number };

/**
 * Improves a plan against the cost that actually matters.
 *
 * Every driver is present here, including the ones with nothing to do — a
 * search that can only move work between duties that already exist can never
 * use an idle driver, which is exactly the driver most worth using.
 *
 * Two moves, both classical: take a trip out and put it somewhere better, or
 * exchange two trips between duties. Feasibility is checked before cost is
 * compared, so nothing that cannot physically run is ever counted as an
 * improvement.
 */
function improve(
  chains: PlanChain[],
  waiting: PlanJob[],
  drivers: PlanDriver[],
  budget = 500,
): { chains: PlanChain[]; unplaced: PlanJob[]; converged: boolean } {
  const byDriver = new Map(chains.map((chain) => [chain.driver.id, chain.jobs]));
  const duties: Duty[] = drivers.map((driver) => {
    const jobs = byDriver.get(driver.id) ?? [];
    return {
      driver,
      jobs: [...jobs],
      emptyKm: chainEmptyKm(driver, jobs) - baselineEmptyKm(driver),
    };
  });

  const recost = (duty: Duty) => {
    duty.emptyKm =
      chainEmptyKm(duty.driver, duty.jobs) - baselineEmptyKm(duty.driver);
  };

  /**
   * What adding a trip to a duty would cost, or null if it cannot be added.
   * Where in the list it goes is not a choice: a day is driven in time order,
   * so the sequence is derived rather than decided.
   */
  function costOfAdding(duty: Duty, job: PlanJob): number | null {
    const candidate = [...duty.jobs, job];
    if (!chainIsFeasible(duty.driver, candidate)) return null;
    return (
      chainEmptyKm(duty.driver, candidate) -
      baselineEmptyKm(duty.driver) -
      duty.emptyKm
    );
  }

  // A booking with a driver beats a tidy plan, so anything left over is placed
  // wherever it fits at all — cheapest fit, but any fit will do.
  const stillWaiting = waiting.filter((job) => {
    let target: Duty | null = null;
    let bestDelta = Infinity;
    for (const duty of duties) {
      const delta = costOfAdding(duty, job);
      if (delta !== null && delta < bestDelta) {
        bestDelta = delta;
        target = duty;
      }
    }
    if (!target) return true;
    target.jobs.push(job);
    recost(target);
    return false;
  });

  let steps = 0;
  let improved = true;
  while (improved && steps < budget) {
    improved = false;

    // Relocate: one trip moves to a better duty.
    for (let from = 0; from < duties.length && !improved; from++) {
      for (let index = 0; index < duties[from].jobs.length && !improved; index++) {
        const job = duties[from].jobs[index];
        const without = [...duties[from].jobs];
        without.splice(index, 1);
        if (!chainIsFeasible(duties[from].driver, without)) continue;
        const removal =
          chainEmptyKm(duties[from].driver, without) -
          baselineEmptyKm(duties[from].driver) -
          duties[from].emptyKm;

        for (let to = 0; to < duties.length && !improved; to++) {
          if (to === from) continue;
          const addition = costOfAdding(duties[to], job);
          if (addition === null) continue;
          if (removal + addition < -0.001) {
            duties[from].jobs = without;
            duties[to].jobs.push(job);
            recost(duties[from]);
            recost(duties[to]);
            improved = true;
            steps += 1;
          }
        }
      }
    }

    // Swap: two trips exchange duties. Reaches arrangements no single move can.
    for (let a = 0; a < duties.length && !improved; a++) {
      for (let b = a + 1; b < duties.length && !improved; b++) {
        for (let i = 0; i < duties[a].jobs.length && !improved; i++) {
          for (let j = 0; j < duties[b].jobs.length && !improved; j++) {
            const left = [...duties[a].jobs];
            const right = [...duties[b].jobs];
            const [moved] = left.splice(i, 1);
            const [other] = right.splice(j, 1);
            left.push(other);
            right.push(moved);
            if (!chainIsFeasible(duties[a].driver, left)) continue;
            if (!chainIsFeasible(duties[b].driver, right)) continue;
            const delta =
              chainEmptyKm(duties[a].driver, left) -
              baselineEmptyKm(duties[a].driver) +
              chainEmptyKm(duties[b].driver, right) -
              baselineEmptyKm(duties[b].driver) -
              duties[a].emptyKm -
              duties[b].emptyKm;
            if (delta < -0.001) {
              duties[a].jobs = left;
              duties[b].jobs = right;
              recost(duties[a]);
              recost(duties[b]);
              improved = true;
              steps += 1;
            }
          }
        }
      }
    }
  }

  return {
    chains: duties.filter((duty) => duty.jobs.length > 0),
    unplaced: stillWaiting,
    converged: !improved,
  };
}

/* ------------------------------------------------------ the greedy baseline */

/**
 * What happens today: take the bookings in turn and give each one to whichever
 * driver can reach it with the least empty driving. Reasonable, and beaten —
 * because it never reconsiders, and because a booking it cannot place at the
 * moment it looks at it is simply lost.
 *
 * It is also used as a second starting point for the search below, which is
 * what makes "never worse than the dropdown" a structural guarantee rather
 * than a hope.
 */
function greedySolution(
  jobs: PlanJob[],
  drivers: PlanDriver[],
): { chains: PlanChain[]; unplaced: PlanJob[] } {
  const duties = drivers.map((driver) => ({ driver, jobs: [] as PlanJob[] }));
  const unplaced: PlanJob[] = [];

  for (const job of jobs) {
    let best: (typeof duties)[number] | null = null;
    let bestExtra = Infinity;

    for (const duty of duties) {
      const candidate = [...duty.jobs, job];
      if (!chainIsFeasible(duty.driver, candidate)) continue;
      const extra =
        chainEmptyKm(duty.driver, candidate) - chainEmptyKm(duty.driver, duty.jobs);
      if (extra < bestExtra) {
        bestExtra = extra;
        best = duty;
      }
    }

    if (best) best.jobs.push(job);
    else unplaced.push(job);
  }

  return {
    chains: duties
      .filter((duty) => duty.jobs.length > 0)
      .map((duty) => ({
        ...duty,
        emptyKm: chainEmptyKm(duty.driver, duty.jobs) - baselineEmptyKm(duty.driver),
      })),
    unplaced,
  };
}

/* ------------------------------------------- a third way of starting out */

/**
 * Place the hardest bookings first.
 *
 * The failure the other two starting points share is the constrained trip: a
 * party of five when one car in the fleet seats five, or a pickup only one
 * driver can reach in time. Both of the others may spend that car on an easy
 * trip before they ever look at the hard one, and then the hard one cannot be
 * placed at all — which costs a booking, and a booking is worth more than any
 * number of kilometres.
 *
 * So this orders the work by how few drivers could possibly take it and
 * places the scarcest first, each at its cheapest feasible position. It is
 * often worse on distance and occasionally the only one that fits everything.
 */
function constrainedFirstSolution(
  jobs: PlanJob[],
  drivers: PlanDriver[],
): { chains: PlanChain[]; unplaced: PlanJob[] } {
  const options = (job: PlanJob) =>
    drivers.filter((driver) => driverCanStart(driver, job)).length;

  const hardestFirst = [...jobs].sort((a, b) => {
    const difference = options(a) - options(b);
    return difference !== 0 ? difference : a.startsAt.getTime() - b.startsAt.getTime();
  });

  const duties = drivers.map((driver) => ({ driver, jobs: [] as PlanJob[] }));
  const unplaced: PlanJob[] = [];

  for (const job of hardestFirst) {
    let target: (typeof duties)[number] | null = null;
    let where = 0;
    let bestExtra = Infinity;

    for (const duty of duties) {
      const current = chainEmptyKm(duty.driver, duty.jobs);
      for (let position = 0; position <= duty.jobs.length; position++) {
        const candidate = [...duty.jobs];
        candidate.splice(position, 0, job);
        if (!chainIsFeasible(duty.driver, candidate)) continue;
        const extra = chainEmptyKm(duty.driver, candidate) - current;
        if (extra < bestExtra) {
          bestExtra = extra;
          target = duty;
          where = position;
        }
      }
    }

    if (target) target.jobs.splice(where, 0, job);
    else unplaced.push(job);
  }

  return {
    chains: duties
      .filter((duty) => duty.jobs.length > 0)
      .map((duty) => ({
        ...duty,
        emptyKm: chainEmptyKm(duty.driver, duty.jobs) - baselineEmptyKm(duty.driver),
      })),
    unplaced,
  };
}

/* ---------------------------------------------- shaking a stuck solution */

/**
 * A local search stops when no single move improves things, which is not the
 * same as being right — some better arrangements are two bad moves away. So
 * when it converges, the plan is deliberately disturbed and re-optimised, and
 * the result kept only if it is actually better.
 *
 * The randomness is seeded from a constant, so the same bookings always
 * produce the same plan. A dispatch board that showed a different answer on
 * every refresh would be worse than one that showed a slightly worse answer
 * every time.
 */
function shakeAndRetry(
  start: Solution,
  drivers: PlanDriver[],
  rounds = 12,
): Solution {
  let best = start;
  let state = 0x9e3779b9;
  const next = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };

  for (let round = 0; round < rounds; round++) {
    const duties = best.chains.map((chain) => ({ ...chain, jobs: [...chain.jobs] }));
    const loose = [...best.unplaced];
    if (duties.length === 0) break;

    // Pull two trips out at random and let the search put them back.
    for (let pull = 0; pull < 2; pull++) {
      const withWork = duties.filter((duty) => duty.jobs.length > 0);
      if (withWork.length === 0) break;
      const duty = withWork[Math.floor(next() * withWork.length)];
      const index = Math.floor(next() * duty.jobs.length);
      loose.push(...duty.jobs.splice(index, 1));
    }

    const shaken = improve(
      duties.map((duty) => ({
        ...duty,
        emptyKm: chainEmptyKm(duty.driver, duty.jobs) - baselineEmptyKm(duty.driver),
      })),
      loose,
      drivers,
    );
    best = better(shaken, best);
  }

  return best;
}

/* --------------------------------------------------------------- the plan */

type Solution = {
  chains: PlanChain[];
  unplaced: PlanJob[];
  converged: boolean;
};

const placedIn = (solution: Solution) =>
  solution.chains.reduce((total, chain) => total + chain.jobs.length, 0);

const emptyIn = (solution: Solution) =>
  solution.chains.reduce((total, chain) => total + chain.emptyKm, 0);

/** More bookings first, then fewer empty kilometres. In that order, always. */
function better(a: Solution, b: Solution): Solution {
  if (placedIn(a) !== placedIn(b)) return placedIn(a) > placedIn(b) ? a : b;
  return emptyIn(a) <= emptyIn(b) ? a : b;
}

export function planAssignments(
  jobs: PlanJob[],
  drivers: PlanDriver[],
): FleetPlan {
  const usable = drivers.filter((driver) => driver.seats === null || driver.seats > 0);
  if (jobs.length === 0 || usable.length === 0) {
    return {
      chains: [],
      unplaced: jobs.map((job) => ({
        job,
        reason: usable.length === 0 ? "No driver is available." : "",
      })),
      emptyKm: 0,
      ladenKm: 0,
      placed: 0,
      greedyEmptyKm: 0,
      greedyPlaced: 0,
      savedKm: 0,
      converged: true,
    };
  }

  // Time order, so a duty reads the way a day is driven.
  const ordered = [...jobs].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  /**
   * Three starting points, all improved by the same search, and the best one
   * wins: the exact solution to the linking problem, the dropdown's own
   * answer, and a pass that places the scarcest bookings first.
   *
   * Keeping the dropdown among them is what makes "never worse than the
   * dropdown" structural rather than hopeful. Keeping the third is what stops
   * a party of five being stranded because the only car that seats them was
   * spent on an easier trip.
   */
  const seeded = solveChains(ordered, usable);
  const reassigned = assignDrivers(
    seeded.map((chain) => chain.jobs),
    usable,
  );
  const placedByPhaseOne = new Set(
    reassigned.chains.flatMap((c) => c.jobs.map((j) => j.bookingId)),
  );
  const leftOver = [
    ...reassigned.unplaced,
    ...ordered.filter(
      (job) =>
        !placedByPhaseOne.has(job.bookingId) &&
        !reassigned.unplaced.some((u) => u.bookingId === job.bookingId),
    ),
  ];

  const fromOptimum = improve(reassigned.chains, leftOver, usable);

  const greedy = greedySolution(ordered, usable);
  const fromGreedy = improve(greedy.chains, greedy.unplaced, usable);

  const constrained = constrainedFirstSolution(ordered, usable);
  const fromConstrained = improve(constrained.chains, constrained.unplaced, usable);

  const chosen = shakeAndRetry(
    better(better(fromOptimum, fromGreedy), fromConstrained),
    usable,
  );

  const emptyKm = emptyIn(chosen);
  const placed = placedIn(chosen);
  const ladenKm = chosen.chains
    .flatMap((chain) => chain.jobs)
    .reduce((total, job) => total + (km(job.from, job.to) ?? 0), 0);

  const greedyEmpty = greedy.chains.reduce((total, chain) => total + chain.emptyKm, 0);
  const greedyPlaced = greedy.chains.reduce((total, chain) => total + chain.jobs.length, 0);

  return {
    // Sorted for reading. Order carries no meaning inside the search — a day
    // is driven in time order whatever order the list was built in — but a
    // dispatcher reading a duty out of sequence would rightly distrust it.
    chains: chosen.chains.map((chain) => ({
      ...chain,
      jobs: [...chain.jobs].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    })),
    unplaced: chosen.unplaced.map((job) => ({ job, reason: whyNot(job, usable) })),
    emptyKm,
    ladenKm,
    placed,
    greedyEmptyKm: greedyEmpty,
    greedyPlaced,
    savedKm: placed >= greedyPlaced ? Math.max(0, greedyEmpty - emptyKm) : 0,
    converged: chosen.converged,
  };
}

/** Something a dispatcher can act on, rather than "no". */
function whyNot(job: PlanJob, drivers: PlanDriver[]): string {
  if (drivers.every((d) => d.seats !== null && d.seats < job.passengers)) {
    return `No vehicle on file seats ${job.passengers}.`;
  }
  const reachable = drivers.some((d) => minutes(d.at, job.from) !== null);
  if (!reachable) return "No road from any driver's position to the pickup.";
  return "Every driver is already committed elsewhere at that hour.";
}
