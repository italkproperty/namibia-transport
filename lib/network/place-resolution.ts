import { findNode, PLACE_NODES, type PlaceNode } from "./nodes";
import { findRoad } from "./roads";

export type ResolvedPlace = {
  query: string;
  slug: string | null;
  nodeName: string | null;
  matchedBy: "routing_node" | "alias" | "unresolved";
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

function normalise(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\\s+/g, " ");
}

function nodeFromQuery(query: string): PlaceNode | null {
  const value = normalise(query);
  if (!value) return null;
  return PLACE_NODES.find((node) => [node.slug, node.name, node.shortName ?? ""].some((candidate) => normalise(candidate) === value)) ?? null;
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
