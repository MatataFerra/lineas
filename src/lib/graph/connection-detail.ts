import { LANE_ORDER } from "./labels";
import { indexGraph, otherEnd, pathEdges, yearOf, type GraphIndex } from "./queries";
import type { ConnectionGraph, GraphEdge, GraphNode } from "./schema";

export interface ConnectionDetail {
  node: GraphNode;
  author: string;
  year: number;
  isClue: boolean;
  /** Movimientos, ideas y artes con los que el libro está conectado en este mapa. */
  tags: string[];
  /** Por qué aparece: el pitch si es una recomendación, si no la arista que lo une al mapa. */
  text: string | null;
  related: GraphNode[];
  /** Cómo se llega desde las pistas: cada salto con su arista. Vacío si el libro es una pista. */
  route: { from: GraphNode; to: GraphNode; edge: GraphEdge }[];
  /** Su lugar entre los libros del mapa (base 1), para el «3/12» y para recorrerlos. */
  position: { index: number; total: number };
}

/** Los libros del mapa en el orden en que se recorren en el modal: recomendaciones por carril, después el resto por época. */
export function booksInOrder(graph: ConnectionGraph): GraphNode[] {
  const books = graph.nodes.filter((n) => n.kind === "book");
  const recOrder = LANE_ORDER.flatMap((lane) => graph.recommendations.filter((r) => r.lane === lane).map((r) => r.nodeId));
  const rank = (n: GraphNode) => {
    const i = recOrder.indexOf(n.id);
    return i === -1 ? recOrder.length : i;
  };
  return books.sort((a, b) => rank(a) - rank(b) || yearOf(a) - yearOf(b));
}

export function connectionDetail(graph: ConnectionGraph, nodeId: string): ConnectionDetail | null {
  const index = indexGraph(graph);
  const node = index.nodes.get(nodeId);
  if (!node || node.kind !== "book") return null;

  const incident = index.edgesByNode.get(node.id) ?? [];
  const neighbors = incident.map((e) => index.nodes.get(otherEnd(e, node.id))!).filter(Boolean);
  const tags = neighbors.filter((n) => n.kind === "movement" || n.kind === "concept" || n.kind === "art").map((n) => n.label).slice(0, 3);

  const rec = graph.recommendations.find((r) => r.nodeId === node.id);
  // Sin pitch, la arista más cercana a las pistas es la que mejor explica por qué está en el mapa.
  const hopsOf = (id: string) => index.hops.get(id) ?? Infinity;
  const nearest = [...incident].sort((a, b) => hopsOf(otherEnd(a, node.id)) - hopsOf(otherEnd(b, node.id)))[0];
  const text = rec?.pitch ?? nearest?.explanation ?? null;

  const books = booksInOrder(graph);
  const others = books.filter((b) => b.id !== node.id);
  const direct = new Set(neighbors.map((n) => n.id));
  const related = [...others.filter((b) => direct.has(b.id)), ...others.filter((b) => !direct.has(b.id))].slice(0, 3);

  const path = node.isClue ? [node.id] : (rec?.path ?? shortestFromClues(index, node.id));
  const route = pathEdges(index, path).map((edge, k) => ({ from: index.nodes.get(path[k])!, to: index.nodes.get(path[k + 1])!, edge }));

  return {
    node,
    author: node.book?.author ?? node.subtitle ?? "",
    year: yearOf(node),
    isClue: node.isClue,
    tags,
    text,
    related,
    route,
    position: { index: books.findIndex((b) => b.id === node.id) + 1, total: books.length },
  };
}

/** El camino más corto desde cualquier pista hasta el nodo (BFS); [id] si no hay ninguno. */
function shortestFromClues(index: GraphIndex, id: string): string[] {
  const prev = new Map<string, string | null>();
  const queue: string[] = [];
  for (const node of index.nodes.values()) {
    if (node.isClue) {
      prev.set(node.id, null);
      queue.push(node.id);
    }
  }
  while (queue.length) {
    const current = queue.shift()!;
    if (current === id) break;
    for (const edge of index.edgesByNode.get(current) ?? []) {
      const next = otherEnd(edge, current);
      if (!prev.has(next)) {
        prev.set(next, current);
        queue.push(next);
      }
    }
  }
  if (!prev.has(id)) return [id];
  const path: string[] = [];
  for (let at: string | null = id; at !== null; at = prev.get(at) ?? null) path.unshift(at);
  return path;
}
