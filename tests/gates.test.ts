/**
 * The sun, verified twice over.
 *
 * Our sunrise equation is checked against suncalc — an independent, widely
 * deployed implementation of the same astronomy — across a full year at
 * three latitudes, and then against a published almanac time for Windhoek.
 * Two independent computations agreeing to a couple of minutes, plus one
 * external anchor, is how we know a gate warning tells the truth.
 */
import * as SunCalc from "suncalc";

import { formatMinutes, gateCheck, sunTimes } from "@/lib/parks/gates";

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

/* --------------------------------------- against suncalc, across the year */

console.log("our sunrise equation against suncalc, 2026, three latitudes");

const PLACES: [string, number, number][] = [
  ["windhoek", -22.5609, 17.0658],
  ["etosha", -19.36, 15.92],
  ["luderitz", -26.6481, 15.1594],
];

// suncalc returns UTC Dates; Namibian wall time is a fixed +02:00.
function suncalcMinutes(date: Date, lat: number, lng: number) {
  const times = SunCalc.getTimes(date, lat, lng);
  // The typings allow null for polar latitudes; Namibia is nowhere near one.
  if (!times.sunrise || !times.sunset) return null;
  const toMin = (d: Date) =>
    (((d.getTime() / 60000 + 120) % 1440) + 1440) % 1440;
  return { sunriseMin: toMin(times.sunrise), sunsetMin: toMin(times.sunset) };
}

let worstDrift = 0;
let comparisons = 0;
let agreeing = 0;

for (const [, lat, lng] of PLACES) {
  for (let day = 0; day < 365; day += 5) {
    const date = new Date(Date.UTC(2026, 0, 1 + day, 12));
    const iso = date.toISOString().slice(0, 10);
    const ours = sunTimes(lat, lng, iso);
    if (!ours) continue;
    const theirs = suncalcMinutes(date, lat, lng);
    if (!theirs) continue;
    const drift = Math.max(
      Math.abs(ours.sunriseMin - theirs.sunriseMin),
      Math.abs(ours.sunsetMin - theirs.sunsetMin),
    );
    worstDrift = Math.max(worstDrift, drift);
    comparisons += 1;
    if (drift <= 3) agreeing += 1;
  }
}

check(
  "every comparison within 3 minutes of suncalc",
  comparisons > 200 && agreeing === comparisons,
  `${agreeing}/${comparisons} agreed, worst drift ${worstDrift} min`,
);

/* ------------------------------------------------ against a published time */

console.log("\nagainst the almanac");

// Windhoek's latest sunset of 2026 is published as 19:43 on 15 January.
const jan15 = sunTimes(-22.5609, 17.0658, "2026-01-15");
check(
  "Windhoek 15 Jan 2026 sunset within 4 min of the published 19:43",
  jan15 !== null && Math.abs(jan15.sunsetMin - (19 * 60 + 43)) <= 4,
  jan15 ? `computed ${formatMinutes(jan15.sunsetMin)}` : "null",
);

// Winter and summer sunsets land in the right bands. Note that midwinter
// sunset is a little past six, not before it: Namibia's UTC+02:00 sits east
// of the country's natural zone, and the pre-2017 winter-time switch that
// once produced 17:20 sunsets is gone. Writing this test corrected a wrong
// "down before six" claim that had already shipped in a guide.
const june = sunTimes(-22.5609, 17.0658, "2026-06-21");
check(
  "Windhoek midwinter sunset between 18:00 and 18:30",
  june !== null && june.sunsetMin >= 18 * 60 && june.sunsetMin <= 18 * 60 + 30,
  june ? formatMinutes(june.sunsetMin) : "null",
);
check(
  "Windhoek midwinter sunrise between 07:00 and 07:40",
  june !== null &&
    june.sunriseMin >= 7 * 60 &&
    june.sunriseMin <= 7 * 60 + 40,
  june ? formatMinutes(june.sunriseMin) : "null",
);

/* --------------------------------------------------------- the gate check */

console.log("\nthe gate check");

// Etosha from Windhoek is 430 km and about 4h38 in the model. A two o'clock
// winter pickup arrives after the gate has shut; a morning one is fine.
const afternoon = gateCheck("etosha-okaukuejo", "2026-06-21", "14:00", 278);
check(
  "a 14:00 winter pickup to Okaukuejo is flagged late",
  afternoon !== null && afternoon.late,
  afternoon
    ? `arrives ${afternoon.arrivesAt}, gate closes ${afternoon.closesAt}`
    : "null",
);
check(
  "and names the Andersson Gate",
  afternoon !== null && afternoon.gate.includes("Andersson"),
);

const morning = gateCheck("etosha-okaukuejo", "2026-06-21", "08:00", 278);
check(
  "an 08:00 pickup on the same day is comfortable",
  morning !== null && !morning.late && !morning.tight,
  morning ? `arrives ${morning.arrivesAt}, closes ${morning.closesAt}` : "null",
);

// The same afternoon pickup in mid-January, when the sun sets after 19:30,
// squeaks in — the warning must follow the sun through the year.
const summer = gateCheck("etosha-okaukuejo", "2026-01-15", "14:00", 278);
check(
  "the same pickup in January is not late",
  summer !== null && !summer.late,
  summer ? `arrives ${summer.arrivesAt}, closes ${summer.closesAt}` : "null",
);

// Arrivals just inside the wire are tight, not fine.
const squeaky = gateCheck("etosha-okaukuejo", "2026-06-21", "13:30", 278);
check(
  "an arrival shortly before closing is flagged tight",
  squeaky !== null && !squeaky.late && squeaky.tight,
  squeaky
    ? `arrives ${squeaky.arrivesAt}, closes ${squeaky.closesAt}`
    : "null",
);

check(
  "a destination outside any park returns null",
  gateCheck("swakopmund", "2026-06-21", "14:00", 234) === null,
);
check(
  "a broken time returns null rather than blocking",
  gateCheck("etosha-okaukuejo", "2026-06-21", "later", 278) === null,
);
check(
  "leaveBy backs off duration plus the safety margin",
  morning !== null &&
    afternoon !== null &&
    morning.leaveBy === afternoon.leaveBy,
);

/* -------------------------------------------------------------- the tally */

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
