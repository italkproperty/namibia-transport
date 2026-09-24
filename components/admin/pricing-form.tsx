"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePricingSettings, type SaveResult } from "@/lib/pricing/actions";
import type { PricingConstants } from "@/lib/pricing/cost-model";
import type { Bound } from "@/lib/pricing/bounds";

/**
 * The cost constants, edited in two deliberate steps.
 *
 * Preview is a link, not a submit: the proposed numbers travel in the URL, the
 * server models them against what is live, and nothing is written. That makes
 * the preview shareable and re-loadable, and — more to the point — makes it
 * impossible to change pricing by accident, because saving is a second,
 * separate action taken after looking at the table below.
 */
export function PricingForm({
  bounds,
  live,
  proposed,
  classSlug,
  classes,
}: {
  bounds: Bound[];
  live: PricingConstants;
  proposed: PricingConstants;
  classSlug: string;
  classes: { slug: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<SaveResult | null, FormData>(
    savePricingSettings,
    null,
  );

  const errorFor = (key: string) =>
    state && !state.ok ? state.errors?.find((e) => e.field === key)?.message : undefined;

  return (
    <section className="bg-card rounded-xl border p-4">
      <form action={action} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bounds.map((bound) => {
            const error = errorFor(bound.key);
            return (
              <div key={bound.key} className="space-y-1">
                <label
                  htmlFor={bound.key}
                  className="flex items-baseline justify-between gap-2 text-sm font-medium"
                >
                  {bound.label}
                  <span className="text-muted-foreground text-xs font-normal">
                    {bound.unit}
                  </span>
                </label>
                <Input
                  id={bound.key}
                  name={bound.key}
                  type="number"
                  inputMode="decimal"
                  step={bound.step}
                  min={bound.min}
                  max={bound.max}
                  defaultValue={proposed[bound.key]}
                  aria-describedby={`${bound.key}-help`}
                  aria-invalid={Boolean(error)}
                  className="h-10"
                />
                <p
                  id={`${bound.key}-help`}
                  className={`text-xs leading-snug text-pretty ${
                    error ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {error ?? bound.meaning}
                </p>
                {proposed[bound.key] !== live[bound.key] && !error && (
                  <p className="text-warning text-xs">
                    Live value is {live[bound.key]}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save these numbers"}
          </Button>
          <Link
            href="/admin/pricing"
            className="text-muted-foreground hover:text-foreground press text-sm underline underline-offset-2"
          >
            Reset to live
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="class" className="text-muted-foreground text-xs">
              Preview class
            </label>
            <select
              id="class"
              name="class"
              defaultValue={classSlug}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              onChange={(event) => {
                const url = new URL(window.location.href);
                url.searchParams.set("class", event.target.value);
                window.location.href = url.toString();
              }}
            >
              <option value="baseline">Baseline</option>
              {classes.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {state && !state.ok && (
          <p role="alert" className="text-destructive text-sm">
            {state.message}
          </p>
        )}
        {state?.ok && (
          <p role="status" className="text-brand text-sm">
            Saved. Every quote from now on uses these numbers; bookings already
            agreed keep the fare they were struck at.
          </p>
        )}
      </form>
    </section>
  );
}
