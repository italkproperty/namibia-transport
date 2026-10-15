import "server-only";

import { sql } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { withDeadline } from "@/lib/deadline";

/**
 * Check only the specific columns required by features that use hand-applied
 * migrations. Do not scan the entire information_schema: on a busy/slow
 * Supabase instance that catalogue query can hold the whole pricing page open.
 */

const CHECKS: { column: string; table: string; file: string; what: string }[] =
  [
    {
      table: "bookings",
      column: "group_ref",
      file: "db/manual/RUN-ME.sql",
      what: "multi-leg itinerary quotes",
    },
    {
      table: "drivers",
      column: "photo_url",
      file: "db/manual/RUN-ME.sql",
      what: "driver photographs on the booking page",
    },
    {
      table: "pricing_settings",
      column: "charter_target_contribution_margin",
      file: "db/manual/RUN-ME.sql",
      what: "charter contribution-margin and payment-fee settings",
    },
    {
      table: "charter_vehicle_cost_profiles",
      column: "vehicle_class_id",
      file: "db/manual/RUN-ME.sql",
      what: "separate charter fuel and non-fuel vehicle profiles",
    },
    {
      table: "charter_quotes",
      column: "quote_number",
      file: "db/manual/RUN-ME.sql",
      what: "persisted charter quote drafts and version history",
    },
    {
      table: "charter_quote_versions",
      column: "quote_id",
      file: "db/manual/RUN-ME.sql",
      what: "immutable charter quote version snapshots",
    },
  ];

export type PendingMigration = { file: string; what: string; column: string };

export async function pendingMigrations(): Promise<PendingMigration[]> {
  if (!isDatabaseConfigured()) return [];

  try {
    const db = getDb();
    const rows = await withDeadline(
      "required migration checks",
      4_000,
      () =>
        db.execute<{ table_name: string; column_name: string }>(sql`
          SELECT expected.table_name, expected.column_name
          FROM (
            VALUES
              ('bookings', 'group_ref'),
              ('drivers', 'photo_url'),
              ('pricing_settings', 'charter_target_contribution_margin'),
              ('charter_vehicle_cost_profiles', 'vehicle_class_id'),
              ('charter_quotes', 'quote_number'),
              ('charter_quote_versions', 'quote_id')
          ) AS expected(table_name, column_name)
          LEFT JOIN information_schema.columns AS actual
            ON actual.table_schema = 'public'
           AND actual.table_name = expected.table_name
           AND actual.column_name = expected.column_name
          WHERE actual.column_name IS NULL
        `),
    );

    return (rows as unknown as { table_name: string; column_name: string }[])
      .flatMap((row) => {
        const check = CHECKS.find(
          (item) => item.table === row.table_name && item.column === row.column_name,
        );
        return check
          ? [{
              file: check.file,
              what: check.what,
              column: `${check.table}.${check.column}`,
            }]
          : [];
      });
  } catch (error) {
    // A slow schema introspection must never take down the pricing screen.
    console.warn("[admin-migrations] migration status unavailable", error);
    return [];
  }
}
