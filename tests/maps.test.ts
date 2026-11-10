/**
 * Mapbox URL construction.
 *
 * Pure functions, no network — which matters, because api.mapbox.com is not
 * reachable from CI. What these guard is the encoding: an encoded polyline
 * contains \ ` | { } and other characters that are legal in a polyline and
 * illegal in a URL path, and getting that wrong yields a map that silently
 * renders without the route line.
 */
import { staticItineraryMapSrcSet, staticRouteMapSrcSet, staticRouteMapUrl } from "@/lib/maps/mapbox";
import { BRAND_COLORS, mapHex } from "@/lib/brand-colors";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const WDH = { lat: -22.4799, lng: 17.4709 };
const WINDHOEK = { lat: -22.5609, lng: 17.0658 };

function withToken<T>(token: string | undefined, fn: () => T): T {
  const previous = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (token === undefined) delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  else process.env.NEXT_PUBLIC_MAPBOX_TOKEN = token;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    else process.env.NEXT_PUBLIC_MAPBOX_TOKEN = previous;
  }
}

console.log("\nstatic route map URLs");

check(
  "no token means no map, not a broken image",
  withToken(undefined, () =>
    staticRouteMapUrl({ origin: WDH, destination: WINDHOEK })
  ) === null
);

const url = withToken("pk.test", () =>
  staticRouteMapUrl({ origin: WDH, destination: WINDHOEK })
)!;

check("built a URL", typeof url === "string" && url.length > 0);
check("points at the static images API", url.startsWith("https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/"));
check("carries the token", url.includes("access_token=pk.test"));
check("auto-fits rather than guessing a zoom", url.includes("/auto/"));

// Mapbox takes lng,lat — reversing this puts Windhoek in the Indian Ocean.
check(
  "origin pin is lng,lat not lat,lng",
  decodeURIComponent(url).includes(
      `pin-s+${mapHex(BRAND_COLORS.ink)}(17.470900,-22.479900)`,
    ),
  decodeURIComponent(url)
);
check(
  "destination pin present and brand-coloured",
  decodeURIComponent(url).includes(
    `pin-s+${mapHex(BRAND_COLORS.brand)}(17.065800,-22.560900)`,
  )
);
check("no route line when there is no geometry", !url.includes("path-4"));

/* --------------------------------------------------- the encoding minefield */

// Real polyline6 output uses the ASCII range 63..126, which includes the
// characters below. Each one breaks a URL path if passed through raw.
const NASTY = "a\\b`c|d{e}f?g~h[i]j^k";

const withPath = withToken("pk.test", () =>
  staticRouteMapUrl({
    origin: WDH,
    destination: WINDHOEK,
    encodedGeometry: NASTY,
  })
)!;

check("draws a route line when geometry exists", withPath.includes("path-4"));
check("no raw backslash survives into the URL", !withPath.includes("\\"));
check("no raw backtick survives into the URL", !withPath.includes("`"));
check("no raw pipe survives into the URL", !withPath.includes("|"));

// The round trip is what actually matters: Mapbox must receive the exact
// polyline back. A double-encoded % would arrive as a literal "%25".
const decodedOnce = decodeURIComponent(
  withPath.slice(withPath.indexOf("path-4"), withPath.indexOf(",pin-s"))
);
check(
  "geometry survives a single decode intact",
  decodedOnce.includes(NASTY),
  decodedOnce
);
check("not double-encoded", !withPath.includes("%25"));

/* ------------------------------------------------------------------- sizing */

const huge = withToken("pk.test", () =>
  staticRouteMapUrl({ origin: WDH, destination: WINDHOEK, width: 4000, height: 4000 })
)!;
check("clamps to Mapbox's 1280px ceiling", huge.includes("/1280x1280@2x"), huge);

const plain = withToken("pk.test", () =>
  staticRouteMapUrl({ origin: WDH, destination: WINDHOEK, retina: false })
)!;
check("retina can be turned off", plain.includes("/1200x500?") || plain.includes("/1200x500"));


// The map is the first thing that moves after a price appears, and on a phone
// it was a 2400px PNG. Two sizes, the small one for the narrow screen.
console.log("\nstatic route map sizes");
const set = withToken("pk.test", () =>
  staticRouteMapSrcSet({ origin: WDH, destination: WINDHOEK })
)!;
check("a phone-sized candidate exists", set.srcSet.includes("/640x267@2x") && set.srcSet.includes(" 1280w"));
check("the full-size candidate is still there", set.srcSet.includes("/1200x500@2x") && set.srcSet.includes(" 2400w"));
check("the default src is the full-size image", set.src.includes("/1200x500@2x"));
check("sizes lets a narrow screen take the small one", set.sizes.startsWith("(max-width: 640px) 100vw"));
check(
  "no token means no set either",
  withToken(undefined, () => staticRouteMapSrcSet({ origin: WDH, destination: WINDHOEK })) === null,
);


// The charter quote draws every stop in travel order with the road between.
console.log("\nitinerary map");
{
  const SWAKOP = { lat: -22.6792, lng: 14.5272 };
  const trip = withToken("pk.test", () =>
    staticItineraryMapSrcSet({ stops: [WDH, WINDHOEK, SWAKOP], encodedGeometry: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" })
  )!;
  const url = trip ? decodeURIComponent(trip.src) : "";
  check("an itinerary map is built", trip !== null);
  check("stops are numbered in travel order", url.includes("pin-s-1+") && url.includes("pin-s-2+") && url.includes("pin-s-3+"));
  check("the last stop is the one in brand colour", url.includes(`pin-s-3+${mapHex(BRAND_COLORS.brand)}(14.527200,-22.679200)`), url);
  check("the road is drawn as a path", url.includes("path-4+"));
  check("two sizes, phone and desktop", trip.srcSet.includes(" 1280w") && trip.srcSet.includes(" 2400w"));
  check("one stop is not an itinerary", withToken("pk.test", () => staticItineraryMapSrcSet({ stops: [WDH] })) === null);
  check("no token, no map", withToken(undefined, () => staticItineraryMapSrcSet({ stops: [WDH, WINDHOEK] })) === null);

  // A geometry that cannot fit the URL falls back to pins rather than nothing.
  const huge = "a".repeat(9000);
  const pinsOnly = withToken("pk.test", () => staticItineraryMapSrcSet({ stops: [WDH, WINDHOEK], encodedGeometry: huge }))!;
  check("an oversized path degrades to pins only", pinsOnly !== null && !pinsOnly.src.includes("path-4") && pinsOnly.src.includes("pin-s-1"));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
