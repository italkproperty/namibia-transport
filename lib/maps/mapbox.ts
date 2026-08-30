import type { LatLng, RouteLeg, RouteProvider } from "./types";

/**
 * Mapbox, behind the RouteProvider interface that was defined for it.
 *
 * Two tokens, because they do different jobs. The public token (pk.…) is meant
 * to sit in a browser and is what signs static-image and GL JS requests; keep
 * it URL-restricted in the Mapbox console so a scraped copy is worthless.
 * MAPBOX_SECRET_TOKEN, when set, signs the server-side Directions calls
 * instead, so route measurement does not spend the browser token's quota.
 *
 * Everything here degrades to null rather than throwing. A missing token or a
 * route without coordinates should quietly render no map, never break a page.
 */

const DIRECTIONS_BASE = "https://api.mapbox.com/directions/v5/mapbox/driving";
const STATIC_BASE = "https://api.mapbox.com/styles/v1/mapbox";

export function publicMapboxToken(): string | null {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || null;
}

function serverMapboxToken(): string | null {
  return process.env.MAPBOX_SECRET_TOKEN?.trim() || publicMapboxToken();
}

export function isMapboxConfigured(): boolean {
  return publicMapboxToken() !== null;
}

/** Mapbox orders coordinates lng,lat — the reverse of how we read them aloud. */
function toPair({ lat, lng }: LatLng): string {
  return `${lng.toFixed(6)},${lat.toFixed(6)}`;
}

export class MapboxRouteProvider implements RouteProvider {
  readonly name = "mapbox";

  async getLeg(origin: LatLng, destination: LatLng): Promise<RouteLeg | null> {
    const token = serverMapboxToken();
    if (!token) return null;

    const url = new URL(
      `${DIRECTIONS_BASE}/${toPair(origin)};${toPair(destination)}`,
    );
    url.searchParams.set("access_token", token);
    // Polyline6 keeps six decimals of precision, which matters over the
    // 400km legs — polyline5 visibly corners on long desert curves.
    url.searchParams.set("geometries", "polyline6");
    url.searchParams.set("overview", "full");

    try {
      // Cacheable on purpose. `no-store` would opt any page that calls this
      // out of static rendering, which would quietly turn the prerendered SEO
      // route pages into server-rendered ones. A road does not move.
      const response = await fetch(url, {
        next: { revalidate: 60 * 60 * 24 * 30 },
      });
      if (!response.ok) {
        console.error(
          `[mapbox] directions failed: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const body = (await response.json()) as {
        routes?: { distance?: number; duration?: number; geometry?: string }[];
      };
      const leg = body.routes?.[0];
      if (!leg?.distance || !leg.duration) return null;

      return {
        distanceKm: Math.round((leg.distance / 1000) * 10) / 10,
        durationMin: Math.round(leg.duration / 60),
        encodedGeometry: leg.geometry ?? undefined,
      };
    } catch (error) {
      console.error("[mapbox] directions request threw", error);
      return null;
    }
  }
}

export type StaticMapOptions = {
  origin: LatLng;
  destination: LatLng;
  /** Encoded polyline from Directions. Without it the map shows two pins. */
  encodedGeometry?: string | null;
  width?: number;
  height?: number;
  /** 2 for retina. Mapbox caps static images at 1280px before the @2x. */
  retina?: boolean;
};

/**
 * A static image of one route — no JavaScript, no map library, just an <img>.
 *
 * Route pages are read far more often than they are interacted with, so a
 * picture of the drive beats an interactive canvas that costs 200KB to load.
 */
export function staticRouteMapUrl({
  origin,
  destination,
  encodedGeometry,
  width = 1200,
  height = 500,
  retina = true,
}: StaticMapOptions): string | null {
  const token = publicMapboxToken();
  if (!token) return null;

  const overlays: string[] = [];

  if (encodedGeometry) {
    // path-{width}+{colour}-{opacity}({polyline}) — brand amber, matching the
    // route stroke in the logo.
    overlays.push(`path-4+bc4b00-0.9(${encodeURIComponent(encodedGeometry)})`);
  }

  overlays.push(`pin-s+1a1614(${toPair(origin)})`);
  overlays.push(`pin-s+bc4b00(${toPair(destination)})`);

  const size = `${Math.min(width, 1280)}x${Math.min(height, 1280)}${retina ? "@2x" : ""}`;
  const url = new URL(
    `${STATIC_BASE}/streets-v12/static/${overlays.join(",")}/auto/${size}`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("padding", "60");

  return url.toString();
}

/**
 * A static image of one dropped pin, for the confirmation page and the
 * dispatch board. Same reasoning as the route map: these are looked at far
 * more often than they are interacted with, so an <img> beats 230KB of canvas.
 */
export function staticPinMapUrl({
  point,
  zoom = 15,
  width = 640,
  height = 320,
  retina = true,
}: {
  point: LatLng;
  zoom?: number;
  width?: number;
  height?: number;
  retina?: boolean;
}): string | null {
  const token = publicMapboxToken();
  if (!token) return null;

  const size = `${Math.min(width, 1280)}x${Math.min(height, 1280)}${retina ? "@2x" : ""}`;
  const url = new URL(
    `${STATIC_BASE}/streets-v12/static/pin-l+bc4b00(${toPair(point)})/${toPair(point)},${zoom},0/${size}`,
  );
  url.searchParams.set("access_token", token);

  return url.toString();
}
