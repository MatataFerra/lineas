import { describe, expect, it } from "vitest";
import { strokeTimeline } from "./trace-timeline";

const asNumbers = (s: string) => s.split(";").map(Number);

describe("strokeTimeline", () => {
  const tl = strokeTimeline({ d: "M0 0 L10 10", draw: [0.1, 0.5], erase: [0.6, 0.9] });

  it("dibuja, sostiene y borra la tinta desde la cola", () => {
    expect(asNumbers(tl.ink.values)).toEqual([100, 100, 0, 0, -100, -100]);
    expect(asNumbers(tl.ink.keyTimes)).toEqual([0, 0.1, 0.5, 0.6, 0.9, 1]);
  });

  it("produce keyTimes que empiezan en 0, terminan en 1 y nunca retroceden", () => {
    for (const k of [tl.ink, tl.nibPoints, tl.nibOpacity, tl.pencil.offset, tl.pencil.opacity]) {
      const times = asNumbers(k.keyTimes);
      expect(times[0]).toBe(0);
      expect(times.at(-1)).toBe(1);
      times.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(times[i]));
    }
  });

  it("la punta solo se ve mientras se dibuja", () => {
    const op = asNumbers(tl.nibOpacity.values);
    const times = asNumbers(tl.nibOpacity.keyTimes);
    expect(op[times.indexOf(0.1)]).toBe(1);
    expect(op.at(-1)).toBe(0);
  });

  it("acepta trazos que arrancan en 0 o terminan en 1 sin keyTimes inválidos", () => {
    const edge = strokeTimeline({ d: "M0 0", draw: [0, 0.4], erase: [0.5, 1] });
    expect(asNumbers(edge.ink.keyTimes)).toEqual([0, 0.005, 0.4, 0.5, 0.995, 1]);
  });
});
