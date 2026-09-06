/**
 * Park gates as functions of the sun.
 *
 * Namibia's park gates do not keep clock hours — they open at sunrise and
 * close at sunset, and the closing is strict: whoever is outside at sunset
 * stays outside. A pickup time that lands a transfer at an Etosha gate after
 * dark is therefore not a late arrival, it is a failed trip, and the moment
 * to say so is while the traveller is choosing the time, not at the gate.
 *
 * Sunrise and sunset are computed here from first principles (the standard
 * sunrise equation, NOAA's simplification) rather than fetched, because the
 * sun is the one dependency that never has an outage. Namibia is UTC+02:00
 * all year — no daylight saving since 2017 — so the offset is a constant,
 * never read from the runtime. The tests verify this implementation against
 * an independent one (suncalc) across a full year, and against published
 * almanac times for Windhoek.
 */

const RAD = Math.PI / 180;

/** Days since the J2000 epoch for a calendar date, via the Julian day number. */
function daysSinceJ2000(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jdn =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;
  return jdn - 2451545;
}

export type SunTimes = {
  /** Minutes after Namibian midnight (UTC+02:00). */
  sunriseMin: number;
  sunsetMin: number;
};

/**
 * Sunrise and sunset for a place and date, in Namibian minutes-of-day.
 * Accurate to a couple of minutes, which is more precision than a gate
 * guard's watch. Returns null only inside polar circles, which Namibia
 * is comfortably not.
 */
export function sunTimes(
  lat: number,
  lng: number,
  dateIso: string,
): SunTimes | null {
  const [year, month, day] = dateIso.split("-").map(Number);
  if (!year || !month || !day) return null;

  const n = daysSinceJ2000(year, month, day) + 0.0008;
  // East of Greenwich the sun crosses the meridian before 12:00 UTC, so an
  // eastern longitude pulls mean solar noon earlier. Getting this sign wrong
  // shifts every time by two hours at Namibia's longitude — the suncalc
  // cross-check in the tests exists precisely to catch it.
  const meanSolarNoon = n - lng / 360;

  const M = (357.5291 + 0.98560028 * meanSolarNoon) % 360;
  const C =
    1.9148 * Math.sin(M * RAD) +
    0.02 * Math.sin(2 * M * RAD) +
    0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;

  // Days since J2000 where whole numbers fall at NOON UTC — the Julian
  // convention. The +0.5 below moves the day boundary to midnight before
  // the fraction is taken, and +2/24 shifts UTC to Namibian time.
  const transit =
    meanSolarNoon +
    0.0053 * Math.sin(M * RAD) -
    0.0069 * Math.sin(2 * lambda * RAD);

  const declination = Math.asin(
    Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD),
  );

  // -0.833° accounts for refraction and the sun's radius: the moment the
  // upper limb touches the horizon, which is what "sunset" means at a gate.
  const cosHourAngle =
    (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(declination)) /
    (Math.cos(lat * RAD) * Math.cos(declination));
  if (cosHourAngle < -1 || cosHourAngle > 1) return null;

  const hourAngle = Math.acos(cosHourAngle) / RAD / 360; // in days

  const frac = (d: number) => ((d % 1) + 1) % 1;
  const toLocalMin = (d: number) => Math.round(frac(d + 0.5 + 2 / 24) * 1440);
  return {
    sunriseMin: toLocalMin(transit - hourAngle),
    sunsetMin: toLocalMin(transit + hourAngle),
  };
}

export function formatMinutes(minutes: number): string {
  const clamped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ------------------------------------------------------------- gate rules */

export type GateRule = {
  /** The gate the traveller actually has to be through. */
  gate: string;
  lat: number;
  lng: number;
};

/**
 * Destinations that sit INSIDE a sunset-gated park, keyed by node slug.
 *
 * Sossusvlei is deliberately absent: our node stands for the Sesriem area,
 * and most lodges there are outside the park gate, so a sunset warning would
 * be wrong more often than right — the "arrive in daylight" advice for that
 * route lives in its guide instead. The sun is computed at the gate's own
 * coordinates, not the camp's: it is the gate that closes.
 */
export const GATE_RULES: Record<string, GateRule> = {
  "etosha-okaukuejo": {
    gate: "Etosha's Andersson Gate",
    lat: -19.36,
    lng: 15.92,
  },
  "etosha-namutoni": {
    gate: "Etosha's Von Lindequist Gate",
    lat: -18.81,
    lng: 17.05,
  },
  waterberg: {
    gate: "the Waterberg park gate",
    lat: -20.5,
    lng: 17.24,
  },
  "fish-river-canyon": {
    gate: "the Hobas park gate",
    lat: -27.62,
    lng: 17.76,
  },
  "ai-ais": {
    gate: "the Ai-Ais park gate",
    lat: -27.92,
    lng: 17.48,
  },
};

export type GateCheck = {
  gate: string;
  /** "HH:MM" Namibian time. */
  closesAt: string;
  arrivesAt: string;
  /** Leave this margin and the schedule survives a slow stretch of gravel. */
  leaveBy: string;
  /** Arrival is after the gate has closed. */
  late: boolean;
  /** Arrival is inside the safety margin before closing. */
  tight: boolean;
};

/** How much road delay a sane plan absorbs before the gate becomes a problem. */
const SAFETY_MARGIN_MIN = 45;

/**
 * Whether a pickup at `timeHHMM` on `dateIso` reaches a gated destination
 * before its gate closes. Null when the destination is not gated, or when
 * the inputs do not parse — a broken date must never block a booking.
 */
export function gateCheck(
  destinationSlug: string,
  dateIso: string,
  timeHHMM: string,
  durationMin: number | null,
): GateCheck | null {
  const rule = GATE_RULES[destinationSlug];
  if (!rule || !durationMin || durationMin <= 0) return null;

  const [h, m] = timeHHMM.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;

  const sun = sunTimes(rule.lat, rule.lng, dateIso);
  if (!sun) return null;

  const departMin = h * 60 + m;
  const arriveMin = departMin + durationMin;

  return {
    gate: rule.gate,
    closesAt: formatMinutes(sun.sunsetMin),
    arrivesAt: formatMinutes(arriveMin),
    leaveBy: formatMinutes(sun.sunsetMin - durationMin - SAFETY_MARGIN_MIN),
    late: arriveMin > sun.sunsetMin,
    tight:
      arriveMin <= sun.sunsetMin &&
      arriveMin > sun.sunsetMin - SAFETY_MARGIN_MIN,
  };
}
