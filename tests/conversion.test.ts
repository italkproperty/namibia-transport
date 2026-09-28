/**
 * What we tell Google we sold.
 *
 * Every check here is a way of being *confidently* wrong — a number that
 * arrives in the Ads account looking authoritative while bearing no relation
 * to the money in the bank. A bidding strategy then learns from it, which is
 * how a measurement error turns into a spending error.
 *
 * Three of them would each have happened on the obvious implementation.
 */
import {
  conversionFor,
  TRANSFER_PROVIDER,
  type ConversionInput,
} from "@/lib/marketing/conversion";

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

const base: ConversionInput = {
  ref: "NT-ABC123",
  groupRef: null,
  price: "650.00",
  groupTotal: null,
  currency: "NAD",
  isPaid: false,
  provider: null,
};

/* --------------------------------------------------------- a single leg */

console.log("a one-way booking");

const single = conversionFor(base);
check("it is reported as a submitted booking", single.kind === "booking_submitted");
check("keyed on its own reference", single.transactionId === "NT-ABC123");
check("at its own fare", single.value === "650.00");
check("in the currency we actually bank in", single.currency === "NAD");

/* ------------------------------------------------------ a trip is one sale */

/**
 * The airport → Sossusvlei → airport itinerary, priced at N$14,700 across
 * four legs. Reporting the leg in the address bar would tell Google we sold a
 * N$3,675 trip — and, once the traveller opened each leg's page, would say it
 * four times.
 */
console.log("\nan itinerary is one sale, not four");

const legs = ["NT-L1", "NT-L2", "NT-L3", "NT-L4"].map((ref) =>
  conversionFor({
    ...base,
    ref,
    groupRef: "GRP-SOSSUS",
    price: "3675.00",
    groupTotal: "14700.00",
  }),
);

check(
  "THE RULE: every leg reports the trip's total, not its own fare",
  legs.every((leg) => leg.value === "14700.00"),
  legs.map((l) => l.value).join(", "),
);
check(
  "THE RULE: every leg reports the same transaction, so Google counts it once",
  new Set(legs.map((leg) => leg.transactionId)).size === 1,
  legs.map((l) => l.transactionId).join(", "),
);
check(
  "and that transaction is the group, not a leg",
  legs[0].transactionId === "GRP-SOSSUS",
);
check(
  "a grouped booking with no total yet falls back to its own fare rather than reporting nothing",
  conversionFor({ ...base, groupRef: "GRP-X", groupTotal: null }).value === "650.00",
);

/* ------------------------------------------- the browser never reports EFT */

/**
 * The double count. A confirmed transfer makes a booking paid too, so firing
 * on `isPaid` alone reports it here — and then `/admin/conversions` uploads
 * the same money again by click id. Every bank payment would count twice, and
 * bank transfer is how most Namibian business money moves.
 */
console.log("\nthe browser reports the gateway, the export reports transfers");

const paidByCard = conversionFor({
  ...base,
  isPaid: true,
  provider: "paytoday",
});
const paidByTransfer = conversionFor({
  ...base,
  isPaid: true,
  provider: TRANSFER_PROVIDER,
});

check("a card payment is reported as paid", paidByCard.kind === "booking_paid");
check(
  "THE RULE: a bank transfer is not reported as paid from the browser",
  paidByTransfer.kind === "booking_submitted",
  paidByTransfer.kind,
);
check(
  "an unpaid booking with a failed card attempt is not paid",
  conversionFor({ ...base, isPaid: false, provider: "paytoday" }).kind ===
    "booking_submitted",
);
// Paid with no provider row should not arise — `isPaid` is read off a
// payment, which always has one — but the split has to resolve it anyway.
// It reports as paid, and the export cannot also claim it, because the
// export selects on the transfer provider by name rather than on "not a
// gateway". Whichever way this case falls, it falls once.
check(
  "paid with no provider recorded reports once, from here",
  conversionFor({ ...base, isPaid: true, provider: null }).kind === "booking_paid",
);

/* ------------------------------------------------------------ money shape */

console.log("\nmoney keeps its shape");

check(
  "the value is the stored decimal string, never a float",
  typeof paidByCard.value === "string" && paidByCard.value === "650.00",
);
check(
  "a trip total with cents survives intact",
  conversionFor({
    ...base,
    groupRef: "GRP-Y",
    groupTotal: "14700.55",
  }).value === "14700.55",
);
check(
  "and the currency is carried, not assumed",
  conversionFor({ ...base, currency: "ZAR" }).currency === "ZAR",
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
