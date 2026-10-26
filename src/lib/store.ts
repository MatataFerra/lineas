"use client";

import { create } from "zustand";
import { ConnectionGraphSchema, type Clue, type ClueKind, type ConnectionGraph, type GraphNode } from "@/lib/graph/schema";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Json, LibraryStatus } from "@/lib/supabase/database.types";

type Status = "idle" | "loading" | "ready" | "error";

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
}

export function bookSnapshot(node: GraphNode): BookSnapshot {
  return { id: node.id, title: node.label, author: node.book?.author ?? node.subtitle ?? null, yearLabel: node.era.label };
}

export interface LibraryEntry extends BookSnapshot {
  statuses: Partial<Record<LibraryStatus, string>>; // status → created_at
}

interface LineasState {
  clues: Clue[];
  graph: ConnectionGraph | null;
  status: Status;
  error: string | null;
  /** Firma de las pistas con las que se armó `graph`. */
  graphKey: string | null;
  /** Libro (id de nodo) cuyo recorrido se muestra en el mapa. */
  focus: string | null;

  /** null = sin sesión. `authReady` indica si ya sabemos cuál de los dos casos es. */
  user: SessionUser | null;
  authReady: boolean;
  /** Biblioteca: por id de libro. Sin sesión vive solo en memoria. */
  library: Record<string, LibraryEntry>;
  libraryError: string | null;

  hasClue: (label: string) => boolean;
  addClue: (label: string, kind: ClueKind) => void;
  toggleClue: (label: string, kind: ClueKind) => void;
  removeClue: (id: string) => void;
  search: () => Promise<void>;
  setFocus: (nodeId: string | null) => void;

  isIn: (bookId: string, status: LibraryStatus) => boolean;
  toggleLibrary: (book: BookSnapshot, status: LibraryStatus) => Promise<void>;
  setUser: (user: SessionUser | null) => Promise<void>;
}

const INITIAL_CLUES: Clue[] = [
  { id: "c1", kind: "book", label: "On the Road" },
  { id: "c2", kind: "movement", label: "Generación Beat" },
  { id: "c3", kind: "feeling", label: "La libertad" },
];

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

export const useLineas = create<LineasState>()((set, get) => ({
  clues: INITIAL_CLUES,
  graph: null,
  status: "idle",
  error: null,
  graphKey: null,
  focus: null,
  user: null,
  authReady: false,
  library: {},
  libraryError: null,

  hasClue: (label) => get().clues.some((c) => same(c.label, label)),

  addClue: (label, kind) => {
    const clean = label.trim();
    if (!clean || get().hasClue(clean)) return;
    set((s) => ({ clues: [...s.clues, { id: newId(), kind, label: clean }] }));
  },

  toggleClue: (label, kind) => {
    const existing = get().clues.find((c) => same(c.label, label));
    if (existing) get().removeClue(existing.id);
    else get().addClue(label, kind);
  },

  removeClue: (id) => set((s) => ({ clues: s.clues.filter((c) => c.id !== id) })),

  search: async () => {
    const { clues, graphKey, status } = get();
    const key = keyOf(clues);
    if (key === graphKey && status === "ready") return;
    if (clues.length === 0) {
      set({ status: "error", error: "Agregá al menos una pista para empezar." });
      return;
    }

    set({ status: "loading", error: null });
    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clues }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const message = typeof body === "object" && body && "error" in body ? String(body.error) : "Algo salió mal.";
        throw new Error(message);
      }
      // El servidor ya valida, pero el cliente no confía a ciegas en la red.
      const graph = ConnectionGraphSchema.parse(body);
      // Ignorar la respuesta si mientras tanto cambiaron las pistas.
      if (keyOf(get().clues) !== key) {
        set({ status: "idle" });
        return;
      }
      set({ graph, graphKey: key, status: "ready", focus: null });
      void saveSearch(get().user, clues, graph);
    } catch (error) {
      set({ status: "error", error: error instanceof Error ? error.message : "Algo salió mal." });
    }
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

    const { error } = on
      ? await supabase.from("library_items").insert({ book_id: book.id, status, title: book.title, author: book.author, year_label: book.yearLabel })
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
      set({ library: {} });
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
      })),
    );
    if (pending.length) {
      const { error } = await supabase.from("library_items").upsert(pending, { onConflict: "user_id,book_id,status", ignoreDuplicates: true });
      if (error) console.error("[library] merge", error);
    }

    const { data, error } = await supabase
      .from("library_items")
      .select("book_id, status, title, author, year_label, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[library] load", error);
      set({ libraryError: "No pudimos cargar tu biblioteca." });
      return;
    }

    let library: Record<string, LibraryEntry> = {};
    for (const row of [...data].reverse()) {
      library = withStatus(library, { id: row.book_id, title: row.title, author: row.author, yearLabel: row.year_label }, row.status, true, row.created_at);
    }
    set({ library, libraryError: null });
  },
}));

async function saveSearch(user: SessionUser | null, clues: Clue[], graph: ConnectionGraph) {
  const supabase = getBrowserSupabase();
  if (!user || !supabase) return;
  const { error } = await supabase.from("searches").insert({ clues: clues as unknown as Json, graph: graph as unknown as Json, schema_version: graph.version });
  if (error) console.error("[searches]", error);
}
