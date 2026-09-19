import Link from "next/link";

import type { RainTableSpec } from "@/lib/guides";
import { modelJourneyBySlug } from "@/lib/network/journey";

/**
 * What the rains can close, leg by leg.
 *
 * The rain notes live on individual road segments, so the model already knows
 * which river crossings and passes a given route crosses — it surfaces them at
 * booking. This puts the same data in front of someone still planning, and it
 * is genuinely ours: "Namibia gets rain in January" is on every travel site,
 * but "your Sossusvlei-to-Swakopmund leg crosses two things that close" is a
 * property of the route, and it comes out of the graph rather than a paragraph
 * someone wrote.
 *
 * A leg with no known closure is shown, not hidden. Half the value here is
 * seeing that the tar legs carry nothing at all.
 */
export function RainTable({ spec }: { spec: RainTableSpec }) {
  const rows = spec.journeys
    .map((slug) => ({ slug, journey: modelJourneyBySlug(slug) }))
    .filter((row) => row.journey !== null);

  if (rows.length === 0) return null;

  return (
    <figure className="mt-5">
      <div className="bg-card overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">{spec.caption}</caption>
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th scope="col" className="px-4 py-2.5 font-medium">
                Leg
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                On gravel
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                What the rains can close
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
                    <span className="text-muted-foreground block text-xs font-normal">
                      {road.roads.join(" · ")}
                    </span>
                  </th>
                  <td className="tabular px-3 py-3 text-right align-top whitespace-nowrap">
                    {road.gravelKm === 0 ? (
                      <span className="text-muted-foreground">none</span>
                    ) : (
                      `${gravelShare}%`
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {road.rainNotes.length === 0 ? (
                      <span className="text-muted-foreground">
                        Nothing on this route
                      </span>
                    ) : (
                      <ul className="grid gap-1">
                        {road.rainNotes.map((note) => (
                          <li key={note} className="leading-snug text-pretty">
                            {note.charAt(0).toUpperCase() + note.slice(1)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <figcaption className="text-muted-foreground mt-2 text-xs text-pretty">
        {spec.note ??
          "Read off the individual road segments each route crosses, so the list follows your actual road rather than the region. These are the crossings and passes that close in heavy rain — not a forecast, and not a reason to avoid the season."}
      </figcaption>
    </figure>
  );
}
