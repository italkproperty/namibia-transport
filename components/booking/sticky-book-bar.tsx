"use client";

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
 */
export function StickyBookBar({
  price,
  href,
  label,
  cta = "Book now",
}: {
  price: number;
  href: string;
  label?: string;
  cta?: string;
}) {
  const animated = useCountUp(price);

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
