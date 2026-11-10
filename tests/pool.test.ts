/**
 * The connection pool's shape, held against the production finding.
 *
 * postgres.js pipelines statements onto a busy socket, and Supabase's
 * transaction-mode pooler goes silent when several arrive at once: the wire
 * trace showed four statements written in one millisecond and none of them
 * ever answered, while one at a time always answered. `max_pipeline: 1` is
 * the fix, and `max` has to be wide enough that a page's parallel reads get
 * sockets of their own rather than queueing. Both are the kind of setting
 * someone "tidies" a year later without the trace in front of them.
 *
 * Pure: reads the options, opens nothing.
 */
import { POOL_OPTIONS } from "@/db";

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

console.log("the pool against the transaction pooler");

check(
  "THE RULE: one statement in flight per socket — never pipeline",
  POOL_OPTIONS.max_pipeline === 1,
  `max_pipeline is ${POOL_OPTIONS.max_pipeline}`,
);
check(
  "enough sockets for a page's parallel reads (the bookings page issues five)",
  POOL_OPTIONS.max >= 5,
  `max is ${POOL_OPTIONS.max}`,
);
check(
  "but not so many that warm instances starve the pooler",
  POOL_OPTIONS.max <= 10,
  `max is ${POOL_OPTIONS.max}`,
);
check("statements are not prepared (the pooler cannot)", POOL_OPTIONS.prepare === false);
check(
  "a dead pooler fails inside the read deadline",
  POOL_OPTIONS.connect_timeout > 0 && POOL_OPTIONS.connect_timeout * 1000 < 6_000,
);
check("idle sockets are released", POOL_OPTIONS.idle_timeout > 0 && POOL_OPTIONS.idle_timeout <= 60);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
