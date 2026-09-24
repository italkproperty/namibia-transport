import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/shell";
import { PricingForm } from "@/components/admin/pricing-form";
import { VehicleCostForm } from "@/components/admin/vehicle-cost-form";
import { listVehicleClasses } from "@/lib/maps";
import { formatNad } from "@/lib/money";
import { BASELINE_PROFILE, type PricingConstants } from "@/lib/pricing/cost-model";
import { previewJourneys, worstSwing } from "@/lib/pricing/preview";
import { CONSTANT_BOUNDS, getPricingConfig, profileFor } from "@/lib/pricing/settings";
import { getRates } from "@/lib/currency-rates";
import { CURRENCIES } from "@/lib/currency";

export const metadata: Metadata = {
  title: "Pricing",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Where the cost of a kilometre is decided.
 *
 * The whole reason this page exists as a *preview* rather than a form: one
 * number here multiplies 2,352 journeys. Saving first and looking afterwards
 * is the wrong order — by the time an operator opens a route page to check,
 * every quote link already sent is at the new price. So the numbers in the
 * URL are modelled against the numbers in the database, both columns are
 * shown, and saving is a separate deliberate act.
 */
export default async function AdminPricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const config = await getPricingConfig();
  const classes = await listVehicleClasses();

  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  /**
   * The proposed constants: whatever is in the URL, falling back to what is
   * live. An out-of-band number is left as-is rather than clamped, so the
   * preview shows the consequence of the typo instead of hiding it — and the
   * save refuses it separately.
   */
  const proposed = CONSTANT_BOUNDS.reduce((acc, bound) => {
    const raw = first(bound.key);
    const value = raw === undefined || raw === "" ? NaN : Number(raw);
    acc[bound.key] = Number.isFinite(value) ? value : config.constants[bound.key];
    return acc;
  }, {} as PricingConstants);

  const dirty = CONSTANT_BOUNDS.some(
    (bound) => proposed[bound.key] !== config.constants[bound.key],
  );

  const previewClassSlug = first("class") ?? BASELINE_PROFILE.slug;
  const profile = profileFor(config, previewClassSlug);
  const rows = previewJourneys(profile, config.constants, proposed);
  const swing = worstSwing(rows);

  const rates = getRates();
  const missingRates = CURRENCIES.filter(
    (c) => c.env && rates.nadPer[c.code] === undefined,
  );

  return (
    <AdminShell active="/admin/pricing">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl">Pricing</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm text-pretty">
            What a kilometre, an hour and a night away cost. Every fare on the
            site is built from these — {rows.length} reference journeys are
            modelled below so a change can be seen before it is made.
          </p>
          {!config.stored && (
            <p className="text-muted-foreground mt-2 max-w-2xl text-xs text-pretty">
              No settings row has been saved yet, so these are the built-in
              values the code shipped with. Saving writes them down; it does not
              change any price.
            </p>
          )}
        </div>

        {/* ------------------------------------------------- the constants */}
        <PricingForm
          bounds={CONSTANT_BOUNDS}
          live={config.constants}
          proposed={proposed}
          classSlug={previewClassSlug}
          classes={classes.map((c) => ({ slug: c.slug, name: c.name }))}
        />

        {/* ---------------------------------------------------- the preview */}
        <section className="bg-card rounded-xl border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">
              What these numbers do, for {profile.slug === BASELINE_PROFILE.slug ? "the baseline vehicle" : profile.slug}
            </h2>
            {dirty && (
              <span className="text-muted-foreground text-xs">
                Largest swing {swing.toFixed(0)}% — nothing is saved yet
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1 max-w-2xl text-xs text-pretty">
            {/* Chosen to span the shape of the fare, not to be best sellers: a
                change that leaves the airport run alone and doubles Sossusvlei
                is invisible on a popularity list and obvious here. */}
            These six span the shapes a Namibian fare takes — turn-out, long
            tar, gravel, and a night away. A change that is quiet on one shape
            and violent on another shows up here and nowhere else.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="py-2 font-medium">Journey</th>
                  <th className="py-2 text-right font-medium">km</th>
                  <th className="py-2 text-right font-medium">Now</th>
                  <th className="py-2 text-right font-medium">Proposed</th>
                  <th className="py-2 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="block">{row.label}</span>
                      <span className="text-muted-foreground text-xs">
                        {row.note}
                        {row.nights > 0 &&
                          ` · ${row.nights} night${row.nights === 1 ? "" : "s"} away`}
                        {row.atFloor && " · at the turn-out floor"}
                      </span>
                    </td>
                    <td className="tabular py-2.5 text-right">{row.km}</td>
                    <td className="tabular py-2.5 text-right">
                      {formatNad(String(row.before))}
                    </td>
                    <td className="tabular py-2.5 text-right font-medium">
                      {formatNad(String(row.after))}
                    </td>
                    <td
                      className={`tabular py-2.5 text-right ${
                        row.delta === 0
                          ? "text-muted-foreground"
                          : row.delta > 0
                            ? "text-warning"
                            : "text-brand"
                      }`}
                    >
                      {row.delta === 0
                        ? "—"
                        : `${row.delta > 0 ? "+" : ""}${row.percent.toFixed(0)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ------------------------------------------- per-class running cost */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Running cost by vehicle</h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-xs text-pretty">
              {/* The argument for this page existing at all. */}
              The only term a bigger vehicle changes. A 4x4 burns more diesel
              and eats more tyres; it does not make the driver&rsquo;s hour or a
              bed in Otjiwarongo more expensive, which is what the old
              whole-fare multiplier charged for. A class with no costs set is
              still priced through that multiplier.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {classes.map((vehicleClass) => (
              <VehicleCostForm
                key={vehicleClass.slug}
                slug={vehicleClass.slug}
                name={vehicleClass.name}
                multiplier={vehicleClass.priceMultiplier}
                costed={config.profiles.has(vehicleClass.slug)}
                profile={profileFor(config, vehicleClass.slug)}
              />
            ))}
          </div>
        </section>

        {/* ---------------------------------------------- the currency gap */}
        {missingRates.length > 0 && (
          <section className="border-warning/40 bg-warning/10 rounded-xl border p-4">
            <h2 className="text-sm font-semibold">
              {missingRates.map((c) => c.code).join(", ")} not shown to travellers
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm text-pretty">
              {/* This failed silently twice. A currency that is configured
                  nowhere simply does not appear, and nothing said so. */}
              No rate is set for {missingRates.map((c) => c.code).join(", ")}, so
              the currency picker does not offer{" "}
              {missingRates.length === 1 ? "it" : "them"} and every visitor sees
              Namibian dollars only. Set{" "}
              {missingRates.map((c) => <code key={c.code}>{c.env} </code>)} and{" "}
              <code>FX_RATE_AS_AT</code> in the Vercel project, then redeploy —
              rates are baked in at build so the figure on screen always matches
              its printed date.
            </p>
          </section>
        )}
      </div>
    </AdminShell>
  );
}
