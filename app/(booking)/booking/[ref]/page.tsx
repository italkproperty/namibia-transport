import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon, ClockIcon } from "lucide-react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getBookingByRef } from "@/lib/booking/queries";
import { formatDateTime } from "@/lib/format";
import { formatNad } from "@/lib/money";
import { INCLUSIONS } from "@/lib/site";

export const metadata: Metadata = {
  title: "Booking confirmed",
  robots: { index: false, follow: false },
};

/** A booking reference is personal — never let a search engine hold one. */
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ ref: string }> };

export default async function BookingConfirmationPage({ params }: PageProps) {
  const { ref } = await params;
  const detail = await getBookingByRef(decodeURIComponent(ref));

  if (!detail) {
    notFound();
  }

  const { booking } = detail;
  const routeLabel =
    detail.routeOrigin && detail.routeDestination
      ? `${detail.routeOrigin} to ${detail.routeDestination}`
      : `${booking.pickupLabel} to ${booking.dropoffLabel}`;

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="bg-brand/10 text-brand inline-flex size-11 items-center justify-center rounded-full">
            <CheckIcon className="size-5" aria-hidden />
          </div>

          <h1 className="font-display mt-6 text-4xl text-balance sm:text-5xl">
            You&rsquo;re booked, {detail.customerName.split(" ")[0]}.
          </h1>
          <p className="text-muted-foreground mt-4 text-lg text-pretty">
            We have your transfer. Keep this reference — quote it any time you
            message us.
          </p>

          {/* ---------------------------------------------------- reference */}
          <div className="border-border/70 bg-card mt-9 rounded-2xl border p-6">
            <p className="text-muted-foreground text-xs tracking-wider uppercase">
              Booking reference
            </p>
            <p className="tabular font-display mt-1 text-4xl tracking-tight">
              {booking.ref}
            </p>

            <Separator className="my-6" />

            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-sm">Route</dt>
                <dd className="mt-0.5 font-medium">{routeLabel}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Pickup</dt>
                <dd className="mt-0.5 font-medium">
                  {formatDateTime(booking.scheduledAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">From</dt>
                <dd className="mt-0.5 font-medium">{booking.pickupLabel}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">To</dt>
                <dd className="mt-0.5 font-medium">{booking.dropoffLabel}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Vehicle</dt>
                <dd className="mt-0.5 font-medium">
                  {detail.vehicleClassName ?? "Private vehicle"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Party</dt>
                <dd className="mt-0.5 font-medium">
                  {booking.passengers}{" "}
                  {booking.passengers === 1 ? "passenger" : "passengers"}
                  {booking.luggageCount > 0 && ` · ${booking.luggageCount} bags`}
                </dd>
              </div>
              {booking.flightNumber && (
                <div>
                  <dt className="text-muted-foreground text-sm">Flight</dt>
                  <dd className="mt-0.5 font-medium">{booking.flightNumber}</dd>
                </div>
              )}
              {booking.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground text-sm">Your notes</dt>
                  <dd className="mt-0.5 text-pretty">{booking.notes}</dd>
                </div>
              )}
            </dl>

            <Separator className="my-6" />

            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-muted-foreground text-sm">Total fare</p>
                <p className="tabular mt-1 text-3xl font-semibold tracking-tight">
                  {formatNad(booking.customerPrice)}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Fixed at booking · per vehicle
                </p>
              </div>
              <Badge variant="warning" className="gap-1.5">
                <ClockIcon className="size-3" aria-hidden />
                Payment pending
              </Badge>
            </div>
          </div>

          {/* ------------------------------------------------- payment notice */}
          <div className="border-border bg-muted/40 mt-6 rounded-2xl border border-dashed p-6">
            <p className="font-medium tracking-tight">
              Payment pending — confirmation will follow on WhatsApp
            </p>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Nothing has been charged. We will message{" "}
              <span className="text-foreground">{detail.customerWhatsapp}</span>{" "}
              with payment details and your driver&rsquo;s name before your
              travel date. Your fare is locked in at{" "}
              {formatNad(booking.customerPrice)} either way.
            </p>
          </div>

          {/* ------------------------------------------------ what to expect */}
          <section aria-labelledby="expect-heading" className="mt-12">
            <h2 id="expect-heading" className="font-display text-2xl">
              What happens next
            </h2>
            <ul className="mt-5 space-y-4">
              {INCLUSIONS.slice(0, 4).map((item) => (
                <li key={item.title} className="flex gap-3">
                  <CheckIcon
                    className="text-brand mt-1 size-4 shrink-0"
                    aria-hidden
                  />
                  <div>
                    <p className="font-medium tracking-tight">{item.title}</p>
                    <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-12 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/">Back to home</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/book">Book another transfer</Link>
            </Button>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
