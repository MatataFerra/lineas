import { yearOf } from "./queries";
import type { GraphEdge, GraphNode } from "./schema";
import { EDGE_META } from "./labels";

export interface LayoutOptions {
  width: number;
  height: number;
  nodeWidth: number;
  nodeHeight: number;
  /** Margen horizontal hasta el centro del primer y último nodo. */
  padX: number;
  /** Centro de la primera fila. */
  firstRowY: number;
  rowGap: number;
  rows: number;
  /** Separación mínima entre nodos de una misma fila. */
  minGap: number;
  /** Cuánto pesa el orden frente a la distancia real en años (0..1). */
  rankWeight: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  width: 860,
  height: 560,
  nodeWidth: 140,
  nodeHeight: 58,
  padX: 82,
  firstRowY: 52,
  rowGap: 84,
  rows: 6,
  minGap: 12,
  rankWeight: 0.65,
};

export interface Point {
  x: number;
  y: number;
}

export interface GraphLayout {
  positions: Map<string, Point>;
  ticks: { label: string; x: number }[];
  options: LayoutOptions;
}

/**
 * Ubica los nodos sobre una línea de tiempo.
 *
 * El eje X mezcla el orden de los años con su distancia real: se estira donde
 * hay muchos nodos juntos (1940–1960) y se comprime donde no hay nada
 * (1880–1920). Las filas se asignan de forma golosa, empezando por las pistas
 * en la fila central, para que no se pisen.
 */
export function layoutGraph(nodes: GraphNode[], options: LayoutOptions = DEFAULT_LAYOUT): GraphLayout {
  const scale = timeScale(nodes.map(yearOf), options);
  const positions = new Map<string, Point>();
  const rowsUsed: number[][] = Array.from({ length: options.rows }, () => []);
  const center = Math.floor((options.rows - 1) / 2);
  const minDistance = options.nodeWidth + options.minGap;

  const order = [...nodes].sort((a, b) => {
    if (a.isClue !== b.isClue) return a.isClue ? -1 : 1;
    return yearOf(a) - yearOf(b);
  });

  const minX = options.padX;
  const maxX = options.width - options.padX;
  const preferred = rowPreference(center, options.rows);

  for (const node of order) {
    const ideal = scale(yearOf(node));
    // Para cada fila, el lugar libre más cercano al año ideal. Se elige la fila
    // que menos desplaza el nodo, con una leve preferencia por el centro.
    let best = { row: preferred[0], x: ideal, score: Infinity };
    preferred.forEach((row, rank) => {
      const used = rowsUsed[row];
      const candidates = [ideal, ...used.flatMap((other) => [other - minDistance, other + minDistance])]
        .filter((x) => x >= minX && x <= maxX)
        .filter((x) => used.every((other) => Math.abs(other - x) >= minDistance - 0.5));
      for (const x of candidates) {
        const score = Math.abs(x - ideal) + rank * 14;
        if (score < best.score) best = { row, x, score };
      }
    });
    if (best.score === Infinity) {
      // No hay lugar sin superposición: la fila menos apretada, en el año ideal.
      const row = preferred.reduce((a, b) => (closest(rowsUsed[b], ideal) > closest(rowsUsed[a], ideal) ? b : a));
      best = { row, x: ideal, score: 0 };
    }
    rowsUsed[best.row].push(best.x);
    positions.set(node.id, { x: Math.round(best.x), y: options.firstRowY + best.row * options.rowGap });
  }

  return { positions, ticks: decadeTicks(nodes.map(yearOf), scale), options };
}

function rowPreference(center: number, rows: number): number[] {
  const result = [center];
  for (let d = 1; result.length < rows; d++) {
    if (center - d >= 0) result.push(center - d);
    if (center + d < rows) result.push(center + d);
  }
  return result;
}

function closest(xs: number[], x: number): number {
  return xs.reduce((min, other) => Math.min(min, Math.abs(other - x)), Infinity);
}

function timeScale(years: number[], options: LayoutOptions): (year: number) => number {
  const unique = [...new Set(years)].sort((a, b) => a - b);
  const min = unique[0];
  const max = unique[unique.length - 1];
  const span = Math.max(max - min, 1);
  const usable = options.width - options.padX * 2;
  const w = options.rankWeight;

  const rankOf = (year: number): number => {
    if (unique.length === 1) return 0.5;
    if (year <= min) return 0;
    if (year >= max) return 1;
    const i = unique.findIndex((u) => u >= year);
    const lo = unique[i - 1];
    const hi = unique[i];
    const t = hi === lo ? 0 : (year - lo) / (hi - lo);
    return (i - 1 + t) / (unique.length - 1);
  };

  return (year: number) => {
    const linear = (year - min) / span;
    return Math.round(options.padX + (w * rankOf(year) + (1 - w) * linear) * usable);
  };
}

function decadeTicks(years: number[], scale: (y: number) => number): { label: string; x: number }[] {
  const decades = [...new Set(years.map((y) => Math.floor(y / 10) * 10))].sort((a, b) => a - b);
  const ticks: { label: string; x: number }[] = [];
  for (const decade of decades) {
    const x = scale(Math.max(decade, Math.min(...years)));
    if (ticks.length === 0 || x - ticks[ticks.length - 1].x >= 64) ticks.push({ label: String(decade), x });
  }
  return ticks;
}

export interface EdgeGeometry {
  d: string;
  /** Punto medio de la curva, para el número del paso. */
  mid: Point;
}

/** Curvas cuadráticas suaves que salen del borde de cada nodo, no del centro. */
export function edgeGeometry(
  edges: GraphEdge[],
  positions: Map<string, Point>,
  options: Pick<LayoutOptions, "nodeWidth" | "nodeHeight">,
): Map<string, EdgeGeometry> {
  const result = new Map<string, EdgeGeometry>();
  const halfW = options.nodeWidth / 2;
  const halfH = options.nodeHeight / 2;

  const clip = (from: Point, toward: Point, pad: number): Point => {
    const dx = toward.x - from.x;
    const dy = toward.y - from.y;
    const kx = dx === 0 ? Infinity : (halfW + pad) / Math.abs(dx);
    const ky = dy === 0 ? Infinity : (halfH + pad) / Math.abs(dy);
    const k = Math.min(kx, ky, 0.48);
    return { x: from.x + dx * k, y: from.y + dy * k };
  };
  const r = (v: number) => Math.round(v * 10) / 10;

  edges.forEach((edge, i) => {
    const a = positions.get(edge.source);
    const b = positions.get(edge.target);
    if (!a || !b) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const bend = 0.12 * len * (i % 2 ? 1 : -1);
    const control = { x: (a.x + b.x) / 2 + (-dy / len) * bend, y: (a.y + b.y) / 2 + (dx / len) * bend };
    const p0 = clip(a, control, 3);
    const p2 = clip(b, control, EDGE_META[edge.type].arrow ? 4 : 3);
    result.set(edge.id, {
      d: `M ${r(p0.x)} ${r(p0.y)} Q ${r(control.x)} ${r(control.y)} ${r(p2.x)} ${r(p2.y)}`,
      mid: {
        x: 0.25 * p0.x + 0.5 * control.x + 0.25 * p2.x,
        y: 0.25 * p0.y + 0.5 * control.y + 0.25 * p2.y,
      },
    });
  });
  return result;
}
