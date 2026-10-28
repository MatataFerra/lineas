import { z } from "zod";
import { GraphEdgeSchema, GraphNodeSchema, RecommendationSchema } from "@/lib/graph/schema";

/**
 * Lo que tiene que escribir el modelo: el grafo sin las partes que completa el
 * servidor (las pistas, que son las del usuario, y `book`, que sale de los
 * catálogos). Las reglas que cruzan campos (recorridos, carriles) no entran en
 * un JSON Schema: las sigue validando ConnectionGraphSchema.
 */
export const LlmOutputSchema = z.object({
  version: z.literal(1),
  nodes: z.array(GraphNodeSchema.omit({ book: true })),
  edges: z.array(GraphEdgeSchema),
  recommendations: z.array(RecommendationSchema),
});

let cached: Record<string, unknown> | null = null;

/** JSON Schema para `response_format` en proveedores que lo soportan. */
export function llmOutputJsonSchema(): Record<string, unknown> {
  cached ??= z.toJSONSchema(LlmOutputSchema, { io: "input", target: "draft-07" }) as Record<string, unknown>;
  return cached;
}
