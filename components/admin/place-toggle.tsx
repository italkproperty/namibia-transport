"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  setPlaceActiveAction,
  type TogglePlaceState,
} from "@/lib/admin/place-actions";

export function PlaceActiveToggle({ id, active }: { id: string; active: boolean }) {
  const [state, action, pending] = React.useActionState<TogglePlaceState, FormData>(
    setPlaceActiveAction,
    null,
  );
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending} className="press">
        {pending ? "Saving…" : active ? "Stop pricing" : "Price again"}
      </Button>
      {state && !state.ok && (
        <p className="text-destructive text-xs">{state.message}</p>
      )}
    </form>
  );
}
