"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { createBooking } from "@/lib/booking/actions";
import { bookingFormSchema, type BookingFormValues } from "@/lib/booking/schema";
import type { TripParams } from "@/lib/booking/trip-params";
import type { RouteView } from "@/lib/maps";

type Props = {
  trip: TripParams;
  route: RouteView;
  pickupOptions: string[];
  dropoffOptions: string[];
  utm: string;
};

/**
 * The single details step.
 *
 * Everything about the trip was decided in the widget and arrives through the
 * URL, so this asks only for what we cannot infer: who you are and where
 * exactly to meet. The Server Action is unchanged and still re-derives the
 * fare server-side — the trip values below are inputs to validate, not a price.
 */
export function BookingDetailsForm({
  trip,
  route,
  pickupOptions,
  dropoffOptions,
  utm,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const isAirport = route.category === "airport";

  /**
   * Both pick-lists start on their commonest option rather than blank. A
   * required empty select costs two taps on the shortest path, and the exact
   * spot is confirmed on WhatsApp regardless — both stay editable.
   *
   * Airport routes have a single pickup, so this is also what fills it in.
   */
  const defaultPickup = pickupOptions[0] ?? "";
  const defaultDropoff = dropoffOptions[0] ?? "";

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    mode: "onBlur",
    defaultValues: {
      // Carried from the widget — not editable here.
      routeSlug: trip.routeSlug,
      vehicleClassId: trip.vehicleClassId,
      date: trip.date,
      time: trip.time,
      passengers: trip.passengers,
      // Asked for here.
      pickupLabel: defaultPickup,
      dropoffLabel: defaultDropoff,
      luggageCount: 1,
      flightNumber: "",
      fullName: "",
      whatsapp: "",
      email: "",
      customerType: "tourist",
      notes: "",
      isReturn: false,
      acquisitionSource: "",
    },
  });

  // Keep the form in step with the URL if the visitor edits their trip and returns.
  React.useEffect(() => {
    form.setValue("routeSlug", trip.routeSlug);
    form.setValue("vehicleClassId", trip.vehicleClassId);
    form.setValue("date", trip.date);
    form.setValue("time", trip.time);
    form.setValue("passengers", trip.passengers);
    form.setValue("pickupLabel", defaultPickup);
  }, [form, trip, defaultPickup]);

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

  function onSubmit(values: BookingFormValues) {
    startTransition(async () => {
      const result = await createBooking(values);
      if (result.ok) {
        router.push(`/booking/${result.ref}`);
      } else {
        toast.error("We could not complete your booking", {
          description: result.message,
        });
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <fieldset className="space-y-4" disabled={isPending}>
          <legend className="sr-only">Your details</legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input
                      className="h-11"
                      placeholder="Lead traveller"
                      autoComplete="name"
                      enterKeyHint="next"
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
                      className="h-11"
                      type="tel"
                      inputMode="tel"
                      placeholder="+264 81 123 4567"
                      autoComplete="tel"
                      enterKeyHint="next"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Include your country code.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Curated pick-list, never free-text: Namibian addresses are sparse. */}
          <div className="grid gap-4 sm:grid-cols-2">
            {pickupOptions.length > 1 && (
              <FormField
                control={form.control}
                name="pickupLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup area</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 w-full">
                          <SelectValue placeholder="Where should we collect you?" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pickupOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="dropoffLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Drop-off area</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue placeholder="Choose an area" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {dropoffOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
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
                    onValueChange={(v) => field.onChange(Number(v))}
                    value={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.from({ length: 9 }, (_, i) => i).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isAirport && (
              <FormField
                control={form.control}
                name="flightNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flight number</FormLabel>
                    <FormControl>
                      <Input
                        className="h-11"
                        placeholder="e.g. SW704"
                        autoComplete="off"
                        autoCapitalize="characters"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Lets us hold the car if you land late.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          <FormField
            control={form.control}
            name="customerType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Booking as</FormLabel>
                <div
                  role="radiogroup"
                  aria-label="Booking as"
                  className="bg-muted grid max-w-sm grid-cols-2 gap-1 rounded-md p-1"
                >
                  {(
                    [
                      ["tourist", "Personal"],
                      ["corporate", "Business"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={field.value === value}
                      onClick={() => field.onChange(value)}
                      className={[
                        "press focus-visible:ring-ring rounded px-3 py-2 text-sm focus-visible:ring-[3px] focus-visible:outline-none",
                        field.value === value
                          ? "bg-card shadow-card font-medium"
                          : "hover:bg-card/60",
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

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Landmark or notes (optional)</FormLabel>
                <FormControl>
                  <textarea
                    rows={2}
                    placeholder="Hotel name, a nearby landmark, a child seat."
                    className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:ring-[3px] md:text-sm"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  A landmark helps your driver more than a street name.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isReturn"
            render={({ field }) => (
              <FormItem>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="accent-brand size-4"
                    />
                  </FormControl>
                  <span>
                    I also need the return trip
                    <span className="text-muted-foreground">
                      {" "}
                      — we&rsquo;ll quote it on WhatsApp
                    </span>
                  </span>
                </label>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="press bg-brand text-brand-foreground hover:bg-brand-hover h-12 w-full text-base"
        >
          {isPending && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
          {isPending ? "Confirming…" : "Confirm booking"}
        </Button>

        <p className="text-muted-foreground text-center text-xs">
          No payment now. We confirm your driver and send payment details on
          WhatsApp.
        </p>
      </form>
    </Form>
  );
}
