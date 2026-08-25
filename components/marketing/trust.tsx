import Link from "next/link";
import {
  BadgeCheckIcon,
  MessageCircleIcon,
  PhoneIcon,
  PlaneIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  StarIcon,
} from "lucide-react";

import { getCompanyInfo, SUPPORT, whatsappLink } from "@/lib/company";
import { getPublishedReviews, getReviewSummary } from "@/lib/reviews";

/**
 * Trust is the product. An international traveller's real fear is "what if I
 * land in Namibia and nobody is there?" — these sections exist to answer that
 * and the questions behind it, precisely. Nothing here claims what the
 * operation cannot yet deliver, and nothing renders as a placeholder that
 * advertises our own immaturity to a customer.
 */

const TRUST_POINTS = [
  {
    icon: ReceiptTextIcon,
    title: "Fixed price",
    body: "Quoted in full before you book. No meter, no surge, no negotiating at the airport.",
  },
  {
    icon: PlaneIcon,
    title: "Flight monitored",
    body: "We track your inbound flight and move the pickup when it changes — at no charge.",
  },
  {
    icon: BadgeCheckIcon,
    title: "Driver confirmed",
    body: "Name, vehicle and registration sent to you before pickup, not on the day.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Meet & greet",
    body: "Your driver waits inside arrivals with your name on a board.",
  },
  {
    icon: MessageCircleIcon,
    title: "One number, start to finish",
    body: "Quote your reference and we can see your trip, your driver and your flight — one message settles it.",
  },
];

export function WhyTrustUs({ headingId = "trust-heading" }: { headingId?: string }) {
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-xl sm:text-2xl">
        Why travellers choose us
      </h2>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {TRUST_POINTS.map((point) => (
          <li key={point.title} className="bg-card rounded-xl border p-4">
            <point.icon className="text-brand size-5" strokeWidth={1.75} aria-hidden />
            <p className="mt-2.5 text-sm font-semibold">{point.title}</p>
            <p className="text-muted-foreground mt-1 text-sm leading-snug text-pretty">
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
 * The arrival anxiety, answered directly. The traveller's real question is not
 * "is this site nice" but "when I walk through those doors, will I know where
 * to go?" — so this describes the meeting itself, step by step.
 */
export function MeetingPoint() {
  const company = getCompanyInfo();

  return (
    <section
      aria-labelledby="meeting-heading"
      className="bg-card overflow-hidden rounded-2xl border"
    >
      <div className="grid gap-0 lg:grid-cols-[1.1fr_1fr]">
        <div className="p-6 sm:p-8">
          <p className="text-brand text-xs font-semibold tracking-[0.14em] uppercase">
            Arriving at Hosea Kutako
          </p>
          <h2 id="meeting-heading" className="mt-1.5 text-xl sm:text-2xl">
            You will know exactly where to go
          </h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
            After you clear immigration and collect your bags, walk through into
            the arrivals hall. Your driver is standing there with your name on a
            board — before you land, you already know who to look for.
          </p>

          <dl className="mt-5 space-y-3">
            {[
              ["Driver name", "Sent to you before pickup"],
              ["Vehicle & registration", "So you can identify the car"],
              ["Driver's phone number", "Direct line on the day"],
              ["Meeting instructions", "Exactly where they will stand"],
            ].map(([term, detail]) => (
              <div key={term} className="flex items-start gap-3">
                <BadgeCheckIcon
                  className="text-brand mt-0.5 size-4 shrink-0"
                  aria-hidden
                />
                <div className="min-w-0">
                  <dt className="text-sm font-medium">{term}</dt>
                  <dd className="text-muted-foreground text-sm leading-snug">
                    {detail}
                  </dd>
                </div>
              </div>
            ))}
          </dl>

          {company.whatsapp && (
            <p className="text-muted-foreground mt-5 text-sm leading-snug">
              Cannot see your driver?{" "}
              <a
                href={whatsappLink(
                  company.whatsapp,
                  "Hi — I have landed and cannot find my driver."
                )}
                className="text-foreground underline underline-offset-2"
              >
                Message us on WhatsApp
              </a>{" "}
              and we will put you together in minutes.
            </p>
          )}
        </div>

        {/* An honest diagram of the walk, not a stock photograph. */}
        <div className="bg-brand-subtle/50 border-t p-6 sm:p-8 lg:border-t-0 lg:border-l">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Your walk through arrivals
          </p>
          <ol className="mt-4 space-y-0">
            {[
              "Aircraft doors open",
              "Passport control",
              "Baggage reclaim",
              "Through the arrivals doors",
              "Your driver, holding your name",
            ].map((step, index, all) => (
              <li key={step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={[
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold",
                      index === all.length - 1
                        ? "bg-brand text-brand-foreground"
                        : "border-brand/40 text-brand border bg-transparent",
                    ].join(" ")}
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  {index < all.length - 1 && (
                    <span className="bg-brand/25 h-7 w-px" aria-hidden />
                  )}
                </div>
                <p
                  className={[
                    "pb-1 text-sm leading-6",
                    index === all.length - 1
                      ? "font-semibold"
                      : "text-muted-foreground",
                  ].join(" ")}
                >
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

const CONTINGENCIES = [
  {
    question: "What if my flight is delayed?",
    answer:
      "We monitor your flight and move the pickup to your actual landing time. No waiting fee — a delay is not your fault.",
  },
  {
    question: "What if I cannot find my driver?",
    answer:
      "Message the WhatsApp number on your confirmation. We are in contact with your driver and will put you together in minutes.",
  },
  {
    question: "What if my driver has an emergency?",
    answer:
      "Re-assignment is our job, not yours. Another vetted driver is placed on your trip at the same price, and we tell you immediately.",
  },
  {
    question: "What if I land late at night?",
    answer:
      "Pickups are coordinated to your confirmed flight, whatever the hour. Late arrivals are normal for us, not an exception.",
  },
  {
    question: "What if I need to change my booking?",
    answer:
      "Message us. Changes are free more than 24 hours before pickup, and we will always try to accommodate later ones.",
  },
  {
    question: "What if nobody comes at all?",
    answer:
      "Then you pay nothing, and anything already paid is refunded in full. That is written into our terms, not just promised here.",
  },
];

/** Risk reversal: the questions a traveller is too polite to ask, answered. */
export function Contingencies({
  headingId = "contingency-heading",
}: {
  headingId?: string;
}) {
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-xl sm:text-2xl">
        What if something goes wrong?
      </h2>
      <p className="text-muted-foreground mt-1.5 max-w-xl text-sm text-pretty">
        Every transfer has a plan B. Here is ours, before you need it.
      </p>

      <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {CONTINGENCIES.map((item) => (
          <div key={item.question}>
            <dt className="text-sm font-semibold text-pretty">{item.question}</dt>
            <dd className="text-muted-foreground mt-1 text-sm leading-snug text-pretty">
              {item.answer}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Support presence. Renders only when a real channel is configured — a public
 * "our lines are not connected yet" note is worse than no section at all.
 */
export function SupportStrip() {
  const company = getCompanyInfo();
  if (!company.hasContactChannel) return null;

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
            Coordination from {company.location}, {SUPPORT.officeHours}. On
            your travel day we are reachable throughout your journey — quote
            your reference and we can see the whole trip.
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
        </div>
      </div>
    </section>
  );
}

/**
 * How the operation is actually structured. Deliberately describes roles, not
 * invented headcounts or staff photos — those go in when they are real, and
 * the layout is here waiting for them.
 */
export function OperationsSection() {
  const company = getCompanyInfo();

  return (
    <section aria-labelledby="ops-heading">
      <h2 id="ops-heading" className="text-xl sm:text-2xl">
        The people behind your transfer
      </h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="bg-card rounded-xl border p-5">
          <p className="text-brand text-xs font-semibold tracking-[0.14em] uppercase">
            Operations
          </p>
          <p className="mt-1.5 font-semibold">{company.location}</p>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
            &ldquo;We coordinate every booking from confirmation through
            pickup. Our job is to make sure your driver knows exactly where to
            be, before you land — and to answer the phone if anything about
            that changes.&rdquo;
          </p>
          <p className="text-muted-foreground mt-3 text-xs">
            Coordination {SUPPORT.officeHours} · {SUPPORT.travelDay.toLowerCase()}
          </p>
        </div>

        <div className="bg-card rounded-xl border p-5">
          <p className="text-brand text-xs font-semibold tracking-[0.14em] uppercase">
            Driver network
          </p>
          <p className="mt-1.5 font-semibold">
            Independent Namibian transport partners
          </p>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
            We do not own the cars — we choose the people. Each partner is
            selected, briefed on our standard, and re-checked on the strength
            of the trips they run for us: name-board meet &amp; greet, help
            with luggage, no meter, no detours.
          </p>
          <p className="text-muted-foreground mt-3 text-xs">
            Operating Windhoek · Hosea Kutako · Swakopmund
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Social proof renders only from genuinely published reviews. No sample
 * quotes, no placeholder star counts — an invented review costs more trust
 * than an absent section.
 */
export async function ReviewsSection() {
  const [reviews, summary] = await Promise.all([
    getPublishedReviews(),
    getReviewSummary(),
  ]);
  if (reviews.length === 0 || !summary) return null;

  return (
    <section aria-labelledby="reviews-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="reviews-heading" className="text-xl sm:text-2xl">
          From travellers we have driven
        </h2>
        <p className="flex items-center gap-2 text-sm">
          <span className="text-brand flex" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <StarIcon
                key={i}
                className="size-4"
                fill={i < Math.round(summary.average) ? "currentColor" : "none"}
                strokeWidth={1.5}
              />
            ))}
          </span>
          <span className="tabular font-semibold">
            {summary.average.toFixed(1)}/5
          </span>
          <span className="text-muted-foreground">
            from {summary.count} traveller{summary.count === 1 ? "" : "s"}
          </span>
        </p>
      </div>

      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.slice(0, 6).map((review) => (
          <li key={review.id} className="bg-card rounded-xl border p-4">
            <p
              aria-label={`${review.rating} out of 5 stars`}
              className="text-brand flex"
            >
              {Array.from({ length: 5 }, (_, i) => (
                <StarIcon
                  key={i}
                  className="size-3.5"
                  fill={i < review.rating ? "currentColor" : "none"}
                  strokeWidth={1.5}
                  aria-hidden
                />
              ))}
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

/** Compact rating badge for the hero — absent until reviews are real. */
export async function ReviewBadge() {
  const summary = await getReviewSummary();
  if (!summary) return null;

  return (
    <p className="mt-3 flex items-center gap-2 text-sm">
      <span className="text-brand flex" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <StarIcon
            key={i}
            className="size-4"
            fill={i < Math.round(summary.average) ? "currentColor" : "none"}
            strokeWidth={1.5}
          />
        ))}
      </span>
      <span className="tabular font-semibold">{summary.average.toFixed(1)}/5</span>
      <span className="text-muted-foreground">
        from {summary.count} traveller{summary.count === 1 ? "" : "s"}
      </span>
    </p>
  );
}
