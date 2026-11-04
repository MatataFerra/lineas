import { describe, expect, it } from "vitest";
import { formatKnowledge, type KnownEdge } from "./knowledge";

const edge = (over: Partial<KnownEdge>): KnownEdge => ({
  source: "charlie-parker",
  target: "rayuela",
  sourceLabel: "Charlie Parker",
  targetLabel: "Rayuela",
  type: "other_arts",
  confidence: "documented",
  summary: "El jazz como idioma del Club de la Serpiente.",
  score: 3,
  ...over,
});

describe("formatKnowledge", () => {
  it("separa confirmadas y rechazadas, las mejores primero, con ids para reusarlas", () => {
    const text = formatKnowledge([
      edge({ score: 2, source: "a", sourceLabel: "A" }),
      edge({ score: 5 }),
      edge({ score: -3, source: "x", target: "y", sourceLabel: "X", targetLabel: "Y", type: "influence" }),
      edge({ score: 0, source: "neutral" }),
    ])!;
    expect(text).toContain("Conexiones confirmadas por lectores");
    expect(text.indexOf("Charlie Parker (charlie-parker)")).toBeLessThan(text.indexOf("A (a)"));
    expect(text).toContain("Conexiones que los lectores rechazaron");
    expect(text).toContain("X (x) → Y (y) · influence");
    expect(text).not.toContain("neutral");
  });

  it("sin nada relevante no agrega texto", () => {
    expect(formatKnowledge([edge({ score: 1 })])).toBeUndefined();
  });

  it("limita a 12 confirmadas", () => {
    const many = Array.from({ length: 20 }, (_, i) => edge({ source: `n${i}`, sourceLabel: `N${i}` }));
    expect(formatKnowledge(many)!.match(/^- /gm)).toHaveLength(12);
  });
});
