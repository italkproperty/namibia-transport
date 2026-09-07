import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { SiteSchema } from "@/components/marketing/site-schema";
import { SITE } from "@/lib/site";
import "./globals.css";

/**
 * One family runs the whole interface, and it is the wordmark's own.
 *
 * The site used to set everything in Geist and reserve Archivo for the logo,
 * which meant the only piece of the page with a point of view was forty pixels
 * wide in the corner — and Geist, like Inter, is the face every product
 * deployed this year already uses. Archivo is a grotesque descended from
 * highway-sign lettering: square, tightly fitted, legible at speed. For a
 * company that sells road distance that is not a decorative coincidence, and
 * it lets the wordmark stop being an island.
 *
 * Variable, so 400 through 700 cost one file rather than four.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

/**
 * The figure face, for things that are read as data rather than prose:
 * booking references, road numbers, coordinates, distances in a table.
 *
 * `--font-mono` previously pointed at a Geist Mono variable that was never
 * loaded, so every `font-mono` on the site silently fell back to whatever the
 * device had. Two weights, because that is all the data ever needs.
 */
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Private Transfers Across Namibia`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "en_NA",
    title: `${SITE.name} — Private Transfers Across Namibia`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Every map on the site — the static image and the tiles behind the
            interactive one — comes from these two hosts. Opening the
            connections early saves the DNS and TLS round trips from the
            critical path, which on a Namibian mobile connection is most of
            the wait before a map appears. */}
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link
          rel="preconnect"
          href="https://events.mapbox.com"
          crossOrigin=""
        />
      </head>
      <body
        className={`${archivo.variable} ${plexMono.variable} font-sans antialiased`}
      >
        {/* The <main id="main"> was already there; the link to it was not, so
            a keyboard user tabbed the whole header on every page. */}
        <a
          href="#main"
          className="focus-ring bg-card text-foreground sr-only rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to content
        </a>
        {children}
        <Toaster />
              <SiteSchema />
      </body>
    </html>
  );
}
