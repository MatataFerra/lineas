import type { Lane } from "@/lib/graph/schema";

/**
 * El viento de la espera: un campo de corrientes por el que derivan cientos de
 * trazos. Cada carril tiene su temperamento:
 *
 * - affinity: corrientes mansas que se recogen hacia el centro.
 * - alternative: remolinos que desvían el rumbo.
 * - beyond: un viento que escapa por el borde y vuelve a entrar del otro lado.
 *
 * Cuando llega el libro, cada trazo viaja a un punto de la tapa y las
 * corrientes se condensan en su forma. Todo puro: la pintura vive en lane-drift.
 */
export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** El bloque de la tapa en la card del resultado: margen de arriba, tapa grande (150 × 220) y margen de abajo. */
export const FIELD_HEIGHT = 262;
const COVER = { top: 22, w: 150, h: 220 } as const;

/** Dónde va a estar la tapa en un campo de este ancho (centrada, como en la card). */
export function coverRect(width: number): Rect {
  return { x: (width - COVER.w) / 2, y: COVER.top, w: COVER.w, h: COVER.h };
}

interface Temper {
  /** Píxeles por segundo. */
  speed: number;
  /** Cuánto pesa la turbulencia frente al rumbo propio del carril (0–1). */
  wander: number;
}

const TEMPER: Record<Lane, Temper> = {
  affinity: { speed: 44, wander: 0.6 },
  alternative: { speed: 52, wander: 0.55 },
  beyond: { speed: 68, wander: 0.45 },
};

export const speedOf = (lane: Lane) => TEMPER[lane].speed;

/** La turbulencia: senos superpuestos que cambian despacio con el tiempo. */
function turbulence(x: number, y: number, t: number): number {
  return Math.sin(x * 0.013 + t * 0.35) * 1.4 + Math.cos(y * 0.017 - t * 0.27) * 1.2 + Math.sin((x + y) * 0.007 + t * 0.2);
}

/** El rumbo propio de cada carril en un punto del campo, en radianes. */
function heading(lane: Lane, x: number, y: number, t: number, width: number, height: number): number {
  const cx = width / 2;
  const cy = height / 2;
  if (lane === "affinity") return Math.atan2(cy - y, cx - x);
  if (lane === "beyond") return Math.sin(y * 0.02 + t * 0.4) * 0.5;
  // Dos remolinos que giran en sentidos opuestos; manda el más cercano.
  const a = { x: width * 0.3, y: height * 0.35 };
  const b = { x: width * 0.7, y: height * 0.68 };
  const near = Math.hypot(x - a.x, y - a.y) < Math.hypot(x - b.x, y - b.y) ? { ...a, spin: 1 } : { ...b, spin: -1 };
  return Math.atan2(y - near.y, x - near.x) + (near.spin * Math.PI) / 2;
}

/** Hacia dónde sopla el viento en (x, y) en el segundo t. */
export function flowAngle(lane: Lane, x: number, y: number, t: number, width: number, height: number): number {
  const { wander } = TEMPER[lane];
  return blendAngles(heading(lane, x, y, t, width, height), turbulence(x, y, t) * (Math.PI / 2), wander);
}

/** Mezcla dos ángulos por el camino corto: w = 0 da el primero, w = 1 el segundo. */
export function blendAngles(a: number, b: number, w: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * w;
}

/** Dónde nace (o renace) un trazo. En «fuera de tu mapa» entra por la izquierda; en afinidad, desde los bordes. */
export function spawn(lane: Lane, random: () => number, width: number, height: number): Point {
  if (lane === "beyond") return { x: random() * width * 0.4, y: random() * height };
  if (lane === "affinity") {
    const edge = Math.floor(random() * 4);
    const along = random();
    if (edge === 0) return { x: along * width, y: random() * 18 };
    if (edge === 1) return { x: along * width, y: height - random() * 18 };
    if (edge === 2) return { x: random() * 24, y: along * height };
    return { x: width - random() * 24, y: along * height };
  }
  return { x: random() * width, y: random() * height };
}

/** Si un trazo ya cumplió su recorrido: se fue del campo o llegó al centro (afinidad). */
export function isSpent(lane: Lane, p: Point, width: number, height: number): boolean {
  const out = p.x < -12 || p.x > width + 12 || p.y < -12 || p.y > height + 12;
  if (lane === "affinity") return out || Math.hypot(p.x - width / 2, p.y - height / 2) < 16;
  return out;
}

/**
 * Un punto al azar sobre el contorno de la tapa: al condensarse, los trazos
 * dibujan la silueta del libro y la tapa aparece justo encima.
 */
export function landingTarget(random: () => number, rect: Rect): Point {
  const perimeter = 2 * (rect.w + rect.h);
  let d = random() * perimeter;
  if (d < rect.w) return { x: rect.x + d, y: rect.y };
  d -= rect.w;
  if (d < rect.h) return { x: rect.x + rect.w, y: rect.y + d };
  d -= rect.h;
  if (d < rect.w) return { x: rect.x + rect.w - d, y: rect.y + rect.h };
  d -= rect.w;
  return { x: rect.x, y: rect.y + rect.h - d };
}

/** Cuántos trazos para un campo de este tamaño. */
export function particleCount(width: number, height: number): number {
  return Math.round(Math.min(260, Math.max(110, (width * height) / 450)));
}

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
