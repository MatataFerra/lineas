import { describe, expect, it } from "vitest";
import { FIELD_HEIGHT, blendAngles, coverRect, flowAngle, isSpent, landingTarget, particleCount, rng, spawn } from "./flow-field";

const W = 326;

describe("coverRect", () => {
  it("es la tapa grande centrada, debajo del margen de arriba", () => {
    expect(coverRect(W)).toEqual({ x: 88, y: 22, w: 150, h: 220 });
    const r = coverRect(W);
    expect(r.y + r.h).toBeLessThanOrEqual(FIELD_HEIGHT);
  });
});

describe("flowAngle", () => {
  it("es determinista y siempre un número", () => {
    for (const lane of ["affinity", "alternative", "beyond"] as const) {
      for (let i = 0; i < 50; i++) {
        const a = flowAngle(lane, i * 7, i * 5, i * 0.3, W, FIELD_HEIGHT);
        expect(Number.isFinite(a)).toBe(true);
        expect(a).toBe(flowAngle(lane, i * 7, i * 5, i * 0.3, W, FIELD_HEIGHT));
      }
    }
  });

  it("en «fuera de tu mapa» el viento empuja hacia la derecha", () => {
    let right = 0;
    for (let i = 0; i < 200; i++) right += Math.cos(flowAngle("beyond", (i * 37) % W, (i * 53) % FIELD_HEIGHT, i * 0.1, W, FIELD_HEIGHT));
    expect(right / 200).toBeGreaterThan(0.3);
  });

  it("en afinidad las corrientes se recogen hacia el centro", () => {
    let inward = 0;
    for (let i = 0; i < 200; i++) {
      const x = (i * 37) % W;
      const y = (i * 53) % FIELD_HEIGHT;
      const a = flowAngle("affinity", x, y, i * 0.1, W, FIELD_HEIGHT);
      inward += Math.cos(a) * (W / 2 - x) + Math.sin(a) * (FIELD_HEIGHT / 2 - y) > 0 ? 1 : 0;
    }
    expect(inward / 200).toBeGreaterThan(0.6);
  });
});

describe("blendAngles", () => {
  it("mezcla por el camino corto", () => {
    expect(blendAngles(0, Math.PI / 2, 0)).toBe(0);
    expect(blendAngles(0, Math.PI / 2, 1)).toBeCloseTo(Math.PI / 2);
    // De casi 2π a casi 0 no da la vuelta larga.
    expect(Math.abs(blendAngles(6.2, 0.1, 0.5) - 6.2)).toBeLessThan(0.2);
  });
});

describe("spawn, isSpent y landingTarget", () => {
  it("nace dentro del campo; en «fuera de tu mapa», del lado izquierdo", () => {
    const random = rng(4);
    for (const lane of ["affinity", "alternative", "beyond"] as const) {
      for (let i = 0; i < 100; i++) {
        const p = spawn(lane, random, W, FIELD_HEIGHT);
        expect(isSpent(lane, p, W, FIELD_HEIGHT) && lane !== "affinity").toBe(false);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(W);
        if (lane === "beyond") expect(p.x).toBeLessThanOrEqual(W * 0.4);
      }
    }
  });

  it("se agota al salir del campo, y en afinidad también al llegar al centro", () => {
    expect(isSpent("beyond", { x: W + 20, y: 10 }, W, FIELD_HEIGHT)).toBe(true);
    expect(isSpent("affinity", { x: W / 2, y: FIELD_HEIGHT / 2 }, W, FIELD_HEIGHT)).toBe(true);
    expect(isSpent("alternative", { x: W / 2, y: FIELD_HEIGHT / 2 }, W, FIELD_HEIGHT)).toBe(false);
  });

  it("la llegada condensa los trazos sobre el contorno de la tapa", () => {
    const random = rng(9);
    const rect = coverRect(W);
    const sides = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const p = landingTarget(random, rect);
      const left = Math.abs(p.x - rect.x) < 1e-6;
      const right = Math.abs(p.x - (rect.x + rect.w)) < 1e-6;
      const top = Math.abs(p.y - rect.y) < 1e-6;
      const bottom = Math.abs(p.y - (rect.y + rect.h)) < 1e-6;
      expect(left || right || top || bottom).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(rect.x - 1e-6);
      expect(p.x).toBeLessThanOrEqual(rect.x + rect.w + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(rect.y - 1e-6);
      expect(p.y).toBeLessThanOrEqual(rect.y + rect.h + 1e-6);
      if (left) sides.add("left");
      if (right) sides.add("right");
      if (top) sides.add("top");
      if (bottom) sides.add("bottom");
    }
    expect(sides.size).toBe(4);
  });

  it("la cantidad de trazos escala con el campo, con piso y techo", () => {
    expect(particleCount(W, FIELD_HEIGHT)).toBe(190);
    expect(particleCount(100, 100)).toBe(110);
    expect(particleCount(2000, 2000)).toBe(260);
  });
});
