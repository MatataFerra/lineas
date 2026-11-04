import { createClient } from "@supabase/supabase-js";
import type { Clue, Confidence, EdgeType } from "@/lib/graph/schema";
import type { Database } from "@/lib/supabase/database.types";
import { clueNodeIds } from "./normalize";

/**
 * Lo que los lectores validaron (o rechazaron) cerca de las pistas, para que el
 * modelo lo prefiera (o lo evite). Lee las aristas que tocan una pista y las
 * que tocan a sus vecinos directos. Si la base tarda más que el presupuesto,
 * se sigue con lo que haya: nunca frena una recomendación.
 */
export interface KnownEdge {
  source: string;
  target: string;
  sourceLabel: string;
  targetLabel: string;
  type: EdgeType;
  confidence: Confidence;
  summary: string;
  score: number;
}

const CONFIRMED_MIN = 2;
const REJECTED_MAX = -2;
const MAX_CONFIRMED = 12;
const MAX_REJECTED = 8;
const BUDGET_MS = 150;

export function formatKnowledge(edges: KnownEdge[]): string | undefined {
  const line = (e: KnownEdge) => `- ${e.sourceLabel} (${e.source}) → ${e.targetLabel} (${e.target}) · ${e.type} · ${e.confidence}: ${e.summary}`;
  const confirmed = edges.filter((e) => e.score >= CONFIRMED_MIN).sort((a, b) => b.score - a.score).slice(0, MAX_CONFIRMED);
  const rejected = edges.filter((e) => e.score <= REJECTED_MAX).sort((a, b) => a.score - b.score).slice(0, MAX_REJECTED);
  const parts = [
    confirmed.length ? `Conexiones confirmadas por lectores (preferilas si sirven a este carril):\n${confirmed.map(line).join("\n")}` : "",
    rejected.length ? `Conexiones que los lectores rechazaron (no las uses):\n${rejected.map((e) => `- ${e.sourceLabel} (${e.source}) → ${e.targetLabel} (${e.target}) · ${e.type}`).join("\n")}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join("\n\n") : undefined;
}

const SELECT = "source, target, type, confidence, summary, score, src:kg_nodes!kg_edges_source_fkey(label), dst:kg_nodes!kg_edges_target_fkey(label)";

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export async function fetchKnowledge(clues: Clue[]): Promise<string | undefined> {
  const db = publicClient();
  const ids = clueNodeIds(clues).map((c) => c.id);
  if (!db || ids.length === 0) return undefined;

  const found = new Map<string, KnownEdge>();
  const touching = async (nodes: string[]) => {
    const list = nodes.map((id) => `"${id}"`).join(",");
    const { data, error } = await db
      .from("kg_edges")
      .select(SELECT)
      .or(`source.in.(${list}),target.in.(${list})`)
      // Solo lo que tiene un saldo claro (entre -1 y 1 no dice nada).
      .filter("score", "not.in", `(${range(REJECTED_MAX + 1, CONFIRMED_MIN - 1).join(",")})`)
      .limit(60);
    if (error) throw error;
    const edges: KnownEdge[] = data.map((row) => ({
      source: row.source,
      target: row.target,
      type: row.type as EdgeType,
      confidence: row.confidence as Confidence,
      summary: row.summary,
      score: row.score ?? 0,
      sourceLabel: (row.src as { label: string } | null)?.label ?? row.source,
      targetLabel: (row.dst as { label: string } | null)?.label ?? row.target,
    }));
    for (const e of edges) found.set(`${e.type}|${e.source}|${e.target}`, e);
    return edges;
  };

  const lookup = (async () => {
    const first = await touching(ids);
    // Un salto más: lo validado alrededor de los vecinos confirmados de las pistas.
    const neighbors = [...new Set(first.filter((e) => e.score >= CONFIRMED_MIN).flatMap((e) => [e.source, e.target]))].filter((id) => !ids.includes(id));
    if (neighbors.length) await touching(neighbors.slice(0, 20));
  })().catch((error) => console.warn("[conocimiento]", error));

  await Promise.race([lookup, new Promise((resolve) => setTimeout(resolve, BUDGET_MS))]);
  return formatKnowledge([...found.values()]);
}
