/**
 * Variables públicas de Supabase. Next las incrusta en el build, por eso se leen
 * con el nombre literal (no con process.env[name]).
 *
 * Sin variables la app sigue funcionando en modo local: sin login y sin
 * persistencia. Así se puede trabajar en la UI sin un proyecto de Supabase.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfig = url && publishableKey ? { url, publishableKey } : null;

export function isSupabaseConfigured(): boolean {
  return supabaseConfig !== null;
}
