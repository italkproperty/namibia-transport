"use client";

import * as React from "react";

import { InteractiveRouteMap } from "@/components/maps/interactive-route-map";

/**
 * The static image and the interactive map that fades in over it.
 *
 * These live together because of one thing they have to agree on: once the
 * interactive map is up, the image beneath it is invisible. The home page
 * swaps routes without a reload, and each swap changes the static URL — so
 * without this, every route a visitor tries costs a fresh Mapbox render of a
 * 2400px-wide PNG that nobody can see. The image tracks the route while it is
 * the thing being looked at, and stops the moment it is not.
 */
export function RouteMapCanvas({
  src,
  alt,
  priority,
  geometry,
  origin,
  destination,
  originLabel,
  destinationLabel,
}: {
  src: string;
  alt: string;
  priority: boolean;
  geometry: string | null;
  origin: [number, number];
  destination: [number, number];
  originLabel: string;
  destinationLabel: string;
}) {
  const [covered, setCovered] = React.useState(false);
  const [shownSrc, setShownSrc] = React.useState(src);

  React.useEffect(() => {
    if (!covered) setShownSrc(src);
  }, [src, covered]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- Mapbox signs
          its own URLs; next/image would strip the token and re-host a tile
          we are licensed to hot-link. */}
      <img
        src={shownSrc}
        alt={alt}
        width={1200}
        height={500}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />

      <InteractiveRouteMap
        geometry={geometry}
        origin={origin}
        destination={destination}
        originLabel={originLabel}
        destinationLabel={destinationLabel}
        onReady={() => setCovered(true)}
      />
    </>
  );
}
