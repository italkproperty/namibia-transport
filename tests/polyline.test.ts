/**
 * Polyline decoding.
 *
 * The failure mode worth guarding is silent: a wrong precision or a flipped
 * coordinate order does not throw, it just draws the route somewhere else on
 * Earth. These assert against fixtures encoded from known Namibian points.
 */
import { boundsOf, compactPolyline, decodePolyline, encodePolyline, simplifyPath, type LngLat } from "@/lib/maps/polyline";

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


// ---- encode, simplify, compact: the charter map depends on all three ----
console.log("\nencode and simplify");
{
  const path: LngLat[] = [[17.4709, -22.4799], [17.3, -22.5], [17.0658, -22.5609]];
  const decoded = decodePolyline(encodePolyline(path, 5), 5);
  check(
    "a path survives an encode/decode round trip at precision 5",
    decoded.length === 3 && decoded.every((pt, i) => Math.abs(pt[0] - path[i][0]) < 1e-5 && Math.abs(pt[1] - path[i][1]) < 1e-5),
    JSON.stringify(decoded),
  );
  const six = decodePolyline(encodePolyline(path, 6), 6);
  check("and at precision 6, which is what Directions returns", six.every((pt, i) => Math.abs(pt[1] - path[i][1]) < 1e-6));

  // A straight road sampled every 100 m with a 1 m wobble: simplification
  // must keep the ends, drop the wobble, and never invent a point.
  const road: LngLat[] = Array.from({ length: 2001 }, (_, i) => [17 + i * 0.001, -22.5 + (i % 2 ? 0.00001 : 0)]);
  const simple = simplifyPath(road, 0.0005);
  check("a straight road simplifies to its two ends", simple.length === 2, `${simple.length} points`);
  check("the ends are kept exactly", simple[0] === road[0] && simple[simple.length - 1] === road[road.length - 1]);
  check("a tolerance of zero changes nothing", simplifyPath(road, 0).length === road.length);

  // A 1,500 km zigzag at Directions resolution is far past a URL budget;
  // compaction must land under it and still trace the same shape.
  const long: LngLat[] = Array.from({ length: 30000 }, (_, i) => [14.5 + i * 0.0002, -22.5 + Math.sin(i / 300) * 2]);
  const encodedSix = encodePolyline(long, 6);
  const compact = compactPolyline(encodedSix, { maxChars: 5000 });
  check("a huge polyline compacts under the URL budget", compact !== null && compact.length <= 5000, `${compact?.length ?? "null"} chars from ${encodedSix.length}`);
  const shape = compact ? decodePolyline(compact, 5) : [];
  check("and still starts and ends where the road does", shape.length > 10 && Math.abs(shape[0][0] - long[0][0]) < 1e-4 && Math.abs(shape[shape.length - 1][0] - long[long.length - 1][0]) < 1e-4);
  check("an empty polyline compacts to nothing, not a crash", compactPolyline("") === null);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
