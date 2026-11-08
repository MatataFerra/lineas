import { describe, expect, it } from "vitest";
import { contour, pathOf, segmentEnds, type Cubic } from "./trail";

const straight: Cubic[] = [
  [[0, 0], [0, 10], [0, 20], [0, 30]],
  [[0, 30], [0, 40], [0, 50], [0, 90]],
];

describe("segmentEnds", () => {
  it("da la fracción del largo en que termina cada tramo", () => {
    const [first, last] = segmentEnds(straight);
    expect(first).toBeCloseTo(30 / 90, 2);
    expect(last).toBe(1);
  });
});

describe("pathOf", () => {
  it("encadena los tramos en un solo path", () => {
    expect(pathOf(straight)).toBe("M0 0 C 0 10, 0 20, 0 30 C 0 40, 0 50, 0 90");
  });
});

describe("contour", () => {
  it("es un anillo cerrado alrededor del centro", () => {
    const d = contour(50, 50, 10, 1.2, 1);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    const xs = [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => +m[1]);
    expect(Math.min(...xs)).toBeLessThan(50);
    expect(Math.max(...xs)).toBeGreaterThan(50);
  });
});
