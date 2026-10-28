import type { LlmConfig, ProviderName, ReasoningEffort } from "./llm-client";
import { llmOutputJsonSchema } from "./output-schema";

/**
 * Qué motor usar, leído de variables de entorno.
 *
 *   LINEAS_ENGINE=mock        fuerza el grafo de ejemplo
 *   LLM_PROVIDER              openrouter | deepseek (por defecto: el que tenga clave)
 *   OPENROUTER_API_KEY        clave de OpenRouter
 *   DEEPSEEK_API_KEY          clave de DeepSeek
 *   LLM_MODELS                modelos separados por coma; el primero es el preferido
 *   LLM_REASONING             none | low | high | max (por defecto none)
 *   LLM_JSON_SCHEMA=1         OpenRouter: salida con JSON Schema
 *
 * DEEPSEEK_MODEL y DEEPSEEK_REASONING siguen funcionando por compatibilidad.
 */
export type EngineName = "mock" | ProviderName;

export const DEFAULT_MODELS: Record<ProviderName, string[]> = {
  openrouter: ["moonshotai/kimi-k2.6"],
  deepseek: ["deepseek-flash"],
};

type Env = Record<string, string | undefined>;

export function engineFromEnv(env: Env = process.env): EngineName {
  if (env.LINEAS_ENGINE === "mock") return "mock";
  const provider = env.LLM_PROVIDER;
  if (provider === "openrouter" || provider === "deepseek") return provider;
  if (env.OPENROUTER_API_KEY) return "openrouter";
  if (env.DEEPSEEK_API_KEY) return "deepseek";
  return "mock";
}

export function llmConfigFromEnv(env: Env = process.env, overrides: Partial<LlmConfig> = {}): LlmConfig {
  const engine = engineFromEnv(env);
  const provider: ProviderName = overrides.provider ?? (engine === "mock" ? "deepseek" : engine);
  const listed = (env.LLM_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const models = listed.length ? listed : provider === "deepseek" && env.DEEPSEEK_MODEL ? [env.DEEPSEEK_MODEL] : DEFAULT_MODELS[provider];

  return {
    provider,
    apiKey: (provider === "openrouter" ? env.OPENROUTER_API_KEY : env.DEEPSEEK_API_KEY) ?? "",
    models,
    reasoning: parseReasoning(env.LLM_REASONING ?? env.DEEPSEEK_REASONING),
    ...(provider === "openrouter" && env.LLM_JSON_SCHEMA === "1" ? { jsonSchema: llmOutputJsonSchema() } : {}),
    ...overrides,
  };
}

export function parseReasoning(value: string | undefined): ReasoningEffort {
  return value === "low" || value === "high" || value === "max" ? value : "none";
}
