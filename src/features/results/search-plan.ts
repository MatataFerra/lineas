import type { Lane } from "@/lib/graph/schema";

/**
 * El guion de un ciclo de búsqueda de un carril: qué libros candidatos hay en
 * el campo, cuáles prueba la pluma, cuáles descarta y dónde hace escala. Es
 * puro y con semilla: cada ciclo es distinto, pero el mismo (lane, seed) da
 * siempre el mismo guion.
 *
 * Mientras se espera, la búsqueda nunca llega: solo prueba. La llegada al
 * lugar del libro (planLanding) se dibuja una sola vez, cuando el libro llegó
 * de verdad.
 *
 * Tiempos en milisegundos desde el inicio del ciclo.
 */
export interface Point {
  x: number;
  y: number;
}

export type StepKind = "reject" | "hop";

export interface Step {
  kind: StepKind;
  d: string;
  /** Índice del candidato probado. */
  target: number;
  draw: [number, number];
  /** La lente evalúa el candidato. */
  hold: [number, number];
  /** Los descartes se borran enseguida; las escalas, al final del ciclo. */
  erase: [number, number];
}

export interface Candidate extends Point {
  /** Inclinación del lomo, en grados. */
  tilt: number;
}

export interface Plan {
  candidates: Candidate[];
  steps: Step[];
  total: number;
}

/**
 * El campo mide lo mismo que el bloque de la tapa en la card del resultado
 * (margen de arriba, tapa grande de 150 × 220 y margen de abajo), y el lugar
 * del libro es exactamente esa tapa: el libro aparece donde se lo buscó.
 */
export const FIELD = { width: 300, height: 262, edgeX: 266 } as const;
export const SLOT = { x: 75, y: 22, w: 150, h: 220 } as const;
export const ORIGIN: Point = { x: 26, y: 26 };

const SCRIPTS: Record<Lane, StepKind[]> = {
  affinity: ["reject", "reject", "reject"],
  alternative: ["reject", "hop", "reject", "reject"],
  beyond: ["reject", "reject", "hop", "reject"],
};

const HOLD = 300;
const ERASE = 320;
const FINAL_ERASE = 480;
const REST = 360;
export const LANDING = { draw: 380, settle: 80 } as const;

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
  const steps: Step[] = [];
  const used = new Set<number>();
  let anchor = ORIGIN;
  let t = 200;

  SCRIPTS[lane].forEach((kind, i) => {
    // En «fuera de tu mapa», el segundo descarte y la escala están del otro lado del borde.
    const outside = lane === "beyond" && (i === 1 || kind === "hop");
    const target = pick(candidates, used, random, anchor, outside);
    used.add(target);
    const to = candidates[target];
    const length = Math.hypot(to.x - anchor.x, to.y - anchor.y) * 1.15;
    const draw: [number, number] = [t, t + clamp(length * 3.4, 320, 760)];
    const hold: [number, number] = [draw[1], draw[1] + HOLD];
    const erase: [number, number] = kind === "reject" ? [hold[1], hold[1] + ERASE] : [0, 0];
    steps.push({ kind, d: curve(anchor, to, random), target, draw, hold, erase });
    if (kind === "hop") anchor = to;
    // El próximo intento sale mientras el descarte todavía se borra: la búsqueda no se detiene.
    t = hold[1] + (kind === "reject" ? 60 : 40);
  });

  // Las escalas se borran juntas al cerrar el ciclo, desde las pistas hacia afuera.
  const end = steps.at(-1)!.erase[1];
  steps
    .filter((s) => s.kind === "hop")
    .forEach((step, k) => {
      step.erase = [end + k * 120, end + k * 120 + FINAL_ERASE];
    });
  const total = Math.max(...steps.map((s) => s.erase[1])) + REST;
  return { candidates, steps, total };
}

/**
 * La llegada: desde las pistas, un arco que sube y entra al lugar del libro
 * por el centro de su borde de arriba, como quien deja un libro en su hueco.
 */
export function planLanding(): { d: string; end: Point } {
  const end = { x: SLOT.x + SLOT.w / 2, y: SLOT.y };
  const d = `M${ORIGIN.x} ${ORIGIN.y} C${ORIGIN.x + 34} ${ORIGIN.y - 26}, ${end.x} ${end.y - 40}, ${end.x} ${end.y}`;
  return { d, end };
}

/** Lomos dispersos en el campo, a los costados del lugar del libro y lejos de las pistas. */
function scatter(random: () => number, beyond: boolean): Candidate[] {
  const points: Candidate[] = [];
  const wanted = beyond ? 16 : 13;
  for (let k = 0; k < 600 && points.length < wanted; k++) {
    const outside = beyond && points.length >= wanted - 4;
    const p = {
      x: Math.round(outside ? FIELD.edgeX + 8 + random() * (FIELD.width - FIELD.edgeX - 14) : 10 + random() * (FIELD.edgeX - 20)),
      y: Math.round(14 + random() * (FIELD.height - 28)),
      tilt: Math.round((random() - 0.5) * 24),
    };
    const nearOrigin = Math.hypot(p.x - ORIGIN.x, p.y - ORIGIN.y) < 26;
    const inSlot = p.x > SLOT.x - 12 && p.x < SLOT.x + SLOT.w + 12 && p.y > SLOT.y - 12;
    const crowded = points.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 22);
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

/**
 * Una curva con un poco de comba hacia un lado al azar: ningún intento es una
 * recta. Si va de un costado del hueco al otro, lo rodea por arriba: la tinta
 * nunca pasa por el lugar del libro.
 */
function curve(a: Point, b: Point, random: () => number): string {
  const side = (p: Point) => (p.x < SLOT.x ? -1 : p.x > SLOT.x + SLOT.w ? 1 : 0);
  if (side(a) * side(b) < 0) {
    const lift = SLOT.y - 14 - random() * 10;
    return `M${a.x} ${a.y} C${a.x} ${r(lift)}, ${b.x} ${r(lift)}, ${b.x} ${b.y}`;
  }
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const bend = (random() < 0.5 ? -1 : 1) * (0.18 + random() * 0.22) * len;
  const qx = mx + (-(b.y - a.y) / len) * bend;
  const qy = my + ((b.x - a.x) / len) * bend;
  return `M${a.x} ${a.y} Q${r(qx)} ${r(qy)} ${b.x} ${b.y}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r = (v: number) => Math.round(v * 10) / 10;
