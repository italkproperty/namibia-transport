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
      // Bound connection establishment so a broken pooler fails promptly.
      // postgres.js query_timeout is not supported by this project's installed
      // version; do not configure an option that breaks the production build.
      connect_timeout: 5,
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

/** Throws when no database is configured — use for writes, which need one. */
export function getDb() {
  const db = globalForDb.__transferDb ?? buildDb();
  globalForDb.__transferDb = db;
  return db;
}

export { schema };
