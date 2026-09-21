"use client";

import * as React from "react";
import { CheckCircle2Icon, PencilIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveTripDetails,
  type DetailsState,
} from "@/lib/booking/details-actions";

/**
 * The half of the booking only the traveller can fill in.
 *
 * Deliberately small and optional-looking. Everything here is a detail that
 * improves the trip rather than a gate in front of paying — a traveller who
 * has not yet decided what time they want to leave must not be blocked from
 * transferring the money, and a form that reads as mandatory does exactly
 * that.
 *
 * The date is shown but not editable. Changing which day a leg runs on is a
 * conversation with dispatch, not a field; changing the hour on that day is
 * not.
 */
export function TripDetailsForm({
  bookingRef,
  legLabel,
  dateLabel,
  isAirportLeg,
  pickupTime,
  pickupDetail,
  travellerNotes,
  flightNumber,
  savedAt,
}: {
  bookingRef: string;
  legLabel: string;
  dateLabel: string;
  /** Only an airport leg asks for a flight number. */
  isAirportLeg: boolean;
  pickupTime: string;
  pickupDetail: string | null;
  travellerNotes: string | null;
  flightNumber: string | null;
  savedAt: string | null;
}) {
  const [state, action, pending] = React.useActionState<DetailsState, FormData>(
    saveTripDetails,
    null,
  );
  const [open, setOpen] = React.useState(false);

  const saved = state?.ok === true;
  const hasDetails = Boolean(pickupDetail || travellerNotes || flightNumber);

  if (!open && !saved) {
    return (
      <div className="mt-3 border-t pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="press focus-ring text-brand inline-flex items-center gap-1.5 rounded-sm text-sm font-medium"
        >
          <PencilIcon className="size-3.5" aria-hidden />
          {hasDetails ? "Change your details" : "Add your pick-up details"}
        </button>
        {hasDetails && (
          <dl className="text-muted-foreground mt-2 grid gap-1 text-sm">
            {flightNumber && <Row label="Flight">{flightNumber}</Row>}
            {pickupDetail && <Row label="Pick-up">{pickupDetail}</Row>}
            {travellerNotes && <Row label="Note">{travellerNotes}</Row>}
          </dl>
        )}
        {savedAt && !hasDetails && (
          <p className="text-muted-foreground mt-1 text-xs">
            Nothing added yet.
          </p>
        )}
      </div>
    );
  }

  if (saved) {
    return (
      <p className="text-success mt-3 flex items-start gap-2 border-t pt-3 text-sm leading-snug">
        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Saved — your driver will have it. You can change it any time from this
          page.
        </span>
      </p>
    );
  }

  return (
    <form action={action} className="mt-3 grid gap-3 border-t pt-3">
      <input type="hidden" name="ref" value={bookingRef} />

      <p className="text-muted-foreground text-xs">
        {legLabel} · {dateLabel}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="What time would you like to leave?"
          name="pickupTime"
          type="time"
          defaultValue={pickupTime}
          hint="Namibian time. Leave it as it is if you are not sure yet."
        />
        {isAirportLeg && (
          <Field
            label="Flight number"
            name="flightNumber"
            defaultValue={flightNumber ?? ""}
            placeholder="SA 074"
            hint="So your driver follows your actual landing time."
          />
        )}
        <Field
          label="Exactly where should the driver meet you?"
          name="pickupDetail"
          defaultValue={pickupDetail ?? ""}
          placeholder="Reception, or the gate on the left past the sign"
          className="sm:col-span-2"
          hint="A landmark helps a Namibian driver more than a street name."
        />
        <Field
          label="Anything we should know?"
          name="travellerNotes"
          defaultValue={travellerNotes ?? ""}
          placeholder="Child seat, extra bags, mobility needs…"
          className="sm:col-span-2"
        />
      </div>

      {state && !state.ok && (
        <p className="text-destructive text-sm">{state.message}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="press h-10">
          {pending ? "Saving…" : "Save these details"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="press h-10"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0">{label}:</dt>
      <dd className="text-foreground min-w-0">{children}</dd>
    </div>
  );
}

function Field({
  label,
  name,
  hint,
  className,
  ...props
}: {
  label: string;
  name: string;
  hint?: string;
  className?: string;
} & React.ComponentProps<typeof Input>) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={`${name}-field`} className="text-sm">
        {label}
      </Label>
      <Input id={`${name}-field`} name={name} {...props} />
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
