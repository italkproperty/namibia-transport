import Link from "next/link";
import {
  BadgeCheckIcon,
  CarFrontIcon,
  HandshakeIcon,
  PlaneLandingIcon,
} from "lucide-react";

import { RouteCard } from "@/components/marketing/route-card";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Button } from "@/components/ui/button";
import { listRoutes } from "@/lib/maps";
import { INCLUSIONS } from "@/lib/site";

const VALUE_STRIP = [
  "Fixed prices",
  "Meet & greet",
  "Flight monitoring",
  "Licensed local drivers",
  "24/7 support",
];

const STEPS = [
  {
    icon: CarFrontIcon,
    title: "Book in a minute",
    body: "Pick your route, date and vehicle. You see the full price before you commit — nothing is estimated.",
  },
  {
    icon: BadgeCheckIcon,
    title: "We assign a vetted driver",
    body: "A licensed Namibian partner driver is matched to your trip and confirmed to you on WhatsApp.",
  },
  {
    icon: PlaneLandingIcon,
    title: "They meet you on arrival",
    body: "We watch your flight. Your driver is inside the terminal with a name board, however late you land.",
  },
  {
    icon: HandshakeIcon,
    title: "Straight to your door",
    body: "A direct, private drive to your hotel, lodge or office. No detours, no other passengers.",
  },
];

export default async function HomePage() {
  const { routes } = await listRoutes({ activeOnly: true });

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        {/* ------------------------------------------------------------ hero */}
        <section className="relative overflow-hidden">
          {/* A single warm wash, sitting behind the type rather than on it. */}
          <div
            aria-hidden
            className="from-accent/50 pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem] bg-gradient-to-b via-transparent to-transparent"
          />

          <div className="mx-auto max-w-6xl px-5 pt-20 pb-16 sm:px-8 sm:pt-28 sm:pb-24">
            <p className="text-muted-foreground animate-rise text-sm tracking-wide">
              Namibia · door to door
            </p>

            <h1
              className="animate-rise mt-5 max-w-4xl text-[2.75rem] leading-[1.06] text-balance sm:text-6xl lg:text-7xl"
              style={{ animationDelay: "60ms" }}
            >
              Someone is waiting when you land.
            </h1>

            <p
              className="text-muted-foreground animate-rise mt-7 max-w-xl text-lg leading-relaxed text-pretty"
              style={{ animationDelay: "120ms" }}
            >
              Private, fixed-price transfers across Namibia — from the airport
              into Windhoek, or all the way to the coast. Booked online, driven
              by licensed locals.
            </p>

            <div
              className="animate-rise mt-10 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "180ms" }}
            >
              <Button asChild size="xl">
                <Link href="/book">Book a transfer</Link>
              </Button>
              <Button asChild size="xl" variant="outline">
                <Link href="#routes">See routes &amp; prices</Link>
              </Button>
            </div>
          </div>

          {/* ---------------------------------------------------- value strip */}
          <div className="border-border/60 border-y">
            <div className="mx-auto max-w-6xl px-5 sm:px-8">
              <ul className="divide-border/60 grid grid-cols-2 divide-y sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
                {VALUE_STRIP.map((item) => (
                  <li
                    key={item}
                    className="text-muted-foreground px-1 py-4 text-sm lg:px-5 lg:text-center"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- routes */}
        <section
          id="routes"
          aria-labelledby="routes-heading"
          className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2
                id="routes-heading"
                className="text-3xl sm:text-4xl"
              >
                Popular routes
              </h2>
              <p className="text-muted-foreground mt-3 max-w-md text-pretty">
                Every price is for the whole vehicle, not per seat, and is fixed
                at the moment you book.
              </p>
            </div>
          </div>

          {routes.length > 0 ? (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {routes.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          ) : (
            <p className="border-border text-muted-foreground mt-10 rounded-2xl border border-dashed p-10 text-center">
              No routes are published yet.
            </p>
          )}
        </section>

        {/* ------------------------------------------------------ how it works */}
        <section
          id="how"
          aria-labelledby="how-heading"
          className="border-border/60 scroll-mt-20 border-y"
        >
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <h2 id="how-heading" className="text-3xl sm:text-4xl">
              How it works
            </h2>

            <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <step.icon
                    className="text-brand size-6"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <p className="text-muted-foreground mt-5 text-xs tracking-wider">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-2 font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------- inclusions */}
        <section
          aria-labelledby="included-heading"
          className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28"
        >
          <div className="grid gap-12 lg:grid-cols-[minmax(0,22rem)_1fr]">
            <div>
              <h2
                id="included-heading"
                className="text-3xl sm:text-4xl text-balance"
              >
                What every transfer includes
              </h2>
              <p className="text-muted-foreground mt-4 text-pretty">
                The same standard on a 45-minute airport run and a four-hour
                drive to the coast.
              </p>
            </div>

            <dl className="divide-border/60 divide-y">
              {INCLUSIONS.map((item) => (
                <div key={item.title} className="grid gap-1 py-5 sm:grid-cols-3">
                  <dt className="font-medium tracking-tight">{item.title}</dt>
                  <dd className="text-muted-foreground text-sm leading-relaxed sm:col-span-2">
                    {item.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* -------------------------------------------------------------- cta */}
        <section className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
          <div className="bg-primary text-primary-foreground rounded-3xl px-8 py-14 sm:px-14 sm:py-20">
            <h2 className="max-w-2xl text-3xl text-balance sm:text-4xl">
              Tell us when you land. We will take it from there.
            </h2>
            <p className="text-primary-foreground/70 mt-4 max-w-lg text-pretty">
              Book now and pay later — your fare is locked in the moment you
              confirm.
            </p>
            <Button asChild size="xl" variant="secondary" className="mt-9">
              <Link href="/book">Book a transfer</Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter routes={routes} />
    </div>
  );
}
