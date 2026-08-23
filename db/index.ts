import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env.local");
}

/**
 * Reused across hot reloads in dev, otherwise every refresh opens a new pool
 * and Supabase runs out of connections.
 */
const globalForDb = globalThis as unknown as {
  __transferSql?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__transferSql ??
  postgres(connectionString, {
    // Supabase's transaction pooler cannot prepare statements.
    prepare: false,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__transferSql = client;
}

export const db = drizzle(client, { schema });
export { schema };
