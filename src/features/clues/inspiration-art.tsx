"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * La franja del costado de la home. De entre las páginas de un libro abierto
 * sale un trazo de tinta que crece como una planta: brota hojas y se ramifica
 * hacia lo que inspira (la noche, la música, un pájaro de papel, las
 * estrellas) hasta un sol, el mismo centro que tiene el mapa.
 *
 * El tallo es una cadena de tres tramos articulados. Cada articulación es un
 * resorte: la planta se mece sola y se inclina hacia el cursor, con los
 * tramos de arriba llegando un poco tarde, como una planta de verdad. Lo que
 * cuelga de cada tramo (ramas, escenas, el sol) lo acompaña.
 *
 * Al cargar, todo se dibuja de abajo hacia arriba (clases art-* en
 * globals.css). Con movimiento reducido queda quieta y completa.
 */

type Pt = [number, number];
/** Un tramo cúbico: inicio, dos controles y fin. */
type Cubic = [Pt, Pt, Pt, Pt];

// Las tres articulaciones del tallo: el pliegue del libro y dos nudos.
const JOINTS: Pt[] = [
  [100, 712],
  [104, 552],
  [128, 370],
];

const STEM: Cubic[][] = [
  [
    [[100, 744], [100, 704], [94, 668], [100, 636]],
    [[100, 636], [106, 606], [96, 580], [104, 552]],
  ],
  [
    [[104, 552], [112, 522], [122, 498], [118, 470]],
    [[118, 470], [114, 440], [132, 404], [128, 370]],
  ],
  [
    [[128, 370], [124, 336], [132, 300], [128, 270]],
    [[128, 270], [126, 252], [126, 238], [126, 222]],
  ],
];
// Grosor del tallo al empezar y al terminar cada tramo: de pincel cargado a punta fina.
const STEM_WIDTH: [number, number][] = [
  [5.2, 3.4],
  [3.4, 2.3],
  [2.3, 1.2],
];

const BRANCH: Record<"moon" | "music" | "bird" | "stars", Cubic> = {
  moon: [[104, 552], [86, 530], [62, 514], [54, 492]],
  music: [[118, 470], [136, 464], [150, 462], [158, 452]],
  bird: [[128, 370], [108, 358], [86, 356], [72, 346]],
  stars: [[128, 270], [142, 272], [152, 272], [160, 264]],
};

const delay = (s: number) => ({ "--delay": `${s}s` }) as CSSProperties;

export function InspirationArt() {
  const box = useRef<HTMLDivElement>(null);
  const joints = useRef<(SVGGElement | null)[]>([]);
  useSpringyStem(box, joints);

  return (
    <div ref={box} className="relative hidden max-w-[260px] flex-[0_0_18%] overflow-hidden md:block" aria-hidden="true" style={{ viewTransitionName: "home-art" }}>
      <svg viewBox="0 0 200 820" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <defs>
          <radialGradient id="art-glow">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.26" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="art-ink" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#8a2a1c" />
            <stop offset="0.45" stopColor="var(--accent)" />
          </linearGradient>
          <linearGradient id="art-page-l" x1="1" x2="0">
            <stop offset="0" stopColor="var(--art-fold)" />
            <stop offset="0.22" stopColor="var(--surface)" />
            <stop offset="1" stopColor="var(--surface)" />
          </linearGradient>
          <linearGradient id="art-page-r" x1="0" x2="1">
            <stop offset="0" stopColor="var(--art-fold)" />
            <stop offset="0.22" stopColor="var(--surface)" />
            <stop offset="1" stopColor="var(--surface)" />
          </linearGradient>
          <linearGradient id="art-turn" x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0" stopColor="var(--art-fold)" />
            <stop offset="0.5" stopColor="var(--surface)" />
            <stop offset="1" stopColor="var(--chip)" />
          </linearGradient>
          <linearGradient id="art-leaf" x1="0" x2="1">
            <stop offset="0" stopColor="var(--surface)" />
            <stop offset="1" stopColor="var(--chip)" />
          </linearGradient>
          <radialGradient id="art-moon" cx="0.35" cy="0.4" r="0.8">
            <stop offset="0" stopColor="var(--ink)" stopOpacity="0.75" />
            <stop offset="1" stopColor="var(--ink)" />
          </radialGradient>
          <radialGradient id="art-shadow">
            <stop offset="0" stopColor="#000" stopOpacity="0.28" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          {/* Cada tramo se revela con un trazo que se dibuja sobre su máscara. */}
          {STEM.map((segments, i) => (
            <mask key={i} id={`art-reveal-${i}`} maskUnits="userSpaceOnUse">
              <path d={pathOf(segments)} pathLength={1} fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" className="art-draw" style={{ ...delay(0.3 + i * 0.75), ["--dur" as string]: "0.85s" }} />
            </mask>
          ))}
          {(Object.keys(BRANCH) as (keyof typeof BRANCH)[]).map((k, i) => (
            <mask key={k} id={`art-reveal-${k}`} maskUnits="userSpaceOnUse">
              <path d={pathOf([BRANCH[k]])} pathLength={1} fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" className="art-draw" style={{ ...delay(1 + i * 0.45), ["--dur" as string]: "0.6s" }} />
            </mask>
          ))}
        </defs>

        <rect width="200" height="820" className="fill-[#e6ddcf] dark:fill-[#1c1a18]" />

        {/* Hojas apiladas como lomas, de lejos a cerca. */}
        <g>
          <path d="M0 560 C 40 540, 70 548, 100 536 C 135 522, 165 534, 200 520 L200 820 L0 820 Z" className="fill-[#d9cdb9] dark:fill-[#23201c]" />
          <path d="M0 612 C 30 598, 62 606, 96 594 C 130 582, 168 598, 200 586 L200 820 L0 820 Z" className="fill-[#cbbda7] dark:fill-[#29251f]" />
          <path d="M0 602 C 30 590, 62 598, 96 586 C 130 574, 168 590, 200 578" fill="none" strokeWidth="0.7" className="stroke-[#f4f0e8]/70 dark:stroke-[#39342c]" />
          <path d="M0 668 C 36 654, 70 662, 104 652 C 140 642, 172 654, 200 646 L200 820 L0 820 Z" className="fill-[#b3a48d] dark:fill-[#2f2b25]" />
        </g>

        {/* Polvo de estrellas en lo alto. */}
        <g className="art-pop" style={delay(3)}>
          {(
            [
              [34, 70, 1.1, 0],
              [70, 32, 0.8, -0.9],
              [168, 58, 1.2, -1.6],
              [186, 112, 0.7, -2.3],
              [22, 150, 0.9, -0.5],
              [58, 108, 0.6, -1.2],
              [150, 22, 0.7, -2],
            ] as const
          ).map(([x, y, r, d]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} className="art-twinkle fill-ink/45" style={delay(d)} />
          ))}
        </g>

        {/* La planta: tres tramos, cada uno anidado en el anterior. */}
        <g ref={(el) => void (joints.current[0] = el)}>
          <Tapered segments={STEM[0]} widths={STEM_WIDTH[0]} mask="art-reveal-0" />
          <Leaf at={[100, 636]} angle={-140} d={0.75} />
          <Leaf at={[100, 636]} angle={-28} d={0.85} small />

          <g ref={(el) => void (joints.current[1] = el)}>
            <Tapered segments={STEM[1]} widths={STEM_WIDTH[1]} mask="art-reveal-1" />
            <Tapered segments={[BRANCH.moon]} widths={[2, 0.7]} mask="art-reveal-moon" />
            <Tapered segments={[BRANCH.music]} widths={[1.8, 0.7]} mask="art-reveal-music" />
            <Leaf at={[118, 470]} angle={-158} d={1.5} small />
            <Moon />
            <Music />

            <g ref={(el) => void (joints.current[2] = el)}>
              <Tapered segments={STEM[2]} widths={STEM_WIDTH[2]} mask="art-reveal-2" />
              <Tapered segments={[BRANCH.bird]} widths={[1.8, 0.7]} mask="art-reveal-bird" />
              <Tapered segments={[BRANCH.stars]} widths={[1.5, 0.6]} mask="art-reveal-stars" />
              <Leaf at={[128, 370]} angle={-24} d={2.2} />
              <Bird />
              <Stars />
              <Sun />
            </g>
          </g>
        </g>

        {/* Letras que se escapan del libro. */}
        <g className="fill-[#6b5f50] font-serif dark:fill-[#a39c90]">
          {[
            { c: "a", x: 66, s: 15, d: 0 },
            { c: "ñ", x: 132, s: 13, d: -2.2 },
            { c: "¿", x: 84, s: 12, d: -4.1, i: true },
            { c: "r", x: 150, s: 11, d: -5.6 },
            { c: "e", x: 40, s: 11, d: -1.3, i: true },
            { c: "l", x: 116, s: 10, d: -3.4 },
            { c: "s", x: 56, s: 9, d: -6.3, i: true },
          ].map((l) => (
            <text key={l.c} x={l.x} y={704} fontSize={l.s} fontStyle={l.i ? "italic" : undefined} className="art-rise" style={delay(l.d)}>
              {l.c}
            </text>
          ))}
        </g>

        <Book />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Movimiento: resortes en cada articulación                           */
/* ------------------------------------------------------------------ */

function useSpringyStem(box: React.RefObject<HTMLDivElement | null>, joints: React.RefObject<(SVGGElement | null)[]>) {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Cuánto del giro total toma cada articulación, y qué tan rígida es: las de arriba, más blandas, llegan tarde.
    const share = [0.4, 0.35, 0.25];
    const stiffness = [70, 48, 32];
    const damping = [9, 7, 5.5];
    const angle = [0, 0, 0];
    const speed = [0, 0, 0];
    let lean = 0;
    let lastX: number | null = null;
    let frame = 0;
    let last = performance.now();
    const start = last;

    const onMove = (e: PointerEvent) => {
      const rect = box.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      // Se inclina hacia el cursor; más si el cursor está cerca de la planta.
      const near = e.clientX < rect.right + 160 ? 1 : 0.45;
      lean = Math.max(-1, Math.min(1, (e.clientX - cx) / 260)) * 9 * near;
      // Un movimiento rápido le da un golpe de viento.
      if (lastX !== null) speed[2] += Math.max(-40, Math.min(40, (e.clientX - lastX) * 0.9 * near));
      lastX = e.clientX;
    };
    const onLeave = () => {
      lean = 0;
      lastX = null;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      const breeze = Math.sin(t * 0.7) * 1.2 + Math.sin(t * 1.9) * 0.35;
      angle.forEach((a, i) => {
        const target = (lean + breeze) * share[i];
        speed[i] += (stiffness[i] * (target - a) - damping[i] * speed[i]) * dt;
        angle[i] = a + speed[i] * dt;
        const [x, y] = JOINTS[i];
        joints.current[i]?.setAttribute("transform", `rotate(${angle[i].toFixed(3)} ${x} ${y})`);
      });
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [box, joints]);
}

/* ------------------------------------------------------------------ */
/* Trazo de tinta con grosor variable                                  */
/* ------------------------------------------------------------------ */

function pathOf(segments: Cubic[]): string {
  return segments.map(([a, b, c, d], i) => `${i ? "" : `M${a[0]} ${a[1]} `}C ${b[0]} ${b[1]}, ${c[0]} ${c[1]}, ${d[0]} ${d[1]}`).join(" ");
}

function cubicAt([a, b, c, d]: Cubic, t: number): { p: Pt; n: Pt } {
  const u = 1 - t;
  const p: Pt = [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
  const dx = 3 * u * u * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t * t * (d[0] - c[0]);
  const dy = 3 * u * u * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t * t * (d[1] - c[1]);
  const len = Math.hypot(dx, dy) || 1;
  return { p, n: [-dy / len, dx / len] };
}

/** El contorno de un trazo que se afina de `w0` a `w1`, como una pincelada. */
function taperedOutline(segments: Cubic[], [w0, w1]: [number, number]): string {
  const steps = 18;
  const left: Pt[] = [];
  const right: Pt[] = [];
  const total = segments.length * steps;
  segments.forEach((seg, s) => {
    for (let k = s === 0 ? 0 : 1; k <= steps; k++) {
      const { p, n } = cubicAt(seg, k / steps);
      const w = (w0 + (w1 - w0) * ((s * steps + k) / total)) / 2;
      left.push([p[0] + n[0] * w, p[1] + n[1] * w]);
      right.push([p[0] - n[0] * w, p[1] - n[1] * w]);
    }
  });
  const r = (v: number) => v.toFixed(2);
  const pts = [...left, ...right.reverse()];
  return `M${pts.map(([x, y]) => `${r(x)} ${r(y)}`).join(" L")} Z`;
}

function Tapered({ segments, widths, mask }: { segments: Cubic[]; widths: [number, number]; mask: string }) {
  return <path d={taperedOutline(segments, widths)} fill="url(#art-ink)" mask={`url(#${mask})`} />;
}

/* ------------------------------------------------------------------ */
/* El libro                                                            */
/* ------------------------------------------------------------------ */

function Book() {
  const left = "M100 712 C 82 700, 50 694, 14 700 L 11 758 C 46 751, 80 755, 100 768 Z";
  const right = "M100 712 C 118 700, 150 694, 186 700 L 189 758 C 154 751, 120 755, 100 768 Z";
  return (
    <g>
      <ellipse cx="100" cy="772" rx="104" ry="12" fill="url(#art-shadow)" />
      {/* Tapa: un filo de tela que asoma. */}
      <path d="M100 722 C 78 708, 44 704, 6 709 L 3 766 C 44 760, 78 764, 100 773 C 122 764, 156 760, 197 766 L 194 709 C 156 704, 122 708, 100 722 Z" className="fill-[#6e2a1f] dark:fill-[#5a2118]" />
      {/* Hojas debajo de la de arriba: el grosor del libro. */}
      {[4, 2.5, 1].map((k) => (
        <g key={k} className="fill-[#e9e1d3] dark:fill-[#3a352e]">
          <path d={left} transform={`translate(${-k * 0.9} ${k * 1.5})`} />
          <path d={right} transform={`translate(${k * 0.9} ${k * 1.5})`} />
        </g>
      ))}
      <path d={left} fill="url(#art-page-l)" />
      <path d={right} fill="url(#art-page-r)" />
      {/* Renglones apenas marcados. */}
      <g fill="none" strokeLinecap="round" strokeWidth="0.55" className="stroke-ink/20">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <path d={`M${24 + (i === 4 ? 0 : 0)} ${716 + i * 8} C 46 ${709 + i * 8}, 70 ${710 + i * 8}, ${i === 2 ? 80 : 90} ${717 + i * 8}`} />
            <path d={`M${i === 3 ? 122 : 110} ${717 + i * 8} C 130 ${710 + i * 8}, 154 ${709 + i * 8}, 176 ${716 + i * 8}`} />
          </g>
        ))}
      </g>
      {/* Una página a medio pasar, que se mueve con la brisa. */}
      <g className="art-turn">
        <path d="M100 713 C 112 694, 134 682, 160 682 C 162 702, 160 724, 154 744 C 134 742, 114 750, 100 767 Z" fill="url(#art-turn)" />
        <path d="M160 682 C 162 702, 160 724, 154 744" fill="none" strokeWidth="0.5" className="stroke-ink/15" />
      </g>
      {/* La sombra del pliegue. */}
      <path d="M100 712 L 100 768" strokeWidth="1.2" className="stroke-black/15" />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Hojas y escenas                                                     */
/* ------------------------------------------------------------------ */

function Leaf({ at: [x, y], angle, d, small = false }: { at: Pt; angle: number; d: number; small?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${small ? 0.72 : 1})`}>
      <g className="art-unfold" style={delay(d)}>
        {/* Asimétrica y con la punta apenas curvada. */}
        <path d="M0 0 C 5 -8, 15 -11, 27 -4 C 29 -3, 30 -1.5, 29 0 C 19 7, 7 6, 0 0 Z" fill="url(#art-leaf)" strokeWidth="0.5" className="stroke-ink/35" />
        <path d="M1.5 0 C 9 -2.4, 18 -2.8, 27.5 -2" fill="none" strokeWidth="0.6" strokeLinecap="round" className="stroke-accent/70" />
        <path d="M10 -1.4 l 4 -4.4 M17 -1.9 l 3.6 -3.6 M12 -1.2 l 3 3.4" fill="none" strokeWidth="0.35" className="stroke-accent/45" />
      </g>
    </g>
  );
}

function Blossom({ x, y, d, children }: { x: number; y: number; d: number; children: ReactNode }) {
  return (
    <g className="art-pop" style={delay(d)}>
      <circle cx={x} cy={y} r="22" fill="url(#art-glow)" className="art-breathe" />
      {children}
    </g>
  );
}

/** Una chispa de cuatro puntas. */
function Sparkle({ x, y, r, d, className = "fill-ink" }: { x: number; y: number; r: number; d: number; className?: string }) {
  const k = r * 0.22;
  return (
    <path
      d={`M${x} ${y - r} Q ${x + k} ${y - k}, ${x + r} ${y} Q ${x + k} ${y + k}, ${x} ${y + r} Q ${x - k} ${y + k}, ${x - r} ${y} Q ${x - k} ${y - k}, ${x} ${y - r} Z`}
      className={`art-twinkle ${className}`}
      style={delay(d)}
    />
  );
}

function Moon() {
  return (
    <Blossom x={50} y={478} d={1.6}>
      <path d="M56 465 a13.5 13.5 0 1 0 0 26 a10.5 10.5 0 1 1 0 -26 z" fill="url(#art-moon)" />
      {/* Una nube fina que pasa. */}
      <path d="M30 486 C 36 482, 42 486, 46 483 C 50 480, 56 484, 60 482" fill="none" strokeWidth="0.7" strokeLinecap="round" className="art-drift stroke-ink/40" />
      <Sparkle x={33} y={464} r={3} d={0} />
      <Sparkle x={66} y={496} r={2.2} d={-1.1} />
    </Blossom>
  );
}

function Music() {
  return (
    <Blossom x={170} y={448} d={1.9}>
      {/* Un pentagrama que se curva como una cinta. */}
      <g fill="none" strokeWidth="0.45" className="stroke-ink/55">
        {[0, 2.2, 4.4, 6.6, 8.8].map((o) => (
          <path key={o} d={`M156 ${445 + o} C 166 ${439 + o}, 176 ${446 + o}, 190 ${436 + o}`} />
        ))}
      </g>
      {/* Dos corcheas unidas por su barra. */}
      <g className="fill-ink stroke-ink">
        <ellipse cx="167" cy="449" rx="2.3" ry="1.6" transform="rotate(-24 167 449)" stroke="none" />
        <ellipse cx="177" cy="446" rx="2.3" ry="1.6" transform="rotate(-24 177 446)" stroke="none" />
        <path d="M169 448.4 V 438 M179 445.4 V 435 M169 438 L 179 435 L 179 437.2 L 169 440.2 Z" strokeWidth="0.8" />
      </g>
      <g className="art-note" style={delay(0)}>
        <SingleNote x={184} y={434} />
      </g>
      <g className="art-note" style={delay(-1.8)}>
        <SingleNote x={174} y={430} small />
      </g>
    </Blossom>
  );
}

function SingleNote({ x, y, small = false }: { x: number; y: number; small?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${small ? 0.75 : 1})`}>
      <ellipse rx="2.2" ry="1.5" transform="rotate(-24)" className="fill-ink" />
      <path d="M2 -0.6 V -9 C 3.6 -7.6, 5.4 -7, 5.6 -4.8" fill="none" strokeWidth="0.8" strokeLinecap="round" className="stroke-ink" />
    </g>
  );
}

/** Un pájaro de papel posado en su rama, que bate las alas. */
function Bird() {
  return (
    <Blossom x={62} y={340} d={2.3}>
      <g transform="translate(62 342)">
        <path d="M-14 -2 L 2 -1 L 12 -6 L 6 2 L -6 4 Z" className="fill-surface stroke-ink/60" strokeWidth="0.5" strokeLinejoin="round" />
        <path d="M2 -1 L 6 2 L -6 4 Z" className="fill-[#e3d9c8] dark:fill-[#3a352e]" />
        <path d="M12 -6 L 16 -5 L 12.5 -4.4 Z" className="fill-ink" />
        {/* Las alas: un pliegue que sube y baja. */}
        <g className="art-flap">
          <path d="M-4 -1.5 L 4 -1.5 L -8 -16 Z" className="fill-surface stroke-ink/60" strokeWidth="0.5" strokeLinejoin="round" />
          <path d="M-4 -1.5 L 0 -1.5 L -8 -16 Z" className="fill-[#e3d9c8] dark:fill-[#3a352e]" />
        </g>
        <path d="M-14 -2 L -20 -8 L -12 -0.5 Z" className="fill-accent" />
      </g>
    </Blossom>
  );
}

function Stars() {
  const points: [number, number, number][] = [
    [164, 262, 2.6],
    [174, 249, 4.2],
    [186, 256, 2.4],
    [182, 236, 3],
  ];
  return (
    <Blossom x={176} y={250} d={2.6}>
      <polyline points={points.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" strokeWidth="0.4" strokeDasharray="1 1.6" className="stroke-ink/50" />
      {points.map(([x, y, r], i) => (
        <Sparkle key={i} x={x} y={y} r={r} d={-i * 0.65} />
      ))}
    </Blossom>
  );
}

function Sun() {
  return (
    <g className="art-pop" style={delay(2.8)}>
      <circle cx="126" cy="182" r="76" fill="url(#art-glow)" className="art-breathe" />
      <g className="animate-orbit" style={{ transformOrigin: "126px 182px" }}>
        <circle cx="126" cy="182" r="56" fill="none" strokeWidth="0.9" strokeDasharray="1.5 5.5" className="stroke-accent/50" />
        <circle cx="126" cy="126" r="2" className="fill-accent" />
      </g>
      <circle cx="126" cy="182" r="40" className="fill-accent" />
    </g>
  );
}
