/**
 * Lo compartido entre engine:try y engine:compare: leer pistas de la línea de
 * comandos y correr el motor completo (modelo + verificación) midiendo todo.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { verifyGraphBooks, type LookupReport } from "@/lib/catalog/books";
import { mergeLaneGraphs } from "@/lib/graph/merge";
import { ClueKindSchema, LaneSchema, type Clue, type ConnectionGraph, type Lane } from "@/lib/graph/schema";
import type { LlmConfig, LlmUsage } from "@/lib/recommend/llm-client";
import { generateLaneWithLlm, type LlmEvent } from "@/lib/recommend/llm-engine";
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
  /** Cuándo estuvo listo el primer carril (modelo + verificación): lo que siente el usuario. */
  firstLaneMs: number;
  /** El carril más lento, solo modelo. */
  llmMs: number;
  totalMs: number;
  laneMs: Partial<Record<Lane, number>>;
  failedLanes: Lane[];
  usage: { input: number; cached: number; output: number; costUsd?: number };
  generated?: ConnectionGraph;
  graph?: ConnectionGraph;
  quality?: GraphQuality;
  misses: LookupReport[];
  events: (LlmEvent & { lane: Lane })[];
}

/** Corre los tres carriles en paralelo, como la app, y mide cada uno. */
export async function runEngine(clues: Clue[], config: LlmConfig, onEvent?: (e: LlmEvent & { lane: Lane }) => void): Promise<RunResult> {
  const events: RunResult["events"] = [];
  const misses: LookupReport[] = [];
  const started = Date.now();
  const usage: LlmUsage[] = [];
  const laneMs: RunResult["laneMs"] = {};
  const failedLanes: Lane[] = [];
  const errors: string[] = [];
  let model: string | undefined;
  let llmMs = 0;
  let firstLaneMs = 0;

  const results = await Promise.all(
    LaneSchema.options.map(async (lane) => {
      try {
        const generated = await generateLaneWithLlm(
          { clues, lane },
          {
            ...config,
            log: (event) => {
              events.push({ ...event, lane });
              if (event.type === "success") {
                usage.push(...event.usage);
                model = event.model;
              }
              onEvent?.({ ...event, lane });
            },
          },
        );
        llmMs = Math.max(llmMs, Date.now() - started);
        const graph = await verifyGraphBooks(generated, { googleBooksKey: process.env.GOOGLE_BOOKS_API_KEY, onlyRecommended: true, onMiss: (r) => misses.push(r) });
        laneMs[lane] = Date.now() - started;
        firstLaneMs ||= laneMs[lane];
        return { generated, graph };
      } catch (error) {
        failedLanes.push(lane);
        errors.push(`${lane}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    }),
  );

  const ok = results.filter((r) => r !== null);
  const base = { config, model, attempts: events.filter((e) => e.type === "attempt").length, firstLaneMs, llmMs, laneMs, failedLanes, usage: sumUsage(usage), misses, events };
  if (ok.length === 0) return { ...base, ok: false, error: errors.join(" · "), totalMs: Date.now() - started };
  const generated = mergeLaneGraphs(clues, ok.map((r) => r.generated));
  const graph = mergeLaneGraphs(clues, ok.map((r) => r.graph));
  return {
    ...base,
    ok: failedLanes.length === 0,
    ...(errors.length ? { error: errors.join(" · ") } : {}),
    totalMs: Date.now() - started,
    generated,
    graph,
    quality: graphQuality(graph),
  };
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
