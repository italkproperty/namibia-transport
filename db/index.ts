import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * The client is built on first use rather than at import time, so pages that
 * only need the static catalogue still render when DATABASE_URL is absent.
 */
const globalForDb = globalThis as unknown as {
  __transferSql?: ReturnType<typeof postgres>;
  __transferDb?: ReturnType<typeof buildDb>;
};

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
      // Supabase's transaction pooler cannot prepare statements.
      prepare: false,
      // Without this a pooler that is not answering — wrong host, connection
      // limit reached, credentials rotated — leaves the query hanging until
      // Vercel kills the whole function. The operator gets
      // 504 FUNCTION_INVOCATION_TIMEOUT, which says nothing about what
      // failed, and /admin/bookings is unreachable with money waiting to be
      // confirmed on it. Ten seconds is far longer than a healthy connect and
      // short enough to fail inside the function's own budget, so the catch
      // blocks run and the page can say what broke.
      connect_timeout: 10,
      // Per serverless instance, not per deployment. Vercel runs many of these
      // at once and they all share one pooler, so a generous number here is
      // multiplied by however many instances are warm.
      max: 4,
      // Without this, postgres.js holds every socket it ever opened. A warm
      // instance that served one booking at 06:00 was still holding four
      // connections at noon, and the pooler counts them against the limit all
      // day. Twenty seconds is longer than any request here takes.
      idle_timeout: 20,
      // The pooler recycles server-side; a client that never retires a socket
      // eventually hands a query to one that has already gone.
      max_lifetime: 60 * 30,
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

export { schema };
