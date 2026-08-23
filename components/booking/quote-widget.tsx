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
import type { TripState } from "@/components/booking/use-trip";
import { defaultTripDate, TIME_SLOTS } from "@/lib/booking/trip-params";
import { formatDuration } from "@/lib/format";
import { formatNad } from "@/lib/money";
import { routeTitle } from "@/lib/route-content";
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
}: {
  trip: TripState;
  routes: RouteView[];
}) {
  const animatedPrice = useCountUp(trip.price);
  const duration = formatDuration(trip.route.durationMin);

  return (
    <div
      id="quote"
      className="bg-card shadow-raised scroll-mt-20 rounded-xl border p-4 sm:p-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Route spans the row: it is the decision everything else follows. */}
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

        <Field label="Date" htmlFor="q-date">
          <input
            id="q-date"
            type="date"
            value={trip.date}
            min={defaultTripDate()}
            onChange={(e) => trip.setDate(e.target.value)}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 press h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          />
        </Field>

        <Field label="Time" htmlFor="q-time">
          <Select value={trip.time} onValueChange={trip.setTime}>
            <SelectTrigger id="q-time" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map((slot) => (
                <SelectItem key={slot} value={slot}>
                  {slot}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

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
                )
              )}
            </SelectContent>
          </Select>
        </Field>

        <VehicleToggle trip={trip} />
      </div>

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
            per vehicle, up to {trip.vehicleClass.capacity} passengers
            {duration ? ` · about ${duration}` : ""}
          </p>
        </div>

        <Button
          asChild
          size="lg"
          className="press bg-brand text-brand-foreground hover:bg-brand-hover h-12 w-full shrink-0 text-base sm:w-auto"
        >
          <Link href={trip.href}>
            Continue to booking
            <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Both classes show their price, so choosing is a comparison, not a guess. */
export function VehicleToggle({ trip }: { trip: TripState }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-muted-foreground text-xs font-medium">Vehicle</span>
      <div
        role="radiogroup"
        aria-label="Vehicle class"
        className="bg-muted grid grid-cols-2 gap-1 rounded-md p-1"
      >
        {trip.vehicleClasses.map((vehicleClass) => {
          const { id, name, capacity } = vehicleClass;
          const isSelected = id === trip.vehicleClass.id;
          const fare = trip.fares.get(id) ?? 0;
          const tooSmall = capacity < trip.passengers;

          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${name}, ${formatNad(fare)}, up to ${capacity} passengers`}
              disabled={tooSmall}
              onClick={() => trip.setVehicleClassId(id)}
              className={[
                "press focus-visible:ring-ring rounded px-2 py-1.5 text-left focus-visible:ring-[3px] focus-visible:outline-none disabled:opacity-40",
                isSelected ? "bg-card shadow-card" : "hover:bg-card/60",
              ].join(" ")}
            >
              <span className="block truncate text-xs font-medium">{name}</span>
              <span className="tabular block text-xs font-semibold">
                {formatNad(fare)}
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
