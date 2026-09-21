import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Button } from "@/components/ui/button";
import { getCompanyInfo, SUPPORT, whatsappLink } from "@/lib/company";

/**
 * There was no 404 page at all, so a wrong URL landed on Next's default:
 * black text on white, no header, no way back. That is a bad page anywhere,
 * and on this site it is most likely to be hit by someone holding a booking
 * link — a reference typed by hand off a WhatsApp message, or a link broken
 * by an email client wrapping it. So the recovery comes first and the apology
 * does not appear at all.
 *
 * `lostLink` is for the case where we know that is what happened: the URL was
 * shaped like a booking and there is no such booking. Then the heading says so
 * rather than making a traveller work out that "nothing at this address" means
 * their trip.
 */
export function NotFoundPage({ lostLink = false }: { lostLink?: boolean }) {
  const company = getCompanyInfo();

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-muted-foreground font-mono text-[0.7rem] tracking-[0.16em] uppercase">
            Not found
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-pretty sm:text-4xl">
            {lostLink
              ? "We cannot find that booking."
              : "There is nothing at this address."}
          </h1>

          {/* The likeliest visitor here is someone whose booking link did not
              survive being copied. Say what to do about it before anything
              else — a reference is enough for us to find the trip. */}
          <div className="border-brand bg-card mt-8 border-l-2 py-1 pl-5">
            <h2 className="font-medium">
              {lostLink ? "Send us the reference" : "Looking for your booking?"}
            </h2>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed text-pretty">
              A booking link ends in a reference like{" "}
              <span className="text-foreground font-mono">NT-K4M2XP</span>, and
              a trip quoted as several legs ends in one like{" "}
              <span className="text-foreground font-mono">NT-G-8QW3RD</span>.
              Quote either to us and we can see your trip, your driver and your
              flight.
            </p>

            {company.whatsapp ? (
              <Button asChild className="press mt-4 h-11">
                <a
                  href={whatsappLink(
                    company.whatsapp,
                    "Hi — I cannot open my booking link. My reference is ",
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Send us your reference on WhatsApp
                  <ArrowRightIcon className="size-4" aria-hidden />
                </a>
              </Button>
            ) : company.email ? (
              <Button asChild className="press mt-4 h-11">
                <a href={`mailto:${company.email}?subject=My booking reference`}>
                  Email us your reference
                  <ArrowRightIcon className="size-4" aria-hidden />
                </a>
              </Button>
            ) : null}

            {company.hasContactChannel && (
              <p className="text-muted-foreground mt-3 text-xs">
                {SUPPORT.officeHours}.
              </p>
            )}
          </div>

          <nav aria-label="Elsewhere on the site" className="mt-10">
            <h2 className="text-muted-foreground font-mono text-[0.7rem] tracking-[0.16em] uppercase">
              Or start again
            </h2>
            <ul className="mt-1 divide-y border-t border-b">
              {[
                {
                  href: "/",
                  title: "Price an airport transfer",
                  blurb: "Fixed per vehicle, both ways.",
                },
                {
                  href: "/journey",
                  title: "Any two places in Namibia",
                  blurb: "Priced from the road, not from a price list.",
                },
                {
                  href: "/self-drive",
                  title: "Should you drive it yourself?",
                  blurb: "The real cost of a hire car against a driven trip.",
                },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="hover:bg-card focus-ring group -mx-3 flex items-baseline gap-x-5 gap-y-1 rounded-md px-3 py-4 transition-colors max-sm:flex-col sm:items-center"
                  >
                    <span className="text-base font-medium sm:w-64 sm:shrink-0">
                      {item.title}
                    </span>
                    <span className="text-muted-foreground min-w-0 flex-1 text-sm leading-snug">
                      {item.blurb}
                    </span>
                    <ArrowRightIcon
                      className="text-muted-foreground group-hover:text-brand size-4 shrink-0 transition-transform group-hover:translate-x-0.5 max-sm:hidden"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
