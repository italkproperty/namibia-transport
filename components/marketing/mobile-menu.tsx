"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, MessageCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  NAV_GUIDES,
  NAV_LINKS,
  type NavRoute,
} from "@/components/marketing/nav-data";

/**
 * The small-screen menu.
 *
 * Previously "About" simply disappeared below 640px, which is hiding rather
 * than adapting. Everything the desktop header offers is here, prices
 * included, because a phone is where most of this traffic arrives.
 */
export function MobileMenu({
  routes,
  whatsappHref,
}: {
  routes: NavRoute[];
  whatsappHref: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Navigating should close it; App Router keeps the component mounted.
  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="press sm:hidden"
          aria-label="Open menu"
        >
          <MenuIcon className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[19rem] overflow-y-auto p-0">
        <SheetTitle className="sr-only">Menu</SheetTitle>

        <nav aria-label="Mobile" className="p-4 pt-14">
          <p className="text-muted-foreground px-1 pb-2 text-[0.7rem] font-medium tracking-wide uppercase">
            Transfers
          </p>
          <ul className="grid gap-0.5">
            {routes.map((route) => (
              <li key={route.slug}>
                <Link
                  href={`/transfers/${route.slug}`}
                  className="hover:bg-muted flex items-baseline justify-between gap-3 rounded-lg px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm">
                      {route.from} → {route.to}
                    </span>
                    {route.duration && (
                      <span className="text-muted-foreground text-xs">
                        {route.duration}
                      </span>
                    )}
                  </span>
                  <span className="tabular text-brand shrink-0 text-sm font-semibold">
                    {route.price}
                  </span>
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/transfers"
                className="text-muted-foreground hover:text-foreground block px-3 py-2 text-sm underline underline-offset-2"
              >
                Every route and price
              </Link>
            </li>
          </ul>

          <p className="text-muted-foreground px-1 pt-5 pb-2 text-[0.7rem] font-medium tracking-wide uppercase">
            Planning your arrival
          </p>
          <ul className="grid gap-0.5">
            {NAV_GUIDES.map((guide) => (
              <li key={guide.href}>
                <Link
                  href={guide.href}
                  className="hover:bg-muted block rounded-lg px-3 py-2 text-sm leading-snug"
                >
                  {guide.label}
                </Link>
              </li>
            ))}
          </ul>

          <ul className="mt-5 grid gap-0.5 border-t pt-4">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="hover:bg-muted block rounded-lg px-3 py-2.5 text-sm font-medium"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-5 grid gap-2">
            <Button asChild className="press w-full">
              <Link href="/#quote">Book a transfer</Link>
            </Button>
            {whatsappHref && (
              <Button asChild variant="outline" className="press w-full">
                <a href={whatsappHref}>
                  <MessageCircleIcon className="size-4" aria-hidden />
                  WhatsApp us
                </a>
              </Button>
            )}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
