import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangleIcon,
  CalendarPlusIcon,
  CheckIcon,
  ClockIcon,
  MapPinIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { BankTransfer } from "@/components/booking/bank-transfer";
import { DriverCard } from "@/components/booking/driver-card";
import { TripDetailsForm } from "@/components/booking/trip-details-form";
import { PayNowButton } from "@/components/booking/pay-now-button";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Button } from "@/components/ui/button";
import { isAirportLeg } from "@/lib/booking/details";
import { Fare, FareNote } from "@/components/currency/fare";
import { getBookingByRef } from "@/lib/booking/queries";
import { quoteValidity } from "@/lib/booking/validity";
import { getCompanyInfo, whatsappLink } from "@/lib/company";
import { formatDateTime } from "@/lib/format";
import { mapsLink } from "@/lib/maps/bounds";
import { formatNad } from "@/lib/money";
import { journeyLabel } from "@/lib/network/journey";
import { isLiveGatewayConfigured } from "@/lib/payments";
import {
  bankTransferLines,
  getBankDetails,
  proofOfPaymentLink,
  TRANSFER_NOTE,
} from "@/lib/payments/bank";
import { getTransferState } from "@/lib/payments/transfer";
import {
  getLatestPayment,
  reconcileBookingPayment,
  toPaymentView,
} from "@/lib/payments/reconcile";
import { PAYMENT_POLICY } from "@/lib/booking/payment-policy";

export const metadata: Metadata = {
  title: "Booking confirmed",
  robots: { index: false, follow: false },
};

/** A booking reference is personal — never let a search engine hold one. */
export const dynamic = "force-dynamic";

const NEXT_STEPS = [
  {
    title: "We confirm on WhatsApp",
    body: "Your booking details, before your travel date.",
  },
  {
    title: "Late flights are fine",
    body: "Your flight number is on the driver's job card. If you land late, the pickup moves with you. No waiting charge.",
  },
  {
    title: "Your driver is assigned",
    body: "Name, vehicle and registration sent to you before pickup.",
  },
  {
    title: "They meet you",
    body: "Name board in arrivals, then straight to your destination.",
  },
];

type PageProps = { params: Promise<{ ref: string }> };

export default async function BookingConfirmationPage({ params }: PageProps) {
  const { ref } = await params;
  const decodedRef = decodeURIComponent(ref);

  // Settles the case the return URL cannot: the traveller paid, then closed the
  // tab before PayToday redirected them back. Already-settled payments
  // short-circuit without a network call, so this is cheap on every view.
  await reconcileBookingPayment(decodedRef);

  const detail = await getBookingByRef(decodedRef);

  if (!detail) {
    notFound();
  }

  const { booking } = detail;
  const payment = toPaymentView(await getLatestPayment(booking.id));
  const isPaid = payment?.status === "paid";
  // Offer payment whenever a live gateway is configured — including when the
  // booking has no payments row, which happens if the gateway was unreachable
  // at booking time. Requiring a row meant the one case that most needed a
  // retry button was the one case that never showed one.
  // An unpaid quote at a public URL is a live price, and it has to stop being
  // one. The page stays readable so a traveller can see what they were told;
  // what goes is the way to pay yesterday's fare.
  const validity = quoteValidity(booking);
  const canPayNow =
    !isPaid &&
    isLiveGatewayConfigured() &&
    payment?.provider !== "stub" &&
    booking.status !== "cancelled" &&
    !validity.expired;
  // Bank transfer stands on its own rather than behind a "card failed" branch:
  // an EFT is how most Namibian business money moves, and while PayToday is
  // refusing our account it is the only way anyone can pay us at all.
  const bank =
    booking.status === "cancelled" || validity.expired
      ? null
      : getBankDetails();
  const transfer = await getTransferState(booking.id);

  const company = getCompanyInfo();
  const routeLabel =
    detail.routeOrigin && detail.routeDestination
      ? `${detail.routeOrigin} to ${detail.routeDestination}`
      : // A journey priced from the road network has no routes row, so the
        // leg is read back from the pair snapshotted onto the booking.
        (journeyLabel(booking.journeySlug) ??
        `${booking.pickupLabel} to ${booking.dropoffLabel}`);

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex items-center gap-2">
            <span className="bg-success-subtle text-success inline-flex size-7 items-center justify-center rounded-full">
              <CheckIcon className="size-4" aria-hidden />
            </span>
            <p className="text-success text-sm font-medium">
              {isPaid ? "Paid and confirmed" : "Booking received"}
            </p>
          </div>

          {/* The reference is the one thing they need to keep. */}
          <div className="bg-card mt-4 rounded-xl border p-5">
            <p className="text-muted-foreground text-xs font-medium">
              Booking reference
            </p>
            <p className="tabular mt-1 text-4xl leading-none font-semibold tracking-tight sm:text-5xl">
              {booking.ref}
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              Quote this any time you message us.
            </p>

            {/* The driver, once there is one. This is the answer to the only
                question an arriving traveller actually has, so it sits above
                the trip detail rather than among it. */}
            {detail.driverName && (
              <DriverCard
                name={detail.driverName}
                photoUrl={detail.driverPhotoUrl}
                phone={detail.driverPhone}
                whatsapp={detail.driverWhatsapp}
                vehicle={
                  [
                    detail.vehicleColour,
                    detail.vehicleMake,
                    detail.vehicleModel,
                  ]
                    .filter(Boolean)
                    .join(" ") || null
                }
                registration={detail.vehicleRegistration}
              />
            )}

            <TripDetailsForm
              bookingRef={booking.ref}
              legLabel={routeLabel}
              dateLabel={formatDateTime(booking.scheduledAt)}
              isAirportLeg={isAirportLeg(
                booking.journeySlug,
                routeLabel,
                booking.pickupLabel,
                booking.dropoffLabel,
              )}
              pickupTime={new Intl.DateTimeFormat("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "Africa/Windhoek",
              }).format(booking.scheduledAt)}
              pickupDetail={booking.pickupDetail}
              travellerNotes={booking.travellerNotes}
              flightNumber={booking.flightNumber}
              savedAt={booking.detailsUpdatedAt?.toISOString() ?? null}
            />

            <dl className="mt-5 grid gap-x-6 gap-y-2.5 border-t pt-4 text-sm sm:grid-cols-2">
              <Row label="Route">{routeLabel}</Row>
              <Row label="Pickup">{formatDateTime(booking.scheduledAt)}</Row>
              <Row label="From">
                {booking.pickupLabel}
                <PinNote lat={booking.pickupLat} lng={booking.pickupLng} />
              </Row>
              <Row label="To">
                {booking.dropoffLabel}
                <PinNote lat={booking.dropoffLat} lng={booking.dropoffLng} />
              </Row>
              <Row label="Vehicle">
                {detail.vehicleClassName ?? "Private vehicle"}
              </Row>
              <Row label="Party">
                {booking.passengers}{" "}
                {booking.passengers === 1 ? "passenger" : "passengers"}
                {booking.luggageCount > 0 && ` · ${booking.luggageCount} bags`}
              </Row>
              {booking.flightNumber && (
                <Row label="Flight">{booking.flightNumber}</Row>
              )}
              {booking.notes && <Row label="Notes">{booking.notes}</Row>}
            </dl>

            <div className="mt-4 flex items-end justify-between gap-4 border-t pt-4">
              <div>
                <p className="text-muted-foreground text-xs font-medium">
                  Total fare
                </p>
                <p className="tabular text-brand text-3xl leading-none font-semibold tracking-tight">
                  <Fare nad={booking.customerPrice} block />
                </p>
                <FareNote className="text-muted-foreground mt-1 block text-xs leading-snug" />
              </div>
              <PaymentBadge status={payment?.status ?? null} />
            </div>
          </div>

          {isPaid ? (
            <div className="border-success/30 bg-success-subtle/50 mt-4 flex gap-3 rounded-xl border p-4">
              <ShieldCheckIcon
                className="text-success mt-0.5 size-5 shrink-0"
                strokeWidth={1.75}
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium">
                  Payment received — your seat is held
                </p>
                <p className="text-muted-foreground mt-1 text-sm leading-snug">
                  {formatNad(booking.customerPrice)} paid via PayToday. We will
                  message{" "}
                  <span className="text-foreground">
                    {detail.customerWhatsapp}
                  </span>{" "}
                  with your driver&rsquo;s name, vehicle and registration before
                  pickup.
                </p>
              </div>
            </div>
          ) : (
            <div className="border-warning/30 bg-warning-subtle/50 mt-4 flex gap-3 rounded-xl border p-4">
              <AlertTriangleIcon
                className="text-warning mt-0.5 size-5 shrink-0"
                strokeWidth={1.75}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {payment?.status === "failed"
                    ? "That payment did not go through"
                    : "Payment pending"}
                </p>
                <p className="text-muted-foreground mt-1 text-sm leading-snug">
                  {payment?.status === "failed"
                    ? "Nothing was charged. Your fare is still held — try again with another card."
                    : canPayNow
                      ? PAYMENT_POLICY.awaitingPaymentOnline
                      : bank
                        ? PAYMENT_POLICY.awaitingPaymentBank
                        : PAYMENT_POLICY.awaitingPaymentLink}{" "}
                  Your fare is fixed at {formatNad(booking.customerPrice)} and
                  will not change.
                </p>
                {canPayNow && (
                  <div className="mt-3">
                    <PayNowButton
                      bookingRef={booking.ref}
                      label={
                        payment?.status === "failed" ? "Try again" : "Pay now"
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {validity.expired && booking.status !== "cancelled" && (
            <div className="border-warning/40 bg-warning/10 mt-4 flex gap-3 rounded-xl border p-4">
              <ClockIcon
                className="text-warning mt-0.5 size-5 shrink-0"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {validity.reason === "travelled"
                    ? "This date has passed"
                    : "This fare is out of date"}
                </p>
                <p className="text-muted-foreground mt-1 text-sm leading-snug text-pretty">
                  {validity.message}
                </p>
                {company.whatsapp && (
                  <a
                    href={whatsappLink(
                      company.whatsapp,
                      `Hi — booking ${booking.ref}. Could you re-price it?`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium underline underline-offset-4"
                  >
                    Ask us to re-price it on WhatsApp
                  </a>
                )}
              </div>
            </div>
          )}

          {!isPaid && bank && (
            <div className="mt-4">
              <BankTransfer
                bookingRef={booking.ref}
                lines={bankTransferLines(bank, booking.ref)}
                note={TRANSFER_NOTE}
                declaredAt={transfer.declaredAt}
                confirmed={transfer.status === "confirmed"}
                proofEmail={company.email}
                proofHref={
                  company.email
                    ? proofOfPaymentLink(
                        company.email,
                        booking.ref,
                        formatNad(booking.customerPrice),
                      )
                    : null
                }
              />
            </div>
          )}

          <section aria-labelledby="next-heading" className="mt-8">
            <h2 id="next-heading" className="text-base font-semibold">
              What happens next
            </h2>
            <ol className="mt-3 grid gap-3 sm:grid-cols-2">
              {NEXT_STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-2.5">
                  <span
                    className="bg-brand-subtle text-brand tabular flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-muted-foreground mt-0.5 text-sm leading-snug">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="mt-8 flex flex-wrap gap-2">
            <Button asChild variant="outline" className="press">
              <a href={`/booking/${booking.ref}/calendar`}>
                <CalendarPlusIcon className="size-4" aria-hidden />
                Add to calendar
              </a>
            </Button>
            {company.whatsapp && (
              <Button asChild variant="outline" className="press">
                <a
                  href={whatsappLink(
                    company.whatsapp,
                    `Hi — my booking reference is ${booking.ref}.`,
                  )}
                >
                  <MessageCircleIcon className="size-4" aria-hidden />
                  WhatsApp us
                </a>
              </Button>
            )}
            <Button asChild variant="ghost" className="press">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

/** Reflects the gateway's own status; never a guess from the page it renders on. */
function PaymentBadge({ status }: { status: string | null }) {
  const label =
    status === "paid"
      ? "Paid"
      : status === "failed"
        ? "Payment failed"
        : status === "cancelled"
          ? "Payment cancelled"
          : status === "refunded"
            ? "Refunded"
            : "Payment pending";

  const tone =
    status === "paid"
      ? "bg-success-subtle text-success"
      : status === "failed" || status === "cancelled"
        ? "bg-destructive/10 text-destructive"
        : "bg-warning-subtle text-warning";

  return (
    <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

/**
 * A pin, shown back to the person who dropped it.
 *
 * The point of confirming a pin is that it can be checked — a coordinate
 * nobody ever sees again is worse than no pin at all, because the traveller
 * assumes it is right. Renders nothing when no pin was dropped.
 */
function PinNote({ lat, lng }: { lat: number | null; lng: number | null }) {
  if (lat === null || lng === null) return null;
  return (
    <a
      href={mapsLink({ lat, lng })}
      target="_blank"
      rel="noreferrer"
      className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs underline underline-offset-2"
    >
      <MapPinIcon className="size-3 shrink-0" aria-hidden />
      Pinned — check the spot
    </a>
  );
}
