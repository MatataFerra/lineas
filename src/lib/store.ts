"use client";

import { create } from "zustand";
import { ConnectionGraphSchema, type Clue, type ClueKind, type ConnectionGraph } from "@/lib/graph/schema";

type Status = "idle" | "loading" | "ready" | "error";

interface LineasState {
  clues: Clue[];
  graph: ConnectionGraph | null;
  status: Status;
  error: string | null;
  /** Firma de las pistas con las que se armó `graph`. */
  graphKey: string | null;
  /** Libro (id de nodo) cuyo recorrido se muestra en el mapa. */
  focus: string | null;
  saved: Record<string, true>;
  read: Record<string, true>;

  hasClue: (label: string) => boolean;
  addClue: (label: string, kind: ClueKind) => void;
  toggleClue: (label: string, kind: ClueKind) => void;
  removeClue: (id: string) => void;
  search: () => Promise<void>;
  setFocus: (nodeId: string | null) => void;
  toggleSaved: (nodeId: string) => void;
  toggleRead: (nodeId: string) => void;
}

const INITIAL_CLUES: Clue[] = [
  { id: "c1", kind: "book", label: "On the Road" },
  { id: "c2", kind: "movement", label: "Generación Beat" },
  { id: "c3", kind: "feeling", label: "La libertad" },
];

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const keyOf = (clues: Clue[]) => JSON.stringify(clues.map((c) => [c.kind, c.label.toLowerCase()]));
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()));

function toggle(map: Record<string, true>, id: string): Record<string, true> {
  const next = { ...map };
  if (next[id]) delete next[id];
  else next[id] = true;
  return next;
}

export const useLineas = create<LineasState>()((set, get) => ({
  clues: INITIAL_CLUES,
  graph: null,
  status: "idle",
  error: null,
  graphKey: null,
  focus: null,
  saved: {},
  read: {},

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
    } catch (error) {
      set({ status: "error", error: error instanceof Error ? error.message : "Algo salió mal." });
    }
  },

  setFocus: (focus) => set({ focus }),
  toggleSaved: (nodeId) => set((s) => ({ saved: toggle(s.saved, nodeId) })),
  toggleRead: (nodeId) => set((s) => ({ read: toggle(s.read, nodeId) })),
}));
