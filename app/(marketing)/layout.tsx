import * as React from "react";

/**
 * Every page in this group reads the route and vehicle catalogue, and every one
 * of them is prerendered — which meant a price, a name or a newly published
 * route changed in the database and the marketing site went on serving the
 * figures from the last build. It took a redeploy to catch up, and nothing
 * about the site said so.
 *
 * An hour of ISR fixes that without giving up static rendering: pages still
 * serve from the edge instantly, and the first request after the window
 * regenerates them against the database in the background. A price is never
 * more than an hour stale, and publishing a route no longer needs a deploy.
 *
 * This is safe for money because nothing here is a quote. Fares shown on these
 * pages are indicative; the fare that binds is computed server-side at booking
 * time and snapshotted onto the booking.
 */
export const revalidate = 3600;

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
