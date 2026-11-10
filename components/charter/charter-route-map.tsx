import { staticItineraryMapSrcSet } from "@/lib/maps/mapbox";

type Stop = { label?: unknown; coordinates?: { lat?: unknown; lng?: unknown } };

/**
 * The itinerary drawn on a map: numbered stops and the road between them.
 *
 * Reads the saved snapshot, never the live route, so the picture matches the
 * price it sits next to. Nothing without a token or coordinates — a missing
 * map is better than a broken image on the page a customer is deciding from.
 */
export function CharterRouteMap({
  stops,
  geometry,
  className,
}: {
  stops: Stop[];
  geometry: string | null | undefined;
  className?: string;
}) {
  const points = stops.flatMap((stop) => {
    const lat = Number(stop.coordinates?.lat);
    const lng = Number(stop.coordinates?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [{ lat, lng }] : [];
  });
  if (points.length !== stops.length) return null;
  const image = staticItineraryMapSrcSet({ stops: points, encodedGeometry: geometry ?? null });
  if (!image) return null;

  const names = stops.map((stop, index) => `${index + 1} ${String(stop.label ?? "stop")}`).join(", ");

  return (
    <figure className={`overflow-hidden rounded-xl border bg-card ${className ?? ""}`}>
      <div className="relative aspect-[12/5] w-full bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- Mapbox signs
            its own URLs; next/image would strip the token. */}
        <img
          src={image.src}
          srcSet={image.srcSet}
          sizes={image.sizes}
          alt={`Map of the itinerary: ${names}`}
          width={1200}
          height={500}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Numbered in travel order{geometry ? "; the line is the road the driver takes" : ""}.
      </figcaption>
    </figure>
  );
}
