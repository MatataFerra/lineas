import type { ConnectionGraph } from "@/lib/graph/schema";

/**
 * Indicadores para comparar grafos entre modelos o versiones del prompt.
 * No juzgan si una conexión es cierta (eso lo tiene que leer una persona),
 * pero sí si el mapa tiene la forma que buscamos.
 */
export interface GraphQuality {
  recommendations: number;
  verified: number;
  distinctAuthors: number;
  twoHopPaths: number;
  /** Recorridos de un salto que salen directo de una idea: los más pobres. */
  directFromConcept: number;
  /** Influencias, otras artes y frases compartidas: lo que cuenta historia. */
  historyEdges: number;
  edges: number;
  interpretiveShare: number;
}

export function graphQuality(graph: ConnectionGraph): GraphQuality {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const recBooks = graph.recommendations.map((r) => nodes.get(r.nodeId));
  return {
    recommendations: graph.recommendations.length,
    verified: recBooks.filter((n) => n?.book?.verified).length,
    distinctAuthors: new Set(recBooks.map((n) => n?.book?.author ?? n?.subtitle)).size,
    twoHopPaths: graph.recommendations.filter((r) => r.path.length === 3).length,
    directFromConcept: graph.recommendations.filter((r) => r.path.length === 2 && nodes.get(r.path[0])?.kind === "concept").length,
    historyEdges: graph.edges.filter((e) => e.type === "influence" || e.type === "other_arts" || e.type === "shared_phrase").length,
    edges: graph.edges.length,
    interpretiveShare: graph.edges.length ? graph.edges.filter((e) => e.confidence === "interpretive").length / graph.edges.length : 0,
  };
}
