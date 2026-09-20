import type { MetadataRoute } from "next";

import { GUIDES } from "@/lib/guides";
import { listRoutes } from "@/lib/maps";
import { LEGS } from "@/lib/network/legs";
import { SITE } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { routes } = await listRoutes({ activeOnly: true });

  const routePages = routes.map((route) => ({
    url: `${SITE.url}/transfers/${route.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const guidePages = GUIDES.map((guide) => ({
    url: `${SITE.url}/guides/${guide.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // One page per leg people actually drive. Below the curated routes and the
  // guides in priority: these answer a narrower question and should not
  // outrank the pages that sell the journey.
  const legPages = LEGS.map((leg) => ({
    url: `${SITE.url}/drive/${leg.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [
    { url: SITE.url, changeFrequency: "daily", priority: 1 },
    ...routePages,
    ...guidePages,
    ...legPages,
    { url: `${SITE.url}/drive`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE.url}/transfers`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/journey`, changeFrequency: "weekly", priority: 0.8 },
    {
      url: `${SITE.url}/self-drive`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    { url: `${SITE.url}/vehicles`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/corporate`, changeFrequency: "weekly", priority: 0.8 },
    {
      url: `${SITE.url}/methodology`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    { url: `${SITE.url}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE.url}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE.url}/terms`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
