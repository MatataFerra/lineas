import { mockGraphFor } from "@/lib/graph/mock";
import { ConnectionGraphSchema, type Clue, type ConnectionGraph } from "@/lib/graph/schema";

/**
 * Motor de recomendación. Corre solo en el servidor (lo llama /api/recommend).
 *
 * Hoy devuelve el grafo de ejemplo. El siguiente paso es un motor "llm" que:
 *   1. pide al modelo un ConnectionGraph con salida estructurada (el JSON Schema
 *      sale de ConnectionGraphSchema con z.toJSONSchema),
 *   2. valida la respuesta con ConnectionGraphSchema (y reintenta con los errores),
 *   3. verifica cada libro contra Google Books / Open Library y completa `book`.
 */
export type EngineName = "mock";

export function currentEngine(): EngineName {
  return "mock";
}

export async function recommend(clues: Clue[]): Promise<ConnectionGraph> {
  // Simula la latencia de un modelo para poder diseñar el estado de carga.
  await new Promise((resolve) => setTimeout(resolve, 700));
  return ConnectionGraphSchema.parse(mockGraphFor(clues));
}
