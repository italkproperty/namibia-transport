/**
 * The operator "money has arrived" alert.
 *
 * A gateway payment confirms a trip, issues an invoice, and — until this —
 * told nobody, so a paid trip could sit without a driver. The email itself is
 * built purely so this test can read it without sending real mail (the project
 * rule: never wire a real payment or a real send into a test).
 */
import { operatorPaidEmail } from "@/lib/booking/operator-notify";

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

console.log("operator paid alert");

const transfer = operatorPaidEmail({
  kind: "transfer",
  reference: "GRP-ABC123",
  customerName: "Jen Trip",
  customerContact: "+264810000001",
  legLines: [
    "Hosea Kutako International Airport (WDH) → Sossusvlei Lodge · 11 May 2027, 10:00 · NT-1",
    "Sossusvlei Lodge → Hosea Kutako International Airport (WDH) · 14 May 2027, 10:00 · NT-2",
  ],
  total: "14700.00",
  currency: "NAD",
  paymentMethod: "card / online gateway",
  invoice: { invoiceNumber: "NT-INV-2026-0007", url: "https://www.namibiatransport.com/invoice/tok" },
});

check("subject shouts PAID, the reference and the amount", /PAID · GRP-ABC123 · NAD 14700\.00/.test(transfer.subject), transfer.subject);
check("subject tells the operator the next action", /assign a driver/i.test(transfer.subject));
check("THE RULE: the body names the whole trip, both legs", transfer.body.includes("NT-1") && transfer.body.includes("NT-2"));
check("totals what was paid", transfer.body.includes("NAD 14700.00"));
check("carries the customer's contact so the operator can reach them", transfer.body.includes("+264810000001"));
check("carries the invoice link", transfer.body.includes("NT-INV-2026-0007") && transfer.body.includes("/invoice/tok"));
check("points at the admin panel to assign a driver", transfer.body.includes("/admin/bookings"));

const noInvoice = operatorPaidEmail({
  kind: "transfer", reference: "NT-9", customerName: "A", customerContact: "a@b.c",
  legLines: ["X → Y · 1 Jan 2027, 08:00 · NT-9"], total: "650.00", currency: "NAD",
  paymentMethod: "card / online gateway", invoice: null,
});
check("a missing invoice is stated, not left blank", noInvoice.body.includes("Invoice: not on file yet"));

const charter = operatorPaidEmail({
  kind: "charter", reference: "NT-CQ-2026-XYZ", customerName: "Lodge Co", customerContact: "ops@lodge.na",
  legLines: ["1. Windhoek", "2. Sossusvlei", "3. Windhoek"], total: "44450.00", currency: "NAD",
  paymentMethod: "card / online gateway", invoice: null,
});
check("a charter is labelled as an itinerary and lists its stops", charter.body.includes("Charter itinerary:") && charter.body.includes("2. Sossusvlei"));
check("charter subject carries its quote number and total", /PAID · NT-CQ-2026-XYZ · NAD 44450\.00/.test(charter.subject));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
