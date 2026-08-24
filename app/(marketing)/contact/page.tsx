import type { Metadata } from "next";
import Link from "next/link";
import {
  ClockIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
} from "lucide-react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getCompanyInfo, whatsappLink } from "@/lib/company";
import { listRoutes } from "@/lib/maps";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact & support",
  description: `Reach the ${SITE.name} operations team — WhatsApp first, before, during and after your trip.`,
  alternates: { canonical: `${SITE.url}/contact` },
};

export default async function ContactPage() {
  const [{ routes }, company] = await Promise.all([
    listRoutes({ activeOnly: true }),
    Promise.resolve(getCompanyInfo()),
  ]);

  const channels = [
    company.whatsapp && {
      icon: MessageCircleIcon,
      label: "WhatsApp — fastest",
      value: company.whatsapp,
      href: whatsappLink(company.whatsapp, "Hi — I have a question about a transfer."),
      note: "Booking changes, travel-day questions, quotes. A person answers.",
    },
    company.phone && {
      icon: PhoneIcon,
      label: "Phone",
      value: company.phone,
      href: `tel:${company.phone.replace(/\s/g, "")}`,
      note: "For anything urgent on the day of travel.",
    },
    company.email && {
      icon: MailIcon,
      label: "Email",
      value: company.email,
      href: `mailto:${company.email}`,
      note: "Corporate accounts, invoices and anything not time-critical.",
    },
  ].filter(Boolean) as Array<{
    icon: typeof MailIcon;
    label: string;
    value: string;
    href: string;
    note: string;
  }>;

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
          <h1 className="text-2xl sm:text-3xl">Contact &amp; support</h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-pretty">
            One operations team handles every booking from confirmation to
            drop-off. Quote your booking reference (NT-XXXXXX) and we can see
            your whole trip immediately.
          </p>

          {channels.length > 0 ? (
            <ul className="mt-7 space-y-3">
              {channels.map((channel) => (
                <li key={channel.label}>
                  <a
                    href={channel.href}
                    className="press bg-card hover:border-foreground/25 flex items-start gap-4 rounded-xl border p-4"
                  >
                    <channel.icon
                      className="text-brand mt-0.5 size-5 shrink-0"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {channel.label}
                      </span>
                      <span className="text-brand block text-base font-semibold">
                        {channel.value}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block text-sm leading-snug">
                        {channel.note}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-7 rounded-xl border border-dashed p-6">
              <p className="text-sm font-medium">
                Contact lines are being connected
              </p>
              <p className="text-muted-foreground mt-1 text-sm leading-snug">
                Our WhatsApp and phone numbers are published here the moment
                they go live. Bookings made meanwhile are confirmed to the
                WhatsApp number you give us when booking.
              </p>
            </div>
          )}

          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <ClockIcon className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <dt className="text-sm font-medium">Hours</dt>
                <dd className="text-muted-foreground text-sm leading-snug">
                  {company.hours}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPinIcon className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <dt className="text-sm font-medium">Based in</dt>
                <dd className="text-muted-foreground text-sm leading-snug">
                  {company.location}
                  {company.registration ? ` · ${company.registration}` : ""}
                </dd>
              </div>
            </div>
          </dl>

          <p className="text-muted-foreground mt-8 text-sm">
            Looking for prices? Every route is quoted live on the{" "}
            <Link href="/" className="underline underline-offset-2">
              home page
            </Link>
            , and corporate quotations are itemised instantly on the{" "}
            <Link href="/corporate" className="underline underline-offset-2">
              corporate page
            </Link>
            .
          </p>
        </div>
      </main>

      <SiteFooter routes={routes} />
    </div>
  );
}
