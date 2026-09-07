import { PLACE_NODES } from "@/lib/network/nodes";
import { ROAD_EDGES } from "@/lib/network/roads";
import { BRAND_COLORS } from "@/lib/brand-colors";

/**
 * The road network, drawn from the model that prices every trip on this site.
 *
 * What stood here before was an illustrated dune horizon — a picture of
 * "Namibia" that any transfer site in the country could have commissioned, and
 * that said nothing about us. This says the only thing worth saying in the
 * hero: we know the roads. Every line below is one of the {ROAD_EDGES.length}
 * segments the fare model runs Dijkstra over, at its real coordinates, with
 * its real surface — solid for tar, dashed for gravel. Every dot is one of the
 * {PLACE_NODES.length} places we can price to.
 *
 * It is decoration in the sense that it carries no text and is aria-hidden,
 * and evidence in the sense that it cannot be faked: if the network changes,
 * this drawing changes with it, because there is no second copy of the data.
 */

// Plate carrée with the meridians squeezed by cos(mean latitude), which over
// Namibia's twelve degrees keeps the country's proportions honest to within a
// percent — enough for a background, and far cheaper than a projection library.
const MEAN_LAT_RAD = (-22.5 * Math.PI) / 180;
const X_SCALE = Math.cos(MEAN_LAT_RAD);

const VIEW_W = 720;
const VIEW_H = 900;
const PAD = 28;

const xs = PLACE_NODES.map((n) => n.lng * X_SCALE);
const ys = PLACE_NODES.map((n) => -n.lat);
const minX = Math.min(...xs);
const maxX = Math.max(...xs);
const minY = Math.min(...ys);
const maxY = Math.max(...ys);

// One scale for both axes, so the country is not stretched to fill the box.
const scale = Math.min(
  (VIEW_W - PAD * 2) / (maxX - minX),
  (VIEW_H - PAD * 2) / (maxY - minY),
);
const offsetX = (VIEW_W - (maxX - minX) * scale) / 2;
const offsetY = (VIEW_H - (maxY - minY) * scale) / 2;

function project(lat: number, lng: number): [number, number] {
  return [
    (lng * X_SCALE - minX) * scale + offsetX,
    (-lat - minY) * scale + offsetY,
  ];
}

const POINTS = new Map(
  PLACE_NODES.map((n) => [n.slug, project(n.lat, n.lng)] as const),
);

const SEGMENTS = ROAD_EDGES.map((edge) => {
  const a = POINTS.get(edge.from);
  const b = POINTS.get(edge.to);
  if (!a || !b) return null;
  return { a, b, surface: edge.surface, key: `${edge.from}-${edge.to}` };
}).filter((s): s is NonNullable<typeof s> => s !== null);

export function RoadNetwork({
  className,
  tone = "light",
}: {
  className?: string;
  /** "light" draws on a dark ground; "ink" draws on paper. */
  tone?: "light" | "ink";
}) {
  const stroke = tone === "light" ? BRAND_COLORS.surface : BRAND_COLORS.ink;

  return (
    <svg
      aria-hidden
      className={className}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      fill="none"
    >
      <g stroke={stroke} strokeLinecap="round">
        {SEGMENTS.map((s) => (
          <line
            key={s.key}
            x1={s.a[0]}
            y1={s.a[1]}
            x2={s.b[0]}
            y2={s.b[1]}
            strokeWidth={s.surface === "tar" ? 1.6 : 1}
            strokeOpacity={s.surface === "tar" ? 0.5 : 0.28}
            strokeDasharray={s.surface === "gravel" ? "3 5" : undefined}
          />
        ))}
      </g>

      <g fill={stroke}>
        {PLACE_NODES.map((n) => {
          const p = POINTS.get(n.slug);
          if (!p) return null;
          return (
            <circle
              key={n.slug}
              cx={p[0]}
              cy={p[1]}
              r={n.isAirport ? 3.4 : 1.9}
              fillOpacity={n.isAirport ? 0.9 : 0.45}
            />
          );
        })}
      </g>
    </svg>
  );
}
