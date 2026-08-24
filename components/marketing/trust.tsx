import Link from "next/link";
import {
  BadgeCheckIcon,
  CalendarCheckIcon,
  CarFrontIcon,
  LockIcon,
  MessageCircleIcon,
  PhoneIcon,
  PlaneIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  UserCheckIcon,
} from "lucide-react";

import { getCompanyInfo, whatsappLink } from "@/lib/company";
import { getPublishedReviews } from "@/lib/reviews";

/**
 * Trust is the product. An international traveller's real fear is "what if I
 * land in Namibia and nobody is there?" — these sections exist to answer that
 * and the questions behind it, explicitly and honestly. Nothing here claims
 * what the operation cannot yet deliver.
 */

const AFTER_BOOKING = [
  {
    icon: CalendarCheckIcon,
    title: "Booking confirmed instantly",
    body: "You get a reference the moment you book, plus a confirmation on WhatsApp.",
  },
  {
    icon: PlaneIcon,
    title: "We monitor your flight",
    body: "Give us your flight number and our operations team adjusts the pickup if you're delayed — at no charge.",
  },
  {
    icon: UserCheckIcon,
    title: "Your driver is assigned",
    body: "You receive the driver's name, vehicle and registration on WhatsApp before pickup.",
  },
  {
    icon: BadgeCheckIcon,
    title: "They're waiting with your name",
    body: "Inside the arrivals hall with a name board, or at your door for city and intercity pickups.",
  },
  {
    icon: CarFrontIcon,
    title: "Straight to your destination",
    body: "A direct, private drive. No meter, no negotiation, no other passengers.",
  },
  {
    icon: MessageCircleIcon,
    title: "One number the whole way",
    body: "A human on WhatsApp before, during and after the trip — including if a driver has an emergency and we re-assign.",
  },
];

export function AfterBooking({ headingId = "after-heading" }: { headingId?: string }) {
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-lg sm:text-xl">
        What happens after you book
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Booked at midnight from another country? This is exactly what happens
        next.
      </p>
      <ol className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {AFTER_BOOKING.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              className="bg-brand-subtle text-brand tabular flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              aria-hidden
            >
              {index + 1}
            </span>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <step.icon className="text-brand size-3.5" aria-hidden />
                {step.title}
              </p>
              <p className="text-muted-foreground mt-1 text-sm leading-snug">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const TRUST_POINTS = [
  {
    icon: ReceiptTextIcon,
    title: "The price is the price",
    body: "Quoted in full before you book, fixed at that moment. No meter, no surge, no airport surcharge.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Vetted partner drivers",
    body: "Independent Namibian professionals we select, brief and stand behind on every trip.",
  },
  {
    icon: LockIcon,
    title: "Nothing charged today",
    body: "Book now; payment details follow with your confirmation. Your fare cannot change after booking.",
  },
  {
    icon: PhoneIcon,
    title: "Clear cancellation terms",
    body: "Free cancellation up to 24 hours before pickup — the full policy is one click away, not buried.",
  },
];

export function WhyTrustUs({ headingId = "trust-heading" }: { headingId?: string }) {
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-lg sm:text-xl">
        Why travellers trust us
      </h2>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST_POINTS.map((point) => (
          <li key={point.title} className="bg-card rounded-xl border p-4">
            <point.icon className="text-brand size-5" strokeWidth={1.75} aria-hidden />
            <p className="mt-2.5 text-sm font-medium">{point.title}</p>
            <p className="text-muted-foreground mt-1 text-sm leading-snug">
              {point.body}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-3 text-xs">
        Full details in our{" "}
        <Link href="/terms" className="underline underline-offset-2">
          booking terms &amp; cancellation policy
        </Link>
        .
      </p>
    </section>
  );
}

/**
 * Support presence. Channels render only when a real number/address exists in
 * the environment — no fabricated contact details, ever.
 */
export function SupportStrip() {
  const company = getCompanyInfo();
  const hasChannel = Boolean(company.whatsapp || company.phone || company.email);

  return (
    <section
      aria-labelledby="support-heading"
      className="bg-primary text-primary-foreground rounded-2xl px-6 py-8 sm:px-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0">
          <h2 id="support-heading" className="text-lg sm:text-xl">
            Need help with a booking?
          </h2>
          <p className="text-primary-foreground/70 mt-1 max-w-md text-sm leading-snug">
            A real operations team in {company.location ?? "Namibia"}.{" "}
            {company.hours}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {company.whatsapp && (
            <a
              href={whatsappLink(company.whatsapp, "Hi — I need help with a booking.")}
              className="press bg-brand text-brand-foreground hover:bg-brand-hover inline-flex h-11 items-center gap-2 rounded-md px-5 text-sm font-medium"
            >
              <MessageCircleIcon className="size-4" aria-hidden />
              WhatsApp us
            </a>
          )}
          {company.phone && (
            <a
              href={`tel:${company.phone.replace(/\s/g, "")}`}
              className="press border-primary-foreground/25 hover:bg-primary-foreground/10 inline-flex h-11 items-center gap-2 rounded-md border px-5 text-sm font-medium"
            >
              <PhoneIcon className="size-4" aria-hidden />
              {company.phone}
            </a>
          )}
          {company.email && (
            <a
              href={`mailto:${company.email}`}
              className="press border-primary-foreground/25 hover:bg-primary-foreground/10 inline-flex h-11 items-center gap-2 rounded-md border px-5 text-sm font-medium"
            >
              {company.email}
            </a>
          )}
          {!hasChannel && (
            <p className="text-primary-foreground/70 text-sm">
              WhatsApp and phone lines are published at launch.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Social proof renders only when a genuinely published review exists — an
 * empty section or an invented quote would each cost more trust than they buy.
 */
export async function ReviewsSection() {
  const reviews = await getPublishedReviews();
  if (reviews.length === 0) return null;

  return (
    <section aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="text-lg sm:text-xl">
        From recent travellers
      </h2>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.slice(0, 6).map((review) => (
          <li key={review.id} className="bg-card rounded-xl border p-4">
            <p aria-label={`${review.rating} out of 5 stars`} className="text-brand text-sm tracking-wide">
              {"★".repeat(Math.min(5, Math.max(1, review.rating)))}
              <span className="text-border">
                {"★".repeat(Math.max(0, 5 - review.rating))}
              </span>
            </p>
            <blockquote className="mt-2 text-sm leading-relaxed text-pretty">
              &ldquo;{review.body}&rdquo;
            </blockquote>
            <p className="text-muted-foreground mt-3 text-xs">
              {review.authorName}
              {review.authorContext ? ` · ${review.authorContext}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
