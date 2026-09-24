"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2Icon, ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { editBooking, type EditState } from "@/lib/admin/booking-edit";
import { formatNad } from "@/lib/money";

export type EditableBooking = {
  id: string;
  ref: string;
  pickupLabel: string;
  dropoffLabel: string;
  /** "yyyy-MM-ddTHH:mm" in Namibian local time, for datetime-local. */
  scheduledAtLocal: string;
  passengers: number;
  luggageCount: number;
  vehicleClassId: string | null;
  customerPrice: string;
  driverPayout: string;
  notes: string | null;
  groupRef: string | null;
  /** Null when the quote is still live; the reason when it has lapsed. */
  expired: string | null;
};

/**
 * Correcting a quote in place.
 *
 * The alternative was void-and-rewrite, which changes the reference and the
 * link — so a traveller looking at the email you sent an hour ago is told to
 * ignore it, over a typo in a pickup point or a date moved by a day. This
 * keeps the reference, which means the conversation survives the correction.
 *
 * The payout box is deliberately allowed to stay blank. An operator moving a
 * pickup by an hour should not have to think about what the driver is owed,
 * and an edit that silently re-derived it from the new fare would change a
 * payout nobody meant to touch.
 */
export function BookingEditForm({
  booking,
  vehicleClasses,
}: {
  booking: EditableBooking;
  vehicleClasses: { id: string; name: string }[];
}) {
  const [state, action, pending] = React.useActionState<EditState, FormData>(
    editBooking,
    null,
  );

  const [price, setPrice] = React.useState(booking.customerPrice);
  const payoutNow = Number(booking.driverPayout);
  const contribution = Number(price || 0) - payoutNow;

  if (state?.ok) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <p className="text-success flex items-center gap-2 font-medium">
          <CheckCircle2Icon className="size-5" aria-hidden />
          {state.ref} updated
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          The traveller&rsquo;s page now shows the corrected trip. The link they
          already have is the same link — nothing needs re-sending unless you
          want to tell them what changed.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" className="press">
            <a
              href={`/booking/${state.ref}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open their page
              <ExternalLinkIcon className="size-4" aria-hidden />
            </a>
          </Button>
          <Button asChild variant="ghost" className="press">
            <Link href="/admin/bookings">Back to bookings</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="bookingId" value={booking.id} />

      {booking.expired && (
        <div
          role="status"
          className="border-warning/40 bg-warning/10 rounded-xl border p-4 text-sm"
        >
          <p className="font-medium">This quote has lapsed</p>
          <p className="text-muted-foreground mt-1 leading-snug">
            {booking.expired} Editing it does not restart the clock — the link
            stays dead to the traveller. Correct it here only for your own
            records; to sell this trip, raise a new quote.
          </p>
        </div>
      )}

      {booking.groupRef && (
        <div className="border-border/70 bg-muted/40 rounded-xl border p-4 text-sm">
          <p className="font-medium">This is one leg of a trip</p>
          <p className="text-muted-foreground mt-1 leading-snug">
            The traveller sees every leg added into one figure, so changing
            this fare changes their total. The other legs are untouched.
          </p>
        </div>
      )}

      <fieldset>
        <legend className="mb-3 text-sm font-semibold">The trip</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Picking up from"
            name="pickupLabel"
            defaultValue={booking.pickupLabel}
            required
          />
          <Field
            label="Going to"
            name="dropoffLabel"
            defaultValue={booking.dropoffLabel}
            required
          />
          <Field
            label="Pickup date and time"
            name="scheduledAt"
            type="datetime-local"
            defaultValue={booking.scheduledAtLocal}
            required
          />
          <div className="grid gap-1.5">
            <Label htmlFor="vehicleClassId">Vehicle</Label>
            <select
              id="vehicleClassId"
              name="vehicleClassId"
              defaultValue={booking.vehicleClassId ?? ""}
              className="border-input bg-background focus-ring h-10 rounded-md border px-3 text-sm"
            >
              <option value="">Decide later</option>
              {vehicleClasses.map((vc) => (
                <option key={vc.id} value={vc.id}>
                  {vc.name}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Passengers"
            name="passengers"
            type="number"
            defaultValue={String(booking.passengers)}
          />
          <Field
            label="Large cases"
            name="luggageCount"
            type="number"
            defaultValue={String(booking.luggageCount)}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold">The money</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="price">Fare (N$)</Label>
            <Input
              id="price"
              name="price"
              inputMode="decimal"
              className="h-10"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
            <p className="text-muted-foreground text-xs">
              The whole vehicle, and the whole trip including any return.
            </p>
          </div>
          <Field
            label="Driver payout (N$)"
            name="payout"
            inputMode="decimal"
            placeholder={booking.driverPayout}
            hint={`Currently ${formatNad(booking.driverPayout)}. Leave blank to keep it.`}
          />
          <Field
            label="Note on the quote"
            name="notes"
            className="sm:col-span-2"
            defaultValue={booking.notes ?? ""}
            hint="The traveller sees this on their page."
          />
        </div>

        <p
          className={`mt-3 text-xs ${
            contribution < 0 ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {contribution < 0
            ? `That fare is ${formatNad(String(Math.abs(contribution)))} below the payout already recorded — set the payout too, or raise the fare.`
            : `Leaves ${formatNad(String(contribution))} contribution at the current payout.`}
        </p>
      </fieldset>

      {state && !state.ok && (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="press h-11">
          {pending ? "Saving…" : "Save the correction"}
        </Button>
        <Button asChild variant="ghost" className="press h-11">
          <Link href="/admin/bookings">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  hint,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; hint?: string }) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} className="h-10" {...props} />
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
