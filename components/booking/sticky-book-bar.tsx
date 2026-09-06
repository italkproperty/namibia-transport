"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useCountUp } from "@/components/booking/use-count-up";
import { formatNad } from "@/lib/money";

/**
 * Mobile-only persistent price + action.
 *
 * On a phone the widget scrolls away, and a price you cannot see is a price
 * you have to hunt for. This keeps the current quote and the way forward on
 * screen at all times. It is hidden on desktop, where the widget or the route
 * card is already sticky.
 *
 * `watch` is the id of the element it stands in for. While that element is on
 * screen the bar stays out of the way — otherwise the home page renders the
 * same price twice, ninety pixels apart, which is what it did.
 */
export function StickyBookBar({
  price,
  href,
  label,
  cta = "Book now",
  watch,
}: {
  price: number;
  href: string;
  label?: string;
  cta?: string;
  /** Element id this bar substitutes for; hidden while it is in view. */
  watch?: string;
}) {
  const animated = useCountUp(price);
  const [standingIn, setStandingIn] = React.useState(!watch);

  React.useEffect(() => {
    if (!watch) return;
    const target = document.getElementById(watch);
    if (!target || typeof IntersectionObserver === "undefined") {
      setStandingIn(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setStandingIn(!entry.isIntersecting),
      { rootMargin: "-72px 0px 0px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [watch]);

  if (!standingIn) return null;

  return (
    <>
      {/* Spacer so the bar never covers the end of the page content. */}
      <div className="h-20 lg:hidden" aria-hidden />

      <div className="bg-card/95 shadow-sticky fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md lg:hidden">
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="min-w-0 flex-1">
            {label && (
              <p className="text-muted-foreground truncate text-xs">{label}</p>
            )}
            <p
              className="tabular price-slot text-brand text-xl leading-tight font-semibold"
              aria-live="polite"
            >
              {formatNad(animated)}
            </p>
          </div>

          <Button
            asChild
            size="lg"
            className="press bg-brand text-brand-foreground hover:bg-brand-hover h-11 shrink-0"
          >
            <Link href={href}>{cta}</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
