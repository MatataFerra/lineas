// Solo servidor.
import "server-only";
import { adminSupabase } from "@/lib/supabase/admin";
import { findPortrait, type Portrait } from "./wikipedia";

/**
 * Cada persona se busca en Wikipedia una sola vez: el resultado (también el
 * «no hay imagen») queda en la tabla portraits, compartida entre usuarios, y
 * en memoria de la instancia. Sin clave secreta o sin la tabla, solo memoria.
 */
const MISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const READ_BUDGET_MS = 400;
const memory = new Map<string, Portrait | null>();

export async function portraitFor(slug: string, name: string, kind: "person" | "art"): Promise<Portrait | null> {
  if (memory.has(slug)) return memory.get(slug)!;

  const db = adminSupabase();
  if (db) {
    const read = db
      .from("portraits")
      .select("image_url, source_url, fetched_at")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data, error }) => (error ? null : data));
    const row = await Promise.race([read, new Promise<null>((r) => setTimeout(() => r(null), READ_BUDGET_MS))]);
    const fresh = row && (row.image_url || Date.now() - Date.parse(row.fetched_at) < MISS_TTL_MS);
    if (row && fresh) {
      const hit = row.image_url ? { imageUrl: row.image_url, sourceUrl: row.source_url ?? "" } : null;
      memory.set(slug, hit);
      return hit;
    }
  }

  const found = await findPortrait(name, kind);
  memory.set(slug, found);
  if (db) {
    void db
      .from("portraits")
      .upsert({ slug, name, image_url: found?.imageUrl ?? null, source_url: found?.sourceUrl ?? null, fetched_at: new Date().toISOString() })
      .then(({ error }) => error && console.warn("[portraits] escritura", error.message));
  }
  return found;
}
