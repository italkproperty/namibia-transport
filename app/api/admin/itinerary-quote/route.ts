import { NextResponse } from "next/server";

import { saveItineraryAction } from "@/lib/admin/itinerary-actions";

/**
 * Saving an itinerary quote over a plain POST rather than a Server Action.
 *
 * A Server Action cannot be abandoned from the browser: React queues the next
 * one behind it, so when a phone's connection drops mid-save the button reads
 * "Creating…" until the tab is reloaded and the form is lost. A fetch can be
 * aborted on a timer and sent again, which is what the builder now does.
 *
 * Authorisation is not repeated here because it must not be forked:
 * `saveItineraryAction` checks the admin gate itself, first thing, and refuses
 * with "Sign in first." for anyone else.
 */
export const maxDuration = 30;

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, message: "The form could not be read. Try again." },
      { status: 400 },
    );
  }
  const result = await saveItineraryAction(null, formData);
  return NextResponse.json(result, {
    status: result?.ok ? 200 : 422,
    headers: { "Cache-Control": "no-store" },
  });
}
