/**
 * Payment reconciliation tests.
 *
 * Run against a throwaway Postgres — never against production data:
 *   DATABASE_URL=postgresql://... npm run test:payments
 *
 * The gateway is always faked. PayToday has no sandbox, so a test that talked
 * to it would charge real money on every run.
 */
import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { bookings, customers, payments, routes, vehicleClasses } from "@/db/schema";
import {
  getOrCreateCheckout,
  getLatestPayment,
  reconcileBookingPayment,
} from "@/lib/payments/reconcile";
import {
  mapTransactionStatus,
  normalisePhone,
  splitName,
} from "@/lib/payments/paytoday/types";
import type { PaymentIntent, PaymentProvider } from "@/lib/payments/types";

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

/** A stand-in gateway. Records calls so we can assert we did not over-query. */
class FakeGateway implements PaymentProvider {
  readonly name = "paytoday";
  queries = 0;
  creates = 0;

  constructor(
    private next: { status: PaymentIntent["status"]; amount: string },
    private createUrl: string | null = "https://pay.example/checkout/1"
  ) {}

  setNext(next: { status: PaymentIntent["status"]; amount: string }) {
    this.next = next;
  }

  async createPayment(): Promise<PaymentIntent> {
    this.creates += 1;
    return {
      provider: this.name,
      providerReference: `tok_${this.creates}`,
      status: "pending",
      amount: this.next.amount,
      currency: "NAD",
      redirectUrl: this.createUrl,
      raw: {},
    };
  }

  async getPayment(): Promise<PaymentIntent | null> {
    this.queries += 1;
    return {
      provider: this.name,
      providerReference: "tok_1",
      status: this.next.status,
      amount: this.next.amount,
      currency: "NAD",
      redirectUrl: null,
      raw: { transactionStatus: this.next.status },
    };
  }
}

const db = getDb();

/** Builds an unpaid booking with one pending payment attempt against it. */
async function seedBooking(opts: {
  ref: string;
  price: string;
  paymentAmount?: string;
  checkoutUrl?: string | null;
  expiresAt?: Date | null;
  provider?: string;
}) {
  const [route] = await db.select().from(routes).limit(1);
  const [vc] = await db.select().from(vehicleClasses).limit(1);

  const [customer] = await db
    .insert(customers)
    .values({
      fullName: "Test Traveller",
      whatsapp: `+2648${Math.floor(10000000 + Math.random() * 8999999)}`,
      email: "traveller@example.com",
      customerType: "tourist",
    })
    .returning();

  const [booking] = await db
    .insert(bookings)
    .values({
      ref: opts.ref,
      routeId: route.id,
      vehicleClassId: vc.id,
      customerId: customer.id,
      pickupLabel: "Arrivals",
      dropoffLabel: "Hotel",
      scheduledAt: new Date(Date.now() + 86_400_000),
      passengers: 1,
      luggageCount: 1,
      customerPrice: opts.price,
      driverPayout: "400.00",
      contribution: "250.00",
      currency: "NAD",
      status: "pending_payment",
    })
    .returning();

  const [payment] = await db
    .insert(payments)
    .values({
      bookingId: booking.id,
      provider: opts.provider ?? "paytoday",
      providerReference: "tok_1",
      status: "pending",
      amount: opts.paymentAmount ?? opts.price,
      currency: "NAD",
      checkoutUrl: opts.checkoutUrl ?? "https://pay.example/checkout/1",
      expiresAt:
        opts.expiresAt === undefined
          ? new Date(Date.now() + 30 * 60_000)
          : opts.expiresAt,
    })
    .returning();

  return { booking, payment, customer };
}

async function bookingStatus(ref: string) {
  const [row] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(eq(bookings.ref, ref))
    .limit(1);
  return row?.status;
}

const TEST_REFS = [
  "NT-AAAAAA", "NT-BBBBBB", "NT-CCCCCC", "NT-DDDDDD", "NT-EEEEEE",
  "NT-FFFFFF", "NT-GGGGGG", "NT-HHHHHH", "NT-JJJJJJ", "NT-KKKKKK",
];

/** Re-runnable: clear anything a previous run left behind. */
async function cleanup() {
  await db.delete(bookings).where(inArray(bookings.ref, TEST_REFS));
  await db.delete(customers).where(eq(customers.email, "traveller@example.com"));
}

async function main() {
  await cleanup();

  console.log("\nunit — PayToday payload helpers");
  check("splitName splits a two-part name", JSON.stringify(splitName("Jane Doe")) === '{"firstName":"Jane","lastName":"Doe"}');
  check("splitName keeps middle names with the first", splitName("Jane Mary Doe").firstName === "Jane Mary");
  check("splitName survives a single name", splitName("Madonna").lastName === "-");
  check("splitName survives empty input", splitName("   ").firstName === "Traveller");
  check("normalisePhone strips the plus", normalisePhone("+264 81 123 4567") === "264811234567");
  check("normalisePhone handles null", normalisePhone(null) === "");

  console.log("\nunit — status mapping (an unknown status must never read as paid)");
  check("success -> paid", mapTransactionStatus("success") === "paid");
  check("SUCCESS -> paid (case-insensitive)", mapTransactionStatus("  SUCCESS ") === "paid");
  check("failed -> failed", mapTransactionStatus("failed") === "failed");
  check("cancelled -> cancelled", mapTransactionStatus("cancelled") === "cancelled");
  check("pending -> pending", mapTransactionStatus("pending") === "pending");
  check("unknown string -> pending", mapTransactionStatus("weird_new_status") === "pending");
  check("undefined -> pending", mapTransactionStatus(undefined) === "pending");
  check("null -> pending", mapTransactionStatus(null) === "pending");
  check("object -> pending", mapTransactionStatus({ hacked: "success" }) === "pending");

  console.log("\nintegration — reconciliation happy path");
  {
    const gateway = new FakeGateway({ status: "paid", amount: "650.00" });
    await seedBooking({ ref: "NT-AAAAAA", price: "650.00" });

    const first = await reconcileBookingPayment("NT-AAAAAA", gateway);
    check("payment marked paid", first.payment?.status === "paid", first.payment?.status);
    check("changed reported", first.changed);
    check("paidAt stamped", first.payment?.paidAt !== null);
    check("booking confirmed", (await bookingStatus("NT-AAAAAA")) === "confirmed");

    const second = await reconcileBookingPayment("NT-AAAAAA", gateway);
    check("second call is a no-op", second.changed === false);
    check("settled payment is not re-queried", gateway.queries === 1, `queries=${gateway.queries}`);
  }

  console.log("\nintegration — amount mismatch must not confirm a trip");
  {
    const gateway = new FakeGateway({ status: "paid", amount: "1.00" });
    await seedBooking({ ref: "NT-BBBBBB", price: "650.00" });

    const result = await reconcileBookingPayment("NT-BBBBBB", gateway);
    check("underpayment is not marked paid", result.payment?.status !== "paid", result.payment?.status);
    check("booking stays unpaid", (await bookingStatus("NT-BBBBBB")) === "pending_payment");
    const raw = result.payment?.raw as { amountMismatch?: string } | null;
    check("mismatch recorded for a human", Boolean(raw?.amountMismatch), JSON.stringify(raw));
  }

  console.log("\nintegration — a rounding-level difference still settles");
  {
    const gateway = new FakeGateway({ status: "paid", amount: "650.004" });
    await seedBooking({ ref: "NT-CCCCCC", price: "650.00" });
    const result = await reconcileBookingPayment("NT-CCCCCC", gateway);
    check("sub-cent difference accepted", result.payment?.status === "paid", result.payment?.status);
  }

  console.log("\nintegration — a decline does not cancel the booking");
  {
    const gateway = new FakeGateway({ status: "failed", amount: "650.00" });
    await seedBooking({ ref: "NT-DDDDDD", price: "650.00" });

    const result = await reconcileBookingPayment("NT-DDDDDD", gateway);
    check("payment marked failed", result.payment?.status === "failed");
    check("booking survives for a retry", (await bookingStatus("NT-DDDDDD")) === "pending_payment");
  }

  console.log("\nintegration — a gateway outage never blanks out what we know");
  {
    const broken: PaymentProvider = {
      name: "paytoday",
      async createPayment() { throw new Error("gateway down"); },
      async getPayment() { throw new Error("gateway down"); },
    };
    await seedBooking({ ref: "NT-EEEEEE", price: "650.00" });
    const result = await reconcileBookingPayment("NT-EEEEEE", broken);
    check("returns the stored payment", result.payment?.status === "pending");
    check("nothing changed", result.changed === false);
    check("booking untouched", (await bookingStatus("NT-EEEEEE")) === "pending_payment");
  }

  console.log("\nintegration — stub payments are never queried");
  {
    const gateway = new FakeGateway({ status: "paid", amount: "650.00" });
    await seedBooking({ ref: "NT-FFFFFF", price: "650.00", provider: "stub" });
    const result = await reconcileBookingPayment("NT-FFFFFF", gateway);
    check("stub short-circuits", result.changed === false && gateway.queries === 0);
  }

  console.log("\nintegration — checkout reuse and expiry");
  {
    const gateway = new FakeGateway({ status: "pending", amount: "650.00" });
    await seedBooking({ ref: "NT-GGGGGG", price: "650.00" });

    const live = await getOrCreateCheckout("NT-GGGGGG", gateway);
    check("live intent is reused", "url" in live && live.url === "https://pay.example/checkout/1");
    check("no new intent burned", gateway.creates === 0, `creates=${gateway.creates}`);
  }
  {
    const gateway = new FakeGateway({ status: "pending", amount: "650.00" });
    await seedBooking({
      ref: "NT-HHHHHH",
      price: "650.00",
      expiresAt: new Date(Date.now() - 60_000),
    });

    const fresh = await getOrCreateCheckout("NT-HHHHHH", gateway);
    check("lapsed intent is replaced", "url" in fresh && gateway.creates === 1);

    const payment = await getLatestPayment(
      (await db.select().from(bookings).where(eq(bookings.ref, "NT-HHHHHH")).limit(1))[0].id
    );
    check("new attempt is the latest row", payment?.providerReference === "tok_1");
    check("new attempt carries an expiry", payment?.expiresAt !== null);
  }
  {
    const gateway = new FakeGateway({ status: "paid", amount: "650.00" });
    await seedBooking({ ref: "NT-JJJJJJ", price: "650.00" });
    await reconcileBookingPayment("NT-JJJJJJ", gateway);
    const again = await getOrCreateCheckout("NT-JJJJJJ", gateway);
    check("a paid booking cannot be paid twice", "error" in again, JSON.stringify(again));
  }

  console.log("\nintegration — the fare comes from the booking, not the caller");
  {
    const gateway = new FakeGateway({ status: "pending", amount: "650.00" });
    let seenAmount = "";
    const spy: PaymentProvider = {
      name: "paytoday",
      async createPayment(input) {
        seenAmount = input.amount;
        return gateway.createPayment();
      },
      getPayment: () => gateway.getPayment(),
    };
    await seedBooking({
      ref: "NT-KKKKKK",
      price: "4200.00",
      expiresAt: new Date(Date.now() - 1000),
    });
    await getOrCreateCheckout("NT-KKKKKK", spy);
    check("charges the snapshotted fare", seenAmount === "4200.00", seenAmount);
  }

  await cleanup();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
