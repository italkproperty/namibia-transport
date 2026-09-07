import { ImageResponse } from "next/og";

import { SITE } from "@/lib/site";

/**
 * The card WhatsApp, Facebook and iMessage render when the site is shared.
 *
 * WhatsApp is the primary channel here, so a link with no preview is not a
 * cosmetic gap — it is the most common way anyone first sees the brand.
 * Generated rather than designed so it can never drift from the palette, and
 * built from system fonts so it needs no network at build time.
 */
export const alt = `${SITE.name} — fixed-price ground transport across Namibia`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f3f5f6",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#11151a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f3f5f6",
              fontSize: 38,
              fontWeight: 700,
            }}
          >
            N
          </div>
          <div style={{ fontSize: 34, fontWeight: 600, color: "#11151a" }}>
            {SITE.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 62,
              fontWeight: 600,
              color: "#11151a",
              lineHeight: 1.1,
              maxWidth: 900,
            }}
          >
            Fixed-price transfers across Namibia
          </div>
          <div style={{ fontSize: 30, color: "#5f656d", maxWidth: 880 }}>
            Airport transfers · Intercity · Corporate
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 26,
            color: "#004e94",
            fontWeight: 600,
          }}
        >
          <div style={{ width: 120, height: 6, background: "#004e94" }} />
          namibiatransport.com
        </div>
      </div>
    ),
    size
  );
}
