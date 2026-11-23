/** "Etango Ranch Guest Farm" → "etango-ranch-guest-farm". URL-safe, stable. */
export function placeSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    // "-to-" is how a journey slug is split into its two ends.
    .replace(/-to-/g, "-2-")
    .slice(0, 80);
}

/**
 * Coordinates from what an operator pastes: "-22.4712, 17.4655", or a Google
 * Maps link, which carries the pin as "@lat,lng" or "!3dlat!4dlng". Null when
 * nothing in the text is a coordinate pair.
 */
export function parseCoordinates(text: string): { lat: number; lng: number } | null {
  const precise = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(text);
  const at = /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/.exec(text);
  const query = /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/.exec(text);
  const plain = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  // The "!3d…!4d…" pair is the dropped pin; "@…" is only where the map was
  // centred, which can be kilometres away.
  const match = precise ?? query ?? plain ?? at;
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
