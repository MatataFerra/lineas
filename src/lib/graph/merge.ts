import { pairKey, type Clue, type ConnectionGraph, type GraphEdge, type GraphNode, type Recommendation } from "./schema";

/**
 * Cada carril llega como un subgrafo propio (una recomendación y su recorrido).
 * El mapa de conexiones es la unión de los carriles visibles: los nodos se
 * unen por id (las pistas tienen ids fijos, así que coinciden entre carriles)
 * y las aristas por par de nodos.
 */
export function mergeLaneGraphs(clues: Clue[], parts: ConnectionGraph[]): ConnectionGraph {
  const nodes = new Map<string, GraphNode>();
  const edgesByPair = new Map<string, GraphEdge>();
  const usedEdgeIds = new Set<string>();
  const recommendations: Recommendation[] = [];

  for (const part of parts) {
    for (const node of part.nodes) {
      const existing = nodes.get(node.id);
      if (!existing) nodes.set(node.id, node);
      else if (node.book?.verified && !existing.book?.verified) nodes.set(node.id, { ...existing, book: node.book });
      else if (node.isClue && !existing.isClue) nodes.set(node.id, { ...existing, isClue: true });
    }
    for (const edge of part.edges) {
      const key = pairKey(edge.source, edge.target);
      if (edgesByPair.has(key)) continue;
      let id = edge.id;
      for (let n = 2; usedEdgeIds.has(id); n++) id = `${edge.id}-${n}`;
      usedEdgeIds.add(id);
      edgesByPair.set(key, id === edge.id ? edge : { ...edge, id });
    }
    recommendations.push(...part.recommendations);
  }

  return { version: 1, clues, nodes: [...nodes.values()], edges: [...edgesByPair.values()], recommendations };
}

/** El subgrafo de una recomendación: sus paradas, las pistas que aparecen y las aristas entre ellas. */
export function laneSubgraph(graph: ConnectionGraph, rec: Recommendation): ConnectionGraph {
  const keep = new Set(rec.path);
  for (const node of graph.nodes) {
    // Las pistas conectadas a alguna parada dan contexto sin agrandar el mapa.
    if (node.isClue && graph.edges.some((e) => (e.source === node.id && keep.has(e.target)) || (e.target === node.id && keep.has(e.source)))) {
      keep.add(node.id);
    }
  }
  return {
    version: 1,
    clues: graph.clues,
    nodes: graph.nodes.filter((n) => keep.has(n.id)),
    edges: graph.edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
    recommendations: [rec],
  };
}

/** El libro recomendado de un carril. */
export function recommendedBook(graph: ConnectionGraph): GraphNode | undefined {
  const rec = graph.recommendations[0];
  return rec ? graph.nodes.find((n) => n.id === rec.nodeId) : undefined;
}

/** Clave para comparar autores: el apellido, sin tildes ni mayúsculas. */
export function authorKey(author: string): string {
  const parts = author
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/);
  return parts[parts.length - 1] ?? "";
}

export function authorOf(node: GraphNode): string {
  return node.book?.author ?? node.subtitle ?? "";
}
