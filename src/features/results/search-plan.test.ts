import { describe, expect, it } from "vitest";
import { FIELD, ORIGIN, SLOT, planLanding, planSearch } from "./search-plan";

describe("planSearch", () => {
  it("es determinista por semilla y cambia entre ciclos", () => {
    expect(planSearch("affinity", 1)).toEqual(planSearch("affinity", 1));
    expect(planSearch("affinity", 1).candidates).not.toEqual(planSearch("affinity", 2).candidates);
  });

  it("sigue el guion de cada carril y, mientras espera, nunca llega", () => {
    expect(planSearch("affinity", 3).steps.map((s) => s.kind)).toEqual(["reject", "reject", "reject"]);
    expect(planSearch("alternative", 3).steps.map((s) => s.kind)).toEqual(["reject", "hop", "reject", "reject"]);
    expect(planSearch("beyond", 3).steps.map((s) => s.kind)).toEqual(["reject", "reject", "hop", "reject"]);
    for (const lane of ["affinity", "alternative", "beyond"] as const) {
      for (let seed = 0; seed < 10; seed++) {
        for (const step of planSearch(lane, seed).steps) expect(step.target).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("no pone candidatos sobre las pistas ni sobre el lugar del libro", () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const p of planSearch("alternative", seed).candidates) {
        expect(Math.hypot(p.x - ORIGIN.x, p.y - ORIGIN.y)).toBeGreaterThanOrEqual(26);
        expect(p.x > SLOT.x - 12 && p.x < SLOT.x + SLOT.w + 12 && p.y > SLOT.y - 12).toBe(false);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(FIELD.width);
      }
    }
  });

  it("lo que cruza de un costado al otro rodea el hueco por arriba", () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const lane of ["affinity", "alternative", "beyond"] as const) {
        for (const step of planSearch(lane, seed).steps) {
          const nums = step.d.replace(/[MQC,]/g, " ").trim().split(/\s+/).map(Number);
          const [ax, , ...rest] = nums;
          const bx = rest[rest.length - 2];
          const crosses = (ax < SLOT.x && bx > SLOT.x + SLOT.w) || (bx < SLOT.x && ax > SLOT.x + SLOT.w);
          if (crosses) expect(step.d).toContain("C");
          if (crosses) expect(Math.max(...[nums[3], nums[5]])).toBeLessThan(SLOT.y);
        }
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
  });
});

describe("planLanding", () => {
  it("sale de las pistas y entra al lugar del libro por el centro de arriba", () => {
    const { d, end } = planLanding();
    expect(d.startsWith(`M${ORIGIN.x} ${ORIGIN.y}`)).toBe(true);
    const [x, y] = d.split(" ").slice(-2).map(Number);
    expect({ x, y }).toEqual(end);
    expect(end).toEqual({ x: SLOT.x + SLOT.w / 2, y: SLOT.y });
  });
});
