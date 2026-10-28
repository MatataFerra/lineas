import { describe, expect, it } from "vitest";
import { engineFromEnv, llmConfigFromEnv } from "./config";
import { buildRequestBody, chatJson, LlmError, type LlmConfig } from "./llm-client";
import { llmOutputJsonSchema } from "./output-schema";

const messages = [{ role: "user" as const, content: "json por favor" }];

function capture(reply: Response) {
  const calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return reply;
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const ok = (body: Record<string, unknown>) => new Response(JSON.stringify(body), { status: 200 });

describe("buildRequestBody", () => {
  it("DeepSeek: modo JSON y razonamiento apagado por defecto", () => {
    const body = buildRequestBody(messages, { provider: "deepseek", apiKey: "k", models: ["deepseek-flash"] });
    expect(body).toMatchObject({ model: "deepseek-flash", response_format: { type: "json_object" }, thinking: { type: "disabled" }, max_tokens: 16_000 });
  });

  it("con razonamiento da más margen de tokens para que el JSON no se corte", () => {
    const body = buildRequestBody(messages, { provider: "deepseek", apiKey: "k", models: ["deepseek-flash"], reasoning: "low" });
    expect(body).toMatchObject({ thinking: { type: "enabled" }, reasoning_effort: "low", max_tokens: 48_000 });
  });

  it("OpenRouter: respaldos, proveedor más rápido y costo en usage", () => {
    const body = buildRequestBody(messages, { provider: "openrouter", apiKey: "k", models: ["moonshotai/kimi-k2.6", "otro/modelo"] });
    expect(body).toMatchObject({
      model: "moonshotai/kimi-k2.6",
      models: ["moonshotai/kimi-k2.6", "otro/modelo"],
      response_format: { type: "json_object" },
      provider: { sort: "throughput", require_parameters: false },
      usage: { include: true },
    });
    expect(body).not.toHaveProperty("reasoning");
    expect(body).not.toHaveProperty("thinking");
  });

  it("OpenRouter con JSON Schema exige proveedores que lo soporten", () => {
    const schema = llmOutputJsonSchema();
    const body = buildRequestBody(messages, { provider: "openrouter", apiKey: "k", models: ["a/b"], jsonSchema: schema, reasoning: "high" });
    expect(body).toMatchObject({
      response_format: { type: "json_schema", json_schema: { name: "connection_graph", schema } },
      provider: { require_parameters: true },
      reasoning: { effort: "high" },
    });
    expect(body).not.toHaveProperty("models");
  });
});

describe("chatJson", () => {
  const config: LlmConfig = { provider: "openrouter", apiKey: "sk-or", models: ["moonshotai/kimi-k2.6", "otro/modelo"] };

  it("llama a OpenRouter y devuelve el modelo que respondió, con tokens y costo", async () => {
    const { fetch, calls } = capture(
      ok({
        model: "otro/modelo",
        choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 60 }, cost: 0.0012 },
      }),
    );
    const result = await chatJson(messages, { ...config, fetch });
    expect(calls[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(calls[0].headers.get("authorization")).toBe("Bearer sk-or");
    expect(calls[0].headers.get("x-title")).toBe("Líneas");
    expect(result).toEqual({ content: "{}", finishReason: "stop", model: "otro/modelo", usage: { inputTokens: 100, cachedTokens: 60, outputTokens: 20, costUsd: 0.0012 } });
  });

  it("trata un error dentro de una respuesta 200 como error del proveedor", async () => {
    const { fetch } = capture(ok({ error: { message: "upstream overloaded", code: 503 } }));
    const error = await chatJson(messages, { ...config, fetch }).catch((e) => e);
    expect(error).toBeInstanceOf(LlmError);
    expect(error.retryable).toBe(true);
  });

  it("falla rápido sin clave", async () => {
    await expect(chatJson(messages, { ...config, apiKey: "" })).rejects.toThrow(/clave/);
  });
});

describe("configuración por entorno", () => {
  it("prefiere OpenRouter si hay clave y lee la lista de modelos", () => {
    const env = { OPENROUTER_API_KEY: "or", DEEPSEEK_API_KEY: "ds", LLM_MODELS: "moonshotai/kimi-k2.6, otro/modelo", LLM_REASONING: "low" };
    expect(engineFromEnv(env)).toBe("openrouter");
    expect(llmConfigFromEnv(env)).toMatchObject({ provider: "openrouter", apiKey: "or", models: ["moonshotai/kimi-k2.6", "otro/modelo"], reasoning: "low" });
  });

  it("sigue aceptando las variables DEEPSEEK_* de antes", () => {
    const env = { DEEPSEEK_API_KEY: "ds", DEEPSEEK_MODEL: "deepseek-v4-pro", DEEPSEEK_REASONING: "high" };
    expect(engineFromEnv(env)).toBe("deepseek");
    expect(llmConfigFromEnv(env)).toMatchObject({ provider: "deepseek", models: ["deepseek-v4-pro"], reasoning: "high" });
  });

  it("LINEAS_ENGINE=mock gana aunque haya claves", () => {
    expect(engineFromEnv({ LINEAS_ENGINE: "mock", OPENROUTER_API_KEY: "or" })).toBe("mock");
    expect(engineFromEnv({})).toBe("mock");
  });

  it("LLM_JSON_SCHEMA=1 adjunta el esquema solo en OpenRouter", () => {
    expect(llmConfigFromEnv({ OPENROUTER_API_KEY: "or", LLM_JSON_SCHEMA: "1" }).jsonSchema).toBeDefined();
    expect(llmConfigFromEnv({ DEEPSEEK_API_KEY: "ds", LLM_JSON_SCHEMA: "1" }).jsonSchema).toBeUndefined();
  });
});
