import { z } from "zod";
import { ConnectionGraphSchema, type Clue, type ConnectionGraph } from "@/lib/graph/schema";
import { chatJson, DeepSeekError, type ChatMessage, type DeepSeekOptions, type DeepSeekUsage } from "./deepseek";
import { normalizeRawGraph } from "./normalize";
import { buildRepairPrompt, buildUserPrompt, SYSTEM_PROMPT } from "./prompt";

export interface LlmEngineOptions extends DeepSeekOptions {
  /** Intentos totales, contando el primero. */
  maxAttempts?: number;
  log?: (event: LlmEvent) => void;
}

export type LlmEvent =
  | { type: "attempt"; attempt: number }
  | { type: "invalid"; attempt: number; reason: string }
  /** Se aceptó el grafo descartando recomendaciones o aristas que no cumplían. */
  | { type: "salvaged"; attempt: number; droppedRecommendations: string[]; droppedEdges: string[] }
  | { type: "success"; attempt: number; usage: DeepSeekUsage[] };

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
 * Pide el grafo al modelo, lo repara, lo valida y, si no cumple el contrato,
 * reintenta mostrándole los errores concretos. Nada llega al cliente sin pasar
 * por ConnectionGraphSchema.
 */
export async function generateGraphWithLlm(clues: Clue[], options: LlmEngineOptions): Promise<ConnectionGraph> {
  const { maxAttempts = 3, log = () => {}, ...deepseek } = options;
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(clues) },
  ];
  const usage: DeepSeekUsage[] = [];
  let lastIssues: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log({ type: "attempt", attempt });

    let content: string;
    try {
      const result = await chatJson(messages, deepseek);
      content = result.content;
      if (result.usage) usage.push(result.usage);
      if (result.finishReason === "length") {
        lastIssues = "La respuesta se cortó por largo (max_tokens).";
        log({ type: "invalid", attempt, reason: lastIssues });
        continue;
      }
    } catch (error) {
      if (error instanceof DeepSeekError && error.retryable && attempt < maxAttempts) {
        log({ type: "invalid", attempt, reason: error.message });
        await sleep(400 * attempt);
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

    const candidate = normalizeRawGraph(raw, clues);
    const parsed = ConnectionGraphSchema.safeParse(candidate);
    if (parsed.success) {
      log({ type: "success", attempt, usage });
      return parsed.data;
    }

    // Antes de pagar otro intento: ¿alcanza con descartar lo que está mal?
    // En intentos intermedios exigimos 2 recomendaciones por carril; en el último, 1.
    const salvaged = salvage(candidate, attempt === maxAttempts ? 1 : 2);
    if (salvaged) {
      log({ type: "salvaged", attempt, droppedRecommendations: salvaged.droppedRecommendations, droppedEdges: salvaged.droppedEdges });
      log({ type: "success", attempt, usage });
      return salvaged.graph;
    }

    lastIssues = summarizeIssues(parsed.error);
    log({ type: "invalid", attempt, reason: lastIssues });
    messages.push({ role: "assistant", content }, { role: "user", content: buildRepairPrompt(lastIssues) });
  }

  throw new EngineError(`El modelo no devolvió un grafo válido en ${maxAttempts} intentos`, lastIssues);
}

interface Salvaged {
  graph: ConnectionGraph;
  droppedRecommendations: string[];
  droppedEdges: string[];
}

/**
 * Descarta aristas y recomendaciones inválidas mientras los errores sean solo
 * de esos elementos. Si hay un problema global (nodos, carriles vacíos) o un
 * carril queda con menos de `minPerLane`, devuelve null y se reintenta.
 */
export function salvage(candidate: unknown, minPerLane: number): Salvaged | null {
  if (typeof candidate !== "object" || candidate === null) return null;
  let current = structuredClone(candidate) as { edges: { id?: unknown }[]; recommendations: { nodeId?: unknown }[] };
  if (!Array.isArray(current.edges) || !Array.isArray(current.recommendations)) return null;
  const droppedRecommendations: string[] = [];
  const droppedEdges: string[] = [];

  for (let round = 0; round < 5; round++) {
    const result = ConnectionGraphSchema.safeParse(current);
    if (result.success) {
      const perLane = new Map<string, number>();
      for (const rec of result.data.recommendations) perLane.set(rec.lane, (perLane.get(rec.lane) ?? 0) + 1);
      const enough = [...perLane.values()].every((n) => n >= minPerLane) && perLane.size === 3;
      return enough ? { graph: result.data, droppedRecommendations, droppedEdges } : null;
    }

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
