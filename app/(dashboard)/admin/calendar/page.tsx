import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangleIcon, ArrowRightIcon, InfoIcon } from "lucide-react";

import { PositionBoard } from "@/components/admin/position-board";
import { AdminShell } from "@/components/admin/shell";
import {
  fleetTimelines,
  suggestedPlan,
  unassignedCount,
} from "@/lib/fleet/queries";
import { sellableLegs } from "@/lib/fleet/marginal";
import {
  deadheadWindows,
  idleByPlace,
  idleWindows,
} from "@/lib/fleet/timeline";
import { namibianToday } from "@/lib/booking/time";
import { formatDuration } from "@/lib/format";
import { formatNad } from "@/lib/money";
import { nodeLabel } from "@/lib/network/nodes";

export const metadata: Metadata = {
  title: "Position calendar",
  robots: { index: false, follow: false },
};

/** Always live: an operations view must never serve a cached page. */
export const dynamic = "force-dynamic";

const DAY = 24 * 3_600_000;

const WHEN = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Windhoek",
});

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const days = one(params.days) === "14" ? 14 : 7;
  const weeksAhead = Math.min(8, Math.max(0, Number(one(params.week)) || 0));

  // Midnight in Windhoek, which is where every driver on this board wakes up.
  const today = new Date(`${namibianToday()}T00:00:00+02:00`);
  const from = new Date(today.getTime() + weeksAhead * 7 * DAY);
  const window = { from, to: new Date(from.getTime() + days * DAY) };

  const [timelines, unassigned] = await Promise.all([
    fleetTimelines(window),
    unassignedCount(window),
  ]);

  // Who should drive what. Suggested only — a dispatcher knows things this
  // does not, and the assignment itself stays a human action.
  const plan = await suggestedPlan(window, timelines);

  // Today is shown from midnight for context, but only the hours still
  // ahead are inventory.
  const sellable = idleWindows(timelines, 4, new Date());
  const places = idleByPlace(sellable);
  // Two kinds of inventory: cars standing somewhere, and cars already driving
  // somewhere empty. The second is worth far more and is not idle time at all.
  const now = new Date();
  const empties = deadheadWindows(timelines).filter((w) => w.endsAt > now);
  const offers = sellableLegs([...empties, ...sellable]).slice(0, 8);
  const conflicts = timelines
    .flatMap((t) => t.conflicts.map((c) => ({ ...c, driver: t.driverName })))
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "impossible" ? -1 : 1;
      return a.at.getTime() - b.at.getTime();
    });

  const committed = timelines.reduce((total, t) => total + t.busyHours, 0);
  const standing = sellable.reduce((total, w) => total + w.hours, 0);

  return (
    <AdminShell active="/admin/calendar">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Position calendar</h1>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-snug">
              Where every car will be, derived from what is already booked. The
              pale bars are the ones worth looking at: a car standing at
              Swakopmund on Tuesday costs the same as one driving, and it is
              the only thing here that can still be sold.
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Toggle href={`?days=${days}`} label="This week" on={weeksAhead === 0} />
            <Toggle href={`?days=${days}&week=1`} label="Next" on={weeksAhead === 1} />
            <Toggle
              href={`?days=${days === 7 ? 14 : 7}${weeksAhead ? `&week=${weeksAhead}` : ""}`}
              label={days === 7 ? "14 days" : "7 days"}
              on={days === 14}
            />
          </div>
        </div>

        {timelines.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="font-medium">Nothing to place yet</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-snug">
              This board is built from drivers and their assignments. Add a
              driver on the{" "}
              <Link href="/admin/drivers" className="underline underline-offset-4">
                drivers page
              </Link>{" "}
              and put them on a booking, and their week appears here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Tile
                value={`${Math.round(committed)}h`}
                label={`committed across ${timelines.length} ${timelines.length === 1 ? "driver" : "drivers"}`}
              />
              <Tile
                value={`${Math.round(standing)}h`}
                label={`standing somewhere, in ${sellable.length} ${sellable.length === 1 ? "window" : "windows"} of four hours or more`}
                tone="success"
              />
              <Tile
                value={String(unassigned)}
                label="bookings in this window with nobody on them"
                tone={unassigned > 0 ? "brand" : undefined}
              />
              <Tile
                value={String(conflicts.filter((c) => c.severity === "impossible").length)}
                label="schedules that cannot physically happen"
                tone={
                  conflicts.some((c) => c.severity === "impossible")
                    ? "destructive"
                    : undefined
                }
              />
            </div>

            {conflicts.length > 0 && (
              <div className="bg-card overflow-hidden rounded-xl border">
                <div className="border-b px-4 py-2.5">
                  <h2 className="text-sm font-semibold">
                    Schedules to fix
                  </h2>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Found by comparing what was booked against how long the road
                    actually takes.
                  </p>
                </div>
                <ul className="divide-y">
                  {conflicts.map((conflict, index) => (
                    <li key={index} className="flex gap-3 px-4 py-3">
                      {conflict.severity === "impossible" ? (
                        <AlertTriangleIcon
                          className="text-destructive mt-0.5 size-4 shrink-0"
                          aria-hidden
                        />
                      ) : (
                        <InfoIcon
                          className="text-muted-foreground mt-0.5 size-4 shrink-0"
                          aria-hidden
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm leading-snug">{conflict.message}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {conflict.driver} · {WHEN.format(conflict.at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(plan.chains.length > 0 || plan.unplaced.length > 0) && (
              <div className="bg-card overflow-hidden rounded-xl border">
                <div className="border-b px-4 py-2.5">
                  <h2 className="text-sm font-semibold">
                    Suggested assignment
                  </h2>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {plan.placed} unassigned{" "}
                    {plan.placed === 1 ? "booking" : "bookings"}, worked out
                    together rather than one at a time
                    {plan.savedKm > 1 && (
                      <>
                        {" — "}
                        <span className="text-success font-semibold">
                          {Math.round(plan.savedKm)} km less empty driving
                        </span>{" "}
                        than giving each one to the nearest free driver.
                      </>
                    )}
                    {plan.savedKm <= 1 && "."} Assign them on the{" "}
                    <Link
                      href="/admin/bookings"
                      className="underline underline-offset-4"
                    >
                      bookings page
                    </Link>
                    .
                  </p>
                </div>

                <ul className="divide-y">
                  {plan.chains.map((chain) => (
                    <li key={chain.driver.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="text-sm font-medium">
                          {chain.driver.fullName}
                        </p>
                        <p className="text-muted-foreground tabular text-xs">
                          {Math.round(chain.emptyKm)} km empty over{" "}
                          {chain.jobs.length}{" "}
                          {chain.jobs.length === 1 ? "trip" : "trips"}
                        </p>
                      </div>
                      <ol className="mt-1.5 space-y-1">
                        {chain.jobs.map((job) => (
                          <li
                            key={job.bookingId}
                            className="text-muted-foreground flex items-baseline gap-2 text-xs"
                          >
                            <span className="text-foreground font-medium">
                              {job.ref}
                            </span>
                            <span className="truncate">
                              {nodeLabel(job.from)}
                              <ArrowRightIcon
                                className="mx-1 inline size-3 align-[-1px]"
                                aria-hidden
                              />
                              {nodeLabel(job.to)}
                            </span>
                            <span className="ml-auto shrink-0 tabular">
                              {WHEN.format(job.startsAt)}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </li>
                  ))}

                  {plan.unplaced.map(({ job, reason }) => (
                    <li key={job.bookingId} className="flex gap-3 px-4 py-3">
                      <AlertTriangleIcon
                        className="text-brand mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{job.ref}</span>{" "}
                          <span className="text-muted-foreground">
                            {nodeLabel(job.from)} → {nodeLabel(job.to)},{" "}
                            {WHEN.format(job.startsAt)}
                          </span>
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {reason}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <PositionBoard timelines={timelines} from={from} days={days} />

            {offers.length > 0 && (
              <div className="bg-card overflow-hidden rounded-xl border">
                <div className="border-b px-4 py-2.5">
                  <h2 className="text-sm font-semibold">
                    What these cars could take
                  </h2>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    Priced on the extra driving only, because the rest is
                    already being paid for. These are for quoting by hand — the
                    site sells the standard fare, and it should, or nobody
                    would ever pay it.
                  </p>
                </div>
                <ul className="divide-y">
                  {offers.map((offer, index) => (
                    <li
                      key={`${offer.window.driverId}-${offer.slug}-${index}`}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {nodeLabel(offer.window.at)} → {nodeLabel(offer.to)}
                          {offer.onTheWay && (
                            <span className="bg-success-subtle text-success ml-2 rounded px-1.5 py-0.5 align-middle text-[0.65rem] font-semibold">
                              already driving this empty
                            </span>
                          )}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {offer.window.driverName} · from{" "}
                          {WHEN.format(offer.window.startsAt)} ·{" "}
                          {formatDuration(offer.outbound.minutes)} drive
                          {offer.nights > 0 &&
                            `, ${offer.nights} ${offer.nights === 1 ? "night" : "nights"} away`}
                          {offer.extraKm > 1 &&
                            ` · ${Math.round(offer.extraKm)} km more than the car was driving anyway`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="tabular text-sm font-semibold">
                          {formatNad(offer.price)}{" "}
                          <span className="text-muted-foreground font-normal line-through">
                            {formatNad(offer.standalone)}
                          </span>
                        </p>
                        <p className="text-muted-foreground tabular mt-0.5 text-xs">
                          {formatNad(offer.contribution)} to us
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {places.length > 0 && (
              <div className="bg-card overflow-hidden rounded-xl border">
                <div className="border-b px-4 py-2.5">
                  <h2 className="text-sm font-semibold">Standing capacity</h2>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Cars already paid for, already in place. Anything sold from
                    here costs only the extra driving.
                  </p>
                </div>
                <ul className="divide-y">
                  {places.map((place) => (
                    <li key={place.at.slug} className="px-4 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-medium">
                          {nodeLabel(place.at)}
                        </p>
                        <p className="tabular text-sm font-semibold">
                          {Math.round(place.hours)}h
                        </p>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                        {place.windows
                          .slice(0, 4)
                          .map(
                            (w) =>
                              `${w.driverName}, ${WHEN.format(w.startsAt)} for ${Math.round(w.hours)}h`,
                          )
                          .join(" · ")}
                        {place.windows.length > 4 &&
                          ` · and ${place.windows.length - 4} more`}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Tile({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: "success" | "destructive" | "brand";
}) {
  const colour =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "brand"
          ? "text-brand"
          : "";
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className={`tabular text-2xl leading-none font-semibold ${colour}`}>
        {value}
      </p>
      <p className="text-muted-foreground mt-2 text-xs leading-snug">{label}</p>
    </div>
  );
}

function Toggle({
  href,
  label,
  on,
}: {
  href: string;
  label: string;
  on: boolean;
}) {
  return (
    <Link
      href={href}
      className={`press rounded-md border px-3 py-1.5 text-xs font-medium transition ${
        on ? "bg-foreground text-background border-foreground" : "hover:bg-muted"
      }`}
    >
      {label}
    </Link>
  );
}
