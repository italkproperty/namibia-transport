"use client";

import * as React from "react";

import type { DriverStatus } from "@/db/schema";
import { setDriverStatus } from "@/lib/dispatch/actions";

const OPTIONS: DriverStatus[] = ["pending", "active", "suspended", "inactive"];

/**
 * Only an active driver can be put on a trip, so this control is the gate
 * between "someone we have heard of" and "someone we will send to an airport".
 */
export function DriverStatusSelect({
  driverId,
  status,
}: {
  driverId: string;
  status: DriverStatus;
}) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <select
        aria-label="Driver status"
        defaultValue={status}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as DriverStatus;
          setError(null);
          startTransition(async () => {
            const result = await setDriverStatus(driverId, next);
            if (!result.ok) setError(result.message);
          });
        }}
        className="border-input h-8 rounded-md border bg-transparent px-2 text-xs disabled:opacity-50"
      >
        {OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </span>
  );
}
