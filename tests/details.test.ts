/**
 * The traveller-editable half of a booking, and the line around it.
 *
 * A booking link is the only authorisation on this form — there is no account,
 * and a reference is guessable in principle. That is an acceptable trade for
 * not making somebody phone in their flight number, but only because the set
 * of things the form can change is small and cannot move money.
 *
 * So the tests that matter here are the negative ones: whoever holds a link
 * must not be able to alter the fare, the payout, the status, or the place the
 * leg was priced between. The rest is detail.
 *
 * Also covered: the indicative dollar figure, which is the other thing on
 * these pages that could quietly become a lie.
 */
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, customers } from "@/db/schema";
import { isAirportLeg, updateTripDetails } from "@/lib/booking/details";
import { fxNote, getFxRate, indicativeUsd } from "@/lib/fx";

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

/* ------------------------------------------------------ the dollar figure */

console.log("the indicative dollar figure");

const RATE = { nadPerUsd: 18.2, asAt: "2026-09-21" };

check(
  "converts at the configured rate",
  indicativeUsd("6000.00", RATE) === "US$330",
  String(indicativeUsd("6000.00", RATE)),
);
check(
  "rounds to whole dollars — cents imply a precision it does not have",
  !(indicativeUsd("6000.00", RATE) ?? "").includes("."),
);
check("nothing without a rate", indicativeUsd("6000.00", null) === null);
check("nothing for a zero fare", indicativeUsd("0.00", RATE) === null);
check(
  "the note shows the working and the date",
  (fxNote(RATE) ?? "").includes("N$18.20") &&
    (fxNote(RATE) ?? "").includes("21 September 2026"),
  String(fxNote(RATE)),
);
check("no note without a rate", fxNote(null) === null);

// A misplaced decimal point would misquote every foreign traveller by 10x, so
// an implausible rate is ignored rather than trusted.
const saved = process.env.USD_RATE;
for (const bad of ["1.82", "182", "0", "-18", "not a number"]) {
  process.env.USD_RATE = bad;
  check(`refuses an implausible rate "${bad}"`, getFxRate() === null);
}
process.env.USD_RATE = "18.20";
check("accepts a plausible one", getFxRate()?.nadPerUsd === 18.2);
if (saved === undefined) delete process.env.USD_RATE;
else process.env.USD_RATE = saved;

/* ------------------------------------------------------ who gets asked a flight */

console.log("\nwhich legs ask for a flight number");

check(
  "a leg from the airport does, even when the label names a lodge",
  isAirportLeg(
    "hosea-kutako-to-solitaire",
    "Etango Ranch Guest Farm",
    "Namib Desert Lodge",
  ),
);
check(
  "a leg to the airport does",
  isAirportLeg(
    "solitaire-to-hosea-kutako",
    "Namib Desert Lodge",
    "Etango Ranch",
  ),
);
check(
  "Walvis Bay airport counts too",
  isAirportLeg("walvis-bay-airport-to-swakopmund", "a", "b"),
);
check(
  "a leg between two towns does not",
  !isAirportLeg(
    "sossusvlei-to-swakopmund",
    "Namib Desert Lodge",
    "Beach Hotel",
  ),
);
check(
  "a hand-written quote with no node pair falls back to the words",
  isAirportLeg(null, "Hosea Kutako International Airport", "Windhoek"),
);
check(
  "and does not see an airport that is not there",
  !isAirportLeg(null, "Etango Ranch Guest Farm", "Namib Desert Lodge"),
);

/* ------------------------------------------------- what the form may change */

async function main() {
  if (!isDatabaseConfigured()) {
    console.log("\n  (skipped the database half — DATABASE_URL is not set)");
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  }

  const db = getDb();
  const suffix = randomUUID().replace(/\D/g, "").padEnd(7, "0").slice(0, 7);

  const [customer] = await db
    .insert(customers)
    .values({
      fullName: "Details Test",
      whatsapp: `+26481${suffix}`,
      customerType: "tourist",
    })
    .returning();

  const alphabet = "ABCDEFGHJKLMNPQRTUVWXY2346789";
  const ref = `NT-${Array.from({ length: 6 }, (_, i) => alphabet[(Number(suffix[i] ?? 0) * 3 + i) % alphabet.length]).join("")}`;

  const tomorrow = new Date(Date.now() + 86_400_000);

  const [booking] = await db
    .insert(bookings)
    .values({
      ref,
      customerId: customer.id,
      pickupLabel: "Etango Ranch Guest Farm",
      dropoffLabel: "Namib Desert Lodge",
      scheduledAt: tomorrow,
      customerPrice: "6000.00",
      driverPayout: "4200.00",
      contribution: "1800.00",
      status: "pending_payment",
    })
    .returning();

  console.log("\nwhat a traveller may change");

  const form = new FormData();
  form.set("ref", booking.ref);
  form.set("pickupDetail", "Reception, past the cattle grid");
  form.set("travellerNotes", "Two carry-ons and a backpack.");
  form.set("flightNumber", "SA 074");
  // Everything below is an attempt to reach past the form's remit.
  form.set("customerPrice", "1.00");
  form.set("driverPayout", "0.00");
  form.set("status", "confirmed");
  form.set("pickupLabel", "Somewhere else entirely");
  form.set("dropoffLabel", "Somewhere else entirely");

  const result = await updateTripDetails(form);
  check("it saves", result?.ok === true, JSON.stringify(result));

  const [after] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, booking.id));

  check(
    "the pick-up detail is kept",
    after.pickupDetail === "Reception, past the cattle grid",
  );
  check(
    "the note is kept",
    after.travellerNotes === "Two carry-ons and a backpack.",
  );
  check("the flight number is kept", after.flightNumber === "SA 074");
  check("it records when they sent it", after.detailsUpdatedAt !== null);

  check(
    "THE RULE: the fare cannot be changed from the form",
    after.customerPrice === "6000.00",
    after.customerPrice,
  );
  check(
    "THE RULE: the payout cannot be changed",
    after.driverPayout === "4200.00",
    after.driverPayout,
  );
  check(
    "THE RULE: the status cannot be changed",
    after.status === "pending_payment",
    after.status,
  );
  check(
    "THE RULE: the priced place cannot be moved",
    after.pickupLabel === "Etango Ranch Guest Farm" &&
      after.dropoffLabel === "Namib Desert Lodge",
    `${after.pickupLabel} → ${after.dropoffLabel}`,
  );

  console.log("\nthe pick-up time");

  const timed = new FormData();
  timed.set("ref", booking.ref);
  timed.set("pickupTime", "06:30");
  await updateTripDetails(timed);

  const [moved] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, booking.id));

  const hhmm = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Windhoek",
  }).format(moved.scheduledAt);
  check("the time moves, in Namibian terms", hhmm === "06:30", hhmm);

  const sameDay =
    new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Windhoek" }).format(
      moved.scheduledAt,
    ) ===
    new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Windhoek" }).format(
      tomorrow,
    );
  check("the day does not move with it", sameDay);

  const badTime = new FormData();
  badTime.set("ref", booking.ref);
  badTime.set("pickupTime", "25:99");
  const rejected = await updateTripDetails(badTime);
  check("a nonsense time is refused", rejected?.ok === false);

  /* --------------------------------------- a field nobody sent is not a field cleared */

  /**
   * The patch used to be built unconditionally, so a POST carrying only the
   * reference wrote null over all three answers. That is not a hypothetical
   * shape: it is every partial form and anyone poking at the endpoint, and the
   * traveller's flight number was gone with nothing to say it had been given.
   */
  console.log("\nan absent field leaves what is stored alone");

  const timeOnly = new FormData();
  timeOnly.set("ref", booking.ref);
  timeOnly.set("pickupTime", "07:15");
  await updateTripDetails(timeOnly);

  const [kept] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, booking.id));

  check(
    "THE RULE: a form without the flight number does not erase it",
    kept.flightNumber === "SA 074",
    String(kept.flightNumber),
  );
  check(
    "nor the pick-up detail",
    kept.pickupDetail === "Reception, past the cattle grid",
    String(kept.pickupDetail),
  );
  check("nor the note", kept.travellerNotes === "Two carry-ons and a backpack.");

  // Sent and empty is a traveller taking something back, and still works.
  const cleared = new FormData();
  cleared.set("ref", booking.ref);
  cleared.set("travellerNotes", "");
  await updateTripDetails(cleared);

  const [blanked] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, booking.id));
  check("but sending it empty still clears it", blanked.travellerNotes === null);
  check(
    "and clearing one field leaves the others",
    blanked.flightNumber === "SA 074",
    String(blanked.flightNumber),
  );

  console.log("\nbookings it will not touch");

  const missing = new FormData();
  missing.set("ref", "NT-ZZZZZZ");
  check(
    "an unknown reference is refused",
    (await updateTripDetails(missing))?.ok === false,
  );

  const malformed = new FormData();
  malformed.set("ref", "not-a-reference");
  check(
    "a malformed reference is refused",
    (await updateTripDetails(malformed))?.ok === false,
  );

  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(eq(bookings.id, booking.id));
  const onCancelled = new FormData();
  onCancelled.set("ref", booking.ref);
  onCancelled.set("travellerNotes", "still trying");
  check(
    "a cancelled booking is refused",
    (await updateTripDetails(onCancelled))?.ok === false,
  );

  await db.delete(bookings).where(eq(bookings.id, booking.id));
  await db.delete(customers).where(eq(customers.id, customer.id));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
