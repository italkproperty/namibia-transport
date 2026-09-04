"use client";

import * as React from "react";
import { MinusIcon, PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDuration } from "@/lib/format";
import { formatNad } from "@/lib/money";
import {
  ITINERARY_PRESETS,
  REMAINING_EXCESS,
  SELF_DRIVE_CLASSES,
  WAIVER_PER_DAY,
  planItinerary,
  selfDriveCost,
  type ItineraryStop,
} from "@/lib/network/itinerary";
import { nodeLabel, nodesByRegion, REGION_LABELS } from "@/lib/network/nodes";

/**
 * The comparison, computed rather than claimed.
 *
 * Everything here runs in the browser from the same road model the rest of
 * the site prices with, so changing a night recalculates both columns in the
 * same frame. The hire-car figures start from quoted 2026 rates and are then
 * the reader's to overwrite — a comparison against the quote they have
 * actually been given is worth more than one against ours, and it is the only
 * version that stays true as rates move.
 */
export function SelfDrivePlanner({ whatsappHref }: { whatsappHref: string | null }) {
  const [stops, setStops] = React.useState<ItineraryStop[]>(
    ITINERARY_PRESETS[0].stops,
  );
  const [presetId, setPresetId] = React.useState(ITINERARY_PRESETS[0].id);
  const [classId, setClassId] = React.useState(SELF_DRIVE_CLASSES[1].id);
  const [dayRate, setDayRate] = React.useState(SELF_DRIVE_CLASSES[1].dayRate);
  const [edited, setEdited] = React.useState(false);

  const groups = React.useMemo(() => nodesByRegion(), []);
  const vehicle =
    SELF_DRIVE_CLASSES.find((c) => c.id === classId) ?? SELF_DRIVE_CLASSES[1];

  const itinerary = React.useMemo(() => planItinerary(stops), [stops]);

  function applyPreset(id: string) {
    const preset = ITINERARY_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setStops(preset.stops);
  }

  function chooseVehicle(id: string) {
    const next = SELF_DRIVE_CLASSES.find((c) => c.id === id);
    if (!next) return;
    setClassId(id);
    setDayRate(next.dayRate);
    setEdited(false);
  }

  function setNights(index: number, nights: number) {
    setPresetId("");
    setStops((current) =>
      current.map((stop, i) =>
        i === index ? { ...stop, nights: Math.max(0, nights) } : stop,
      ),
    );
  }

  function removeStop(index: number) {
    setPresetId("");
    setStops((current) => current.filter((_, i) => i !== index));
  }

  function addStop(slug: string) {
    setPresetId("");
    setStops((current) => {
      // Before the final leg home, which is where a stop is actually added.
      const at = Math.max(1, current.length - 1);
      const next = [...current];
      next.splice(at, 0, { slug, nights: 2 });
      return next;
    });
  }

  if (!itinerary) {
    return (
      <div className="bg-card rounded-xl border p-6 text-center">
        <p className="font-medium">That itinerary does not join up</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
          Two of those places have no road between them in our network. Remove
          one, or{" "}
          <button
            type="button"
            onClick={() => applyPreset(ITINERARY_PRESETS[0].id)}
            className="underline underline-offset-4"
          >
            start again from the classic route
          </button>
          .
        </p>
      </div>
    );
  }

  const self = selfDriveCost(itinerary, {
    dayRate,
    fuelPerKm: vehicle.fuelPerKm,
    waiverPerDay: WAIVER_PER_DAY,
  });
  const ours = itinerary.chauffeured.price;
  const difference = self.total - ours;
  const totalKm = Math.round(itinerary.km + itinerary.localKm);

  const message = [
    `Hi — I would like this quoted.`,
    ``,
    itinerary.stops
      .map(
        (s) =>
          `${nodeLabel(s.node)}${
            s.nights ? ` (${s.nights} ${s.nights === 1 ? "night" : "nights"})` : ""
          }`,
      )
      .join(" → "),
    ``,
    `${itinerary.days} days, ${Math.round(itinerary.km).toLocaleString()} km of driving.`,
  ].join("\n");
  const enquiry = whatsappHref
    ? `${whatsappHref}${whatsappHref.includes("?") ? "&" : "?"}text=${encodeURIComponent(message)}`
    : null;

  return (
    <div className="grid gap-4">
      {/* ------------------------------------------------- the itinerary */}
      <div className="bg-card rounded-xl border p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium">
            Start from
          </span>
          {ITINERARY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              aria-pressed={presetId === preset.id}
              className={`press rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                presetId === preset.id
                  ? "bg-foreground text-background border-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>

        <ul className="mt-4 grid gap-1.5">
          {itinerary.stops.map((stop, index) => {
            const isEnd = index === 0 || index === itinerary.stops.length - 1;
            return (
              <li
                key={`${stop.node.slug}-${index}`}
                className="flex items-center gap-3 rounded-md border px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {nodeLabel(stop.node)}
                </span>

                {isEnd ? (
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {index === 0 ? "arrive" : "depart"}
                  </span>
                ) : (
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton
                      label={`One fewer night at ${nodeLabel(stop.node)}`}
                      onClick={() => setNights(index, stop.nights - 1)}
                      disabled={stop.nights === 0}
                    >
                      <MinusIcon className="size-3.5" aria-hidden />
                    </IconButton>
                    <span className="tabular w-16 text-center text-xs">
                      {stop.nights} {stop.nights === 1 ? "night" : "nights"}
                    </span>
                    <IconButton
                      label={`One more night at ${nodeLabel(stop.node)}`}
                      onClick={() => setNights(index, stop.nights + 1)}
                    >
                      <PlusIcon className="size-3.5" aria-hidden />
                    </IconButton>
                    <IconButton
                      label={`Remove ${nodeLabel(stop.node)}`}
                      onClick={() => removeStop(index)}
                    >
                      <XIcon className="size-3.5" aria-hidden />
                    </IconButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-3 grid gap-1.5">
          <label htmlFor="add-stop" className="text-muted-foreground text-xs font-medium">
            Add somewhere
          </label>
          <Select value="" onValueChange={addStop}>
            <SelectTrigger id="add-stop" className="h-10 w-full sm:max-w-xs">
              <SelectValue placeholder="Choose a place" />
            </SelectTrigger>
            <SelectContent className="max-h-[20rem]">
              {groups.map((group) => (
                <SelectGroup key={group.region}>
                  <SelectLabel>{REGION_LABELS[group.region]}</SelectLabel>
                  {group.nodes.map((node) => (
                    <SelectItem key={node.slug} value={node.slug}>
                      {nodeLabel(node)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-muted-foreground mt-4 border-t pt-3 text-sm">
          <span className="tabular text-foreground font-medium">
            {itinerary.days} days
          </span>
          {" · "}
          <span className="tabular text-foreground font-medium">
            {totalKm.toLocaleString()} km
          </span>{" "}
          of driving, {Math.round(itinerary.gravelKm).toLocaleString()} km of it
          gravel, about{" "}
          {formatDuration(itinerary.drivingMinutes)} behind the wheel between
          stops — plus roughly {itinerary.localKm.toLocaleString()} km of local running
          once you are there.
        </p>
      </div>

      {/* ------------------------------------------------ the comparison */}
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        {/* ---------------------------------------------------- self-drive */}
        <div className="bg-card rounded-xl border p-4 sm:p-5">
          <h3 className="text-base font-semibold">Drive it yourself</h3>

          <div className="mt-3 grid gap-1.5">
            <label htmlFor="sd-class" className="text-muted-foreground text-xs font-medium">
              What you would hire
            </label>
            <Select value={classId} onValueChange={chooseVehicle}>
              <SelectTrigger id="sd-class" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SELF_DRIVE_CLASSES.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs leading-snug">{vehicle.note}</p>
          </div>

          <div className="mt-3 grid gap-1.5">
            <label htmlFor="sd-rate" className="text-muted-foreground text-xs font-medium">
              Day rate — put your own quote in
            </label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">N$</span>
              <input
                id="sd-rate"
                type="number"
                inputMode="numeric"
                min={0}
                step={50}
                value={dayRate}
                onChange={(e) => {
                  setDayRate(Math.max(0, Number(e.target.value) || 0));
                  setEdited(true);
                }}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 press tabular h-10 w-32 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              />
              <span className="text-muted-foreground text-xs">
                {edited ? "your quote" : "quoted 2026 rate"}
              </span>
            </div>
          </div>

          <dl className="mt-4 space-y-1.5 border-t pt-3 text-sm">
            <Row label={`Vehicle, ${itinerary.days} days`}>{formatNad(self.vehicle)}</Row>
            <Row label={`Tyre and glass cover, N$${WAIVER_PER_DAY}/day`}>
              {formatNad(self.waiver)}
            </Row>
            <Row label={`Fuel, ${totalKm.toLocaleString()} km`}>{formatNad(self.fuel)}</Row>
          </dl>

          <div className="mt-3 border-t pt-3">
            <p className="text-muted-foreground text-xs font-medium">You pay</p>
            <p className="tabular text-3xl leading-none font-semibold tracking-tight">
              {formatNad(self.total)}
            </p>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              And you still carry{" "}
              <span className="tabular text-foreground font-medium">
                {formatNad(REMAINING_EXCESS)}
              </span>{" "}
              of excess on {Math.round(itinerary.gravelKm).toLocaleString()} km of
              gravel. The cover pays for two tyres and one windscreen; a rollover
              or an underbody strike is yours.
            </p>
          </div>
        </div>

        {/* ------------------------------------------------------- with us */}
        <div className="bg-brand-subtle/45 rounded-xl border p-4 sm:p-5">
          <h3 className="text-base font-semibold">We drive it</h3>
          <p className="text-muted-foreground mt-1 text-sm leading-snug">
            One driver and one vehicle for the whole trip, including the local
            running once you are there.
          </p>

          <dl className="mt-4 space-y-1.5 border-t pt-3 text-sm">
            <Row label={`Driver, ${itinerary.days} days and ${itinerary.nights} nights`}>
              included
            </Row>
            <Row label={`Vehicle and fuel, ${totalKm.toLocaleString()} km`}>included</Row>
            <Row label="Damage excess you carry">
              <span className="text-success font-medium">none</span>
            </Row>
          </dl>

          <div className="mt-3 border-t pt-3">
            <p className="text-muted-foreground text-xs font-medium">You pay</p>
            <p className="tabular text-brand text-3xl leading-none font-semibold tracking-tight">
              {formatNad(ours)}
            </p>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              {difference > 0 ? (
                <>
                  <span className="text-success font-semibold">
                    {formatNad(difference)} less
                  </span>{" "}
                  than driving it yourself, and nobody in your party spends{" "}
                  {itinerary.days} days on gravel.
                </>
              ) : (
                <>
                  <span className="text-foreground font-medium">
                    {formatNad(-difference)} more
                  </span>{" "}
                  than driving it yourself. What the difference buys is that
                  nobody in your party drives{" "}
                  {Math.round(itinerary.gravelKm).toLocaleString()} km of gravel,
                  and no deposit is at risk.
                </>
              )}
            </p>
          </div>

          <div className="mt-4 grid gap-2">
            {enquiry ? (
              <Button
                asChild
                size="lg"
                className="press bg-brand text-brand-foreground hover:bg-brand-hover h-12 w-full text-base"
              >
                <a href={enquiry} target="_blank" rel="noopener noreferrer">
                  Get this itinerary quoted
                </a>
              </Button>
            ) : (
              <Button asChild size="lg" className="press h-12 w-full text-base">
                <a href="/contact">Get this itinerary quoted</a>
              </Button>
            )}
            <p className="text-muted-foreground text-center text-xs leading-snug">
              A multi-day trip is quoted by hand, not booked online. The figure
              above is what the arithmetic says; we confirm it against your
              actual dates before you pay anything.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular text-right font-medium">{children}</dd>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="border-input hover:bg-muted press focus-visible:ring-ring inline-flex size-7 items-center justify-center rounded border transition focus-visible:ring-[3px] focus-visible:outline-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}
