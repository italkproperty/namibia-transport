import * as React from "react";

/**
 * The mark is an N whose diagonal is the route.
 *
 * A dune-and-horizon mark said "generic African transport company"; a
 * letterform says us. The two uprights are the fixed points — where you are,
 * where you are going — and the amber stroke between them is the journey we
 * run. It is geometric enough to survive a 16px favicon and bold enough to
 * read across a car park on a vehicle door, which is the real test.
 */

const MARK_TITLE = "Namibia Transport";

export function BrandMark({
  size = 32,
  variant = "default",
  className,
}: {
  size?: number;
  /** "default" = ink roundel · "mono" = single-colour · "inverse" = on dark */
  variant?: "default" | "mono" | "inverse";
  className?: string;
}) {
  const mono = variant === "mono";
  const inverse = variant === "inverse";

  const plate = mono ? "none" : inverse ? "none" : "#1a1614";
  const upright = mono ? "currentColor" : inverse ? "#fcfaf7" : "#fcfaf7";
  const route = mono ? "currentColor" : "#bc4b00";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={MARK_TITLE}
      className={className}
    >
      {plate !== "none" && <rect width="64" height="64" rx="14" fill={plate} />}

      {/* Clipped to the uprights' band so the route ends flush, not ragged. */}
      <clipPath id="nt-mark-band">
        <rect x="15" y="15" width="34" height="34" />
      </clipPath>

      {/* The route: drawn first so the uprights sit crisply on top of it. */}
      <path
        clipPath="url(#nt-mark-band)"
        d="M19 14 L45 50"
        stroke={route}
        strokeWidth="9"
        strokeLinecap="butt"
        opacity={mono ? 0.55 : 1}
      />

      {/* Uprights — the two fixed points of any journey. */}
      <rect x="15" y="15" width="8" height="34" rx="1.5" fill={upright} />
      <rect x="41" y="15" width="8" height="34" rx="1.5" fill={upright} />
    </svg>
  );
}

/**
 * The lockup. "Namibia Transport" is the master brand — deliberately not
 * narrowed by a "private transfers" tagline, because the same company has to
 * carry intercity, corporate and group work as it grows.
 */
export function Logo({
  markSize = 30,
  variant = "default",
  descriptor = false,
  className,
}: {
  markSize?: number;
  variant?: "default" | "mono" | "inverse";
  /** Adds the service descriptor. Off in navigation, on where it earns space. */
  descriptor?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <BrandMark size={markSize} variant={variant} />
      <span className="flex flex-col leading-none">
        <span className="text-[0.98rem] font-semibold tracking-tight">
          Namibia Transport
        </span>
        {descriptor && (
          <span className="text-muted-foreground mt-1 text-[0.58rem] font-medium tracking-[0.13em] uppercase">
            Transfers · Intercity · Corporate
          </span>
        )}
      </span>
    </span>
  );
}
