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
