"use client";

import { createBrowserClient } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "./env";

/** Browser-side Supabase client. Anon key only — never the service role. */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
