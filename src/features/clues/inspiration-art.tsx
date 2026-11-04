import type { CSSProperties, ReactNode } from "react";

/**
 * La franja del costado de la home. Un renglón de un libro abierto llega al
 * pliegue y se levanta: crece como una planta, brota hojas de papel y se
 * ramifica hacia lo que inspira (la noche, la música, una idea, las estrellas)
 * hasta un sol, el mismo centro que tiene el mapa. Letras sueltas se escapan
 * de las páginas.
 *
 * Al cargar, la línea se dibuja desde la página hacia arriba y cada rama
 * florece cuando el trazo llega; después queda viva: se mece, una luz sube por
 * el tallo y cada escena tiene su propio pulso. Todo el movimiento está en
 * globals.css (clases art-*) y se apaga con movimiento reducido.
 */

// El renglón de la página y el tallo se tocan en el pliegue (100, 716), que es también el eje del vaivén.
const TEXT_LINE = "M22 721 C 44 713, 74 713, 100 716";
const STEM = "M100 716 C 104 690, 92 664, 100 636 C 108 606, 96 580, 104 552 C 112 522, 122 498, 118 470 C 114 440, 132 404, 128 370 C 124 336, 132 300, 128 270 C 126 252, 126 238, 126 222";

const BRANCHES = {
  moon: "M104 552 C 86 530, 60 512, 52 488",
  music: "M118 470 C 138 462, 154 460, 162 452",
  idea: "M128 370 C 106 356, 82 352, 74 344",
  stars: "M128 270 C 142 270, 154 272, 162 264",
};

const delay = (s: number) => ({ "--delay": `${s}s` }) as CSSProperties;

export function InspirationArt() {
  return (
    <div className="relative hidden max-w-[260px] flex-[0_0_18%] overflow-hidden md:block" aria-hidden="true" style={{ viewTransitionName: "home-art" }}>
      <svg viewBox="0 0 200 820" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <defs>
          <radialGradient id="art-glow">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          {/* La sombra del pliegue: oscura en el centro, se pierde hacia el borde. */}
          <linearGradient id="art-gutter-l" x1="1" x2="0">
            <stop offset="0" stopColor="#000" stopOpacity="0.16" />
            <stop offset="0.28" stopColor="#000" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="art-gutter-r" x1="0" x2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.16" />
            <stop offset="0.28" stopColor="#000" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width="200" height="820" className="fill-[#e6ddcf] dark:fill-[#1c1a18]" />

        {/* Hojas apiladas como lomas, de lejos a cerca. */}
        <g>
          <path d="M0 560 C 40 540, 70 548, 100 536 C 135 522, 165 534, 200 520 L200 820 L0 820 Z" className="fill-[#d9cdb9] dark:fill-[#23201c]" />
          <path d="M0 612 C 30 598, 62 606, 96 594 C 130 582, 168 598, 200 586 L200 820 L0 820 Z" className="fill-[#c9bba5] dark:fill-[#2a2621]" />
          <path d="M0 602 C 30 590, 62 598, 96 586 C 130 574, 168 590, 200 578" fill="none" strokeWidth="0.7" className="stroke-[#f4f0e8]/70 dark:stroke-[#3a352d]" />
          <path d="M0 664 C 36 650, 70 658, 104 648 C 140 638, 172 650, 200 642 L200 820 L0 820 Z" className="fill-[#ab9c86] dark:fill-[#312d27]" />
        </g>

        {/* Polvo de estrellas en lo alto: aparece cuando el sol ya está. */}
        <g className="art-pop" style={delay(3.8)}>
          {[
            [34, 70, 1.1, 0],
            [70, 32, 0.8, -0.9],
            [168, 58, 1.2, -1.6],
            [186, 112, 0.7, -2.3],
            [22, 150, 0.9, -0.5],
            [58, 108, 0.6, -1.2],
            [150, 22, 0.7, -2],
          ].map(([x, y, r, d]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} className="art-twinkle fill-ink/45" style={delay(d)} />
          ))}
        </g>

        {/* El sol: el centro del mapa. */}
        <g className="art-pop" style={delay(3.4)}>
          <circle cx="126" cy="182" r="76" fill="url(#art-glow)" className="art-breathe" />
          <g className="animate-orbit" style={{ transformOrigin: "126px 182px" }}>
            <circle cx="126" cy="182" r="56" fill="none" strokeWidth="0.9" strokeDasharray="1.5 5.5" className="stroke-accent/50" />
            <circle cx="126" cy="126" r="2" className="fill-accent" />
          </g>
          <circle cx="126" cy="182" r="40" className="fill-accent" />
        </g>

        {/* La planta: se mece desde el pliegue. */}
        <g className="art-sway">
          <g fill="none" strokeLinecap="round" className="stroke-accent">
            <path d={STEM} pathLength={1} strokeWidth="2" className="art-draw" style={{ ...delay(0.7), ["--dur" as string]: "2.6s" }} />
            <path d={BRANCHES.moon} pathLength={1} strokeWidth="1.3" className="art-draw" style={delay(1.5)} />
            <path d={BRANCHES.music} pathLength={1} strokeWidth="1.3" className="art-draw" style={delay(1.9)} />
            <path d={BRANCHES.idea} pathLength={1} strokeWidth="1.3" className="art-draw" style={delay(2.4)} />
            <path d={BRANCHES.stars} pathLength={1} strokeWidth="1.3" className="art-draw" style={delay(2.9)} />
          </g>

          {/* Hojas de papel, con su pliegue. */}
          <Leaf x={100} y={636} angle={-128} delay={1.2} />
          <Leaf x={100} y={636} angle={-40} delay={1.3} small />
          <Leaf x={118} y={470} angle={-150} delay={1.9} small />
          <Leaf x={128} y={370} angle={-30} delay={2.4} />

          {/* Una luz que sube por el tallo, cada tanto. */}
          <circle r="2.6" className="art-pulse fill-surface stroke-accent" strokeWidth="1" style={{ offsetPath: `path("${STEM}")` }} />

          <Moon />
          <Music />
          <Idea />
          <Stars />
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
            <text key={l.c} x={l.x} y={706} fontSize={l.s} fontStyle={l.i ? "italic" : undefined} className="art-rise" style={delay(l.d)}>
              {l.c}
            </text>
          ))}
        </g>

        <Book />
      </svg>
    </div>
  );
}

function Book() {
  const leftPage = "M100 712 C 74 698, 40 696, 12 706 L 12 762 C 40 752, 74 754, 100 768 Z";
  const rightPage = "M100 712 C 126 698, 160 696, 188 706 L 188 762 C 160 752, 126 754, 100 768 Z";
  return (
    <g strokeLinejoin="round">
      <rect y="770" width="200" height="50" className="fill-[#3b362f] dark:fill-[#0f0e0c]" />
      <ellipse cx="100" cy="774" rx="96" ry="5" className="fill-black/20" />
      {/* Tapa, asomando debajo de las hojas. */}
      <path d="M100 722 C 72 708, 36 706, 5 716 L 5 770 C 36 762, 72 764, 100 778 C 128 764, 164 762, 195 770 L 195 716 C 164 706, 128 708, 100 722 Z" className="fill-[#8a3324] dark:fill-[#6a2519]" />
      {/* El grosor de las hojas, en los bordes. */}
      <g fill="none" strokeWidth="0.6" className="stroke-[#cbbfae] dark:stroke-[#4a443b]">
        {[3, 5.5, 8].map((o) => (
          <g key={o}>
            <path d={`M${12 - o * 0.7} ${708 + o} L ${12 - o * 0.7} ${763 + o * 0.6} C 40 ${753 + o}, 74 ${755 + o}, 100 ${768 + o * 0.9}`} />
            <path d={`M${188 + o * 0.7} ${708 + o} L ${188 + o * 0.7} ${763 + o * 0.6} C 160 ${753 + o}, 126 ${755 + o}, 100 ${768 + o * 0.9}`} />
          </g>
        ))}
      </g>
      <path d={leftPage} className="fill-surface" />
      <path d={rightPage} className="fill-surface" />
      <path d={leftPage} fill="url(#art-gutter-l)" />
      <path d={rightPage} fill="url(#art-gutter-r)" />
      <path d={leftPage} fill="none" strokeWidth="0.9" className="stroke-ink/70" />
      <path d={rightPage} fill="none" strokeWidth="0.9" className="stroke-ink/70" />

      {/* Renglones: el primero es la línea que se levanta. */}
      <g fill="none" strokeLinecap="round" strokeWidth="0.9" className="stroke-muted/45">
        <path d="M24 731 C 46 723, 70 724, 92 731" />
        <path d="M24 741 C 46 733, 64 734, 84 739" />
        <path d="M24 751 C 44 743, 70 744, 92 751" />
        <path d="M110 721 C 130 714, 154 713, 176 719" />
        <path d="M108 731 C 130 724, 154 723, 176 729" />
        <path d="M108 741 C 128 734, 146 733, 160 737" />
        <path d="M108 751 C 130 744, 154 743, 176 749" />
      </g>
      <path d={TEXT_LINE} pathLength={1} fill="none" strokeWidth="1.6" strokeLinecap="round" className="art-draw stroke-accent" style={{ ...delay(0), ["--dur" as string]: "0.8s" }} />
    </g>
  );
}

/** Una hoja de papel con su pliegue, que brota cuando el trazo pasa. */
function Leaf({ x, y, angle, delay: d, small = false }: { x: number; y: number; angle: number; delay: number; small?: boolean }) {
  const k = small ? 0.75 : 1;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${k})`}>
      <g className="art-unfold" style={delay(d)}>
        <path d="M0 0 C 6 -7, 18 -8, 26 0 C 18 8, 6 7, 0 0 Z" strokeWidth="0.8" className="fill-surface stroke-ink/60" />
        <path d="M2 0 C 10 -1, 18 -1, 24 0" fill="none" strokeWidth="0.6" className="stroke-accent/60" />
      </g>
    </g>
  );
}

/** Cada escena florece al final de su rama, con un halo que respira. */
function Blossom({ x, y, d, children }: { x: number; y: number; d: number; children: ReactNode }) {
  return (
    <g className="art-pop" style={delay(d)}>
      <circle cx={x} cy={y} r="24" fill="url(#art-glow)" className="art-breathe" />
      {children}
    </g>
  );
}

function Moon() {
  return (
    <Blossom x={48} y={474} d={2.3}>
      <path d="M53 462 a13 13 0 1 0 0 24 a10 10 0 1 1 0 -24 z" className="fill-ink" />
      <Twinkle x={32} y={460} r={1.4} d={0} />
      <Twinkle x={64} y={492} r={1.1} d={-1.1} />
      <Twinkle x={30} y={488} r={0.9} d={-2} />
    </Blossom>
  );
}

function Music() {
  return (
    <Blossom x={170} y={446} d={2.7}>
      {/* Un pentagrama corto que sale de la rama y se curva. */}
      <g fill="none" strokeWidth="0.6" className="stroke-ink/70">
        {[0, 3, 6].map((o) => (
          <path key={o} d={`M158 ${446 + o} C 166 ${441 + o}, 176 ${443 + o}, 188 ${436 + o}`} />
        ))}
      </g>
      <Note x={168} y={446} />
      <Note x={178} y={442} />
      {/* Las notas que se van. */}
      <g className="art-note" style={delay(0)}>
        <Note x={176} y={432} />
      </g>
      <g className="art-note" style={delay(-1.8)}>
        <Note x={166} y={434} small />
      </g>
    </Blossom>
  );
}

function Note({ x, y, small = false }: { x: number; y: number; small?: boolean }) {
  const k = small ? 0.75 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <ellipse cx="0" cy="0" rx="2.4" ry="1.7" transform="rotate(-22)" className="fill-ink" />
      <path d="M2.1 -0.6 V -10 C 4 -8.6, 6 -8, 6.4 -5.4" fill="none" strokeWidth="0.9" strokeLinecap="round" className="stroke-ink" />
    </g>
  );
}

function Idea() {
  return (
    <Blossom x={64} y={336} d={3.2}>
      <circle cx="64" cy="336" r="16" fill="none" strokeWidth="0.6" strokeDasharray="1 3.5" className="stroke-ink/50" />
      <g className="art-spin" style={{ transformOrigin: "64px 336px" }}>
        <path
          d="M64 336 a1.6 1.6 0 0 1 3.2 0 a3.4 3.4 0 0 1 -6.8 0 a5.2 5.2 0 0 1 10.4 0 a7 7 0 0 1 -14 0 a8.8 8.8 0 0 1 17.6 0"
          fill="none"
          strokeWidth="1.3"
          strokeLinecap="round"
          className="stroke-ink"
        />
        <circle cx="81.6" cy="336" r="1.6" className="fill-accent" />
      </g>
    </Blossom>
  );
}

function Stars() {
  const points: [number, number][] = [
    [164, 262],
    [176, 250],
    [186, 258],
    [182, 238],
  ];
  return (
    <Blossom x={176} y={252} d={3.6}>
      <polyline points={points.map((p) => p.join(",")).join(" ")} fill="none" strokeWidth="0.6" className="stroke-ink/50" />
      {points.map(([x, y], i) => (
        <Twinkle key={i} x={x} y={y} r={i === 1 ? 2.2 : 1.4} d={-i * 0.7} solid />
      ))}
      <path d="M176 243 l1.3 5.6 5.6 1.4 -5.6 1.4 -1.3 5.6 -1.3 -5.6 -5.6 -1.4 5.6 -1.4 z" className="art-twinkle fill-ink" style={delay(-0.4)} />
    </Blossom>
  );
}

function Twinkle({ x, y, r, d, solid = false }: { x: number; y: number; r: number; d: number; solid?: boolean }) {
  return <circle cx={x} cy={y} r={r} className={`art-twinkle ${solid ? "fill-ink" : "fill-ink/70"}`} style={delay(d)} />;
}
