import type { CSSProperties, ReactNode } from "react";
import { MAX_CLUES } from "@/lib/graph/schema";
import { contour, pathOf, segmentEnds, type Cubic, type Pt } from "./trail";

/**
 * La franja del costado de la home: un mapa de expedición. Del pliegue de un
 * libro abierto sale un sendero que sube hacia los orígenes de la literatura,
 * pasando por un hito de cada época: las mariposas amarillas de Macondo, la
 * ballena de Nantucket, un molino de La Mancha, la selva oscura de Dante y,
 * en la cima, el templo del Olimpo con el sol detrás (el mismo centro que
 * tiene el mapa de la app). En La Mancha se bifurca: una rama queda sin
 * explorar.
 *
 * Las paradas son las pistas: cada pista que se suma enciende un hito y el
 * viajero camina hasta él; si se quita, vuelve. Así el dibujo responde a lo
 * que se escribe al lado.
 *
 * Al cargar, el sendero se dibuja de abajo hacia arriba y las paradas
 * aparecen cuando el trazo pasa. Después quedan vivas solo tres cosas: el sol
 * respira, la rama sin explorar avanza muy despacio y las páginas del libro
 * se abren apenas. Todo en globals.css (clases art-*); con movimiento
 * reducido queda quieta y completa.
 */

const TRAIL: Cubic[] = [
  [[100, 704], [102, 676], [70, 664], [64, 628]],
  [[64, 628], [58, 592], [120, 590], [132, 556]],
  [[132, 556], [144, 522], [96, 500], [84, 468]],
  [[84, 468], [72, 436], [140, 430], [146, 396]],
  [[146, 396], [152, 362], [100, 350], [104, 320]],
  [[104, 320], [106, 296], [124, 282], [124, 246]],
];
const TRAIL_D = pathOf(TRAIL);
const ENDS = segmentEnds(TRAIL);

/** Los hitos, de abajo hacia arriba: del siglo XX a la Antigüedad. Cada uno al final de un tramo (el penúltimo no tiene). */
const STOPS: { segment: number; place: string; glyph: Pt; label: { at: Pt; anchor?: "start" | "middle" | "end" }; Landmark: () => ReactNode }[] = [
  { segment: 0, place: "Macondo", glyph: [38, 636], label: { at: [38, 652] }, Landmark: Butterflies },
  { segment: 1, place: "Nantucket", glyph: [164, 562], label: { at: [164, 578] }, Landmark: WhaleTail },
  { segment: 2, place: "La Mancha", glyph: [112, 480], label: { at: [126, 476], anchor: "start" }, Landmark: Windmill },
  { segment: 3, place: "Selva oscura", glyph: [116, 400], label: { at: [100, 394], anchor: "end" }, Landmark: Forest },
  { segment: 5, place: "Olimpo", glyph: [124, 246], label: { at: [84, 230], anchor: "end" }, Landmark: Temple },
];

/** La rama que nadie recorrió: sale de la tercera parada y se pierde por el borde. */
const UNEXPLORED: Cubic[] = [
  [[84, 468], [62, 446], [38, 440], [30, 410]],
  [[30, 410], [22, 380], [36, 356], [16, 328]],
];

// Las lomas: centro, radio del anillo de adentro, cuántos anillos y cuánto se estiran a lo ancho.
const HILLS: { c: Pt; r: number; rings: number; squash: number }[] = [
  { c: [156, 622], r: 12, rings: 5, squash: 1.3 },
  { c: [44, 432], r: 10, rings: 4, squash: 1.2 },
  { c: [150, 330], r: 8, rings: 3, squash: 1.4 },
];

// La sierra, con el Olimpo en el medio: la cumbre plana donde se apoya el templo.
const RIDGE = "M0 274 C 14 270, 22 264, 32 264 C 42 264, 50 270, 60 266 C 72 262, 84 256, 96 254 C 104 252, 110 248, 115 246 L 133 246 C 138 248, 144 254, 154 256 C 166 258, 174 264, 186 262 C 192 261, 196 260, 200 260";

const DRAW_FROM = 0.3;
const DRAW_FOR = 1.6;

const delay = (s: number) => ({ "--delay": `${s}s` }) as CSSProperties;
/** Cuándo pasa el trazo por una fracción del sendero (aproximado: el trazo acelera y frena). */
const passes = (fraction: number) => DRAW_FROM + DRAW_FOR * fraction;

export function InspirationArt({ discoveries }: { discoveries: number }) {
  const lit = Math.max(0, Math.min(discoveries, MAX_CLUES, STOPS.length));
  const travelled = lit === 0 ? 0 : ENDS[STOPS[lit - 1].segment];

  return (
    <div className="relative hidden max-w-[260px] flex-[0_0_18%] overflow-hidden lg:block" aria-hidden="true">
      <svg viewBox="0 0 200 820" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 size-full">
        <defs>
          <radialGradient id="art-glow">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.26" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
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
          <radialGradient id="art-shadow">
            <stop offset="0" stopColor="#000" stopOpacity="0.28" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          {/* El sendero y la rama son punteados: se revelan dibujando su máscara. */}
          <mask id="art-reveal-trail" maskUnits="userSpaceOnUse">
            <path d={TRAIL_D} pathLength={1} fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" className="art-draw" style={{ ...delay(DRAW_FROM), ["--dur" as string]: `${DRAW_FOR}s` }} />
          </mask>
          <mask id="art-reveal-unexplored" maskUnits="userSpaceOnUse">
            <path d={pathOf(UNEXPLORED)} pathLength={1} fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" className="art-draw" style={{ ...delay(passes(ENDS[2])), ["--dur" as string]: "1.1s" }} />
          </mask>
        </defs>

        <rect width="200" height="820" className="fill-[#e6ddcf] dark:fill-[#1c1a18]" />

        {/* La cuadrícula del mapa, apenas. */}
        <g fill="none" strokeWidth="0.5" strokeDasharray="1 4" className="art-fade stroke-ink/10" style={delay(0)}>
          {[50, 100, 150].map((x) => (
            <path key={x} d={`M${x} 0 V 820`} />
          ))}
          {[160, 360, 540].map((y) => (
            <path key={y} d={`M0 ${y} H 200`} />
          ))}
        </g>

        {/* Curvas de nivel: la de adentro, más marcada. */}
        <g fill="none" className="art-fade" style={delay(0.1)}>
          {HILLS.map((h, j) =>
            Array.from({ length: h.rings }, (_, i) => (
              <path key={`${j}-${i}`} d={contour(h.c[0], h.c[1], h.r + i * 11, h.squash, j * 2 + i * 0.8)} strokeWidth={i === 0 ? 0.8 : 0.6} className={i === 0 ? "stroke-ink/25" : "stroke-ink/15"} />
            )),
          )}
          <path d={`M${HILLS[1].c[0] - 3} ${HILLS[1].c[1] + 2} l 3 -5 3 5 z`} className="fill-ink/30" />
        </g>

        {/* El sol detrás de la sierra: el destino. */}
        <g className="art-pop" style={delay(passes(1) - 0.2)}>
          <circle cx="124" cy="222" r="68" fill="url(#art-glow)" className="art-breathe" />
          <circle cx="124" cy="222" r="34" className="fill-accent" />
        </g>
        <path d={`${RIDGE} L 200 300 L 0 300 Z`} className="fill-[#e6ddcf] dark:fill-[#1c1a18]" />
        <path d={RIDGE} fill="none" strokeWidth="0.9" strokeLinejoin="round" className="stroke-ink/45" />

        <text x="26" y="312" transform="rotate(-6 26 312)" fontSize="9" className="art-fade fill-ink/60 font-serif italic" style={delay(2)}>
          Tierra incógnita
        </text>

        <Compass />

        {/* La rama sin explorar, en trazo cortado que avanza muy despacio. */}
        <g mask="url(#art-reveal-unexplored)">
          <path d={pathOf(UNEXPLORED)} fill="none" strokeWidth="1.1" strokeDasharray="3 3" strokeLinecap="round" className="art-march stroke-ink/45" />
        </g>

        {/* El sendero. */}
        <g mask="url(#art-reveal-trail)">
          <path d={TRAIL_D} fill="none" strokeWidth="2.4" strokeDasharray="0 5.5" strokeLinecap="round" className="stroke-accent" />
        </g>

        {STOPS.map((s, i) => (
          <Stop key={s.place} stop={s} lit={i < lit} appear={passes(ENDS[s.segment])} />
        ))}

        <Book />

        {/* El viajero: camina hasta la última parada encendida. */}
        <g className="art-fade" style={delay(passes(0) + 0.2)}>
          <circle r="4.2" strokeWidth="1.6" className="art-traveler fill-accent stroke-surface" style={{ offsetPath: `path("${TRAIL_D}")`, offsetDistance: `${travelled * 100}%` }} />
        </g>
      </svg>
    </div>
  );
}

/**
 * Un hito: una marca sobre el sendero, el dibujo al costado y su nombre.
 * Apagado se ve tenue; cuando llega una pista, se enciende al llegar el viajero.
 */
function Stop({ stop, lit, appear }: { stop: (typeof STOPS)[number]; lit: boolean; appear: number }) {
  const [px, py] = TRAIL[stop.segment][3];
  const { Landmark } = stop;
  return (
    <g data-lit={lit || undefined} className="art-stop">
      <g className="art-pop" style={delay(appear)}>
        <circle cx={px} cy={py} r="2.8" strokeWidth="0.8" className="fill-[#e6ddcf] stroke-ink/45 dark:fill-[#1c1a18]" />
        <circle cx={px} cy={py} r="2.8" className="art-lit-only fill-accent" />
        <g transform={`translate(${stop.glyph[0]} ${stop.glyph[1]})`}>
          <g className="art-landmark">
            <Landmark />
          </g>
        </g>
      </g>
      <text x={stop.label.at[0]} y={stop.label.at[1]} textAnchor={stop.label.anchor ?? "middle"} fontSize="8.5" className="art-fade art-place fill-ink/60 font-serif italic" style={delay(appear + 0.15)}>
        {stop.place}
      </text>
    </g>
  );
}

/* Los dibujos de cada hito, con la base en (0, 0). */

/** Macondo: las mariposas amarillas de Mauricio Babilonia. */
function Butterflies() {
  return (
    <g>
      {(
        [
          [-8, -13, 1, -18],
          [6, -21, 0.8, 16],
          [10, -6, 0.65, -4],
        ] as const
      ).map(([x, y, k, r]) => (
        <g key={`${x}`} transform={`translate(${x} ${y}) rotate(${r}) scale(${k})`}>
          <path d="M0 0 C -5 -9, -12 -5, -8 0 C -6 2.5, -2 1.5, 0 0 Z M0 0 C 5 -9, 12 -5, 8 0 C 6 2.5, 2 1.5, 0 0 Z" strokeWidth="0.7" className="art-wing stroke-ink" />
          <path d="M0 0 C -4 2, -6 6, -2.5 6.5 C -1 6, 0 3, 0 0 Z M0 0 C 4 2, 6 6, 2.5 6.5 C 1 6, 0 3, 0 0 Z" strokeWidth="0.7" className="art-wing stroke-ink" />
          <path d="M0 -3 V 4 M0 -3 l -1.6 -3 M0 -3 l 1.6 -3" fill="none" strokeWidth="0.8" strokeLinecap="round" className="stroke-ink" />
        </g>
      ))}
    </g>
  );
}

/** Nantucket: la cola de la ballena blanca, hundiéndose. */
function WhaleTail() {
  return (
    <g>
      <path d="M0 0 C -1 -6, -2 -10, -3 -13 C -7 -14, -12 -16, -15 -21 C -9 -20, -4 -18, 0 -15 C 4 -18, 9 -20, 15 -21 C 12 -16, 7 -14, 3 -13 C 2 -10, 1 -6, 0 0 Z" className="fill-ink" />
      <g fill="none" strokeWidth="0.8" strokeLinecap="round" className="stroke-ink/55">
        <path d="M-17 1 q 4 -3, 8 0 t 8 0 t 8 0 t 8 0" />
        <path d="M-12 5 q 4 -3, 8 0 t 8 0 t 8 0" />
      </g>
      <g className="art-lit-only fill-accent">
        <circle cx="-15" cy="-17" r="0.9" />
        <circle cx="-13" cy="-13" r="0.7" />
        <circle cx="15" cy="-17" r="0.9" />
        <circle cx="13.5" cy="-12.5" r="0.7" />
      </g>
    </g>
  );
}

/** La Mancha: un molino, el gigante de don Quijote. Al encenderse, da una vuelta. */
function Windmill() {
  return (
    <g strokeLinejoin="round">
      <path d="M-5 0 L -3.6 -16 L 3.6 -16 L 5 0 Z" strokeWidth="0.8" className="fill-[#e6ddcf] stroke-ink dark:fill-[#1c1a18]" />
      <path d="M-4.6 -16 L 0 -21.5 L 4.6 -16 Z" className="fill-ink" />
      <path d="M-1.2 0 V -4 a 1.2 1.2 0 0 1 2.4 0 V 0 Z" className="fill-ink" />
      <g transform="translate(0 -18)">
        <g className="art-sails">
          {[45, 135, 225, 315].map((a) => (
            <g key={a} transform={`rotate(${a})`} fill="none" strokeWidth="0.6" className="stroke-ink">
              <path d="M0 0 V -14" />
              <rect x="0.6" y="-14" width="3.4" height="10" />
              <path d="M2.3 -14 V -4 M0.6 -9 H 4" strokeWidth="0.4" />
            </g>
          ))}
          <circle r="1.3" className="fill-ink" />
        </g>
      </g>
    </g>
  );
}

/** La selva oscura de Dante; encendida, la estrella de la salida: «a riveder le stelle». */
function Forest() {
  return (
    <g>
      {(
        [
          [-9, 17],
          [9, 15],
          [0, 24],
        ] as const
      ).map(([x, h]) => (
        <g key={x}>
          <path d={`M${x} 0 V -3`} strokeWidth="1" className="stroke-ink" />
          <path d={`M${x - 6} -3 L ${x} ${-h * 0.62} L ${x + 6} -3 Z M${x - 4.6} ${-h * 0.45} L ${x} ${-h} L ${x + 4.6} ${-h * 0.45} Z`} className="fill-ink" />
        </g>
      ))}
      <path d="M0 -33 l 0.9 2.6 2.6 0.9 -2.6 0.9 -0.9 2.6 -0.9 -2.6 -2.6 -0.9 2.6 -0.9 z" className="art-lit-only fill-accent" />
    </g>
  );
}

/** El Olimpo: un templo en la cumbre, recortado contra el sol. */
function Temple() {
  return (
    <g strokeLinejoin="round">
      <path d="M-14 0 H 14 V -2.2 H -14 Z" className="fill-ink" />
      {[-10, -4, 2, 8].map((x) => (
        <rect key={x} x={x} y="-14" width="2.4" height="11.8" strokeWidth="0.5" className="art-column fill-[#f4efe6] stroke-ink dark:fill-[#d9d2c4]" />
      ))}
      <path d="M-12.5 -14 H 12.5 V -16.4 H -12.5 Z" className="fill-ink" />
      <path d="M-14 -16.4 L 0 -24 L 14 -16.4 Z" className="fill-ink" />
      <path d="M-8.5 -17.6 L 0 -22 L 8.5 -17.6 Z" className="art-lit-only fill-[#f4efe6] dark:fill-[#d9d2c4]" />
    </g>
  );
}

function Compass() {
  return (
    <g transform="translate(36 560)">
      <g className="art-pop" style={delay(1)}>
        <circle r="15" fill="none" strokeWidth="0.7" className="stroke-ink/35" />
        <circle r="11.5" fill="none" strokeWidth="0.4" strokeDasharray="0.8 2.2" className="stroke-ink/35" />
        <path d="M0 -15 V -12 M0 15 V 12 M-15 0 H -12 M15 0 H 12" strokeWidth="0.7" className="stroke-ink/45" />
        <g className="art-needle" style={delay(1.3)}>
          <path d="M0 -10 L 2.4 0 L 0 1.5 L -2.4 0 Z" className="fill-accent" />
          <path d="M0 10 L 2.4 0 L 0 -1.5 L -2.4 0 Z" className="fill-ink/50" />
        </g>
        <circle r="1" className="fill-surface" />
        <text y="-18" textAnchor="middle" fontSize="6.5" className="fill-ink/60 font-serif">
          N
        </text>
      </g>
    </g>
  );
}

/** El libro abierto del que sale el sendero: el libro es el mapa. */
function Book() {
  const left = "M100 712 C 82 700, 50 694, 14 700 L 11 758 C 46 751, 80 755, 100 768 Z";
  const right = "M100 712 C 118 700, 150 694, 186 700 L 189 758 C 154 751, 120 755, 100 768 Z";
  return (
    <g>
      <ellipse cx="100" cy="772" rx="104" ry="12" fill="url(#art-shadow)" />
      {/* Tapa: un filo de tela que asoma. */}
      <path d="M100 722 C 78 708, 44 704, 6 709 L 3 766 C 44 760, 78 764, 100 773 C 122 764, 156 760, 197 766 L 194 709 C 156 704, 122 708, 100 722 Z" className="fill-[#6e2a1f] dark:fill-[#5a2118]" />
      {/* Cada mitad, con sus hojas de abajo (el grosor) y sus renglones, se abre y se cierra apenas. */}
      {(["l", "r"] as const).map((side) => {
        const dir = side === "l" ? -1 : 1;
        return (
          <g key={side} className={`art-page art-page-${side}`}>
            {[4, 2.5, 1].map((k) => (
              <path key={k} d={side === "l" ? left : right} transform={`translate(${dir * k * 0.9} ${k * 1.5})`} className="fill-[#e9e1d3] dark:fill-[#3a352e]" />
            ))}
            <path d={side === "l" ? left : right} fill={`url(#art-page-${side})`} />
            <g fill="none" strokeLinecap="round" strokeWidth="0.55" className="stroke-ink/20">
              {[0, 1, 2, 3, 4].map((i) =>
                side === "l" ? (
                  <path key={i} d={`M24 ${716 + i * 8} C 46 ${709 + i * 8}, 70 ${710 + i * 8}, ${i === 2 ? 80 : 90} ${717 + i * 8}`} />
                ) : (
                  <path key={i} d={`M${i === 3 ? 122 : 110} ${717 + i * 8} C 130 ${710 + i * 8}, 154 ${709 + i * 8}, 176 ${716 + i * 8}`} />
                ),
              )}
            </g>
          </g>
        );
      })}
      {/* Una página a medio pasar. */}
      <path d="M100 713 C 112 694, 134 682, 160 682 C 162 702, 160 724, 154 744 C 134 742, 114 750, 100 767 Z" fill="url(#art-turn)" />
      <path d="M160 682 C 162 702, 160 724, 154 744" fill="none" strokeWidth="0.5" className="stroke-ink/15" />
      {/* La sombra del pliegue. */}
      <path d="M100 712 L 100 768" strokeWidth="1.2" className="stroke-black/15" />
    </g>
  );
}
