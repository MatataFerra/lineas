import { describe, expect, it } from "vitest";
import { MOCK_GRAPH } from "./mock";
import { connectionDetail } from "./connection-detail";

describe("connectionDetail", () => {
  it("usa el pitch cuando el libro es una recomendación", () => {
    const d = connectionDetail(MOCK_GRAPH, "rayuela")!;
    expect(d.text).toMatch(/París y Buenos Aires/);
    expect(d.author).toBe("Julio Cortázar");
    expect(d.year).toBe(1963);
  });

  it("explica con la arista que lo une al mapa cuando no es una recomendación", () => {
    const d = connectionDetail(MOCK_GRAPH, "on-the-road")!;
    expect(d.text).toBeTruthy();
    expect(d.isClue).toBe(true);
  });

  it("toma como etiquetas los movimientos, ideas y artes vecinos", () => {
    expect(connectionDetail(MOCK_GRAPH, "rayuela")!.tags).toEqual(["Charlie Parker"]);
    expect(connectionDetail(MOCK_GRAPH, "el-extranjero")!.tags).toEqual(["Existencialismo"]);
  });

  it("sugiere hasta tres libros, primero los conectados directamente", () => {
    const d = connectionDetail(MOCK_GRAPH, "los-vagabundos-del-dharma")!;
    expect(d.related).toHaveLength(3);
    expect(d.related.map((n) => n.id).slice(0, 2).sort()).toEqual(["on-the-road", "siddhartha"]);
    expect(d.related.map((n) => n.id)).not.toContain("los-vagabundos-del-dharma");
  });

  it("numera el libro entre todos los libros del mapa, recomendaciones primero", () => {
    const books = MOCK_GRAPH.nodes.filter((n) => n.kind === "book").length;
    const first = connectionDetail(MOCK_GRAPH, "los-vagabundos-del-dharma")!;
    expect(first.position).toEqual({ index: 1, total: books });
    const clue = connectionDetail(MOCK_GRAPH, "on-the-road")!;
    expect(clue.position.index).toBe(books);
  });

  it("devuelve null si el nodo no es un libro", () => {
    expect(connectionDetail(MOCK_GRAPH, "charlie-parker")).toBeNull();
    expect(connectionDetail(MOCK_GRAPH, "no-existe")).toBeNull();
  });

  it("arma el recorrido desde las pistas: el de la recomendación si lo es", () => {
    const d = connectionDetail(MOCK_GRAPH, "los-detectives-salvajes")!;
    expect(d.route.map((s) => s.from.id)).toEqual(["generacion-beat", "arthur-rimbaud"]);
    expect(d.route.at(-1)!.to.id).toBe("los-detectives-salvajes");
    expect(d.route[0].edge.id).toBe("rimbaud-beat");
  });

  it("si no es una recomendación, el camino más corto desde una pista", () => {
    const d = connectionDetail(MOCK_GRAPH, "on-the-road")!;
    expect(d.route).toEqual([]); // es una pista: no hay camino que recorrer
    const n = connectionDetail({ ...MOCK_GRAPH, recommendations: MOCK_GRAPH.recommendations.filter((r) => r.nodeId !== "rayuela") }, "rayuela")!;
    expect(n.route.map((s) => s.to.id)).toEqual(["charlie-parker", "rayuela"]);
  });
});
