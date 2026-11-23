import "server-only";

import { cache } from "react";
import { asc, eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { places, type Place } from "@/db/schema";
import { isMissingSchema } from "@/lib/db-error";
import { READ_DEADLINE_MS, withDeadline } from "@/lib/deadline";
import {
  applyVerifiedPlaces,
  type VerifiedPlace,
} from "@/lib/network/verified-places";

export type PlacesState = {
  places: VerifiedPlace[];
  /** False when the read failed and the list is the last one that worked. */
  fresh: boolean;
  /** True when the `places` table does not exist yet. */
  needsMigration: boolean;
};

function toVerified(row: Place): VerifiedPlace {
  return {
    slug: row.slug,
    name: row.name,
    lat: Number(row.lat),
    lng: Number(row.lng),
    anchorSlug: row.anchorSlug,
    accessKm: Number(row.accessKm),
    accessSurface: row.accessSurface === "tar" ? "tar" : "gravel",
    minimumFare: row.minimumFare === null ? null : Number(row.minimumFare),
  };
}

/**
 * The last list that was read successfully, kept for the life of the instance.
 *
 * A quote for a verified lodge must not turn into "we do not know that place"
 * because one read timed out. The stale list is still true — places change a
 * few times a week — and a price computed from it is the price the traveller
 * was shown a minute ago.
 */
const globalForPlaces = globalThis as unknown as {
  __verifiedPlaces?: { at: number; places: VerifiedPlace[] };
};

/** How long an instance trusts its copy before reading again. */
const TTL_MS = 60_000;

async function readPlaces(): Promise<PlacesState> {
  const held = globalForPlaces.__verifiedPlaces;
  if (!isDatabaseConfigured()) {
    return { places: [], fresh: true, needsMigration: false };
  }
  if (held && Date.now() - held.at < TTL_MS) {
    return { places: held.places, fresh: true, needsMigration: false };
  }

  try {
    const rows = await withDeadline("verified places", READ_DEADLINE_MS, () =>
      getDb()
        .select()
        .from(places)
        .where(eq(places.isActive, true))
        .orderBy(asc(places.name)),
    );
    const list = rows.map(toVerified);
    globalForPlaces.__verifiedPlaces = { at: Date.now(), places: list };
    return { places: list, fresh: true, needsMigration: false };
  } catch (error) {
    if (isMissingSchema(error)) {
      // Not an outage: the table has not been created. Say so once per read,
      // and price as the site did before places existed.
      console.warn(
        "[places] the places table does not exist yet — run db/manual/RUN-ME.sql. Pricing towns, gates and airports only.",
      );
      return { places: [], fresh: true, needsMigration: true };
    }
    console.error(
      "[places] could not read verified places — using the last list that loaded",
      error,
    );
    return { places: held?.places ?? [], fresh: false, needsMigration: false };
  }
}

/**
 * Load the verified places and make the road model know them.
 *
 * Call this at the top of anything that prices or resolves a place: the quote
 * page, the booking path, the admin builder, the AI assistant. It is
 * request-scoped and cheap after the first read on an instance. Forgetting to
 * call it costs a lodge its price on that one path — it reads as "unknown
 * place" — and never produces a wrong one.
 */
export const ensureVerifiedPlaces = cache(async (): Promise<PlacesState> => {
  const state = await readPlaces();
  applyVerifiedPlaces(state.places);
  return state;
});

/** Drop the instance's copy so the next read sees a change just saved. */
export function forgetVerifiedPlaces(): void {
  globalForPlaces.__verifiedPlaces = undefined;
}

/** Every row, active or not, for the admin screen. */
export async function listAllPlaces(): Promise<
  { ok: true; rows: Place[] } | { ok: false; needsMigration: boolean }
> {
  if (!isDatabaseConfigured()) return { ok: false, needsMigration: false };
  try {
    const rows = await withDeadline("places admin list", READ_DEADLINE_MS, () =>
      getDb().select().from(places).orderBy(asc(places.name)),
    );
    return { ok: true, rows };
  } catch (error) {
    if (!isMissingSchema(error)) console.error("[places] admin list failed", error);
    return { ok: false, needsMigration: isMissingSchema(error) };
  }
}
