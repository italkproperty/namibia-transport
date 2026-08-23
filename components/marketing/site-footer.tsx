import Link from "next/link";

import { Separator } from "@/components/ui/separator";
import { SITE } from "@/lib/site";
import type { RouteView } from "@/lib/maps";

export function SiteFooter({ routes = [] }: { routes?: RouteView[] }) {
  return (
    <footer className="mt-12 border-t">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-3">
            <p className="font-semibold tracking-tight">{SITE.name}</p>
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
                        ""
                      )}{" "}
                      to {route.destinationLabel}
                    </Link>
                  </li>
                ))}
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
                  href="/corporate"
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  Corporate &amp; groups
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
        </div>

        <Separator className="my-6" />

        <p className="text-muted-foreground text-xs">
          &copy; {new Date().getFullYear()} {SITE.name}. Transfers are fulfilled
          by vetted independent Namibian partner drivers.
        </p>
      </div>
    </footer>
  );
}
