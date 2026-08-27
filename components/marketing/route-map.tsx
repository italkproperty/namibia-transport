import { staticRouteMapUrl } from "@/lib/maps";
import type { RouteView } from "@/lib/maps";
import { formatDuration, shortPlace } from "@/lib/format";

/**
 * A picture of the drive.
 *
 * Deliberately a static image rather than an interactive canvas: route pages
 * are read, not manipulated, and an <img> costs a request instead of the
 * ~200KB a map library would add to a page whose whole job is to get someone
 * to the booking form quickly.
 *
 * Renders nothing at all without a Mapbox token or coordinates, so the page is
 * complete either way rather than showing a broken frame.
 */
export function RouteMap({ route }: { route: RouteView }) {
  const { originLat, originLng, destinationLat, destinationLng } = route;

  if (
    originLat == null ||
    originLng == null ||
    destinationLat == null ||
    destinationLng == null
  ) {
    return null;
  }

  const src = staticRouteMapUrl({
    origin: { lat: originLat, lng: originLng },
    destination: { lat: destinationLat, lng: destinationLng },
    encodedGeometry: route.routeGeometry,
  });

  if (!src) return null;

  const from = shortPlace(route.originLabel);
  const to = route.destinationLabel;
  const duration = formatDuration(route.durationMin);

  return (
    <figure className="bg-card overflow-hidden rounded-xl border">
      {/* eslint-disable-next-line @next/next/no-img-element -- Mapbox signs
          its own URLs; routing them through next/image would strip the token
          and re-host a tile we are licensed to hot-link. */}
      <img
        src={src}
        alt={`Map of the route from ${from} to ${to}`}
        width={1200}
        height={500}
        loading="lazy"
        decoding="async"
        className="aspect-[12/5] w-full object-cover"
      />
      <figcaption className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 border-t px-4 py-2.5 text-xs">
        <span className="text-foreground font-medium">
          {from} → {to}
        </span>
        {route.distanceKm && (
          <span>· {Math.round(Number(route.distanceKm))} km</span>
        )}
        {duration && <span>· about {duration}</span>}
      </figcaption>
    </figure>
  );
}
