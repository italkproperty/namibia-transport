import type { Metadata } from "next";
import { Archivo, Geist } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { SiteSchema } from "@/components/marketing/site-schema";
import { SITE } from "@/lib/site";
import "./globals.css";

/** The interface family. Weight and scale carry the hierarchy. */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

/**
 * The brand family, used for the wordmark and nothing else.
 *
 * Geist is the interface typeface and a fine one, but a wordmark set in it
 * looks like every other site deployed this year. Archivo is a grotesque with
 * enough weight and squareness to read as infrastructure rather than software,
 * which is closer to what a transport operator should feel like. One weight,
 * subset to Latin — it costs a few kilobytes and only the logo uses it.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["700"],
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
        className={`${geistSans.variable} ${archivo.variable} font-sans antialiased`}
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
