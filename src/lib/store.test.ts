import { beforeEach, describe, expect, it } from "vitest";
import { MAX_CLUES } from "@/lib/graph/schema";
import { useLineas } from "./store";

describe("pistas", () => {
  beforeEach(() => useLineas.setState({ clues: [] }));

  it(`no deja sumar más de ${MAX_CLUES}`, () => {
    for (let i = 0; i < MAX_CLUES + 3; i++) useLineas.getState().addClue(`Pista ${i}`, "idea");
    expect(useLineas.getState().clues).toHaveLength(MAX_CLUES);
  });

  it("con el máximo, quitar una libera el lugar", () => {
    for (let i = 0; i < MAX_CLUES; i++) useLineas.getState().addClue(`Pista ${i}`, "idea");
    useLineas.getState().toggleClue("Pista 0", "idea");
    useLineas.getState().toggleClue("Otra", "idea");
    expect(useLineas.getState().clues.map((c) => c.label)).toContain("Otra");
  });
});
