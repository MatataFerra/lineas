import { describe, expect, it } from "vitest";
import { MOCK_GRAPH } from "./mock";
import { RADIAL, radialEdge, radialLayout } from "./radial";

const visible = new Set(MOCK_GRAPH.nodes.map((n) => n.id));

describe("radialLayout", () => {
  const layout = radialLayout(MOCK_GRAPH.nodes, "los-detectives-salvajes", visible);
  const box = (id: string) => {
    const p = layout.positions.get(id)!;
    const s = layout.sizes.get(id)!;
    return { x0: p.x - s.w / 2, x1: p.x + s.w / 2, y0: p.y - s.h / 2, y1: p.y + s.h / 2 };
  };

  it("pone el libro elegido en el centro", () => {
    const p = layout.positions.get("los-detectives-salvajes")!;
    expect(p.x).toBe(layout.width / 2);
    expect(p.y).toBe(RADIAL.centerY);
  });

  it("deja los libros abajo y lo demás arriba del centro", () => {
    for (const node of MOCK_GRAPH.nodes) {
      if (node.id === "los-detectives-salvajes") continue;
      const y = layout.positions.get(node.id)!.y;
      if (node.kind === "book") expect(y).toBeGreaterThan(RADIAL.centerY);
      else expect(y).toBeLessThan(RADIAL.centerY);
    }
  });

  it("ordena por época de izquierda a derecha dentro de cada grupo", () => {
    expect(layout.positions.get("arthur-rimbaud")!.x).toBeLessThan(layout.positions.get("charlie-parker")!.x);
    expect(layout.positions.get("siddhartha")!.x).toBeLessThan(layout.positions.get("rayuela")!.x);
  });

  it("no superpone nodos", () => {
    const ids = [...layout.positions.keys()];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = box(ids[i]);
        const b = box(ids[j]);
        const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
        expect(overlap, `${ids[i]} y ${ids[j]}`).toBe(false);
      }
    }
  });

  it("ubica solo los nodos visibles", () => {
    const few = radialLayout(MOCK_GRAPH.nodes, "rayuela", new Set(["rayuela", "on-the-road", "charlie-parker"]));
    expect([...few.positions.keys()].sort()).toEqual(["charlie-parker", "on-the-road", "rayuela"]);
  });
});

describe("radialEdge", () => {
  it("rodea el libro del centro en vez de cruzarlo", () => {
    const center = { x: 450, y: 270 };
    const { mid } = radialEdge({ x: 100, y: 250 }, { x: 800, y: 250 }, center);
    expect(Math.abs(mid.y - center.y)).toBeGreaterThan(RADIAL.focus / 2 + 30);
  });

  it("va directo cuando la arista sale del centro", () => {
    const center = { x: 450, y: 270 };
    const { mid } = radialEdge(center, { x: 450, y: 500 }, center);
    expect(Math.abs(mid.x - 450)).toBeLessThan(1);
  });
});
