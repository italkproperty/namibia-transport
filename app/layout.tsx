import type { Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { SITE } from "@/lib/site";
import "./globals.css";

/**
 * Two roles, one voice: Instrument Serif carries display headings only, Geist
 * does every piece of interface text. Nothing else gets a typeface.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const displaySerif = Instrument_Serif({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
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
      <body
        className={`${geistSans.variable} ${displaySerif.variable} font-sans antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
