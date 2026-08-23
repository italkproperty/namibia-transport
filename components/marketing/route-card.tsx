import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDistance, formatDuration, shortPlace } from "@/lib/format";
import { formatNad } from "@/lib/money";
import type { RouteView } from "@/lib/maps";

const CATEGORY_LABEL: Record<RouteView["category"], string> = {
  airport: "Airport transfer",
  intercity: "Intercity",
  city: "City",
  corporate: "Corporate",
};

export function RouteCard({ route }: { route: RouteView }) {
  const duration = formatDuration(route.durationMin);
  const distance = formatDistance(route.distanceKm);

  return (
    <article className="group border-border/70 bg-card hover:border-border relative flex flex-col rounded-2xl border p-6 transition-all hover:shadow-[0_2px_24px_-8px_oklch(0_0_0/0.16)]">
      <Badge variant="secondary" className="mb-5">
        {CATEGORY_LABEL[route.category]}
      </Badge>

      <h3 className="font-display text-2xl leading-snug text-balance">
        <Link
          href={`/transfers/${route.slug}`}
          className="focus-visible:ring-ring rounded-sm focus-visible:ring-[3px] focus-visible:outline-none"
        >
          {/* Stretches the link over the whole card without nesting anchors. */}
          <span className="absolute inset-0" aria-hidden />
          {shortPlace(route.originLabel)}
          <span className="text-muted-foreground"> to </span>
          {route.destinationLabel}
        </Link>
      </h3>

      {(duration || distance) && (
        <p className="text-muted-foreground mt-2 text-sm">
          {[distance, duration].filter(Boolean).join(" · ")}
        </p>
      )}

      {/* mt-auto keeps the price on a common baseline when titles wrap. */}
      <div className="mt-auto flex items-end justify-between gap-4 pt-8">
        <div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            From
          </p>
          <p className="tabular mt-1 text-2xl font-semibold tracking-tight">
            {formatNad(route.fixedPrice)}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            per vehicle, up to 3 passengers
          </p>
        </div>
        <ArrowRightIcon
          className="text-muted-foreground size-5 shrink-0 transition-transform group-hover:translate-x-1"
          aria-hidden
        />
      </div>
    </article>
  );
}
