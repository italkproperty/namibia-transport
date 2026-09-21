import "server-only";

import { sql } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";

/**
 * Which hand-applied migrations this database is still missing.
 *
 * Schema changes reach production through the Supabase SQL editor, which means
 * a deploy can land with code that expects a column the database has not got.
 * That failure is silent in the worst way — the feature simply does not work,
 * and the operator has no way to tell that from a bug. So the admin panel
 * asks, and says so plainly with the file to run.
 */

const CHECKS: { column: string; table: string; file: string; what: string }[] =
  [
    {
      table: "bookings",
      column: "group_ref",
      file: "db/manual/2026-09-22-quote-groups.sql",
      what: "multi-leg itinerary quotes",
    },
    {
      table: "drivers",
      column: "photo_url",
      file: "db/manual/2026-09-22-quote-groups.sql",
      what: "driver photographs on the booking page",
    },
  ];

export type PendingMigration = { file: string; what: string; column: string };

export async function pendingMigrations(): Promise<PendingMigration[]> {
  if (!isDatabaseConfigured()) return [];

  try {
    const db = getDb();
    const rows = await db.execute<{ table_name: string; column_name: string }>(
      sql`select table_name, column_name from information_schema.columns
          where table_schema = 'public'`,
    );

    const present = new Set(
      (rows as unknown as { table_name: string; column_name: string }[]).map(
        (row) => `${row.table_name}.${row.column_name}`,
      ),
    );

    return CHECKS.filter(
      (check) => !present.has(`${check.table}.${check.column}`),
    ).map((check) => ({
      file: check.file,
      what: check.what,
      column: `${check.table}.${check.column}`,
    }));
  } catch {
    // Cannot introspect — say nothing rather than cry wolf.
    return [];
  }
}
