import { config } from "dotenv";

/**
 * Next.js loads .env.local automatically; standalone CLI scripts (drizzle-kit,
 * tsx) do not. Load it explicitly, with .env as the fallback, so `npm run
 * db:*` reads the same values the app does.
 */
config({ path: [".env.local", ".env"], quiet: true });

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — copy .env.example to .env.local and fill it in"
    );
  }
  return url;
}
