/** Presentation helpers shared by the marketing pages and the admin table. */

/** 270 -> "4h 30m"; 45 -> "45 min". */
export function formatDuration(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** "400.00" -> "400 km". */
export function formatDistance(distanceKm: string | null): string | null {
  if (distanceKm === null) return null;
  const value = Number(distanceKm);
  if (!Number.isFinite(value) || value <= 0) return null;
  return `${Math.round(value)} km`;
}

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Windhoek",
});

const DATE_ONLY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Windhoek",
});

/** Always rendered in Namibian time — that is where the traveller will be. */
export function formatDateTime(value: Date | string): string {
  return DATE_TIME.format(new Date(value));
}

export function formatDate(value: Date | string): string {
  return DATE_ONLY.format(new Date(value));
}

/** "Hosea Kutako International Airport (WDH)" -> "Hosea Kutako (WDH)". */
export function shortPlace(label: string): string {
  return label.replace(" International Airport (WDH)", " (WDH)");
}
