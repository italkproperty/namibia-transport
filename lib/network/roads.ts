import { findNode, nodeLabel, type PlaceNode } from "./nodes";

/**
 * The road network, and the shortest path across it.
 *
 * Every edge is a real driven segment of a named Namibian road, with its
 * length in kilometres and its surface. Straight-line distance is useless
 * here — Windhoek to Sossusvlei is 250 km as the crow flies and 350 km as the
 * car drives, and the difference is the entire margin. A live Directions API
 * would be more precise, but it would also mean a fare that cannot be quoted
 * when someone else's service is down, and a network call on every price
 * preview. The road network changes about once a decade; this table is the
 * right place for it.
 *
 * Distances are the road distances of the national network, good to a few
 * kilometres. The tests hold the graph to the seven distances the site already
 * publishes, so an edge that drifts away from reality fails a test rather than
 * quietly mispricing a trip.
 */

export type Surface = "tar" | "gravel";

export type RoadEdge = {
  from: string;
  to: string;
  km: number;
  surface: Surface;
  /** The road as a Namibian would name it. Shown to the traveller. */
  road: string;
};

/**
 * Average speeds, whole-journey rather than instantaneous — they carry the
 * fuel stops, the roadworks and the kudu that force a car below the limit.
 * Tar trunk roads run at 120; gravel is legally 80 and sensibly a good deal
 * less, and a driver who treats a district road like a highway is how a
 * transfer becomes a recovery.
 */
export const SPEED_KMH: Record<Surface, number> = {
  tar: 100,
  gravel: 65,
};

/** Loading, greeting and the one comfort stop nobody plans but everybody takes. */
export const FIXED_STOP_MIN = 20;

export const ROAD_EDGES: RoadEdge[] = [
  /* --------------------------------------------- Windhoek and the B6/B1 */
  { from: "hosea-kutako", to: "windhoek", km: 45, surface: "tar", road: "B6" },
  { from: "windhoek", to: "eros-airport", km: 6, surface: "tar", road: "city" },
  { from: "hosea-kutako", to: "gobabis", km: 160, surface: "tar", road: "B6" },
  { from: "windhoek", to: "okahandja", km: 70, surface: "tar", road: "B1" },
  { from: "windhoek", to: "rehoboth", km: 90, surface: "tar", road: "B1" },

  /* ------------------------------------------------- the B2 to the coast */
  { from: "okahandja", to: "karibib", km: 110, surface: "tar", road: "B2" },
  { from: "karibib", to: "usakos", km: 28, surface: "tar", road: "B2" },
  { from: "usakos", to: "swakopmund", km: 148, surface: "tar", road: "B2" },
  { from: "swakopmund", to: "walvis-bay", km: 33, surface: "tar", road: "C34" },
  {
    from: "walvis-bay",
    to: "walvis-bay-airport",
    km: 12,
    surface: "tar",
    road: "C14",
  },
  {
    from: "swakopmund",
    to: "henties-bay",
    km: 75,
    surface: "tar",
    road: "C34 salt road",
  },
  { from: "usakos", to: "spitzkoppe", km: 60, surface: "gravel", road: "D1918" },
  {
    from: "spitzkoppe",
    to: "henties-bay",
    km: 105,
    surface: "gravel",
    road: "D1918 / C35",
  },

  /* ------------------------------------------------- the B1 north, Etosha */
  { from: "okahandja", to: "otjiwarongo", km: 175, surface: "tar", road: "B1" },
  {
    from: "otjiwarongo",
    to: "waterberg",
    km: 90,
    surface: "gravel",
    road: "B1 / C22",
  },
  { from: "otjiwarongo", to: "outjo", km: 70, surface: "tar", road: "C38" },
  {
    from: "outjo",
    to: "etosha-okaukuejo",
    km: 115,
    surface: "tar",
    road: "C38",
  },
  { from: "otjiwarongo", to: "otavi", km: 110, surface: "tar", road: "B1" },
  { from: "otavi", to: "tsumeb", km: 60, surface: "tar", road: "B1" },
  {
    from: "tsumeb",
    to: "etosha-namutoni",
    km: 105,
    surface: "tar",
    road: "B1 / C38",
  },
  {
    from: "etosha-okaukuejo",
    to: "etosha-namutoni",
    km: 130,
    surface: "gravel",
    road: "park road",
  },
  { from: "otavi", to: "grootfontein", km: 92, surface: "tar", road: "B8" },

  /* ------------------------------------------------ the B8 to the Zambezi */
  { from: "grootfontein", to: "rundu", km: 250, surface: "tar", road: "B8" },
  { from: "rundu", to: "divundu", km: 200, surface: "tar", road: "B8" },
  { from: "divundu", to: "kongola", km: 190, surface: "tar", road: "B8" },
  { from: "kongola", to: "katima-mulilo", km: 120, surface: "tar", road: "B8" },

  /* ------------------------------------------------------ Damaraland loop */
  { from: "outjo", to: "khorixas", km: 115, surface: "tar", road: "C39" },
  {
    from: "khorixas",
    to: "twyfelfontein",
    km: 90,
    surface: "gravel",
    road: "C39 / D2612",
  },
  {
    from: "twyfelfontein",
    to: "uis",
    km: 100,
    surface: "gravel",
    road: "D2612 / C35",
  },
  { from: "khorixas", to: "uis", km: 120, surface: "gravel", road: "C35" },
  { from: "uis", to: "henties-bay", km: 130, surface: "gravel", road: "C35" },

  /* -------------------------------------------------- the Namib and dunes */
  {
    from: "rehoboth",
    to: "sossusvlei",
    km: 260,
    surface: "gravel",
    road: "C24 / C19",
  },
  { from: "sossusvlei", to: "solitaire", km: 80, surface: "gravel", road: "C19" },
  {
    from: "solitaire",
    to: "walvis-bay",
    km: 260,
    surface: "gravel",
    road: "C14",
  },
  {
    from: "solitaire",
    to: "windhoek",
    km: 280,
    surface: "gravel",
    road: "C26 Spreetshoogte",
  },
  { from: "sossusvlei", to: "maltahohe", km: 105, surface: "gravel", road: "C19" },
  { from: "maltahohe", to: "mariental", km: 110, surface: "gravel", road: "C19" },
  {
    from: "sossusvlei",
    to: "helmeringhausen",
    km: 175,
    surface: "gravel",
    road: "C14 / C27",
  },
  { from: "helmeringhausen", to: "aus", km: 175, surface: "gravel", road: "C14" },

  /* ----------------------------------------------------- the B1/B4 south */
  { from: "rehoboth", to: "mariental", km: 175, surface: "tar", road: "B1" },
  { from: "mariental", to: "keetmanshoop", km: 225, surface: "tar", road: "B1" },
  { from: "keetmanshoop", to: "grunau", km: 155, surface: "tar", road: "B1" },
  { from: "grunau", to: "noordoewer", km: 145, surface: "tar", road: "B1" },
  { from: "keetmanshoop", to: "aus", km: 220, surface: "tar", road: "B4" },
  { from: "aus", to: "luderitz", km: 125, surface: "tar", road: "B4" },
  {
    from: "keetmanshoop",
    to: "fish-river-canyon",
    km: 160,
    surface: "gravel",
    road: "C12 / C37",
  },
  {
    from: "grunau",
    to: "fish-river-canyon",
    km: 145,
    surface: "gravel",
    road: "C12",
  },
];

/* -------------------------------------------------------------- the graph */

type Link = { to: string; km: number; surface: Surface; road: string };

/** Roads run both ways; the table lists each once. */
const ADJACENCY: Map<string, Link[]> = (() => {
  const map = new Map<string, Link[]>();
  const add = (from: string, link: Link) => {
    const existing = map.get(from);
    if (existing) existing.push(link);
    else map.set(from, [link]);
  };

  for (const edge of ROAD_EDGES) {
    add(edge.from, {
      to: edge.to,
      km: edge.km,
      surface: edge.surface,
      road: edge.road,
    });
    add(edge.to, {
      to: edge.from,
      km: edge.km,
      surface: edge.surface,
      road: edge.road,
    });
  }
  return map;
})();

export type RoadSegment = {
  from: PlaceNode;
  to: PlaceNode;
  km: number;
  surface: Surface;
  road: string;
};

export type Road = {
  origin: PlaceNode;
  destination: PlaceNode;
  segments: RoadSegment[];
  km: number;
  tarKm: number;
  gravelKm: number;
  /** Driving time including one stop; not the same as time away from home. */
  minutes: number;
  /** The towns passed through, in order, excluding the two endpoints. */
  via: PlaceNode[];
  /** The roads driven, in order, deduplicated: ["B1", "C24 / C19"]. */
  roads: string[];
};

/**
 * Shortest driving route between two places.
 *
 * Minimised on time rather than distance, which is what a driver actually
 * chooses. Windhoek to Henties Bay is 58 km shorter over the Spitzkoppe
 * gravel than round through Swakopmund on tar, and twenty minutes slower; no
 * working driver takes the short way with a booked car and a boot full of
 * luggage. Returns null when either end is unknown, and — because the graph is
 * one connected network — never for two known places.
 */
/**
 * The graph never changes at runtime, so a shortest path computed once is
 * correct forever. The fleet calendar asks for hundreds of these per render
 * while it works out what each standing car could be sold.
 */
const roadCache = new Map<string, Road | null>();

export function findRoad(originSlug: string, destinationSlug: string): Road | null {
  const key = `${originSlug}>${destinationSlug}`;
  const cached = roadCache.get(key);
  if (cached !== undefined) return cached;

  const road = computeRoad(originSlug, destinationSlug);
  roadCache.set(key, road);
  return road;
}

function computeRoad(originSlug: string, destinationSlug: string): Road | null {
  const origin = findNode(originSlug);
  const destination = findNode(destinationSlug);
  if (!origin || !destination || origin.slug === destination.slug) return null;

  const best = new Map<string, number>([[origin.slug, 0]]);
  const cameFrom = new Map<string, { from: string; link: Link }>();

  // The graph is forty nodes, so a linear scan for the frontier minimum is
  // both faster in practice than a heap and impossible to get wrong.
  const settled = new Set<string>();

  for (;;) {
    let current: string | null = null;
    let currentCost = Infinity;
    for (const [slug, cost] of best) {
      if (!settled.has(slug) && cost < currentCost) {
        current = slug;
        currentCost = cost;
      }
    }
    if (current === null) break;
    if (current === destination.slug) break;
    settled.add(current);

    for (const link of ADJACENCY.get(current) ?? []) {
      const cost = currentCost + link.km / SPEED_KMH[link.surface];
      if (cost < (best.get(link.to) ?? Infinity)) {
        best.set(link.to, cost);
        cameFrom.set(link.to, { from: current, link });
      }
    }
  }

  if (!best.has(destination.slug) || !cameFrom.has(destination.slug)) return null;

  const segments: RoadSegment[] = [];
  let cursor = destination.slug;
  while (cursor !== origin.slug) {
    const step = cameFrom.get(cursor);
    if (!step) return null;
    const from = findNode(step.from);
    const to = findNode(cursor);
    if (!from || !to) return null;
    segments.unshift({
      from,
      to,
      km: step.link.km,
      surface: step.link.surface,
      road: step.link.road,
    });
    cursor = step.from;
  }

  const km = segments.reduce((total, s) => total + s.km, 0);
  const gravelKm = segments
    .filter((s) => s.surface === "gravel")
    .reduce((total, s) => total + s.km, 0);
  const drivingMin = segments.reduce(
    (total, s) => total + (s.km / SPEED_KMH[s.surface]) * 60,
    0,
  );

  const roads: string[] = [];
  for (const segment of segments) {
    if (roads[roads.length - 1] !== segment.road) roads.push(segment.road);
  }

  return {
    origin,
    destination,
    segments,
    km,
    tarKm: km - gravelKm,
    gravelKm,
    minutes: Math.round(drivingMin + FIXED_STOP_MIN),
    via: segments.slice(0, -1).map((segment) => segment.to),
    roads,
  };
}

/** "B1, then the C24 and C19" — how a person would describe the drive. */
export function describeRoads(road: Road): string {
  if (road.roads.length === 0) return "";
  if (road.roads.length === 1) return `the ${road.roads[0]}`;
  const last = road.roads[road.roads.length - 1];
  return `the ${road.roads.slice(0, -1).join(", ")}, then the ${last}`;
}

/** "via Okahandja and Karibib" — capped, because a long list helps nobody. */
export function describeVia(road: Road, limit = 3): string {
  if (road.via.length === 0) return "";
  const names = road.via.map(nodeLabel);
  if (names.length <= limit) {
    const last = names[names.length - 1];
    return names.length === 1
      ? `via ${last}`
      : `via ${names.slice(0, -1).join(", ")} and ${last}`;
  }
  return `via ${names.slice(0, limit).join(", ")} and ${names.length - limit} more`;
}
