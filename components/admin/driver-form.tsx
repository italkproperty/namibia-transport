"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { addDriver, type DispatchResult } from "@/lib/dispatch/actions";
import type { VehicleClassView } from "@/lib/maps";

/**
 * Adding a partner driver.
 *
 * The vehicle is optional and deliberately so: a driver is often recruited
 * before anyone has written down the plate, and forcing it would mean the
 * roster stays empty until every field is known. But the plate is the whole
 * point of the message the traveller gets, so the form says which fields
 * unlock that rather than silently accepting half a record.
 */
export function DriverForm({
  vehicleClasses,
}: {
  vehicleClasses: VehicleClassView[];
}) {
  const [result, formAction, pending] = React.useActionState<
    DispatchResult | null,
    FormData
  >(addDriver, null);
  const formRef = React.useRef<HTMLFormElement | null>(null);

  React.useEffect(() => {
    if (result?.ok) formRef.current?.reset();
  }, [result]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="bg-card rounded-xl border p-5"
    >
      <h2 className="text-base font-semibold">Add a partner driver</h2>
      <p className="text-muted-foreground mt-1 text-sm leading-snug">
        New drivers start as <span className="font-medium">pending</span> and
        cannot be put on a trip until you activate them &mdash; nothing on the
        site claims a driver is checked, so this is where that becomes true.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field name="fullName" label="Full name" required />
        <Field name="whatsapp" label="WhatsApp" placeholder="+264 81 123 4567" required />
        <Field name="phone" label="Phone (optional)" />
        <Field name="licenseNumber" label="Licence / PDP number (optional)" />
      </div>

      <fieldset className="mt-5 rounded-lg border border-dashed p-4">
        <legend className="px-1.5 text-sm font-medium">Their vehicle</legend>
        <p className="text-muted-foreground text-sm leading-snug">
          Make, registration and class are what reach the traveller before
          pickup. Leave them blank now and add the car later.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="vehicleClassId" className="text-xs font-medium">
              Class
            </Label>
            <select
              id="vehicleClassId"
              name="vehicleClassId"
              defaultValue=""
              className="border-input h-10 rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">&mdash;</option>
              {vehicleClasses.map((vehicleClass) => (
                <option key={vehicleClass.id} value={vehicleClass.id}>
                  {vehicleClass.name}
                </option>
              ))}
            </select>
          </div>
          <Field name="registration" label="Registration" placeholder="N 12345 W" />
          <Field name="make" label="Make" placeholder="Toyota" />
          <Field name="model" label="Model" placeholder="Fortuner" />
          <Field name="colour" label="Colour" placeholder="White" />
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          className="press bg-brand text-brand-foreground hover:bg-brand-hover"
        >
          {pending ? "Saving…" : "Add driver"}
        </Button>
        {result && (
          <p
            className={`text-sm ${result.ok ? "text-success" : "text-destructive"}`}
          >
            {result.message}
          </p>
        )}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  placeholder,
  required = false,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name} className="text-xs font-medium">
        {label}
      </Label>
      <input
        id={name}
        name={name}
        required={required}
        placeholder={placeholder}
        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-10 rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px]"
      />
    </div>
  );
}
