import { afterEach, describe, expect, it, vi } from "vitest";
import { laneSubgraph } from "@/lib/graph/merge";
import { MOCK_GRAPH } from "@/lib/graph/mock";
import type { ConnectionGraph, Lane } from "@/lib/graph/schema";
import type { StreamEvent } from "./events";

const generateLaneWithLlm = vi.fn();
const verifyGraphBooks = vi.fn();
vi.mock("./llm-engine", () => ({ generateLaneWithLlm: (...args: unknown[]) => generateLaneWithLlm(...args) }));
vi.mock("@/lib/catalog/books", () => ({ verifyGraphBooks: (...args: unknown[]) => verifyGraphBooks(...args) }));
const fetchKnowledge = vi.fn(async () => undefined as string | undefined);
vi.mock("./knowledge", () => ({ fetchKnowledge: () => fetchKnowledge() }));

const { collides, recommendLanes } = await import("./engine");

const CLUES = MOCK_GRAPH.clues;
const laneOf = (nodeId: string) => laneSubgraph(MOCK_GRAPH, MOCK_GRAPH.recommendations.find((r) => r.nodeId === nodeId)!);
const unverified = (g: ConnectionGraph): ConnectionGraph => ({
  ...g,
  nodes: g.nodes.map((n) => (n.book ? { ...n, book: { author: n.book.author, verified: false } } : n)),
});

function withEnv(env: Record<string, string>) {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
}

afterEach(() => {
  vi.unstubAllEnvs();
  generateLaneWithLlm.mockReset();
  verifyGraphBooks.mockReset();
});

async function collect(input: Parameters<typeof recommendLanes>[0]) {
  const events: StreamEvent[] = [];
  await recommendLanes(input, (e) => events.push(e));
  return events;
}

describe("recommendLanes (modelo)", () => {
  it("emite cada carril cuando está listo y cierra con done", async () => {
    withEnv({ LINEAS_ENGINE: "", LLM_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "k" });
    const byLane: Record<Lane, ConnectionGraph> = { affinity: laneOf("aullido"), alternative: laneOf("rayuela"), beyond: laneOf("el-extranjero") };
    const delay: Record<Lane, number> = { affinity: 30, alternative: 10, beyond: 20 };
    generateLaneWithLlm.mockImplementation(async ({ lane }: { lane: Lane }) => {
      await new Promise((r) => setTimeout(r, delay[lane]));
      return unverified(byLane[lane]);
    });
    verifyGraphBooks.mockImplementation(async (g: ConnectionGraph) => g);

    const events = await collect({ clues: [{ id: "x", kind: "idea", label: "orden de llegada" }], exclude: [] });
    expect(events.map((e) => (e.type === "lane" ? e.lane : e.type))).toEqual(["alternative", "beyond", "affinity", "done"]);
  });

  it("regenera el carril que llega después con un autor ya mostrado", async () => {
    withEnv({ LINEAS_ENGINE: "", LLM_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "k" });
    const calls: { lane: Lane; exclude: { title: string }[] }[] = [];
    generateLaneWithLlm.mockImplementation(async (input: { lane: Lane; exclude: { title: string }[] }) => {
      calls.push(input);
      if (input.lane === "affinity") return laneOf("los-vagabundos-del-dharma"); // Kerouac
      if (input.lane === "alternative") {
        await new Promise((r) => setTimeout(r, 10));
        // Primero repite a Kerouac (otro libro), después propone otro autor.
        return input.exclude.length ? laneOf("rayuela") : { ...laneOf("rayuela"), nodes: laneOf("rayuela").nodes.map((n) => (n.id === "rayuela" ? { ...n, book: { author: "Jack Kerouac", verified: true } } : n)) };
      }
      return laneOf("el-extranjero");
    });
    verifyGraphBooks.mockImplementation(async (g: ConnectionGraph) => g);

    const events = await collect({ clues: [{ id: "x", kind: "idea", label: "colisión de autores" }], exclude: [] });
    const alternative = events.find((e) => e.type === "lane" && e.lane === "alternative");
    expect(alternative?.type === "lane" && alternative.graph.recommendations[0].nodeId).toBe("rayuela");
    const altCalls = calls.filter((c) => c.lane === "alternative");
    expect(altCalls).toHaveLength(2);
    expect(altCalls[1].exclude.map((b) => b.title)).toContain("Los vagabundos del Dharma");
  });

  it("si el catálogo tarda, muestra el carril sin verificar y después manda el patch", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      withEnv({ LINEAS_ENGINE: "", LLM_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "k" });
      generateLaneWithLlm.mockImplementation(async () => unverified(laneOf("el-extranjero")));
      verifyGraphBooks.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(laneOf("el-extranjero")), 5000)));

      const events: StreamEvent[] = [];
      const done = recommendLanes({ clues: [{ id: "x", kind: "idea", label: "catálogo lento" }], lane: "beyond", exclude: [] }, (e) => events.push(e));
      await vi.advanceTimersByTimeAsync(1600);
      expect(events.map((e) => e.type)).toEqual(["lane"]);
      await vi.advanceTimersByTimeAsync(4000);
      await done;
      expect(events.map((e) => e.type)).toEqual(["lane", "patch", "done"]);
      const patch = events[1];
      expect(patch.type === "patch" && patch.book.verified).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("un carril que falla no frena a los otros", async () => {
    withEnv({ LINEAS_ENGINE: "", LLM_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "k" });
    generateLaneWithLlm.mockImplementation(async ({ lane }: { lane: Lane }) => {
      if (lane === "beyond") throw new Error("se cayó");
      return lane === "affinity" ? laneOf("aullido") : laneOf("rayuela");
    });
    verifyGraphBooks.mockImplementation(async (g: ConnectionGraph) => g);
    const events = await collect({ clues: [{ id: "x", kind: "idea", label: "un carril cae" }], exclude: [] });
    expect(events.filter((e) => e.type === "lane")).toHaveLength(2);
    expect(events.find((e) => e.type === "lane-error")).toMatchObject({ lane: "beyond" });
    expect(events.at(-1)?.type).toBe("done");
  });

  it("la segunda vez sale del cache sin llamar al modelo", async () => {
    withEnv({ LINEAS_ENGINE: "", LLM_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "k" });
    generateLaneWithLlm.mockImplementation(async () => laneOf("aullido"));
    verifyGraphBooks.mockImplementation(async (g: ConnectionGraph) => g);
    const input = { clues: [{ id: "x", kind: "idea" as const, label: "cache" }], lane: "affinity" as const, exclude: [] };
    await collect(input);
    const second = await collect(input);
    expect(generateLaneWithLlm).toHaveBeenCalledTimes(1);
    expect(second[0]).toMatchObject({ type: "lane", cached: true });
  });

  it("pasa al modelo lo que validaron los lectores", async () => {
    withEnv({ LINEAS_ENGINE: "", LLM_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "k" });
    fetchKnowledge.mockResolvedValueOnce("Conexiones confirmadas por lectores: …");
    generateLaneWithLlm.mockImplementation(async () => laneOf("aullido"));
    verifyGraphBooks.mockImplementation(async (g: ConnectionGraph) => g);
    await collect({ clues: [{ id: "x", kind: "idea", label: "conocimiento" }], lane: "affinity", exclude: [] });
    expect(generateLaneWithLlm.mock.calls[0][0]).toMatchObject({ knowledge: "Conexiones confirmadas por lectores: …" });
  });
});

describe("recommendLanes (mock)", () => {
  it("con «ver otra» devuelve un libro distinto de los excluidos", async () => {
    withEnv({ LINEAS_ENGINE: "mock" });
    const events = await collect({ clues: CLUES, lane: "affinity", exclude: [{ title: "Los vagabundos del Dharma", author: "Jack Kerouac" }] });
    const lane = events[0];
    expect(lane.type === "lane" && lane.graph.recommendations[0].nodeId).toBe("aullido");
  });
});

describe("collides", () => {
  it("detecta mismo libro o mismo autor", () => {
    expect(collides(laneOf("rayuela"), [{ title: "Rayuela", author: "" }])).toBe(true);
    expect(collides(laneOf("rayuela"), [{ title: "Bestiario", author: "J. Cortázar" }])).toBe(true);
    expect(collides(laneOf("rayuela"), [{ title: "Aullido", author: "Allen Ginsberg" }])).toBe(false);
  });
});
