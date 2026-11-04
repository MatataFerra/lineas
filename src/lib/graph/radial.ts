import { yearOf } from "./queries";
import type { GraphNode } from "./schema";

/**
 * El mapa como constelación alrededor de un libro: el elegido en el centro,
 * lo que no es libro (personas, movimientos, otras artes, ideas) en un arco
 * arriba y los libros en una fila abajo. Dentro de cada grupo, de izquierda a
 * derecha según la época: el mapa conserva algo del eje del tiempo.
 */
export const RADIAL = {
  width: 900,
  height: 640,
  centerY: 270,
  focus: 128,
  card: { w: 184, h: 60 },
  book: { w: 128, h: 172 },
  /** Radio del arco de arriba (horizontal / vertical). */
  arc: { rx: 340, ry: 200 },
  bookRowY: 500,
  gap: 16,
} as const;

export interface RadialLayout {
  width: number;
  height: number;
  positions: Map<string, { x: number; y: number }>;
  sizes: Map<string, { w: number; h: number }>;
}

export function radialLayout(nodes: GraphNode[], focusId: string, visible: ReadonlySet<string>): RadialLayout {
  const positions = new Map<string, { x: number; y: number }>();
  const sizes = new Map<string, { w: number; h: number }>();
  const cx = RADIAL.width / 2;
  const shown = nodes.filter((n) => visible.has(n.id));
  const byYear = (a: GraphNode, b: GraphNode) => yearOf(a) - yearOf(b);

  positions.set(focusId, { x: cx, y: RADIAL.centerY });
  sizes.set(focusId, { w: RADIAL.focus, h: RADIAL.focus });

  // Arriba: un arco de elipse de izquierda a derecha. Con muchos nodos, dos arcos alternados.
  const upper = shown.filter((n) => n.id !== focusId && n.kind !== "book").sort(byYear);
  const twoRows = upper.length > 6;
  upper.forEach((node, i) => {
    const t = upper.length === 1 ? 0.5 : i / (upper.length - 1);
    const angle = Math.PI * (1 + 0.08 + t * 0.84); // de ~194° a ~346°: la mitad de arriba
    const inner = twoRows && i % 2 === 1;
    positions.set(node.id, {
      x: Math.round(cx + Math.cos(angle) * RADIAL.arc.rx * (inner ? 0.78 : 1)),
      y: Math.round(RADIAL.centerY + Math.sin(angle) * RADIAL.arc.ry * (inner ? 0.62 : 1)),
    });
    sizes.set(node.id, RADIAL.card);
  });

  // Abajo: los libros en fila, centrados.
  const books = shown.filter((n) => n.id !== focusId && n.kind === "book").sort(byYear);
  const step = Math.min(RADIAL.book.w + RADIAL.gap * 2, (RADIAL.width - 40) / Math.max(books.length, 1));
  const start = cx - (step * (books.length - 1)) / 2;
  books.forEach((node, i) => {
    positions.set(node.id, { x: Math.round(start + step * i), y: RADIAL.bookRowY });
    sizes.set(node.id, { w: Math.min(RADIAL.book.w, step - RADIAL.gap), h: RADIAL.book.h });
  });

  return { width: RADIAL.width, height: RADIAL.height, positions, sizes };
}

/**
 * Una curva suave entre dos nodos y su punto medio (para el número del paso).
 * Se curva alejándose del centro; si la recta cruzaría el libro elegido, la
 * curva rodea su halo por arriba o por abajo.
 */
export function radialEdge(a: { x: number; y: number }, b: { x: number; y: number }, center: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const clearance = RADIAL.focus / 2 + 36;
  const touchesCenter = (a.x === center.x && a.y === center.y) || (b.x === center.x && b.y === center.y);

  let apex: { x: number; y: number };
  if (!touchesCenter && distanceToSegment(center, a, b) < clearance) {
    // Rodea el halo del lado del punto medio (arriba si es ambiguo).
    const side = my <= center.y ? -1 : 1;
    apex = { x: mx, y: center.y + side * (clearance + 14) };
  } else {
    const dx = mx - center.x;
    const dy = my - center.y;
    const len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(22, Math.hypot(b.x - a.x, b.y - a.y) * 0.1);
    apex = { x: mx + (dx / len) * bend, y: my + (dy / len) * bend };
  }
  // Control de la cuadrática para que la curva pase por `apex` en t = 0,5.
  const qx = 2 * apex.x - mx;
  const qy = 2 * apex.y - my;
  return { d: `M${a.x} ${a.y} Q${qx} ${qy} ${b.x} ${b.y}`, mid: apex };
}

function distanceToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
