import { edgeGeometry, layoutGraph, DEFAULT_LAYOUT, type EdgeGeometry, type GraphLayout } from "@/lib/graph/layout";
import { indexGraph, pathEdges, type GraphIndex } from "@/lib/graph/queries";
import type { ConnectionGraph, EdgeType, GraphEdge, Recommendation } from "@/lib/graph/schema";

export type Selection = { kind: "path" } | { kind: "node"; id: string } | { kind: "edge"; id: string };

/** Lo que no depende de la interacción: índice, layout y geometría. Se calcula una vez por grafo. */
export interface GraphModel {
  graph: ConnectionGraph;
  index: GraphIndex;
  layout: GraphLayout;
  geometry: Map<string, EdgeGeometry>;
}

export function buildModel(graph: ConnectionGraph): GraphModel {
  const index = indexGraph(graph);
  const layout = layoutGraph(graph.nodes, DEFAULT_LAYOUT);
  const geometry = edgeGeometry(graph.edges, layout.positions, layout.options);
  return { graph, index, layout, geometry };
}

export interface ViewState {
  rec: Recommendation;
  steps: GraphEdge[];
  highlightNodes: Set<string>;
  highlightEdges: Set<string>;
  visibleNodes: Set<string>;
  visibleEdges: GraphEdge[];
}

/** Qué se ilumina y qué se ve, según el recorrido elegido, la selección y los filtros. */
export function viewState(
  model: GraphModel,
  rec: Recommendation,
  selection: Selection,
  maxHops: number,
  hiddenTypes: ReadonlySet<EdgeType>,
): ViewState {
  const { graph, index } = model;
  const steps = pathEdges(index, rec.path);

  let highlightNodes: Set<string>;
  let highlightEdges: Set<string>;
  if (selection.kind === "node") {
    const incident = index.edgesByNode.get(selection.id) ?? [];
    highlightEdges = new Set(incident.map((e) => e.id));
    highlightNodes = new Set([selection.id, ...incident.flatMap((e) => [e.source, e.target])]);
  } else if (selection.kind === "edge") {
    const edge = graph.edges.find((e) => e.id === selection.id);
    highlightEdges = new Set(edge ? [edge.id] : []);
    highlightNodes = new Set(edge ? [edge.source, edge.target] : []);
  } else {
    highlightEdges = new Set(steps.map((e) => e.id));
    highlightNodes = new Set(rec.path);
  }

  const visibleNodes = new Set(
    graph.nodes.filter((n) => (index.hops.get(n.id) ?? Infinity) <= maxHops || rec.path.includes(n.id)).map((n) => n.id),
  );
  const visibleEdges = graph.edges.filter(
    (e) => visibleNodes.has(e.source) && visibleNodes.has(e.target) && (!hiddenTypes.has(e.type) || highlightEdges.has(e.id)),
  );

  return { rec, steps, highlightNodes, highlightEdges, visibleNodes, visibleEdges };
}
