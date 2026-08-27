import { publicMapboxToken, staticRouteMapUrl } from "@/lib/maps";
import type { RouteView } from "@/lib/maps";
import { formatDuration, shortPlace } from "@/lib/format";

/**
 * Rendering nothing is the correct behaviour when a map cannot be built, but
 * it is indistinguishable from the component not being deployed at all — which
 * makes "the map is not showing" impossible to diagnose from the outside.
 * Say which precondition failed, once per process so it does not flood.
 */
let warned = false;

function warnOnce(reason: string) {
  if (warned) return;
  warned = true;
  console.warn(`[maps] route map not rendered — ${reason}`);
}

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
    warnOnce(
      `route "${route.slug}" has no coordinates. Set origin_lat/lng and ` +
        "destination_lat/lng on the routes row."
    );
    return null;
  }

  if (!publicMapboxToken()) {
    // NEXT_PUBLIC_ variables are inlined during `next build`, not read at
    // runtime, so adding one and redeploying an existing build changes
    // nothing — it needs a fresh build.
    warnOnce(
      "NEXT_PUBLIC_MAPBOX_TOKEN is missing from this build. NEXT_PUBLIC_ " +
        "variables are inlined at build time, so a redeploy that reuses the " +
        "build cache will not pick up a newly added one — push a commit or " +
        "redeploy with the cache disabled."
    );
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
