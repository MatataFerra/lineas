import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode } from "@/lib/graph/schema";
import { fixDirections, prune, unifyBooks } from "./curate";
import type { Rincon } from "./rincon";

const era = { from: 1957, label: "1957" };
const node = (id: string, kind: GraphNode["kind"] = "book", extra: Partial<GraphNode> = {}): GraphNode => ({ id, kind, label: id, era, isClue: false, ...extra });
const edge = (source: string, target: string, type: GraphEdge["type"] = "belongs_to"): GraphEdge => ({ id: `${source}--${type}--${target}`, source, target, type, confidence: "scholarly", summary: "s", explanation: "e" });
const rincon = (slug: string, nodes: GraphNode[], edges: GraphEdge[]): Rincon => ({ slug, title: slug, group: "tema", intro: "x".repeat(40), centerId: slug, nodes: [node(slug, "concept"), ...nodes], edges });

describe("prune", () => {
  it("quita lo pedido y lo que queda suelto, nunca el centro", () => {
    const r = rincon("beat", [node("a"), node("b"), node("kerouac", "person")], [edge("a", "beat"), edge("kerouac", "b", "authored")]);
    const out = prune(r, ["b", "beat"]);
    expect(out.nodes.map((n) => n.id)).toEqual(["beat", "a"]);
    expect(out.edges.map((e) => e.id)).toEqual(["a--belongs_to--beat"]);
  });
});

describe("fixDirections", () => {
  it("da vuelta un belongs_to que sale del centro", () => {
    const r = rincon("beat", [node("a")], [edge("beat", "a")]);
    expect(fixDirections(r).edges[0]).toMatchObject({ id: "a--belongs_to--beat", source: "a", target: "beat" });
  });
});

describe("unifyBooks", () => {
  it("el mismo libro con otro nombre toma el id del primero", () => {
    const camino = node("en-el-camino", "book", { label: "En el camino", originalTitle: "On the Road", book: { author: "Jack Kerouac", verified: true } });
    const ruta = node("en-la-ruta", "book", { label: "En la ruta", originalTitle: "On the Road", book: { author: "Jack Kerouac", verified: true } });
    const [beat, viaje] = unifyBooks([rincon("beat", [camino], [edge("en-el-camino", "beat")]), rincon("viaje", [ruta], [edge("en-la-ruta", "viaje")])]);
    expect(beat.nodes[1].id).toBe("en-el-camino");
    expect(viaje.nodes[1]).toMatchObject({ id: "en-el-camino", label: "En el camino" });
    expect(viaje.edges[0]).toMatchObject({ id: "en-el-camino--belongs_to--viaje", source: "en-el-camino" });
  });

  it("también reconoce el registro de catálogo", () => {
    const a = node("mrs-dalloway", "book", { label: "Mrs. Dalloway", book: { author: "Virginia Woolf", verified: true, openLibraryKey: "/works/OL1W" } });
    const b = node("la-senora-dalloway", "book", { label: "La señora Dalloway", book: { author: "Virginia Woolf", verified: true, openLibraryKey: "/works/OL1W" } });
    const [, second] = unifyBooks([rincon("ny", [a], [edge("mrs-dalloway", "ny")]), rincon("mod", [b], [edge("la-senora-dalloway", "mod")])]);
    expect(second.nodes[1].id).toBe("mrs-dalloway");
  });
});
