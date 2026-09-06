import Link from "next/link";

import {
  ITINERARY_PRESETS,
  REMAINING_EXCESS,
  SELF_DRIVE_CLASSES,
  WAIVER_PER_DAY,
  planItinerary,
  selfDriveCost,
} from "@/lib/network/itinerary";

const nad = (amount: number) => `N$${amount.toLocaleString("en-US")}`;

/**
 * The driven price against every self-drive class, for one preset itinerary,
 * computed at render time from the same model as the interactive planner on
 * /self-drive. A guide cannot type these figures; it names a preset and the
 * numbers arrive from the model — the guide and the planner can never quote
 * two different answers for the same trip.
 */
export function CircuitCompare({ presetId }: { presetId: string }) {
  const preset = ITINERARY_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;

  const itinerary = planItinerary(preset.stops);
  if (!itinerary) return null;

  const rows = SELF_DRIVE_CLASSES.map((cls) => ({
    label: cls.label,
    cost: selfDriveCost(itinerary, {
      dayRate: cls.dayRate,
      fuelPerKm: cls.fuelPerKm,
      waiverPerDay: WAIVER_PER_DAY,
    }),
  }));

  return (
    <figure className="mt-5">
      <div className="bg-card overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">
            {preset.name}: driven for you against self-drive, in Namibian
            dollars
          </caption>
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th scope="col" className="px-4 py-2.5 font-medium">
                {preset.name} · {itinerary.days} days,{" "}
                {itinerary.km.toLocaleString("en-US")} km
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Total
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Excess you carry
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <th scope="row" className="px-4 py-3 text-left font-medium">
                Driven for you — vehicle, driver and fuel in one fare
              </th>
              <td className="tabular text-brand px-3 py-3 text-right font-semibold whitespace-nowrap">
                {nad(itinerary.chauffeured.price)}
              </td>
              <td className="tabular text-muted-foreground px-4 py-3 text-right">
                none
              </td>
            </tr>
            {rows.map(({ label, cost }) => (
              <tr key={label} className="border-b last:border-b-0">
                <th
                  scope="row"
                  className="px-4 py-3 text-left font-normal text-pretty"
                >
                  {label}
                  <span className="text-muted-foreground block text-xs">
                    vehicle {nad(cost.vehicle)} · fuel {nad(cost.fuel)} ·
                    tyre-and-glass waiver {nad(cost.waiver)}
                  </span>
                </th>
                <td className="tabular px-3 py-3 text-right font-semibold whitespace-nowrap">
                  {nad(cost.total)}
                </td>
                <td className="tabular px-4 py-3 text-right whitespace-nowrap">
                  {nad(cost.excessCarried)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="text-muted-foreground mt-2 text-xs text-pretty">
        Computed from our road and fare model for this exact itinerary. Hire
        day rates, the N${WAIVER_PER_DAY.toLocaleString("en-US")}/day
        tyre-and-glass waiver and the N$
        {REMAINING_EXCESS.toLocaleString("en-US")} carried excess are from our
        survey of published Windhoek operator rates, September 2026 — plug
        your own quote into{" "}
        <Link href="/self-drive" className="underline underline-offset-2">
          the planner
        </Link>{" "}
        and the comparison recomputes.
      </figcaption>
    </figure>
  );
}
