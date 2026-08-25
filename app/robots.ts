import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Personal documents and internal tooling stay out of the index.
      disallow: ["/booking/", "/corporate/quotes/", "/admin/", "/book"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
