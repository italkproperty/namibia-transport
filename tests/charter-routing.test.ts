import assert from "node:assert/strict";
import {
  CharterRoutingError,
  routeCharterItinerary,
  searchCharterDestinations,
} from "../lib/maps/charter-routing";

async function main() {
  await assert.rejects(
    () => searchCharterDestinations("  "),
    (error: unknown) =>
      error instanceof CharterRoutingError && error.code === "invalid_query",
  );
  await assert.rejects(
    () => routeCharterItinerary([]),
    (error: unknown) =>
      error instanceof CharterRoutingError && error.code === "route_not_found",
  );
  await assert.rejects(
    () => routeCharterItinerary([
      { label: "Windhoek", coordinates: { lat: -22.56, lng: 17.06 }, source: "operator_confirmed" },
      { label: "Sossusvlei", coordinates: { lat: -24.73, lng: 15.29 }, source: "operator_confirmed" },
    ].concat(Array.from({ length: 24 }, (_, index) => ({
      label: `Stop ${index + 3}`,
      coordinates: { lat: -22 + index / 100, lng: 17 + index / 100 },
      source: "operator_confirmed" as const,
    })))),
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
