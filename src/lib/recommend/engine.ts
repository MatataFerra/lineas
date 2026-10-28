// Solo servidor: si algo de cliente importa este módulo, el build falla.
import "server-only";

import { verifyGraphBooks } from "@/lib/catalog/books";
import { mockGraphFor } from "@/lib/graph/mock";
import { ConnectionGraphSchema, type Clue, type ConnectionGraph } from "@/lib/graph/schema";
import { engineFromEnv, llmConfigFromEnv, type EngineName } from "./config";
import { generateGraphWithLlm } from "./llm-engine";

/**
 * Motor de recomendación. Corre solo en el servidor (lo llama /api/recommend).
 *
 * - "openrouter" / "deepseek": pide el grafo al modelo, lo valida (con
 *   reintentos) y verifica cada libro contra Google Books / Open Library.
 * - "mock": el grafo de ejemplo, para trabajar en la UI sin gastar tokens.
 *
 * Qué motor y qué modelos se usan lo deciden las variables de entorno (config.ts).
 */
export type { EngineName } from "./config";

export function currentEngine(): EngineName {
  return engineFromEnv();
}

/* Cache en memoria por instancia: la misma búsqueda no se paga dos veces seguidas. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 200;
const cache = new Map<string, { graph: ConnectionGraph; at: number }>();

export function cacheKey(clues: Clue[]): string {
  return JSON.stringify(
    clues.map((c) => [c.kind, c.label.trim().toLowerCase()]).sort((a, b) => (a.join() < b.join() ? -1 : 1)),
  );
}

export async function recommend(clues: Clue[]): Promise<{ graph: ConnectionGraph; engine: EngineName; cached: boolean }> {
  const engine = currentEngine();

  if (engine === "mock") {
    // Simula la latencia de un modelo para poder diseñar el estado de carga.
    await new Promise((resolve) => setTimeout(resolve, 700));
    return { graph: ConnectionGraphSchema.parse(mockGraphFor(clues)), engine, cached: false };
  }

  const key = cacheKey(clues);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { graph: { ...hit.graph, clues }, engine, cached: true };
  }

  const generated = await generateGraphWithLlm(clues, {
    ...llmConfigFromEnv(),
    log: (event) => {
      if (event.type === "invalid") console.warn(`[recommend] intento ${event.attempt} inválido:\n${event.reason}`);
      if (event.type === "success") console.info(`[recommend] ok con ${event.model} en intento ${event.attempt}`, JSON.stringify(event.usage));
    },
  });
  const graph = await verifyGraphBooks(generated, { googleBooksKey: process.env.GOOGLE_BOOKS_API_KEY });

  cache.set(key, { graph, at: Date.now() });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return { graph, engine, cached: false };
}
