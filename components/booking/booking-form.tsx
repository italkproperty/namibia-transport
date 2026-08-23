"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2Icon, PlaneIcon, UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createBooking } from "@/lib/booking/actions";
import { bookingFormSchema, type BookingFormValues } from "@/lib/booking/schema";
import { namibianToday } from "@/lib/booking/time";
import { formatDuration } from "@/lib/format";
import type { RouteView, VehicleClassView } from "@/lib/maps";
import { formatNad } from "@/lib/money";
import { computeFare } from "@/lib/pricing";
import { routeTitle } from "@/lib/route-content";

export type RouteOption = {
  route: RouteView;
  pickupOptions: string[];
  dropoffOptions: string[];
};

type Props = {
  routeOptions: RouteOption[];
  vehicleClasses: VehicleClassView[];
  initialRouteSlug: string;
  utm: string;
};

/** Half-hour slots. Enough granularity for a transfer, short enough to scan. */
const TIME_SLOTS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromIsoDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function BookingForm({
  routeOptions,
  vehicleClasses,
  initialRouteSlug,
  utm,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    mode: "onBlur",
    defaultValues: {
      routeSlug: initialRouteSlug,
      vehicleClassId: vehicleClasses[0]?.id ?? "",
      date: "",
      time: "12:00",
      passengers: 1,
      luggageCount: 1,
      flightNumber: "",
      fullName: "",
      whatsapp: "",
      email: "",
      customerType: "tourist",
      pickupLabel: "",
      dropoffLabel: "",
      notes: "",
      isReturn: false,
      acquisitionSource: "",
    },
  });

  const selectedSlug = form.watch("routeSlug");
  const selectedClassId = form.watch("vehicleClassId");
  const passengers = form.watch("passengers");

  const selected = React.useMemo(
    () =>
      routeOptions.find((option) => option.route.slug === selectedSlug) ??
      routeOptions[0],
    [routeOptions, selectedSlug]
  );

  const vehicleClass = React.useMemo(
    () =>
      vehicleClasses.find((item) => item.id === selectedClassId) ??
      vehicleClasses[0],
    [vehicleClasses, selectedClassId]
  );

  const isAirportRoute = selected?.route.category === "airport";

  /**
   * Preview only. The Server Action re-derives this from the database and
   * ignores anything the browser believes — the form submits no price field.
   */
  const preview = React.useMemo(() => {
    if (!selected || !vehicleClass) return null;
    return computeFare(selected.route, vehicleClass);
  }, [selected, vehicleClass]);

  // Attribution: campaign tags if present, otherwise where the visitor came from.
  React.useEffect(() => {
    if (utm) {
      form.setValue("acquisitionSource", utm);
      return;
    }
    const referrer = document.referrer;
    if (!referrer) {
      form.setValue("acquisitionSource", "direct");
      return;
    }
    try {
      const { host } = new URL(referrer);
      form.setValue(
        "acquisitionSource",
        host === window.location.host ? "direct" : `referrer:${host}`
      );
    } catch {
      form.setValue("acquisitionSource", "direct");
    }
  }, [form, utm]);

  // Pickup and dropoff lists change with the route, so reset stale choices.
  React.useEffect(() => {
    if (!selected) return;
    const onlyPickup =
      selected.pickupOptions.length === 1 ? selected.pickupOptions[0] : "";
    form.setValue("pickupLabel", onlyPickup);
    form.setValue("dropoffLabel", "");
    if (!isAirportRoute) form.setValue("flightNumber", "");
  }, [form, selected, isAirportRoute]);

  function onSubmit(values: BookingFormValues) {
    startTransition(async () => {
      const result = await createBooking(values);

      if (result.ok) {
        toast.success("Booking received", {
          description: `Reference ${result.ref}`,
        });
        router.push(`/booking/${result.ref}`);
      } else {
        toast.error("We could not complete your booking", {
          description: result.message,
        });
      }
    });
  }

  if (!selected || !vehicleClass) return null;

  const maxPassengers = Math.max(
    ...vehicleClasses.map((item) => item.capacity)
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-10 lg:grid-cols-[1fr_21rem] lg:items-start"
        noValidate
      >
        <div className="space-y-10">
          {/* ------------------------------------------------------- the trip */}
          <fieldset className="space-y-6" disabled={isPending}>
            <legend className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Your trip
            </legend>

            <FormField
              control={form.control}
              name="routeSlug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Route</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a route" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {routeOptions.map(({ route }) => (
                        <SelectItem key={route.slug} value={route.slug}>
                          {routeTitle(route)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="pickupLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup point</FormLabel>
                    {selected.pickupOptions.length === 1 ? (
                      <FormControl>
                        <Input readOnly value={selected.pickupOptions[0]} />
                      </FormControl>
                    ) : (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Where should we collect you?" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {selected.pickupOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dropoffLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an area" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selected.dropoffOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Pick the closest area — add the exact place in the notes
                      below.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="pickup-date">Pickup date</FormLabel>
                    <DatePicker
                      id="pickup-date"
                      value={fromIsoDate(field.value)}
                      onChange={(date) =>
                        field.onChange(date ? toIsoDate(date) : "")
                      }
                      placeholder="Choose a date"
                      disabledDates={{
                        before: new Date(`${namibianToday()}T00:00:00`),
                      }}
                      aria-invalid={Boolean(form.formState.errors.date)}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup time</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIME_SLOTS.map((slot) => (
                          <SelectItem key={slot} value={slot}>
                            {slot}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Namibian time (UTC+2).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isAirportRoute && (
              <FormField
                control={form.control}
                name="flightNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <PlaneIcon className="size-4" aria-hidden />
                      Flight number
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. SW704"
                        autoComplete="off"
                        autoCapitalize="characters"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional, but it lets us track your flight and hold the
                      car if you land late.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </fieldset>

          <Separator />

          {/* --------------------------------------------------- the vehicle */}
          <fieldset className="space-y-6" disabled={isPending}>
            <legend className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Vehicle &amp; party
            </legend>

            <FormField
              control={form.control}
              name="vehicleClassId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicle</FormLabel>
                  <div
                    role="radiogroup"
                    aria-label="Vehicle"
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    {vehicleClasses.map((item) => {
                      const isSelected = item.id === field.value;
                      const itemFare = computeFare(selected.route, item);
                      const tooSmall = passengers > item.capacity;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => field.onChange(item.id)}
                          className={[
                            "focus-visible:ring-ring rounded-xl border p-4 text-left transition focus-visible:ring-[3px] focus-visible:outline-none",
                            isSelected
                              ? "border-foreground bg-accent/40"
                              : "border-border hover:border-foreground/30",
                            tooSmall ? "opacity-60" : "",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="font-medium tracking-tight">
                              {item.name}
                            </span>
                            <span className="tabular text-sm font-semibold">
                              {formatNad(itemFare.customerPrice)}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs">
                            Up to {item.capacity} passengers ·{" "}
                            {item.luggageCapacity} bags
                          </p>
                          {tooSmall && (
                            <p className="text-destructive mt-2 text-xs">
                              Too small for {passengers} passengers
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="passengers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <UsersIcon className="size-4" aria-hidden />
                      Passengers
                    </FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from(
                          { length: maxPassengers },
                          (_, i) => i + 1
                        ).map((count) => (
                          <SelectItem key={count} value={String(count)}>
                            {count}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="luggageCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bags</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from({ length: 9 }, (_, i) => i).map((count) => (
                          <SelectItem key={count} value={String(count)}>
                            {count}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isReturn"
              render={({ field }) => (
                <FormItem>
                  <label className="border-border hover:border-foreground/30 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(event) =>
                          field.onChange(event.target.checked)
                        }
                        className="accent-foreground mt-0.5 size-4"
                      />
                    </FormControl>
                    <span>
                      <span className="text-sm font-medium">
                        I also need the return trip
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        We will quote the return leg on WhatsApp — it is not
                        added to this price.
                      </span>
                    </span>
                  </label>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

          <Separator />

          {/* --------------------------------------------------------- about */}
          <fieldset className="space-y-6" disabled={isPending}>
            <legend className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              About you
            </legend>

            <FormField
              control={form.control}
              name="customerType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Booking as</FormLabel>
                  <div role="radiogroup" aria-label="Booking as" className="flex gap-2">
                    {(
                      [
                        ["tourist", "Personal / leisure"],
                        ["corporate", "Business account"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={field.value === value}
                        onClick={() => field.onChange(value)}
                        className={[
                          "focus-visible:ring-ring rounded-full border px-4 py-2 text-sm transition focus-visible:ring-[3px] focus-visible:outline-none",
                          field.value === value
                            ? "border-foreground bg-accent/40 font-medium"
                            : "border-border hover:border-foreground/30",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Lead traveller"
                        autoComplete="name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp number</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        inputMode="tel"
                        placeholder="+264 81 123 4567"
                        autoComplete="tel"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Include your country code — this is how we confirm.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Landmark or notes (optional)</FormLabel>
                  <FormControl>
                    <textarea
                      rows={3}
                      placeholder="Hotel name, a nearby landmark, a child seat, anything we should know."
                      className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Namibian street addresses can be hard to find — a landmark
                    helps your driver more than a street name.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>
        </div>

        {/* ------------------------------------------------------- summary */}
        <aside className="lg:sticky lg:top-24">
          <div className="border-border/70 bg-card rounded-2xl border p-6 shadow-[0_2px_24px_-12px_oklch(0_0_0/0.18)]">
            <h2 className="font-display text-xl">Your booking</h2>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Route</dt>
                <dd className="text-right font-medium">
                  {routeTitle(selected.route)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Vehicle</dt>
                <dd className="text-right font-medium">{vehicleClass.name}</dd>
              </div>
              {selected.route.durationMin && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Journey</dt>
                  <dd className="text-right font-medium">
                    about {formatDuration(selected.route.durationMin)}
                  </dd>
                </div>
              )}
            </dl>

            <Separator className="my-5" />

            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  Total
                </p>
                <p className="tabular mt-1 text-3xl font-semibold tracking-tight">
                  {preview ? formatNad(preview.customerPrice) : "—"}
                </p>
              </div>
              <Badge variant="secondary">Fixed</Badge>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Per vehicle, not per person. Confirmed server-side when you book.
            </p>

            <Button
              type="submit"
              size="lg"
              className="mt-6 w-full"
              disabled={isPending}
            >
              {isPending && (
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
              )}
              {isPending ? "Sending…" : "Confirm booking"}
            </Button>

            <p
              className="text-muted-foreground mt-4 text-xs leading-relaxed"
              aria-live="polite"
            >
              No payment is taken now. We will confirm your driver and send
              payment details on WhatsApp.
            </p>
          </div>
        </aside>
      </form>
    </Form>
  );
}
