/**
 * Lazy geometry backfill.
 *
 * The valuable case here is the failure one: this runs during a page render,
 * so an unreachable Mapbox must cost the route line and nothing else. That is
 * genuinely exercised rather than mocked — api.mapbox.com is not reachable
 * from this environment, so the request really does fail.
 */
import { withRouteGeometry } from "@/lib/maps/geometry";
import type { RouteView } from "@/lib/maps/types";

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

function route(overrides: Partial<RouteView> = {}): RouteView {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "test-route",
    originLabel: "Hosea Kutako International Airport (WDH)",
    destinationLabel: "Windhoek CBD",
    category: "airport",
    fixedPrice: "650.00",
    pricingUnit: "per_person",
    defaultDriverPayout: "455.00",
    currency: "NAD",
    isActive: true,
    distanceKm: "45.00",
    durationMin: 45,
    seoTitle: null,
    seoDescription: null,
    seoBody: null,
    originLat: -22.4799,
    originLng: 17.4709,
    destinationLat: -22.5609,
    destinationLng: 17.0658,
    routeGeometry: null,
    ...overrides,
  };
}

async function main() {
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "pk.test";

  console.log("\nlazy geometry backfill");

  const cached = route({ slug: "already-cached", routeGeometry: "abc123" });
  const t0 = Date.now();
  const same = await withRouteGeometry(cached);
  check(
    "a route that already has geometry is returned untouched",
    same.routeGeometry === "abc123"
  );
  check(
    "and does so without a network round trip",
    Date.now() - t0 < 200,
    `${Date.now() - t0}ms`
  );

  const samePlace = route({
    slug: "no-journey",
    destinationLat: -22.4799,
    destinationLng: 17.4709,
  });
  const unchanged = await withRouteGeometry(samePlace);
  check(
    "a route ending where it starts has no line to draw",
    unchanged.routeGeometry === null
  );

  // The real test: Mapbox is unreachable here, so this exercises the failure.
  const unreachable = await withRouteGeometry(route({ slug: "unreachable" }));
  check(
    "an unreachable Mapbox does not throw",
    unreachable !== null && unreachable !== undefined
  );
  check(
    "and leaves the route otherwise intact",
    unreachable.slug === "unreachable" &&
      unreachable.fixedPrice === "650.00" &&
      unreachable.originLat === -22.4799
  );
  check(
    "so the map degrades to two pins rather than vanishing",
    unreachable.routeGeometry === null
  );

  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const noToken = await withRouteGeometry(route({ slug: "no-token" }));
  check("no token means no attempt at all", noToken.routeGeometry === null);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("threw:", error);
  process.exit(1);
});
