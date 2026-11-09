"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Lane } from "@/lib/graph/schema";
import { useMediaQuery } from "@/lib/use-media-query";
import { FIELD, LANDING, ORIGIN, SLOT, planLanding, planSearch, type Plan } from "./search-plan";

/**
 * La espera de un carril como una búsqueda en una biblioteca: a los costados
 * del hueco del libro hay lomos candidatos; la pluma sale de tus pistas, prueba
 * uno, lo evalúa bajo una lente y lo descarta (la tinta se retrae, queda el
 * lápiz y el lomo hueco) o hace escala en él. Mientras se espera, nunca llega.
 *
 * Cuando el libro llega de verdad (`landing`), la búsqueda se desvanece y un
 * solo trazo va de las pistas al hueco, que se enciende; ahí avisa `onLanded`
 * y la card pone la tapa en ese mismo lugar (el hueco mide lo mismo que ella).
 *
 * El guion de cada ciclo sale de planSearch; acá solo se dibuja. El cuadro a
 * cuadro escribe directo en el SVG (sin re-render por frame).
 */
export function LaneSearch({ lane, landing = false, onLanded }: { lane: Lane; landing?: boolean; onLanded?: () => void }) {
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [cycle, setCycle] = useState(0);
  const plan = useMemo(() => planSearch(lane, cycle), [lane, cycle]);
  const arrival = useMemo(() => planLanding(), []);
  const filterId = `pencil-${useId().replace(/:/g, "")}`;

  const ink = useRef<(SVGPathElement | null)[]>([]);
  const pencil = useRef<(SVGPathElement | null)[]>([]);
  const spines = useRef<(SVGRectElement | null)[]>([]);
  const rings = useRef<(SVGCircleElement | null)[]>([]);
  const nib = useRef<SVGCircleElement>(null);
  const lens = useRef<SVGCircleElement>(null);
  const field = useRef<SVGGElement>(null);
  const landPath = useRef<SVGPathElement>(null);
  const slot = useRef<SVGRectElement>(null);
  const landed = useRef(onLanded);
  useLayoutEffect(() => {
    landed.current = onLanded;
  });

  // La búsqueda: un ciclo tras otro hasta que llegue el libro.
  useLayoutEffect(() => {
    if (landing) return;
    const lengths = plan.steps.map((_, i) => ink.current[i]?.getTotalLength() ?? 0);
    plan.steps.forEach((_, i) => {
      for (const el of [ink.current[i], pencil.current[i]]) el?.setAttribute("stroke-dasharray", `${lengths[i]} ${lengths[i] + 1}`);
    });
    const elements = { ink: ink.current, pencil: pencil.current, spines: spines.current, rings: rings.current, nib: nib.current, lens: lens.current };

    if (still) {
      // Quieta: un intento descartado y uno en evaluación, sin movimiento.
      paint(plan, plan.steps[1]?.hold[0] ?? 0, lengths, elements);
      return;
    }
    let frame = 0;
    // Los tres carriles arrancan desfasados para no latir al unísono.
    const start = performance.now() + (cycle === 0 ? OFFSET[lane] : 0);
    const tick = (now: number) => {
      const t = now - start;
      if (t >= plan.total) {
        setCycle((c) => c + 1);
        return;
      }
      paint(plan, Math.max(0, t), lengths, elements);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [plan, still, landing, lane, cycle]);

  // La llegada: un solo trazo de las pistas al hueco del libro.
  useLayoutEffect(() => {
    if (!landing) return;
    if (still) {
      landed.current?.();
      return;
    }
    const path = landPath.current;
    const L = path?.getTotalLength() ?? 0;
    path?.setAttribute("stroke-dasharray", `${L} ${L + 1}`);
    field.current?.setAttribute("opacity", "0");
    let frame = 0;
    let done = false;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / LANDING.draw);
      path?.setAttribute("stroke-dashoffset", String(L * (1 - easeInOut(p))));
      if (nib.current && path) {
        const at = path.getPointAtLength(L * easeInOut(p));
        nib.current.setAttribute("opacity", p < 1 ? "1" : "0");
        nib.current.setAttribute("cx", String(at.x));
        nib.current.setAttribute("cy", String(at.y));
      }
      if (p >= 1 && !done) {
        done = true;
        slot.current?.classList.add("search-slot-lit");
        window.setTimeout(() => landed.current?.(), LANDING.settle);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [landing, still]);

  return (
    <svg
      viewBox={`0 0 ${FIELD.width} ${FIELD.height}`}
      width={FIELD.width}
      height={FIELD.height}
      aria-hidden="true"
      className="pointer-events-none relative left-1/2 block -translate-x-1/2 overflow-visible">
      <defs>
        <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="3" />
        </filter>
      </defs>

      {/* El hueco del libro: mide lo mismo que la tapa que va a ocuparlo. */}
      <rect ref={slot} x={SLOT.x + 0.5} y={SLOT.y + 0.5} width={SLOT.w - 1} height={SLOT.h - 1} rx="3" className="search-slot" />

      <g ref={field} className="search-field">
        {lane === "beyond" && (
          <g>
            <line x1={FIELD.edgeX} y1="4" x2={FIELD.edgeX} y2={FIELD.height - 4} stroke="var(--line)" strokeWidth="1" strokeDasharray="1 5" strokeLinecap="round" />
            <text x={FIELD.edgeX - 5} y="12" textAnchor="end" className="fill-muted font-serif text-[10px] italic">
              tu mapa
            </text>
          </g>
        )}

        {/* El campo: lomos de libros posibles que titilan. */}
        {plan.candidates.map((p, i) => (
          <g key={`${cycle}-${i}`} transform={`translate(${p.x} ${p.y})`}>
            <circle ref={(el) => void (rings.current[i] = el)} r="4" fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0" />
            <rect
              ref={(el) => void (spines.current[i] = el)}
              x="-2.5"
              y="-7"
              width="5"
              height="14"
              rx="1"
              transform={`rotate(${p.tilt})`}
              fill="var(--edge)"
              strokeWidth="1"
              className="animate-soft-pulse"
              style={{ animationDelay: `${-((i * 337) % 1400)}ms` }}
            />
          </g>
        ))}

        {plan.steps.map((step, i) => (
          <g key={`${cycle}-s${i}`}>
            <path ref={(el) => void (pencil.current[i] = el)} d={step.d} fill="none" stroke="var(--edge)" strokeWidth="1" strokeLinecap="round" filter={`url(#${filterId})`} transform="translate(1.3 1.1)" opacity="0" />
            <path ref={(el) => void (ink.current[i] = el)} d={step.d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeDashoffset="9999" />
          </g>
        ))}

        {/* La lente que evalúa cada candidato. */}
        <circle ref={lens} r="12" fill="none" stroke="var(--ink)" strokeWidth="0.9" strokeDasharray="2 3" opacity="0" className="animate-orbit-fast [transform-box:fill-box] [transform-origin:center]" />
      </g>

      <path ref={landPath} d={arrival.d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 9999" strokeDashoffset="9999" />
      <circle ref={nib} r="3" fill="var(--accent)" opacity="0" />

      {/* Tus pistas. */}
      <circle cx={ORIGIN.x} cy={ORIGIN.y} r="5" fill="var(--ink)" />
      <circle cx={ORIGIN.x - 12} cy={ORIGIN.y + 7} r="2.2" fill="var(--ink)" opacity="0.55" />
      <circle cx={ORIGIN.x + 4} cy={ORIGIN.y + 13} r="1.7" fill="var(--ink)" opacity="0.35" />
    </svg>
  );
}

const OFFSET: Record<Lane, number> = { affinity: 0, alternative: 380, beyond: 760 };

interface Elements {
  ink: (SVGPathElement | null)[];
  pencil: (SVGPathElement | null)[];
  spines: (SVGRectElement | null)[];
  rings: (SVGCircleElement | null)[];
  nib: SVGCircleElement | null;
  lens: SVGCircleElement | null;
}

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const progress = (t: number, [a, b]: [number, number]) => (b <= a ? (t >= a ? 1 : 0) : Math.min(1, Math.max(0, (t - a) / (b - a))));
const PENCIL_FADE = 1100;

/** Un cuadro de la búsqueda en el instante t. */
function paint(plan: Plan, t: number, lengths: number[], el: Elements) {
  let nibAt: DOMPoint | null = null;
  let lensAt: { x: number; y: number } | null = null;
  const probed = new Map<number, "probing" | "rejected" | "kept">();

  plan.steps.forEach((step, i) => {
    const path = el.ink[i];
    const L = lengths[i];
    if (!path) return;
    const drawn = easeInOut(progress(t, step.draw));
    const erasing = step.erase[1] > 0 ? easeInOut(progress(t, step.erase)) : 0;
    // Dibujar: de L a 0. Borrar desde la cola: de 0 a -L.
    path.setAttribute("stroke-dashoffset", String(t < step.draw[0] ? L : erasing > 0 ? -L * erasing : L * (1 - drawn)));

    const pencil = el.pencil[i];
    if (pencil) {
      pencil.setAttribute("stroke-dashoffset", String(L * (1 - drawn)));
      const fade = t > step.erase[0] && step.erase[1] > 0 ? 1 - Math.min(1, (t - step.erase[0]) / PENCIL_FADE) : 1;
      pencil.setAttribute("opacity", String(t < step.draw[0] ? 0 : 0.5 * fade));
    }

    if (t >= step.draw[0] && t < step.draw[1]) nibAt = path.getPointAtLength(L * drawn);
    if (t >= step.hold[0] && t < step.hold[1]) {
      lensAt = plan.candidates[step.target];
      probed.set(step.target, "probing");
    } else if (t >= step.hold[1] && !(step.kind === "hop" && t >= step.erase[1])) {
      probed.set(step.target, step.kind === "reject" ? "rejected" : "kept");
    }
  });

  plan.candidates.forEach((_, c) => {
    const spine = el.spines[c];
    const ring = el.rings[c];
    const state = probed.get(c);
    if (spine) {
      const lit = state === "probing" || state === "kept";
      spine.setAttribute("fill", lit ? "var(--accent)" : state === "rejected" ? "none" : "var(--edge)");
      spine.setAttribute("stroke", state === "rejected" ? "var(--edge)" : "none");
      spine.classList.toggle("animate-soft-pulse", state === undefined);
    }
    if (ring) {
      const step = plan.steps.find((s) => s.target === c);
      const p = step ? progress(t, step.hold) : 0;
      ring.setAttribute("r", String(4 + 10 * p));
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
}
