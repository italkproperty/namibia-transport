import type { Metadata } from "next";
import { BuildingIcon, ClockIcon, ReceiptTextIcon, UsersIcon } from "lucide-react";

import { CorporateEnquiryForm } from "@/components/corporate/enquiry-form";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { listRoutes } from "@/lib/maps";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Corporate & group transport",
  description:
    "Corporate and group ground transport in Namibia — airport transfers for visiting teams, conferences, site and employee transport. Monthly billing, vetted drivers.",
  alternates: { canonical: `${SITE.url}/corporate` },
  openGraph: {
    type: "website",
    url: `${SITE.url}/corporate`,
    title: `Corporate & group transport | ${SITE.name}`,
    description:
      "Airport transfers for visiting teams, conferences, site and employee transport across Namibia.",
    siteName: SITE.name,
  },
};

const POINTS = [
  {
    icon: UsersIcon,
    title: "Visiting teams",
    body: "Airport pickups for staff and clients, coordinated arrival by arrival.",
  },
  {
    icon: BuildingIcon,
    title: "Conferences & events",
    body: "Delegate movement between airport, hotels and the venue.",
  },
  {
    icon: ClockIcon,
    title: "Employee & site transport",
    body: "Recurring runs on a fixed schedule, priced per vehicle.",
  },
  {
    icon: ReceiptTextIcon,
    title: "One monthly invoice",
    body: "Consolidated billing instead of a receipt per trip.",
  },
];

export default async function CorporatePage() {
  const { routes } = await listRoutes({ activeOnly: true });

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          <h1 className="text-2xl sm:text-3xl">
            Corporate &amp; group transport
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-pretty">
            Airport transfers for visiting teams, conferences, site and employee
            transport — across Namibia, on one account.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
            {/* The form is the point of the page, so it leads on desktop. */}
            <div className="bg-card order-2 rounded-xl border p-4 sm:p-5 lg:order-1">
              <h2 className="text-base font-semibold">Request a quotation</h2>
              <p className="text-muted-foreground mt-1 mb-4 text-sm">
                Tell us roughly what you need. No account setup required.
              </p>
              <CorporateEnquiryForm />
            </div>

            <aside className="order-1 lg:order-2">
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {POINTS.map((point) => (
                  <li
                    key={point.title}
                    className="bg-card flex gap-3 rounded-xl border p-4"
                  >
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
            </aside>
          </div>
        </div>
      </main>

      <SiteFooter routes={routes} />
    </div>
  );
}
