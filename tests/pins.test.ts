/**
 * Dropped-pin validation.
 *
 * This is the one place a booking takes free-form geography from the browser,
 * and Server Actions are public endpoints — so the guard has to hold against
 * a hand-crafted request, not just against a mis-drag. The failure mode is
 * silent and expensive: a coordinate that passes validation but points at
 * open ocean is a driver sent nowhere and a trip that fails on the day.
 */
import { bookingFormSchema } from "@/lib/booking/schema";
import { isInNamibia, mapsLink, roundCoord } from "@/lib/maps/bounds";

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

/* --------------------------------------------------------------- in bounds */

const WINDHOEK = { lat: -22.5609, lng: 17.0658 };
const WDH_AIRPORT = { lat: -22.4799, lng: 17.4709 };
const SWAKOPMUND = { lat: -22.6792, lng: 14.5272 };
const SESRIEM = { lat: -24.4869, lng: 15.7969 };
const KATIMA = { lat: -17.5, lng: 24.27 }; // Zambezi, the far north-east

check("Windhoek is in Namibia", isInNamibia(WINDHOEK));
check("Hosea Kutako is in Namibia", isInNamibia(WDH_AIRPORT));
check("Swakopmund is in Namibia", isInNamibia(SWAKOPMUND));
check("Sesriem is in Namibia", isInNamibia(SESRIEM));
check("Katima Mulilo is in Namibia", isInNamibia(KATIMA));

/* ------------------------------------------------------------ out of bounds */

check("Cape Town is rejected", !isInNamibia({ lat: -33.9249, lng: 18.4241 }));
check("Johannesburg is rejected", !isInNamibia({ lat: -26.2041, lng: 28.0473 }));
check("London is rejected", !isInNamibia({ lat: 51.5072, lng: -0.1276 }));
check(
  "the Atlantic west of Namibia is rejected",
  !isInNamibia({ lat: -22.6, lng: 8.0 })
);
check("null island is rejected", !isInNamibia({ lat: 0, lng: 0 }));
check(
  "a flipped lat/lng pair is rejected",
  !isInNamibia({ lat: WINDHOEK.lng, lng: WINDHOEK.lat }),
  "17.07,-22.56 is in the Atlantic off Ghana"
);
check("NaN is rejected", !isInNamibia({ lat: NaN, lng: NaN }));
check(
  "Infinity is rejected",
  !isInNamibia({ lat: Infinity, lng: -Infinity })
);

/* ---------------------------------------------------------------- rounding */

check(
  "rounds to six decimals",
  roundCoord(-22.560912345678) === -22.560912,
  String(roundCoord(-22.560912345678))
);
check("leaves a short value alone", roundCoord(17.0658) === 17.0658);
check(
  "a rounded coordinate is still in bounds",
  isInNamibia({ lat: roundCoord(WINDHOEK.lat), lng: roundCoord(WINDHOEK.lng) })
);

/* ------------------------------------------------------------- the maps link */

check(
  "the maps link carries the rounded pair",
  mapsLink(WINDHOEK).endsWith("query=-22.5609,17.0658"),
  mapsLink(WINDHOEK)
);

/* ------------------------------------------- the schema the action re-runs */

const base = {
  routeSlug: "hosea-kutako-to-windhoek",
  vehicleClassId: "ee436195-7c01-5604-b31d-de90e000ff07",
  date: "2026-09-12",
  time: "14:30",
  passengers: 2,
  luggageCount: 1,
  fullName: "Test Traveller",
  whatsapp: "+264811234567",
  customerType: "tourist" as const,
  pickupLabel: "Arrivals hall",
  dropoffLabel: "Windhoek Country Club Resort",
  isReturn: false,
};

check(
  "a booking with no pin at all is valid",
  bookingFormSchema.safeParse(base).success
);
check(
  "an explicit null pin is valid",
  bookingFormSchema.safeParse({ ...base, dropoffPin: null }).success
);
check(
  "a pin inside Namibia is accepted",
  bookingFormSchema.safeParse({ ...base, dropoffPin: WINDHOEK }).success
);

const capeTown = bookingFormSchema.safeParse({
  ...base,
  dropoffPin: { lat: -33.9249, lng: 18.4241 },
});
check("a pin in Cape Town is refused by the schema", !capeTown.success);

const flipped = bookingFormSchema.safeParse({
  ...base,
  pickupPin: { lat: WINDHOEK.lng, lng: WINDHOEK.lat },
});
check("a flipped pair is refused by the schema", !flipped.success);

const stringy = bookingFormSchema.safeParse({
  ...base,
  dropoffPin: { lat: "-22.5609", lng: "17.0658" },
});
check(
  "numeric strings from a form post are coerced",
  stringy.success &&
    stringy.data.dropoffPin?.lat === -22.5609 &&
    stringy.data.dropoffPin?.lng === 17.0658
);

const nonsense = bookingFormSchema.safeParse({
  ...base,
  dropoffPin: { lat: "not-a-number", lng: 17.0658 },
});
check("a non-numeric pin is refused", !nonsense.success);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
