import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAMIBIA_BOUNDS = { west: 11, south: -29, east: 25, north: -16 };

type SearchBoxFeature = {
  id?: string;
  type?: string;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    full_address?: string;
    place_formatted?: string;
    feature_type?: string;
    poi_category?: string[];
    maki?: string;
  };
};

/**
 * Search Box is used rather than the legacy Geocoding POI index because this
 * journey planner must find businesses and named facilities (including mines),
 * not only settlements. Results are transient and never persisted here.
 */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < 2 || query.length > 120) {
    return NextResponse.json({ results: [], error: "Enter 2–120 characters." }, { status: 400 });
  }

  const token = process.env.MAPBOX_SECRET_TOKEN?.trim() || process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ results: [], error: "Live destination search is not configured." }, { status: 503 });
  }

  const url = new URL("https://api.mapbox.com/search/searchbox/v1/forward");
  url.searchParams.set("q", query);
  url.searchParams.set("access_token", token);
  url.searchParams.set("country", "NA");
  url.searchParams.set("language", "en");
  url.searchParams.set("limit", "10");
  url.searchParams.set("types", "poi,place,locality,address,street,neighborhood");
  url.searchParams.set("bbox", [NAMIBIA_BOUNDS.west, NAMIBIA_BOUNDS.south, NAMIBIA_BOUNDS.east, NAMIBIA_BOUNDS.north].join(","));

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      console.error(`[destination-search] Mapbox Search Box returned ${response.status}`);
      return NextResponse.json({ results: [], error: "Live destination search is temporarily unavailable." }, { status: 502 });
    }

    const body = (await response.json()) as { features?: SearchBoxFeature[] };
    const results = (body.features ?? []).flatMap((feature) => {
      const coordinates = feature.geometry?.coordinates;
      if (!coordinates || coordinates.length !== 2) return [];
      const [lng, lat] = coordinates;
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < NAMIBIA_BOUNDS.west || lng > NAMIBIA_BOUNDS.east || lat < NAMIBIA_BOUNDS.south || lat > NAMIBIA_BOUNDS.north) return [];
      const props = feature.properties ?? {};
      const name = props.name?.trim() || query;
      const fullName = props.full_address?.trim() || [name, props.place_formatted].filter(Boolean).join(", ");
      return [{
        id: feature.id ?? `${name}-${lat}-${lng}`,
        name,
        fullName,
        lat,
        lng,
        category: props.poi_category?.[0] ?? props.feature_type ?? "place",
        source: "mapbox" as const,
        pricingStatus: "route_verification_required" as const,
      }];
    });

    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("[destination-search] request failed", error);
    return NextResponse.json({ results: [], error: "Live destination search is temporarily unavailable." }, { status: 502 });
  }
}
