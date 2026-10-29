import { GRAPH_LIMITS, type Clue } from "@/lib/graph/schema";

/**
 * Reparaciones deterministas sobre la salida cruda del modelo, antes de validar.
 *
 * Solo arregla lo que se puede arreglar sin inventar nada: largos excedidos,
 * ids con formato incorrecto, aristas que apuntan a nodos inexistentes. Lo que
 * cambia el sentido (un recorrido roto, un carril vacío) se deja para que la
 * validación lo rechace y el modelo lo corrija en el reintento.
 */
export function normalizeRawGraph(raw: unknown, clues: Clue[]): unknown {
  if (!isRecord(raw)) return raw;

  const idMap = new Map<string, string>();
  const seenNodes = new Set<string>();
  const nodes = asArray(raw.nodes)
    .filter(isRecord)
    .map((node) => {
      const id = slug(String(node.id ?? node.label ?? ""));
      if (typeof node.id === "string") idMap.set(node.id, id);
      const kind = node.kind;
      const subtitle = typeof node.subtitle === "string" ? clip(node.subtitle, 60) : undefined;
      const book = kind === "book" ? { author: subtitle || "Autor desconocido", verified: false } : undefined;
      return {
        ...node,
        id,
        label: clip(String(node.label ?? ""), 80),
        subtitle,
        ...(typeof node.originalTitle === "string" && node.originalTitle.trim() ? { originalTitle: clip(node.originalTitle, 120) } : { originalTitle: undefined }),
        isClue: node.isClue === true,
        era: normalizeEra(node.era),
        ...(book ? { book } : {}),
      };
    })
    // Un nodo repetido se queda con la primera aparición.
    .filter((node) => (seenNodes.has(node.id) ? false : (seenNodes.add(node.id), true)));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const spanById = new Map(nodes.map((n) => [n.id, span(n as Record<string, unknown>)]));
  const kindById = new Map(nodes.map((n) => [n.id, String((n as Record<string, unknown>).kind)]));
  const mapId = (value: unknown) => (typeof value === "string" ? (idMap.get(value) ?? slug(value)) : value);

  const seenEdges = new Set<string>();
  const edges = asArray(raw.edges)
    .filter(isRecord)
    .map((edge, i) => ({
      ...edge,
      id: typeof edge.id === "string" && edge.id ? edge.id : `e${i + 1}`,
      source: mapId(edge.source),
      target: mapId(edge.target),
      summary: clip(String(edge.summary ?? ""), 140),
      explanation: clip(String(edge.explanation ?? ""), 600),
      ...(typeof edge.quote === "string" ? { quote: clip(edge.quote, 200) } : {}),
    }))
    .map((edge) => retype(edge, kindById))
    .map((edge) => {
      // Una influencia va de lo anterior a lo posterior. Si el modelo la escribió al revés
      // (la explicación suele estar bien, solo invirtió los extremos), la damos vuelta.
      const type = (edge as Record<string, unknown>).type;
      if (type !== "influence" && type !== "other_arts") return edge;
      // Solo se invierte si en el orden dado es imposible y al revés no lo es.
      const s = spanById.get(String(edge.source));
      const t = spanById.get(String(edge.target));
      if (!s || !t) return edge;
      const impossible = s.earliest > t.latest + 2;
      const reversedOk = t.earliest <= s.latest + 2;
      return impossible && reversedOk ? { ...edge, source: edge.target, target: edge.source } : edge;
    })
    .filter((edge) => {
      if (!nodeIds.has(String(edge.source)) || !nodeIds.has(String(edge.target))) return false;
      if (seenEdges.has(edge.id)) edge.id = `${edge.id}-${seenEdges.size}`;
      seenEdges.add(edge.id);
      return true;
    });

  const recommendations = asArray(raw.recommendations)
    .filter(isRecord)
    .map((rec) => ({
      ...rec,
      nodeId: mapId(rec.nodeId),
      path: asArray(rec.path).map(mapId),
      pitch: clip(String(rec.pitch ?? ""), 400),
      pathSummary: clip(String(rec.pathSummary ?? ""), 240),
    }));

  const pruned = pruneNodes(nodes, edges, recommendations);

  // Las pistas son las del usuario, no las que el modelo dice que recibió.
  return { version: 1, clues, nodes: pruned.nodes, edges: pruned.edges, recommendations };
}

type LooseEdge = Record<string, unknown> & { id: string; source: unknown; target: unknown };

/**
 * Corrige tipos de arista mal elegidos cuando la intención es inequívoca:
 * - persona ↔ libro marcado como same_author → authored (persona → libro).
 * - libro → idea marcado como belongs_to → shared_theme: una novela no "pertenece"
 *   al desarraigo, lo comparte.
 * - una idea como origen de other_arts → shared_theme.
 */
function retype<E extends LooseEdge>(edge: E, kindById: Map<string, string>): E {
  const sourceKind = kindById.get(String(edge.source));
  const targetKind = kindById.get(String(edge.target));
  const type = edge.type;
  if (type === "same_author" || type === "authored") {
    if (sourceKind === "person" && targetKind === "book") return { ...edge, type: "authored" };
    if (sourceKind === "book" && targetKind === "person") return { ...edge, type: "authored", source: edge.target, target: edge.source };
  }
  if (type === "belongs_to" && (targetKind === "concept" || sourceKind === "concept")) return { ...edge, type: "shared_theme" };
  if (type === "other_arts" && (sourceKind === "concept" || targetKind === "concept")) return { ...edge, type: "shared_theme" };
  return edge;
}

/**
 * Si el modelo se pasó del máximo de nodos, saca los que no están en ningún
 * recorrido ni son pistas, empezando por los menos conectados. Así un mapa con
 * 18 nodos no obliga a pagar otro intento.
 */
function pruneNodes<N extends { id: string; isClue: boolean }, E extends LooseEdge>(
  nodes: N[],
  edges: E[],
  recommendations: { nodeId?: unknown; path?: unknown[] }[],
): { nodes: N[]; edges: E[] } {
  if (nodes.length <= GRAPH_LIMITS.maxNodes) return { nodes, edges };
  const protectedIds = new Set<string>(nodes.filter((n) => n.isClue).map((n) => n.id));
  for (const rec of recommendations) {
    if (typeof rec.nodeId === "string") protectedIds.add(rec.nodeId);
    for (const id of rec.path ?? []) if (typeof id === "string") protectedIds.add(id);
  }
  const degree = new Map<string, number>();
  for (const e of edges) for (const end of [e.source, e.target]) degree.set(String(end), (degree.get(String(end)) ?? 0) + 1);

  const removable = nodes.filter((n) => !protectedIds.has(n.id)).sort((a, b) => (degree.get(a.id) ?? 0) - (degree.get(b.id) ?? 0));
  const removed = new Set(removable.slice(0, nodes.length - GRAPH_LIMITS.maxNodes).map((n) => n.id));
  return {
    nodes: nodes.filter((n) => !removed.has(n.id)),
    edges: edges.filter((e) => !removed.has(String(e.source)) && !removed.has(String(e.target))),
  };
}

function normalizeEra(era: unknown): unknown {
  if (!isRecord(era)) return era;
  const toInt = (v: unknown) => (typeof v === "number" ? Math.round(v) : typeof v === "string" && /^-?\d+$/.test(v) ? Number(v) : v);
  const from = toInt(era.from);
  const to = era.to === null || era.to === undefined ? undefined : toInt(era.to);
  const pivot = era.pivot === null || era.pivot === undefined ? undefined : toInt(era.pivot);
  const label = typeof era.label === "string" && era.label.trim() ? clip(era.label, 24) : String(from);
  return { from, ...(to !== undefined ? { to } : {}), label, ...(pivot !== undefined ? { pivot } : {}) };
}

/** Mismo criterio que el esquema: una persona cuenta por su período (desde los 15). */
function span(node: Record<string, unknown>): { earliest: number; latest: number } | undefined {
  const era = node.era;
  const year = representativeYear(era);
  if (year === undefined || !isRecord(era)) return undefined;
  if (typeof era.to !== "number") return { earliest: year, latest: year };
  return { earliest: (era.from as number) + (node.kind === "person" ? 15 : 0), latest: era.to };
}

function representativeYear(era: unknown): number | undefined {
  if (!isRecord(era) || typeof era.from !== "number") return undefined;
  if (typeof era.pivot === "number") return era.pivot;
  return typeof era.to === "number" ? Math.round((era.from + era.to) / 2) : era.from;
}

export function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clip(value: string, max: number): string {
  const clean = value.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
