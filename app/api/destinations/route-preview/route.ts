import { NextRequest, NextResponse } from "next/server";

import { MapboxRouteProvider } from "@/lib/maps/mapbox";
import { getPricingConfig, profileFor } from "@/lib/pricing/settings";
import { modelCost } from "@/lib/pricing/cost-model";
import type { Road } from "@/lib/network/roads";
import type { PlaceNode, Region } from "@/lib/network/nodes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOUNDS = { west: 11, south: -29, east: 25, north: -16 };
const REGIONS: Region[] = ["central", "coast", "namib", "damaraland", "north", "zambezi", "south"];

type PointInput = { name?: string; lat?: number; lng?: number; id?: string };

function validPoint(point: PointInput): point is PointInput & { lat: number; lng: number } {
  return typeof point.lat === "number" && Number.isFinite(point.lat) &&
    typeof point.lng === "number" && Number.isFinite(point.lng) &&
    point.lng >= BOUNDS.west && point.lng <= BOUNDS.east &&
    point.lat >= BOUNDS.south && point.lat <= BOUNDS.north;
}

function asNode(point: PointInput & { lat: number; lng: number }, slug: string, backhaul: number): PlaceNode {
  return {
    slug,
    name: (point.name ?? slug).trim().slice(0, 160) || slug,
    region: "south",
    lat: point.lat,
    lng: point.lng,
    backhaul,
    searchOnly: true,
  };
}

/**
 * Route preview for a live-search destination. The server obtains distance
 * from Directions and computes a conservative estimate treating the entire
 * route as gravel. It is not a bookable fare until surface and return logistics
 * have been verified; the response makes that distinction explicit.
 */
export async function POST(request: NextRequest) {
  let body: { origin?: PointInput; destination?: PointInput; vehicleClass?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.origin || !body.destination || !validPoint(body.origin) || !validPoint(body.destination)) {
    return NextResponse.json(
      { error: "Select valid origin and destination coordinates within Namibia." },
      { status: 400 },
    );
  }
  if (Math.abs(body.origin.lat - body.destination.lat) < 0.00001 &&
      Math.abs(body.origin.lng - body.destination.lng) < 0.00001) {
    return NextResponse.json({ error: "Origin and destination must be different." }, { status: 400 });
  }

  const leg = await new MapboxRouteProvider().getLeg(
    { lat: body.origin.lat, lng: body.origin.lng },
    { lat: body.destination.lat, lng: body.destination.lng },
  );
  if (!leg || leg.distanceKm <= 0 || leg.durationMin <= 0) {
    return NextResponse.json(
      { error: "No verified drivable route was returned. Request a manual route review." },
      { status: 422 },
    );
  }

  const origin = asNode(body.origin, "live-origin", 0.15);
  const destination = asNode(body.destination, "live-destination", 0.15);
  const road: Road = {
    origin,
    destination,
    segments: [],
    km: leg.distanceKm,
    tarKm: 0,
    // Conservative provisional assumption: until surface data is verified,
    // cost every kilometre at the higher gravel running rate.
    gravelKm: leg.distanceKm,
    minutes: leg.durationMin,
    via: [],
    roads: [],
    rainNotes: [],
  };

  const config = await getPricingConfig();
  const profile = profileFor(config, body.vehicleClass);
  const cost = modelCost(road, profile, config.constants);

  return NextResponse.json({
    status: "estimate_requires_route_review",
    origin: { name: origin.name, lat: origin.lat, lng: origin.lng },
    destination: { name: destination.name, lat: destination.lat, lng: destination.lng },
    route: {
      distanceKm: leg.distanceKm,
      durationMin: leg.durationMin,
      geometry: leg.encodedGeometry ?? null,
      surfaceAssumption: "all_gravel_conservative_estimate",
    },
    fare: {
      currency: "NAD",
      estimatedCustomerPrice: cost.price,
      estimatedDriverPayout: cost.payout,
      estimatedContribution: cost.contribution,
      returnFactor: cost.returnFactor,
      dutyHours: cost.dutyHours,
      overnightCount: cost.nights,
    },
    bookable: false,
    explanation: "This is a conservative estimate, not a confirmed booking price. Verify road surface, access, vehicle positioning and return/backhaul before making the fare bookable.",
  }, { headers: { "Cache-Control": "no-store, private" } });
}
