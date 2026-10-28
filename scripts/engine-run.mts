/**
 * Lo compartido entre engine:try y engine:compare: leer pistas de la línea de
 * comandos y correr el motor completo (modelo + verificación) midiendo todo.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { verifyGraphBooks, type LookupReport } from "@/lib/catalog/books";
import { ClueKindSchema, type Clue, type ConnectionGraph } from "@/lib/graph/schema";
import type { LlmConfig, LlmUsage } from "@/lib/recommend/llm-client";
import { generateGraphWithLlm, type LlmEvent } from "@/lib/recommend/llm-engine";
import { graphQuality, type GraphQuality } from "@/lib/recommend/quality";

export const DEFAULT_CLUES = ["book:On the Road", "movement:Generación Beat", "feeling:La libertad"];

export function parseClues(args: string[]): Clue[] {
  return (args.length ? args : DEFAULT_CLUES).map((arg, i) => {
    const [kind, ...rest] = arg.split(":");
    const parsed = ClueKindSchema.safeParse(kind);
    if (!parsed.success || rest.length === 0) {
      throw new Error(`Pista inválida: "${arg}". Formato: tipo:valor (tipos: ${ClueKindSchema.options.join(", ")})`);
    }
    return { id: `c${i + 1}`, kind: parsed.data, label: rest.join(":").trim() };
  });
}

export interface RunResult {
  config: LlmConfig;
  ok: boolean;
  error?: string;
  model?: string;
  attempts: number;
  llmMs: number;
  totalMs: number;
  usage: { input: number; cached: number; output: number; costUsd?: number };
  generated?: ConnectionGraph;
  graph?: ConnectionGraph;
  quality?: GraphQuality;
  misses: LookupReport[];
  events: LlmEvent[];
}

export async function runEngine(clues: Clue[], config: LlmConfig, onEvent?: (e: LlmEvent) => void): Promise<RunResult> {
  const events: LlmEvent[] = [];
  const misses: LookupReport[] = [];
  const started = Date.now();
  let usage: LlmUsage[] = [];
  let model: string | undefined;
  let llmMs = 0;

  try {
    const generated = await generateGraphWithLlm(clues, {
      ...config,
      log: (event) => {
        events.push(event);
        if (event.type === "success") {
          usage = event.usage;
          model = event.model;
        }
        onEvent?.(event);
      },
    });
    llmMs = Date.now() - started;
    const graph = await verifyGraphBooks(generated, { googleBooksKey: process.env.GOOGLE_BOOKS_API_KEY, onMiss: (r) => misses.push(r) });
    return {
      config,
      ok: true,
      model,
      attempts: events.filter((e) => e.type === "attempt").length,
      llmMs,
      totalMs: Date.now() - started,
      usage: sumUsage(usage),
      generated,
      graph,
      quality: graphQuality(graph),
      misses,
      events,
    };
  } catch (error) {
    return {
      config,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      attempts: events.filter((e) => e.type === "attempt").length,
      llmMs: llmMs || Date.now() - started,
      totalMs: Date.now() - started,
      usage: sumUsage(usage),
      misses,
      events,
    };
  }
}

function sumUsage(usage: LlmUsage[]) {
  const total = usage.reduce(
    (acc, u) => ({ input: acc.input + u.inputTokens, cached: acc.cached + u.cachedTokens, output: acc.output + u.outputTokens, cost: acc.cost + (u.costUsd ?? 0), hasCost: acc.hasCost || u.costUsd !== undefined }),
    { input: 0, cached: 0, output: 0, cost: 0, hasCost: false },
  );
  return { input: total.input, cached: total.cached, output: total.output, ...(total.hasCost ? { costUsd: total.cost } : {}) };
}

export function saveRun(graph: ConnectionGraph, label: string): string {
  mkdirSync(".engine-runs", { recursive: true });
  const safe = label.replace(/[^a-z0-9.-]+/gi, "_");
  const file = `.engine-runs/${new Date().toISOString().replace(/[:.]/g, "-")}_${safe}.json`;
  writeFileSync(file, JSON.stringify(graph, null, 2));
  return file;
}
