/**
 * A booking needs one way to reach the traveller — not a WhatsApp number.
 *
 * `customers.whatsapp` was NOT NULL and uniquely indexed, and the booking
 * schema required it while email was optional. Two separate failures came out
 * of that, and neither announced itself as a lost booking:
 *
 *   A traveller without WhatsApp could not book at all. WhatsApp is how
 *   dispatch and driver coordination actually work — an operating truth — but
 *   it is not universal among inbound travellers, and requiring it turned that
 *   truth into an acquisition rule.
 *
 *   The unique index meant a couple sharing one number, or a PA booking for
 *   two executives from one handset, collided. The second insert failed with
 *   a database error nobody in the conversation could act on.
 *
 * The row checks below run against a real Postgres and skip themselves
 * without DATABASE_URL, because "two people can share a number" is a
 * guarantee about rows and cannot be tested against a return value.
 */
import { bookingFormSchema } from "@/lib/booking/schema";

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

const base = {
  routeSlug: "hosea-kutako-to-windhoek",
  vehicleClassId: "ee436195-7c01-5604-b31d-de90e000ff07",
  date: "2026-11-02",
  time: "14:00",
  passengers: 2,
  luggageCount: 2,
  fullName: "Ping Wu",
  customerType: "tourist" as const,
  pickupLabel: "Hosea Kutako International Airport (WDH) — arrivals hall",
  dropoffLabel: "Hilton Windhoek",
  isReturn: false,
};

/* --------------------------------------------------- one channel, either */

console.log("a booking needs one contact channel, not a specific one");

check(
  "WhatsApp alone is accepted",
  bookingFormSchema.safeParse({ ...base, whatsapp: "+264 81 278 4828" }).success,
);
check(
  "THE RULE: email alone is accepted — no WhatsApp required",
  bookingFormSchema.safeParse({ ...base, email: "ping@example.com" }).success,
  JSON.stringify(
    bookingFormSchema.safeParse({ ...base, email: "ping@example.com" }).error
      ?.issues[0],
  ),
);
check(
  "both together are accepted",
  bookingFormSchema.safeParse({
    ...base,
    whatsapp: "+264812784828",
    email: "ping@example.com",
  }).success,
);

const neither = bookingFormSchema.safeParse(base);
check("neither is refused", !neither.success);
check(
  "and the error lands on a field, so the form can point at it",
  neither.success === false &&
    neither.error.issues.some((i) => i.path.includes("whatsapp")),
  neither.success === false ? JSON.stringify(neither.error.issues[0]?.path) : "",
);
check(
  "empty strings do not count as a channel",
  !bookingFormSchema.safeParse({ ...base, whatsapp: "", email: "" }).success,
);
check(
  "nor does whitespace",
  !bookingFormSchema.safeParse({ ...base, whatsapp: "   " }).success,
);

/* ------------------------------------------- the format still matters */

console.log("\noptional does not mean unvalidated");

check(
  "a malformed number is still refused when one is given",
  !bookingFormSchema.safeParse({ ...base, whatsapp: "call me" }).success,
);
check(
  "a malformed email is still refused when one is given",
  !bookingFormSchema.safeParse({ ...base, email: "not-an-address" }).success,
);
check(
  "a bad number is not rescued by a good email",
  !bookingFormSchema.safeParse({
    ...base,
    whatsapp: "call me",
    email: "ping@example.com",
  }).success,
);

/* ------------------------------------------------------------- the rows */

const hasDb = Boolean(process.env.DATABASE_URL);

async function rowChecks() {
  console.log("\ntwo travellers may share one number");

  if (!hasDb) {
    console.log("  -- skipped, no DATABASE_URL");
    return;
  }

  const { getDb } = await import("@/db");
  const { customers } = await import("@/db/schema");
  const { resolveCustomer, preferredChannel } = await import(
    "@/lib/booking/customer"
  );
  const { eq, or } = await import("drizzle-orm");

  const db = getDb();
  const shared = "+264 81 000 9999";
  const emails = ["couple-a@example.test", "couple-b@example.test"];

  const cleanup = async () => {
    await db
      .delete(customers)
      .where(
        or(
          eq(customers.whatsapp, shared),
          eq(customers.email, emails[0]),
          eq(customers.email, emails[1]),
          eq(customers.email, "solo@example.test"),
        ),
      );
  };

  await cleanup();

  try {
    // The couple. Under the old unique index the second of these threw.
    const first = await resolveCustomer(db, {
      fullName: "Traveller A",
      whatsapp: shared,
      email: emails[0],
    });
    check("the first traveller is created", !first.isRepeat);

    const second = await resolveCustomer(db, {
      fullName: "Traveller B",
      whatsapp: shared,
      email: emails[1],
    });
    check(
      "THE RULE: a second booking on the same number does not fail",
      Boolean(second.customer.id),
    );
    // They share a number, so we treat them as the same traveller rather than
    // guessing they are two — a wrong merge is recoverable by an operator, a
    // failed booking is not.
    check(
      "and is matched to the existing row rather than guessed apart",
      second.customer.id === first.customer.id,
    );

    // The traveller with no WhatsApp at all — the booking that used to be
    // impossible, because the column was NOT NULL.
    const solo = await resolveCustomer(db, {
      fullName: "Email Only",
      whatsapp: null,
      email: "solo@example.test",
    });
    check(
      "THE RULE: a traveller with no WhatsApp can be stored",
      Boolean(solo.customer.id) && solo.customer.whatsapp === null,
      String(solo.customer.whatsapp),
    );
    check(
      "and is found again by email rather than duplicated",
      (
        await resolveCustomer(db, {
          fullName: "Email Only",
          whatsapp: null,
          email: "solo@example.test",
        })
      ).customer.id === solo.customer.id,
    );

    /**
     * The dangerous case. In SQL `whatsapp = NULL` is never true, but a lookup
     * that simply omitted an absent channel would match the first row in the
     * table — attaching a stranger's booking to somebody else's customer.
     */
    const anonymous = await resolveCustomer(db, {
      fullName: "Nobody",
      whatsapp: null,
      email: null,
    });
    check(
      "THE RULE: a traveller with neither channel matches nobody",
      anonymous.isRepeat === false &&
        anonymous.customer.id !== solo.customer.id &&
        anonymous.customer.id !== first.customer.id,
    );
    await db.delete(customers).where(eq(customers.id, anonymous.customer.id));

    check(
      "messages go to WhatsApp when we have it",
      preferredChannel(first.customer) === "whatsapp",
    );
    check(
      "and to email when we do not",
      preferredChannel(solo.customer) === "email",
    );
    check(
      "and nowhere when we have neither",
      preferredChannel({ whatsapp: null, email: null }) === null,
    );
  } finally {
    await cleanup();
  }
}

rowChecks()
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
