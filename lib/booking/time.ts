/**
 * Namibia has been on UTC+02:00 year-round since it abolished DST in 2017, so
 * a fixed offset is correct here and avoids pulling in a timezone library.
 * If that ever changes, this is the one place to fix.
 */
const NAMIBIA_UTC_OFFSET = "+02:00";

/**
 * Combines the date and time the traveller picked — which they mean in
 * Namibian local time — into a real instant.
 */
export function namibianLocalToInstant(date: string, time: string): Date {
  const instant = new Date(`${date}T${time}:00${NAMIBIA_UTC_OFFSET}`);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Invalid pickup date/time: ${date} ${time}`);
  }
  return instant;
}

/** Today in Namibia as yyyy-mm-dd — the earliest date a traveller may pick. */
export function namibianToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Windhoek",
  }).format(new Date());
}
