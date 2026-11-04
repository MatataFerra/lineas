import { describe, expect, it } from "vitest";
import { authorKey, laneSubgraph, mergeLaneGraphs } from "./merge";
import { MOCK_GRAPH } from "./mock";
import { laneGraphSchema, MergedGraphSchema, type ConnectionGraph } from "./schema";

const recOf = (nodeId: string) => MOCK_GRAPH.recommendations.find((r) => r.nodeId === nodeId)!;

describe("laneSubgraph", () => {
  it("recorta el grafo al recorrido de una recomendación, con las pistas", () => {
    const sub = laneSubgraph(MOCK_GRAPH, recOf("los-detectives-salvajes"));
    expect(sub.recommendations).toHaveLength(1);
    expect(sub.nodes.map((n) => n.id).sort()).toEqual(["arthur-rimbaud", "generacion-beat", "los-detectives-salvajes", "on-the-road"]);
    expect(laneGraphSchema("beyond").safeParse(sub).success).toBe(true);
  });
});

describe("mergeLaneGraphs", () => {
  const affinity = laneSubgraph(MOCK_GRAPH, recOf("los-vagabundos-del-dharma"));
  const alternative = laneSubgraph(MOCK_GRAPH, recOf("rayuela"));
  const beyond = laneSubgraph(MOCK_GRAPH, recOf("el-extranjero"));

  it("une los carriles sin repetir nodos ni aristas y valida como mapa", () => {
    const merged = mergeLaneGraphs(MOCK_GRAPH.clues, [affinity, alternative, beyond]);
    const ids = merged.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id === "on-the-road")).toHaveLength(1);
    expect(merged.recommendations.map((r) => r.lane)).toEqual(["affinity", "alternative", "beyond"]);
    expect(MergedGraphSchema.safeParse(merged).success).toBe(true);
  });

  it("acepta un mapa parcial (falta un carril)", () => {
    const merged = mergeLaneGraphs(MOCK_GRAPH.clues, [beyond]);
    expect(MergedGraphSchema.safeParse(merged).success).toBe(true);
  });

  it("renombra aristas de carriles distintos que traen el mismo id para pares distintos", () => {
    const rename = (g: ConnectionGraph): ConnectionGraph => ({ ...g, edges: g.edges.map((e, i) => ({ ...e, id: `e${i + 1}` })) });
    const merged = mergeLaneGraphs(MOCK_GRAPH.clues, [rename(affinity), rename(beyond)]);
    const ids = merged.edges.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MergedGraphSchema.safeParse(merged).success).toBe(true);
  });

  it("se queda con los datos verificados del libro si llegan en otro carril", () => {
    const unverified: ConnectionGraph = {
      ...alternative,
      nodes: alternative.nodes.map((n) => (n.id === "on-the-road" ? { ...n, book: { author: "Jack Kerouac", verified: false } } : n)),
    };
    const merged = mergeLaneGraphs(MOCK_GRAPH.clues, [unverified, affinity]);
    expect(merged.nodes.find((n) => n.id === "on-the-road")?.book?.verified).toBe(true);
  });
});

describe("authorKey", () => {
  it("compara autores por apellido, sin tildes ni iniciales", () => {
    expect(authorKey("Julio Cortázar")).toBe(authorKey("J. Cortazar"));
    expect(authorKey("Jack Kerouac")).not.toBe(authorKey("Julio Cortázar"));
  });
});
