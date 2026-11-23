/**
 * Verified places: a lodge an operator pinned and measured is priced to the
 * door, everywhere a town is.
 *
 * The failures this guards are the ones that cost money or trust: a lodge
 * silently priced as its nearest town, a place that can be searched but not
 * booked, a typo in an anchor sending a quote down a road that does not
 * exist, and a two-kilometre hop from a guest farm to the terminal sold for
 * less than the car costs to send.
 */
import { modelJourney, parseJourneySlug } from "@/lib/network/journey";
import { findNode, PLACE_NODES, searchNodes } from "@/lib/network/nodes";
import { resolvePlace } from "@/lib/network/place-resolution";
import { findRoad } from "@/lib/network/roads";
import { applyVerifiedPlaces, type VerifiedPlace } from "@/lib/network/verified-places";
import { modelCost } from "@/lib/pricing/cost-model";
import { parseCoordinates, placeSlug } from "@/lib/places/slug";

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

// Figures here are fixtures for the arithmetic, not claims about the places.
const ETANGO: VerifiedPlace = {
  slug: "etango-ranch-guest-farm",
  name: "Etango Ranch Guest Farm",
  lat: -22.47,
  lng: 17.46,
  anchorSlug: "hosea-kutako",
  accessKm: 2,
  accessSurface: "tar",
  minimumFare: 950,
};
const LODGE: VerifiedPlace = {
  slug: "a-desert-lodge",
  name: "A Desert Lodge",
  lat: -24.1,
  lng: 15.9,
  anchorSlug: "solitaire",
  accessKm: 30,
  accessSurface: "gravel",
  minimumFare: null,
};

console.log("\nbefore anything is verified");
applyVerifiedPlaces([]);
check("an unverified lodge is not a node", findNode(LODGE.slug) === null);
check("and cannot be priced", modelJourney("windhoek", LODGE.slug) === null);

console.log("\na verified place is priced to the door");
applyVerifiedPlaces([ETANGO, LODGE]);

const toTown = findRoad("windhoek", "solitaire")!;
const toLodge = findRoad("windhoek", LODGE.slug);
check("it is routable from anywhere", toLodge !== null);
check(
  "THE RULE: the access drive is added to the road, not swallowed",
  toLodge !== null && toLodge.km === toTown.km + 30,
  `${toLodge?.km} vs ${toTown.km} + 30`,
);
check(
  "and it is costed on its own surface",
  toLodge !== null && toLodge.gravelKm === toTown.gravelKm + 30,
);
check(
  "so the lodge costs more than the town it is near",
  modelCost(toLodge!).price > modelCost(toTown).price,
  `${modelCost(toLodge!).price} vs ${modelCost(toTown).price}`,
);
check(
  "the traveller sees the lodge's own name on the route",
  modelJourney("windhoek", LODGE.slug)?.route.destinationLabel === "A Desert Lodge",
);
check(
  "a journey slug to a place parses like one to a town",
  parseJourneySlug(`windhoek-to-${LODGE.slug}`)?.destination.slug === LODGE.slug,
);
check(
  "one verified place to another is routable",
  findRoad(ETANGO.slug, LODGE.slug) !== null,
);

console.log("\nthe guest farm beside the airport");
const farmToTerminal = modelJourney(ETANGO.slug, "hosea-kutako");
check(
  "a two-kilometre hop is a real leg, not 'the same place twice'",
  farmToTerminal !== null && farmToTerminal.road.km === 2,
);
check(
  "THE RULE: it is never sold below the floor the operator set",
  Number(farmToTerminal?.route.fixedPrice) >= 950,
  String(farmToTerminal?.route.fixedPrice),
);
check(
  "the floor does not leak onto trips that do not touch the place",
  modelCost(findRoad("hosea-kutako", "windhoek")!).price < 950,
);
check(
  "and payout plus contribution still reconcile at the floor",
  (() => {
    const cost = modelCost(farmToTerminal!.road);
    return cost.payout + cost.contribution === cost.price;
  })(),
);

console.log("\nsearch and the assistant know it");
check(
  "typing its name offers it first",
  searchNodes("Etango", 3)[0]?.slug === ETANGO.slug,
  searchNodes("Etango", 3).map((n) => n.slug).join(", "),
);
check(
  "the resolver returns the place itself once it is verified",
  resolvePlace("Etango Ranch Guest Farm").slug === ETANGO.slug,
);

console.log("\nwhat it must not do");
check(
  "the built-in model is not grown: no new pages, no new pairs",
  PLACE_NODES.length === 49 && !PLACE_NODES.some((n) => n.slug === LODGE.slug),
);
applyVerifiedPlaces([{ ...LODGE, anchorSlug: "soltaire" }]);
check(
  "a place with a misspelt anchor is dropped, never guessed at",
  findNode(LODGE.slug) === null,
);
applyVerifiedPlaces([{ ...LODGE, slug: "windhoek", name: "Windhoek" }]);
check(
  "a place cannot shadow a town",
  findNode("windhoek")?.verified === undefined,
);
applyVerifiedPlaces([{ ...LODGE, accessKm: 0 }]);
check("a place with no measured drive is not priced", findNode(LODGE.slug) === null);
applyVerifiedPlaces([]);
check(
  "removing a place removes its price",
  findNode(ETANGO.slug) === null && findRoad("windhoek", ETANGO.slug) === null,
);

console.log("\nwhat an operator pastes");
check(
  "plain coordinates",
  JSON.stringify(parseCoordinates("-22.4712, 17.4655")) === JSON.stringify({ lat: -22.4712, lng: 17.4655 }),
);
check(
  "THE RULE: a Google Maps link uses the dropped pin, not where the map was centred",
  JSON.stringify(
    parseCoordinates("https://www.google.com/maps/place/X/@-22.9,17.1,12z/data=!3d-22.4712!4d17.4655"),
  ) === JSON.stringify({ lat: -22.4712, lng: 17.4655 }),
);
check("a link with only a centre still yields it", parseCoordinates("https://maps.google.com/@-22.47,17.46,15z")?.lat === -22.47);
check("text with no pin is refused", parseCoordinates("Etango Ranch") === null);
check("a name becomes a url-safe slug", placeSlug("Etango Ranch Guest Farm") === "etango-ranch-guest-farm");
check(
  "a name containing 'to' cannot break the journey slug",
  !placeSlug("Road to Nowhere Lodge").includes("-to-"),
  placeSlug("Road to Nowhere Lodge"),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
