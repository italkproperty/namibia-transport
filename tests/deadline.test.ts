/**
 * The deadline is not only a timer. It is the one signal we have that a
 * database connection has gone silent, because nothing in postgres.js can
 * cancel a query in flight. So exceeding it must tell whoever is listening —
 * the database module, which retires the pool — and must do so even when a
 * listener misbehaves, because the caller's error path is the thing that
 * renders the page.
 *
 * Pure: no database. The behaviour against a real stalled connection is in
 * tests/stalled-connection.test.ts.
 */
import {
  DeadlineExceeded,
  onDeadlineExceeded,
  READ_DEADLINE_MS,
  WRITE_DEADLINE_MS,
  withDeadline,
} from "@/lib/deadline";

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const never = () => new Promise<never>(() => undefined);

async function main() {
  console.log("work that answers in time");

  const fast = await withDeadline("fast", 500, async () => {
    await sleep(10);
    return 42;
  });
  check("resolves with the work's value", fast === 42);

  console.log("\nwork that never answers");

  let caught: unknown;
  const started = Date.now();
  try {
    await withDeadline("stalled read", 120, never);
  } catch (error) {
    caught = error;
  }
  const elapsed = Date.now() - started;
  check("rejects", caught !== undefined);
  check(
    "with a DeadlineExceeded",
    caught instanceof DeadlineExceeded && caught.name === "DeadlineExceeded",
  );
  check(
    "whose message names the label and the budget",
    caught instanceof Error &&
      caught.message === "stalled read did not answer within 120ms",
    caught instanceof Error ? caught.message : String(caught),
  );
  check("at the deadline, not later", elapsed >= 100 && elapsed < 1_000, `${elapsed}ms`);

  console.log("\nlisteners");

  const seen: DeadlineExceeded[] = [];
  const stop = onDeadlineExceeded((error) => seen.push(error));
  try {
    await withDeadline("watched", 30, never);
  } catch {
    // expected
  }
  check("a listener is told when a deadline is exceeded", seen.length === 1);
  check(
    "and is given the same error the caller gets",
    seen[0]?.message === "watched did not answer within 30ms",
  );

  await withDeadline("quick", 200, async () => "fine");
  check("but not when the work answers in time", seen.length === 1);

  stop();
  try {
    await withDeadline("unwatched", 30, never);
  } catch {
    // expected
  }
  check("unsubscribing stops the calls", seen.length === 1);

  console.log("\na listener that throws");

  const stopBad = onDeadlineExceeded(() => {
    throw new Error("listener bug");
  });
  const after: string[] = [];
  const stopGood = onDeadlineExceeded((error) => after.push(error.message));
  let stillRejects: unknown;
  try {
    await withDeadline("despite a bad listener", 30, never);
  } catch (error) {
    stillRejects = error;
  }
  check(
    "the caller still gets its DeadlineExceeded",
    stillRejects instanceof DeadlineExceeded,
  );
  check("and the other listeners are still told", after.length === 1);
  stopBad();
  stopGood();

  console.log("\nbudgets");

  check("a read gets six seconds", READ_DEADLINE_MS === 6_000);
  check(
    "a write gets longer than a read, and well under the function's life",
    WRITE_DEADLINE_MS > READ_DEADLINE_MS && WRITE_DEADLINE_MS <= 20_000,
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
