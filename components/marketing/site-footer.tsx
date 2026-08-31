import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Separator } from "@/components/ui/separator";
import { getCompanyInfo, SUPPORT, whatsappLink } from "@/lib/company";
import type { RouteView } from "@/lib/maps";
import { SITE } from "@/lib/site";

export function SiteFooter({ routes = [] }: { routes?: RouteView[] }) {
  const company = getCompanyInfo();

  return (
    <footer className="mt-12 border-t">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <Logo layout="stacked" />
            <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
              {SITE.description}
            </p>
          </div>

          {routes.length > 0 && (
            <nav aria-labelledby="footer-routes" className="space-y-3">
              <p
                id="footer-routes"
                className="text-muted-foreground text-xs font-medium tracking-wider uppercase"
              >
                Transfers
              </p>
              <ul className="space-y-2 text-sm">
                {routes.map((route) => (
                  <li key={route.id}>
                    <Link
                      href={`/transfers/${route.slug}`}
                      className="text-muted-foreground hover:text-foreground transition"
                    >
                      {route.originLabel.replace(
                        " International Airport (WDH)",
                        "",
                      )}{" "}
                      to {route.destinationLabel}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/journey"
                    className="text-muted-foreground hover:text-foreground transition"
                  >
                    Price any other journey
                  </Link>
                </li>
                <li>
                  <Link
                    href="/book"
                    className="text-muted-foreground hover:text-foreground transition"
                  >
                    Book a transfer
                  </Link>
                </li>
              </ul>
            </nav>
          )}

          <nav aria-labelledby="footer-company" className="space-y-3">
            <p
              id="footer-company"
              className="text-muted-foreground text-xs font-medium tracking-wider uppercase"
            >
              Company
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/about"
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  About us
                </Link>
              </li>
              <li>
                <Link
                  href="/corporate"
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  Corporate &amp; groups
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  Booking terms &amp; cancellation
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  Contact &amp; support
                </Link>
              </li>
            </ul>
          </nav>

          <div aria-labelledby="footer-contact" className="space-y-3">
            <p
              id="footer-contact"
              className="text-muted-foreground text-xs font-medium tracking-wider uppercase"
            >
              Support
            </p>
            <ul className="space-y-2 text-sm">
              {company.whatsapp && (
                <li>
                  <a
                    href={whatsappLink(company.whatsapp)}
                    className="text-muted-foreground hover:text-foreground transition"
                  >
                    WhatsApp {company.whatsapp}
                  </a>
                </li>
              )}
              {company.phone && (
                <li>
                  <a
                    href={`tel:${company.phone.replace(/\s/g, "")}`}
                    className="text-muted-foreground hover:text-foreground transition"
                  >
                    {company.phone}
                  </a>
                </li>
              )}
              {company.email && (
                <li>
                  <a
                    href={`mailto:${company.email}`}
                    className="text-muted-foreground hover:text-foreground transition"
                  >
                    {company.email}
                  </a>
                </li>
              )}
              <li className="text-muted-foreground">{company.location}</li>
              <li className="text-muted-foreground text-xs leading-snug">
                Coordination {SUPPORT.officeHoursShort} · travel-day support
                throughout your journey
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-6" />

        <p className="text-muted-foreground text-xs">
          &copy; {new Date().getFullYear()} {SITE.name}
          {company.registration ? ` · ${company.registration}` : ""}. Transfers
          are fulfilled by independent Namibian partner drivers we select and
          brief.
        </p>
      </div>
    </footer>
  );
}
