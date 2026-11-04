"use client";

import { useId } from "react";
import type { Lane } from "@/lib/graph/schema";
import { useMediaQuery } from "@/lib/use-media-query";
import { strokeTimeline, type Stroke } from "./trace-timeline";

/**
 * La espera de un carril, dibujada como una pluma que prueba caminos. La tinta
 * avanza con la punta visible, llega al lugar del libro y se borra desde la
 * cola; queda un rastro de lápiz que se desvanece antes del próximo intento.
 *
 * - Afinidad: un trazo corto y seguro.
 * - Alternativa: prueba una puerta que termina en un tope, la borra y entra por otra.
 * - Fuera de tu mapa: cruza el borde punteado de tu mapa, pasa por un puente afuera y vuelve.
 */
interface Scene {
  seconds: number;
  strokes: Stroke[];
  /** Cuándo la tinta llega al libro (fracción del ciclo). */
  land: number;
  bridge?: { x: number; y: number; at: number };
  edge?: boolean;
}

const ORIGIN = { x: 34, y: 36 };
const SLOT = { x: 62, y: 100, w: 76, h: 108 };

const SCENES: Record<Lane, Scene> = {
  affinity: {
    seconds: 2.8,
    strokes: [{ d: "M34 36 C 62 30, 100 54, 100 100", draw: [0.05, 0.5], erase: [0.62, 0.92] }],
    land: 0.5,
  },
  alternative: {
    seconds: 3.8,
    strokes: [
      { d: "M34 36 C 80 20, 130 24, 162 46", draw: [0.04, 0.28], erase: [0.36, 0.5] },
      // El tope: la primera puerta no tenía salida.
      { d: "M156 37 C 160 43, 164 50, 169 55", draw: [0.29, 0.33], erase: [0.4, 0.5] },
      { d: "M34 36 C 24 84, 92 60, 100 100", draw: [0.46, 0.76], erase: [0.84, 0.97] },
    ],
    land: 0.76,
  },
  beyond: {
    seconds: 4.4,
    strokes: [{ d: "M34 36 C 92 6, 170 12, 182 58 C 192 94, 120 70, 100 100", draw: [0.05, 0.62], erase: [0.72, 0.96] }],
    land: 0.62,
    bridge: { x: 182, y: 58, at: 0.36 },
    edge: true,
  },
};

const EASE = "0.45 0 0.25 1";
const splines = (keyTimes: string) => Array(keyTimes.split(";").length - 1).fill(EASE).join(";");

export function LaneTrace({ lane }: { lane: Lane }) {
  const scene = SCENES[lane];
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");
  const filterId = `pencil-${useId().replace(/:/g, "")}`;
  const dur = `${scene.seconds}s`;
  const landIn = Math.min(scene.land + 0.03, 0.99);

  return (
    <svg viewBox="0 0 200 220" aria-hidden="true" className="mx-auto mt-4 h-60 w-full max-w-60 overflow-visible">
      <defs>
        {/* Trazo de lápiz: un temblor leve, como una línea hecha a mano. */}
        <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed={lane.length} />
          <feDisplacementMap in="SourceGraphic" scale="3.2" />
        </filter>
      </defs>

      {scene.edge && (
        <g>
          <line x1="150" y1="6" x2="150" y2="214" stroke="var(--line)" strokeWidth="1" strokeDasharray="1 5" strokeLinecap="round" />
          <text x="146" y="212" textAnchor="end" className="fill-muted font-serif text-[9px] italic">
            tu mapa
          </text>
        </g>
      )}

      {/* El lugar del libro: se enciende cuando la tinta llega. */}
      <rect x={SLOT.x} y={SLOT.y} width={SLOT.w} height={SLOT.h} rx="3" fill="none" stroke="var(--edge)" strokeWidth="1.1" strokeDasharray="4 4" strokeOpacity="0.55">
        {!still && <animate attributeName="stroke-opacity" dur={dur} repeatCount="indefinite" values="0.55;0.55;1;0.55" keyTimes={`0;${scene.land};${landIn};1`} />}
      </rect>

      {scene.strokes.map((stroke, i) => {
        const tl = strokeTimeline(stroke);
        return (
          <g key={i}>
            <path
              d={stroke.d}
              fill="none"
              stroke="var(--edge)"
              strokeWidth="0.9"
              strokeLinecap="round"
              filter={`url(#${filterId})`}
              pathLength={100}
              strokeDasharray={100}
              strokeDashoffset={still ? 0 : 100}
              opacity={still ? 0.5 : 0}
              transform="translate(1.4 1.2)">
              {!still && (
                <>
                  <animate attributeName="stroke-dashoffset" dur={dur} repeatCount="indefinite" calcMode="spline" values={tl.pencil.offset.values} keyTimes={tl.pencil.offset.keyTimes} keySplines={splines(tl.pencil.offset.keyTimes)} />
                  <animate attributeName="opacity" dur={dur} repeatCount="indefinite" values={tl.pencil.opacity.values} keyTimes={tl.pencil.opacity.keyTimes} />
                </>
              )}
            </path>
            <path d={stroke.d} fill="none" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={still ? 0 : 100}>
              {!still && <animate attributeName="stroke-dashoffset" dur={dur} repeatCount="indefinite" calcMode="spline" values={tl.ink.values} keyTimes={tl.ink.keyTimes} keySplines={splines(tl.ink.keyTimes)} />}
            </path>
            {!still && (
              // La punta de la pluma.
              <circle r="2.6" fill="var(--accent)" opacity="0">
                <animateMotion dur={dur} repeatCount="indefinite" path={stroke.d} calcMode="spline" keyPoints={tl.nibPoints.keyPoints} keyTimes={tl.nibPoints.keyTimes} keySplines={splines(tl.nibPoints.keyTimes)} />
                <animate attributeName="opacity" dur={dur} repeatCount="indefinite" values={tl.nibOpacity.values} keyTimes={tl.nibOpacity.keyTimes} />
              </circle>
            )}
          </g>
        );
      })}

      {scene.bridge && (
        <g>
          <circle cx={scene.bridge.x} cy={scene.bridge.y} r="4.5" fill="var(--surface)" stroke="var(--edge)" strokeWidth="1.3" />
          {/* El puente se enciende cuando la punta lo cruza. */}
          <circle cx={scene.bridge.x} cy={scene.bridge.y} r="4.5" fill="var(--accent)" opacity={still ? 1 : 0}>
            {!still && <animate attributeName="opacity" dur={dur} repeatCount="indefinite" values="0;0;1;1;0" keyTimes={`0;${scene.bridge.at - 0.02};${scene.bridge.at + 0.01};0.7;1`} />}
          </circle>
        </g>
      )}

      {/* Tus pistas: de acá sale cada intento. */}
      <circle cx={ORIGIN.x} cy={ORIGIN.y} r="4.5" fill="var(--ink)" />
      <circle cx={ORIGIN.x - 11} cy={ORIGIN.y - 6} r="2" fill="var(--ink)" opacity="0.55" />
      <circle cx={ORIGIN.x - 6} cy={ORIGIN.y + 9} r="1.6" fill="var(--ink)" opacity="0.35" />
    </svg>
  );
}
