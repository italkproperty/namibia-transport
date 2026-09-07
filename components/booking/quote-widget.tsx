"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCountUp } from "@/components/booking/use-count-up";
import { VehicleImage } from "@/components/vehicles/vehicle-image";
import type { TripState } from "@/components/booking/use-trip";
import { formatDuration } from "@/lib/format";
import { formatNad } from "@/lib/money";
import { routeTitle } from "@/lib/route-content";
import { specFor } from "@/lib/vehicles";
import type { RouteView } from "@/lib/maps";

/**
 * The home page's primary control.
 *
 * A price is on screen at first paint — no route needs choosing, because one
 * is already chosen. Every input recalculates immediately, and the only button
 * carries the trip forward in the URL rather than submitting anything, so
 * starting a booking is one click from a cold load.
 */
export function QuoteWidget({
  trip,
  routes,
  lockRoute = false,
  cta = "Continue to booking",
  className,
}: {
  trip: TripState;
  routes: RouteView[];
  /** Route pages already committed to a route; only the rest is adjustable. */
  lockRoute?: boolean;
  cta?: string;
  className?: string;
}) {
  const animatedPrice = useCountUp(trip.price);
  const duration = formatDuration(trip.route.durationMin);

  return (
    <div
      id="quote"
      className={`bg-card shadow-raised scroll-mt-20 rounded-xl border p-4 sm:p-5 ${className ?? ""}`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Route spans the row: it is the decision everything else follows. */}
        {!lockRoute && (
          <Field label="Route" htmlFor="q-route" className="sm:col-span-2">
            <Select value={trip.routeSlug} onValueChange={trip.setRouteSlug}>
              <SelectTrigger id="q-route" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {routes.map((r) => (
                  <SelectItem key={r.slug} value={r.slug}>
                    {routeTitle(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {/* Date and time are asked for on the booking screen, not here. They
            do not move the price by a cent, so collecting them before showing
            one is the form's convenience rather than the visitor's. Large
            cases ARE asked here: they can force the bigger vehicle and change
            the price, and a price must never change after commitment. */}
        <Field label="Passengers" htmlFor="q-pax">
          <Select
            value={String(trip.passengers)}
            onValueChange={(v) => trip.setPassengers(Number(v))}
          >
            <SelectTrigger id="q-pax" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: trip.maxPassengers }, (_, i) => i + 1).map(
                (n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ),
              )}
              <SelectItem value={String(trip.maxPassengers + 1)}>
                {trip.maxPassengers + 1}+
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Large cases" htmlFor="q-bags">
          <Select
            value={String(Math.min(trip.luggage, 5))}
            onValueChange={(v) => trip.setLuggage(Number(v))}
          >
            <SelectTrigger id="q-bags" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
              <SelectItem value="5">5+</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <VehicleToggle trip={trip} />
        </div>
      </div>

      {trip.overCapacity ? (
        <div className="mt-4 border-t pt-4">
          <p className="text-sm leading-relaxed text-pretty">
            <span className="font-semibold">
              That party needs more than one vehicle.
            </span>{" "}
            Our largest seats {trip.maxPassengers} with{" "}
            {Math.max(...trip.vehicleClasses.map((c) => c.luggageCapacity))}{" "}
            large cases — tell us the trip and we will quote it properly,
            usually with two vehicles or a minibus partner.
          </p>
          <Button
            asChild
            size="lg"
            className="press bg-brand text-brand-foreground hover:bg-brand-hover mt-3 h-12 w-full text-base sm:w-auto"
          >
            <Link href="/contact">
              Get a group quote
              <ArrowRightIcon className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      ) : (
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t pt-4">
        <div>
          <p className="text-muted-foreground text-xs font-medium">
            Total, all in
          </p>
          {/* price-slot reserves the line box so a quote never shifts the page. */}
          <p
            className="tabular price-slot text-brand text-3xl leading-none font-semibold tracking-tight sm:text-4xl"
            aria-live="polite"
          >
            {formatNad(animatedPrice)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {`per vehicle, up to ${trip.vehicleClass.capacity} passengers`}
            {duration ? ` · about ${duration}` : ""}
          </p>
        </div>

        <Button
          asChild
          size="lg"
          className="press bg-brand text-brand-foreground hover:bg-brand-hover h-12 w-full shrink-0 text-base sm:w-auto"
        >
          <Link href={trip.href}>
            {cta}
            <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
      )}
    </div>
  );
}

/**
 * Both classes show their price and their shape, so choosing is a comparison
 * rather than a guess. The picture is doing real work here: "Private Car" and
 * "SUV / 4x4" are two strings, but a low car beside a tall one on big wheels
 * says what the extra money buys without being read. It shows the same
 * photograph the vehicles section does — this is the surface most people
 * actually look at, so it is the last place that should differ.
 */
export function VehicleToggle({ trip }: { trip: TripState }) {
  const group = React.useRef<HTMLDivElement | null>(null);

  /**
   * A radiogroup is one tab stop, and the arrow keys move within it. The
   * markup already claimed those roles; without this the group was five tab
   * stops and the arrow keys did nothing, so a keyboard user got a control
   * that announced one behaviour and performed another. Disabled options are
   * skipped, because a vehicle too small for the party is not a choice.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;

    const options = trip.vehicleClasses.filter(
      (c) =>
        c.capacity >= trip.passengers && c.luggageCapacity >= trip.luggage,
    );
    if (options.length < 2) return;

    event.preventDefault();
    const at = options.findIndex((c) => c.id === trip.vehicleClass.id);
    const next = options[(at + step + options.length) % options.length];
    trip.setVehicleClassId(next.id);

    // Selection follows focus in a radiogroup, so focus has to follow it back.
    group.current
      ?.querySelector<HTMLButtonElement>(`[data-class-id="${next.id}"]`)
      ?.focus();
  };

  return (
    <div className="grid gap-1.5">
      <span className="text-muted-foreground text-xs font-medium">Vehicle</span>
      <div
        ref={group}
        role="radiogroup"
        aria-label="Vehicle class"
        onKeyDown={onKeyDown}
        className="bg-muted grid grid-cols-2 gap-1 rounded-md p-1"
      >
        {trip.vehicleClasses.map((vehicleClass) => {
          const { id, name, capacity } = vehicleClass;
          const isSelected = id === trip.vehicleClass.id;
          const fare = trip.fares.get(id) ?? 0;
          // Disabled when it cannot carry the party — people or luggage.
          // The seats/cases line below stays visible, so the card itself
          // says why it is greyed out.
          const tooSmall =
            capacity < trip.passengers ||
            vehicleClass.luggageCapacity < trip.luggage;
          const spec = specFor(vehicleClass.slug);

          return (
            <button
              key={id}
              type="button"
              role="radio"
              data-class-id={id}
              aria-checked={isSelected}
              // Only the checked option is in the tab order; the arrow keys
              // reach the rest. Announcing the fare here and a different one
              // in the visible line below is how a screen-reader user ends up
              // quoted a price the page never showed, so both read
              // `unitFares` — the number actually on screen.
              tabIndex={isSelected ? 0 : -1}
              aria-label={`${name}, ${formatNad(trip.unitFares.get(id) ?? fare)} ${trip.unitLabel}, seats ${capacity}, ${vehicleClass.luggageCapacity} large cases`}
              disabled={tooSmall}
              onClick={() => trip.setVehicleClassId(id)}
              className={[
                // 40% put the "seats 3 · 2 large cases" line — the text that
                // says *why* the option is unavailable — at 1.75:1. Measured
                // at 4.9:1 now, and still plainly dimmed.
                "press focus-visible:ring-ring rounded px-2 py-1.5 text-left focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-[0.65]",
                isSelected ? "bg-card shadow-card" : "hover:bg-card/60",
              ].join(" ")}
            >
              {spec && (
                <VehicleImage
                  spec={spec}
                  alt=""
                  className={
                    isSelected
                      ? "mx-auto max-w-[6rem]"
                      : "mx-auto max-w-[6rem] opacity-60"
                  }
                />
              )}
              {/* Wraps rather than truncates: the rail is narrow and the name matters. */}
              <span className="block text-xs leading-tight font-medium">
                {name}
              </span>
              <span className="tabular mt-0.5 block text-xs font-semibold">
                {formatNad(trip.unitFares.get(id) ?? fare)}
                <span className="text-muted-foreground font-normal">
                  {" "}
                  {trip.unitLabel}
                </span>
              </span>
              <span className="text-muted-foreground mt-0.5 block text-[0.68rem] leading-tight">
                Seats {capacity} · {vehicleClass.luggageCapacity} large cases
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label
        htmlFor={htmlFor}
        className="text-muted-foreground text-xs font-medium"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}
