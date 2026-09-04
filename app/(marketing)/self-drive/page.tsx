import type { Metadata } from "next";
import Link from "next/link";

import { SelfDrivePlanner } from "@/components/marketing/self-drive-planner";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getCompanyInfo, whatsappLink } from "@/lib/company";
import { listRoutes } from "@/lib/maps";
import { SITE } from "@/lib/site";

/**
 * The page for the question people are actually asking.
 *
 * Almost nobody searches for a transfer. They search for the trip, and the
 * decision inside the trip is whether to drive Namibia themselves — which is
 * a question we can answer with arithmetic rather than opinion, because the
 * road model prices both columns of it. No hire company will do that sum for
 * a visitor, and no tour operator will do it honestly.
 *
 * Which means the page has to be honest, including where it does not suit us.
 * Self-drive genuinely wins on a short tarred trip in a cheap car, and the
 * tool says so when it does. A comparison that always came out our way would
 * be worth nothing to the reader and they would know it within a screen.
 */

const TITLE = "Should you drive Namibia yourself?";

export const metadata: Metadata = {
  title: TITLE,
  description:
    "Work out what a Namibian self-drive really costs — hire, gravel, fuel and the excess you carry — against what it costs to have somebody drive it. Real 2026 rates, your own itinerary.",
  alternates: { canonical: "/self-drive" },
  openGraph: {
    title: TITLE,
    description:
      "The real cost of a Namibian self-drive against a driven trip, on your own itinerary.",
    url: `${SITE.url}/self-drive`,
  },
};

export const revalidate = 3600;

const FAQS = [
  {
    question: "Is a 4x4 necessary in Namibia?",
    answer:
      "For the tarred routes — the B1 north and south, the B2 to Swakopmund — no. For Sossusvlei, Twyfelfontein and the district roads around them, a higher-clearance vehicle is the sensible choice, and it is what we send on those routes. The problem is rarely getting stuck; it is corrugation, stones through a windscreen and a tyre at the wrong moment.",
  },
  {
    question: "What does the rental excess actually mean?",
    answer:
      "A standard waiver caps your liability at an excess, and in Namibia that excess is commonly around N$25,000 even after you buy the extra tyre-and-glass cover. That cover typically pays for two tyres and one windscreen. Underbody damage, a rollover and water damage are usually excluded outright.",
  },
  {
    question: "How far apart is everything, really?",
    answer:
      "Windhoek to Sossusvlei is about 350 km and takes five hours, because 260 km of it is gravel. Sossusvlei to Swakopmund is 373 km and takes nearly six. The distances look ordinary on a map and drive like twice that, which is the single thing first-time visitors underestimate.",
  },
  {
    question: "Do you provide a guide?",
    answer:
      "No. We provide a driver and a vehicle. They know the roads and they handle the driving, the fuel and the tyres; they are not a licensed guide and we do not describe them as one. Lodges run the game drives and the dune trips, and they do it better than a transfer company would.",
  },
  {
    question: "Can I book a multi-day trip online?",
    answer:
      "Not yet. Single transfers book online in about two minutes. A multi-day itinerary is quoted by hand, because dates, lodges and party sizes change the shape of it — send it to us and we come back with a figure against your actual dates.",
  },
];

export default async function SelfDrivePage() {
  const [{ routes }] = await Promise.all([listRoutes({ activeOnly: true })]);
  const company = getCompanyInfo();
  const whatsapp = company.whatsapp ? whatsappLink(company.whatsapp) : null;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
          <h1 className="text-3xl sm:text-4xl">{TITLE}</h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-base sm:text-lg">
            Most people planning Namibia are not choosing a transfer company.
            They are deciding whether to hire a 4&times;4 and drive 2,700
            kilometres of it themselves. Here is that sum, on your own
            itinerary, with the numbers both ways.
          </p>

          <div className="mt-8">
            <SelfDrivePlanner whatsappHref={whatsapp} />
          </div>

          {/* ------------------------------------------------ honest framing */}
          <section className="mt-14 grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-lg font-semibold">When self-drive wins</h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                On a short trip, on tar, in an ordinary hire car, in low season,
                driving yourself is cheaper and the tool above will tell you so.
                It also buys something we cannot sell you: stopping where you
                like, for as long as you like, without anyone waiting. If that
                is the trip you want, take it &mdash; and book us for the airport
                run at either end, which is the leg nobody enjoys driving after
                a long-haul flight.
              </p>
            </div>
            <div>
              <h2 className="text-lg font-semibold">When it does not</h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                In high season a camping 4&times;4 is roughly half again what it
                costs the rest of the year, and that is the same four months
                everybody comes. Add the gravel, the excess you carry on it, and
                the fact that somebody in the party spends the holiday driving
                rather than looking out of the window. That is where the two
                columns cross, and on a nine-day circuit in July they cross
                decisively.
              </p>
            </div>
          </section>

          {/* --------------------------------------- the three underestimates */}
          <section className="mt-12">
            <h2 className="text-xl">Three things the map does not tell you</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                {
                  head: "Gravel is most of it",
                  body: "Namibia has about 5,000 km of tar and roughly 40,000 km of gravel. Every itinerary worth doing spends most of its distance on the second kind, at 60 to 70 km/h rather than 120.",
                },
                {
                  head: "The excess is the real cost",
                  body: "Tyre and glass cover runs around N$290 a day and still leaves about N$25,000 on you. A stone through a windscreen on the C19 is an ordinary event, not bad luck.",
                },
                {
                  head: "Distances drive like double",
                  body: "350 km to Sossusvlei is five hours. 373 km from there to the coast is nearly six. Plan a Namibian day by hours, never by kilometres.",
                },
              ].map((card) => (
                <div key={card.head} className="bg-card rounded-xl border p-4">
                  <h3 className="text-sm font-semibold">{card.head}</h3>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ------------------------------------------------------ the FAQs */}
          <section className="mt-12">
            <h2 className="text-xl">Questions people ask before they decide</h2>
            <dl className="mt-4 divide-y border-t">
              {FAQS.map((faq) => (
                <div key={faq.question} className="py-4">
                  <dt className="font-medium">{faq.question}</dt>
                  <dd className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* --------------------------------------------------- where next */}
          <section className="mt-12 border-t pt-8">
            <p className="text-muted-foreground text-sm leading-relaxed">
              Only need one leg?{" "}
              <Link href="/transfers" className="text-foreground underline underline-offset-4">
                Every route we run, with the price on it
              </Link>
              , or{" "}
              <Link href="/journey" className="text-foreground underline underline-offset-4">
                price any journey in Namibia
              </Link>{" "}
              between two places.
            </p>
            <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
              Hire figures are quoted 2026 rates from Windhoek operators and
              aggregator averages, checked in September 2026, and are yours to
              overwrite with the quote you have been given. Our figure is
              computed from the road &mdash; its length, its surface, and the
              days a driver is away &mdash; and is confirmed against your dates
              before anything is paid.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter routes={routes} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </div>
  );
}
