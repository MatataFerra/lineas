import { z } from "zod";

/**
 * Contrato del grafo de conexiones.
 *
 * Es lo que devuelve el motor de recomendación (hoy un mock, mañana un LLM con
 * salida estructurada) y lo que consume toda la UI: resultados, mapa y recorrido.
 * Cualquier respuesta de la IA se valida con `ConnectionGraphSchema` antes de
 * llegar al cliente.
 */

export const GRAPH_LIMITS = {
  /** Nodos máximos en un mapa: lo que lo mantiene legible. */
  maxNodes: 16,
  /** Saltos máximos desde una pista hasta una recomendación. */
  maxHops: 2,
  /** Recomendaciones por carril. */
  maxPerLane: 3,
} as const;

/* ------------------------------------------------------------------ */
/* Pistas (lo que escribe el usuario)                                  */
/* ------------------------------------------------------------------ */

export const ClueKindSchema = z.enum([
  "book",
  "author",
  "quote",
  "movement",
  "style",
  "feeling",
  "idea",
]);
export type ClueKind = z.infer<typeof ClueKindSchema>;

export const ClueSchema = z.object({
  id: z.string().min(1),
  kind: ClueKindSchema,
  label: z.string().trim().min(1).max(200),
});
export type Clue = z.infer<typeof ClueSchema>;

/* ------------------------------------------------------------------ */
/* Nodos                                                               */
/* ------------------------------------------------------------------ */

export const NodeKindSchema = z.enum([
  "book",
  "person",
  "movement",
  /** Música, cine, pintura: influencias que vienen de otras artes. */
  "art",
  /** Una idea o tema transversal ("la ruta", "el desarraigo"). */
  "concept",
]);
export type NodeKind = z.infer<typeof NodeKindSchema>;

/** Época del nodo. Para un libro, el año de publicación; para una persona o movimiento, un rango. */
export const EraSchema = z.object({
  from: z.number().int().min(-3000).max(2100),
  to: z.number().int().min(-3000).max(2100).optional(),
  /** Texto para mostrar: "1957", "1950s", "1854–1891". */
  label: z.string().min(1).max(24),
  /**
   * Año que lo representa en la línea de tiempo cuando hay un rango.
   * Para Rimbaud (1854–1891) no es el punto medio sino 1873, su obra.
   */
  pivot: z.number().int().min(-3000).max(2100).optional(),
});
export type Era = z.infer<typeof EraSchema>;

/** Referencia a catálogo. La rellena el servidor al verificar el libro, nunca el LLM. */
export const BookRefSchema = z.object({
  author: z.string().min(1),
  isbn: z.string().optional(),
  googleBooksId: z.string().optional(),
  openLibraryKey: z.string().optional(),
  coverUrl: z.url().optional(),
  /** true cuando el libro se encontró en un catálogo real. */
  verified: z.boolean(),
});
export type BookRef = z.infer<typeof BookRefSchema>;

export const GraphNodeSchema = z.object({
  /** Slug estable: "on-the-road", "charlie-parker". */
  id: z.string().regex(/^[a-z0-9-]+$/, "id en kebab-case"),
  kind: NodeKindSchema,
  label: z.string().min(1).max(80),
  /** Línea secundaria: autor, disciplina, "Corriente de ideas". */
  subtitle: z.string().max(60).optional(),
  era: EraSchema,
  /** El nodo corresponde a una pista del usuario: es un punto de partida. */
  isClue: z.boolean().default(false),
  book: BookRefSchema.optional(),
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;

/* ------------------------------------------------------------------ */
/* Aristas                                                             */
/* ------------------------------------------------------------------ */

export const EdgeTypeSchema = z.enum([
  /** A inspiró a B. Dirigida, de lo anterior a lo posterior. */
  "influence",
  /** La misma frase, cita o epígrafe aparece en ambos. */
  "shared_phrase",
  /** Una influencia que viene de la música, el cine, la pintura… */
  "other_arts",
  /** Comparten un tema o una pregunta. No dirigida. */
  "shared_theme",
  /** A forma parte de B (libro → movimiento). */
  "belongs_to",
  /** Mismo autor. */
  "same_author",
]);
export type EdgeType = z.infer<typeof EdgeTypeSchema>;

/** Las no dirigidas se dibujan sin flecha. */
export const UNDIRECTED_EDGE_TYPES: ReadonlySet<EdgeType> = new Set(["shared_theme"]);

/**
 * Qué tan firme es la conexión. Se muestra en la UI: el mapa no debe presentar
 * una lectura interpretativa como un hecho documentado.
 */
export const ConfidenceSchema = z.enum([
  /** Hay registro: cartas, entrevistas, dedicatorias, citas textuales. */
  "documented",
  /** Consenso crítico o académico. */
  "scholarly",
  /** Lectura propia del sistema: un paralelismo, no un vínculo probado. */
  "interpretive",
]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const GraphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: EdgeTypeSchema,
  confidence: ConfidenceSchema,
  /** Una línea, para listas y tooltips (≤ 140). */
  summary: z.string().min(1).max(140),
  /** El porqué completo, para el panel del recorrido (≤ 600). */
  explanation: z.string().min(1).max(600),
  /** Para `shared_phrase`: la frase en cuestión, corta. */
  quote: z.string().max(200).optional(),
});
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

/* ------------------------------------------------------------------ */
/* Recomendaciones                                                     */
/* ------------------------------------------------------------------ */

export const LaneSchema = z.enum([
  /** Lo más cercano a lo que ya te mueve. */
  "affinity",
  /** Comparte el espíritu, pero entra por otra puerta. */
  "alternative",
  /** Una conexión que no esperabas. */
  "beyond",
]);
export type Lane = z.infer<typeof LaneSchema>;

export const RecommendationSchema = z.object({
  /** Id del nodo libro recomendado. */
  nodeId: z.string().min(1),
  lane: LaneSchema,
  /** Por qué te lo recomendamos (tarjeta de resultados). */
  pitch: z.string().min(1).max(400),
  /** El recorrido en una frase (cierre del panel del mapa). */
  pathSummary: z.string().min(1).max(240),
  /**
   * Ids de nodos desde una pista hasta el libro, en orden.
   * Cada par consecutivo tiene que estar unido por una arista.
   */
  path: z.array(z.string().min(1)).min(2),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

/* ------------------------------------------------------------------ */
/* Grafo completo                                                      */
/* ------------------------------------------------------------------ */

export const ConnectionGraphSchema = z
  .object({
    version: z.literal(1),
    clues: z.array(ClueSchema).min(1),
    nodes: z.array(GraphNodeSchema).min(2).max(GRAPH_LIMITS.maxNodes),
    edges: z.array(GraphEdgeSchema).min(1),
    recommendations: z.array(RecommendationSchema).min(1),
  })
  .superRefine((graph, ctx) => {
    const nodes = new Map(graph.nodes.map((n) => [n.id, n]));

    if (nodes.size !== graph.nodes.length) {
      ctx.addIssue({ code: "custom", path: ["nodes"], message: "Hay ids de nodo repetidos" });
    }
    if (!graph.nodes.some((n) => n.isClue)) {
      ctx.addIssue({ code: "custom", path: ["nodes"], message: "Ningún nodo está marcado como pista" });
    }

    const edgeIds = new Set<string>();
    const linked = new Set<string>();
    graph.edges.forEach((e, i) => {
      if (edgeIds.has(e.id)) {
        ctx.addIssue({ code: "custom", path: ["edges", i, "id"], message: `Arista repetida: ${e.id}` });
      }
      edgeIds.add(e.id);
      for (const end of ["source", "target"] as const) {
        if (!nodes.has(e[end])) {
          ctx.addIssue({ code: "custom", path: ["edges", i, end], message: `Nodo inexistente: ${e[end]}` });
        }
      }
      if (e.source === e.target) {
        ctx.addIssue({ code: "custom", path: ["edges", i], message: "Una arista no puede unir un nodo consigo mismo" });
      }
      if (e.type === "shared_phrase" && !e.quote) {
        ctx.addIssue({ code: "custom", path: ["edges", i, "quote"], message: "Una frase compartida necesita la frase" });
      }
      linked.add(pairKey(e.source, e.target));
    });

    const perLane = new Map<Lane, number>();
    graph.recommendations.forEach((rec, i) => {
      perLane.set(rec.lane, (perLane.get(rec.lane) ?? 0) + 1);
      const target = nodes.get(rec.nodeId);
      if (!target) {
        ctx.addIssue({ code: "custom", path: ["recommendations", i, "nodeId"], message: `Nodo inexistente: ${rec.nodeId}` });
      } else if (target.kind !== "book") {
        ctx.addIssue({ code: "custom", path: ["recommendations", i, "nodeId"], message: "Solo se recomiendan libros" });
      }
      const [first] = rec.path;
      const last = rec.path[rec.path.length - 1];
      if (!nodes.get(first)?.isClue) {
        ctx.addIssue({ code: "custom", path: ["recommendations", i, "path", 0], message: "El recorrido tiene que empezar en una pista" });
      }
      if (last !== rec.nodeId) {
        ctx.addIssue({ code: "custom", path: ["recommendations", i, "path"], message: "El recorrido tiene que terminar en el libro recomendado" });
      }
      if (rec.path.length - 1 > GRAPH_LIMITS.maxHops) {
        ctx.addIssue({ code: "custom", path: ["recommendations", i, "path"], message: `Máximo ${GRAPH_LIMITS.maxHops} saltos` });
      }
      for (let k = 0; k < rec.path.length - 1; k++) {
        if (!linked.has(pairKey(rec.path[k], rec.path[k + 1]))) {
          ctx.addIssue({
            code: "custom",
            path: ["recommendations", i, "path", k],
            message: `No hay arista entre ${rec.path[k]} y ${rec.path[k + 1]}`,
          });
        }
      }
    });

    for (const [lane, count] of perLane) {
      if (count > GRAPH_LIMITS.maxPerLane) {
        ctx.addIssue({ code: "custom", path: ["recommendations"], message: `Demasiadas recomendaciones en ${lane}` });
      }
    }
    for (const lane of LaneSchema.options) {
      if (!perLane.has(lane)) {
        ctx.addIssue({ code: "custom", path: ["recommendations"], message: `Falta al menos una recomendación en ${lane}` });
      }
    }
  });
export type ConnectionGraph = z.infer<typeof ConnectionGraphSchema>;
/** Forma de entrada (antes de aplicar defaults), útil para escribir datos a mano. */
export type ConnectionGraphInput = z.input<typeof ConnectionGraphSchema>;

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
