/**
 * Geometría del mapa de la home: el sendero como tramos cúbicos, en qué
 * fracción de su largo queda cada parada (para mover al viajero con
 * offset-distance) y las curvas de nivel de las lomas. Todo puro: se calcula
 * una vez al cargar el módulo.
 */

export type Pt = [number, number];
/** Un tramo cúbico: inicio, dos controles y fin. */
export type Cubic = [Pt, Pt, Pt, Pt];

export function pathOf(segments: Cubic[]): string {
  return segments.map(([a, b, c, d], i) => `${i ? "" : `M${a[0]} ${a[1]} `}C ${b[0]} ${b[1]}, ${c[0]} ${c[1]}, ${d[0]} ${d[1]}`).join(" ");
}

function pointAt([a, b, c, d]: Cubic, t: number): Pt {
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
}

/** Largo aproximado de un tramo, sumando cuerdas cortas. */
function lengthOf(seg: Cubic, steps = 64): number {
  let total = 0;
  let prev = seg[0];
  for (let k = 1; k <= steps; k++) {
    const p = pointAt(seg, k / steps);
    total += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return total;
}

/** En qué fracción del largo total (0 a 1) termina cada tramo. */
export function segmentEnds(segments: Cubic[]): number[] {
  const lengths = segments.map((s) => lengthOf(s));
  const total = lengths.reduce((a, b) => a + b, 0);
  let acc = 0;
  return lengths.map((l) => (acc += l) / total);
}

/**
 * Una curva de nivel: un anillo cerrado que ondula apenas, como dibujado a
 * mano. `seed` cambia la ondulación para que los anillos no sean copias.
 */
export function contour(cx: number, cy: number, r: number, squash: number, seed: number): string {
  const n = 18;
  const pts: Pt[] = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.07 * Math.sin(3 * a + seed) + 0.04 * Math.sin(5 * a + seed * 1.7);
    return [cx + Math.cos(a) * r * k * squash, cy + Math.sin(a) * r * k];
  });
  // Catmull-Rom cerrado a cúbicas: pasa por todos los puntos, sin esquinas.
  const f = (v: number) => +v.toFixed(2);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${f(c1[0])} ${f(c1[1])}, ${f(c2[0])} ${f(c2[1])}, ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}
