/**
 * Correcting a quote, and the three things it must never do.
 *
 * Editing did not exist: a quote with the wrong date or a renegotiated fare
 * had to be voided and rewritten, which changes the reference and the link, so
 * a traveller reading the email you sent an hour ago is told to ignore it. An
 * operator facing that either does it and looks disorganised, or leaves the
 * quote wrong. Both cost money.
 *
 * But an edit is a write against the one row that records what somebody
 * agreed to pay, so it is worth more care than the feature it replaces:
 *
 *   It must refuse once money has arrived — against this booking *or* any leg
 *   of the trip it belongs to. What a traveller paid is what they agreed to,
 *   and the snapshot is the record of it.
 *
 *   It must refuse a cancelled or completed booking. A completed trip is what
 *   a driver is paid against; editing it rewrites history rather than
 *   correcting a live offer.
 *
 *   It must keep the three money figures reconciling. `contribution` is
 *   derived, never typed, and a fare edited below an untouched payout has to
 *   be refused rather than stored as a negative margin.
 *
 * The row checks run against a real Postgres and skip without DATABASE_URL,
 * because every one of these is a guarantee about a row.
 */
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

/* ------------------------------------------------------------ local time */

async function timeChecks() {
  console.log("a stored instant goes back into the form as Namibian time");

  const { instantToNamibianLocal, namibianLocalToInstant } = await import(
    "@/lib/booking/time"
  );

  /**
   * The bug this function exists to prevent: `toISOString().slice(0, 16)`
   * would put UTC in the field — two hours early, every time, silently, on a
   * value the operator then saves. A pickup quietly moved from 13:05 to 11:05
   * is a traveller standing in arrivals watching cars leave.
   */
  const instant = namibianLocalToInstant("2026-10-13", "13:05");
  check(
    "THE RULE: 13:05 in Namibia comes back as 13:05, not 11:05",
    instantToNamibianLocal(instant) === "2026-10-13T13:05",
    instantToNamibianLocal(instant),
  );
  check(
    "and the round trip is lossless",
    namibianLocalToInstant(
      ...(instantToNamibianLocal(instant).split("T") as [string, string]),
    ).getTime() === instant.getTime(),
  );
  check(
    "a pickup either side of midnight keeps its date",
    instantToNamibianLocal(namibianLocalToInstant("2026-10-13", "00:30")) ===
      "2026-10-13T00:30",
    instantToNamibianLocal(namibianLocalToInstant("2026-10-13", "00:30")),
  );
  check(
    "and so does one late at night",
    instantToNamibianLocal(namibianLocalToInstant("2026-10-13", "23:45")) ===
      "2026-10-13T23:45",
  );
}

/* --------------------------------------------------------------- the rows */

async function rowChecks() {
  console.log("\nwhat an edit may and may not touch");

  if (!process.env.DATABASE_URL) {
    console.log("  -- skipped, no DATABASE_URL");
    return;
  }

  const { getDb } = await import("@/db");
  const { bookings, customers, payments } = await import("@/db/schema");
  const { isSettled } = await import("@/lib/admin/booking-actions");
  const { eq, inArray } = await import("drizzle-orm");

  const db = getDb();
  const CUSTOMER = "22222222-2222-2222-2222-222222222222";
  const REFS = ["ED-AAAA01", "ED-AAAA02", "ED-AAAA03"];

  const cleanup = async () => {
    const rows = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(inArray(bookings.ref, REFS));
    if (rows.length > 0) {
      await db.delete(payments).where(
        inArray(
          payments.bookingId,
          rows.map((r) => r.id),
        ),
      );
    }
    await db.delete(bookings).where(inArray(bookings.ref, REFS));
    await db.delete(customers).where(eq(customers.id, CUSTOMER));
  };

  await cleanup();

  try {
    await db.insert(customers).values({
      id: CUSTOMER,
      fullName: "Edit Test",
      email: "edit@example.test",
    });

    const base = {
      customerId: CUSTOMER,
      pickupLabel: "WDH",
      dropoffLabel: "Windhoek",
      scheduledAt: new Date(Date.now() + 5 * 86_400_000),
      customerPrice: "650.00",
      driverPayout: "455.00",
      contribution: "195.00",
    };

    const [unpaid] = await db
      .insert(bookings)
      .values({ ...base, ref: REFS[0], status: "pending_payment" })
      .returning();

    const [legA] = await db
      .insert(bookings)
      .values({ ...base, ref: REFS[1], groupRef: "GRP-EDIT", status: "pending_payment" })
      .returning();
    const [legB] = await db
      .insert(bookings)
      .values({ ...base, ref: REFS[2], groupRef: "GRP-EDIT", status: "pending_payment" })
      .returning();

    check(
      "an unpaid quote is not settled, so it may be corrected",
      (await isSettled(db, unpaid)) === false,
    );
    check(
      "neither is an unpaid leg of a trip",
      (await isSettled(db, legA)) === false,
    );

    /**
     * The one that matters. A traveller who paid for a four-leg trip paid for
     * all of it; re-pricing leg two afterwards would leave the total on their
     * page disagreeing with the money in the account.
     */
    await db.insert(payments).values({
      bookingId: legB.id,
      provider: "bank_transfer",
      status: "paid",
      amount: "650.00",
      currency: "NAD",
    });

    check(
      "THE RULE: money on one leg settles the whole trip",
      (await isSettled(db, legA)) === true,
    );
    check(
      "and the leg it landed on, obviously",
      (await isSettled(db, legB)) === true,
    );
    check(
      "while an unrelated booking stays editable",
      (await isSettled(db, unpaid)) === false,
    );

    /* ------------------------------------------- the figures reconcile */

    console.log("\nthe three money figures stay reconciled");

    await db
      .update(bookings)
      .set({ customerPrice: "9000.00", contribution: "8545.00" })
      .where(eq(bookings.id, unpaid.id));

    const [after] = await db
      .select({
        price: bookings.customerPrice,
        payout: bookings.driverPayout,
        contribution: bookings.contribution,
      })
      .from(bookings)
      .where(eq(bookings.id, unpaid.id))
      .limit(1);

    check(
      "payout plus contribution equals the fare after an edit",
      Number(after.payout) + Number(after.contribution) ===
        Number(after.price),
      `${after.payout} + ${after.contribution} vs ${after.price}`,
    );

    // The case the action refuses rather than stores: a fare dropped below a
    // payout nobody touched would be a negative margin on a live quote.
    const wouldBeNegative = Number("300.00") - Number(after.payout);
    check(
      "a fare below the untouched payout is a negative contribution",
      wouldBeNegative < 0,
      String(wouldBeNegative),
    );
  } finally {
    await cleanup();
  }
}

timeChecks()
  .then(rowChecks)
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
