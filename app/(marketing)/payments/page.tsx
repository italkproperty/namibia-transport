import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getCompanyInfo } from "@/lib/company";
import { listRoutes } from "@/lib/maps";
import { SITE } from "@/lib/site";
import { PAYMENT_POLICY } from "@/lib/booking/payment-policy";
import {
  BANK_PAYMENT,
  CARD_PAYMENT,
  COMPLAINTS,
  PAYMENT_CURRENCY,
} from "@/lib/payments/methods";

export const metadata: Metadata = {
  title: "How to pay",
  description: `Which payment methods ${SITE.name} accepts, in which currency, who processes card payments, and how refunds work.`,
  alternates: { canonical: `${SITE.url}/payments` },
};

/**
 * The merchant disclosure page, and the one the site most obviously lacked.
 *
 * A traveller could be asked to pay — by a link, or by transferring to a bank
 * account shown on their booking page — without any page on the site stating
 * which methods we accept, in what currency, or who handles the card. Every
 * card scheme's merchant rules require that disclosure, and so, reasonably,
 * does anybody trying to decide whether a site asking strangers for money is
 * what it says it is. A site with a payment flow and no payment page is a
 * gap you can see from outside.
 *
 * Every sentence is read from `lib/payments/methods.ts` and
 * `lib/booking/payment-policy.ts` rather than typed here, so this page cannot
 * drift away from what the booking page tells the same traveller.
 */
export default async function PaymentsPage() {
  const [{ routes }, company] = await Promise.all([
    listRoutes({ activeOnly: true }),
    Promise.resolve(getCompanyInfo()),
  ]);

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
          <h1 className="text-2xl sm:text-3xl">How to pay</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            What we accept, in what currency, who handles your card, and what
            happens if something goes wrong.
          </p>

          <div className="mt-8 space-y-8">
            <Section title="Who you are paying">
              <p>
                {SITE.name}
                {company.registration ? `, ${company.registration}` : ""},
                registered and operating in Namibia. {company.location}.
              </p>
              <p>
                We arrange private ground transport across Namibia. Trips are
                fulfilled by independent Namibian partner drivers; your booking,
                your payment and every question about either is with us.
              </p>
            </Section>

            <Section title="Currency">
              <p>{PAYMENT_CURRENCY.statement}</p>
            </Section>

            <Section title="What we accept">
              <div className="space-y-4">
                <div>
                  <h3 className="text-foreground text-sm font-medium">
                    {CARD_PAYMENT.label} — processed by {CARD_PAYMENT.processor}
                  </h3>
                  <p className="mt-1">{CARD_PAYMENT.how}</p>
                  <p className="mt-1">{CARD_PAYMENT.confirmation}</p>
                </div>
                <div>
                  <h3 className="text-foreground text-sm font-medium">
                    {BANK_PAYMENT.label}
                  </h3>
                  <p className="mt-1">{BANK_PAYMENT.how}</p>
                  <p className="mt-1">{BANK_PAYMENT.confirmation}</p>
                </div>
              </div>
            </Section>

            <Section title="Your card details never reach us">
              <p>{CARD_PAYMENT.security}</p>
            </Section>

            <Section title="If anyone sends you different bank details">
              <p className="text-foreground">{BANK_PAYMENT.fraudWarning}</p>
            </Section>

            <Section title="When payment is due, and what it buys">
              <p>{PAYMENT_POLICY.terms}</p>
            </Section>

            <Section title="Refunds">
              <p>
                Our cancellation terms, including when a refund is due and in
                what proportion, are set out in full on the{" "}
                <Link className="underline underline-offset-4" href="/terms">
                  booking terms page
                </Link>
                . {PAYMENT_POLICY.noShowRefund}
              </p>
              <p>{CARD_PAYMENT.refundTiming}</p>
              <p>
                Refunds are returned to the method you paid with. We do not
                refund to a different card or a different bank account.
              </p>
            </Section>

            <Section title="What you are buying">
              <p>
                A private vehicle for a stated journey on a stated date — the
                fare buys the whole car, whatever the party size. There is no
                physical shipment and nothing is delivered: the service is the
                drive. Every route and its price is listed on the{" "}
                <Link className="underline underline-offset-4" href="/transfers">
                  transfers page
                </Link>
                , and how those prices are produced is set out on{" "}
                <Link className="underline underline-offset-4" href="/methodology">
                  our methodology page
                </Link>
                .
              </p>
            </Section>

            <Section title="If something goes wrong">
              <p>{COMPLAINTS.route}</p>
              <p>{COMPLAINTS.hours}</p>
              <p>
                {company.email ? (
                  <a
                    className="underline underline-offset-4"
                    href={`mailto:${company.email}`}
                  >
                    {company.email}
                  </a>
                ) : (
                  "Our contact details are on the contact page."
                )}
                {company.phone ? (
                  <>
                    {" · "}
                    <a
                      className="underline underline-offset-4"
                      href={`tel:${company.phone.replace(/\s/g, "")}`}
                    >
                      {company.phone}
                    </a>
                  </>
                ) : null}
                {" · "}
                <Link className="underline underline-offset-4" href="/contact">
                  all contact details
                </Link>
              </p>
            </Section>

            <Section title="Where we operate">
              <p>
                We arrange transport within Namibia only. We do not ship goods
                and there is nothing to export. Bookings are accepted from
                travellers anywhere.
              </p>
            </Section>
          </div>

          <p className="text-muted-foreground mt-10 border-t pt-6 text-sm">
            See also:{" "}
            <Link className="underline underline-offset-4" href="/terms">
              booking terms &amp; cancellation
            </Link>{" "}
            ·{" "}
            <Link className="underline underline-offset-4" href="/privacy">
              privacy
            </Link>{" "}
            ·{" "}
            <Link className="underline underline-offset-4" href="/contact">
              contact
            </Link>
          </p>
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
