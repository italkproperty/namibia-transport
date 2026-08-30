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
 * Proportions are real: 63 units per metre, wheel radius 0.33 m, wheelbase and
 * overhangs taken from the segment each class describes. Everything is drawn
 * from theme tokens, so it inverts correctly in dark mode and costs no
 * network request, no layout shift and no image decode.
 */

export type VehicleArtKind = "sedan" | "suv" | "van";

const GROUND = 118;

/** One wheel: tyre, rim face, hub. Drawn over the body's arch cut-out. */
function Wheel({ cx, r }: { cx: number; r: number }) {
  const cy = GROUND - r;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="var(--foreground)" opacity="0.88" />
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.55}
        fill="var(--background)"
        opacity="0.95"
      />
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.17}
        fill="var(--foreground)"
        opacity="0.5"
      />
    </g>
  );
}

/** The contact shadow. Keeps the car on the ground instead of floating. */
function Ground({ cx, rx }: { cx: number; rx: number }) {
  return (
    <ellipse
      cx={cx}
      cy={GROUND + 3}
      rx={rx}
      ry={4.5}
      fill="var(--foreground)"
      opacity="0.09"
    />
  );
}

const bodyStyle = {
  fill: "var(--brand)",
  fillOpacity: 0.13,
  stroke: "var(--brand)",
  strokeOpacity: 0.8,
  strokeWidth: 2.6,
  strokeLinejoin: "round",
  strokeLinecap: "round",
} as const;

const glassStyle = {
  fill: "var(--brand)",
  fillOpacity: 0.3,
} as const;

const lineStyle = {
  stroke: "var(--brand)",
  strokeOpacity: 0.55,
  strokeWidth: 2,
  strokeLinecap: "round",
  fill: "none",
} as const;

const lampStyle = {
  fill: "var(--brand)",
  fillOpacity: 0.72,
} as const;

/* --------------------------------------------------------------- the cars */

/**
 * Sedan — a three-box saloon on the Corolla/Polo footprint that dominates
 * Namibian roads: 4.6 m long, 2.7 m wheelbase, 1.44 m tall.
 */
function Sedan() {
  return (
    <g>
      <Ground cx={160} rx={138} />
      <path
        d="M30 99 C25 99 22 96 22 92 L22 87 C22 79 27 73 35 71
           L66 63 L102 56 L126 32 C130 29 135 27 141 27 L198 27
           C205 27 211 29 215 33 L238 56 L272 59
           C288 62 296 70 298 81 L299 92 C299 96 296 99 292 99
           L267 99 A22 22 0 0 0 221 99 L99 99 A22 22 0 0 0 53 99 Z"
        {...bodyStyle}
      />
      {/* Glass split at the B-pillar — two doors read as a car, one reads as a shape. */}
      <path
        d="M110 54 L129 35 C132 32 136 31 140 31 L165 31 L165 54 Z"
        {...glassStyle}
      />
      <path
        d="M174 31 L196 31 C200 31 204 33 207 36 L225 54 L174 54 Z"
        {...glassStyle}
      />
      <path d="M169 55 L169 90" {...lineStyle} />
      <path d="M146 63 L158 63" {...lineStyle} strokeWidth={3} />
      <rect x="23" y="76" width="15" height="8" rx="3" {...lampStyle} />
      <rect x="286" y="70" width="13" height="8" rx="3" {...lampStyle} />
      <Wheel cx={76} r={21} />
      <Wheel cx={244} r={21} />
    </g>
  );
}

/**
 * SUV — the Fortuner/Hilux double-cab silhouette. What makes it an SUV rather
 * than a tall estate is the roof running flat to a near-vertical tailgate, the
 * high beltline, and wheels large enough to change the body-to-wheel ratio.
 */
function Suv() {
  return (
    <g>
      <Ground cx={158} rx={142} />
      <rect
        x="132"
        y="12.5"
        width="112"
        height="5"
        rx="2.5"
        {...lampStyle}
        fillOpacity={0.45}
      />
      <path
        d="M26 97 C21 97 18 94 18 90 L18 68 C18 60 22 55 30 53
           L64 48 L98 45 L126 22 C129 19 133 18 138 18 L248 18
           C256 18 263 21 266 27 L280 52
           C285 62 288 72 288 82 L288 90 C288 94 285 97 281 97
           L261 97 A24 24 0 0 0 213 97 L98 97 A24 24 0 0 0 50 97 Z"
        {...bodyStyle}
      />
      <path
        d="M110 48 L130 22 C132 20 135 19 139 19 L158 19 L158 48 Z"
        {...glassStyle}
      />
      <path d="M166 19 L198 19 L198 48 L166 48 Z" {...glassStyle} />
      <path d="M206 19 L236 19 L236 48 L206 48 Z" {...glassStyle} />
      <path
        d="M244 19 L247 19 C253 19 258 21 261 26 L274 48 L244 48 Z"
        {...glassStyle}
      />
      <path d="M162 49 L162 90" {...lineStyle} />
      <path d="M202 49 L202 90" {...lineStyle} />
      <path d="M240 49 L240 90" {...lineStyle} />
      <path d="M144 58 L156 58" {...lineStyle} strokeWidth={3} />
      {/* Side step. High clearance is the point of this class, so show the climb. */}
      <rect
        x="104"
        y="94"
        width="102"
        height="6"
        rx="3"
        {...lampStyle}
        fillOpacity={0.38}
      />
      <rect x="19" y="60" width="16" height="10" rx="3" {...lampStyle} />
      <rect x="275" y="58" width="12" height="12" rx="3" {...lampStyle} />
      <Wheel cx={74} r={24} />
      <Wheel cx={237} r={24} />
    </g>
  );
}

/**
 * Minibus — the Toyota Quantum shape that is the default Namibian shuttle:
 * one box, 5.4 m long, a raked windscreen straight off the front axle and a
 * flat roof all the way to a vertical tailgate. Not a bookable class yet; it
 * appears here because it is what a group of ten actually travels in.
 */
function Van() {
  return (
    <g>
      <Ground cx={160} rx={148} />
      <path
        d="M20 100 C15 100 12 97 12 92 L12 66 C12 56 16 46 24 39
           L40 26 C46 20 54 17 63 17 L274 17
           C288 17 298 25 301 38 L306 66 L306 92
           C306 96 303 100 299 100 L261 100 A22 22 0 0 0 217 100
           L84 100 A22 22 0 0 0 40 100 Z"
        {...bodyStyle}
      />
      {/* One-box glasshouse: the reason a Quantum carries fourteen people. */}
      <path
        d="M28 50 C30 39 36 30 45 25 C50 22 56 21 63 21 L74 21 L74 50 Z"
        {...glassStyle}
      />
      <path
        d="M84 21 L272 21 C282 21 289 27 291 36 L294 50 L84 50 Z"
        {...glassStyle}
      />
      <path d="M142 21 L142 50" stroke="var(--card)" strokeWidth={2.5} />
      <path d="M200 21 L200 50" stroke="var(--card)" strokeWidth={2.5} />
      <path d="M254 21 L254 50" stroke="var(--card)" strokeWidth={2.5} />
      {/* The sliding door, which is how passengers actually get in. */}
      <path d="M78 51 L78 94" {...lineStyle} />
      <path d="M142 51 L142 94" {...lineStyle} />
      <path d="M200 51 L200 94" {...lineStyle} />
      <path d="M170 62 L188 62" {...lineStyle} strokeWidth={3} />
      <rect
        x="144"
        y="97"
        width="54"
        height="6"
        rx="3"
        {...lampStyle}
        fillOpacity={0.4}
      />
      <rect x="13" y="74" width="15" height="9" rx="3" {...lampStyle} />
      <rect x="293" y="58" width="12" height="17" rx="3" {...lampStyle} />
      <Wheel cx={62} r={22} />
      <Wheel cx={239} r={22} />
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
