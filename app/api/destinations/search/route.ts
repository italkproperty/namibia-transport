import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOUNDS = { west: 11, south: -29, east: 25, north: -16 };

type Result = {
  id: string; name: string; fullName: string; lat: number; lng: number;
  category: string; source: "mapbox" | "openstreetmap"; pricingStatus: "route_verification_required";
};

function inNamibia(lng: number, lat: number) {
  return Number.isFinite(lng) && Number.isFinite(lat) &&
    lng >= BOUNDS.west && lng <= BOUNDS.east &&
    lat >= BOUNDS.south && lat <= BOUNDS.north;
}

/**
 * Search named Namibian destinations. Mapbox Search Box currently documents
 * supported geographies as US, Canada and Europe, so it cannot be the sole
 * source for Namibia. Try it first, then fall back to OpenStreetMap's global
 * Nominatim index for Namibian POIs such as mines and lodges. Search results
 * are transient; coordinates are not persisted by this endpoint.
 */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < 3 || query.length > 120) {
    return NextResponse.json({ results: [], error: "Enter 3–120 characters." }, { status: 400 });
  }

  const token = process.env.MAPBOX_SECRET_TOKEN?.trim() || process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
  const results: Result[] = [];

  if (token) {
    const url = new URL("https://api.mapbox.com/search/searchbox/v1/forward");
    url.searchParams.set("q", query);
    url.searchParams.set("access_token", token);
    url.searchParams.set("country", "NA");
    url.searchParams.set("language", "en");
    url.searchParams.set("limit", "10");
    url.searchParams.set("types", "poi,place,locality,address,street,neighborhood");
    url.searchParams.set("bbox", [BOUNDS.west, BOUNDS.south, BOUNDS.east, BOUNDS.north].join(","));
    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const body = await response.json() as { features?: Array<{ id?: string; geometry?: { coordinates?: [number, number] }; properties?: { name?: string; full_address?: string; place_formatted?: string; feature_type?: string; poi_category?: string[] } }> };
        for (const feature of body.features ?? []) {
          const coords = feature.geometry?.coordinates;
          if (!coords || !inNamibia(coords[0], coords[1])) continue;
          const p = feature.properties ?? {};
          const name = p.name?.trim() || query;
          results.push({
            id: feature.id ?? `${name}-${coords[1]}-${coords[0]}`,
            name,
            fullName: p.full_address || [name, p.place_formatted].filter(Boolean).join(", "),
            lng: coords[0], lat: coords[1],
            category: p.poi_category?.[0] ?? p.feature_type ?? "place",
            source: "mapbox", pricingStatus: "route_verification_required",
          });
        }
      } else {
        console.warn(`[destination-search] Mapbox Search Box returned ${response.status}`);
      }
    } catch (error) {
      console.warn("[destination-search] Mapbox search unavailable", error);
    }
  }

  // Global OSM fallback is essential for Namibian mines and remote facilities.
  // Do not run it on every keystroke: the UI debounces and this endpoint only
  // accepts queries of 3+ characters. For production-scale traffic, replace
  // the public Nominatim endpoint with a contracted geocoder or self-hosted OSM.
  if (results.length === 0) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", `${query}, Namibia`);
    url.searchParams.set("countrycodes", "na");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "8");
    url.searchParams.set("viewbox", [BOUNDS.west, BOUNDS.north, BOUNDS.east, BOUNDS.south].join(","));
    url.searchParams.set("bounded", "1");
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { "User-Agent": "NamibiaTransport/1.0 (destination search; contact: support@namibiatransport.com)" },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const body = await response.json() as Array<{ place_id?: number; osm_type?: string; osm_id?: number; name?: string; display_name?: string; lat?: string; lon?: string; type?: string; category?: string }>;
        for (const item of body) {
          const lat = Number(item.lat), lng = Number(item.lon);
          if (!inNamibia(lng, lat)) continue;
          const name = item.name?.trim() || item.display_name?.split(",")[0]?.trim() || query;
          results.push({
            id: `osm-${item.osm_type ?? "place"}-${item.osm_id ?? item.place_id ?? `${lat}-${lng}`}`,
            name, fullName: item.display_name ?? name, lat, lng,
            category: item.type ?? item.category ?? "place",
            source: "openstreetmap", pricingStatus: "route_verification_required",
          });
        }
      } else {
        console.warn(`[destination-search] OpenStreetMap returned ${response.status}`);
      }
    } catch (error) {
      console.warn("[destination-search] OpenStreetMap fallback unavailable", error);
    }
  }

  return NextResponse.json(
    { results: results.slice(0, 10) },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
