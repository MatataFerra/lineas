"use client";

import { create } from "zustand";
import { authorOf, mergeLaneGraphs, recommendedBook } from "@/lib/graph/merge";
import { indexGraph, pathEdges } from "@/lib/graph/queries";
import { LaneSchema, MAX_CLUES, type Clue, type ClueKind, type ConnectionGraph, type GraphEdge, type GraphNode, type Lane } from "@/lib/graph/schema";
import { readEventStream, type ExcludedBook, type StreamEvent } from "@/lib/recommend/events";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Enums, Json } from "@/lib/supabase/database.types";

export type LibraryStatus = Enums<"library_status">;

type Status = "idle" | "loading" | "ready" | "error";

/** Un carril: las opciones que ya llegaron ("ver otra" agrega) y cuál se muestra. */
export interface LaneState {
  status: "pending" | "ready" | "error";
  options: ConnectionGraph[];
  index: number;
  /** Se está pidiendo otra opción para este carril. */
  loadingMore: boolean;
  error: string | null;
  /** De dónde salió cada opción, en el mismo orden que `options`. */
  sources: OptionSource[];
}

/** El origen de una opción: si la armó el motor recién o vino del cache, y cuánto tardó. */
export interface OptionSource {
  cached: boolean;
  ms: number;
}

/** Qué motor respondió la última búsqueda: "mock" es el grafo de ejemplo, sin IA. */
export type EngineName = "mock" | "openrouter" | "deepseek";

const emptyLane = (): LaneState => ({ status: "pending", options: [], index: 0, loadingMore: false, error: null, sources: [] });
const emptyLanes = (): Record<Lane, LaneState> => ({ affinity: emptyLane(), alternative: emptyLane(), beyond: emptyLane() });

export interface SessionUser {
  id: string;
  email: string | null;
}

/** Lo mínimo de un libro para guardarlo en la biblioteca. */
export interface BookSnapshot {
  id: string;
  title: string;
  author: string | null;
  yearLabel: string | null;
  coverUrl: string | null;
}

export function bookSnapshot(node: GraphNode): BookSnapshot {
  return {
    id: node.id,
    title: node.label,
    author: node.book?.author ?? node.subtitle ?? null,
    yearLabel: node.era.label,
    coverUrl: node.book?.coverUrl ?? null,
  };
}

export interface LibraryEntry extends BookSnapshot {
  statuses: Partial<Record<LibraryStatus, string>>; // status → created_at
}

interface LineasState {
  clues: Clue[];
  /** Los carriles, cada uno llega por su cuenta. */
  lanes: Record<Lane, LaneState>;
  /** El mapa visible: la unión del libro que se muestra en cada carril. */
  graph: ConnectionGraph | null;
  /** "ready" apenas llega el primer carril. */
  status: Status;
  error: string | null;
  /** El error es por las pistas (el filtro las rechazó): reintentar no sirve, hay que editarlas. */
  errorNeedsEdit: boolean;
  /** Firma de las pistas con las que se armó `graph`. */
  graphKey: string | null;
  /** Libro (id de nodo) cuyo recorrido se muestra en el mapa. */
  focus: string | null;
  /** El motor que respondió (cabecera x-lineas-engine); null hasta la primera respuesta. */
  engine: EngineName | null;

  /** null = sin sesión. `authReady` indica si ya sabemos cuál de los dos casos es. */
  user: SessionUser | null;
  authReady: boolean;
  /** Biblioteca: por id de libro. Sin sesión vive solo en memoria. */
  library: Record<string, LibraryEntry>;
  libraryError: string | null;

  /** Mis votos de conexiones, por edgeKey. */
  edgeVotes: Record<string, Vote>;
  /** Mis votos de recomendaciones en esta búsqueda, por id de libro. */
  recVotes: Record<string, Vote>;
  voteError: string | null;

  hasClue: (label: string) => boolean;
  addClue: (label: string, kind: ClueKind) => void;
  toggleClue: (label: string, kind: ClueKind) => void;
  removeClue: (id: string) => void;
  search: (options?: { force?: boolean }) => Promise<void>;
  /** "No es lo que busco · ver otra": la siguiente opción del carril, o una nueva. */
  showAnother: (lane: Lane) => Promise<void>;
  retryLane: (lane: Lane) => Promise<void>;
  setFocus: (nodeId: string | null) => void;

  isIn: (bookId: string, status: LibraryStatus) => boolean;
  toggleLibrary: (book: BookSnapshot, status: LibraryStatus) => Promise<void>;
  setUser: (user: SessionUser | null) => Promise<void>;
  /** 1 = me convence, -1 = no; votar lo mismo otra vez quita el voto. */
  voteEdge: (edge: GraphEdge, value: Vote) => Promise<void>;
  voteRecommendation: (lane: Lane, value: Vote) => Promise<void>;
}

export type Vote = 1 | -1;

/** Una conexión es la misma si une los mismos nodos con el mismo tipo (el tema en común no tiene dirección). */
export function edgeKey(edge: Pick<GraphEdge, "source" | "target" | "type">): string {
  const [a, b] = edge.type === "shared_theme" && edge.target < edge.source ? [edge.target, edge.source] : [edge.source, edge.target];
  return `${edge.type}|${a}|${b}`;
}


const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const keyOf = (clues: Clue[]) => JSON.stringify(clues.map((c) => [c.kind, c.label.toLowerCase()]));
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()));

function withStatus(library: Record<string, LibraryEntry>, book: BookSnapshot, status: LibraryStatus, on: boolean, at = new Date().toISOString()) {
  const next = { ...library };
  const entry: LibraryEntry = next[book.id] ? { ...next[book.id], statuses: { ...next[book.id].statuses } } : { ...book, statuses: {} };
  if (on) entry.statuses[status] = at;
  else delete entry.statuses[status];
  if (Object.keys(entry.statuses).length === 0) delete next[book.id];
  else next[book.id] = entry;
  return next;
}

/** La búsqueda en curso: si cambian las pistas, se corta. */
let searchAbort: AbortController | null = null;

export const useLineas = create<LineasState>()((set, get) => ({
  clues: [],
  lanes: emptyLanes(),
  graph: null,
  status: "idle",
  error: null,
  errorNeedsEdit: false,
  graphKey: null,
  focus: null,
  engine: null,
  user: null,
  authReady: false,
  library: {},
  libraryError: null,
  edgeVotes: {},
  recVotes: {},
  voteError: null,

  hasClue: (label) => get().clues.some((c) => same(c.label, label)),

  addClue: (label, kind) => {
    const clean = label.trim();
    if (!clean || get().hasClue(clean) || get().clues.length >= MAX_CLUES) return;
    set((s) => ({ clues: [...s.clues, { id: newId(), kind, label: clean }] }));
  },

  toggleClue: (label, kind) => {
    const existing = get().clues.find((c) => same(c.label, label));
    if (existing) get().removeClue(existing.id);
    else get().addClue(label, kind);
  },

  removeClue: (id) => set((s) => ({ clues: s.clues.filter((c) => c.id !== id) })),

  search: async ({ force = false } = {}) => {
    const { clues, graphKey, status } = get();
    const key = keyOf(clues);
    // Misma búsqueda ya lista o en camino (por ejemplo, al pasar de resultados al mapa).
    if (!force && key === graphKey && (status === "ready" || status === "loading")) return;
    if (clues.length === 0) {
      set({ status: "error", error: "Agregá al menos una pista para empezar." });
      return;
    }

    searchAbort?.abort();
    const abort = new AbortController();
    searchAbort = abort;
    set({ status: "loading", error: null, errorNeedsEdit: false, graphKey: key, lanes: emptyLanes(), graph: null, focus: null, recVotes: {} });

    const startedAt = performance.now();
    const applyEvent = (event: StreamEvent) => {
      if (event.type === "done") return;
      set((s) => {
        const lanes = { ...s.lanes };
        const lane = { ...lanes[event.lane] };
        if (event.type === "lane")
          Object.assign(lane, {
            status: "ready",
            options: [...lane.options, event.graph],
            sources: [...lane.sources, { cached: event.cached, ms: performance.now() - startedAt }],
            index: lane.options.length,
            error: null,
          });
        if (event.type === "patch") lane.options = lane.options.map((g) => patchBook(g, event.nodeId, event.book));
        if (event.type === "lane-error") Object.assign(lane, lane.options.length ? { error: event.message } : { status: "error", error: event.message });
        lanes[event.lane] = lane;
        const graph = visibleGraph(s.clues, lanes);
        return { lanes, graph, status: graph ? "ready" : s.status };
      });
    };

    try {
      await streamRecommendations({ clues }, abort.signal, applyEvent, (engine) => set({ engine }));
      if (abort.signal.aborted) return;
      const { graph, lanes } = get();
      // Lo que no llegó se marca como error para poder reintentarlo.
      set({ lanes: settleLanes(lanes) });
      if (!graph) {
        set({ status: "error", error: "No pudimos armar las recomendaciones. Probá de nuevo en un momento." });
        return;
      }
      void saveSearch(get().user, clues, graph);
    } catch (error) {
      if (abort.signal.aborted) return;
      if (get().graph) set({ lanes: settleLanes(get().lanes) });
      else set({ status: "error", error: error instanceof Error ? error.message : "Algo salió mal.", errorNeedsEdit: error instanceof BlockedError });
    }
  },

  showAnother: async (lane) => {
    const state = get().lanes[lane];
    if (state.loadingMore || state.status !== "ready") return;
    void recordSignal(get, lane, state.options[state.index], "skipped");
    if (state.index + 1 < state.options.length) {
      setLane(set, get, lane, { index: state.index + 1, error: null });
      return;
    }
    await requestLane(set, get, lane);
  },

  retryLane: async (lane) => {
    setLane(set, get, lane, { status: "pending", error: null });
    await requestLane(set, get, lane);
  },

  setFocus: (focus) => set({ focus }),

  isIn: (bookId, status) => !!get().library[bookId]?.statuses[status],

  toggleLibrary: async (book, status) => {
    const on = !get().isIn(book.id, status);
    // Optimista: la UI cambia ya; si la base falla, se revierte.
    set((s) => ({ library: withStatus(s.library, book, status, on), libraryError: null }));

    const user = get().user;
    const supabase = getBrowserSupabase();
    if (!user || !supabase) return;

    if (on) {
      const lane = LaneSchema.options.find((l) => recommendedBook(currentOption(get().lanes[l]))?.id === book.id);
      if (lane) void recordSignal(get, lane, currentOption(get().lanes[lane]), status);
    }

    const { error } = on
      ? await supabase.from("library_items").insert({ book_id: book.id, status, title: book.title, author: book.author, year_label: book.yearLabel, cover_url: book.coverUrl })
      : await supabase.from("library_items").delete().match({ book_id: book.id, status });

    if (error) {
      console.error("[library]", error);
      set((s) => ({ library: withStatus(s.library, book, status, !on), libraryError: "No pudimos guardar el cambio. Probá de nuevo." }));
    }
  },

  setUser: async (user) => {
    const previous = get().user;
    set({ user, authReady: true });
    if (previous?.id === user?.id) return;

    if (!user) {
      set({ library: {}, edgeVotes: {}, recVotes: {} });
      return;
    }

    const supabase = getBrowserSupabase();
    if (!supabase) return;

    // Lo que se marcó antes de iniciar sesión se sube a la cuenta.
    const pending = Object.values(get().library).flatMap((entry) =>
      (Object.keys(entry.statuses) as LibraryStatus[]).map((status) => ({
        book_id: entry.id,
        status,
        title: entry.title,
        author: entry.author,
        year_label: entry.yearLabel,
        cover_url: entry.coverUrl,
      })),
    );
    if (pending.length) {
      const { error } = await supabase.from("library_items").upsert(pending, { onConflict: "user_id,book_id,status", ignoreDuplicates: true });
      if (error) console.error("[library] merge", error);
    }

    const { data, error } = await supabase
      .from("library_items")
      .select("book_id, status, title, author, year_label, cover_url, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[library] load", error);
      set({ libraryError: "No pudimos cargar tu biblioteca." });
      return;
    }

    let library: Record<string, LibraryEntry> = {};
    for (const row of [...data].reverse()) {
      library = withStatus(library, { id: row.book_id, title: row.title, author: row.author, yearLabel: row.year_label, coverUrl: row.cover_url }, row.status, true, row.created_at);
    }
    set({ library, libraryError: null });

    const votes = await supabase.from("edge_votes").select("value, kg_edges(source, target, type)").limit(2000);
    if (votes.error) {
      console.error("[votos] load", votes.error);
      return;
    }
    const edgeVotes: Record<string, Vote> = {};
    for (const row of votes.data) {
      if (row.kg_edges) edgeVotes[edgeKey(row.kg_edges as Pick<GraphEdge, "source" | "target" | "type">)] = row.value as Vote;
    }
    set({ edgeVotes });
  },

  voteEdge: async (edge, value) => {
    const { user, graph, edgeVotes } = get();
    const supabase = getBrowserSupabase();
    if (!user || !supabase) return;
    const key = edgeKey(edge);
    const previous = edgeVotes[key];
    const next = previous === value ? 0 : value;
    const nodes = new Map((graph?.nodes ?? []).map((n) => [n.id, n]));
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (!source || !target) return;

    // Optimista: la UI cambia ya; si la base falla, se revierte.
    set((s) => ({ edgeVotes: withVote(s.edgeVotes, key, next), voteError: null }));
    const { error } = await supabase.rpc("vote_edge", { p_source: canonicalNode(source), p_target: canonicalNode(target), p_edge: canonicalEdge(edge), p_value: next });
    if (error) {
      console.error("[votos]", error);
      set((s) => ({ edgeVotes: withVote(s.edgeVotes, key, previous ?? 0), voteError: "No pudimos guardar tu voto. Probá de nuevo." }));
    }
  },

  voteRecommendation: async (lane, value) => {
    const { user, lanes, recVotes } = get();
    const graph = currentOption(lanes[lane]);
    const book = recommendedBook(graph);
    if (!book) return;
    if (!user || !getBrowserSupabase()) return;
    if (recVotes[book.id] === value) return;
    set((s) => ({ recVotes: { ...s.recVotes, [book.id]: value }, voteError: null }));
    const ok = await recordSignal(get, lane, graph, value === 1 ? "up" : "down");
    if (!ok) set((s) => ({ recVotes: withVote(s.recVotes, book.id, recVotes[book.id] ?? 0), voteError: "No pudimos guardar tu voto. Probá de nuevo." }));
  },
}));

function currentOption(lane: LaneState): ConnectionGraph | undefined {
  return lane.options[lane.index];
}

function withVote(votes: Record<string, Vote>, key: string, value: Vote | 0): Record<string, Vote> {
  const next = { ...votes };
  if (value === 0) delete next[key];
  else next[key] = value;
  return next;
}

/** Lo que guarda el grafo canónico de un nodo: sin datos de catálogo ni marcas de esta búsqueda. */
function canonicalNode(node: GraphNode): Json {
  return { id: node.id, kind: node.kind, label: node.label, subtitle: node.subtitle ?? null, originalTitle: node.originalTitle ?? null, era: node.era };
}

function canonicalEdge(edge: GraphEdge): Json {
  return { source: edge.source, target: edge.target, type: edge.type, confidence: edge.confidence, summary: edge.summary, explanation: edge.explanation, quote: edge.quote ?? null };
}

/** Señal sobre una recomendación (explícita o implícita). Sin sesión no se guarda. */
async function recordSignal(get: Get, lane: Lane, graph: ConnectionGraph | undefined, signal: Enums<"rec_signal">): Promise<boolean> {
  const supabase = getBrowserSupabase();
  const { user, clues } = get();
  const rec = graph?.recommendations[0];
  if (!supabase || !user || !graph || !rec) return false;
  const index = indexGraph(graph);
  const nodes = rec.path.flatMap((id) => (index.nodes.get(id) ? [canonicalNode(index.nodes.get(id)!)] : []));
  const edges = pathEdges(index, rec.path).map(canonicalEdge);
  const { error } = await supabase.rpc("record_rec_signal", {
    p_clues_key: keyOf(clues).slice(0, 2000),
    p_lane: lane,
    p_book_slug: rec.nodeId,
    p_signal: signal,
    p_nodes: nodes,
    p_edges: edges,
  });
  if (error) console.error("[señales]", error);
  return !error;
}

type Set = (partial: Partial<LineasState> | ((s: LineasState) => Partial<LineasState>)) => void;
type Get = () => LineasState;

function setLane(set: Set, get: Get, lane: Lane, patch: Partial<LaneState>) {
  set((s) => {
    const lanes = { ...s.lanes, [lane]: { ...s.lanes[lane], ...patch } };
    return { lanes, graph: visibleGraph(s.clues, lanes) ?? s.graph };
  });
}

/** Pide una opción nueva para un carril, excluyendo todo lo que ya se mostró. */
async function requestLane(set: Set, get: Get, lane: Lane) {
  const { clues, graphKey, lanes } = get();
  const exclude: ExcludedBook[] = LaneSchema.options.flatMap((l) =>
    lanes[l].options.flatMap((g) => {
      const book = recommendedBook(g);
      return book ? [{ title: book.label, author: authorOf(book) }] : [];
    }),
  );
  setLane(set, get, lane, { loadingMore: true, error: null });
  let arrived = false;
  const startedAt = performance.now();
  try {
    await streamRecommendations({ clues, lane, exclude }, searchAbort?.signal, (event) => {
      if (get().graphKey !== graphKey || event.type === "done" || event.lane !== lane) return;
      const current = get().lanes[lane];
      if (event.type === "lane") {
        arrived = true;
        setLane(set, get, lane, {
          status: "ready",
          options: [...current.options, event.graph],
          sources: [...current.sources, { cached: event.cached, ms: performance.now() - startedAt }],
          index: current.options.length,
        });
      }
      if (event.type === "patch") setLane(set, get, lane, { options: current.options.map((g) => patchBook(g, event.nodeId, event.book)) });
      if (event.type === "lane-error") setLane(set, get, lane, current.options.length ? { error: event.message } : { status: "error", error: event.message });
    }, (engine) => set({ engine }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Algo salió mal.";
    setLane(set, get, lane, get().lanes[lane].options.length ? { error: message } : { status: "error", error: message });
  } finally {
    if (get().graphKey === graphKey) {
      const current = get().lanes[lane];
      setLane(set, get, lane, {
        loadingMore: false,
        ...(!arrived && !current.error ? (current.options.length ? { error: "No encontramos otro libro para este camino." } : { status: "error" as const, error: "No pudimos armar este camino." }) : {}),
      });
    }
  }
}

class BlockedError extends Error {}

/** POST /api/recommend y lectura del stream. Los errores antes del stream (400, 429) vienen como JSON. */
async function streamRecommendations(
  body: { clues: Clue[]; lane?: Lane; exclude?: ExcludedBook[] },
  signal: AbortSignal | undefined,
  onEvent: (event: StreamEvent) => void,
  onEngine?: (engine: EngineName) => void,
) {
  const response = await fetch("/api/recommend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    const data: unknown = await response.json().catch(() => null);
    const message = typeof data === "object" && data && "error" in data ? String(data.error) : "Algo salió mal.";
    throw response.status === 422 ? new BlockedError(message) : new Error(message);
  }
  const engine = response.headers.get("x-lineas-engine");
  if (engine === "mock" || engine === "openrouter" || engine === "deepseek") onEngine?.(engine);
  // El servidor ya valida, pero el cliente no confía a ciegas en la red: cada evento se valida al leerlo.
  await readEventStream(response.body, onEvent);
}

function visibleGraph(clues: Clue[], lanes: Record<Lane, LaneState>): ConnectionGraph | null {
  const parts = LaneSchema.options.flatMap((l) => (lanes[l].options[lanes[l].index] ? [lanes[l].options[lanes[l].index]] : []));
  return parts.length ? mergeLaneGraphs(clues, parts) : null;
}

function settleLanes(lanes: Record<Lane, LaneState>): Record<Lane, LaneState> {
  const next = { ...lanes };
  for (const l of LaneSchema.options) if (next[l].status === "pending") next[l] = { ...next[l], status: "error", error: next[l].error ?? "No pudimos armar este camino." };
  return next;
}

function patchBook(graph: ConnectionGraph, nodeId: string, book: NonNullable<GraphNode["book"]>): ConnectionGraph {
  return { ...graph, nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, book } : n)) };
}

async function saveSearch(user: SessionUser | null, clues: Clue[], graph: ConnectionGraph) {
  const supabase = getBrowserSupabase();
  if (!user || !supabase) return;
  const { error } = await supabase.from("searches").insert({ clues: clues as unknown as Json, graph: graph as unknown as Json, schema_version: graph.version });
  if (error) console.error("[searches]", error);
}
