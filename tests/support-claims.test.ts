/**
 * The availability promise, held to what happens at 03:00.
 *
 * `SUPPORT.travelDay` said "Reachable throughout your journey, whatever the
 * hour". Nobody answers at 03:00, so that was "24/7" with the number filed
 * off — and it sat on the homepage, the contact page, the about page and the
 * footer while the project's own rules forbade exactly it.
 *
 * It survived the rule for a mechanical reason worth remembering: three of
 * the four surfaces had the sentence typed into the page rather than read
 * from `SUPPORT`. A rule against a claim does nothing when the claim is
 * spelled four different ways in four files, because weakening a promise
 * means finding all four, and nobody goes looking.
 *
 * So this bans the phrasings across the source, not the digits. "A claim
 * reworded is still the claim" is only enforceable if the reword is what gets
 * caught.
 */
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { SUPPORT } from "@/lib/company";

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

/** Every page and component a traveller can read. */
function sourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(root, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Comments are not copy — the reasoning for a retired claim must survive. */
function copyOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

const SURFACES = [
  ...sourceFiles("app"),
  ...sourceFiles("components"),
  "lib/company.ts",
  "lib/messaging/templates.ts",
];

/* ------------------------------------------------- the claim, reworded */

console.log("no round-the-clock promise, however it is phrased");

const BANNED: { phrase: RegExp; why: string }[] = [
  { phrase: /24\s*\/\s*7/, why: "the claim itself" },
  { phrase: /round[- ]the[- ]clock/i, why: "the same claim in words" },
  { phrase: /whatever the hour/i, why: "the exact reword that shipped" },
  { phrase: /at any hour/i, why: "same claim" },
  { phrase: /day or night/i, why: "same claim" },
  { phrase: /always reachable/i, why: "same claim" },
  {
    phrase: /reachable throughout your journey/i,
    why: "promises cover for the whole trip, including 03:00",
  },
  {
    phrase: /support throughout your journey/i,
    why: "the footer's wording of the same promise",
  },
];

for (const surface of SURFACES) {
  const copy = copyOnly(readFileSync(surface, "utf8"));
  for (const { phrase, why } of BANNED) {
    const hit = copy.match(phrase);
    if (hit) {
      check(`${surface} — "${hit[0]}" — ${why}`, false, `found "${hit[0]}"`);
    }
  }
}
check(
  `no banned phrasing across ${SURFACES.length} files`,
  failed === 0,
  `${failed} found`,
);

/* ------------------------------------------------ what it says instead */

console.log("\nit says what happens instead of when we answer");

check(
  "the travel-day line makes no availability claim",
  !/hour|24|always|any time|reachable/i.test(SUPPORT.travelDay),
  SUPPORT.travelDay,
);
check(
  "it states something a traveller can check",
  /flight number/i.test(SUPPORT.travelDay),
  SUPPORT.travelDay,
);
check(
  "coordination hours are still stated plainly",
  /\d{2}:\d{2}/.test(SUPPORT.officeHours) &&
    /\d{2}:\d{2}/.test(SUPPORT.officeHoursShort),
  SUPPORT.officeHours,
);

/**
 * The mechanical reason the old claim survived a rule written against it:
 * three of four surfaces typed the sentence rather than reading it from here.
 */
console.log("\nthe promise is read from one place, not retyped");

const travelDayReaders = SURFACES.filter((f) =>
  /SUPPORT\.travelDay/.test(readFileSync(f, "utf8")),
);
check(
  "at least one surface reads SUPPORT.travelDay",
  travelDayReaders.length > 0,
  `${travelDayReaders.length}`,
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
