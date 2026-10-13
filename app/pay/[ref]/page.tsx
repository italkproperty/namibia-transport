import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getDb, isDatabaseConfigured } from "@/db";
import { bookings, customers } from "@/db/schema";
import { formatNad } from "@/lib/money";
import { getLatestPayment } from "@/lib/payments/reconcile";
import { isLiveGatewayConfigured } from "@/lib/payments";

import { CardCheckoutForm } from "@/components/payments/card-checkout-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Review your transfer and pay",
  robots: { index: false, follow: false },
};

export default async function QuotePaymentPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref: rawRef } = await params;
  const ref = rawRef.trim().toUpperCase();
  if (!/^NT-[ABCDEFGHJKLMNPQRTUVWXY2346789]{6}$/.test(ref)) notFound();
  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <h1 className="text-2xl font-semibold">Payment temporarily unavailable</h1>
        <p className="text-muted-foreground mt-3 text-sm">Please contact Namibia Transport so we can help you complete payment.</p>
      </main>
    );
  }

  const [row] = await getDb()
    .select({
      booking: bookings,
      customerName: customers.fullName,
    })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(eq(bookings.ref, ref))
    .limit(1);

  if (!row) notFound();

  const { booking } = row;
  const payment = await getLatestPayment(booking.id);
  const gatewayReady = isLiveGatewayConfigured();
  const paid = payment?.status === "paid" || booking.status === "confirmed" || booking.status === "completed";

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-xl">
        <a href="https://www.namibiatransport.com" className="text-sm font-semibold tracking-wide">NAMIBIA TRANSPORT</a>
        <section className="bg-card mt-6 rounded-2xl border p-5 shadow-sm sm:p-8">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Transfer payment</p>
          <h1 className="mt-2 text-2xl font-semibold">Review your trip</h1>
          <p className="text-muted-foreground mt-2 text-sm">Hello {row.customerName}, check the details below before continuing to secure payment.</p>

          <dl className="mt-6 space-y-4 text-sm">
            <div className="flex justify-between gap-4 border-b pb-3">
              <dt className="text-muted-foreground">Booking reference</dt>
              <dd className="font-mono font-medium">{booking.ref}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b pb-3">
              <dt className="text-muted-foreground">Pickup</dt>
              <dd className="max-w-[65%] text-right font-medium">{booking.pickupLabel}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b pb-3">
              <dt className="text-muted-foreground">Destination</dt>
              <dd className="max-w-[65%] text-right font-medium">{booking.dropoffLabel}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b pb-3">
              <dt className="text-muted-foreground">Pickup time</dt>
              <dd className="text-right font-medium">{booking.scheduledAt.toLocaleString("en-NA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Windhoek" })}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b pb-3">
              <dt className="text-muted-foreground">Passengers</dt>
              <dd className="font-medium">{booking.passengers}</dd>
            </div>
            <div className="flex justify-between gap-4 pt-1">
              <dt className="text-base font-semibold">Total to pay</dt>
              <dd className="text-brand text-xl font-semibold">{formatNad(booking.customerPrice)}</dd>
            </div>
          </dl>

          {paid ? (
            <div className="bg-success/10 mt-6 rounded-lg p-4">
              <p className="font-medium">Payment received</p>
              <p className="text-muted-foreground mt-1 text-sm">This booking is marked as paid/confirmed. Contact us if you need help.</p>
            </div>
          ) : gatewayReady ? (
            <div className="mt-6">
              <CardCheckoutForm ref={booking.ref} />
            </div>
          ) : (
            <div className="mt-6 rounded-lg border p-4">
              <p className="font-medium">Card payment is temporarily unavailable</p>
              <p className="text-muted-foreground mt-1 text-sm">Please contact Namibia Transport to arrange payment. Your quote and fare are saved.</p>
            </div>
          )}
          <p className="text-muted-foreground mt-6 text-center text-xs">Questions? Contact the Namibia Transport team before paying if any trip detail looks incorrect.</p>
        </section>
      </div>
    </main>
  );
}
