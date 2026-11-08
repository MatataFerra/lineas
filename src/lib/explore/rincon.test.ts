import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode } from "@/lib/graph/schema";
import { bridges, rinconIssues, RinconSchema, summarize, type Rincon } from "./rincon";

const era = { from: 1950, label: "1950" };
const book = (id: string, verified = true): GraphNode => ({ id, kind: "book", label: id, era, isClue: false, book: { author: "Autor", verified } });
const edge = (source: string, target: string): GraphEdge => ({ id: `${source}--${target}`, source, target, type: "belongs_to", confidence: "scholarly", summary: "s", explanation: "e" });
const center: GraphNode = { id: "beat", kind: "movement", label: "Generación Beat", era, isClue: false };

function rincon(books: GraphNode[], extra: Partial<Rincon> = {}): Rincon {
  return {
    slug: "beat",
    title: "Generación Beat",
    group: "movimiento",
    intro: "Escritores que salieron a la ruta y escribieron como se habla, con jazz de fondo.",
    centerId: "beat",
    nodes: [center, ...books],
    edges: books.map((b) => edge(b.id, "beat")),
    ...extra,
  };
}

describe("rincones", () => {
  const four = ["a", "b", "c", "d"].map((id) => book(id));

  it("acepta un rincón bien formado", () => {
    expect(RinconSchema.safeParse(rincon(four)).success).toBe(true);
  });

  it("pide entre 4 y 7 libros, todos verificados y conectados", () => {
    expect(rinconIssues(rincon(four.slice(0, 3)))).toContain("Tiene 3 libros (entre 4 y 7)");
    expect(rinconIssues(rincon([...four.slice(0, 3), book("x", false)]))).toContain("x no está verificado en un catálogo");
    const loose = rincon(four, { edges: four.slice(1).map((b) => edge(b.id, "beat")) });
    expect(rinconIssues(loose)).toContain("a no tiene ninguna conexión");
  });

  it("encuentra en qué otros rincones aparece cada nodo", () => {
    const beat = rincon(four);
    const ruta = rincon([book("a"), book("e"), book("f"), book("g")], { slug: "ruta", title: "La ruta", centerId: "ruta", nodes: [{ ...center, id: "ruta" }, book("a"), book("e"), book("f"), book("g")] });
    expect(bridges(beat, [beat, ruta])).toEqual({ a: [{ slug: "ruta", title: "La ruta" }] });
  });

  it("el resumen trae hasta tres tapas", () => {
    expect(summarize(rincon(four)).covers.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
});
