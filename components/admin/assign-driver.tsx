"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { assignDriver, unassignDriver, type DispatchResult } from "@/lib/dispatch/actions";

export type AssignableDriver = {
  id: string;
  fullName: string;
  registration: string | null;
};

export type CurrentAssignment = {
  assignmentId: string;
  driverName: string;
  registration: string | null;
};

/**
 * Putting a driver on a trip, from the row the trip is already on.
 *
 * Assigning is not a neutral edit: it moves the booking to `assigned` and
 * sends the traveller the name and plate they will look for. So the control
 * says what it is about to do, and reports honestly afterwards — including
 * when the record saved but the message did not, which operations has to know
 * about because it means telling someone by hand.
 */
export function AssignDriver({
  bookingId,
  drivers,
  current,
}: {
  bookingId: string;
  drivers: AssignableDriver[];
  current?: CurrentAssignment;
}) {
  const [result, formAction, pending] = React.useActionState<
    DispatchResult | null,
    FormData
  >(assignDriver, null);
  const [busy, startTransition] = React.useTransition();
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  if (current) {
    return (
      <div className="min-w-44">
        <p className="text-sm font-medium">{current.driverName}</p>
        {current.registration && (
          <p className="tabular text-muted-foreground text-xs">
            {current.registration}
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setCancelError(null);
            startTransition(async () => {
              const outcome = await unassignDriver(current.assignmentId, bookingId);
              if (!outcome.ok) setCancelError(outcome.message);
            });
          }}
          className="text-muted-foreground hover:text-destructive mt-1 text-xs underline underline-offset-2 disabled:opacity-50"
        >
          {busy ? "Cancelling…" : "Cancel assignment"}
        </button>
        {cancelError && (
          <p className="text-destructive mt-1 text-xs">{cancelError}</p>
        )}
      </div>
    );
  }

  if (drivers.length === 0) {
    return (
      <span className="text-muted-foreground text-xs">
        No active driver with a vehicle
      </span>
    );
  }

  return (
    <form action={formAction} className="min-w-44">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex items-center gap-1.5">
        <select
          name="driverId"
          required
          defaultValue=""
          aria-label="Driver"
          className="border-input h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-xs"
        >
          <option value="" disabled>
            Choose…
          </option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.fullName}
              {driver.registration ? ` · ${driver.registration}` : ""}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="press bg-brand text-brand-foreground hover:bg-brand-hover h-8 px-2.5 text-xs"
        >
          {pending ? "…" : "Assign"}
        </Button>
      </div>
      {result && !result.ok && (
        <p className="text-destructive mt-1 text-xs">{result.message}</p>
      )}
      {result?.ok && result.message && (
        <p className="text-success mt-1 text-xs">{result.message}</p>
      )}
    </form>
  );
}
