"use server";

import { revalidatePath } from "next/cache";

import { updateTripDetails } from "@/lib/booking/details";

/**
 * Thin wrapper over `updateTripDetails`, which holds the rule about what a
 * traveller may change. Splitting them keeps that rule testable without a
 * request context — `revalidatePath` only exists inside one — and matches how
 * `lib/payments/transfer.ts` sits behind its own action.
 */
export type DetailsState = { ok: true } | { ok: false; message: string } | null;

export async function saveTripDetails(
  _previous: DetailsState,
  formData: FormData,
): Promise<DetailsState> {
  const result = await updateTripDetails(formData);
  if (!result.ok) return result;

  const ref = String(formData.get("ref") ?? "")
    .trim()
    .toUpperCase();
  revalidatePath(`/booking/${ref}`);
  if (result.groupRef) revalidatePath(`/quote/${result.groupRef}`);

  return { ok: true };
}
