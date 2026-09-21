"use server";

import { revalidatePath } from "next/cache";

import { declareTransfer } from "./transfer";

/** Same alphabet as lib/booking/ref.ts. */
const REF_PATTERN = /^NT-[ABCDEFGHJKLMNPQRTUVWXY2346789]{6}$/;

export type DeclareState = { error: string } | { ok: true } | null;

/**
 * The traveller's "I have sent it" button.
 *
 * A server action is a public endpoint, so the reference is re-validated here
 * and nothing about the amount comes from the form — `declareTransfer` reads
 * the fare off the booking row. The worst an attacker can do with a guessed
 * reference is claim to have paid for someone else's booking, which changes no
 * money and shows an operator a declaration that will not match a statement.
 */
export async function declareTransferAction(
  _previous: DeclareState,
  formData: FormData,
): Promise<DeclareState> {
  const ref = String(formData.get("ref") ?? "")
    .trim()
    .toUpperCase();

  if (!REF_PATTERN.test(ref)) {
    return { error: "We could not find that booking." };
  }

  const note = String(formData.get("note") ?? "").trim() || undefined;
  const result = await declareTransfer(ref, note);
  if ("error" in result) return result;

  revalidatePath(`/booking/${ref}`);
  return { ok: true };
}
