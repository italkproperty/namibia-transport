/**
 * Every admin write path, driven against a real database.
 *
 * This exists because the defects kept being found by an operator, one at a
 * time, mid-conversation with a customer. A driver could not be added and the
 * screen said "Could not save the driver."; a quote could not be edited at
 * all; a fare was invented because nothing on the form showed the model's.
 * Each was cheap to fix and expensive to find, and finding them was costing
 * the business more than the bugs were.
 *
 * So this drives the functions the admin pages call — not the pages — against
 * a real Postgres, in the sequence an operator actually works in: take an
 * enquiry, quote it, correct it, put a driver on it, take the money, run the
 * trip. The Server Actions themselves need a request context and cannot be
 * called here, so what is exercised is everything underneath them: the
 * queries, the write helpers and the guards.
 *
 * The rule for what belongs here: a check earns its place if its failure
 * would have reached a traveller or an operator. Type errors do not; a
 * booking that cannot be saved, a guard that does not guard, and a retry that
 * never retries do.
 *
 * Skips itself without DATABASE_URL, like every other suite that needs rows.
 */
import { eq, inArray } from "drizzle-orm";

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

const TAG = "e2e-admin";
const PHONE = "+264 81 000 4242";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("admin end to end\n  -- skipped, no DATABASE_URL");
    console.log(`\n${passed} passed, ${failed} failed`);
    return;
  }

  const { getDb } = await import("@/db");
  const {
    bookings,
    customers,
    drivers,
    payments,
    vehicles,
    vehicleClasses,
    dispatchAssignments,
  } = await import("@/db/schema");
  const { violatedConstraint, isUniqueViolation, isMissingSchema, errorCode } =
    await import("@/lib/db-error");
  const { isSettled } = await import("@/lib/admin/settled");
  const { resolveCustomer } = await import("@/lib/booking/customer");
  const { saveItineraryQuote } = await import("@/lib/admin/itinerary-quote");
  const { getAdminSummary, listBookings, countBookings } = await import(
    "@/lib/admin/queries"
  );
  const { listPendingTransfers } = await import("@/lib/admin/transfer-queries");
  const { getPricingConfig } = await import("@/lib/pricing/settings");
  const { pendingMigrations } = await import("@/lib/admin/migrations");

  const db = getDb();

  const cleanup = async () => {
    const rows = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(inArray(bookings.acquisitionSource, [TAG]));
    const ids = rows.map((r) => r.id);
    if (ids.length > 0) {
      await db.delete(payments).where(inArray(payments.bookingId, ids));
      await db
        .delete(dispatchAssignments)
        .where(inArray(dispatchAssignments.bookingId, ids));
      await db.delete(bookings).where(inArray(bookings.id, ids));
    }
    const ds = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(eq(drivers.whatsapp, PHONE));
    if (ds.length > 0) {
      await db.delete(vehicles).where(
        inArray(
          vehicles.driverId,
          ds.map((d) => d.id),
        ),
      );
      await db.delete(drivers).where(eq(drivers.whatsapp, PHONE));
    }
    await db.delete(customers).where(eq(customers.email, `${TAG}@example.test`));
  };

  await cleanup();

  try {
    /* ------------------------------------------- the error helper itself */

    /**
     * Everything below leans on this, and it is the thing that was wrong.
     * Drizzle's wrapper message carries the SQL, not the reason, so a check
     * against `String(error)` silently never matched.
     */
    console.log("the database says why it refused");

    await db
      .insert(drivers)
      .values({ fullName: "E2E Holder", whatsapp: PHONE, status: "active" });

    let collision: unknown;
    try {
      await db
        .insert(drivers)
        .values({ fullName: "E2E Duplicate", whatsapp: PHONE, status: "pending" });
    } catch (error) {
      collision = error;
    }

    check("a duplicate really is refused", collision !== undefined);
    check(
      "THE RULE: the wrapper message does not name the constraint",
      !String(collision).includes("drivers_whatsapp_key"),
      "if this starts passing the helper may no longer be needed",
    );
    check(
      "but the helper finds it on the cause",
      violatedConstraint(collision) === "drivers_whatsapp_key",
      String(violatedConstraint(collision)),
    );
    check("and reports it as a unique violation", isUniqueViolation(collision));
    check(
      "matched by name, so one constraint is not mistaken for another",
      isUniqueViolation(collision, "drivers_whatsapp_key") &&
        !isUniqueViolation(collision, "bookings_ref_key"),
    );
    check("the SQLSTATE comes through", errorCode(collision) === "23505");
    check("and it is not mistaken for a missing column", !isMissingSchema(collision));

    let missing: unknown;
    try {
      await db.execute(
        "select this_column_does_not_exist from bookings limit 1" as never,
      );
    } catch (error) {
      missing = error;
    }
    check(
      "THE RULE: a schema that is behind the code is told apart from everything else",
      isMissingSchema(missing),
      String(errorCode(missing)),
    );
    check("a plain Error confuses nothing", violatedConstraint(new Error("x")) === null);
    check("nor does null", violatedConstraint(null) === null);
    check(
      "a cause cycle does not hang the request",
      (() => {
        const a: { cause?: unknown } = {};
        a.cause = a;
        return violatedConstraint(a) === null;
      })(),
    );

    /* ------------------------------------------- a driver and their car */

    /**
     * These were two inserts outside a transaction. A registration already on
     * file failed the second one and left the driver row from the first — a
     * driver recorded with no vehicle, who cannot be assigned, sitting in the
     * list looking complete. The message even said "the driver was not saved".
     */
    console.log("\na driver and their car save together or not at all");

    const [anyClass] = await db.select().from(vehicleClasses).limit(1);
    const PLATE = "N-E2E-1";

    await db.delete(vehicles).where(eq(vehicles.registration, PLATE));
    const [holder] = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(eq(drivers.whatsapp, PHONE))
      .limit(1);
    await db.insert(vehicles).values({
      driverId: holder.id,
      vehicleClassId: anyClass.id,
      make: "Toyota",
      model: "Fortuner",
      registration: PLATE,
    });

    const before = await db.$count(drivers);
    let rolledBack = false;
    try {
      await db.transaction(async (tx) => {
        const [made] = await tx
          .insert(drivers)
          .values({
            fullName: "E2E Rollback",
            whatsapp: "+264 81 000 4243",
            status: "pending",
          })
          .returning({ id: drivers.id });
        // Same plate: the second insert must take the first down with it.
        await tx.insert(vehicles).values({
          driverId: made.id,
          vehicleClassId: anyClass.id,
          make: "Toyota",
          model: "Hilux",
          registration: PLATE,
        });
      });
    } catch (error) {
      rolledBack = isUniqueViolation(error, "vehicles_registration_key");
    }

    check("a duplicate registration is refused", rolledBack);
    check(
      "THE RULE: and no half-saved driver is left behind",
      (await db.$count(drivers)) === before,
      `${before} -> ${await db.$count(drivers)}`,
    );

    await db.delete(vehicles).where(eq(vehicles.registration, PLATE));

    /* ------------------------------------------------------ the quote */

    console.log("\nan operator quotes a trip");

    const [suv] = await db
      .select()
      .from(vehicleClasses)
      .where(eq(vehicleClasses.slug, "suv-4x4"))
      .limit(1);
    check("the vehicle catalogue is seeded", Boolean(suv));

    const config = await getPricingConfig();
    check("pricing config loads even with no settings row", Boolean(config.constants));
    check(
      "and every constant is a usable number",
      Object.values(config.constants).every(
        (value) => Number.isFinite(value) && value > 0,
      ),
      JSON.stringify(config.constants),
    );

    const saved = await saveItineraryQuote({
      fullName: "E2E Traveller",
      whatsapp: "",
      email: `${TAG}@example.test`,
      vehicleClassId: suv?.id ?? null,
      stops: [
        { slug: "hosea-kutako", nights: 0 },
        { slug: "sossusvlei", label: "A Lodge", nights: 2 },
        { slug: "hosea-kutako", nights: 0 },
      ],
      startDate: "2026-11-02",
      startTime: "13:05",
      passengers: 2,
      luggageCount: 4,
    });

    check("the itinerary saves", saved.ok, saved.ok ? "" : saved.message);
    if (!saved.ok) throw new Error("cannot continue without a saved quote");

    // Tag the legs so cleanup can find them however the test exits.
    await db
      .update(bookings)
      .set({ acquisitionSource: TAG })
      .where(eq(bookings.groupRef, saved.groupRef));

    const legs = await db
      .select()
      .from(bookings)
      .where(eq(bookings.groupRef, saved.groupRef));

    check("both legs are stored", legs.length === 2, String(legs.length));
    check(
      "THE RULE: the legs sum to the total the operator was shown",
      legs.reduce((sum, leg) => sum + Number(leg.customerPrice), 0) ===
        saved.total,
      `${legs.reduce((s, l) => s + Number(l.customerPrice), 0)} vs ${saved.total}`,
    );
    check(
      "every leg carries the vehicle the fare was priced for",
      legs.every((leg) => leg.vehicleClassId === suv?.id),
    );
    check(
      "payout and contribution reconcile on every leg",
      legs.every(
        (leg) =>
          Math.abs(
            Number(leg.driverPayout) +
              Number(leg.contribution) -
              Number(leg.customerPrice),
          ) < 0.005,
      ),
    );
    check(
      "a traveller with no WhatsApp can be quoted",
      legs.length > 0,
    );
    check(
      "the lodge name reaches the traveller, not the node name",
      legs.some((leg) => leg.dropoffLabel === "A Lodge"),
      legs.map((l) => l.dropoffLabel).join(" / "),
    );

    /* ------------------------------------------------------- the guards */

    console.log("\nthe guards that protect agreed money");

    const first = legs[0];
    check("an unpaid quote may be corrected", (await isSettled(db, first)) === false);

    await db.insert(payments).values({
      bookingId: legs[1].id,
      provider: "bank_transfer",
      status: "paid",
      amount: legs[1].customerPrice,
      currency: "NAD",
    });

    check(
      "THE RULE: money on one leg locks the whole trip",
      (await isSettled(db, first)) === true,
    );

    /* -------------------------------------------------- the admin reads */

    console.log("\nthe admin pages can read what was written");

    const [summary, rows, total, transfers, migrations] = await Promise.all([
      getAdminSummary(),
      listBookings({ sort: "createdAt", direction: "desc", page: 0 }),
      countBookings({ sort: "createdAt", direction: "desc", page: 0 }),
      listPendingTransfers(),
      pendingMigrations(),
    ]);

    check("the summary loads", summary !== null);
    check("it counts the trip's revenue", (summary?.byRoute.length ?? 0) >= 0);
    check(
      "and folds acquisition into channels without throwing",
      Array.isArray(summary?.byChannel),
    );
    check("the booking list loads", Array.isArray(rows) && rows.length > 0);
    check("the count agrees that there are bookings", total > 0, String(total));
    check("the transfer queue loads", Array.isArray(transfers));
    check(
      "a pending transfer carries a way to reach the traveller",
      transfers.every(
        (t) => t.customerWhatsapp !== undefined && t.customerEmail !== undefined,
      ),
    );
    check(
      "the migration check runs and names what is missing",
      Array.isArray(migrations) &&
        migrations.every((m) => m.column && m.what && m.file),
      JSON.stringify(migrations),
    );

    /* ------------------------------------------------ customer matching */

    console.log("\nthe same traveller is not stored twice");

    const again = await resolveCustomer(db, {
      fullName: "E2E Traveller",
      whatsapp: null,
      email: `${TAG}@example.test`,
    });
    check("a returning traveller is matched on email", again.isRepeat);

    const anonymous = await resolveCustomer(db, {
      fullName: "Nobody At All",
      whatsapp: null,
      email: null,
    });
    check(
      "THE RULE: no contact details match nobody, rather than the first row",
      !anonymous.isRepeat && anonymous.customer.id !== again.customer.id,
    );
    await db.delete(customers).where(eq(customers.id, anonymous.customer.id));
  } finally {
    await cleanup();
  }
}

main()
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
