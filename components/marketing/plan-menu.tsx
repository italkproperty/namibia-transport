"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, ChevronDownIcon } from "lucide-react";

import {
  ARRIVAL_GUIDES,
  DECISION_GUIDES,
} from "@/components/marketing/nav-data";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * The way into everything we know.
 *
 * Eight guides and the methodology page were reachable on desktop from
 * nowhere at all — the guide list was built and then imported only by the
 * mobile sheet. They are the content that no competitor can copy, because
 * each carries a number only the road model produces, and the header was
 * hiding all of it.
 *
 * The two headings are the two audiences, months apart: someone whose flight
 * is booked, and someone still deciding whether to hire a car. That split is
 * already in the data as `kind`; this menu just stops ignoring it.
 *
 * Not called "Guides": on a transport site in Namibia that reads as tour
 * guides, which is a service we do not offer and must not imply.
 */
export function PlanMenu() {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  React.useEffect(() => cancelClose, []);

  const close = () => setOpen(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        className="press focus-ring text-muted-foreground hover:text-foreground data-[state=open]:text-foreground group flex items-center gap-1 rounded-sm text-sm"
      >
        Plan your trip
        <ChevronDownIcon
          className="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={14}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        className="w-[32rem] p-0"
      >
        <div className="grid grid-cols-2 gap-x-2 p-2">
          <Column title="Arriving in Namibia" items={ARRIVAL_GUIDES} onPick={close} />
          <Column
            title="Self-drive or be driven"
            items={[
              { href: "/self-drive", label: "Compare the real cost" },
              ...DECISION_GUIDES,
            ]}
            onPick={close}
          />
        </div>

        {/* The page that stands behind every figure on the site. It was in
            the footer and nowhere else, which is the wrong place for the
            answer to "are these numbers real". */}
        <Link
          href="/methodology"
          onClick={close}
          className="text-muted-foreground hover:text-foreground focus-ring flex items-center justify-between border-t px-4 py-2.5 text-xs transition-colors"
        >
          How we compute our numbers
          <ArrowRightIcon className="size-3.5" aria-hidden />
        </Link>
      </PopoverContent>
    </Popover>
  );
}

function Column({
  title,
  items,
  onPick,
}: {
  title: string;
  items: { href: string; label: string }[];
  onPick: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="text-muted-foreground px-3 pt-2 pb-1 text-xs font-semibold tracking-[0.08em] uppercase">
        {title}
      </p>
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onPick}
              className="hover:bg-muted focus-ring block rounded-md px-3 py-2 text-sm leading-snug"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
