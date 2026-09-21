/**
 * Bank transfers, and the one rule that matters.
 *
 * A traveller pressing "I have made the transfer" must never mark a booking
 * paid. The failure it prevents is not abstract: a confirmed booking is a car
 * dispatched, and the only evidence of an EFT is a line on a statement that a
 * person has to read. Everything below exists to make the boundary between
 * "they said so" and "we saw it" impossible to erode by accident.
 *
 * These run against a real Postgres because the guarantee is about rows, not
 * about a function's return value — the whole point is what is persisted.
 */
import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, customers, payments } from "@/db/schema";
import {
  bankTransferLines,
  getBankDetails,
  proofOfPaymentLink,
  transferReference,
  type BankDetails,
} from "@/lib/payments/bank";
import {
  BANK_TRANSFER_PROVIDER,
  confirmTransfer,
  declareTransfer,
  getTransferState,
} from "@/lib/payments/transfer";

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

/* -------------------------------------------------------- the details block */

console.log("the bank details block");

const sample: BankDetails = {
  accountName: "Namibia Transport (Pty) Ltd",
  accountNumber: "64285820625",
  branchCode: "282672",
  swift: "FIRNNANX",
  bankName: "First National Bank Namibia",
};

const lines = bankTransferLines(sample, "NT-4KQ8ZP");
const labels = lines.map((l) => l.label);

check(
  "the reference is the booking ref, unchanged",
  transferReference("NT-4KQ8ZP") === "NT-4KQ8ZP",
);
check(
  "the account number is shown",
  lines.some((l) => l.value === "64285820625"),
);
check(
  "the branch code is shown",
  lines.some((l) => l.value === "282672"),
);
check(
  "the reference is the last line a banking app asks for",
  labels[labels.length - 1] === "Reference",
);
check(
  "SWIFT is included when set",
  labels.some((l) => l.startsWith("SWIFT")),
);
check(
  "SWIFT is omitted when not set",
  !bankTransferLines({ ...sample, swift: null }, "NT-4KQ8ZP")
    .map((l) => l.label)
    .some((l) => l.startsWith("SWIFT")),
);

// A half-configured block produces bounced transfers, so it must not render.
const saved = {
  name: process.env.BANK_ACCOUNT_NAME,
  number: process.env.BANK_ACCOUNT_NUMBER,
  branch: process.env.BANK_BRANCH_CODE,
};
process.env.BANK_ACCOUNT_NAME = "Namibia Transport (Pty) Ltd";
process.env.BANK_ACCOUNT_NUMBER = "64285820625";
delete process.env.BANK_BRANCH_CODE;
check("a missing branch code hides the whole block", getBankDetails() === null);
process.env.BANK_BRANCH_CODE = "282672";
check("all three present renders it", getBankDetails() !== null);
if (saved.name === undefined) delete process.env.BANK_ACCOUNT_NAME;
else process.env.BANK_ACCOUNT_NAME = saved.name;
if (saved.number === undefined) delete process.env.BANK_ACCOUNT_NUMBER;
else process.env.BANK_ACCOUNT_NUMBER = saved.number;
if (saved.branch === undefined) delete process.env.BANK_BRANCH_CODE;
else process.env.BANK_BRANCH_CODE = saved.branch;

/* -------------------------------------------------- the proof-of-payment link */

console.log("\nthe proof-of-payment link");

const proof = proofOfPaymentLink(
  "bookings@namibiatransport.com",
  "NT-4KQ8ZP",
  "N$6,000",
);

check(
  "it is a mailto",
  proof.startsWith("mailto:bookings@namibiatransport.com?"),
);
check(
  "the subject carries the reference, so the proof can be matched",
  decodeURIComponent(proof).includes("subject=Proof of payment — NT-4KQ8ZP"),
);
check(
  "the body repeats the reference",
  decodeURIComponent(proof).includes("Booking reference: NT-4KQ8ZP"),
);
check(
  "the amount is included when known",
  decodeURIComponent(proof).includes("Amount: N$6,000"),
);
check(
  "the amount line is omitted when it is not",
  !decodeURIComponent(proofOfPaymentLink("a@b.com", "NT-4KQ8ZP")).includes(
    "Amount:",
  ),
);
// An unencoded space or newline breaks the link in some mail clients.
check(
  "the query is percent-encoded",
  !proof.includes(" ") && !proof.includes("\n"),
);

/* ------------------------------------------------------ declaring vs paying */

async function main() {
  if (!isDatabaseConfigured()) {
    console.log("\n  (skipped the database half — DATABASE_URL is not set)");
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  }

  // The declare path needs the block configured, since a deployment without
  // bank details must refuse rather than record a transfer nobody can make.
  process.env.BANK_ACCOUNT_NAME = sample.accountName;
  process.env.BANK_ACCOUNT_NUMBER = sample.accountNumber;
  process.env.BANK_BRANCH_CODE = sample.branchCode;

  const db = getDb();
  const suffix = randomUUID().slice(0, 8);

  const [customer] = await db
    .insert(customers)
    .values({
      fullName: "Transfer Test",
      whatsapp: `+26481${suffix.replace(/\D/g, "").padEnd(7, "0").slice(0, 7)}`,
      customerType: "tourist",
    })
    .returning();

  const ref = `NT-${"ABCDEFGHJKLMNPQRTUVWXY2346789"[0]}${suffix
    .toUpperCase()
    .replace(/[^ABCDEFGHJKLMNPQRTUVWXY2346789]/g, "2")
    .slice(0, 5)}`;

  const [booking] = await db
    .insert(bookings)
    .values({
      ref,
      customerId: customer.id,
      pickupLabel: "Etango Ranch Guest Farm",
      dropoffLabel: "Namib Desert Lodge",
      scheduledAt: new Date(Date.now() + 86_400_000),
      customerPrice: "6000.00",
      driverPayout: "4200.00",
      contribution: "1800.00",
      status: "pending_payment",
    })
    .returning();

  console.log("\ndeclaring is not paying");

  const declared = await declareTransfer(booking.ref, "Sent from FNB app");
  check("declaring succeeds", "ok" in declared);

  const [afterDeclare] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.bookingId, booking.id),
        eq(payments.provider, BANK_TRANSFER_PROVIDER),
      ),
    );

  check("a payments row is written", Boolean(afterDeclare));
  check(
    "THE RULE: declaring leaves the payment pending, never paid",
    afterDeclare?.status === "pending",
    `status was ${afterDeclare?.status}`,
  );
  check("no paidAt is set by a declaration", afterDeclare?.paidAt === null);
  check(
    "the amount comes from the booking, not the caller",
    afterDeclare?.amount === "6000.00",
  );

  const [bookingAfterDeclare] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, booking.id));
  check(
    "THE RULE: the booking is still pending_payment after a declaration",
    bookingAfterDeclare?.status === "pending_payment",
    `status was ${bookingAfterDeclare?.status}`,
  );

  const state = await getTransferState(booking.id);
  check("the state reads as declared", state.status === "declared");
  check("the note is kept", state.note === "Sent from FNB app");
  check("nothing claims it was confirmed", state.confirmedAt === null);

  // A second press is a person being unsure, not a second payment.
  await declareTransfer(booking.ref);
  const rows = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.bookingId, booking.id),
        eq(payments.provider, BANK_TRANSFER_PROVIDER),
      ),
    );
  check("declaring twice does not stack rows", rows.length === 1);

  console.log("\nconfirming is paying");

  const confirmed = await confirmTransfer(booking.id);
  check("confirming succeeds", "ok" in confirmed);

  const [afterConfirm] = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, booking.id));
  check("the payment is now paid", afterConfirm?.status === "paid");
  check("paidAt is set", afterConfirm?.paidAt !== null);

  const [bookingAfterConfirm] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, booking.id));
  check(
    "confirming the money confirms the booking",
    bookingAfterConfirm?.status === "confirmed",
  );

  const confirmedState = await getTransferState(booking.id);
  check("the state reads as confirmed", confirmedState.status === "confirmed");

  // Once a human has confirmed it, nothing a traveller presses may touch it.
  await declareTransfer(booking.ref, "trying again");
  const [afterRedeclare] = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, booking.id));
  check(
    "THE RULE: re-declaring cannot un-pay a confirmed transfer",
    afterRedeclare?.status === "paid",
  );

  console.log("\na cancelled booking");

  const [cancelled] = await db
    .insert(bookings)
    .values({
      ref: `${ref.slice(0, 5)}XY`.slice(0, 9),
      customerId: customer.id,
      pickupLabel: "A",
      dropoffLabel: "B",
      scheduledAt: new Date(Date.now() + 86_400_000),
      customerPrice: "100.00",
      driverPayout: "70.00",
      contribution: "30.00",
      status: "cancelled",
    })
    .returning();

  const refused = await declareTransfer(cancelled.ref);
  check("a cancelled booking refuses a declaration", "error" in refused);

  await confirmTransfer(cancelled.id);
  const [stillCancelled] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, cancelled.id));
  check(
    "money arriving does not un-cancel a booking",
    stillCancelled?.status === "cancelled",
  );

  /* ---------------------------------------------- a trip, not a single leg */

  /**
   * An itinerary is quoted as one figure and paid as one transfer, but it is
   * stored as one booking per driving job. The reference the traveller quotes
   * is the first leg's, so a transfer read off that leg alone recorded a
   * fraction of what they actually sent — and confirming it dispatched the
   * first car while the rest of the trip sat unpaid on a page that still said
   * so. Both halves of that are what these guard.
   */
  console.log("\na multi-leg trip pays as one");

  const groupRef = `NT-G-${suffix.toUpperCase().replace(/[^ABCDEFGHJKLMNPQRTUVWXY2346789]/g, "3").slice(0, 6)}`;
  const legPrices = ["5786.00", "5312.00", "4952.00"];
  const tripTotal = "16050.00";

  const legs = [];
  for (const [index, price] of legPrices.entries()) {
    const [leg] = await db
      .insert(bookings)
      .values({
        ref: `${ref.slice(0, 6)}${"GHJ"[index]}${index}`.slice(0, 9),
        groupRef,
        customerId: customer.id,
        pickupLabel: `Stop ${index}`,
        dropoffLabel: `Stop ${index + 1}`,
        scheduledAt: new Date(Date.now() + (index + 2) * 86_400_000),
        customerPrice: price,
        driverPayout: (Number(price) * 0.7).toFixed(2),
        contribution: (Number(price) * 0.3).toFixed(2),
        status: "pending_payment",
      })
      .returning();
    legs.push(leg);
  }

  const first = legs[0];

  await declareTransfer(first.ref, "Paid the whole trip");
  const [groupDeclared] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.bookingId, first.id),
        eq(payments.provider, BANK_TRANSFER_PROVIDER),
      ),
    );
  check(
    "THE RULE: a declaration records the trip total, not the first leg",
    groupDeclared?.amount === tripTotal,
    `recorded ${groupDeclared?.amount}, the traveller was told ${tripTotal}`,
  );
  check(
    "declaring against a leg still does not pay it",
    groupDeclared?.status === "pending",
  );

  await confirmTransfer(first.id);

  const groupAfter = await db
    .select({ ref: bookings.ref, status: bookings.status })
    .from(bookings)
    .where(eq(bookings.groupRef, groupRef));
  check(
    "THE RULE: confirming the money confirms every leg of the trip",
    groupAfter.length === 3 && groupAfter.every((leg) => leg.status === "confirmed"),
    groupAfter.map((leg) => `${leg.ref}=${leg.status}`).join(", "),
  );

  const [groupPaid] = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, first.id));
  check(
    "the paid amount is still the trip total",
    groupPaid?.amount === tripTotal,
    `${groupPaid?.amount}`,
  );

  /**
   * A leg cancelled before payment is not money owed. If it still counted, the
   * traveller would be asked for a trip they are no longer taking.
   */
  const [shrunk] = await db
    .insert(bookings)
    .values({
      ref: `${ref.slice(0, 6)}K9`.slice(0, 9),
      groupRef,
      customerId: customer.id,
      pickupLabel: "Dropped",
      dropoffLabel: "Leg",
      scheduledAt: new Date(Date.now() + 9 * 86_400_000),
      customerPrice: "3000.00",
      driverPayout: "2100.00",
      contribution: "900.00",
      status: "cancelled",
    })
    .returning();

  const [reopened] = await db
    .insert(bookings)
    .values({
      ref: `${ref.slice(0, 6)}L8`.slice(0, 9),
      groupRef: `${groupRef.slice(0, 7)}Z`,
      customerId: customer.id,
      pickupLabel: "Other",
      dropoffLabel: "Trip",
      scheduledAt: new Date(Date.now() + 3 * 86_400_000),
      customerPrice: "2000.00",
      driverPayout: "1400.00",
      contribution: "600.00",
      status: "pending_payment",
    })
    .returning();

  await declareTransfer(reopened.ref);
  const [lone] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.bookingId, reopened.id),
        eq(payments.provider, BANK_TRANSFER_PROVIDER),
      ),
    );
  check(
    "a one-leg group is charged its own fare, not a sum of strangers",
    lone?.amount === "2000.00",
    `${lone?.amount}`,
  );

  await db.delete(payments).where(eq(payments.bookingId, first.id));
  await db.delete(payments).where(eq(payments.bookingId, reopened.id));
  for (const leg of [...legs, shrunk, reopened]) {
    await db.delete(bookings).where(eq(bookings.id, leg.id));
  }

  // Clean up so a re-run starts from nothing.
  await db.delete(payments).where(eq(payments.bookingId, booking.id));
  await db.delete(payments).where(eq(payments.bookingId, cancelled.id));
  await db.delete(bookings).where(eq(bookings.id, booking.id));
  await db.delete(bookings).where(eq(bookings.id, cancelled.id));
  await db.delete(customers).where(eq(customers.id, customer.id));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
