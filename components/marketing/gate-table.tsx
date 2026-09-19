import Link from "next/link";

import { formatDuration } from "@/lib/format";
import type { GateTableSpec } from "@/lib/guides";
import { modelJourneyBySlug } from "@/lib/network/journey";
import {
  formatMinutes,
  GATE_RULES,
  SAFETY_MARGIN_MIN,
  sunTimes,
} from "@/lib/parks/gates";

/**
 * The latest you can leave and still clear a park gate before it shuts.
 *
 * Namibia's park gates close at sunset, not at a clock hour, and the closing
 * is absolute — whoever is outside at sunset stays outside. That makes the
 * useful question not "what time does the gate close" but "what time must I
 * leave", and answering it needs two things at once: a sunset computed for
 * the gate's own latitude and date, and an honest driving time for the road
 * to it. We have both, which is why this table exists here and nowhere else.
 *
 * Both a midsummer and a midwinter column, because the spread is the point:
 * an hour of daylight separates them, and an itinerary planned on December's
 * light does not survive June.
 */

/** Midsummer and midwinter — the extremes every date in between falls under. */
const SAMPLE_DATES = [
  { label: "Late December", iso: "2026-12-21" },
  { label: "Late June", iso: "2026-06-21" },
];

export function GateTable({ spec }: { spec: GateTableSpec }) {
  const origin = spec.origin;

  const rows = spec.gates
    .map((gateSlug) => {
      const rule = GATE_RULES[gateSlug];
      const journey = modelJourneyBySlug(`${origin}-to-${gateSlug}`);
      if (!rule || !journey) return null;

      const minutes = journey.road.minutes;
      const columns = SAMPLE_DATES.map(({ iso }) => {
        const sun = sunTimes(rule.lat, rule.lng, iso);
        if (!sun) return null;
        return {
          closes: formatMinutes(sun.sunsetMin),
          // Negative means the drive cannot start late enough in the day to
          // be worth attempting at all; formatMinutes would render nonsense,
          // so the cell says so in words instead.
          leaveBy:
            sun.sunsetMin - minutes - SAFETY_MARGIN_MIN > 0
              ? formatMinutes(sun.sunsetMin - minutes - SAFETY_MARGIN_MIN)
              : null,
        };
      });

      return { gateSlug, rule, journey, minutes, columns };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) return null;

  return (
    <figure className="mt-5">
      <div className="bg-card overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">{spec.caption}</caption>
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th scope="col" className="px-4 py-2.5 font-medium">
                Gate
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Drive
              </th>
              {SAMPLE_DATES.map((date) => (
                <th
                  key={date.iso}
                  scope="col"
                  className="px-3 py-2.5 text-right font-medium"
                >
                  {date.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ gateSlug, rule, journey, minutes, columns }) => (
              <tr key={gateSlug} className="border-b last:border-b-0">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  <Link
                    href={`/journey?from=${origin}&to=${gateSlug}`}
                    className="hover:text-brand underline-offset-2 hover:underline"
                  >
                    {rule.gate}
                  </Link>
                  <span className="text-muted-foreground block text-xs font-normal">
                    {journey.road.km} km
                  </span>
                </th>
                <td className="tabular px-3 py-3 text-right whitespace-nowrap">
                  {formatDuration(minutes)}
                </td>
                {columns.map((column, index) => (
                  <td
                    key={SAMPLE_DATES[index].iso}
                    className="px-3 py-3 text-right whitespace-nowrap"
                  >
                    {column?.leaveBy ? (
                      <>
                        <span className="tabular font-medium">
                          {column.leaveBy}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          gate {column.closes}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        not in one day
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="text-muted-foreground mt-2 text-xs text-pretty">
        {spec.note ??
          `Latest departure that still clears the gate, leaving ${SAFETY_MARGIN_MIN} minutes in hand for a slow stretch. Sunset is computed for each gate's own position and date; driving times come from our road model. Namibia keeps UTC+02:00 all year, so these are wall-clock times with no daylight saving to adjust for.`}
      </figcaption>
    </figure>
  );
}
