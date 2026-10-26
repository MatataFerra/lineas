import { pairKey, type ConnectionGraph, type GraphEdge, type GraphNode, type Lane, type Recommendation } from "./schema";

export interface GraphIndex {
  nodes: Map<string, GraphNode>;
  edgeByPair: Map<string, GraphEdge>;
  edgesByNode: Map<string, GraphEdge[]>;
  /** Saltos desde la pista más cercana (0 = es una pista). */
  hops: Map<string, number>;
}

export function indexGraph(graph: ConnectionGraph): GraphIndex {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const edgeByPair = new Map<string, GraphEdge>();
  const edgesByNode = new Map<string, GraphEdge[]>();

  for (const edge of graph.edges) {
    edgeByPair.set(pairKey(edge.source, edge.target), edge);
    for (const end of [edge.source, edge.target]) {
      const list = edgesByNode.get(end) ?? [];
      list.push(edge);
      edgesByNode.set(end, list);
    }
  }

  const hops = new Map<string, number>();
  const queue: string[] = [];
  for (const node of graph.nodes) {
    if (node.isClue) {
      hops.set(node.id, 0);
      queue.push(node.id);
    }
  }
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of edgesByNode.get(current) ?? []) {
      const next = otherEnd(edge, current);
      if (!hops.has(next)) {
        hops.set(next, hops.get(current)! + 1);
        queue.push(next);
      }
    }
  }

  return { nodes, edgeByPair, edgesByNode, hops };
}

export function otherEnd(edge: GraphEdge, id: string): string {
  return edge.source === id ? edge.target : edge.source;
}

/** Las aristas de un recorrido, en orden. */
export function pathEdges(index: GraphIndex, path: string[]): GraphEdge[] {
  const result: GraphEdge[] = [];
  for (let k = 0; k < path.length - 1; k++) {
    const edge = index.edgeByPair.get(pairKey(path[k], path[k + 1]));
    if (edge) result.push(edge);
  }
  return result;
}

export function recommendationsByLane(graph: ConnectionGraph): Record<Lane, Recommendation[]> {
  const lanes: Record<Lane, Recommendation[]> = { affinity: [], alternative: [], beyond: [] };
  for (const rec of graph.recommendations) lanes[rec.lane].push(rec);
  return lanes;
}

/** Año representativo de un nodo, para ubicarlo en la línea de tiempo. */
export function yearOf(node: GraphNode): number {
  const { from, to, pivot } = node.era;
  if (pivot !== undefined) return pivot;
  return to === undefined ? from : Math.round((from + to) / 2);
}

/** "15 años antes", "125 años después", "misma época". */
export function describeTimeJump(from: GraphNode, to: GraphNode): string {
  const diff = yearOf(to) - yearOf(from);
  if (Math.abs(diff) < 2) return "misma época";
  const n = Math.abs(diff);
  return `${n} años ${diff < 0 ? "antes" : "después"}`;
}
