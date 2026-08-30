import * as React from "react";

/**
 * Side elevations of the vehicle classes, drawn rather than photographed.
 *
 * Why drawings, when the ask was photographs: we do not own the cars. A
 * manufacturer's press or advertising shot is somebody else's copyright, and
 * putting one on a booking page implies a fleet that does not exist — the two
 * things CLAUDE.md is most insistent we never do. A drawing states the class
 * without pretending to be a specific car sitting in a specific yard.
 *
 * This is scaffolding for real photography, not a substitute for it. The
 * moment there is a photograph of an actual partner vehicle, set `photo` on
 * the spec in lib/vehicles.ts and the drawing steps aside — see VehicleImage.
 *
 * Two earlier passes got the proportions right and still looked like clip art,
 * because what separates a modern car from a cartoon of one is rendering, not
 * measurement. Held against a real Fortuner and a real Golf, the differences
 * all sat in the same three places:
 *
 *  · The glasshouse is one continuous near-black mass. Blacked-out pillars
 *    mean the windows read as a single dark band with hairline dividers, not
 *    as separate pale panes with body-coloured gaps between them.
 *  · The wheels are dark and busy and fill their arches. A pale disc with five
 *    fat spokes is the loudest toy-car tell there is.
 *  · The body is a near-white surface with tonal shading and a hairline edge.
 *    A heavy coloured outline around a flat fill is what says "clip art".
 *
 * So the brand colour is an accent now — the tail lamps, and nothing else —
 * and the drawing carries its weight in value rather than hue.
 *
 * Everything is theme tokens, so it inverts in dark mode and costs no network
 * request, no image decode and no layout shift. Deliberately no gradients or
 * clip paths: several of these render on one page and SVG defs share the
 * document id namespace.
 */

export type VehicleArtKind = "sedan" | "suv" | "van";

const GROUND = 118;

/* ----------------------------------------------------------------- styles */

const bodyStyle = {
  fill: "var(--background)",
  stroke: "var(--foreground)",
  strokeOpacity: 0.34,
  strokeWidth: 1.7,
  strokeLinejoin: "round",
  strokeLinecap: "round",
} as const;

/** The glasshouse: one mass, near-black, pillars included. */
const glassStyle = { fill: "var(--foreground)", fillOpacity: 0.84 } as const;

/** Hairline door frames inside that mass, and the chrome strip beneath it. */
const dividerStyle = {
  stroke: "var(--background)",
  strokeOpacity: 0.34,
  strokeWidth: 1.1,
  strokeLinecap: "round",
  fill: "none",
} as const;

const chromeStyle = {
  stroke: "var(--background)",
  strokeOpacity: 0.5,
  strokeWidth: 1.4,
  strokeLinecap: "round",
  fill: "none",
} as const;

const glareStyle = { fill: "var(--background)", fillOpacity: 0.14 } as const;

/** Panel creases and shut lines — the flank looks pressed, not extruded. */
const creaseStyle = {
  stroke: "var(--foreground)",
  strokeOpacity: 0.17,
  strokeWidth: 1.4,
  strokeLinecap: "round",
  fill: "none",
} as const;

const shutStyle = {
  stroke: "var(--foreground)",
  strokeOpacity: 0.22,
  strokeWidth: 1.3,
  strokeLinecap: "round",
  fill: "none",
} as const;

const handleStyle = {
  stroke: "var(--foreground)",
  strokeOpacity: 0.38,
  strokeWidth: 2.4,
  strokeLinecap: "round",
  fill: "none",
} as const;

/** Black plastic: arch trim, sill cladding, running boards, mirrors. */
const blackTrim = { fill: "var(--foreground)", fillOpacity: 0.78 } as const;
const darkLamp = { fill: "var(--foreground)", fillOpacity: 0.72 } as const;
const lensStyle = { fill: "var(--background)", fillOpacity: 0.45 } as const;

/** The one place the brand colour appears, and the one place a car is red. */
const tailLampStyle = { fill: "var(--brand)", fillOpacity: 0.8 } as const;

/* ------------------------------------------------------------------ parts */

/**
 * A wheel with a dark multi-spoke alloy filling its arch. Spoke count is the
 * difference between a hot-hatch rim and a 4x4 one, so it is a parameter.
 */
function Wheel({
  cx,
  r,
  spokes = 5,
}: {
  cx: number;
  r: number;
  spokes?: number;
}) {
  const cy = GROUND - r;
  const rim = r * 0.68;
  const arms = Array.from({ length: spokes }, (_, i) => {
    const angle = ((i * (360 / spokes) - 90) * Math.PI) / 180;
    return {
      x: cx + Math.cos(angle) * rim * 0.82,
      y: cy + Math.sin(angle) * rim * 0.82,
    };
  });

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="var(--foreground)" opacity="0.93" />
      <circle cx={cx} cy={cy} r={rim} fill="var(--foreground)" opacity="0.52" />
      {arms.map((arm, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={arm.x}
          y2={arm.y}
          stroke="var(--background)"
          strokeOpacity="0.4"
          strokeWidth={r * 0.13}
          strokeLinecap="round"
        />
      ))}
      <circle
        cx={cx}
        cy={cy}
        r={rim}
        fill="none"
        stroke="var(--background)"
        strokeOpacity="0.22"
        strokeWidth="1"
      />
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.13}
        fill="var(--background)"
        opacity="0.5"
      />
    </g>
  );
}

/** Contact shadow. Tight under the car, not a wide grey oval. */
function Ground({ cx, rx }: { cx: number; rx: number }) {
  return (
    <>
      <ellipse
        cx={cx}
        cy={GROUND + 3}
        rx={rx}
        ry={3.5}
        fill="var(--foreground)"
        opacity="0.07"
      />
      <ellipse
        cx={cx}
        cy={GROUND + 2}
        rx={rx * 0.7}
        ry={2.2}
        fill="var(--foreground)"
        opacity="0.1"
      />
    </>
  );
}

/** Door mirror, seated against the A-pillar so it reads as bolted on. */
function Mirror({ d }: { d: string }) {
  return <path d={d} {...blackTrim} fillOpacity={0.6} />;
}

/* --------------------------------------------------------------- the cars */

/**
 * The small car — a current hatchback on the Polo Vivo / Golf footprint, which
 * is what most Namibian small cars actually are. Short overhangs at both ends,
 * a roof arcing continuously into a steeply raked tailgate with a spoiler at
 * its top, a hard crease low on the doors, and eighteens filling the arches.
 */
function Sedan() {
  return (
    <g>
      <Ground cx={158} rx={132} />

      <path
        d="M22 80 C22 70 26 63 34 61
           L66 59 L96 57
           C108 47 124 34 142 28
           C156 23.5 176 22.5 196 24.5
           C214 26.5 228 31 238 38
           L260 61
           C272 69 282 75 284 82 L284 87
           C284 91 280 94 275 94.5 L264 95
           A22 21 0 0 0 220 95 L96 95 A22 21 0 0 0 52 95
           L34 94 C28 93 22 88 22 80 Z"
        {...bodyStyle}
      />

      {/* Value, not hue: a soft shadow low on the flank. */}
      <path
        d="M54 82 C126 78 198 77 268 82 L268 92 C198 88 126 89 54 92 Z"
        fill="var(--foreground)"
        opacity="0.05"
      />

      {/* One continuous glasshouse. Blacked-out pillars are the whole trick. */}
      <path
        d="M106 56 C118 46 132 35 148 30 C160 26.5 178 25.5 196 27.5
           C212 29.5 224 34 234 41 L242 56 Z"
        {...glassStyle}
      />
      <path
        d="M114 56 C125 45 137 36 150 32 L160 32 C143 38 129 47 122 56 Z"
        {...glareStyle}
      />
      <path d="M172 26 L172 56" {...dividerStyle} />
      <path d="M210 29 L210 56" {...dividerStyle} />
      <path d="M107 56 L241 56" {...chromeStyle} />

      <path
        d="M40 77 C120 73 200 71 278 76"
        {...creaseStyle}
        strokeWidth={1.7}
      />
      <path d="M100 62 C150 60 200 61 250 65" {...creaseStyle} />

      <path d="M180 57 L180 91" {...shutStyle} />
      <path d="M148 66 L160 66" {...handleStyle} />
      <path d="M194 67 L206 67" {...handleStyle} />

      <Mirror d="M116 57 L103 53 C100 52 98.5 54 100 56 L107 61 L117 61 Z" />

      {/* Headlamp: a dark cluster with a lit lens inside it. */}
      <path d="M28 70 L34 63 L54 62.5 L53 67.5 Z" {...darkLamp} />
      <path d="M31 68 L35 64.5 L52 64 L51.5 66.5 Z" {...lensStyle} />
      <path d="M250 63 L264 72 L261 78 L247 69 Z" {...tailLampStyle} />

      <Wheel cx={74} r={22} spokes={5} />
      <Wheel cx={242} r={22} spokes={5} />
    </g>
  );
}

/**
 * SUV — the Toyota Fortuner: 4.80 m, 2.75 m wheelbase, 1.84 m tall on 18s.
 * Level roof the whole length under rails and a rear spoiler, a near-vertical
 * tailgate, squared black arch trim over tyres that fill it, black sill
 * cladding above a running board, and the rear quarter window kicking up at
 * its leading edge behind a body-coloured pillar — the one line no estate has.
 */
function Suv() {
  return (
    <g>
      <Ground cx={154} rx={138} />

      <rect
        x="138"
        y="9.5"
        width="106"
        height="4.5"
        rx="2"
        {...blackTrim}
        fillOpacity={0.5}
      />

      <path
        d="M20 76 C20 66 24 58 32 55
           L68 52 L100 51 L130 17 C132 15 135 14 138 14
           L250 14 C257 14 262 16 265 21 L280 46
           C287 56 290 66 290 76 L290 86
           C290 90 286 93 281 93.5 L259 95
           A23 23 0 0 0 213 95 L95 95 A23 23 0 0 0 49 95
           L34 93 C26 92 20 86 20 76 Z"
        {...bodyStyle}
      />

      <path
        d="M52 74 C130 69 210 68 286 74 L286 90 C210 85 130 86 52 90 Z"
        fill="var(--foreground)"
        opacity="0.05"
      />

      {/* Main glasshouse, then the quarter behind a body-coloured pillar. */}
      <path
        d="M110 48 L132 18 C134 16 137 15.5 140 15.5 L238 15.5 L238 48 Z"
        {...glassStyle}
      />
      <path d="M117 48 L137 17 L147 17 L127 48 Z" {...glareStyle} />
      <path d="M162 15.5 L162 48" {...dividerStyle} />
      <path d="M200 15.5 L200 48" {...dividerStyle} />
      <path d="M111 48 L237 48" {...chromeStyle} />
      {/* The kick: the quarter glass rises at its leading edge. Pure Fortuner. */}
      <path
        d="M246 16 L250 16 C256 16 260 18 262 22 L275 48 L256 48 L246 33 Z"
        {...glassStyle}
      />

      {/* Black plastic: cladding carried into both bumpers, then the step. */}
      <rect
        x="30"
        y="80"
        width="20"
        height="12"
        rx="3"
        {...blackTrim}
        fillOpacity={0.5}
      />
      <rect
        x="96"
        y="80"
        width="114"
        height="12"
        rx="3"
        {...blackTrim}
        fillOpacity={0.5}
      />
      <rect
        x="256"
        y="80"
        width="26"
        height="12"
        rx="3"
        {...blackTrim}
        fillOpacity={0.5}
      />
      <rect x="100" y="91" width="106" height="6" rx="3" {...blackTrim} />

      {/* Squared arch trim, proud of the cut. */}
      <path
        d="M46 95 A26 26 0 0 1 98 95"
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity="0.5"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M210 95 A26 26 0 0 1 262 95"
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity="0.5"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <path
        d="M40 63 C120 58 200 57 284 63"
        {...creaseStyle}
        strokeWidth={1.7}
      />
      <path d="M104 53 C160 51 210 52 268 57" {...creaseStyle} />

      <path d="M166 49 L166 82" {...shutStyle} />
      <path d="M204 49 L204 82" {...shutStyle} />
      <path d="M241 49 L241 82" {...shutStyle} />
      <path d="M146 57 L158 57" {...handleStyle} />
      <path d="M184 57 L196 57" {...handleStyle} />

      <Mirror d="M114 49 L101 45 C98 44 96.5 46 98 48 L105 53 L115 53 Z" />

      <path d="M25 66 L31 57 L54 55.5 L53 62 Z" {...darkLamp} />
      <path d="M28 64 L32.5 58.5 L52 57.5 L51.5 60.5 Z" {...lensStyle} />
      <path d="M275 52 L285 55 L285 70 L276 67 Z" {...tailLampStyle} />

      <Wheel cx={72} r={23} spokes={10} />
      <Wheel cx={236} r={23} spokes={10} />
    </g>
  );
}

/**
 * Minibus — the Toyota Quantum that is the default Namibian shuttle: 5.4 m,
 * one box, a windscreen dropping almost onto the front axle, a flat roof the
 * whole length and a vertical tailgate. Not a bookable class yet; it appears
 * because it is what a group of ten actually travels in.
 */
function Van() {
  return (
    <g>
      <Ground cx={158} rx={146} />

      <path
        d="M20 78 C20 60 24 45 32 38
           L44 26 C50 20 58 17 67 17 L272 17
           C286 17 296 25 299 38 L304 66 L304 86
           C304 90 300 94 295 94.5 L259 96
           A23 23 0 0 0 213 96 L85 96 A23 23 0 0 0 39 96
           L30 94 C24 93 20 87 20 78 Z"
        {...bodyStyle}
      />

      <path
        d="M40 78 C130 74 220 73 300 78 L300 91 C220 87 130 88 40 92 Z"
        fill="var(--foreground)"
        opacity="0.05"
      />

      <path
        d="M32 50 C34 39 40 30 49 25 C54 22 60 21 67 21 L78 21 L78 50 Z"
        {...glassStyle}
      />
      <path
        d="M88 21 L256 21 C266 21 273 27 275 36 L279 50 L88 50 Z"
        {...glassStyle}
      />
      <path
        d="M39 50 C41 40 47 31 55 26 L64 26 C54 32 48 40 46 50 Z"
        {...glareStyle}
      />
      <path d="M140 21 L140 50" {...dividerStyle} />
      <path d="M198 21 L198 50" {...dividerStyle} />
      <path d="M252 21 L252 50" {...dividerStyle} />
      <path d="M89 50 L278 50" {...chromeStyle} />

      <path
        d="M32 62 C120 58 220 57 300 63"
        {...creaseStyle}
        strokeWidth={1.7}
      />

      {/* The sliding door, which is how passengers actually get in. */}
      <path d="M82 51 L82 91" {...shutStyle} />
      <path d="M140 51 L140 91" {...shutStyle} />
      <path d="M198 51 L198 91" {...shutStyle} />
      <path d="M172 60 L188 60" {...handleStyle} />
      <rect x="142" y="92" width="54" height="6" rx="3" {...blackTrim} />

      <Mirror d="M92 51 L79 47 C76 46 74.5 48 76 50 L83 55 L93 55 Z" />

      <path d="M23 76 L28 66 L48 65 L47 73 Z" {...darkLamp} />
      <path d="M27 73 L30.5 67.5 L46 66.8 L45.5 70 Z" {...lensStyle} />
      <path d="M292 58 L301 60 L301 76 L293 74 Z" {...tailLampStyle} />

      <Wheel cx={62} r={23} spokes={6} />
      <Wheel cx={236} r={23} spokes={6} />
    </g>
  );
}

const ART: Record<VehicleArtKind, () => React.JSX.Element> = {
  sedan: Sedan,
  suv: Suv,
  van: Van,
};

export function VehicleArt({
  kind,
  className,
}: {
  kind: VehicleArtKind;
  className?: string;
}) {
  const Drawing = ART[kind];
  return (
    <svg
      viewBox="0 0 320 130"
      className={className}
      role="presentation"
      aria-hidden
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <Drawing />
    </svg>
  );
}
