import { lastName } from "@/lib/catalog/books";
import type { GraphEdge, GraphNode } from "@/lib/graph/schema";
import { slug } from "@/lib/recommend/normalize";
import type { Rincon } from "./rincon";

/**
 * Pasos de curaduría que corren sobre los rincones ya generados, antes de
 * guardarlos. Son puros: el script de siembra los combina con el modelo.
 */

/** Quita nodos y aristas, y después lo que quedó suelto (menos el centro). */
export function prune(r: Rincon, removeNodes: Iterable<string>, removeEdges: Iterable<string> = []): Rincon {
  const goneNodes = new Set(removeNodes);
  goneNodes.delete(r.centerId);
  const goneEdges = new Set(removeEdges);
  let nodes = r.nodes.filter((n) => !goneNodes.has(n.id));
  let ids = new Set(nodes.map((n) => n.id));
  let edges = r.edges.filter((e) => !goneEdges.has(e.id) && ids.has(e.source) && ids.has(e.target));
  // Sacar un nodo puede dejar a otro sin conexiones, y así: hasta que no cambie.
  for (;;) {
    const linked = new Set(edges.flatMap((e) => [e.source, e.target]));
    const next = nodes.filter((n) => n.id === r.centerId || linked.has(n.id));
    if (next.length === nodes.length) break;
    nodes = next;
    ids = new Set(nodes.map((n) => n.id));
    edges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }
  return { ...r, nodes, edges };
}

/** belongs_to va del libro al movimiento o la idea: si vino al revés, se da vuelta. */
export function fixDirections(r: Rincon): Rincon {
  const kind = new Map(r.nodes.map((n) => [n.id, n.kind]));
  const edges = r.edges.map((e) => {
    const backwards = e.type === "belongs_to" && kind.get(e.target) !== "movement" && kind.get(e.target) !== "concept" && (kind.get(e.source) === "movement" || kind.get(e.source) === "concept");
    return backwards ? { ...e, id: edgeId(e.target, e.type, e.source), source: e.target, target: e.source } : e;
  });
  return { ...r, edges: dedupeEdges(edges) };
}

/**
 * El mismo libro con dos nombres en dos rincones («En el camino» y «En la
 * ruta») corta los puentes. Se reconoce por el registro de catálogo o por el
 * título original y el apellido del autor; gana el primero que aparece.
 */
export function unifyBooks(rincones: Rincon[]): Rincon[] {
  const canonical = new Map<string, GraphNode>();
  const keysOf = (n: GraphNode) => {
    const author = slug(lastName(n.book?.author ?? n.subtitle ?? ""));
    return [
      n.book?.openLibraryKey && `ol:${n.book.openLibraryKey}`,
      n.book?.googleBooksId && `gb:${n.book.googleBooksId}`,
      n.originalTitle && `t:${slug(n.originalTitle)}|${author}`,
      `t:${slug(n.label)}|${author}`,
    ].filter((k): k is string => !!k);
  };

  return rincones.map((r) => {
    const rename = new Map<string, string>();
    const nodes = r.nodes.flatMap((n) => {
      if (n.kind !== "book") return [n];
      const keys = keysOf(n);
      const first = keys.map((k) => canonical.get(k)).find(Boolean);
      const chosen = first ?? n;
      for (const k of [...keys, ...keysOf(chosen)]) if (!canonical.has(k)) canonical.set(k, chosen);
      if (chosen.id !== n.id) rename.set(n.id, chosen.id);
      return [{ ...n, id: chosen.id, label: chosen.label, ...(chosen.originalTitle ? { originalTitle: chosen.originalTitle } : {}) }];
    });
    if (!rename.size) return r;
    const unique = nodes.filter((n, i) => nodes.findIndex((m) => m.id === n.id) === i);
    const to = (id: string) => rename.get(id) ?? id;
    const edges = r.edges.map((e) => ({ ...e, id: edgeId(to(e.source), e.type, to(e.target)), source: to(e.source), target: to(e.target) })).filter((e) => e.source !== e.target);
    return { ...r, nodes: unique, edges: dedupeEdges(edges) };
  });
}

export const edgeId = (source: string, type: string, target: string) => `${source}--${type}--${target}`;

function dedupeEdges(edges: GraphEdge[]): GraphEdge[] {
  return edges.filter((e, i) => edges.findIndex((f) => f.id === e.id) === i);
}
