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
  ARRIVAL_GUIDES,
  DECISION_GUIDES,
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
          className="press focus-ring size-11 sm:size-10 lg:hidden"
          aria-label="Open menu"
        >
          <MenuIcon className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[19rem] overflow-y-auto p-0">
        <SheetTitle className="sr-only">Menu</SheetTitle>

        <nav aria-label="Mobile" className="p-4 pt-14">
          {/* Actions first. They were below twenty-five links, at the bottom
              of a scroll, on the surface most likely to be opened by someone
              standing in an arrivals hall. */}
          <div className="grid gap-2 pb-5">
            <Button asChild className="press focus-ring w-full">
              <Link href="/#quote" onClick={() => setOpen(false)}>
                Get a price
              </Link>
            </Button>
            {whatsappHref && (
              <Button asChild variant="outline" className="press focus-ring w-full">
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircleIcon className="size-4" aria-hidden />
                  WhatsApp us
                </a>
              </Button>
            )}
          </div>

          <p className="text-muted-foreground px-1 pb-2 text-xs font-semibold tracking-[0.08em] uppercase">
            Transfers
          </p>
          <ul className="grid gap-0.5">
            {routes.map((route) => (
              <li key={route.slug} className="min-w-0">
                <Link
                  href={`/transfers/${route.slug}`}
                  className="hover:bg-muted focus-ring flex items-start justify-between gap-3 rounded-lg px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug">
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
                className="text-muted-foreground hover:text-foreground focus-ring block rounded-lg px-3 py-2 text-sm underline underline-offset-2"
              >
                Every route and price
              </Link>
            </li>
          </ul>

          <GuideGroup title="Arriving in Namibia" items={ARRIVAL_GUIDES} />
          <GuideGroup
            title="Self-drive or be driven"
            items={[
              { href: "/self-drive", label: "Compare the real cost" },
              ...DECISION_GUIDES,
            ]}
          />
          <GuideGroup
            title="Our numbers"
            items={[
              { href: "/methodology", label: "How we compute our numbers" },
            ]}
          />

          <ul className="mt-5 grid gap-0.5 border-t pt-4">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="hover:bg-muted focus-ring block rounded-lg px-3 py-2.5 text-sm font-medium"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

        </nav>
      </SheetContent>
    </Sheet>
  );
}

function GuideGroup({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string }[];
}) {
  if (items.length === 0) return null;

  return (
    <>
      <p className="text-muted-foreground px-1 pt-5 pb-2 text-xs font-semibold tracking-[0.08em] uppercase">
        {title}
      </p>
      <ul className="grid gap-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="hover:bg-muted focus-ring block rounded-lg px-3 py-2 text-sm leading-snug"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
