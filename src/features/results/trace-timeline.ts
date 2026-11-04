/**
 * La espera de un carril como una pluma: cada trazo se dibuja, se queda un
 * instante y se borra desde la cola. Los tiempos son fracciones del ciclo
 * (0–1); de acá salen los `values` y `keyTimes` de las animaciones SMIL, así
 * la tinta, la punta y el rastro de lápiz quedan sincronizados.
 */
export interface Stroke {
  d: string;
  /** Cuándo se dibuja y cuándo se borra, como fracción del ciclo. */
  draw: [number, number];
  erase: [number, number];
}

export interface StrokeTimeline {
  ink: { values: string; keyTimes: string };
  nibPoints: { keyPoints: string; keyTimes: string };
  nibOpacity: { values: string; keyTimes: string };
  pencil: { offset: { values: string; keyTimes: string }; opacity: { values: string; keyTimes: string } };
}

const EPS = 0.005;
const t = (n: number) => String(Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000);
const join = (xs: (string | number)[]) => xs.join(";");

export function strokeTimeline({ draw: [s, e], erase: [es, ee] }: Stroke): StrokeTimeline {
  const start = Math.max(s, EPS);
  const end = Math.min(ee, 1 - EPS);
  return {
    // pathLength = 100 y dasharray 100: 100 → 0 dibuja, 0 → -100 borra desde la cola.
    ink: { values: join([100, 100, 0, 0, -100, -100]), keyTimes: join(["0", t(start), t(e), t(es), t(end), "1"]) },
    nibPoints: { keyPoints: join([0, 0, 1, 1]), keyTimes: join(["0", t(start), t(e), "1"]) },
    nibOpacity: { values: join([0, 0, 1, 1, 0, 0]), keyTimes: join(["0", t(start - EPS), t(start), t(e), t(e + 2 * EPS), "1"]) },
    // El lápiz acompaña a la tinta y queda cuando ella se borra; se desvanece antes del próximo ciclo.
    pencil: {
      offset: { values: join([100, 100, 0, 0]), keyTimes: join(["0", t(start), t(e), "1"]) },
      opacity: { values: join([0, 0, 0.5, 0.5, 0]), keyTimes: join(["0", t(start), t(e), t(Math.max(end, e) + 0.02), "1"]) },
    },
  };
}
