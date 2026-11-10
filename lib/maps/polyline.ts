/**
 * Decoder for Google's encoded-polyline format, which is what Mapbox
 * Directions returns for a route's geometry.
 *
 * Written rather than pulled in, because it is thirty lines of well-specified
 * bit-twiddling and the alternative was a dependency in the browser bundle for
 * one function.
 *
 * Precision matters: Mapbox's `polyline6` uses six decimal places, the default
 * `polyline` uses five. Decoding one as the other does not fail — it silently
 * puts the route in the wrong hemisphere, so the caller must be explicit.
 */

export type LngLat = [number, number];

/**
 * Returns GeoJSON coordinate order — [longitude, latitude] — because that is
 * what every map library consumes, and the reverse of how the numbers are
 * spoken.
 */
export function decodePolyline(encoded: string, precision = 6): LngLat[] {
  const factor = 10 ** precision;
  const coordinates: LngLat[] = [];

  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    // Latitude: five-bit chunks, low-order first, continuation bit at 0x20.
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push([lng / factor, lat / factor]);
  }

  return coordinates;
}

/** Bounding box of a path, as [[west, south], [east, north]]. */
export function boundsOf(coordinates: LngLat[]): [LngLat, LngLat] | null {
  if (coordinates.length === 0) return null;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const [lng, lat] of coordinates) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }

  return [
    [west, south],
    [east, north],
  ];
}

/** The inverse of decodePolyline, same [lng, lat] order in. */
export function encodePolyline(coordinates: LngLat[], precision = 5): string {
  const factor = 10 ** precision;
  let out = "";
  let prevLat = 0;
  let prevLng = 0;
  const push = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };
  for (const [lng, lat] of coordinates) {
    const latI = Math.round(lat * factor);
    const lngI = Math.round(lng * factor);
    push(latI - prevLat);
    push(lngI - prevLng);
    prevLat = latI;
    prevLng = lngI;
  }
  return out;
}

function perpendicularDistance(point: LngLat, a: LngLat, b: LngLat): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  const t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(point[0] - (a[0] + clamped * dx), point[1] - (a[1] + clamped * dy));
}

/**
 * Douglas–Peucker in degrees. Iterative, because a 1,500 km Namibian
 * itinerary at full Directions resolution is tens of thousands of points
 * and the recursive form would blow the stack on it.
 */
export function simplifyPath(coordinates: LngLat[], tolerance: number): LngLat[] {
  if (coordinates.length <= 2 || tolerance <= 0) return coordinates;
  const keep = new Uint8Array(coordinates.length);
  keep[0] = 1;
  keep[coordinates.length - 1] = 1;
  const stack: [number, number][] = [[0, coordinates.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxDistance = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = perpendicularDistance(coordinates[i], coordinates[first], coordinates[last]);
      if (d > maxDistance) {
        maxDistance = d;
        index = i;
      }
    }
    if (index !== -1 && maxDistance > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return coordinates.filter((_, i) => keep[i] === 1);
}

/**
 * A Directions polyline that fits in a static-map URL.
 *
 * Mapbox's Static Images API takes the whole route as one path in the URL,
 * and the URL is capped at 8,192 characters. The full-resolution polyline6
 * for a multi-day itinerary is far past that. This decodes it, simplifies
 * at a growing tolerance until the precision-5 encoding fits the budget,
 * and returns that encoding — the same line to the eye, a few kilobytes on
 * the wire, and small enough to live in the quote's saved snapshot.
 */
export function compactPolyline(
  encoded: string,
  { fromPrecision = 6, maxChars = 5_000 }: { fromPrecision?: number; maxChars?: number } = {},
): string | null {
  if (!encoded) return null;
  let points = decodePolyline(encoded, fromPrecision);
  if (points.length < 2) return null;
  // ~0.0005° is about 50 m, invisible on a map of the whole country.
  let tolerance = 0.0005;
  for (let attempt = 0; attempt < 12; attempt++) {
    const simplified = simplifyPath(points, tolerance);
    const out = encodePolyline(simplified, 5);
    if (out.length <= maxChars) return out;
    points = simplified;
    tolerance *= 2;
  }
  return null;
}
