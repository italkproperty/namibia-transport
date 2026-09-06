import Link from "next/link";

import { formatDuration } from "@/lib/format";
import type { RouteTableSpec } from "@/lib/guides";
import { modelJourneyBySlug } from "@/lib/network/journey";
import { SPEED_KMH } from "@/lib/network/roads";

/**
 * How much gravel changes what to hire. Kilometres, not percentage, because
 * tyre damage and driver fatigue accumulate per kilometre driven — a short
 * route that is all gravel is easier on a car than a long one that is half
 * gravel. The 120 km line is editorial: below it the gravel is an episode,
 * above it the gravel is the day.
 */
function vehicleVerdict(gravelKm: number): string {
  if (gravelKm === 0) return "Any car";
  if (gravelKm <= 120) return "High clearance wise";
  return "High clearance essential";
}

/**
 * Tar/gravel split drawn to scale. Solid reads as tar, the striped band as
 * gravel — pattern rather than colour alone, so the split survives both
 * themes and colour-blindness.
 */
function SurfaceBar({ tarKm, gravelKm }: { tarKm: number; gravelKm: number }) {
  const total = tarKm + gravelKm;
  if (total === 0) return null;

  return (
    <div
      aria-hidden
      className="bg-muted flex h-1.5 w-full min-w-16 overflow-hidden rounded-full"
    >
      {tarKm > 0 && (
        <div
          className="bg-foreground/70 h-full"
          style={{ width: `${(tarKm / total) * 100}%` }}
        />
      )}
      {gravelKm > 0 && (
        <div
          className="h-full bg-amber-600/80 dark:bg-amber-500/80"
          style={{
            width: `${(gravelKm / total) * 100}%`,
            backgroundImage:
              "repeating-linear-gradient(-45deg, transparent 0 3px, rgb(255 255 255 / 0.45) 3px 5px)",
          }}
        />
      )}
    </div>
  );
}

/**
 * A guide's route table, computed from the road network at render time.
 * The guide names journeys; every number here comes from the model, so the
 * table cannot disagree with the quote the reader gets when they click.
 */
export function JourneyTable({ spec }: { spec: RouteTableSpec }) {
  const rows = spec.journeys
    .map((slug) => ({ slug, journey: modelJourneyBySlug(slug) }))
    .filter((row) => row.journey !== null);

  if (rows.length === 0) return null;

  return (
    <figure className="mt-5">
      <div className="bg-card overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <caption className="sr-only">{spec.caption}</caption>
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th scope="col" className="px-4 py-2.5 font-medium">
                Route
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Distance
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Surface
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                On gravel
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Driving time
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Vehicle
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ slug, journey }) => {
              const road = journey!.road;
              const gravelShare = Math.round((road.gravelKm / road.km) * 100);
              return (
                <tr key={slug} className="border-b last:border-b-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    <Link
                      href={`/journey?from=${road.origin.slug}&to=${road.destination.slug}`}
                      className="hover:text-brand underline-offset-2 hover:underline"
                    >
                      {road.origin.shortName ?? road.origin.name} →{" "}
                      {road.destination.shortName ?? road.destination.name}
                    </Link>
                  </th>
                  <td className="tabular px-3 py-3 text-right whitespace-nowrap">
                    {road.km} km
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <SurfaceBar tarKm={road.tarKm} gravelKm={road.gravelKm} />
                  </td>
                  <td className="tabular px-3 py-3 text-right whitespace-nowrap">
                    {road.gravelKm === 0 ? (
                      <span className="text-muted-foreground">none</span>
                    ) : (
                      <>
                        {road.gravelKm} km
                        <span className="text-muted-foreground">
                          {" "}
                          · {gravelShare}%
                        </span>
                      </>
                    )}
                  </td>
                  <td className="tabular px-3 py-3 text-right whitespace-nowrap">
                    {formatDuration(road.minutes)}
                  </td>
                  <td className="min-w-28 px-4 py-3">
                    {vehicleVerdict(road.gravelKm)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <figcaption className="text-muted-foreground mt-2 text-xs text-pretty">
        {spec.note ??
          `Computed from our road network: tar at ${SPEED_KMH.tar} km/h, gravel at ${SPEED_KMH.gravel} km/h, with a rest stop included. Each route links to a fixed-price quote for the same journey.`}
      </figcaption>
    </figure>
  );
}
