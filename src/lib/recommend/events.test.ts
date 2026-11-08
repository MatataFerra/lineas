import { describe, expect, it } from "vitest";
import { MAX_CLUES } from "@/lib/graph/schema";
import { RecommendRequestSchema } from "./events";

const clues = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, kind: "idea" as const, label: `Pista ${i}` }));

describe("RecommendRequestSchema", () => {
  it(`acepta hasta ${MAX_CLUES} pistas y rechaza más`, () => {
    expect(RecommendRequestSchema.safeParse({ clues: clues(MAX_CLUES) }).success).toBe(true);
    expect(RecommendRequestSchema.safeParse({ clues: clues(MAX_CLUES + 1) }).success).toBe(false);
  });
});
