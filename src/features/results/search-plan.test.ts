import { describe, expect, it } from "vitest";
import { FIELD, ORIGIN, SLOT, landingPoint, planSearch } from "./search-plan";

describe("planSearch", () => {
  it("es determinista por semilla y cambia entre ciclos", () => {
    expect(planSearch("affinity", 1)).toEqual(planSearch("affinity", 1));
    expect(planSearch("affinity", 1).candidates).not.toEqual(planSearch("affinity", 2).candidates);
  });

  it("sigue el guion de cada carril y termina siempre en el libro", () => {
    expect(planSearch("affinity", 3).steps.map((s) => s.kind)).toEqual(["reject", "reject", "land"]);
    expect(planSearch("alternative", 3).steps.map((s) => s.kind)).toEqual(["reject", "hop", "reject", "land"]);
    expect(planSearch("beyond", 3).steps.map((s) => s.kind)).toEqual(["reject", "reject", "hop", "land"]);
    for (const lane of ["affinity", "alternative", "beyond"] as const) {
      for (let seed = 0; seed < 10; seed++) {
        // La llegada termina sobre el borde del lugar del libro.
        const [x, y] = planSearch(lane, seed).steps.at(-1)!.d.split(" ").slice(-2).map(Number);
        const onTop = y === SLOT.y && x >= SLOT.x && x <= SLOT.x + SLOT.w;
        const onSide = (x === SLOT.x || x === SLOT.x + SLOT.w) && y >= SLOT.y && y <= SLOT.y + SLOT.h;
        expect(onTop || onSide).toBe(true);
      }
    }
  });

  it("no pone candidatos sobre las pistas ni sobre el lugar del libro", () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const p of planSearch("alternative", seed).candidates) {
        expect(Math.hypot(p.x - ORIGIN.x, p.y - ORIGIN.y)).toBeGreaterThanOrEqual(26);
        expect(p.x > SLOT.x - 10 && p.x < SLOT.x + SLOT.w + 10 && p.y > SLOT.y - 14).toBe(false);
      }
    }
  });

  it("en «fuera de tu mapa» la escala está del otro lado del borde", () => {
    for (let seed = 0; seed < 20; seed++) {
      const plan = planSearch("beyond", seed);
      const hop = plan.steps.find((s) => s.kind === "hop")!;
      expect(plan.candidates[hop.target].x).toBeGreaterThan(FIELD.edgeX);
    }
  });

  it("los tiempos avanzan: cada intento dibuja, evalúa y se borra en orden", () => {
    const plan = planSearch("beyond", 5);
    for (const step of plan.steps) {
      expect(step.draw[0]).toBeLessThan(step.draw[1]);
      expect(step.draw[1]).toBeLessThanOrEqual(step.hold[1]);
      expect(step.erase[0]).toBeGreaterThanOrEqual(step.hold[1]);
    }
    expect(plan.total).toBeGreaterThan(Math.max(...plan.steps.map((s) => s.erase[1])));
    expect(plan.land).toBe(plan.steps.at(-1)!.draw[1]);
  });

  it("entra por arriba si viene de arriba y por el costado si viene de abajo", () => {
    expect(landingPoint({ x: 30, y: 40 }).point).toEqual({ x: SLOT.x + SLOT.w / 2, y: SLOT.y });
    expect(landingPoint({ x: 30, y: 160 }).point).toEqual({ x: SLOT.x, y: 160 });
    expect(landingPoint({ x: 180, y: 150 }).point).toEqual({ x: SLOT.x + SLOT.w, y: 150 });
  });
});
