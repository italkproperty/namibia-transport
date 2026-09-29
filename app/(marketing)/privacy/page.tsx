import type { Metadata } from "next";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getCompanyInfo } from "@/lib/company";
import { listRoutes } from "@/lib/maps";
import { SITE } from "@/lib/site";
import { QUOTE_VALID_DAYS } from "@/lib/booking/validity";

export const metadata: Metadata = {
  title: "Privacy",
  description: `What ${SITE.name} collects when you book a transfer, why, who else sees it, and how to have it removed.`,
  alternates: { canonical: `${SITE.url}/privacy` },
};

/**
 * What we collect, written from the schema rather than from a template.
 *
 * This page was missing, and its absence was not only a courtesy problem. A
 * site that asks for a traveller's name and contact details, then shows bank
 * account numbers and asks them to transfer money, and carries no privacy
 * policy, no registered company number and no street address, has the exact
 * profile of a payment-redirection fraud page — which is what an automated
 * safety classifier sees, whatever the business behind it actually is.
 *
 * So every claim here is checked against `db/schema.ts` and the code that
 * writes to it. A privacy policy describing collection we do not do would be
 * worse than none: it is the one page whose whole value is that it is
 * verifiably true.
 */
export default async function PrivacyPage() {
  const [{ routes }, company] = await Promise.all([
    listRoutes({ activeOnly: true }),
    Promise.resolve(getCompanyInfo()),
  ]);

  const contact = company.email ?? "the address on our contact page";

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
          <h1 className="text-2xl sm:text-3xl">Privacy</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            What we collect, why, who else sees it, and how to have it removed.
            Written from the database, not from a template.
          </p>

          <div className="mt-8 space-y-8">
            <Section title="Who we are">
              <p>
                {SITE.name}
                {company.registration ? ` (${company.registration})` : ""},{" "}
                {company.location}. We arrange private ground transport across
                Namibia. Trips are fulfilled by independent Namibian partner
                drivers; your booking and every question about it is with us.
              </p>
              <p>
                For anything on this page, write to{" "}
                {company.email ? (
                  <a className="underline underline-offset-4" href={`mailto:${company.email}`}>
                    {company.email}
                  </a>
                ) : (
                  contact
                )}
                .
              </p>
            </Section>

            <Section title="What we collect when you book">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Your name</strong>, and{" "}
                  <strong>one contact channel</strong> — a WhatsApp number or an
                  email address. One is required so we can reach you about the
                  trip; you choose which.
                </li>
                <li>
                  <strong>The trip:</strong> pickup and drop-off, date and time,
                  number of passengers and pieces of luggage, and the vehicle
                  class.
                </li>
                <li>
                  <strong>Your flight number</strong>, if you give it, so the
                  pickup follows your actual landing time.
                </li>
                <li>
                  <strong>Anything you type into the notes</strong> — a landmark,
                  a lodge name, oversized luggage, mobility needs.
                </li>
                <li>
                  <strong>A dropped pin</strong>, if you place one. Stored
                  rounded to about 11 centimetres, which is past anything a
                  driver can act on — we do not keep a more precise position
                  than the input actually has.
                </li>
                <li>
                  <strong>How you found us:</strong> the referring website, or
                  the campaign tag and advertising click identifier from the
                  link you arrived on.
                </li>
              </ul>
              <p>
                We do not ask for a date of birth, an identity number, a
                passport number or a home address, and we have nowhere to put
                them.
              </p>
            </Section>

            <Section title="Card details: we never see them">
              <p>
                No card number, expiry or security code is ever entered on this
                site or stored by us. Card payments happen on the payment
                provider&rsquo;s own page. What we keep is the fact of a payment:
                the amount, the currency, the provider and whether it succeeded.
              </p>
              <p>
                If you pay by bank transfer, we see what your bank shows on our
                statement — your reference and the amount. Our bank details are
                shown only on your own booking page and they never change. We
                will never message you to say they have.
              </p>
            </Section>

            <Section title="Why we keep it">
              <p>
                To quote you a price, to run the trip, to tell the driver where
                and when to be, to reconcile payment, and to answer you when you
                quote your booking reference. We also count how many bookings
                came from which channel, so we know where to spend.
              </p>
              <p>
                We do not sell personal information, and we do not share it for
                anyone else&rsquo;s marketing.
              </p>
            </Section>

            <Section title="Who else sees it">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Your driver</strong> — your name, pickup, drop-off,
                  time, flight number and any note meant for them. Not your
                  fare, and not your payment details.
                </li>
                <li>
                  <strong>Our hosting and database providers</strong>, who store
                  the data on our behalf and do not use it for anything else.
                </li>
                <li>
                  <strong>The payment provider</strong>, when you pay by card.
                </li>
                <li>
                  <strong>Our email and messaging providers</strong>, to deliver
                  your confirmation.
                </li>
                <li>
                  <strong>Mapbox</strong>, when a map or a route is drawn.
                </li>
                <li>
                  <strong>Google</strong>, where you arrived from one of our
                  advertisements: the click identifier, so we can tell which
                  advertising produced a booking. Not your name, not your
                  contact details and not your itinerary.
                </li>
              </ul>
            </Section>

            <Section title="Cookies, and the one we do not set">
              <p>
                This site sets no advertising or analytics cookie. Our
                visitor counts are aggregate and store no identifier. Our
                advertising tag runs with every consent signal denied by
                default, so it does not store an advertising identifier in your
                browser.
              </p>
              <p>
                We keep one thing in your browser while your tab is open: the
                campaign tag from the link you arrived on, so a booking can be
                credited to the right advertisement. It is cleared when you
                close the tab and is never read by anyone but this site.
              </p>
              <p>
                One cookie exists for our own staff signing in to the operations
                area. It is not set for travellers.
              </p>
            </Section>

            <Section title="How long we keep it">
              <p>
                An unpaid quote expires {QUOTE_VALID_DAYS} days after it was
                given, or when its travel date passes, whichever comes first.
                Completed bookings are kept as business and accounting records.
                Ask us to delete anything that is not one, and we will.
              </p>
            </Section>

            <Section title="Your choices">
              <p>
                Write to us and we will tell you what we hold about you, correct
                anything wrong, or delete it where we are not required to keep
                it as a financial record. Tell us to stop messaging you and we
                will — except about a trip you have actually booked, where we
                have to be able to reach you.
              </p>
            </Section>

            <Section title="Changes to this page">
              <p>
                When this changes, it changes here. If a change affects what we
                collect or who sees it, we will say so rather than quietly
                editing the page.
              </p>
            </Section>
          </div>
        </div>
      </main>

      <SiteFooter routes={routes} />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="text-muted-foreground mt-2 space-y-2 text-sm leading-relaxed text-pretty">
        {children}
      </div>
    </section>
  );
}
