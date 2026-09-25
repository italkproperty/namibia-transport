/**
 * Every export in a `"use server"` file is a public endpoint.
 *
 * Not "a page calls it, so only that page reaches it" — Next compiles each
 * export into an addressable action and anyone on the internet can post to
 * it. The project already knew this and wrote it down; what it did not have
 * was anything that noticed when a new one shipped without a guard.
 *
 * It did happen. `isSettled` — the check that stops a paid booking being
 * re-priced — was exported from `booking-actions.ts` because two files needed
 * it. That published the guard itself as an endpoint. Harmless in that
 * instance, because its first argument is a database handle no caller could
 * serialise, and a genuinely bad version of the same accident is one keystroke
 * away.
 *
 * So the rule is enforced rather than remembered: every exported async
 * function in a `"use server"` file either checks the admin gate, or is named
 * below with the reason it is deliberately open. A new action is gated or it
 * fails this suite.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

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

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(root, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Actions that are public on purpose, each with the reason.
 *
 * An entry here is a decision, not a suppression: it says somebody looked at
 * this endpoint and concluded a stranger calling it cannot cost money, leak a
 * traveller's details, or change what anybody agreed to pay.
 */
const DELIBERATELY_OPEN: Record<string, string> = {
  adminSignIn: "the sign-in itself — gating it would be a locked key cupboard",
  adminSignOut: "signing out is not a privilege",
  createBooking:
    "the public booking form. Prices are re-derived server-side and the client sends no fare.",
  saveTripDetails:
    "the traveller adding their own pickup details, authorised by knowing an unguessable reference. It writes no money field.",
  submitCorporateEnquiry: "a public contact form",
  createCorporateQuote:
    "public self-service quotation; every figure is priced server-side and the client's numbers are ignored",
  acceptCorporateQuote:
    "the traveller accepting their own quotation, keyed on its reference",
  startCheckout:
    "sends a traveller to the gateway for their own booking; the amount is read off the row",
  declareTransferAction:
    "the traveller saying they have paid. It cannot mark anything paid — only an operator behind the gate can — and the amount is read off the booking.",
};

/** What counts as checking the gate. */
const GATE = /getAdminGateState|requireAdmin/;

console.log("every server action is gated, or deliberately open with a reason");

const files = [...sourceFiles("lib"), ...sourceFiles("app")].filter((file) =>
  /^\s*["']use server["']/m.test(readFileSync(file, "utf8")),
);

check("there are server-action files to check", files.length > 0, `${files.length}`);

const ungated: string[] = [];
const allExports: string[] = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    const match = /^export async function (\w+)/.exec(line);
    if (!match) return;
    const name = match[1];
    allExports.push(name);

    if (name in DELIBERATELY_OPEN) return;

    // The gate has to be near the top — a check buried after a write has
    // already let the write happen.
    const head = lines.slice(index, index + 16).join("\n");
    if (!GATE.test(head)) ungated.push(`${name} (${file})`);
  });
}

check(
  `THE RULE: no ungated action among ${allExports.length} exports`,
  ungated.length === 0,
  ungated.join(", "),
);

/**
 * The other half of the rule, and the one that actually bit: a file marked
 * `"use server"` publishes *everything* it exports, including helpers that
 * were only meant to be shared between two server files. A guard published as
 * an endpoint is the shape of the next real hole.
 */
console.log("\nno non-action helpers are published as endpoints");

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const sync = [...source.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
  check(
    `${file.split("/").pop()} exports only async actions`,
    sync.length === 0,
    sync.join(", "),
  );
  check(
    `${file.split("/").pop()} exports no bare consts`,
    !/^export const \w+ =(?! *(?:async)? *\()/m.test(
      source.replace(/^export const \w+ =[\s\S]*?;$/gm, (block) =>
        // Type-only and literal exports are not endpoints; function values are.
        /=>|function/.test(block) ? block : "",
      ),
    ),
  );
}

/**
 * `isSettled` specifically. It is the guard that stops a paid trip being
 * re-priced, and it must not be reachable from outside.
 */
console.log("\nthe settled-money guard is not an endpoint");

const actionFiles = files.map((f) => readFileSync(f, "utf8")).join("\n");
check(
  "THE RULE: isSettled is not exported from any server-action file",
  !/^export async function isSettled/m.test(actionFiles),
);
check(
  "it lives in a server-only module instead",
  /server-only/.test(readFileSync("lib/admin/settled.ts", "utf8")),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
