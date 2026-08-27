/**
 * Polyline decoding.
 *
 * The failure mode worth guarding is silent: a wrong precision or a flipped
 * coordinate order does not throw, it just draws the route somewhere else on
 * Earth. These assert against fixtures encoded from known Namibian points.
 */
import { boundsOf, decodePolyline } from "@/lib/maps/polyline";

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

/** Reference encoder, so the fixtures are derived rather than copied. */
function encode(points: [number, number][], precision = 6): string {
  const factor = 10 ** precision;
  let out = "";
  let prevLat = 0;
  let prevLng = 0;

  const chunk = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let s = "";
    while (v >= 0x20) {
      s += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    s += String.fromCharCode(v + 63);
    return s;
  };

  for (const [lng, lat] of points) {
    const latE = Math.round(lat * factor);
    const lngE = Math.round(lng * factor);
    out += chunk(latE - prevLat) + chunk(lngE - prevLng);
    prevLat = latE;
    prevLng = lngE;
  }
  return out;
}

const WDH: [number, number] = [17.4709, -22.4799];
const WINDHOEK: [number, number] = [17.0658, -22.5609];
const SWAKOP: [number, number] = [14.5272, -22.6792];

console.log("\npolyline decoding");

const round = (n: number) => Math.round(n * 1e6) / 1e6;

const trip = [WDH, WINDHOEK, SWAKOP];
const decoded = decodePolyline(encode(trip, 6), 6);

check("decodes every point", decoded.length === 3, `${decoded.length}`);
check(
  "round-trips coordinates exactly at precision 6",
  decoded.every(
    ([lng, lat], i) =>
      round(lng) === trip[i][0] && round(lat) === trip[i][1]
  ),
  JSON.stringify(decoded)
);

// The silent killer: GeoJSON is [lng, lat]. Getting it backwards puts a
// Namibian route in the Indian Ocean without any error.
const [lng0, lat0] = decoded[0];
check("returns [lng, lat] not [lat, lng]", lng0 > 0 && lat0 < 0, `${lng0},${lat0}`);
check("longitude is Namibian (11–26E)", lng0 > 11 && lng0 < 26);
check("latitude is Namibian (17–29S)", lat0 < -17 && lat0 > -29);

// Precision mismatch does not throw — it must be caught by the caller being
// explicit, so prove the two differ by the factor of ten they should.
const asFive = decodePolyline(encode(trip, 6), 5);
check(
  "decoding polyline6 as polyline5 is off by 10x, not an error",
  Math.abs(asFive[0][0] - lng0 * 10) < 0.001,
  `${asFive[0][0]} vs ${lng0 * 10}`
);

const single = decodePolyline(encode([WDH], 6), 6);
check("handles a single point", single.length === 1);
check("handles an empty string", decodePolyline("", 6).length === 0);

console.log("\nbounds");
const b = boundsOf(decoded)!;
check("west is the Swakopmund longitude", round(b[0][0]) === SWAKOP[0], JSON.stringify(b));
check("east is the airport longitude", round(b[1][0]) === WDH[0]);
check("south is the Swakopmund latitude", round(b[0][1]) === SWAKOP[1]);
check("north is the airport latitude", round(b[1][1]) === WDH[1]);
check("empty path has no bounds", boundsOf([]) === null);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
