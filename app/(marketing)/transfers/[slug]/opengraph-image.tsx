import { ImageResponse } from "next/og";

import { formatDuration, shortPlace } from "@/lib/format";
import { getRouteBySlug } from "@/lib/maps";
import { formatNad } from "@/lib/money";
import { pricingUnitLabel } from "@/lib/pricing";
import { SITE } from "@/lib/site";

/**
 * A share card carrying the one thing that decides a click: the price.
 *
 * A traveller pasting "what does the airport transfer cost?" into a WhatsApp
 * group is answered by the preview itself, before anyone opens the link.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateImageMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const route = await getRouteBySlug(params.slug);
  return [
    {
      id: "route",
      alt: route
        ? `${shortPlace(route.originLabel)} to ${route.destinationLabel} — ${formatNad(route.fixedPrice)}`
        : SITE.name,
      size,
      contentType,
    },
  ];
}

export default async function Image({
  params,
}: {
  params: { slug: string };
}) {
  const route = await getRouteBySlug(params.slug);

  const from = route ? shortPlace(route.originLabel) : "Namibia";
  const to = route?.destinationLabel ?? "Transfers";
  const price = route ? formatNad(route.fixedPrice) : "";
  const unit = route ? pricingUnitLabel(route) : "";
  const duration = formatDuration(route?.durationMin ?? null);
  const distance = route?.distanceKm
    ? `${Math.round(Number(route.distanceKm))} km`
    : null;

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
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 13,
              background: "#11151a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f3f5f6",
              fontSize: 31,
              fontWeight: 700,
            }}
          >
            N
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#11151a" }}>
            {SITE.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 26, color: "#5f656d", letterSpacing: 1 }}>
            PRIVATE TRANSFER
          </div>
          <div
            style={{
              fontSize: 58,
              fontWeight: 600,
              color: "#11151a",
              lineHeight: 1.12,
              maxWidth: 1000,
            }}
          >
            {from} → {to}
          </div>
          {(distance || duration) && (
            <div style={{ fontSize: 28, color: "#5f656d" }}>
              {[distance, duration && `about ${duration}`]
                .filter(Boolean)
                .join("  ·  ")}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <div style={{ fontSize: 76, fontWeight: 700, color: "#004e94" }}>
              {price}
            </div>
            <div style={{ fontSize: 28, color: "#5f656d" }}>{unit}</div>
          </div>
          <div style={{ fontSize: 24, color: "#5f656d" }}>
            namibiatransport.com
          </div>
        </div>
      </div>
    ),
    size
  );
}
