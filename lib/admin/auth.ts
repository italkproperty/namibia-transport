import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * A shared-password gate, deliberately minimal.
 *
 * This is a stop-gap for an internal view with a handful of operators. It is
 * NOT the long-term answer: proper Supabase Auth with per-user accounts and
 * row-level security replaces it before anyone outside the founding team gets
 * access. It gives no audit trail and no way to revoke one person.
 *
 * What it does do correctly: the password itself never reaches the cookie, and
 * comparisons are constant-time.
 */

const COOKIE_NAME = "nt_admin";
const SESSION_SECONDS = 60 * 60 * 8;

/**
 * Trimmed, because the value is pasted into a hosting dashboard and a
 * trailing newline is invisible there while being fatal here: the comparison
 * below rejects on length before it ever looks at the characters, so
 * "secret\n" on the server and "secret" in the form silently disagree and the
 * operator is told their correct password is wrong.
 */
function adminPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD?.trim();
  return password && password.length > 0 ? password : null;
}

/** Derived from the password, so the cookie is useless if the password changes. */
function sessionToken(password: string): string {
  return createHmac("sha256", password).update("namibia-transport-admin").digest("hex");
}

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type AdminGateState =
  | { state: "unconfigured" }
  | { state: "signed-out" }
  | { state: "signed-in" };

export async function getAdminGateState(): Promise<AdminGateState> {
  const password = adminPassword();
  if (!password) return { state: "unconfigured" };

  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  if (!cookie) return { state: "signed-out" };

  return safeEquals(cookie, sessionToken(password))
    ? { state: "signed-in" }
    : { state: "signed-out" };
}

/** Returns false on a wrong password; the caller decides what to tell the user. */
export async function signInWithPassword(candidate: string): Promise<boolean> {
  const password = adminPassword();
  if (!password) return false;
  // Trimmed on this side too: password managers and mobile keyboards append
  // whitespace on paste, and a shared operator password has no business
  // carrying edge whitespace as meaningful.
  if (!safeEquals(candidate.trim(), password)) return false;

  (await cookies()).set(COOKIE_NAME, sessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return true;
}

export async function signOutAdmin(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
