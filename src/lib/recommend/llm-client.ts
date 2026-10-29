// Solo servidor: si algo de cliente importa este módulo, el build falla.
import "server-only";

/**
 * Cliente mínimo para APIs compatibles con OpenAI Chat Completions.
 * Sin SDK: un fetch tipado alcanza y no suma dependencias.
 *
 * Proveedores:
 * - "deepseek": API oficial. Modelos "deepseek-flash" y "deepseek-v4-pro".
 *   https://api-docs.deepseek.com/api/create-chat-completion/
 * - "openrouter": una clave para muchos modelos (Kimi, Qwen, GLM, DeepSeek…).
 *   Recibe una lista de modelos: el primero es el preferido y el resto son
 *   respaldos si falla. Cada pedido va al proveedor más rápido de ese modelo.
 *   https://openrouter.ai/docs/guides/routing/provider-selection
 */

export type ProviderName = "deepseek" | "openrouter";
export type ReasoningEffort = "none" | "low" | "high" | "max";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmConfig {
  provider: ProviderName;
  apiKey: string;
  /** El primero es el preferido; en OpenRouter el resto son respaldos. DeepSeek usa solo el primero. */
  models: string[];
  reasoning?: ReasoningEffort;
  /** OpenRouter: pide salida con JSON Schema (solo a proveedores que lo soportan). */
  jsonSchema?: Record<string, unknown>;
  maxTokens?: number;
  timeoutMs?: number;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface LlmUsage {
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  /** Costo en USD si el proveedor lo informa (OpenRouter sí, DeepSeek no). */
  costUsd?: number;
}

export interface LlmResult {
  content: string;
  finishReason: string | null;
  usage: LlmUsage | null;
  /** El modelo que respondió de verdad (en OpenRouter puede ser un respaldo). */
  model: string;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** true si conviene reintentar (429, 5xx, timeout, respuesta vacía). */
    readonly retryable = false,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

const BASE_URLS: Record<ProviderName, string> = {
  deepseek: "https://api.deepseek.com",
  openrouter: "https://openrouter.ai/api/v1",
};

interface ChatCompletionResponse {
  model?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_cache_hit_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
    cost?: number;
  };
  error?: { message?: string; code?: number };
}

/** Con razonamiento el modelo gasta tokens antes de escribir el JSON: hace falta más margen. */
export function defaultMaxTokens(reasoning: ReasoningEffort): number {
  return reasoning === "none" ? 16_000 : 48_000;
}

export function buildRequestBody(messages: ChatMessage[], config: LlmConfig): Record<string, unknown> {
  const reasoning = config.reasoning ?? "none";
  const maxTokens = config.maxTokens ?? defaultMaxTokens(reasoning);
  const [model, ...fallbacks] = config.models;

  if (config.provider === "deepseek") {
    return {
      model,
      messages,
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
      ...(reasoning === "none" ? { thinking: { type: "disabled" } } : { thinking: { type: "enabled" }, reasoning_effort: reasoning }),
    };
  }

  return {
    model,
    ...(fallbacks.length ? { models: config.models } : {}),
    messages,
    response_format: config.jsonSchema
      ? { type: "json_schema", json_schema: { name: "connection_graph", strict: false, schema: config.jsonSchema } }
      : { type: "json_object" },
    max_tokens: maxTokens,
    // El proveedor más rápido de cada modelo, y solo los que respetan el formato JSON pedido.
    provider: { sort: "throughput", require_parameters: true },
    ...(reasoning === "none" ? {} : { reasoning: { effort: reasoning === "max" ? "high" : reasoning } }),
    usage: { include: true },
  };
}

export async function chatJson(messages: ChatMessage[], config: LlmConfig): Promise<LlmResult> {
  const { provider, apiKey, timeoutMs = 120_000, fetch: fetchImpl = fetch } = config;
  const baseUrl = config.baseUrl ?? BASE_URLS[provider];
  if (!apiKey) throw new LlmError(`Falta la clave de ${provider}`, 401);
  if (config.models.length === 0) throw new LlmError("No hay modelos configurados", 400);

  const headers: Record<string, string> = { "content-type": "application/json", authorization: `Bearer ${apiKey}` };
  if (provider === "openrouter") {
    // Opcionales: identifican la app en las estadísticas de OpenRouter.
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3030";
    headers["X-Title"] = "Líneas";
  }

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(buildRequestBody(messages, config)),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new LlmError(timedOut ? `${provider} tardó demasiado en responder` : `No se pudo conectar con ${provider}: ${String(error)}`, undefined, true);
  }

  const json = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
  if (!response.ok) {
    const message = json?.error?.message ?? `HTTP ${response.status}`;
    throw new LlmError(`${provider} respondió ${response.status}: ${message}`, response.status, response.status === 429 || response.status >= 500);
  }
  // OpenRouter puede devolver 200 con un error del proveedor dentro.
  if (json?.error) {
    const status = json.error.code ?? 502;
    throw new LlmError(`${provider}: ${json.error.message ?? "error del proveedor"}`, status, status === 429 || status >= 500);
  }

  const choice = json?.choices?.[0];
  const content = choice?.message?.content?.trim() ?? "";
  if (!content) {
    // Los modos JSON a veces devuelven contenido vacío; se reintenta.
    throw new LlmError(`${provider} devolvió una respuesta vacía`, response.status, true);
  }

  const u = json?.usage;
  return {
    content,
    finishReason: choice?.finish_reason ?? null,
    model: json?.model ?? config.models[0],
    usage: u
      ? {
          inputTokens: u.prompt_tokens ?? 0,
          cachedTokens: u.prompt_cache_hit_tokens ?? u.prompt_tokens_details?.cached_tokens ?? 0,
          outputTokens: u.completion_tokens ?? 0,
          ...(typeof u.cost === "number" ? { costUsd: u.cost } : {}),
        }
      : null,
  };
}
