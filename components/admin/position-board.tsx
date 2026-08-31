import { AlertTriangleIcon, ClockIcon } from "lucide-react";

import type { DriverTimeline, Segment } from "@/lib/fleet/timeline";
import { nodeLabel } from "@/lib/network/nodes";

/**
 * Where every car is, across the days ahead.
 *
 * Read left to right it is one driver's week; read down a column it is the
 * whole fleet at one moment. The bars people should be looking at are the pale
 * ones — a car standing still is the only thing here that can still be sold,
 * and the point of the board is that the standing shows up before somebody
 * asks for it rather than after.
 */

const HOUR = 3_600_000;

function span(segment: Segment, from: Date, total: number) {
  const start = Math.max(segment.startsAt.getTime(), from.getTime());
  const end = Math.min(segment.endsAt.getTime(), from.getTime() + total);
  return {
    left: ((start - from.getTime()) / total) * 100,
    width: Math.max(0, ((end - start) / total) * 100),
    hours: (end - start) / HOUR,
  };
}

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  timeZone: "Africa/Windhoek",
});

const TIME_LABEL = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Windhoek",
});

export function PositionBoard({
  timelines,
  from,
  days,
}: {
  timelines: DriverTimeline[];
  from: Date;
  days: number;
}) {
  const total = days * 24 * HOUR;
  const dayStarts = Array.from(
    { length: days },
    (_, index) => new Date(from.getTime() + index * 24 * HOUR),
  );

  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        {/* A driver's name stays put while their week scrolls. */}
        <div style={{ minWidth: `${180 + days * 108}px` }}>
          {/* ------------------------------------------------------ days */}
          <div className="bg-muted/40 flex border-b">
            <div className="w-[180px] shrink-0 border-r px-3 py-2">
              <span className="text-muted-foreground text-xs font-medium">
                Driver
              </span>
            </div>
            <div className="flex flex-1">
              {dayStarts.map((day) => (
                <div
                  key={day.toISOString()}
                  className="flex-1 border-r px-2 py-2 text-xs font-medium last:border-r-0"
                >
                  {DAY_LABEL.format(day)}
                </div>
              ))}
            </div>
          </div>

          {/* --------------------------------------------------- drivers */}
          {timelines.map((timeline) => {
            const impossible = timeline.conflicts.filter(
              (c) => c.severity === "impossible",
            ).length;

            return (
              <div key={timeline.driverId} className="flex border-b last:border-b-0">
                <div className="w-[180px] shrink-0 border-r px-3 py-2.5">
                  <p className="truncate text-sm font-medium">
                    {timeline.driverName}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    based {nodeLabel(timeline.base)}
                    {timeline.busyHours > 0 &&
                      ` · ${Math.round(timeline.busyHours)}h committed`}
                  </p>
                  {impossible > 0 && (
                    <p className="text-destructive mt-1 flex items-center gap-1 text-xs font-medium">
                      <AlertTriangleIcon className="size-3 shrink-0" aria-hidden />
                      {impossible} cannot happen
                    </p>
                  )}
                </div>

                <div className="relative min-h-[3.25rem] flex-1">
                  {/* day gridlines, so a bar can be read against a date */}
                  <div className="pointer-events-none absolute inset-0 flex">
                    {dayStarts.map((day) => (
                      <div
                        key={day.toISOString()}
                        className="flex-1 border-r last:border-r-0"
                      />
                    ))}
                  </div>

                  {timeline.segments.map((segment, index) => {
                    const { left, width, hours } = span(segment, from, total);
                    if (width <= 0) return null;
                    return (
                      <Bar
                        key={index}
                        segment={segment}
                        left={left}
                        width={width}
                        hours={hours}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Three bar types, and only one of them is revenue. */}
      <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1.5 border-t px-4 py-2.5 text-xs">
        <span className="flex items-center gap-1.5">
          <i className="bg-brand inline-block h-3 w-4 shrink-0 rounded-sm" aria-hidden />
          On a trip
        </span>
        <span className="flex items-center gap-1.5">
          <i
            className="border-destructive/40 inline-block h-3 w-4 shrink-0 rounded-sm border border-dashed"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, color-mix(in srgb, var(--destructive) 12%, transparent) 0 4px, transparent 4px 8px)",
            }}
            aria-hidden
          />
          Driving empty
        </span>
        <span className="flex items-center gap-1.5">
          <i className="bg-success-subtle/70 border-success/30 inline-block h-3 w-4 shrink-0 rounded-sm border border-dashed" aria-hidden />
          Standing — four hours or more, and sellable
        </span>
        <span className="flex items-center gap-1.5">
          <i className="bg-muted/50 inline-block h-3 w-4 shrink-0 rounded-sm" aria-hidden />
          Standing, too short to sell
        </span>
      </div>
    </div>
  );
}

function Bar({
  segment,
  left,
  width,
  hours,
}: {
  segment: Segment;
  left: number;
  width: number;
  hours: number;
}) {
  /**
   * A 45-minute airport run is half a percent of a week and would render as
   * nothing at all. Every bar keeps a floor width so a short job is still
   * visible and still hoverable — the board is for spotting what is there,
   * and a trip you cannot see is a trip you will double-book.
   */
  const position = {
    left: `${left}%`,
    width: `${width}%`,
    minWidth: "0.75rem",
  } as const;

  /** Below this a label is a truncated stub; the tooltip carries it instead. */
  const roomForLabel = width > 3;

  if (segment.kind === "trip") {
    const where =
      segment.from && segment.to
        ? `${nodeLabel(segment.from)} → ${nodeLabel(segment.to)}`
        : segment.customerName;
    return (
      <div
        className="bg-brand text-brand-foreground absolute top-1/2 flex h-7 -translate-y-1/2 items-center overflow-hidden rounded px-1.5"
        style={position}
        title={`${segment.ref} · ${where} · ${TIME_LABEL.format(segment.startsAt)}–${TIME_LABEL.format(segment.endsAt)}`}
      >
        {roomForLabel && (
          <span className="truncate text-[0.68rem] leading-none font-medium">
            {segment.ref}
          </span>
        )}
      </div>
    );
  }

  if (segment.kind === "reposition") {
    // Empty running. Striped rather than solid because it is cost, not work —
    // every one of these bars is a car being paid for with nobody in it.
    return (
      <div
        className="border-destructive/40 text-destructive absolute top-1/2 flex h-7 -translate-y-1/2 items-center overflow-hidden rounded border border-dashed px-1.5"
        style={{
          ...position,
          backgroundImage:
            "repeating-linear-gradient(45deg, color-mix(in srgb, var(--destructive) 12%, transparent) 0 4px, transparent 4px 8px)",
        }}
        title={`Empty: ${nodeLabel(segment.from)} → ${nodeLabel(segment.to)}, ${Math.round(segment.km)} km`}
      >
        {roomForLabel && (
          <span className="truncate text-[0.68rem] leading-none font-medium">
            {Math.round(segment.km)} km empty
          </span>
        )}
      </div>
    );
  }

  // Idle. Only labelled once it is long enough to actually sell.
  const sellable = hours >= 4 && segment.at !== null;
  return (
    <div
      className={`absolute top-1/2 flex h-7 -translate-y-1/2 items-center overflow-hidden rounded px-1.5 ${
        sellable ? "bg-success-subtle/70 border-success/30 border border-dashed" : "bg-muted/50"
      }`}
      style={position}
      title={
        segment.at
          ? `Standing at ${nodeLabel(segment.at)} for ${Math.round(hours)}h`
          : `Standing for ${Math.round(hours)}h`
      }
    >
      {sellable && roomForLabel && (
        <span className="text-success flex items-center gap-1 truncate text-[0.68rem] leading-none font-medium">
          <ClockIcon className="size-2.5 shrink-0" aria-hidden />
          {Math.round(hours)}h {segment.at ? nodeLabel(segment.at) : ""}
        </span>
      )}
    </div>
  );
}
