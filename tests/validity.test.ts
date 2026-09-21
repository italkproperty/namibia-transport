/**
 * When a quote stops being a quote.
 *
 * Every unpaid booking is a live price at a public URL. A link sent in
 * September could be opened in December and paid at September's fare — after
 * fuel, driver rates and the season had all moved — and the first anyone would
 * know is a transfer arriving for a trip that now costs more to run than it
 * earns. Nothing was expiring them.
 *
 * The rule is derived rather than stored, so these are pure until the last
 * section, which checks the thing that actually matters: that the *server*
 * refuses a lapsed quote. Hiding the bank details on a page is a courtesy;
 * the endpoint is what stops someone re-posting the form.
 */
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, customers, payments } from "@/db/schema";
import {
  groupValidity,
  quoteValidity,
  QUOTE_VALID_DAYS,
} from "@/lib/booking/validity";
import { declareTransfer } from "@/lib/payments/transfer";

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

const days = (n: number) => new Date(Date.now() + n * 86_400_000);
const hours = (n: number) => new Date(Date.now() + n * 3_600_000);

/* --------------------------------------------------------- a live quote */

console.log("a quote that is still a quote");

check(
  "a trip next month, quoted yesterday",
  !quoteValidity({
    scheduledAt: days(30),
    createdAt: days(-1),
    status: "pending_payment",
  }).expired,
);
check(
  "quoted a day inside the window",
  !quoteValidity({
    scheduledAt: days(90),
    createdAt: days(-(QUOTE_VALID_DAYS - 1)),
    status: "pending_payment",
  }).expired,
);
check(
  "a traveller running late on the day can still open it",
  !quoteValidity({
    scheduledAt: hours(-3),
    createdAt: days(-2),
    status: "pending_payment",
  }).expired,
);

/* ------------------------------------------------------ a dead quote */

console.log("\nwhen it stops being one");

const travelled = quoteValidity({
  scheduledAt: days(-2),
  createdAt: days(-5),
  status: "pending_payment",
});
check("a date that has passed", travelled.expired);
check(
  "and it says which reason",
  travelled.expired && travelled.reason === "travelled",
);

const lapsed = quoteValidity({
  scheduledAt: days(120),
  createdAt: days(-(QUOTE_VALID_DAYS + 1)),
  status: "pending_payment",
});
check("a fare older than the window", lapsed.expired);
check("and it says so", lapsed.expired && lapsed.reason === "lapsed");
check(
  "the message names the window rather than a bare number",
  lapsed.expired && lapsed.message.includes(String(QUOTE_VALID_DAYS)),
);

/* ---------------------------------------------------- paid is not a quote */

console.log("\nsomebody who has paid has a booking, not a quote");

for (const status of ["confirmed", "assigned", "completed"]) {
  check(
    `a ${status} trip does not lapse underneath them`,
    !quoteValidity({
      scheduledAt: days(-40),
      createdAt: days(-200),
      status,
    }).expired,
  );
}

/* ------------------------------------------------------------ a trip */

console.log("\na trip is only as live as its earliest leg");

check(
  "one departed leg expires the whole itinerary",
  groupValidity([
    { scheduledAt: days(-1), createdAt: days(-3), status: "pending_payment" },
    { scheduledAt: days(4), createdAt: days(-3), status: "pending_payment" },
  ]).expired,
);
check(
  "all legs ahead of us is still live",
  !groupValidity([
    { scheduledAt: days(4), createdAt: days(-3), status: "pending_payment" },
    { scheduledAt: days(7), createdAt: days(-3), status: "pending_payment" },
  ]).expired,
);

/* ------------------------------------------------- the rule on the server */

async function main() {
  if (!isDatabaseConfigured()) {
    console.log("\n  (skipped the database half — DATABASE_URL is not set)");
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  }

  process.env.BANK_ACCOUNT_NAME = "Namibia Transport";
  process.env.BANK_ACCOUNT_NUMBER = "1234567890";
  process.env.BANK_BRANCH_CODE = "461001";

  console.log("\nthe endpoint refuses what the page stopped offering");

  const db = getDb();
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^ABCDEFGHJKLMNPQRTUVWXY2346789]/g, "4");

  const [customer] = await db
    .insert(customers)
    .values({
      fullName: "Validity Test",
      whatsapp: `+26481${String(Math.floor(2_000_000 + Math.random() * 999_999))}`,
      customerType: "tourist",
    })
    .returning();

  async function seed(ref: string, scheduledAt: Date, createdAt: Date) {
    const [row] = await db
      .insert(bookings)
      .values({
        ref,
        customerId: customer.id,
        pickupLabel: "A",
        dropoffLabel: "B",
        scheduledAt,
        customerPrice: "4200.00",
        driverPayout: "2940.00",
        contribution: "1260.00",
        status: "pending_payment",
      })
      .returning();
    // createdAt defaults to now, so an old quote has to be backdated.
    await db
      .update(bookings)
      .set({ createdAt })
      .where(eq(bookings.id, row.id));
    return row;
  }

  const gone = await seed(`NT-${suffix}`, days(-3), days(-10));
  const declared = await declareTransfer(gone.ref);
  check(
    "THE RULE: a quote for a date that has passed cannot be paid",
    "error" in declared,
    JSON.stringify(declared),
  );

  const [noRow] = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, gone.id));
  check("and nothing is recorded against it", noRow === undefined);

  const old = await seed(
    `NT-${suffix.slice(0, 5)}7`,
    days(120),
    days(-(QUOTE_VALID_DAYS + 5)),
  );
  check(
    "THE RULE: a fare older than the window cannot be paid",
    "error" in (await declareTransfer(old.ref)),
  );

  const live = await seed(`NT-${suffix.slice(0, 5)}9`, days(20), days(-2));
  check(
    "a current quote still can be",
    "ok" in (await declareTransfer(live.ref)),
  );

  for (const row of [gone, old, live]) {
    await db.delete(payments).where(eq(payments.bookingId, row.id));
    await db.delete(bookings).where(eq(bookings.id, row.id));
  }
  await db.delete(customers).where(eq(customers.id, customer.id));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
