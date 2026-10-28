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

    const parsed = ConnectionGraphSchema.safeParse(normalizeRawGraph(raw, clues));
    if (parsed.success) {
      log({ type: "success", attempt, usage });
      return parsed.data;
    }

    lastIssues = summarizeIssues(parsed.error);
    log({ type: "invalid", attempt, reason: lastIssues });
    messages.push({ role: "assistant", content }, { role: "user", content: buildRepairPrompt(lastIssues) });
  }

  throw new EngineError(`El modelo no devolvió un grafo válido en ${maxAttempts} intentos`, lastIssues);
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
