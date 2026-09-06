/**
 * Per-vehicle pricing, held to the September 2026 spec.
 *
 * The bug this guards against: airport transfers multiplied the fare by the
 * party size, so three people paid N$1,950 for a 45-minute drive and N$4,200
 * for four and a half hours. Nothing in the cost base scales with passenger
 * count, and our own fare model derives the airport run's N$650 per vehicle
 * from the minimum call-out. Passenger count and luggage select the vehicle
 * class; they never multiply the fare — and no route may carry per_person
 * until a genuine scheduled shared shuttle exists.
 */
import { classFits, smallestFittingClass } from "@/lib/booking/eligibility";
import { parseTripParams, partyTooLarge } from "@/lib/booking/trip-params";
import {
  CATALOG_ROUTES,
  CATALOG_VEHICLE_CLASSES,
} from "@/lib/catalog";
import type { RouteView, VehicleClassView } from "@/lib/maps/types";
import { computeFare, pricingUnitLabel, unitFare } from "@/lib/pricing";

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

/* ----------------------------------------------------------- the fixtures */

// The catalogue rows are inserts (id optional until seeded); the app reads
// them back as views. Cast once, here, rather than at every call site.
const sedan = CATALOG_VEHICLE_CLASSES.find(
  (c) => c.slug === "private-sedan",
)! as unknown as VehicleClassView;
const suv = CATALOG_VEHICLE_CLASSES.find(
  (c) => c.slug === "suv-4x4",
)! as unknown as VehicleClassView;
const classes: VehicleClassView[] = [sedan, suv];

const airport = CATALOG_ROUTES.find(
  (r) => r.slug === "hosea-kutako-to-windhoek",
)! as unknown as RouteView;
const swakop = CATALOG_ROUTES.find(
  (r) => r.slug === "hosea-kutako-to-swakopmund",
)! as unknown as RouteView;

const price = (route: RouteView, cls: VehicleClassView) =>
  Number(computeFare(route, cls).customerPrice);

/* -------------------------------------------------- no per-person anywhere */

console.log("no route sells a seat");

check(
  "the catalogue carries no per_person route",
  CATALOG_ROUTES.every((r) => r.pricingUnit !== "per_person"),
  CATALOG_ROUTES.filter((r) => r.pricingUnit === "per_person")
    .map((r) => r.slug)
    .join(", "),
);
check(
  "every price label reads per vehicle",
  pricingUnitLabel(airport) === "per vehicle" &&
    pricingUnitLabel({ pricingUnit: "per_person" }) === "per vehicle",
);
check(
  "honest capacities: sedan 3 seats and 2 large cases, SUV 5 and 4",
  sedan.capacity === 3 &&
    sedan.luggageCapacity === 2 &&
    suv.capacity === 5 &&
    suv.luggageCapacity === 4,
);

/* -------------------------------------------------- the spec's price table */

console.log("\nthe fare never multiplies by the party");

// The two bold rows of the spec: these used to return N$1,950 and N$4,550.
check("WDH -> Windhoek, sedan: N$650 whatever the party", price(airport, sedan) === 650);
check("WDH -> Windhoek, SUV: N$910 whatever the party", price(airport, suv) === 910);
check("WDH -> Swakopmund, sedan: N$4,200", price(swakop, sedan) === 4200);
check("WDH -> Swakopmund, SUV: N$5,880", price(swakop, suv) === 5880);
check(
  // Within float noise of a whole rand: 650 × 1.4 is 909.999… in IEEE 754,
  // and computeFare's rounding is what the customer sees. The invariant is
  // that no catalogue fare produces a genuine fraction the rounding could
  // move away from what was advertised.
  "the 1.4 multiplier lands on whole rand for every catalogue fare",
  CATALOG_ROUTES.every((r) => {
    const scaled = Number(r.fixedPrice) * 1.4;
    return Math.abs(scaled - Math.round(scaled)) < 1e-6;
  }),
);
check(
  "unitFare and the total are the same number — a fare buys the vehicle",
  unitFare(airport, sedan) === price(airport, sedan),
);

/* -------------------------------------------------- eligibility, not price */

console.log("\npassengers and luggage choose the vehicle, never the fare");

check("1 pax, 1 case fits the sedan", classFits(sedan, 1, 1));
check("3 pax, 2 cases fits the sedan exactly", classFits(sedan, 3, 2));
check("4 pax does not fit the sedan", !classFits(sedan, 4, 2));
check("2 pax, 3 cases does not fit the sedan — luggage binds", !classFits(sedan, 2, 3));
check("5 pax, 4 cases fits the SUV exactly", classFits(suv, 5, 4));

check(
  "4 pax upgrades to the SUV",
  smallestFittingClass(classes, 4, 2)?.slug === "suv-4x4",
);
check(
  "2 pax with 3 cases upgrades to the SUV on luggage alone",
  smallestFittingClass(classes, 2, 3)?.slug === "suv-4x4",
);
check(
  "3 pax with 2 cases keeps the cheaper sedan",
  smallestFittingClass(classes, 3, 2)?.slug === "private-sedan",
);
check(
  "7 pax fits nothing — no price may be shown",
  smallestFittingClass(classes, 7, 2) === null,
);
check(
  "6 cases fits nothing — luggage alone can rule everything out",
  smallestFittingClass(classes, 1, 6) === null,
);

/* --------------------------------------------------- deep links stay honest */

console.log("\na deep link cannot pair a party with a car that cannot carry it");

const routes = [airport];

const upgraded = parseTripParams(
  { route: airport.slug, pax: "5", bags: "2", class: sedan.id },
  routes,
  classes,
);
check(
  "pax=5&class=sedan upgrades to the SUV",
  upgraded.vehicleClassId === suv.id,
  `got ${upgraded.vehicleClassId}`,
);
check("and keeps the passenger count for the driver", upgraded.passengers === 5);

const luggageUpgrade = parseTripParams(
  { route: airport.slug, pax: "2", bags: "3", class: sedan.id },
  routes,
  classes,
);
check(
  "bags=3&class=sedan upgrades on luggage",
  luggageUpgrade.vehicleClassId === suv.id,
);

const kept = parseTripParams(
  { route: airport.slug, pax: "2", bags: "1", class: sedan.id },
  routes,
  classes,
);
check("a fitting request keeps its class", kept.vehicleClassId === sedan.id);

const impossible = parseTripParams(
  { route: airport.slug, pax: "7", bags: "6", class: sedan.id },
  routes,
  classes,
);
check(
  "7 pax is flagged too large — enquiry, not a price",
  partyTooLarge(impossible, classes),
);
check(
  "a normal party is not flagged",
  !partyTooLarge(kept, classes),
);

/* -------------------------------------------------------------- the tally */

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
