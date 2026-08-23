"use server";

import { revalidatePath } from "next/cache";

import { signInWithPassword, signOutAdmin } from "./auth";

export type AdminSignInResult = { ok: boolean; message?: string };

export async function adminSignIn(
  _prev: AdminSignInResult | null,
  formData: FormData
): Promise<AdminSignInResult> {
  const password = String(formData.get("password") ?? "");
  if (!password) return { ok: false, message: "Enter the password." };

  const signedIn = await signInWithPassword(password);
  if (!signedIn) {
    return { ok: false, message: "That password is not correct." };
  }

  revalidatePath("/admin/bookings");
  return { ok: true };
}

export async function adminSignOut(): Promise<void> {
  await signOutAdmin();
  revalidatePath("/admin/bookings");
}
