import type { RouteView } from "@/lib/maps/types";
import { GUIDES } from "@/lib/guides";

/** One place for what the header offers, so desktop and mobile cannot drift. */
export const NAV_LINKS = [
  { href: "/journey", label: "Any journey" },
  { href: "/self-drive", label: "Self-drive?" },
  { href: "/corporate", label: "Corporate" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export const NAV_GUIDES = GUIDES.map((guide) => ({
  href: `/guides/${guide.slug}`,
  label: guide.title,
}));

export type NavRoute = {
  slug: string;
  from: string;
  to: string;
  price: string;
  unit: string;
  duration: string | null;
  category: RouteView["category"];
};
