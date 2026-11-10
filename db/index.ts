import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { onDeadlineExceeded } from "@/lib/deadline";

import * as schema from "./schema";

/**
 * The client is built on first use rather than at import time, so pages that
 * only need the static catalogue still render when DATABASE_URL is absent.
 */
const globalForDb = globalThis as unknown as {
  __transferSql?: ReturnType<typeof postgres>;
  __transferDb?: ReturnType<typeof buildDb>;
  __deadlineListenerRegistered?: boolean;
};

/**
 * The pool's shape, exported so a test can hold it.
 *
 * ## Never pipeline through the transaction pooler
 *
 * This is the finding that explains six weeks of `/admin/bookings` timeouts
 * and the quote page "crashing", and it took a wire-level trace in production
 * to see. postgres.js pipelines: when a connection is busy it writes the next
 * statement to the same socket without waiting for a reply, up to
 * `max_pipeline` (default 100) in flight. Supabase's transaction-mode pooler
 * (Supavisor) does not cope with that. The trace showed one statement on a
 * socket answering in 660ms, two together answering, and four written in the
 * same millisecond never answering at all — 5.2 seconds of silence, then every
 * deadline on the page. A fresh socket, one statement at a time, was clean.
 *
 * `max_pipeline: 1` means one statement in flight per socket, ever. A page's
 * parallel reads then each need a socket of their own, which is what `max`
 * is for: six covers the busiest admin page's first wave. Lowering `max` to 1
 * in October, to spare the pooler, had the opposite effect — it forced every
 * parallel read onto one socket, which is exactly the pipelining that hangs.
 *
 * The other options keep sockets from being held: a warm instance that served
 * one booking at 06:00 must not still be holding six connections at noon.
 */
export const POOL_OPTIONS = {
  // Supabase's transaction pooler cannot prepare statements.
  prepare: false,
  // A pooler that will not accept a connection fails in five seconds, inside
  // the six-second read deadline, so the catch blocks run and the page can
  // say what broke instead of a 504.
  connect_timeout: 5,
  // One statement in flight per socket. See above — this is load-bearing.
  max_pipeline: 1,
  // Enough sockets for one page's parallel reads to each get their own.
  max: 6,
  // Release idle sockets quickly; the pooler counts them against the limit.
  idle_timeout: 20,
  // The pooler recycles server-side; a client that never retires a socket
  // eventually hands a query to one that has already gone.
  max_lifetime: 60 * 30,
} as const;

function buildDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — see .env.example");
  }

  // Supabase's direct host (db.<ref>.supabase.co) resolves to IPv6 only, and
  // Vercel's serverless functions have no IPv6 egress — every query dies with
  // ENOTFOUND before a socket is opened. Pages still render from the
  // catalogue fallback, so the only visible symptom is that writes fail,
  // which reads as a database problem rather than a connection-string one.
  // Say it plainly instead of leaving it to be inferred from a DNS error.
  if (
    process.env.VERCEL &&
    /@db\.[a-z0-9]+\.supabase\.co/.test(connectionString)
  ) {
    console.error(
      "[db] DATABASE_URL points at Supabase's direct connection, which is IPv6-only and unreachable from Vercel. " +
        "Use the transaction pooler instead: host aws-0-<region>.pooler.supabase.com, port 6543, " +
        "username postgres.<project-ref>.",
    );
  }

  const client =
    globalForDb.__transferSql ??
    postgres(connectionString, {
      ...POOL_OPTIONS,
      // Wire-level trace, kept for one more deploy to verify the pipelining
      // fix on the production pooler: it should show at most one statement
      // per socket between replies. Remove with the next change here.
      debug: (connection, query) => {
        console.info(
          `[db] #${connection} -> ${query.replace(/\s+/g, " ").slice(0, 70)}`,
        );
      },
    });

  globalForDb.__transferSql = client;

  return drizzle(client, { schema });
}

/** True when a database is configured. Never assumes it is also reachable. */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Throws when no database is configured — use for writes, which need one.
 *
 * The cache is not a development convenience. It used to be written only when
 * `NODE_ENV !== "production"`, which is the Next.js hot-reload idiom applied
 * backwards: in production every one of the forty-odd call sites built its own
 * pool, so a single request could open several and a warm instance never
 * closed them. The pooler's connection limit is per project and shared, and
 * the symptom of exhausting it is not an error page — queries fail, the
 * catalogue fallback renders, and an operator sees an admin table that is
 * simply empty. One pool per instance, in both environments.
 */
export function getDb() {
  const db = globalForDb.__transferDb ?? buildDb();
  globalForDb.__transferDb = db;
  return db;
}

/**
 * Abandon the current pool so the next `getDb()` opens a fresh one.
 *
 * Why this exists: a deadline rejecting does not cancel the query, so the one
 * socket this instance is allowed (`max: 1`) stays busy on a statement that
 * will never answer. Every query after it queues behind that socket; the reads
 * die at their own deadlines and the writes — which had none — hang until the
 * platform kills the function. That is the admin panel "crashing when making a
 * quote", reproduced locally from one stalled connection.
 *
 * `end` is not awaited. We are not waiting for the dead socket to be polite;
 * we are walking away from it. Queries still queued on the old client are
 * rejected as it closes, which is what their catch blocks are for, and the
 * socket itself is destroyed after a one-second grace rather than held for the
 * remainder of `max_lifetime`.
 */
export function retireDb(reason: string): void {
  const client = globalForDb.__transferSql;
  globalForDb.__transferSql = undefined;
  globalForDb.__transferDb = undefined;
  if (!client) return;

  console.warn(`[db] retiring the connection pool: ${reason}`);
  void client.end({ timeout: 1 }).catch(() => undefined);
}

// Register once per process: the listener set lives in lib/deadline, and this
// module is itself cached on globalThis, so a hot reload cannot double it.
if (!globalForDb.__deadlineListenerRegistered) {
  globalForDb.__deadlineListenerRegistered = true;
  onDeadlineExceeded((error) => retireDb(error.message));
}

export { schema };
