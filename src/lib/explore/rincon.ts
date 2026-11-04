import { z } from "zod";
import { GraphEdgeSchema, GraphNodeSchema, type GraphEdge, type GraphNode } from "@/lib/graph/schema";

/**
 * Un rincón de Explorar: un tema en el centro (un movimiento, una época, una
 * idea, un lugar) y su constelación de libros, personas y obras de otras artes.
 * Se generan una vez con el modelo (scripts/seed-rincones.mts), cada libro se
 * verifica en catálogos y el resultado vive en el repo: revisable en un diff,
 * sin base de datos y sin nada que los usuarios puedan escribir.
 */

export const RinconGroupSchema = z.enum(["movimiento", "epoca", "tema", "lugar"]);
export type RinconGroup = z.infer<typeof RinconGroupSchema>;

export const RINCON_GROUPS: { id: RinconGroup; label: string; one: string }[] = [
  { id: "movimiento", label: "Movimientos", one: "Movimiento" },
  { id: "epoca", label: "Épocas", one: "Época" },
  { id: "tema", label: "Temas", one: "Tema" },
  { id: "lugar", label: "Lugares", one: "Lugar" },
];

export const RINCON_LIMITS = { minBooks: 4, maxBooks: 7, maxOthers: 6 } as const;

export const RinconSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1).max(60),
    group: RinconGroupSchema,
    /** Dos o tres frases: qué une a todo lo que hay en el mapa. */
    intro: z.string().min(40).max(420),
    /** El nodo del centro; su id es el slug del rincón. */
    centerId: z.string(),
    nodes: z.array(GraphNodeSchema),
    edges: z.array(GraphEdgeSchema),
  })
  .superRefine((r, ctx) => {
    for (const issue of rinconIssues(r)) ctx.addIssue({ code: "custom", message: issue });
  });
export type Rincon = z.infer<typeof RinconSchema>;

/** Las reglas de un rincón bien formado, como lista de problemas (vacía si está bien). */
export function rinconIssues(r: { centerId: string; nodes: GraphNode[]; edges: GraphEdge[] }): string[] {
  const issues: string[] = [];
  const ids = new Set(r.nodes.map((n) => n.id));
  if (ids.size !== r.nodes.length) issues.push("Hay ids de nodo repetidos");
  if (!ids.has(r.centerId)) issues.push(`Falta el nodo del centro (${r.centerId})`);

  const books = r.nodes.filter((n) => n.kind === "book" && n.id !== r.centerId);
  const others = r.nodes.filter((n) => n.kind !== "book" && n.id !== r.centerId);
  if (books.length < RINCON_LIMITS.minBooks || books.length > RINCON_LIMITS.maxBooks) {
    issues.push(`Tiene ${books.length} libros (entre ${RINCON_LIMITS.minBooks} y ${RINCON_LIMITS.maxBooks})`);
  }
  if (others.length > RINCON_LIMITS.maxOthers) issues.push(`Tiene ${others.length} personas, obras o ideas (máximo ${RINCON_LIMITS.maxOthers})`);

  const edgeIds = new Set<string>();
  const linked = new Set<string>();
  for (const e of r.edges) {
    if (edgeIds.has(e.id)) issues.push(`Arista repetida: ${e.id}`);
    edgeIds.add(e.id);
    if (!ids.has(e.source) || !ids.has(e.target)) issues.push(`${e.id}: une nodos que no existen`);
    if (e.source === e.target) issues.push(`${e.id}: une un nodo consigo mismo`);
    linked.add(e.source);
    linked.add(e.target);
  }
  for (const n of r.nodes) if (!linked.has(n.id)) issues.push(`${n.id} no tiene ninguna conexión`);
  for (const n of books) if (!n.book?.verified) issues.push(`${n.id} no está verificado en un catálogo`);
  return issues;
}

/** Lo que muestra la lista de rincones, sin el mapa. */
export interface RinconSummary {
  slug: string;
  title: string;
  group: RinconGroup;
  intro: string;
  covers: { id: string; title: string; author: string; coverUrl?: string }[];
}

export function summarize(r: Rincon): RinconSummary {
  const books = r.nodes.filter((n) => n.kind === "book" && n.id !== r.centerId);
  return {
    slug: r.slug,
    title: r.title,
    group: r.group,
    intro: r.intro,
    covers: books.slice(0, 3).map((n) => ({ id: n.id, title: n.label, author: n.book?.author ?? n.subtitle ?? "", ...(n.book?.coverUrl ? { coverUrl: n.book.coverUrl } : {}) })),
  };
}

/** En qué otros rincones aparece cada nodo de éste: los puentes para seguir explorando. */
export function bridges(rincon: Rincon, all: Rincon[]): Record<string, { slug: string; title: string }[]> {
  const out: Record<string, { slug: string; title: string }[]> = {};
  for (const node of rincon.nodes) {
    const elsewhere = all.filter((r) => r.slug !== rincon.slug && (r.centerId === node.id || r.nodes.some((n) => n.id === node.id)));
    if (elsewhere.length) out[node.id] = elsewhere.map((r) => ({ slug: r.slug, title: r.title }));
  }
  return out;
}
