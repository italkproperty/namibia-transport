import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAMIBIA_BOUNDS = { west: 11, south: -29, east: 25, north: -16 };

type MapboxFeature = {
  id?: string;
  text?: string;
  place_name?: string;
  center?: [number, number];
  place_type?: string[];
  properties?: { category?: string; maki?: string };
};

/**
 * Live, non-persistent search for Namibian destinations. Search results are
 * not stored: a discovered place is not yet a verified, priceable road route.
 */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < 2 || query.length > 120) {
    return NextResponse.json(
      { results: [], error: "Enter 2–120 characters." },
      { status: 400 },
    );
  }

  const token =
    process.env.MAPBOX_SECRET_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { results: [], error: "Live destination search is not configured." },
      { status: 503 },
    );
  }

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("country", "NA");
  url.searchParams.set("language", "en");
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("limit", "8");
  url.searchParams.set("types", "poi,place,locality,address,neighborhood");
  url.searchParams.set(
    "bbox",
    [NAMIBIA_BOUNDS.west, NAMIBIA_BOUNDS.south, NAMIBIA_BOUNDS.east, NAMIBIA_BOUNDS.north].join(","),
  );

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      console.error(`[destination-search] Mapbox returned ${response.status}`);
      return NextResponse.json(
        { results: [], error: "Live destination search is temporarily unavailable." },
        { status: 502 },
      );
    }

    const body = (await response.json()) as { features?: MapboxFeature[] };
    const results = (body.features ?? [])
      .filter((feature) => {
        const center = feature.center;
        if (!center || center.length !== 2) return false;
        const [lng, lat] = center;
        return Number.isFinite(lng) && Number.isFinite(lat) &&
          lng >= NAMIBIA_BOUNDS.west && lng <= NAMIBIA_BOUNDS.east &&
          lat >= NAMIBIA_BOUNDS.south && lat <= NAMIBIA_BOUNDS.north;
      })
      .map((feature) => ({
        id: feature.id ?? "",
        name: feature.text ?? feature.place_name ?? query,
        fullName: feature.place_name ?? feature.text ?? query,
        lat: feature.center![1],
        lng: feature.center![0],
        category: feature.properties?.category ?? feature.place_type?.[0] ?? "place",
        source: "mapbox",
        pricingStatus: "route_verification_required" as const,
      }));

    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    console.error("[destination-search] request failed", error);
    return NextResponse.json(
      { results: [], error: "Live destination search is temporarily unavailable." },
      { status: 502 },
    );
  }
}
