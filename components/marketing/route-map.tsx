import { RouteMapFigure } from "@/components/maps/route-map-figure";
import { publicMapboxToken } from "@/lib/maps/mapbox";
import type { RouteView } from "@/lib/maps/types";

/**
 * The route-page map. Server-rendered, so when it cannot draw anything it can
 * say why in the deployment logs — rendering nothing is correct behaviour but
 * indistinguishable from the component not being deployed at all.
 */
let warned = false;

function warnOnce(reason: string) {
  if (warned) return;
  warned = true;
  console.warn(`[maps] route map not rendered — ${reason}`);
}

export function RouteMap({ route }: { route: RouteView }) {
  if (route.originLat == null || route.destinationLat == null) {
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

  return <RouteMapFigure route={route} />;
}
