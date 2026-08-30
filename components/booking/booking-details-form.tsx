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
import { PinDrop } from "@/components/booking/pin-drop";
import { PlacePicker } from "@/components/booking/place-picker";
import { createBooking } from "@/lib/booking/actions";
import type { Place } from "@/lib/places";
import {
  bookingFormSchema,
  type BookingFormValues,
} from "@/lib/booking/schema";
import type { TripParams } from "@/lib/booking/trip-params";
import type { RouteView } from "@/lib/maps";

type Props = {
  trip: TripParams;
  route: RouteView;
  pickupPlaces: Place[];
  dropoffPlaces: Place[];
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
  pickupPlaces,
  dropoffPlaces,
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
  // Default to a neutral area, never to a named property. Hotels sort first
  // in the picker because that is what people search for, but pre-filling
  // someone's booking with "Hilton Windhoek" puts a destination they never
  // chose onto a real trip.
  const firstNeutral = (places: Place[]) =>
    (places.find((place) => place.kind === "area") ?? places[0])?.name ?? "";

  const defaultPickup = firstNeutral(pickupPlaces);
  const defaultDropoff = firstNeutral(dropoffPlaces);

  /**
   * Where the pin map opens before anything is dropped: the end of the route
   * it refines. Opening on the middle of the country would make every pin a
   * long drag, and a long drag is where mistakes come from.
   */
  const originCentre =
    route.originLat !== null && route.originLng !== null
      ? { lat: route.originLat, lng: route.originLng }
      : null;
  const destinationCentre =
    route.destinationLat !== null && route.destinationLng !== null
      ? { lat: route.destinationLat, lng: route.destinationLng }
      : null;

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
      pickupPin: null,
      dropoffPin: null,
      isReturn: false,
      acquisitionSource: "",
    },
  });

  /**
   * A named hotel, guesthouse or landmark is something we can find without
   * help; an area or "somewhere else" is not. It changes what the pin control
   * asks for, and whether the notes field is the important one on this form.
   */
  const watchedDropoff = form.watch("dropoffLabel");
  const watchedPickup = form.watch("pickupLabel");
  const isKnownPlace = (places: Place[], name: string) => {
    const kind = places.find((place) => place.name === name)?.kind;
    return kind === "hotel" || kind === "guesthouse" || kind === "landmark";
  };
  const dropoffIsKnown = isKnownPlace(dropoffPlaces, watchedDropoff);

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
        host === window.location.host ? "direct" : `referrer:${host}`,
      );
    } catch {
      form.setValue("acquisitionSource", "direct");
    }
  }, [form, utm]);

  function onSubmit(values: BookingFormValues) {
    startTransition(async () => {
      const result = await createBooking(values);
      if (result.ok) {
        // Straight to the gateway when there is one. router.push would keep the
        // traveller inside the app router; PayToday is another origin, so this
        // has to be a real navigation.
        if (result.checkoutUrl) {
          window.location.assign(result.checkoutUrl);
          return;
        }
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
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5"
        noValidate
      >
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
            {pickupPlaces.length > 1 && (
              <FormField
                control={form.control}
                name="pickupLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup</FormLabel>
                    <FormControl>
                      <PlacePicker
                        places={pickupPlaces}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Where should we collect you?"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {pickupPlaces.length > 1 && (
              <FormField
                control={form.control}
                name="pickupPin"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormControl>
                      <PinDrop
                        label="Pin the pickup point"
                        placeLabel={watchedPickup}
                        known={isKnownPlace(pickupPlaces, watchedPickup)}
                        centre={originCentre}
                        value={field.value ?? null}
                        onChange={field.onChange}
                      />
                    </FormControl>
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
                  <FormLabel>Drop-off</FormLabel>
                  <FormControl>
                    <PlacePicker
                      places={dropoffPlaces}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Search hotels and areas"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dropoffPin"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormControl>
                    <PinDrop
                      label="Pin the exact drop-off"
                      placeLabel={watchedDropoff}
                      known={dropoffIsKnown}
                      centre={destinationCentre}
                      value={field.value ?? null}
                      onChange={field.onChange}
                    />
                  </FormControl>
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email (optional)</FormLabel>
                <FormControl>
                  <Input
                    className="h-11"
                    type="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  For a written copy of your confirmation.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

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
                <FormLabel>
                  {dropoffIsKnown
                    ? "Landmark or notes (optional)"
                    : "Where exactly are you going?"}
                </FormLabel>
                <FormControl>
                  <textarea
                    rows={2}
                    placeholder={
                      dropoffIsKnown
                        ? "A nearby landmark, a child seat, anything else."
                        : "The name of your lodge or guesthouse, and a landmark if you have one."
                    }
                    className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:ring-[3px] md:text-sm"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {dropoffIsKnown
                    ? "A landmark helps your driver more than a street name."
                    : "Name the property and we will find it. If you have never been, this is worth more than anything else on this form."}
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
          {isPending && (
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          )}
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
