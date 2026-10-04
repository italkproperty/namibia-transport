import { routeItineraryIntelligence, resolvePlace } from "@/lib/network/place-resolution";

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

console.log("\nNamibia place resolution");

const lodge = resolvePlace("Namib Desert Lodge");
check("Namib Desert Lodge resolves", lodge.slug === "solitaire", JSON.stringify(lodge));

const sossus = resolvePlace("Sossusvlei / Deadvlei");
check("Sossusvlei / Deadvlei resolves", sossus.slug === "sossusvlei", JSON.stringify(sossus));

const trip = routeItineraryIntelligence([
  { place: "Solitaire", label: "Namib Desert Lodge" },
  { place: "Sossusvlei", label: "Sossusvlei / Deadvlei" },
  { place: "Solitaire", label: "Namib Desert Lodge" },
]);

check("lodge excursion is routable", trip.routable, JSON.stringify(trip));
check(
  "lodge is anchored to Solitaire",
  trip.stops[0]?.slug === "solitaire" && trip.stops[2]?.slug === "solitaire",
);
check(
  "dunes are anchored to Sossusvlei",
  trip.stops[1]?.slug === "sossusvlei",
);
check(
  "round trip has two real legs",
  trip.legs.length === 2 && trip.legs.every((leg) => leg.routable),
);
check(
  "round trip has a non-zero distance",
  trip.totalKm > 0,
  String(trip.totalKm),
);

const labelsOnly = routeItineraryIntelligence([
  { place: "", label: "Namib Desert Lodge" },
  { place: "", label: "Sossusvlei / Deadvlei" },
  { place: "", label: "Namib Desert Lodge" },
]);

check("AI label-only itinerary remains routable", labelsOnly.routable, JSON.stringify(labelsOnly));
check(
  "AI label-only lodge names resolve to trusted anchors",
  labelsOnly.stops[0]?.slug === "solitaire" &&
    labelsOnly.stops[1]?.slug === "sossusvlei" &&
    labelsOnly.stops[2]?.slug === "solitaire",
  JSON.stringify(labelsOnly.stops),
);

check(
  "round trip has a non-zero driving time",
  trip.totalDrivingMinutes > 0,
  String(trip.totalDrivingMinutes),
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
