import type { RouteView } from "@/lib/maps/types";
import { GUIDES } from "@/lib/guides";

/**
 * One place for what the header offers, so desktop and mobile cannot drift.
 *
 * Seven top-level items became one. Five of the seven were duplicates of
 * links already in the footer, so demoting them cost the site nothing; the
 * two that remained described the same product from different angles.
 * Corporate survives alone because it is the only item with a genuinely
 * different buyer, a different funnel and no other route in.
 *
 * What replaced them is the thing the old nav was missing: on desktop there
 * was no path to any of the eight guides or to /methodology at all. The
 * whole content moat was reachable only from the mobile sheet.
 */
export const NAV_LINKS = [
  { href: "/corporate", label: "Corporate" },
] as const;

/**
 * Guides split the way the data model already splits them. `kind` exists on
 * every guide precisely because the two audiences are months apart — someone
 * whose flight is booked, and someone still deciding whether to hire a car —
 * and a single "Planning your arrival" heading mislabelled half of them.
 */
export const NAV_GUIDES = GUIDES.map((guide) => ({
  href: `/guides/${guide.slug}`,
  label: guide.title,
  kind: guide.kind,
}));

export const ARRIVAL_GUIDES = NAV_GUIDES.filter((g) => g.kind === "arrival");
export const DECISION_GUIDES = NAV_GUIDES.filter((g) => g.kind === "decision");

export type NavRoute = {
  slug: string;
  from: string;
  to: string;
  price: string;
  unit: string;
  duration: string | null;
  category: RouteView["category"];
};
