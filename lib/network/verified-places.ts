import { NODES_BY_SLUG, setVerifiedNodes, type PlaceNode } from "./nodes";
import { setAccessRoads, type RoadEdge, type Surface } from "./roads";

/**
 * A place an operator has pinned and measured, as plain data.
 *
 * Plain because it crosses the server/client line: the server reads these
 * from the database and hands them to the quote surface as a prop, and both
 * sides call `applyVerifiedPlaces` with the same list so the browser prices
 * exactly what the server will.
 */
export type VerifiedPlace = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  /** The node of the road model the access drive starts from. */
  anchorSlug: string;
  /** The measured drive from the anchor to the door. */
  accessKm: number;
  accessSurface: Surface;
  minimumFare: number | null;
};

/**
 * How close to its anchor a place has to be to share the anchor's market.
 * A guest farm at the airport turn-off is, for a driver, the airport: a car
 * dropping there is as near its next fare as one dropping at arrivals. A lodge
 * forty kilometres down a district road is a terminus, and the car comes home
 * empty.
 */
const SHARES_ANCHOR_MARKET_KM = 10;
const TERMINUS_BACKHAUL = 0.15;

let applied = "";

/**
 * Make these the verified places the road model knows. Idempotent: applying
 * the same list again does nothing, so it is safe in a render path.
 *
 * A place whose anchor is not a built-in node is dropped rather than guessed
 * at — a typo in an anchor must cost one lodge its price, not send a quote
 * down a road that does not exist.
 */
export function applyVerifiedPlaces(places: VerifiedPlace[]): void {
  const signature = JSON.stringify(places);
  if (signature === applied) return;

  const nodes: PlaceNode[] = [];
  const edges: RoadEdge[] = [];

  for (const place of places) {
    const anchor = NODES_BY_SLUG.get(place.anchorSlug);
    if (!anchor) continue;
    if (!(place.accessKm > 0) || !Number.isFinite(place.accessKm)) continue;
    if (NODES_BY_SLUG.has(place.slug)) continue;

    nodes.push({
      slug: place.slug,
      name: place.name,
      region: anchor.region,
      lat: place.lat,
      lng: place.lng,
      backhaul:
        place.accessKm <= SHARES_ANCHOR_MARKET_KM
          ? anchor.backhaul
          : TERMINUS_BACKHAUL,
      verified: { anchor: anchor.slug, minimumFare: place.minimumFare },
    });
    edges.push({
      from: anchor.slug,
      to: place.slug,
      km: place.accessKm,
      surface: place.accessSurface,
      road: "access road",
    });
  }

  setVerifiedNodes(nodes);
  setAccessRoads(edges);
  applied = signature;
}
