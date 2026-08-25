import type { MetadataRoute } from "next";

import { listRoutes } from "@/lib/maps";
import { SITE } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { routes } = await listRoutes({ activeOnly: true });

  const routePages = routes.map((route) => ({
    url: `${SITE.url}/transfers/${route.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  return [
    { url: SITE.url, changeFrequency: "daily", priority: 1 },
    ...routePages,
    { url: `${SITE.url}/corporate`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE.url}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE.url}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE.url}/terms`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
