import * as React from "react";

/**
 * A wordmark, not a symbol.
 *
 * Two symbol attempts were rejected, and the reason both failed is the same:
 * a dune, a horizon, a road, an N with a route through it — every one of them
 * is a picture of *transport*, which is the category, not the company. Any
 * competitor could use it tomorrow.
 *
 * So the name does the work. The device is typographic: set in a grotesque
 * with enough squareness to read as infrastructure, uppercase, and tracked
 * tight so the two words lock into one block rather than floating apart. In
 * the stacked lockup the tracking is tuned per word so NAMIBIA and TRANSPORT
 * occupy the same measure — a deliberate optical alignment that reads as
 * designed rather than typed, and the only real flourish in the identity.
 *
 * It survives what a symbol has to survive: a 16px favicon (as the monogram
 * below), a vehicle door, a black-and-white invoice, and a WhatsApp preview.
 */

const NAME = "Namibia Transport";

/**
 * The single-letter tile, for a favicon and anywhere too tight for the name.
 * Not a symbol in its own right — it is the wordmark's first letter, in the
 * wordmark's typeface.
 */
export function BrandMark({
  size = 32,
  variant = "default",
  className,
}: {
  size?: number;
  /** "default" = ink tile · "mono" = single-colour · "inverse" = on dark */
  variant?: "default" | "mono" | "inverse";
  className?: string;
}) {
  const mono = variant === "mono";
  const inverse = variant === "inverse";

  const tile = mono || inverse ? "none" : "#1a1614";
  const letter = mono ? "currentColor" : inverse ? "#1a1614" : "#fcfaf7";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={NAME}
      className={className}
    >
      {tile !== "none" && <rect width="64" height="64" rx="13" fill={tile} />}
      {inverse && <rect width="64" height="64" rx="13" fill="#fcfaf7" />}
      {/* Drawn as paths rather than a text node: a glyph would depend on the
          brand font having loaded, and this has to hold at 16px in a browser
          tab and inside a printed quotation alike. */}
      <g fill={letter}>
        <rect x="16" y="16" width="10" height="32" />
        <rect x="38" y="16" width="10" height="32" />
        <polygon points="16,16 26,16 48,48 38,48" />
      </g>
    </svg>
  );
}

/**
 * The wordmark.
 *
 * `stacked` is the primary lockup — two lines, optically matched widths. Use
 * it where there is room to breathe: the footer, a quotation header, a share
 * card. `inline` is the compact form for navigation bars.
 */
export function Logo({
  variant = "default",
  layout = "inline",
  className,
  size = 1,
}: {
  variant?: "default" | "mono" | "inverse";
  layout?: "inline" | "stacked";
  className?: string;
  /** Multiplier on the base size, so one lockup serves every context. */
  size?: number;
}) {
  const colour =
    variant === "mono"
      ? "currentColor"
      : variant === "inverse"
        ? "#fcfaf7"
        : "#1a1614";

  const brandFont = {
    fontFamily:
      "var(--font-archivo), Archivo, ui-sans-serif, system-ui, sans-serif",
    fontWeight: 700,
  } as const;

  if (layout === "stacked") {
    // Drawn as SVG so the two lines are the same width by construction rather
    // than by tuned tracking. `textLength` forces each word onto an identical
    // measure and lets the spacing fall where it must — which is the whole
    // device, and something hand-tuned letter-spacing can only approximate
    // for one font at one size.
    return (
      <svg
        viewBox="0 0 120 33"
        role="img"
        aria-label={NAME}
        className={className}
        style={{ height: `${2.05 * size}rem`, width: "auto", display: "block" }}
      >
        <g
          fill={colour}
          style={{
            fontFamily:
              "var(--font-archivo), Archivo, ui-sans-serif, system-ui, sans-serif",
            fontWeight: 700,
            fontSize: "15px",
          }}
        >
          <text x="0" y="13" textLength="120" lengthAdjust="spacing">
            NAMIBIA
          </text>
          <text x="0" y="30" textLength="120" lengthAdjust="spacing">
            TRANSPORT
          </text>
        </g>
      </svg>
    );
  }

  return (
    <span
      aria-label={NAME}
      role="img"
      className={`inline-block whitespace-nowrap ${className ?? ""}`}
      style={{
        ...brandFont,
        color: colour,
        fontSize: `${1.02 * size}rem`,
        letterSpacing: "-0.015em",
      }}
    >
      NAMIBIA<span style={{ display: "inline-block", width: "0.34em" }} />
      TRANSPORT
    </span>
  );
}
