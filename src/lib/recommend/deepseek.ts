// Solo servidor: si algo de cliente importa este módulo, el build falla.
import "server-only";

/**
 * Cliente mínimo de la API de DeepSeek (compatible con OpenAI Chat Completions).
 * Sin SDK: un fetch tipado alcanza y no suma dependencias.
 *
 * Modelos vigentes: "deepseek-flash" (barato, por defecto) y "deepseek-v4-pro".
 * Docs: https://api-docs.deepseek.com/api/create-chat-completion/
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekOptions {
  apiKey: string;
  model?: string;
  /** "none" desactiva el modo de razonamiento (más rápido y barato). */
  reasoningEffort?: "none" | "low" | "high" | "max";
  maxTokens?: number;
  timeoutMs?: number;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface DeepSeekUsage {
  prompt_tokens: number;
  completion_tokens: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
}

export interface DeepSeekResult {
  content: string;
  finishReason: string | null;
  usage: DeepSeekUsage | null;
}

export class DeepSeekError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** true si conviene reintentar (429, 5xx, timeout, respuesta vacía). */
    readonly retryable = false,
  ) {
    super(message);
    this.name = "DeepSeekError";
  }
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: DeepSeekUsage;
  error?: { message?: string };
}

export async function chatJson(messages: ChatMessage[], options: DeepSeekOptions): Promise<DeepSeekResult> {
  const {
    apiKey,
    model = "deepseek-flash",
    reasoningEffort = "none",
    maxTokens = 16_000,
    timeoutMs = 90_000,
    baseUrl = "https://api.deepseek.com",
    fetch: fetchImpl = fetch,
  } = options;

  const body = {
    model,
    messages,
    response_format: { type: "json_object" },
    max_tokens: maxTokens,
    ...(reasoningEffort === "none" ? { thinking: { type: "disabled" } } : { thinking: { type: "enabled" }, reasoning_effort: reasoningEffort }),
  };

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new DeepSeekError(timedOut ? "DeepSeek tardó demasiado en responder" : `No se pudo conectar con DeepSeek: ${String(error)}`, undefined, true);
  }

  const json = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
  if (!response.ok) {
    const message = json?.error?.message ?? `HTTP ${response.status}`;
    throw new DeepSeekError(`DeepSeek respondió ${response.status}: ${message}`, response.status, response.status === 429 || response.status >= 500);
  }

  const choice = json?.choices?.[0];
  const content = choice?.message?.content?.trim() ?? "";
  if (!content) {
    // La documentación advierte que el modo JSON a veces devuelve contenido vacío.
    throw new DeepSeekError("DeepSeek devolvió una respuesta vacía", response.status, true);
  }
  return { content, finishReason: choice?.finish_reason ?? null, usage: json?.usage ?? null };
}
