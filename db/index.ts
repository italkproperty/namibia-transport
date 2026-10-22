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
      // Bound query execution as well as connection establishment. A stalled
      // pooler/query must reject so server actions can return an actionable
      // error instead of leaving admin forms spinning until Vercel kills them.
      // Keep below the usual serverless request budget so catch/finally paths run.
      connect_timeout: 5,
      query_timeout: 7_000,
      // Per serverless instance, not per deployment. Vercel runs many of these
      // at once and they all share one pooler, so a generous number here is
      // multiplied by however many instances are warm.
      // One socket per warm instance limits pressure on Supavisor.
      max: 1,
      // Release idle sockets so warm serverless instances do not consume pooler
      // connections indefinitely.
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
 * The client is cached once per serverless instance in both environments.
 */
export function getDb() {
  const db = globalForDb.__transferDb ?? buildDb();
  globalForDb.__transferDb = db;
  return db;
}

export { schema };
