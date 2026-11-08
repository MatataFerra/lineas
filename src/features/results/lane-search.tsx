"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Lane } from "@/lib/graph/schema";
import { useMediaQuery } from "@/lib/use-media-query";
import { FIELD, ORIGIN, SLOT, planSearch, type Plan } from "./search-plan";

/**
 * La espera de un carril como una búsqueda: en el campo hay candidatos que
 * titilan; la pluma sale de tus pistas, prueba uno, lo evalúa bajo una lente
 * y lo descarta (la tinta se retrae, queda el lápiz y el punto hueco) o hace
 * escala en él. Al encontrar el libro baja a su lugar, que se enciende; todo
 * se borra y la búsqueda recomienza con otros candidatos.
 *
 * El guion de cada ciclo sale de planSearch; acá solo se dibuja. El cuadro a
 * cuadro escribe directo en el SVG (sin re-render por frame).
 */
export function LaneSearch({ lane }: { lane: Lane }) {
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [cycle, setCycle] = useState(0);
  const plan = useMemo(() => planSearch(lane, cycle), [lane, cycle]);
  const filterId = `pencil-${useId().replace(/:/g, "")}`;

  const ink = useRef<(SVGPathElement | null)[]>([]);
  const pencil = useRef<(SVGPathElement | null)[]>([]);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const rings = useRef<(SVGCircleElement | null)[]>([]);
  const nib = useRef<SVGCircleElement>(null);
  const lens = useRef<SVGCircleElement>(null);
  const slot = useRef<SVGRectElement>(null);

  useLayoutEffect(() => {
    const lengths = plan.steps.map((_, i) => ink.current[i]?.getTotalLength() ?? 0);
    plan.steps.forEach((_, i) => {
      for (const el of [ink.current[i], pencil.current[i]]) el?.setAttribute("stroke-dasharray", `${lengths[i]} ${lengths[i] + 1}`);
    });

    if (still) {
      paint(plan, plan.land + 1, lengths, { ink: ink.current, pencil: pencil.current, dots: dots.current, rings: rings.current, nib: nib.current, lens: lens.current, slot: slot.current });
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = now - start;
      if (t >= plan.total) {
        setCycle((c) => c + 1);
        return;
      }
      paint(plan, t, lengths, { ink: ink.current, pencil: pencil.current, dots: dots.current, rings: rings.current, nib: nib.current, lens: lens.current, slot: slot.current });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [plan, still]);

  return (
    <svg viewBox={`0 0 ${FIELD.width} ${FIELD.height}`} aria-hidden="true" className="mx-auto mt-4 h-60 w-full max-w-60 overflow-visible">
      <defs>
        <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed={cycle % 7} />
          <feDisplacementMap in="SourceGraphic" scale="3" />
        </filter>
      </defs>

      {lane === "beyond" && (
        <g>
          <line x1={FIELD.edgeX} y1="6" x2={FIELD.edgeX} y2="214" stroke="var(--line)" strokeWidth="1" strokeDasharray="1 5" strokeLinecap="round" />
          <text x={FIELD.edgeX - 4} y="12" textAnchor="end" className="fill-muted font-serif text-[9px] italic">
            tu mapa
          </text>
        </g>
      )}

      <rect ref={slot} x={SLOT.x} y={SLOT.y} width={SLOT.w} height={SLOT.h} rx="3" fill="var(--accent)" fillOpacity="0" stroke="var(--edge)" strokeOpacity="0.5" strokeWidth="1.1" strokeDasharray="4 4" />

      {/* El campo: libros posibles que titilan. */}
      {plan.candidates.map((p, i) => (
        <g key={`${cycle}-${i}`}>
          <circle ref={(el) => void (rings.current[i] = el)} cx={p.x} cy={p.y} r="3" fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0" />
          <circle
            ref={(el) => void (dots.current[i] = el)}
            cx={p.x}
            cy={p.y}
            r="1.6"
            fill="var(--edge)"
            className="animate-soft-pulse"
            style={{ animationDelay: `${-((i * 337) % 1400)}ms` }}
          />
        </g>
      ))}

      {plan.steps.map((step, i) => (
        <g key={`${cycle}-s${i}`}>
          <path ref={(el) => void (pencil.current[i] = el)} d={step.d} fill="none" stroke="var(--edge)" strokeWidth="0.9" strokeLinecap="round" filter={`url(#${filterId})`} transform="translate(1.3 1.1)" opacity="0" />
          <path ref={(el) => void (ink.current[i] = el)} d={step.d} fill="none" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" strokeDashoffset="9999" />
        </g>
      ))}

      {/* La lente que evalúa cada candidato, y la punta de la pluma. */}
      <circle ref={lens} r="9" fill="none" stroke="var(--ink)" strokeWidth="0.8" strokeDasharray="2 3" opacity="0" className="animate-orbit-fast [transform-box:fill-box] [transform-origin:center]" />
      <circle ref={nib} r="2.6" fill="var(--accent)" opacity="0" />

      {/* Tus pistas. */}
      <circle cx={ORIGIN.x} cy={ORIGIN.y} r="4.5" fill="var(--ink)" />
      <circle cx={ORIGIN.x - 11} cy={ORIGIN.y - 6} r="2" fill="var(--ink)" opacity="0.55" />
      <circle cx={ORIGIN.x - 6} cy={ORIGIN.y + 9} r="1.6" fill="var(--ink)" opacity="0.35" />
    </svg>
  );
}

interface Elements {
  ink: (SVGPathElement | null)[];
  pencil: (SVGPathElement | null)[];
  dots: (SVGCircleElement | null)[];
  rings: (SVGCircleElement | null)[];
  nib: SVGCircleElement | null;
  lens: SVGCircleElement | null;
  slot: SVGRectElement | null;
}

const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const progress = (t: number, [a, b]: [number, number]) => (b <= a ? (t >= a ? 1 : 0) : Math.min(1, Math.max(0, (t - a) / (b - a))));
const PENCIL_FADE = 1100;

/** Un cuadro de la búsqueda en el instante t. */
function paint(plan: Plan, t: number, lengths: number[], el: Elements) {
  let nibAt: DOMPoint | null = null;
  let lensAt: { x: number; y: number } | null = null;
  const probed = new Map<number, "probing" | "rejected" | "kept" | "gone">();

  plan.steps.forEach((step, i) => {
    const path = el.ink[i];
    const L = lengths[i];
    if (!path) return;
    const drawn = ease(progress(t, step.draw));
    const erasing = step.erase[1] > 0 ? ease(progress(t, step.erase)) : 0;
    // Dibujar: de L a 0. Borrar desde la cola: de 0 a -L.
    path.setAttribute("stroke-dashoffset", String(t < step.draw[0] ? L : erasing > 0 ? -L * erasing : L * (1 - drawn)));

    const pencil = el.pencil[i];
    if (pencil) {
      pencil.setAttribute("stroke-dashoffset", String(L * (1 - drawn)));
      const fade = step.erase[1] > 0 && t > step.erase[0] ? 1 - Math.min(1, (t - step.erase[0]) / PENCIL_FADE) : 1;
      pencil.setAttribute("opacity", String(t < step.draw[0] ? 0 : 0.5 * fade));
    }

    if (t >= step.draw[0] && t < step.draw[1]) nibAt = path.getPointAtLength(L * drawn);
    if (step.target >= 0) {
      if (t >= step.hold[0] && t < step.hold[1]) {
        lensAt = plan.candidates[step.target];
        probed.set(step.target, "probing");
      } else if (t >= step.hold[1]) {
        const gone = step.kind !== "reject" && step.erase[1] > 0 && t >= step.erase[1];
        probed.set(step.target, step.kind === "reject" ? "rejected" : gone ? "gone" : "kept");
      }
    }
  });

  plan.candidates.forEach((_, c) => {
    const dot = el.dots[c];
    const ring = el.rings[c];
    const state = probed.get(c);
    if (dot) {
      dot.setAttribute("r", state === "probing" || state === "kept" ? "3" : state === "rejected" ? "2.2" : "1.6");
      dot.setAttribute("fill", state === "probing" || state === "kept" ? "var(--accent)" : state === "rejected" ? "none" : "var(--edge)");
      dot.setAttribute("stroke", state === "rejected" ? "var(--edge)" : "none");
    }
    if (ring) {
      const step = plan.steps.find((s) => s.target === c);
      const p = step ? progress(t, step.hold) : 0;
      ring.setAttribute("r", String(3 + 9 * p));
      ring.setAttribute("opacity", String(p > 0 && p < 1 ? 0.7 * (1 - p) : 0));
    }
  });

  const nibPoint = nibAt as DOMPoint | null;
  if (el.nib) {
    el.nib.setAttribute("opacity", nibPoint ? "1" : "0");
    if (nibPoint) {
      el.nib.setAttribute("cx", String(nibPoint.x));
      el.nib.setAttribute("cy", String(nibPoint.y));
    }
  }
  const lensPoint = lensAt as { x: number; y: number } | null;
  if (el.lens) {
    el.lens.setAttribute("opacity", lensPoint ? "0.7" : "0");
    if (lensPoint) {
      el.lens.setAttribute("cx", String(lensPoint.x));
      el.lens.setAttribute("cy", String(lensPoint.y));
    }
  }

  if (el.slot) {
    // El lugar del libro se enciende al llegar y se apaga despacio.
    const glow = t >= plan.land ? Math.max(0, 1 - (t - plan.land) / 1400) : 0;
    el.slot.setAttribute("stroke-opacity", String(0.5 + 0.5 * glow));
    el.slot.setAttribute("fill-opacity", String(0.07 * glow));
    el.slot.setAttribute("stroke", glow > 0 ? "var(--accent)" : "var(--edge)");
  }
}
