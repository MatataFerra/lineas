import type { Lane } from "@/lib/graph/schema";

/**
 * El guion de un ciclo de búsqueda de un carril: qué candidatos hay en el
 * campo, cuáles prueba la pluma, cuáles descarta, dónde hace escala y cuándo
 * llega al lugar del libro. Es puro y con semilla: cada ciclo es distinto,
 * pero el mismo (lane, seed) da siempre el mismo guion.
 *
 * Tiempos en milisegundos desde el inicio del ciclo.
 */
export interface Point {
  x: number;
  y: number;
}

export type StepKind = "reject" | "hop" | "land";

export interface Step {
  kind: StepKind;
  d: string;
  /** Índice del candidato probado; -1 para el lugar del libro. */
  target: number;
  draw: [number, number];
  /** La lente evalúa el candidato. */
  hold: [number, number];
  /** Los descartes se borran enseguida; escalas y llegada, al final del ciclo. */
  erase: [number, number];
}

export interface Plan {
  candidates: Point[];
  steps: Step[];
  /** Cuándo la tinta llega al libro. */
  land: number;
  total: number;
}

export const FIELD = { width: 200, height: 220, edgeX: 152 } as const;
export const ORIGIN: Point = { x: 34, y: 36 };
export const SLOT = { x: 62, y: 100, w: 76, h: 108 } as const;
const SLOT_ENTRY: Point = { x: SLOT.x + SLOT.w / 2, y: SLOT.y };

const SCRIPTS: Record<Lane, StepKind[]> = {
  affinity: ["reject", "reject", "land"],
  alternative: ["reject", "hop", "reject", "land"],
  beyond: ["reject", "reject", "hop", "land"],
};

const HOLD = 260;
const ERASE = 320;
const LAND_GLOW = 900;
const FINAL_ERASE = 520;
const REST = 260;

/** PRNG chico y determinista (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function planSearch(lane: Lane, seed: number): Plan {
  const random = rng(seed * 7919 + lane.length * 104729);
  const candidates = scatter(random, lane === "beyond");
  const script = SCRIPTS[lane];
  const steps: Step[] = [];
  const used = new Set<number>();
  let anchor = ORIGIN;
  let t = 220;

  script.forEach((kind, i) => {
    let target = -1;
    let to = SLOT_ENTRY;
    if (kind !== "land") {
      // En «fuera de tu mapa», el segundo descarte y la escala están del otro lado del borde.
      const outside = lane === "beyond" && i >= 1;
      target = pick(candidates, used, random, anchor, outside);
      used.add(target);
      to = candidates[target];
    }
    const d = kind === "land" ? landingCurve(anchor) : curve(anchor, to, random);
    const length = Math.hypot(to.x - anchor.x, to.y - anchor.y) * 1.15;
    const drawTime = clamp(length * 5.2, 300, 720);
    const draw: [number, number] = [t, t + drawTime];
    const hold: [number, number] = [draw[1], draw[1] + (kind === "land" ? 0 : HOLD)];
    const erase: [number, number] = kind === "reject" ? [hold[1], hold[1] + ERASE] : [0, 0];
    steps.push({ kind, d, target, draw, hold, erase });
    if (kind === "hop") anchor = to;
    // El próximo intento sale mientras el descarte todavía se borra: la búsqueda no se detiene.
    t = kind === "reject" ? hold[1] + 60 : hold[1] + 40;
  });

  const land = steps[steps.length - 1].draw[1];
  // Lo que quedó (escalas y llegada) se borra en orden, desde las pistas hacia el libro.
  const kept = steps.filter((s) => s.kind !== "reject");
  kept.forEach((step, k) => {
    const start = land + LAND_GLOW + k * 140;
    step.erase = [start, start + FINAL_ERASE];
  });
  const total = Math.max(...steps.map((s) => s.erase[1])) + REST;
  return { candidates, steps, land, total };
}

/** Candidatos dispersos en el campo, lejos de las pistas y del lugar del libro. */
function scatter(random: () => number, beyond: boolean): Point[] {
  const points: Point[] = [];
  const tries = 400;
  const wanted = beyond ? 16 : 13;
  for (let k = 0; k < tries && points.length < wanted; k++) {
    const outside = beyond && points.length >= wanted - 5;
    const p = {
      x: Math.round(outside ? FIELD.edgeX + 10 + random() * 34 : 14 + random() * (FIELD.edgeX - 26)),
      y: Math.round(18 + random() * 186),
    };
    const nearOrigin = Math.hypot(p.x - ORIGIN.x, p.y - ORIGIN.y) < 26;
    const inSlot = p.x > SLOT.x - 10 && p.x < SLOT.x + SLOT.w + 10 && p.y > SLOT.y - 14;
    const crowded = points.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 20);
    if (!nearOrigin && !inSlot && !crowded) points.push(p);
  }
  return points;
}

function pick(candidates: Point[], used: Set<number>, random: () => number, from: Point, outside: boolean): number {
  const pool = candidates
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => !used.has(i) && (outside ? p.x > FIELD.edgeX : p.x < FIELD.edgeX) && Math.hypot(p.x - from.x, p.y - from.y) > 30);
  const options = pool.length ? pool : candidates.map((p, i) => ({ p, i })).filter(({ i }) => !used.has(i));
  return options[Math.floor(random() * options.length)].i;
}

/** Una curva con un poco de comba hacia un lado al azar: ningún intento es una recta. */
function curve(a: Point, b: Point, random: () => number): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const bend = (random() < 0.5 ? -1 : 1) * (0.18 + random() * 0.22) * len;
  const qx = mx + (-(b.y - a.y) / len) * bend;
  const qy = my + ((b.x - a.x) / len) * bend;
  return `M${a.x} ${a.y} Q${r(qx)} ${r(qy)} ${b.x} ${b.y}`;
}

/**
 * La llegada entra al lugar del libro por el borde más cercano: desde arriba
 * si viene de arriba, si no por el costado. Así nunca hace un rulo para entrar.
 */
export function landingPoint(a: Point): { point: Point; normal: Point } {
  if (a.y < SLOT.y - 8) return { point: SLOT_ENTRY, normal: { x: 0, y: -1 } };
  const left = a.x < SLOT.x + SLOT.w / 2;
  const y = clamp(a.y, SLOT.y + 18, SLOT.y + SLOT.h - 18);
  return { point: { x: left ? SLOT.x : SLOT.x + SLOT.w, y }, normal: { x: left ? -1 : 1, y: 0 } };
}

function landingCurve(a: Point): string {
  const { point, normal } = landingPoint(a);
  const reach = Math.max(24, Math.hypot(point.x - a.x, point.y - a.y) * 0.45);
  return `M${a.x} ${a.y} C${r(a.x + (point.x - a.x) * 0.35)} ${r(a.y + (point.y - a.y) * 0.1)}, ${r(point.x + normal.x * reach)} ${r(point.y + normal.y * reach)}, ${point.x} ${point.y}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r = (v: number) => Math.round(v * 10) / 10;
