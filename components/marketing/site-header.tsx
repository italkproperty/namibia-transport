import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { MobileMenu } from "@/components/marketing/mobile-menu";
import { NAV_LINKS, type NavRoute } from "@/components/marketing/nav-data";
import { NavLink } from "@/components/marketing/nav-link";
import { RouteMenu } from "@/components/marketing/route-menu";
import { Button } from "@/components/ui/button";
import { getCompanyInfo, whatsappLink } from "@/lib/company";
import { formatDuration, shortPlace } from "@/lib/format";
import { listRoutes } from "@/lib/maps";
import { formatNad } from "@/lib/money";
import { pricingUnitLabel } from "@/lib/pricing";
import { SITE } from "@/lib/site";

/**
 * Site chrome.
 *
 * The header carries the routes and their prices rather than a bare
 * "Transfers" link, because the question every visitor arrives with is what a
 * transfer costs — answering it in the menu is cheaper than a click. It also
 * carries a booking CTA: a transfers business whose header cannot be used to
 * start a booking is a brochure.
 */
export async function SiteHeader() {
  const { routes } = await listRoutes({ activeOnly: true });
  const company = getCompanyInfo();

  const navRoutes: NavRoute[] = routes.map((route) => ({
    slug: route.slug,
    from: shortPlace(route.originLabel),
    to: route.destinationLabel,
    price: formatNad(route.fixedPrice),
    unit: pricingUnitLabel(route),
    duration: formatDuration(route.durationMin),
    category: route.category,
  }));

  const whatsappHref = company.whatsapp
    ? whatsappLink(company.whatsapp, "Hi — I would like to book a transfer.")
    : null;

  return (
    <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          aria-label={SITE.name}
          className="focus-visible:ring-ring shrink-0 rounded-sm focus-visible:ring-[3px] focus-visible:outline-none"
        >
          <Logo />
        </Link>

        <nav
          aria-label="Main"
          className="ml-auto hidden items-center gap-6 sm:flex"
        >
          {navRoutes.length > 0 && <RouteMenu routes={navRoutes} />}
          {NAV_LINKS.map((link) => (
            <NavLink key={link.href} href={link.href}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <Button asChild size="sm" className="press hidden sm:inline-flex">
            <Link href="/#quote">Book</Link>
          </Button>
          <MobileMenu routes={navRoutes} whatsappHref={whatsappHref} />
        </div>
      </div>
    </header>
  );
}
