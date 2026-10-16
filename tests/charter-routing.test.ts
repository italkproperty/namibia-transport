import assert from "node:assert/strict";
import {
  CharterRoutingError,
  routeCharterItinerary,
  searchCharterDestinations,
  type ResolvedDestination,
} from "../lib/maps/charter-routing";

async function main() {
  await assert.rejects(
    () => searchCharterDestinations("  "),
    (error: unknown) =>
      error instanceof CharterRoutingError && error.code === "invalid_query",
  );
  const kulala = await searchCharterDestinations("Kulala Desert Camp");
  assert.equal(kulala.length, 1, "informal Kulala Desert Camp name resolves to the curated lodge");
  assert.equal(kulala[0].name, "Kulala Desert Lodge");
  assert.ok(Math.abs(kulala[0].coordinates.lat - (-24.614952)) < 0.001);
  assert.ok(Math.abs(kulala[0].coordinates.lng - 15.703432) < 0.001);

  await assert.rejects(
    () => routeCharterItinerary([]),
    (error: unknown) =>
      error instanceof CharterRoutingError && error.code === "route_not_found",
  );

  const stops: ResolvedDestination[] = Array.from({ length: 26 }, (_, index) => ({
    label: `Stop ${index + 1}`,
    coordinates: { lat: -22 + index / 100, lng: 17 + index / 100 },
    source: "operator_confirmed",
  }));
  await assert.rejects(
    () => routeCharterItinerary(stops),
    (error: unknown) =>
      error instanceof CharterRoutingError && error.code === "too_many_stops",
  );
  await assert.rejects(
    () => routeCharterItinerary([
      { label: "Bad coordinate", coordinates: { lat: 200, lng: 17 }, source: "operator_confirmed" },
      { label: "Windhoek", coordinates: { lat: -22.56, lng: 17.06 }, source: "operator_confirmed" },
    ]),
    (error: unknown) =>
      error instanceof CharterRoutingError && error.code === "invalid_coordinates",
  );
  console.log("Charter routing validation tests passed.");
}

void main();
