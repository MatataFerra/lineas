import { describe, expect, it, vi } from "vitest";
import { verifyGraphBooks } from "@/lib/catalog/books";
import { MOCK_GRAPH } from "@/lib/graph/mock";
import type { Clue } from "@/lib/graph/schema";
import { createRateLimiter } from "@/lib/rate-limit";
import { EngineError, generateGraphWithLlm } from "./llm-engine";
import { normalizeRawGraph } from "./normalize";

const CLUES: Clue[] = [
  { id: "c1", kind: "book", label: "On the Road" },
  { id: "c2", kind: "movement", label: "Generación Beat" },
];

/** Lo que devolvería el modelo: el grafo de ejemplo sin pistas ni datos de catálogo. */
function modelOutput(mutate?: (g: Record<string, unknown>) => void): string {
  const raw = structuredClone(MOCK_GRAPH) as unknown as Record<string, unknown>;
  delete raw.clues;
  for (const node of raw.nodes as Record<string, unknown>[]) delete node.book;
  mutate?.(raw);
  return JSON.stringify(raw);
}

function deepseekReply(content: string, finishReason = "stop") {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content }, finish_reason: finishReason }],
      usage: { prompt_tokens: 100, completion_tokens: 50, prompt_cache_hit_tokens: 80, prompt_cache_miss_tokens: 20 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function fakeFetch(...replies: (Response | (() => Response))[]) {
  const calls: { url: string; body: Record<string, unknown>; headers: Headers }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    const next = replies.shift();
    if (!next) throw new Error("sin más respuestas simuladas");
    return typeof next === "function" ? next() : next;
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

const base = { apiKey: "test-key", maxAttempts: 3 };

describe("generateGraphWithLlm", () => {
  it("devuelve el grafo validado y arma bien el pedido a DeepSeek", async () => {
    const { fetch, calls } = fakeFetch(deepseekReply(modelOutput()));
    const graph = await generateGraphWithLlm(CLUES, { ...base, fetch });

    expect(graph.clues).toEqual(CLUES);
    expect(graph.recommendations).toHaveLength(9);
    expect(graph.nodes.find((n) => n.id === "rayuela")?.book).toEqual({ author: "Julio Cortázar", verified: false });

    const [call] = calls;
    expect(call.url).toBe("https://api.deepseek.com/chat/completions");
    expect(call.headers.get("authorization")).toBe("Bearer test-key");
    expect(call.body.model).toBe("deepseek-flash");
    expect(call.body.response_format).toEqual({ type: "json_object" });
    expect(call.body.thinking).toEqual({ type: "disabled" });
    const messages = call.body.messages as { role: string; content: string }[];
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("JSON");
    expect(messages[1].content).toContain("- book: On the Road");
  });

  it("descarta una recomendación rota sin pagar otro intento si el carril sigue teniendo dos", async () => {
    const broken = modelOutput((g) => {
      const recs = g.recommendations as { path: string[] }[];
      recs[0].path = ["on-the-road", "siddhartha", "los-vagabundos-del-dharma"];
    });
    const events: string[] = [];
    const { fetch, calls } = fakeFetch(deepseekReply(broken));
    const graph = await generateGraphWithLlm(CLUES, { ...base, fetch, log: (e) => events.push(e.type) });

    expect(calls).toHaveLength(1);
    expect(graph.recommendations).toHaveLength(8);
    expect(graph.recommendations.map((r) => r.nodeId)).not.toContain("los-vagabundos-del-dharma");
    expect(events).toContain("salvaged");
  });

  it("reintenta con los errores concretos cuando descartar dejaría un carril pobre", async () => {
    const broken = modelOutput((g) => {
      const recs = g.recommendations as { lane: string; path: string[] }[];
      for (const rec of recs.filter((r) => r.lane === "affinity").slice(0, 2)) rec.path = ["on-the-road", "siddhartha"];
    });
    const { fetch, calls } = fakeFetch(deepseekReply(broken), deepseekReply(modelOutput()));
    const graph = await generateGraphWithLlm(CLUES, { ...base, fetch });

    expect(graph.recommendations).toHaveLength(9);
    expect(calls).toHaveLength(2);
    const repair = (calls[1].body.messages as { role: string; content: string }[]).at(-1)!;
    expect(repair.role).toBe("user");
    expect(repair.content).toContain("No hay arista entre on-the-road y siddhartha");
  });

  it("da vuelta una influencia escrita al revés en vez de rechazarla", async () => {
    const inverted = modelOutput((g) => {
      const edge = (g.edges as { id: string; source: string; target: string }[]).find((e) => e.id === "wolfe-road")!;
      [edge.source, edge.target] = [edge.target, edge.source];
    });
    const { fetch } = fakeFetch(deepseekReply(inverted));
    const graph = await generateGraphWithLlm(CLUES, { ...base, fetch });
    expect(graph.edges.find((e) => e.id === "wolfe-road")).toMatchObject({ source: "thomas-wolfe", target: "on-the-road" });
  });

  it("se recupera de JSON inválido y de un error 503", async () => {
    const { fetch, calls } = fakeFetch(
      new Response(JSON.stringify({ error: { message: "busy" } }), { status: 503 }),
      deepseekReply("{ esto no es json"),
      deepseekReply(modelOutput()),
    );
    const graph = await generateGraphWithLlm(CLUES, { ...base, fetch });
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(calls).toHaveLength(3);
  });

  it("falla con EngineError después del último intento", async () => {
    const empty = modelOutput((g) => (g.recommendations = []));
    const { fetch } = fakeFetch(deepseekReply(empty), deepseekReply(empty), deepseekReply(empty));
    await expect(generateGraphWithLlm(CLUES, { ...base, fetch })).rejects.toBeInstanceOf(EngineError);
  });

  it("no reintenta errores que no se arreglan reintentando (401)", async () => {
    const { fetch, calls } = fakeFetch(new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401 }));
    await expect(generateGraphWithLlm(CLUES, { ...base, fetch })).rejects.toThrow(/401/);
    expect(calls).toHaveLength(1);
  });
});

describe("normalizeRawGraph", () => {
  it("recorta textos largos, normaliza ids y usa las pistas del usuario", () => {
    const raw = JSON.parse(
      modelOutput((g) => {
        const nodes = g.nodes as Record<string, unknown>[];
        nodes[0].id = "On The Road";
        const edges = g.edges as Record<string, unknown>[];
        edges[0].summary = "x ".repeat(200);
      }),
    );
    raw.clues = [{ id: "falsa", kind: "idea", label: "inventada" }];
    const out = normalizeRawGraph(raw, CLUES) as { clues: Clue[]; nodes: { id: string }[]; edges: { summary: string }[] };
    expect(out.clues).toEqual(CLUES);
    expect(out.nodes[0].id).toBe("on-the-road");
    expect(out.edges[0].summary.length).toBeLessThanOrEqual(140);
  });
});

describe("verifyGraphBooks", () => {
  const google = (title: string, author: string) =>
    new Response(
      JSON.stringify({
        items: [
          {
            id: `g-${title}`,
            volumeInfo: {
              title,
              authors: [author],
              publishedDate: "1999",
              imageLinks: { thumbnail: "http://books.google.com/books/content?id=abc&img=1&zoom=1&edge=curl" },
            },
          },
        ],
      }),
    );
  const nothing = () => new Response(JSON.stringify({ items: [], docs: [] }));

  it("marca verificados, completa portadas y descarta lo no verificado si el carril tiene alternativas", async () => {
    const known: Record<string, string> = {
      "On the Road": "Jack Kerouac",
      "Los vagabundos del Dharma": "Jack Kerouac",
      Fiesta: "Ernest Hemingway",
      "El extranjero": "Albert Camus",
    };
    const fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "www.googleapis.com") {
        const q = url.searchParams.get("q") ?? "";
        const title = q.match(/intitle:"(.*)" inauthor:/)?.[1] ?? "";
        return known[title] ? google(title, known[title]) : nothing();
      }
      // Open Library: solo encuentra Rayuela.
      if (url.searchParams.get("title") === "Rayuela") {
        return new Response(JSON.stringify({ docs: [{ key: "/works/OL1W", title: "Rayuela", author_name: ["Julio Cortázar"], cover_i: 42 }] }));
      }
      return nothing();
    }) as typeof globalThis.fetch;

    const input = structuredClone(MOCK_GRAPH);
    for (const node of input.nodes) if (node.book) node.book = { author: node.book.author, verified: false };
    const graph = await verifyGraphBooks(input, { fetch });

    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    expect(byId.get("fiesta")?.book).toMatchObject({ verified: true, googleBooksId: "g-Fiesta" });
    expect(byId.get("fiesta")?.book?.coverUrl).toBe("https://books.google.com/books/content?id=abc&img=1&zoom=1");
    expect(byId.get("rayuela")?.book).toMatchObject({ verified: true, coverUrl: "https://covers.openlibrary.org/b/id/42-M.jpg" });
    expect(byId.get("aullido")?.book?.verified).toBe(false);

    const recs = graph.recommendations.map((r) => r.nodeId);
    expect(recs).toContain("los-vagabundos-del-dharma");
    expect(recs).not.toContain("aullido"); // affinity tiene una verificada
    expect(recs).toEqual(expect.arrayContaining(["fiesta", "rayuela", "el-extranjero"]));
    expect(recs).not.toContain("los-detectives-salvajes");
  });

  it("verifica por el título original cuando el título en español no aparece", async () => {
    const fetch = (async (input: RequestInfo | URL) => {
      const q = new URL(String(input)).searchParams.get("q") ?? "";
      return q.includes("L'Étranger") ? google("L'Étranger", "Albert Camus") : nothing();
    }) as typeof globalThis.fetch;
    const input = structuredClone(MOCK_GRAPH);
    const node = input.nodes.find((n) => n.id === "el-extranjero")!;
    node.originalTitle = "L'Étranger";
    const misses: string[] = [];
    const graph = await verifyGraphBooks(input, { fetch, onMiss: (r) => misses.push(r.title) });
    expect(graph.nodes.find((n) => n.id === "el-extranjero")?.book?.verified).toBe(true);
    expect(misses).toContain("Rayuela");
    expect(misses).not.toContain("El extranjero");
  });

  it("informa cuando un catálogo responde con error", async () => {
    const fetch = (async (input: RequestInfo | URL) =>
      new URL(String(input)).hostname === "www.googleapis.com" ? new Response("{}", { status: 429 }) : nothing()) as typeof globalThis.fetch;
    const reports: { tried: { source: string; outcome: string }[] }[] = [];
    await verifyGraphBooks(structuredClone(MOCK_GRAPH), { fetch, onMiss: (r) => reports.push(r) });
    expect(reports[0].tried[0]).toMatchObject({ source: "google", outcome: "http-429" });
    expect(reports[0].tried.some((t) => t.source === "openlibrary")).toBe(true);
  });

  it("no rechaza un libro de otro autor con el mismo título", async () => {
    const fetch = (async () => google("Fiesta", "Otra Persona")) as typeof globalThis.fetch;
    const input = structuredClone(MOCK_GRAPH);
    const graph = await verifyGraphBooks(input, { fetch });
    expect(graph.nodes.find((n) => n.id === "fiesta")?.book?.verified).toBe(false);
  });
});

describe("createRateLimiter", () => {
  it("corta al pasar el límite y libera al terminar la ventana", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(check("ip", 0).ok).toBe(true);
    expect(check("ip", 10).ok).toBe(true);
    const blocked = check("ip", 20);
    expect(blocked.ok).toBe(false);
    expect(check("otra-ip", 20).ok).toBe(true);
    expect(check("ip", 1001).ok).toBe(true);
  });
});

describe("corrida real (On the Road · Generación Beat · La libertad)", () => {
  it("da vuelta la influencia Céline → Kerouac y convierte los same_author persona→libro en authored", async () => {
    const { readFileSync } = await import("node:fs");
    const raw = JSON.parse(readFileSync(new URL("./__fixtures__/run-on-the-road.json", import.meta.url), "utf8"));
    const normalized = normalizeRawGraph(raw, raw.clues) as { edges: { id: string; source: string; target: string }[] };
    expect(normalized.edges.find((e) => e.id === "e-road-celine")).toMatchObject({ source: "viaje-al-fin-de-la-noche", target: "on-the-road" });

    const { salvage } = await import("./llm-engine");
    expect(normalized.edges.find((e) => e.id === "e-kerouac-road")).toMatchObject({ type: "authored", source: "jack-kerouac" });
    const rescued = salvage(normalized, 1);
    expect(rescued?.droppedEdges).toEqual([]);
    expect(rescued?.graph.recommendations).toHaveLength(5);
  });
});

describe("corrida real (Clarice Lispector · Desarraigo · tiempo detenido)", () => {
  it("convierte persona→libro en authored y libro→idea en tema en común", () => {
    const raw = JSON.parse(modelOutput((g) => {
      const nodes = g.nodes as Record<string, unknown>[];
      nodes.push({ id: "jack-kerouac", kind: "person", label: "Jack Kerouac", subtitle: "Escritor", era: { from: 1922, to: 1969, label: "1922–1969", pivot: 1957 }, isClue: false });
      nodes.push({ id: "libertad", kind: "concept", label: "La libertad", subtitle: "Idea", era: { from: 1940, to: 1970, label: "posguerra" }, isClue: false });
      const edges = g.edges as Record<string, unknown>[];
      edges.push({ id: "kerouac-road", source: "on-the-road", target: "jack-kerouac", type: "same_author", confidence: "documented", summary: "s", explanation: "e" });
      edges.push({ id: "road-libertad", source: "on-the-road", target: "libertad", type: "belongs_to", confidence: "scholarly", summary: "s", explanation: "e" });
    }));
    const out = normalizeRawGraph(raw, CLUES) as { edges: { id: string; type: string; source: string; target: string }[] };
    expect(out.edges.find((e) => e.id === "kerouac-road")).toMatchObject({ type: "authored", source: "jack-kerouac", target: "on-the-road" });
    expect(out.edges.find((e) => e.id === "road-libertad")?.type).toBe("shared_theme");
  });

  it("recorta nodos sobrantes que no están en ningún recorrido en vez de reintentar", async () => {
    const tooMany = modelOutput((g) => {
      const nodes = g.nodes as Record<string, unknown>[];
      for (let i = 0; i < 4; i++) nodes.push({ id: `extra-${i}`, kind: "person", label: `Extra ${i}`, subtitle: "x", era: { from: 1900, label: "1900" }, isClue: false });
    });
    const { fetch, calls } = fakeFetch(deepseekReply(tooMany));
    const graph = await generateGraphWithLlm(CLUES, { ...base, fetch });
    expect(calls).toHaveLength(1);
    expect(graph.nodes.length).toBeLessThanOrEqual(16);
    expect(graph.recommendations).toHaveLength(9);
  });
});
