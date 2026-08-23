import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * `drizzle-kit generate` only reads the schema, so it must work without a
 * database. Commands that do connect (push/migrate/studio) fail loudly on the
 * empty placeholder rather than silently hitting the wrong database.
 */
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
