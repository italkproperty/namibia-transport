import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseAnonKey, supabaseServiceRoleKey, supabaseUrl } from "./env";

/**
 * Cookie-backed Supabase client for Server Components, Server Actions and
 * route handlers. Async because `cookies()` is async in Next 15.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Middleware refreshes the session instead, so this is safe to skip.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS — server-only, never behind a user-facing
 * route without an explicit authorisation check first.
 */
export function createServiceRoleClient() {
  return createServerClient(supabaseUrl(), supabaseServiceRoleKey(), {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
}
