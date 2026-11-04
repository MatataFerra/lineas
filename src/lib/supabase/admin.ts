// Solo servidor: la clave secreta nunca puede llegar al navegador.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Cliente con la clave secreta, para lo que el servidor escribe por su cuenta
 * (el cache de carriles). Sin la clave devuelve null y el llamador sigue sin él.
 *
 *   SUPABASE_SECRET_KEY        (sb_secret_…, la nueva)  o
 *   SUPABASE_SERVICE_ROLE_KEY  (la service_role clásica)
 */
let client: SupabaseClient<Database> | null | undefined;

export function adminSupabase(): SupabaseClient<Database> | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = url && key ? createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return client;
}
