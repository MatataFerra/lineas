import { z } from "zod";
import { GRAPH_LIMITS, laneGraphSchema, type ConnectionGraph, type Lane } from "@/lib/graph/schema";
import { chatJson, LlmError, type ChatMessage, type LlmConfig, type LlmUsage } from "./llm-client";
import { normalizeRawGraph } from "./normalize";
import { buildLanePrompt, buildRepairPrompt, SYSTEM_PROMPT, type LanePromptInput } from "./prompt";

export interface LlmEngineOptions extends Partial<Omit<LlmConfig, "apiKey">> {
  apiKey: string;
  /** Atajo para un solo modelo (equivale a models: [model]). */
  model?: string;
  /** Intentos totales, contando el primero. */
  maxAttempts?: number;
  /** Tiempo máximo para el carril, sumando reintentos. */
  deadlineMs?: number;
  log?: (event: LlmEvent) => void;
}

export type LlmEvent =
  | { type: "attempt"; attempt: number }
  | { type: "invalid"; attempt: number; reason: string }
  /** Se aceptó el grafo descartando aristas que no cumplían. */
  | { type: "salvaged"; attempt: number; droppedRecommendations: string[]; droppedEdges: string[] }
  | { type: "success"; attempt: number; usage: LlmUsage[]; model: string };

export class EngineError extends Error {
  constructor(
    message: string,
    readonly lastIssues?: string,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

/**
 * Pide al modelo el subgrafo de un carril (una recomendación y su recorrido),
 * lo repara, lo valida y, si no cumple el contrato, reintenta mostrándole los
 * errores concretos. Nada llega al cliente sin pasar por laneGraphSchema.
 */
export async function generateLaneWithLlm(
  input: Omit<LanePromptInput, "lane"> & { lane: Lane },
  options: LlmEngineOptions,
): Promise<ConnectionGraph> {
  const { maxAttempts = 2, deadlineMs = 20_000, log = () => {}, model, ...rest } = options;
  const { clues, lane } = input;
  const config: LlmConfig = {
    provider: "deepseek",
    ...rest,
    models: rest.models?.length ? rest.models : [model ?? "deepseek-flash"],
  };
  const schema = laneGraphSchema(lane);
  const deadline = Date.now() + deadlineMs;
  let answeredBy = config.models[0];
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildLanePrompt(input) },
  ];
  const usage: LlmUsage[] = [];
  let lastIssues: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new EngineError(`El carril ${lane} tardó demasiado`, lastIssues);
    log({ type: "attempt", attempt });

    let content: string;
    try {
      const result = await chatJson(messages, { ...config, timeoutMs: Math.min(config.timeoutMs ?? Infinity, remaining) });
      content = result.content;
      answeredBy = result.model;
      if (result.usage) usage.push(result.usage);
      if (result.finishReason === "length") {
        lastIssues = "La respuesta se cortó por largo (max_tokens).";
        log({ type: "invalid", attempt, reason: lastIssues });
        continue;
      }
    } catch (error) {
      if (error instanceof LlmError && error.retryable && attempt < maxAttempts) {
        log({ type: "invalid", attempt, reason: error.message });
        await sleep(300 * attempt);
        continue;
      }
      throw error;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(stripFences(content));
    } catch {
      lastIssues = "La respuesta no es JSON válido.";
      log({ type: "invalid", attempt, reason: lastIssues });
      messages.push({ role: "assistant", content }, { role: "user", content: buildRepairPrompt(lastIssues) });
      continue;
    }

    const candidate = normalizeRawGraph(raw, clues, { maxNodes: GRAPH_LIMITS.maxNodesPerLane });
    const parsed = schema.safeParse(candidate);
    if (parsed.success) {
      log({ type: "success", attempt, usage, model: answeredBy });
      return parsed.data;
    }

    // Antes de pagar otro intento: ¿alcanza con descartar las aristas que están mal?
    const salvaged = salvage(candidate, schema);
    if (salvaged) {
      log({ type: "salvaged", attempt, droppedRecommendations: salvaged.droppedRecommendations, droppedEdges: salvaged.droppedEdges });
      log({ type: "success", attempt, usage, model: answeredBy });
      return salvaged.graph;
    }

    lastIssues = summarizeIssues(parsed.error);
    log({ type: "invalid", attempt, reason: lastIssues });
    messages.push({ role: "assistant", content }, { role: "user", content: buildRepairPrompt(lastIssues) });
  }

  throw new EngineError(`El modelo no devolvió un carril ${lane} válido en ${maxAttempts} intentos`, lastIssues);
}

interface Salvaged {
  graph: ConnectionGraph;
  droppedRecommendations: string[];
  droppedEdges: string[];
}

/**
 * Descarta aristas y recomendaciones inválidas mientras los errores sean solo
 * de esos elementos. Si hay un problema global (nodos, carril vacío) devuelve
 * null y se reintenta.
 */
export function salvage(candidate: unknown, schema: z.ZodType<ConnectionGraph>): Salvaged | null {
  if (typeof candidate !== "object" || candidate === null) return null;
  let current = structuredClone(candidate) as { edges: { id?: unknown }[]; recommendations: { nodeId?: unknown }[] };
  if (!Array.isArray(current.edges) || !Array.isArray(current.recommendations)) return null;
  const droppedRecommendations: string[] = [];
  const droppedEdges: string[] = [];

  for (let round = 0; round < 5; round++) {
    const result = schema.safeParse(current);
    if (result.success) return { graph: result.data, droppedRecommendations, droppedEdges };

    const badEdges = new Set<number>();
    const badRecs = new Set<number>();
    for (const issue of result.error.issues) {
      const [head, index] = issue.path;
      if (head === "edges" && typeof index === "number") badEdges.add(index);
      else if (head === "recommendations" && typeof index === "number") badRecs.add(index);
      else return null;
    }

    droppedEdges.push(...[...badEdges].map((i) => String(current.edges[i]?.id)));
    droppedRecommendations.push(...[...badRecs].map((i) => String(current.recommendations[i]?.nodeId)));
    current = {
      ...current,
      edges: current.edges.filter((_, i) => !badEdges.has(i)),
      recommendations: current.recommendations.filter((_, i) => !badRecs.has(i)),
    };
  }
  return null;
}

/** Los errores de Zod en texto corto y accionable, sin repetir los iguales. */
function summarizeIssues(error: z.ZodError): string {
  const lines = error.issues.map((issue) => `- ${issue.path.join(".") || "(raíz)"}: ${issue.message}`);
  return [...new Set(lines)].slice(0, 25).join("\n");
}

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
