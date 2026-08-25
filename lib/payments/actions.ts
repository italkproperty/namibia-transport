"use server";

import { redirect } from "next/navigation";

import { getOrCreateCheckout } from "./reconcile";

/** Same alphabet as lib/booking/ref.ts. */
const REF_PATTERN = /^NT-[ABCDEFGHJKLMNPQRTUVWXY2346789]{6}$/;

export type CheckoutActionState = { error: string } | null;

/**
 * Sends a traveller with an unpaid booking to the gateway.
 *
 * A server action is a public endpoint, so the reference is re-validated here
 * and the amount is read from the booking row inside getOrCreateCheckout —
 * nothing about the fare comes from the caller.
 */
export async function startCheckout(
  _previous: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const ref = String(formData.get("ref") ?? "")
    .trim()
    .toUpperCase();

  if (!REF_PATTERN.test(ref)) {
    return { error: "We could not find that booking." };
  }

  const result = await getOrCreateCheckout(ref);
  if ("error" in result) return result;

  redirect(result.url);
}
