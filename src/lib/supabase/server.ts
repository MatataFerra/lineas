import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseConfig } from "./env";

/**
 * Cliente para Server Components, Route Handlers y Server Functions.
 * Crear uno nuevo por request; nunca compartirlo.
 */
export async function createServerSupabase() {
  if (!supabaseConfig) return null;
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseConfig.url, supabaseConfig.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies. No pasa nada:
          // el proxy (src/proxy.ts) refresca la sesión en cada request.
        }
      },
    },
  });
}
