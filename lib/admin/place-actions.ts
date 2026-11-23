"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { places } from "@/db/schema";
import { getAdminGateState } from "@/lib/admin/auth";
import { describeDbError, isMissingSchema } from "@/lib/db-error";
import { WRITE_DEADLINE_MS, withDeadline } from "@/lib/deadline";
import { isInNamibia } from "@/lib/maps/bounds";
import { isMapboxConfigured, MapboxRouteProvider } from "@/lib/maps/mapbox";
import { NODES_BY_SLUG } from "@/lib/network/nodes";
import { nearestRoadNode } from "@/lib/network/place-resolution";
import { forgetVerifiedPlaces } from "@/lib/places/queries";
import { parseCoordinates, placeSlug } from "@/lib/places/slug";

/**
 * Verifying a place: pin it, measure the drive to it, save it.
 *
 * Two steps on purpose. Measuring shows the operator what Directions found —
 * the anchor it chose, the kilometres, the minutes — before anything is
 * stored, because a pin dropped on the wrong farm produces a confident,
 * wrong number and the only check is a person who knows the road looking at
 * it. Saving then records what was confirmed, and whether the distance was
 * measured or typed.
 */

export type MeasureState =
  | {
      ok: true;
      lat: number;
      lng: number;
      anchorSlug: string;
      anchorName: string;
      /** Straight line from the anchor: a sanity check on the measured drive. */
      straightKm: number;
      measuredKm: number | null;
      measuredMin: number | null;
      note: string | null;
    }
  | { ok: false; message: string }
  | null;

export async function measurePlaceAction(
  _previous: MeasureState,
  formData: FormData,
): Promise<MeasureState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Sign in first." };

  const point = parseCoordinates(String(formData.get("coordinates") ?? ""));
  if (!point) {
    return {
      ok: false,
      message:
        "Paste the pin as latitude, longitude (for example -22.4712, 17.4655) or a Google Maps link to the place.",
    };
  }
  if (!isInNamibia(point)) {
    return {
      ok: false,
      message: `That pin (${point.lat}, ${point.lng}) is not in Namibia. Latitude comes first and is negative here.`,
    };
  }

  const requested = String(formData.get("anchorSlug") ?? "").trim();
  const chosen = requested ? NODES_BY_SLUG.get(requested) : null;
  const nearest = nearestRoadNode(point);
  const anchor = chosen ?? nearest?.node ?? null;
  if (!anchor) {
    return {
      ok: false,
      message:
        "No town, gate or airport of the road model is within 120 km of that pin. Check the coordinates, or choose the anchor yourself.",
    };
  }
  const straightKm =
    chosen && nearest?.node.slug !== chosen.slug
      ? (nearestRoadNodeDistance(point, chosen) ?? 0)
      : (nearest?.km ?? 0);

  if (!isMapboxConfigured()) {
    return {
      ok: true,
      ...point,
      anchorSlug: anchor.slug,
      anchorName: anchor.name,
      straightKm,
      measuredKm: null,
      measuredMin: null,
      note: "Mapbox is not configured on this deployment, so the drive could not be measured. Enter the access distance yourself.",
    };
  }

  const leg = await new MapboxRouteProvider().getLeg(
    { lat: anchor.lat, lng: anchor.lng },
    point,
  );
  if (!leg || !(leg.distanceKm > 0)) {
    return {
      ok: true,
      ...point,
      anchorSlug: anchor.slug,
      anchorName: anchor.name,
      straightKm,
      measuredKm: null,
      measuredMin: null,
      note: "Directions found no drivable road to that pin. Farm tracks are often unmapped: enter the distance yourself, or move the pin to the gate.",
    };
  }

  return {
    ok: true,
    ...point,
    anchorSlug: anchor.slug,
    anchorName: anchor.name,
    straightKm,
    measuredKm: Math.round(leg.distanceKm * 10) / 10,
    measuredMin: Math.round(leg.durationMin),
    note:
      leg.distanceKm > straightKm * 2.5 + 15
        ? "The measured drive is much longer than the straight line. Check the pin is on the right side of a river or fence before saving."
        : null,
  };
}

function nearestRoadNodeDistance(
  point: { lat: number; lng: number },
  node: { lat: number; lng: number },
): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(node.lat - point.lat) / 2) ** 2 +
    Math.cos(rad(point.lat)) * Math.cos(rad(node.lat)) * Math.sin(rad(node.lng - point.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type SavePlaceState =
  | { ok: true; slug: string; name: string }
  | { ok: false; message: string }
  | null;

export async function savePlaceAction(
  _previous: SavePlaceState,
  formData: FormData,
): Promise<SavePlaceState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Sign in first." };
  if (!isDatabaseConfigured()) return { ok: false, message: "No database is configured." };

  const field = (key: string) => String(formData.get(key) ?? "").trim();

  const name = field("name").slice(0, 120);
  if (name.length < 3) return { ok: false, message: "Give the place its real name." };
  const slug = placeSlug(name);
  if (!slug) return { ok: false, message: "That name has no letters in it." };
  if (NODES_BY_SLUG.has(slug)) {
    return {
      ok: false,
      message: `${name} is already a place on the road model. It does not need verifying.`,
    };
  }

  const lat = Number(field("lat"));
  const lng = Number(field("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInNamibia({ lat, lng })) {
    return { ok: false, message: "Measure the pin first — the coordinates are missing or outside Namibia." };
  }

  const anchorSlug = field("anchorSlug");
  if (!NODES_BY_SLUG.has(anchorSlug)) {
    return { ok: false, message: "Choose the town, gate or airport the access road starts from." };
  }

  const accessKm = Number(field("accessKm").replace(",", "."));
  if (!Number.isFinite(accessKm) || accessKm <= 0 || accessKm > 300) {
    return {
      ok: false,
      message: "The access distance must be the kilometres from the anchor to the door: more than 0, at most 300.",
    };
  }

  const accessSurface = field("accessSurface") === "tar" ? "tar" : "gravel";

  const floorRaw = field("minimumFare").replace(/[\s,]/g, "");
  const minimumFare = floorRaw ? Number(floorRaw) : null;
  if (minimumFare !== null && (!Number.isFinite(minimumFare) || minimumFare <= 0 || minimumFare > 100_000)) {
    return { ok: false, message: "The minimum fare must be an amount in N$, or left blank." };
  }

  // Recorded as measured only when the saved figure is the one Directions
  // returned. A number the operator changed is the operator's, and says so.
  const measuredKm = Number(field("measuredKm"));
  const measuredBy =
    Number.isFinite(measuredKm) && measuredKm > 0 && Math.abs(measuredKm - accessKm) < 0.05
      ? "mapbox"
      : "operator";

  const values = {
    slug,
    name,
    lat: lat.toFixed(6),
    lng: lng.toFixed(6),
    anchorSlug,
    accessKm: accessKm.toFixed(2),
    accessSurface,
    measuredBy,
    minimumFare: minimumFare === null ? null : minimumFare.toFixed(2),
    isActive: true,
    updatedAt: new Date(),
  };

  try {
    await withDeadline("save place", WRITE_DEADLINE_MS, () =>
      getDb()
        .insert(places)
        .values(values)
        // Verifying a place again corrects it: same name, same slug, same
        // links. A second row for one lodge would be two prices for one door.
        .onConflictDoUpdate({ target: places.slug, set: values }),
    );
  } catch (error) {
    console.error("[places] save failed", error);
    if (isMissingSchema(error)) {
      return {
        ok: false,
        message: "The places table does not exist yet. Run the places block at the bottom of db/manual/RUN-ME.sql in Supabase, then save again.",
      };
    }
    return { ok: false, message: describeDbError(error, "Could not save the place.") };
  }

  forgetVerifiedPlaces();
  revalidatePath("/admin/places");
  revalidatePath("/journey");
  return { ok: true, slug, name };
}

export type TogglePlaceState = { ok: boolean; message?: string } | null;

/** Stop pricing a place, or start again. The row and its history stay. */
export async function setPlaceActiveAction(
  _previous: TogglePlaceState,
  formData: FormData,
): Promise<TogglePlaceState> {
  const gate = await getAdminGateState();
  if (gate.state !== "signed-in") return { ok: false, message: "Sign in first." };
  if (!isDatabaseConfigured()) return { ok: false, message: "No database is configured." };

  const id = String(formData.get("id") ?? "").trim();
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return { ok: false, message: "Which place?" };

  try {
    await withDeadline("toggle place", WRITE_DEADLINE_MS, () =>
      getDb()
        .update(places)
        .set({ isActive: active, updatedAt: new Date() })
        .where(eq(places.id, id)),
    );
  } catch (error) {
    console.error("[places] toggle failed", error);
    return { ok: false, message: describeDbError(error, "Could not change that place.") };
  }

  forgetVerifiedPlaces();
  revalidatePath("/admin/places");
  revalidatePath("/journey");
  return { ok: true };
}
