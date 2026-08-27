import { staticRouteMapUrl } from "@/lib/maps/mapbox";
import type { RouteView } from "@/lib/maps/types";
import { formatDuration, shortPlace } from "@/lib/format";

/**
 * The presentational half of a route map, shared by the server-rendered map on
 * route pages and the client-side one on the home page.
 *
 * Imports from lib/maps/mapbox directly rather than the lib/maps barrel: the
 * barrel re-exports the database reads, which are server-only, and pulling
 * that into a client component drags Drizzle into the browser bundle.
 */
export function RouteMapFigure({
  route,
  priority = false,
  className,
}: {
  route: RouteView;
  /** True on the home page, where the map swaps as the traveller chooses. */
  priority?: boolean;
  className?: string;
}) {
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
    <figure
      className={`bg-card overflow-hidden rounded-xl border ${className ?? ""}`}
    >
      {/* The aspect ratio is fixed on the container rather than left to the
          image, so swapping routes never shifts the page. */}
      <div className="bg-muted relative aspect-[12/5] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- Mapbox signs
            its own URLs; next/image would strip the token and re-host a tile
            we are licensed to hot-link. */}
        <img
          src={src}
          alt={`Map of the route from ${from} to ${to}`}
          width={1200}
          height={500}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      </div>
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
