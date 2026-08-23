import Link from "next/link";

import { Separator } from "@/components/ui/separator";
import { SITE } from "@/lib/site";
import type { RouteView } from "@/lib/maps";

export function SiteFooter({ routes = [] }: { routes?: RouteView[] }) {
  return (
    <footer className="border-border/60 mt-24 border-t">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
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
                  href="/#how"
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  How it works
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

        <Separator className="my-10" />

        <p className="text-muted-foreground text-xs">
          &copy; {new Date().getFullYear()} {SITE.name}. Transfers are fulfilled
          by independent licensed Namibian partner drivers.
        </p>
      </div>
    </footer>
  );
}
