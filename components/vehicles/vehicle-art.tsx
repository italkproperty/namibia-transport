import * as React from "react";

/**
 * Side elevations of the vehicle classes, drawn rather than photographed.
 *
 * Why drawings, when the ask was photographs: we do not own the cars. A
 * manufacturer's press or advertising shot is somebody else's copyright, and
 * putting one on a booking page implies a fleet that does not exist — the two
 * things CLAUDE.md is most insistent we never do. A drawing states the class
 * (how big, how many doors, how much glass, how high it sits) without
 * pretending to be a specific car sitting in a specific yard.
 *
 * This is scaffolding for real photography, not a substitute for it. The
 * moment there is a photograph of an actual partner vehicle, set `photo` on
 * the spec in lib/vehicles.ts and the drawing steps aside — see VehicleImage.
 *
 * The details that separate a modern car from a 1990s one, and which are the
 * whole job here: a high shoulder line with a shallow glasshouse rather than
 * a tall greenhouse on a thin body; a steeply raked windscreen; wheels large
 * enough to fill their arches; swept lamps instead of rounded blocks; a
 * crease running the length of the flank; and a door mirror, whose absence
 * reads as "toy" faster than any other single omission.
 *
 * Proportions are real, taken from the vehicle each class actually describes.
 * Everything is drawn from theme tokens, so it inverts correctly in dark mode
 * and costs no network request, no image decode and no layout shift. There
 * are deliberately no gradients or clip paths: several of these render on one
 * page, and SVG defs share the document id namespace.
 */

export type VehicleArtKind = "sedan" | "suv" | "van";

const GROUND = 118;

/* ----------------------------------------------------------------- styles */

const bodyStyle = {
  fill: "var(--brand)",
  fillOpacity: 0.12,
  stroke: "var(--brand)",
  strokeOpacity: 0.82,
  strokeWidth: 2.4,
  strokeLinejoin: "round",
  strokeLinecap: "round",
} as const;

const glassStyle = {
  fill: "var(--brand)",
  fillOpacity: 0.28,
} as const;

/** The reflection streak across the glass. Cheap, and it stops it reading flat. */
const glareStyle = {
  fill: "var(--background)",
  fillOpacity: 0.3,
} as const;

/** Panel creases and shut lines — the flank looks pressed, not extruded. */
const creaseStyle = {
  stroke: "var(--brand)",
  strokeOpacity: 0.42,
  strokeWidth: 1.6,
  strokeLinecap: "round",
  fill: "none",
} as const;

const shutStyle = {
  stroke: "var(--brand)",
  strokeOpacity: 0.5,
  strokeWidth: 1.8,
  strokeLinecap: "round",
  fill: "none",
} as const;

const handleStyle = {
  stroke: "var(--brand)",
  strokeOpacity: 0.62,
  strokeWidth: 2.6,
  strokeLinecap: "round",
  fill: "none",
} as const;

/** Light catching the top of the body. One stroke, and the panel gains a curve. */
const sheenStyle = {
  stroke: "var(--background)",
  strokeOpacity: 0.55,
  strokeWidth: 2,
  strokeLinecap: "round",
  fill: "none",
} as const;

const lampStyle = { fill: "var(--brand)", fillOpacity: 0.6 } as const;
const trimStyle = { fill: "var(--brand)", fillOpacity: 0.34 } as const;

/* ------------------------------------------------------------------ parts */

/**
 * A wheel with a five-spoke alloy. A plain dark disc is the single biggest
 * reason a drawn car looks old — modern wheels are mostly rim, not sidewall.
 */
function Wheel({ cx, r }: { cx: number; r: number }) {
  const cy = GROUND - r;
  const rim = r * 0.66;
  const spokes = Array.from({ length: 5 }, (_, i) => {
    const angle = ((i * 72 - 90) * Math.PI) / 180;
    return {
      x: cx + Math.cos(angle) * rim * 0.84,
      y: cy + Math.sin(angle) * rim * 0.84,
    };
  });

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="var(--foreground)" opacity="0.9" />
      {/* Sidewall, then the rim face: the gap between them is what reads as tyre. */}
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.82}
        fill="var(--foreground)"
        opacity="0.5"
      />
      <circle cx={cx} cy={cy} r={rim} fill="var(--background)" opacity="0.96" />
      {spokes.map((spoke, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={spoke.x}
          y2={spoke.y}
          stroke="var(--foreground)"
          strokeOpacity="0.22"
          strokeWidth={r * 0.15}
          strokeLinecap="round"
        />
      ))}
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.15}
        fill="var(--foreground)"
        opacity="0.45"
      />
    </g>
  );
}

/** Contact shadow. Tight and dark under the car, not a wide grey oval. */
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
        rx={rx * 0.72}
        ry={2.2}
        fill="var(--foreground)"
        opacity="0.09"
      />
    </>
  );
}

/* --------------------------------------------------------------- the cars */

/**
 * Sedan — the VW Polo sedan / Corolla footprint: 4.4 m, 2.55 m wheelbase,
 * 1.45 m tall. What dates a drawn saloon is not the three-box shape, it is the
 * balance: a long bonnet, a cabin pushed forward and a boot deck running on
 * behind it turns a car into a 1980s Cortina. So the cabin sits back over the
 * rear axle, the boot is short and high, the windscreen and C-pillar are raked
 * to nearly the same angle, and a shadow under the rocker stops the flank
 * reading as one flat slab.
 */
function Sedan() {
  return (
    <g>
      <Ground cx={158} rx={132} />

      {/* The roof is one continuous arc from screen to boot, not a flat panel
          between two corners. That single curve is most of what separates a
          current small saloon from a 1990s three-box. */}
      <path
        d="M24 82 C24 73 29 67 37 65
           L68 60 L100 56
           C112 44 128 32 148 27
           C160 24.5 176 24 190 25.5
           C206 27 218 33 228 42
           L244 54 L272 56
           C286 58 294 66 296 76 L296 84
           C296 89 292 92.5 286 93 L262 94
           A22 21 0 0 0 218 94 L95 94 A22 21 0 0 0 53 94
           L34 93 C28 92.5 24 89 24 82 Z"
        {...bodyStyle}
      />

      {/* Underbody shadow: the cheapest way to stop a flank reading as a slab. */}
      <rect
        x="96"
        y="87"
        width="122"
        height="7"
        fill="var(--foreground)"
        opacity="0.06"
      />

      <path
        d="M110 54 C120 44 134 34 150 30 L172 30 L172 54 Z"
        {...glassStyle}
      />
      <path
        d="M117 54 C126 45 138 37 151 33 L160 33 C145 38 132 46 125 54 Z"
        {...glareStyle}
      />
      <path
        d="M179 30 L190 30.5 C202 32 212 37 220 45 L227 54 L179 54 Z"
        {...glassStyle}
      />

      {/* A crease that rises towards the rear, and a soft line above the rocker. */}
      <path d="M40 74 C130 69 220 65 288 66" {...creaseStyle} />
      <path
        d="M56 86 C140 83 216 83 282 85"
        {...creaseStyle}
        strokeOpacity={0.22}
      />
      <path d="M152 26 C168 24.5 182 24.5 194 26" {...sheenStyle} />

      <path d="M176 55 L176 90" {...shutStyle} />
      <path d="M152 62 L164 62" {...handleStyle} />
      <path d="M188 62 L200 62" {...handleStyle} />

      {/* Door mirror, seated in the wedge between bonnet and A-pillar so it
          reads as bolted on rather than floating alongside. */}
      <path
        d="M116 54 L103 50 C100 49 98.5 51 100 53 L107 58 L117 58 Z"
        fill="var(--brand)"
        fillOpacity="0.55"
      />

      {/* Big swept lamps wrapping into the flank. */}
      <path d="M27 69 L49 65 L51 72 L30 77 Z" {...lampStyle} />
      <path d="M276 61 L292 65 L293 75 L277 71 Z" {...lampStyle} />

      <Wheel cx={74} r={21} />
      <Wheel cx={239} r={21} />
    </g>
  );
}

/**
 * SUV — the Toyota Fortuner: 4.80 m long, 2.75 m wheelbase, 1.84 m tall on
 * 18s. Its signatures are a tall upright nose with the bonnet carried just
 * under the window line, a roof running dead level the whole length to a
 * near-vertical tailgate, arches flared proud of the body, sill cladding
 * under a running board, and the rear quarter window that kicks up at its
 * leading edge — the one line no estate car has.
 */
function Suv() {
  return (
    <g>
      <Ground cx={154} rx={138} />

      <rect x="146" y="9" width="98" height="5" rx="2.5" {...trimStyle} />

      <path
        d="M22 78 C22 68 26 58 34 55
           L68 51 L102 50 L132 17 C134 15 137 14 140 14
           L248 14 C255 14 261 16 264 21 L280 46
           C286 56 289 66 289 75 L289 84
           C289 89 285 92.5 279 93 L257 95
           A23 23 0 0 0 211 95 L94 95 A23 23 0 0 0 48 95
           L34 93 C27 92 22 87 22 78 Z"
        {...bodyStyle}
      />

      <path
        d="M112 46 L134 17 C136 15 139 14.5 142 14.5 L162 14.5 L162 46 Z"
        {...glassStyle}
      />
      <path d="M118 46 L137 16 L147 16 L128 46 Z" {...glareStyle} />
      <path d="M169 14.5 L199 14.5 L199 46 L169 46 Z" {...glassStyle} />
      <path d="M206 14.5 L234 14.5 L234 46 L206 46 Z" {...glassStyle} />
      {/* The kick: the quarter glass rises at its leading edge. Pure Fortuner. */}
      <path
        d="M241 14.5 L248 14.5 C254 14.5 258 16.5 261 21 L272 46 L252 46 L241 33 Z"
        {...glassStyle}
      />

      {/* Sill cladding, then the running board slung under it. */}
      <rect
        x="25"
        y="81"
        width="22"
        height="11"
        rx="3"
        {...trimStyle}
        fillOpacity={0.2}
      />
      <rect
        x="96"
        y="81"
        width="114"
        height="12"
        rx="3"
        {...trimStyle}
        fillOpacity={0.2}
      />
      <rect
        x="259"
        y="81"
        width="26"
        height="11"
        rx="3"
        {...trimStyle}
        fillOpacity={0.2}
      />
      <rect x="100" y="92" width="106" height="6" rx="3" {...trimStyle} />

      <path d="M40 63 C120 57 200 56 284 62" {...creaseStyle} />
      <path d="M142 14.5 L246 14.5" {...sheenStyle} />

      <path d="M165 47 L165 83" {...shutStyle} />
      <path d="M202 47 L202 83" {...shutStyle} />
      <path d="M237 47 L237 83" {...shutStyle} />
      <path d="M145 55 L157 55" {...handleStyle} />
      <path d="M182 55 L194 55" {...handleStyle} />

      <path
        d="M116 47 L103 43 C100 42 98.5 44 100 46 L107 51 L117 51 Z"
        fill="var(--brand)"
        fillOpacity="0.55"
      />

      {/* Flared arches: the lip proud of the cut is what reads as 4x4. */}
      <path
        d="M45 95 A26 26 0 0 1 97 95"
        {...creaseStyle}
        strokeWidth={2.6}
        strokeOpacity={0.5}
      />
      <path
        d="M208 95 A26 26 0 0 1 260 95"
        {...creaseStyle}
        strokeWidth={2.6}
        strokeOpacity={0.5}
      />

      <path d="M26 63 L52 58 L55 68 L30 74 Z" {...lampStyle} />
      <path d="M278 52 L288 55 L288 72 L279 68 Z" {...lampStyle} />

      <Wheel cx={71} r={23} />
      <Wheel cx={234} r={23} />
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
        d="M22 96 C17 96 14 93 14 89 L14 64 C14 54 18 45 26 38
           L42 25 C48 19 56 16 65 16 L272 16
           C286 16 296 24 299 37 L304 65 L304 89
           C304 93 301 96 297 96 L259 96 A23 23 0 0 0 213 96
           L83 96 A23 23 0 0 0 37 96 Z"
        {...bodyStyle}
      />

      <path
        d="M31 49 C33 38 39 29 48 24 C53 21 59 20 66 20 L77 20 L77 49 Z"
        {...glassStyle}
      />
      <path
        d="M38 49 C40 39 46 30 54 25 L63 25 C53 31 47 39 45 49 Z"
        {...glareStyle}
      />
      <path
        d="M88 20 L256 20 C266 20 273 26 275 35 L279 49 L88 49 Z"
        {...glassStyle}
      />
      <path d="M139 20 L139 49" stroke="var(--card)" strokeWidth={2.5} />
      <path d="M197 20 L197 49" stroke="var(--card)" strokeWidth={2.5} />
      <path d="M252 20 L252 49" stroke="var(--card)" strokeWidth={2.5} />

      <path d="M32 62 C120 58 220 58 300 63" {...creaseStyle} />
      <path d="M66 17 L262 17" {...sheenStyle} />
      <rect
        x="86"
        y="88"
        width="130"
        height="8"
        fill="var(--foreground)"
        opacity="0.05"
      />

      {/* The sliding door, which is how passengers actually get in. */}
      <path d="M80 50 L80 90" {...shutStyle} />
      <path d="M139 50 L139 90" {...shutStyle} />
      <path d="M197 50 L197 90" {...shutStyle} />
      <path d="M171 60 L187 60" {...handleStyle} />
      <rect x="141" y="93" width="54" height="6" rx="3" {...trimStyle} />

      <path
        d="M90 50 L78 46 C75 45 73.5 47 75 49 L82 54 L91 54 Z"
        fill="var(--brand)"
        fillOpacity="0.55"
      />

      <path d="M15 70 L36 67 L38 76 L17 79 Z" {...lampStyle} />
      <path d="M293 55 L304 57 L304 76 L294 74 Z" {...lampStyle} />

      <Wheel cx={60} r={23} />
      <Wheel cx={236} r={23} />
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
