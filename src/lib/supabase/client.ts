"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseConfig } from "./env";

export type BrowserSupabase = SupabaseClient<Database>;

/** Cliente del navegador. `createBrowserClient` ya es singleton. Devuelve null sin configuración. */
export function getBrowserSupabase(): BrowserSupabase | null {
  if (!supabaseConfig) return null;
  return createBrowserClient<Database>(supabaseConfig.url, supabaseConfig.publishableKey);
}
