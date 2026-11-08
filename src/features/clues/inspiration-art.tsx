import type { CSSProperties } from "react";
import { MAX_CLUES } from "@/lib/graph/schema";
import { contour, pathOf, segmentEnds, type Cubic, type Pt } from "./trail";

/**
 * La franja del costado de la home: un mapa de expedición. Del pliegue de un
 * libro abierto sale un sendero que sube entre lomas hasta un paso en la
 * sierra, donde asoma el sol (el mismo centro que tiene el mapa de la app).
 * A mitad de camino se bifurca: una rama queda sin explorar.
 *
 * Las paradas del sendero son las pistas: cada pista que se suma enciende una
 * parada y el viajero camina hasta ella; si se quita, vuelve. Así el dibujo
 * responde a lo que se escribe al lado.
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
  [[104, 320], [106, 300], [122, 284], [124, 262]],
];
const TRAIL_D = pathOf(TRAIL);
const ENDS = segmentEnds(TRAIL);

// Una parada al final de cada tramo menos el penúltimo: la última es el paso de la sierra.
const STOPS = [0, 1, 2, 3, 5].map((i) => ({ at: TRAIL[i][3], fraction: ENDS[i] }));

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

const RIDGE = "M0 266 C 12 262, 18 254, 26 254 C 34 254, 38 262, 46 260 C 54 258, 58 244, 68 242 C 78 240, 84 256, 94 254 C 104 252, 108 246, 114 250 C 118 254, 120 262, 124 262 C 128 262, 134 248, 146 245 C 158 242, 164 254, 174 252 C 184 250, 190 246, 200 250";

const DRAW_FROM = 0.3;
const DRAW_FOR = 1.6;

const delay = (s: number) => ({ "--delay": `${s}s` }) as CSSProperties;
/** Cuándo pasa el trazo por una fracción del sendero (aproximado: el trazo acelera y frena). */
const passes = (fraction: number) => DRAW_FROM + DRAW_FOR * fraction;

export function InspirationArt({ discoveries }: { discoveries: number }) {
  const lit = Math.max(0, Math.min(discoveries, MAX_CLUES, STOPS.length));
  const travelled = lit === 0 ? 0 : STOPS[lit - 1].fraction;

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
            <path d={pathOf(UNEXPLORED)} pathLength={1} fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" className="art-draw" style={{ ...delay(passes(STOPS[2].fraction)), ["--dur" as string]: "1.1s" }} />
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

        {/* El mar de abajo, en tres trazos de ola. */}
        <g fill="none" strokeWidth="0.7" strokeLinecap="round" className="art-fade stroke-ink/30" style={delay(0.2)}>
          <path d="M22 652 q 4 -3, 8 0 t 8 0 t 8 0" />
          <path d="M32 662 q 4 -3, 8 0 t 8 0" />
          <path d="M18 670 q 4 -3, 8 0 t 8 0 t 8 0 t 8 0" />
        </g>

        {/* El sol detrás de la sierra: el destino. */}
        <g className="art-pop" style={delay(passes(1) - 0.2)}>
          <circle cx="124" cy="226" r="70" fill="url(#art-glow)" className="art-breathe" />
          <circle cx="124" cy="226" r="36" className="fill-accent" />
        </g>
        <path d={`${RIDGE} L 200 290 L 0 290 Z`} className="fill-[#e6ddcf] dark:fill-[#1c1a18]" />
        <path d={RIDGE} fill="none" strokeWidth="0.9" strokeLinejoin="round" className="stroke-ink/45" />

        {/* Topónimos. */}
        <g className="fill-ink/60 font-serif italic" fontSize="9">
          <text x="24" y="686" className="art-fade" style={delay(2)}>
            Mar de la nostalgia
          </text>
          <text x="150" y="488" textAnchor="middle" className="art-fade" style={delay(2.08)}>
            Paso Beat
          </text>
          <text x="26" y="312" transform="rotate(-6 26 312)" className="art-fade" style={delay(2.16)}>
            Tierra incógnita
          </text>
        </g>

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
          <Stop key={i} at={s.at} lit={i < lit} appear={passes(s.fraction)} />
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

/** Una parada: un lomo de libro parado junto al sendero, apagado hasta que llega una pista. */
function Stop({ at: [x, y], lit, appear }: { at: Pt; lit: boolean; appear: number }) {
  return (
    <g transform={`translate(${x + 7} ${y})`} data-lit={lit || undefined} className="art-stop">
      <g className="art-pop" style={delay(appear)}>
        <rect x="-4.5" y="-15" width="9" height="14" rx="1.2" strokeWidth="0.8" className="fill-[#e6ddcf] stroke-ink/40 dark:fill-[#1c1a18]" />
        <g className="art-stop-lit">
          <rect x="-4.5" y="-15" width="9" height="14" rx="1.2" className="fill-ink" />
          <rect x="-4.5" y="-11.5" width="9" height="2" className="fill-accent" />
          <rect x="-2" y="-6" width="4" height="0.8" className="fill-bg/60" />
        </g>
      </g>
    </g>
  );
}

function Compass() {
  return (
    <g transform="translate(36 556)">
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
