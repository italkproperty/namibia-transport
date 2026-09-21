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
