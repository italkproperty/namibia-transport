import * as React from "react";

/**
 * The brand mark: an ink roundel carrying a dune crest with a route line
 * rising over it to a destination point — ground transport across Namibia,
 * drawn geometrically enough to survive a 16px favicon and a vehicle decal.
 *
 * One mark, three renderings: full colour, mono, and the favicon. The
 * wordmark is set in the UI font next to the mark rather than baked into the
 * SVG, so it stays crisp at every size and never ships an embedded font.
 */

const MARK_TITLE = "Namibia Transport";

export function BrandMark({
  size = 32,
  mono = false,
  className,
}: {
  size?: number;
  mono?: boolean;
  className?: string;
}) {
  const ink = mono ? "currentColor" : "#1a1614";
  const dune = mono ? "#ffffff" : "#bc4b00";
  const duneFar = mono ? "#ffffff" : "#8f3a02";
  const line = "#fcfaf7";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={MARK_TITLE}
      className={className}
    >
      <rect width="64" height="64" rx="15" fill={ink} />
      {/* Far dune — darker, behind. */}
      <path
        d="M0 40 C 16 24, 34 26, 46 34 C 53 38.5, 59 40, 64 39 L 64 64 L 0 64 Z"
        fill={duneFar}
        opacity={mono ? 0.35 : 1}
      />
      {/* Near dune — the brand amber crest. */}
      <path
        d="M0 54 C 14 44, 30 43, 42 49 C 50 52.5, 58 53, 64 51.5 L 64 64 L 0 64 Z"
        fill={dune}
        opacity={mono ? 0.75 : 1}
      />
      {/* The route: rising over the crest to where you are going. */}
      <path
        d="M8 57 C 20 49, 30 38, 39 29 C 41.5 26.5, 44 24.5, 46 23"
        fill="none"
        stroke={line}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="49.5" cy="20.5" r="3.4" fill={line} />
    </svg>
  );
}

export function Logo({
  markSize = 30,
  mono = false,
  className,
}: {
  markSize?: number;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <BrandMark size={markSize} mono={mono} />
      <span className="flex flex-col leading-none">
        <span className="text-[0.95rem] font-semibold tracking-tight">
          Namibia Transport
        </span>
        <span className="text-muted-foreground mt-0.5 text-[0.58rem] font-medium tracking-[0.14em] uppercase">
          Private transfers
        </span>
      </span>
    </span>
  );
}
