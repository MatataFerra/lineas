"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { Lane } from "@/lib/graph/schema";
import { useMediaQuery } from "@/lib/use-media-query";
import { FIELD_HEIGHT, coverRect, flowAngle, isSpent, landingTarget, particleCount, rng, spawn, speedOf } from "./flow-field";

/**
 * La espera de un carril: viento. Trazos que derivan con estela por un campo
 * de corrientes, cada carril con su temperamento (flow-field.ts); unos pocos,
 * en rojo, son los curiosos y van más rápido.
 *
 * Cuando el libro llega (`landing`), cada trazo viaja a un punto de la tapa y
 * las corrientes se condensan en su forma; ahí avisa `onLanded` y la card
 * pone la tapa en ese mismo lugar.
 *
 * Cada trazo recuerda sus últimas posiciones y se dibuja entero en cada
 * cuadro, más firme en la punta y más tenue en la cola: estelas limpias, sin
 * restos. Canvas cuadro a cuadro, sin re-render; fuera de pantalla no trabaja.
 * Con movimiento reducido queda un campo quieto de trazos cortos.
 */
export function LaneDrift({ lane, landing = false, onLanded }: { lane: Lane; landing?: boolean; onLanded?: () => void }) {
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");
  const canvas = useRef<HTMLCanvasElement>(null);
  const landingNow = useRef(landing);
  const landed = useRef(onLanded);
  useLayoutEffect(() => {
    landingNow.current = landing;
    landed.current = onLanded;
  });

  // Con movimiento reducido no hay condensación: la tapa aparece enseguida.
  useEffect(() => {
    if (landing && still) landed.current?.();
  }, [landing, still]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const random = rng(SEED[lane]);
    const speed = speedOf(lane);

    let width = 0;
    let palette = { ink: "#1e1c19", accent: "#c9402a" };
    let count = 0;
    // Posición actual, vida, si es curioso y la estela: TRAIL posiciones por trazo en un anillo compartido.
    let x = new Float32Array(0);
    let y = new Float32Array(0);
    let age = new Float32Array(0);
    let life = new Float32Array(0);
    let curious = new Uint8Array(0);
    let trailX = new Float32Array(0);
    let trailY = new Float32Array(0);
    let head = 0;

    const place = (i: number, px: number, py: number) => {
      x[i] = px;
      y[i] = py;
      for (let k = 0; k < TRAIL; k++) {
        trailX[i * TRAIL + k] = px;
        trailY[i * TRAIL + k] = py;
      }
    };
    const rebirth = (i: number) => {
      const p = spawn(lane, random, width, FIELD_HEIGHT);
      place(i, p.x, p.y);
      age[i] = 0;
      life[i] = 3 + random() * 4;
    };
    const record = () => {
      head = (head + 1) % TRAIL;
      for (let i = 0; i < count; i++) {
        trailX[i * TRAIL + head] = x[i];
        trailY[i * TRAIL + head] = y[i];
      }
    };

    const resize = () => {
      width = el.getBoundingClientRect().width;
      if (width === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(width * dpr);
      el.height = Math.round(FIELD_HEIGHT * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const style = getComputedStyle(el);
      palette = { ink: style.getPropertyValue("--ink").trim() || palette.ink, accent: style.getPropertyValue("--accent").trim() || palette.accent };
      count = particleCount(width, FIELD_HEIGHT);
      x = new Float32Array(count);
      y = new Float32Array(count);
      age = new Float32Array(count);
      life = new Float32Array(count);
      curious = new Uint8Array(count);
      trailX = new Float32Array(count * TRAIL);
      trailY = new Float32Array(count * TRAIL);
      // El campo arranca ya poblado: cada trazo en un punto al azar y a mitad de su vida.
      for (let i = 0; i < count; i++) {
        place(i, random() * width, random() * FIELD_HEIGHT);
        life[i] = 3 + random() * 4;
        age[i] = random() * life[i];
        curious[i] = random() < CURIOUS ? 1 : 0;
      }
      if (still) paintStill();
    };

    /** Movimiento reducido: el campo como un rayado quieto, cada trazo en la dirección del viento. */
    const paintStill = () => {
      ctx.clearRect(0, 0, width, FIELD_HEIGHT);
      for (const accent of [0, 1]) {
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          if (curious[i] !== accent) continue;
          const a = flowAngle(lane, x[i], y[i], 0, width, FIELD_HEIGHT);
          ctx.moveTo(x[i], y[i]);
          ctx.lineTo(x[i] + Math.cos(a) * 10, y[i] + Math.sin(a) * 10);
        }
        stroke(accent === 1, 0.6, 1);
      }
    };

    const stroke = (accent: boolean, alpha: number, widthScale: number) => {
      ctx.strokeStyle = accent ? palette.accent : palette.ink;
      ctx.globalAlpha = (accent ? 0.95 : 0.38) * alpha;
      ctx.lineWidth = (accent ? 1.6 : 1.1) * widthScale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    /** Las estelas en tres tramos: la punta firme, el medio y la cola tenue. Una pasada por tramo y color. */
    const paint = (fadeIn: (i: number) => boolean) => {
      ctx.clearRect(0, 0, width, FIELD_HEIGHT);
      for (const [from, to, alpha, w] of BANDS) {
        for (const accent of [0, 1]) {
          ctx.beginPath();
          for (let i = 0; i < count; i++) {
            if (curious[i] !== accent || !fadeIn(i)) continue;
            const base = i * TRAIL;
            let k = (head - from + TRAIL) % TRAIL;
            // La punta sale de donde está el trazo ahora, no de la última muestra.
            if (from === 0) ctx.moveTo(x[i], y[i]);
            else ctx.moveTo(trailX[base + k], trailY[base + k]);
            for (let s = from + 1; s <= to; s++) {
              k = (head - s + TRAIL) % TRAIL;
              ctx.lineTo(trailX[base + k], trailY[base + k]);
            }
          }
          stroke(accent === 1, alpha, w);
        }
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    if (still) return () => ro.disconnect();

    let visible = true;
    const io = new IntersectionObserver(([entry]) => void (visible = entry.isIntersecting));
    io.observe(el);

    let frame = 0;
    let last = performance.now();
    let t = OFFSET[lane];
    let sinceRecord = 0;
    // La condensación: de dónde sale cada trazo, adónde va, con qué demora y cuánto se curva.
    let landStart = -1;
    let fromX = new Float32Array(0);
    let fromY = new Float32Array(0);
    let toX = new Float32Array(0);
    let toY = new Float32Array(0);
    let delay = new Float32Array(0);
    let bend = new Float32Array(0);

    const drift = (dt: number) => {
      for (let i = 0; i < count; i++) {
        const a = flowAngle(lane, x[i], y[i], t, width, FIELD_HEIGHT);
        const pace = speed * (curious[i] ? 1.35 : 1) * dt;
        x[i] += Math.cos(a) * pace;
        y[i] += Math.sin(a) * pace;
        age[i] += dt;
        if (age[i] > life[i] || isSpent(lane, { x: x[i], y: y[i] }, width, FIELD_HEIGHT)) rebirth(i);
      }
      sinceRecord += dt * 1000;
      if (sinceRecord >= SAMPLE_MS) {
        sinceRecord = 0;
        record();
      }
      // Un trazo recién nacido no se dibuja hasta tener un poco de estela: aparece, no salta.
      paint((i) => age[i] > 0.25);
    };

    const condense = (now: number): boolean => {
      if (landStart < 0) {
        landStart = now;
        const rect = coverRect(width);
        fromX = x.slice();
        fromY = y.slice();
        toX = new Float32Array(count);
        toY = new Float32Array(count);
        delay = new Float32Array(count);
        bend = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          const p = landingTarget(random, rect);
          toX[i] = p.x;
          toY[i] = p.y;
          delay[i] = random() * SPREAD;
          bend[i] = (random() - 0.5) * 50;
        }
      }
      const elapsed = now - landStart;
      for (let i = 0; i < count; i++) {
        const e = easeInOut(Math.min(1, Math.max(0, (elapsed - delay[i]) / CONVERGE)));
        const dx = toX[i] - fromX[i];
        const dy = toY[i] - fromY[i];
        const len = Math.hypot(dx, dy) || 1;
        // Cada trazo llega en curva, no en recta: la bandada se pliega sobre la tapa.
        const arc = Math.sin(Math.PI * e) * bend[i];
        x[i] = fromX[i] + dx * e + (-dy / len) * arc;
        y[i] = fromY[i] + dy * e + (dx / len) * arc;
      }
      // En la llegada la estela se muestrea en cada cuadro: las corrientes curvan suave hasta el contorno.
      record();
      paint(() => true);
      // Termina cuando las colas también llegaron: la forma de la tapa queda nítida.
      return elapsed >= CONVERGE + SPREAD + TAIL_MS;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (width > 0 && (visible || landingNow.current)) {
        if (landingNow.current) {
          if (condense(now)) {
            window.setTimeout(() => landed.current?.(), SETTLE);
            return;
          }
        } else {
          t += dt;
          drift(dt);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
    };
  }, [lane, still]);

  return <canvas ref={canvas} aria-hidden="true" className="drift-canvas block w-full" style={{ height: FIELD_HEIGHT }} />;
}

/** Cuántas posiciones recuerda cada trazo, y los tramos de su estela: [desde, hasta, opacidad, grosor]. */
const TRAIL = 24;
/** Cada cuánto se guarda una posición de la estela: con TRAIL, la cola dura unos 0,8 s. */
const SAMPLE_MS = 33;
const BANDS: [number, number, number, number][] = [
  [12, 23, 0.22, 0.75],
  [4, 12, 0.5, 0.9],
  [0, 4, 1, 1],
];
/** Duración de la condensación, la demora máxima entre trazos y la pausa antes de poner la tapa (ms). Con TAIL_MS, unos 1,1 s en total. */
const CONVERGE = 560;
const SPREAD = 140;
/** Lo que tardan las colas en alcanzar a la punta, para que el contorno quede limpio (TRAIL cuadros a 60 Hz). */
const TAIL_MS = 400;
const SETTLE = 40;
/** Qué parte de los trazos son curiosos (rojos, más rápidos). */
const CURIOUS = 0.08;
const SEED: Record<Lane, number> = { affinity: 11, alternative: 23, beyond: 37 };
/** Los carriles arrancan en otro momento del viento: no se mueven al unísono. */
const OFFSET: Record<Lane, number> = { affinity: 0, alternative: 7, beyond: 13 };

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
