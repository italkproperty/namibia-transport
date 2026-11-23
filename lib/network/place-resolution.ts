import { findNode, PLACE_NODES, SEARCH_PLACES, type PlaceNode } from "./nodes";
import { findRoad } from "./roads";

export type ResolvedPlace = {
  query: string;
  slug: string | null;
  nodeName: string | null;
  matchedBy: "routing_node" | "alias" | "nearest_node" | "unresolved";
  confidence: "high" | "medium" | "low";
  note: string | null;
};

export type RouteLegIntelligence = {
  from: ResolvedPlace;
  to: ResolvedPlace;
  km: number | null;
  drivingMinutes: number | null;
  roads: string[];
  via: string[];
  routable: boolean;
};

const ALIASES: Record<string, string> = {
  "namib desert lodge": "solitaire",
  "namib desert lodge gondwana": "solitaire",
  "namib desert camping2go": "solitaire",
  "namib desert campsite": "solitaire",
  "the desert grace": "solitaire",
  "desert grace": "solitaire",
  "desert whisper": "solitaire",
  "sossusvlei lodge": "sossusvlei",
  "sossusvlei lodge campsite": "sossusvlei",
  "sesriem": "sossusvlei",
  "sesriem gate": "sossusvlei",
  "sossusvlei": "sossusvlei",
  "deadvlei": "sossusvlei",
  "dead vlei": "sossusvlei",
  "sossus vlei": "sossusvlei",
  "sossusvlei deadvlei": "sossusvlei",
  "deadvlei sossusvlei": "sossusvlei",
  // Beside the airport turn-off on the B6; the client's own description, and
  // the reason a "farm to the terminal" transfer is a drive of minutes.
  "etango": "hosea-kutako",
  "etango ranch": "hosea-kutako",
  "etango ranch guest farm": "hosea-kutako",
  "etango ranch guestfarm": "hosea-kutako",
  "swakopmund hotel": "swakopmund",
  "swakopmund hotel and entertainment centre": "swakopmund",
  "swakopmund hotel and entertainment center": "swakopmund",
  "hosea kutako airport": "hosea-kutako",
  "hosea kutako international airport": "hosea-kutako",
  "wdh airport": "hosea-kutako",
  "windhoek airport": "hosea-kutako",
  "eros airport": "eros-airport",
  "walvis bay airport": "walvis-bay-airport",
  "wvb airport": "walvis-bay-airport",
  "etosha": "etosha-okaukuejo",
  "okaukuejo": "etosha-okaukuejo",
  "andersson gate": "etosha-okaukuejo",
  "namutoni": "etosha-namutoni",
  "von lindequist gate": "etosha-namutoni",
  "fish river canyon": "fish-river-canyon",
  "hobas": "fish-river-canyon",
  "ai ais": "ai-ais",
  "ai-ais": "ai-ais",
};

/**
 * Lower-case, accent-free, single-spaced.
 *
 * The accent strip used to be written `/[\\u0300-\\u036f]/` — a doubled
 * backslash, so not an escape at all but a character class that happened to
 * contain the letters `u` and `f` and every digit. It deleted them from
 * whatever was typed: "Sossusvlei" became "sosssvlei" and matched nothing,
 * and any alias spelt with either letter was dead. `\p{M}` is the same idea
 * said in a way that cannot be mis-escaped.
 */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nodeFromQuery(query: string): PlaceNode | null {
  const value = normalise(query);
  if (!value) return null;
  return PLACE_NODES.find((node) => [node.slug, node.name, node.shortName ?? ""].some((candidate) => normalise(candidate) === value)) ?? null;
}

/** How far a destination may sit from the road model and still be anchored. */
const MAX_ANCHOR_KM = 120;

function straightLineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The node of the road model closest to a catalogued destination, and the gap.
 * Straight-line, from an approximate pin: good enough to say which town a
 * lodge belongs to, not good enough to be a road distance, which is why the
 * gap is reported rather than added to anything.
 */
export function nearestRoadNode(place: { lat: number; lng: number }): { node: PlaceNode; km: number } | null {
  let best: { node: PlaceNode; km: number } | null = null;
  for (const node of PLACE_NODES) {
    const km = straightLineKm(place, node);
    if (!best || km < best.km) best = { node, km };
  }
  return best && best.km <= MAX_ANCHOR_KM ? best : null;
}

export function resolvePlace(query: string): ResolvedPlace {
  const clean = query.trim();
  const direct = nodeFromQuery(clean);
  if (direct) return { query: clean, slug: direct.slug, nodeName: direct.name, matchedBy: "routing_node", confidence: "high", note: null };
  const aliasSlug = ALIASES[normalise(clean)];
  if (aliasSlug) {
    const node = findNode(aliasSlug);
    if (node) return { query: clean, slug: node.slug, nodeName: node.name, matchedBy: "alias", confidence: "high", note: "Resolved " + clean + " to the " + node.name + " routing anchor." };
  }
  // A catalogued destination with no road of its own. Anchor it to the
  // nearest node of the road model and say so, with the gap — never silently:
  // the price that follows covers the drive to the anchor, and the operator
  // has to decide what the last stretch is worth.
  const value = normalise(clean);
  const place = SEARCH_PLACES.find((candidate) =>
    [candidate.slug, candidate.name, candidate.shortName ?? ""].some((name) => normalise(name) === value),
  );
  if (place) {
    const nearest = nearestRoadNode(place);
    if (nearest) {
      return {
        query: clean,
        slug: nearest.node.slug,
        nodeName: nearest.node.name,
        matchedBy: "nearest_node",
        confidence: "medium",
        note: `${place.name} has no measured road in the model. Priced to ${nearest.node.name}, about ${Math.round(nearest.km)} km away in a straight line — add the access drive.`,
      };
    }
  }
  return { query: clean, slug: null, nodeName: null, matchedBy: "unresolved", confidence: "low", note: "No trusted routing anchor exists for this place yet. Do not guess." };
}

export function routeItineraryIntelligence(stops: Array<{ place: string; label?: string }>) {
  const resolvedStops = stops.map((stop) => resolvePlace(stop.label?.trim() || stop.place));
  const legs: RouteLegIntelligence[] = [];
  for (let i = 0; i < resolvedStops.length - 1; i += 1) {
    const from = resolvedStops[i]; const to = resolvedStops[i + 1];
    if (!from.slug || !to.slug) { legs.push({ from, to, km: null, drivingMinutes: null, roads: [], via: [], routable: false }); continue; }
    const road = findRoad(from.slug, to.slug);
    if (!road) { legs.push({ from, to, km: null, drivingMinutes: null, roads: [], via: [], routable: false }); continue; }
    legs.push({ from, to, km: road.km, drivingMinutes: road.minutes, roads: road.roads, via: road.via.map((node) => node.name), routable: true });
  }
  const routable = resolvedStops.length >= 2 && legs.length === resolvedStops.length - 1 && legs.every((leg) => leg.routable);
  return { stops: resolvedStops, legs, totalKm: routable ? legs.reduce((sum, leg) => sum + (leg.km ?? 0), 0) : 0, totalDrivingMinutes: routable ? legs.reduce((sum, leg) => sum + (leg.drivingMinutes ?? 0), 0) : 0, routable };
}
