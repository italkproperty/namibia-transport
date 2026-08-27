"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, ChevronDownIcon } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { NavRoute } from "@/components/marketing/nav-data";

/**
 * The routes menu, which is really a price list.
 *
 * A nav item that just says "Transfers" makes someone click to find out what
 * anything costs. This answers the question in the menu — every route with its
 * fare — so the header does merchandising rather than filing.
 *
 * Opens on hover on pointer devices and on click everywhere, because a
 * hover-only menu is unusable on touch and unreachable by keyboard.
 */
export function RouteMenu({ routes }: { routes: NavRoute[] }) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  // A small grace period, so crossing the gap between trigger and panel does
  // not snap the menu shut.
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  React.useEffect(() => cancelClose, []);

  const airport = routes.filter((route) => route.category === "airport");
  const other = routes.filter((route) => route.category !== "airport");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring data-[state=open]:text-foreground inline-flex items-center gap-1 rounded-sm text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
      >
        Transfers
        <ChevronDownIcon
          className="size-3.5 transition-transform duration-200 data-[open=true]:rotate-180"
          data-open={open}
          aria-hidden
        />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={14}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        className="w-[34rem] p-0"
      >
        <div className="grid grid-cols-2 gap-x-2 p-2">
          <Column title="From the airport" routes={airport} onPick={() => setOpen(false)} />
          <Column title="Intercity" routes={other} onPick={() => setOpen(false)} />
        </div>

        <Link
          href="/transfers"
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground flex items-center justify-between border-t px-4 py-2.5 text-xs transition-colors"
        >
          Every route and price
          <ArrowRightIcon className="size-3.5" aria-hidden />
        </Link>
      </PopoverContent>
    </Popover>
  );
}

function Column({
  title,
  routes,
  onPick,
}: {
  title: string;
  routes: NavRoute[];
  onPick: () => void;
}) {
  if (routes.length === 0) return null;

  return (
    <div>
      <p className="text-muted-foreground px-3 pt-2 pb-1 text-[0.7rem] font-medium tracking-wide uppercase">
        {title}
      </p>
      <ul>
        {routes.map((route) => (
          <li key={route.slug}>
            <Link
              href={`/transfers/${route.slug}`}
              onClick={onPick}
              className="hover:bg-muted focus-visible:bg-muted group flex items-baseline justify-between gap-3 rounded-md px-3 py-2 focus-visible:outline-none"
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
      </ul>
    </div>
  );
}
