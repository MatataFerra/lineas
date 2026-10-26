import { describe, expect, it } from "vitest";
import { layoutGraph, DEFAULT_LAYOUT } from "./layout";
import { MOCK_GRAPH } from "./mock";
import { indexGraph, pathEdges, describeTimeJump } from "./queries";
import { ConnectionGraphSchema, GRAPH_LIMITS } from "./schema";

describe("ConnectionGraphSchema", () => {
  it("acepta el grafo de ejemplo", () => {
    expect(ConnectionGraphSchema.safeParse(MOCK_GRAPH).success).toBe(true);
  });

  it("rechaza un recorrido sin arista entre dos paradas", () => {
    const bad = structuredClone(MOCK_GRAPH);
    bad.recommendations[0].path = ["on-the-road", "rayuela"];
    bad.recommendations[0].nodeId = "rayuela";
    const result = ConnectionGraphSchema.safeParse(bad);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toContain("No hay arista entre on-the-road y rayuela");
  });

  it("rechaza recorridos más largos que el máximo de saltos", () => {
    const bad = structuredClone(MOCK_GRAPH);
    bad.recommendations[0].path = ["generacion-beat", "on-the-road", "charlie-parker", "rayuela"];
    bad.recommendations[0].nodeId = "rayuela";
    const result = ConnectionGraphSchema.safeParse(bad);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message === `Máximo ${GRAPH_LIMITS.maxHops} saltos`)).toBe(true);
  });

  it("exige la frase en una arista de frase compartida", () => {
    const bad = structuredClone(MOCK_GRAPH);
    const edge = bad.edges.find((e) => e.type === "shared_phrase")!;
    delete edge.quote;
    expect(ConnectionGraphSchema.safeParse(bad).success).toBe(false);
  });

  it("exige al menos una recomendación por carril", () => {
    const bad = structuredClone(MOCK_GRAPH);
    bad.recommendations = bad.recommendations.filter((r) => r.lane !== "beyond");
    expect(ConnectionGraphSchema.safeParse(bad).success).toBe(false);
  });
});

describe("queries", () => {
  const index = indexGraph(MOCK_GRAPH);

  it("calcula los saltos desde las pistas", () => {
    expect(index.hops.get("on-the-road")).toBe(0);
    expect(index.hops.get("arthur-rimbaud")).toBe(1);
    expect(index.hops.get("los-detectives-salvajes")).toBe(1);
    expect(index.hops.get("el-extranjero")).toBe(2);
  });

  it("devuelve las aristas de un recorrido en orden", () => {
    const edges = pathEdges(index, ["generacion-beat", "arthur-rimbaud", "los-detectives-salvajes"]);
    expect(edges.map((e) => e.id)).toEqual(["rimbaud-beat", "rimbaud-detectives"]);
  });

  it("describe el salto en el tiempo", () => {
    const beat = index.nodes.get("generacion-beat")!;
    const rimbaud = index.nodes.get("arthur-rimbaud")!;
    expect(describeTimeJump(beat, rimbaud)).toBe("79 años antes");
  });
});

describe("layoutGraph", () => {
  it("no superpone nodos de una misma fila", () => {
    const { positions } = layoutGraph(MOCK_GRAPH.nodes);
    const list = [...positions.values()];
    const minDistance = DEFAULT_LAYOUT.nodeWidth + DEFAULT_LAYOUT.minGap - 1;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[i].y === list[j].y) expect(Math.abs(list[i].x - list[j].x)).toBeGreaterThanOrEqual(minDistance);
      }
    }
  });

  it("respeta el orden del tiempo en el eje X para años distintos y alejados", () => {
    const { positions } = layoutGraph(MOCK_GRAPH.nodes);
    expect(positions.get("arthur-rimbaud")!.x).toBeLessThan(positions.get("fiesta")!.x);
    expect(positions.get("fiesta")!.x).toBeLessThan(positions.get("los-detectives-salvajes")!.x);
  });
});
