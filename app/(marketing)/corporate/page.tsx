import type { Metadata } from "next";
import {
  BuildingIcon,
  ClockIcon,
  FileTextIcon,
  ReceiptTextIcon,
  UsersIcon,
} from "lucide-react";

import { CorporateQuoteForm } from "@/components/corporate/quote-form";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { SupportStrip } from "@/components/marketing/trust";
import { getVatRate } from "@/lib/company";
import { listRoutes, listVehicleClasses } from "@/lib/maps";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Corporate & group transport",
  description:
    "Corporate ground transport in Namibia — airport transfers for visiting teams, conferences, executive, site and employee transport. Itemised quotation in about a minute, one monthly invoice.",
  alternates: { canonical: `${SITE.url}/corporate` },
  openGraph: {
    type: "website",
    url: `${SITE.url}/corporate`,
    title: `Corporate & group transport | ${SITE.name}`,
    description:
      "Airport transfers for visiting teams, conferences, executive, site and employee transport across Namibia.",
    siteName: SITE.name,
  },
};

const POINTS = [
  {
    icon: FileTextIcon,
    title: "Itemised quotation, instantly",
    body: "Route pricing calculated on the spot; a quote number you can circulate internally.",
  },
  {
    icon: UsersIcon,
    title: "Teams, delegates, crews",
    body: "Visiting teams, conference delegates, executives and site rotations.",
  },
  {
    icon: ClockIcon,
    title: "Recurring schedules",
    body: "Daily and weekly runs priced across the whole engagement, not per ad-hoc trip.",
  },
  {
    icon: ReceiptTextIcon,
    title: "One monthly invoice",
    body: "Consolidated billing on account instead of a receipt per trip.",
  },
];

export default async function CorporatePage() {
  const [{ routes }, vehicleClasses] = await Promise.all([
    listRoutes({ activeOnly: true }),
    listVehicleClasses(),
  ]);
  const vatRate = getVatRate();

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex items-start gap-3">
            <BuildingIcon
              className="text-brand mt-1 size-6 shrink-0"
              strokeWidth={1.75}
              aria-hidden
            />
            <div>
              <h1 className="text-2xl sm:text-3xl">
                Corporate &amp; group transport
              </h1>
              <p className="text-muted-foreground mt-1.5 max-w-2xl text-pretty">
                Get an itemised quotation in about a minute — no phone call, no
                waiting for a spreadsheet. Our team follows up within 24 hours
                on WhatsApp or email.
              </p>
            </div>
          </div>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {POINTS.map((point) => (
              <li key={point.title} className="bg-card flex gap-3 rounded-xl border p-4">
                <point.icon
                  className="text-brand mt-0.5 size-5 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <div>
                  <p className="text-sm font-medium">{point.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-sm leading-snug">
                    {point.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            {routes.length > 0 && vehicleClasses.length > 0 ? (
              <CorporateQuoteForm
                routes={routes}
                vehicleClasses={vehicleClasses}
                vatRate={vatRate}
              />
            ) : (
              <div className="bg-card rounded-xl border p-6 text-center">
                <p className="font-medium">Quotations are not open yet</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  No routes are published. Please check back shortly.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
          <SupportStrip />
        </div>
      </main>

      <SiteFooter routes={routes} />
    </div>
  );
}
