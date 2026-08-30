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
 * The small car — a hatchback on the Golf / Polo Vivo footprint, which is what
 * most small cars on Namibian roads actually are. 4.28 m over a 2.64 m
 * wheelbase, so the overhangs are short at both ends; a compact cabin rather
 * than a long one; and, the point of the shape, a roof that falls straight
 * into a steeply raked tailgate with a spoiler on top, instead of levelling
 * off into a boot deck. There is no third box.
 */
function Sedan() {
  return (
    <g>
      <Ground cx={152} rx={126} />

      <path
        d="M26 82 C26 72 30 65 38 63
           L70 60 L104 57
           C118 47 136 33 158 27
           C174 23 194 22.5 210 25
           C222 27 232 31 240 38
           L266 66
           C274 72 280 76 282 82 L282 87
           C282 91 278 94 273 94.5 L265 95
           A21 20 0 0 0 223 95 L101 95 A21 20 0 0 0 59 95
           L38 94 C31 93 26 89 26 82 Z"
        {...bodyStyle}
      />

      {/* Value, not hue: a soft shadow low on the flank. */}
      <path
        d="M60 82 C126 78 190 77 262 82 L262 92 C190 88 126 89 60 92 Z"
        fill="var(--foreground)"
        opacity="0.05"
      />

      {/* One continuous glasshouse, carried down the tailgate the way a hatch
          does — the rear screen is the tailgate, not a separate rear window. */}
      <path
        d="M114 55 C126 46 142 34 160 29 C176 25.5 194 25 210 27.5
           C220 29 230 33 238 40 L250 57 Z"
        {...glassStyle}
      />
      <path
        d="M122 55 C133 45 146 35 160 31 L170 31 C152 37 138 46 130 55 Z"
        {...glareStyle}
      />
      <path d="M178 26 L178 55" {...dividerStyle} />
      <path d="M212 28 L212 56" {...dividerStyle} />
      <path d="M115 55 L246 56" {...chromeStyle} />

      {/* Tailgate spoiler, standing proud of the roofline where it breaks. */}
      <path
        d="M230 32 L252 46 L248 50 L227 36 Z"
        {...blackTrim}
        fillOpacity={0.5}
      />

      <path
        d="M44 78 C120 74 190 72 274 78"
        {...creaseStyle}
        strokeWidth={1.7}
      />
      <path d="M108 61 C150 59 195 60 240 64" {...creaseStyle} />

      <path d="M184 56 L184 91" {...shutStyle} />
      <path d="M156 63 L168 63" {...handleStyle} />
      <path d="M198 64 L210 64" {...handleStyle} />

      <Mirror d="M126 56 L112 52 C109 51 107.5 53 109 55 L116 60 L127 60 Z" />

      {/* Headlamp: tapering back out of the front face into the fender. */}
      <path d="M31 72 L39 64 L60 63 L58 69 Z" {...darkLamp} />
      <path d="M34 70 L40 65.5 L58 64.8 L57 67 Z" {...lensStyle} />
      <path d="M252 60 L268 70 L264 77 L248 67 Z" {...tailLampStyle} />

      <Wheel cx={80} r={20} spokes={5} />
      <Wheel cx={244} r={20} spokes={5} />
    </g>
  );
}

/**
 * SUV — the Toyota Fortuner: 4.80 m, 2.75 m wheelbase, 1.84 m tall on 18s.
 * The shape lives in four places: a short blunt nose carrying a flat bonnet
 * high at the window line; a level roof running the whole length under rails
 * to a near-vertical tailgate with a spoiler; wheel arches cut square and
 * proud, with real daylight between the trim and the top of the tyre; and the
 * rear quarter window kicking up at its leading edge, which is the line no
 * estate car has.
 */
function Suv() {
  return (
    <g>
      <Ground cx={156} rx={138} />

      <rect
        x="144"
        y="9.5"
        width="104"
        height="4.5"
        rx="2"
        {...blackTrim}
        fillOpacity={0.5}
      />
      <path
        d="M248 14 L266 19 L263 23 L246 18 Z"
        {...blackTrim}
        fillOpacity={0.5}
      />

      {/* Squared arches are cut into the body itself, so the trim sits on the
          edge rather than floating over a semicircle that disagrees with it. */}
      <path
        d="M22 74 C22 64 26 58 34 55
           L70 53 L106 52 L136 17 C138 15 141 14 144 14
           L252 14 C260 14 266 16 269 21 L284 48
           C291 58 294 68 294 78 L294 87
           C294 91 290 94 285 94.5 L265 95
           L263 79 C262 73 257 69 250 68 L226 68 C219 69 214 73 213 79
           L211 95 L99 95
           L97 79 C96 73 91 69 84 68 L60 68 C53 69 48 73 47 79
           L45 95 L34 93 C27 92 22 86 22 74 Z"
        {...bodyStyle}
      />

      <path
        d="M52 74 C130 69 210 68 288 74 L288 90 C210 85 130 86 52 90 Z"
        fill="var(--foreground)"
        opacity="0.05"
      />

      {/* Main glasshouse, then the quarter behind a body-coloured pillar. */}
      <path
        d="M116 49 L138 18 C140 16 143 15.5 146 15.5 L242 15.5 L242 49 Z"
        {...glassStyle}
      />
      <path d="M123 49 L143 17 L153 17 L133 49 Z" {...glareStyle} />
      <path d="M168 15.5 L168 49" {...dividerStyle} />
      <path d="M206 15.5 L206 49" {...dividerStyle} />
      <path d="M117 49 L241 49" {...chromeStyle} />
      {/* The kick: the quarter glass rises at its leading edge. Pure Fortuner. */}
      <path
        d="M248 15.5 L252 15.5 C258 15.5 262 17.5 264 21.5 L277 49 L258 49 L248 34 Z"
        {...glassStyle}
      />

      {/* Black plastic: cladding carried into both bumpers, then the step. */}
      <rect
        x="30"
        y="80"
        width="16"
        height="12"
        rx="3"
        {...blackTrim}
        fillOpacity={0.5}
      />
      <rect
        x="100"
        y="80"
        width="110"
        height="12"
        rx="3"
        {...blackTrim}
        fillOpacity={0.5}
      />
      <rect
        x="264"
        y="80"
        width="20"
        height="12"
        rx="3"
        {...blackTrim}
        fillOpacity={0.5}
      />
      <rect x="104" y="91" width="102" height="6" rx="3" {...blackTrim} />

      {/* Arch trim, tracing the squared cut exactly. */}
      <path
        d="M45 95 L47 79 C48 73 53 69 60 68 L84 68 C91 69 96 73 97 79 L99 95"
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity="0.6"
        strokeWidth="4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M211 95 L213 79 C214 73 219 69 226 68 L250 68 C257 69 262 73 263 79 L265 95"
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity="0.6"
        strokeWidth="4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      <path
        d="M42 62 C120 57 200 56 288 62"
        {...creaseStyle}
        strokeWidth={1.7}
      />
      <path d="M110 55 C165 53 215 54 272 59" {...creaseStyle} />

      <path d="M170 50 L170 80" {...shutStyle} />
      <path d="M208 50 L208 80" {...shutStyle} />
      <path d="M245 50 L245 80" {...shutStyle} />
      <path d="M150 58 L162 58" {...handleStyle} />
      <path d="M188 58 L200 58" {...handleStyle} />

      <Mirror d="M124 50 L110 46 C107 45 105.5 47 107 49 L114 54 L125 54 Z" />

      <path d="M27 66 L34 56 L58 54.5 L57 61 Z" {...darkLamp} />
      <path d="M30 64 L35.5 57.5 L56 56.5 L55.5 59.5 Z" {...lensStyle} />
      <path d="M279 51 L289 54 L289 70 L280 67 Z" {...tailLampStyle} />

      <Wheel cx={72} r={23} spokes={10} />
      <Wheel cx={238} r={23} spokes={10} />
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
