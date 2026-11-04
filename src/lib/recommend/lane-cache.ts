// Solo servidor.
import "server-only";
import { laneGraphSchema, type ConnectionGraph, type Lane } from "@/lib/graph/schema";
import { adminSupabase } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Alternativas ya generadas para cada carril de cada búsqueda. Vive en
 * Supabase (compartido entre instancias y usuarios) si hay clave secreta; si
 * no, en memoria de la instancia. Una lectura lenta o fallida no frena el
 * carril: cuenta como cache vacío.
 */
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const READ_BUDGET_MS = 400;
const MEMORY_MAX = 600;
const memory = new Map<string, { graphs: ConnectionGraph[]; at: number }>();

export async function readLaneCache(key: string, lane: Lane): Promise<ConnectionGraph[]> {
  const local = memory.get(key);
  if (local && Date.now() - local.at < CACHE_TTL_MS) return local.graphs;

  const db = adminSupabase();
  if (!db) return [];
  const query = db
    .from("graph_cache")
    .select("graphs")
    .eq("key", key)
    .gt("updated_at", new Date(Date.now() - CACHE_TTL_MS).toISOString())
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });
  const row = await Promise.race([query, sleep(READ_BUDGET_MS).then(() => null)]).catch((error) => {
    console.warn("[cache] lectura", error);
    return null;
  });
  if (!row || !Array.isArray(row.graphs)) return [];
  // Lo guardado pasó por el contrato al generarse, pero el contrato puede haber cambiado.
  const schema = laneGraphSchema(lane);
  const graphs = row.graphs.flatMap((g) => {
    const parsed = schema.safeParse(g);
    return parsed.success ? [parsed.data] : [];
  });
  memory.set(key, { graphs, at: Date.now() });
  return graphs;
}

/** Suma (o reemplaza, si es el mismo libro) una alternativa al carril. No espera a la base. */
export function writeLaneCache(key: string, lane: Lane, graph: ConnectionGraph, sameBook: (a: ConnectionGraph, b: ConnectionGraph) => boolean) {
  const current = memory.get(key)?.graphs ?? [];
  const graphs = [...current.filter((g) => !sameBook(g, graph)), graph];
  memory.set(key, { graphs, at: Date.now() });
  if (memory.size > MEMORY_MAX) memory.delete(memory.keys().next().value!);

  const db = adminSupabase();
  if (!db) return;
  void db
    .from("graph_cache")
    .upsert({ key, lane, graphs: graphs as unknown as Json, updated_at: new Date().toISOString() })
    .then(({ error }) => {
      if (error) console.warn("[cache] escritura", error);
    });
}

/** Para tests. */
export function clearMemoryCache() {
  memory.clear();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
