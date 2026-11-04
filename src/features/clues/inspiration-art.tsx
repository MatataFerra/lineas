/**
 * La franja del costado de la home: un libro abierto del que sube una línea
 * que se ramifica hacia lo que inspira (la noche, la música, una idea, una
 * estrella) hasta un sol, el mismo centro que tiene el mapa. Letras sueltas
 * se escapan de las páginas. Cada parte va en su grupo para poder animarla.
 */
export function InspirationArt() {
  return (
    <div className="relative hidden max-w-[260px] flex-[0_0_18%] overflow-hidden md:block" aria-hidden="true" style={{ viewTransitionName: "home-art" }}>
      <svg viewBox="0 0 200 820" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <rect width="200" height="820" className="fill-[#e6ddcf] dark:fill-[#1c1a18]" />

        {/* El sol: el centro del mapa, con su halo. */}
        <g data-part="sun">
          <circle cx="126" cy="182" r="62" fill="none" strokeWidth="1" strokeDasharray="2 6" className="stroke-accent/40" />
          <circle cx="126" cy="182" r="44" className="fill-accent" />
        </g>

        {/* Hojas apiladas como lomas, de lejos a cerca. */}
        <g data-part="pages">
          <path d="M0 560 C 40 540, 70 548, 100 536 C 135 522, 165 534, 200 520 L200 820 L0 820 Z" className="fill-[#d9cdb9] dark:fill-[#25221d]" />
          <path d="M0 610 C 30 596, 62 604, 96 592 C 130 580, 168 596, 200 584 L200 820 L0 820 Z" className="fill-[#c7b8a1] dark:fill-[#2d2924]" />
          <path d="M0 600 C 30 588, 62 596, 96 584" fill="none" strokeWidth="0.8" className="stroke-[#f4f0e8]/60 dark:stroke-[#3a352d]" />
          <path d="M0 662 C 36 648, 70 656, 104 646 C 140 636, 172 648, 200 640 L200 820 L0 820 Z" className="fill-[#a99a84] dark:fill-[#34302a]" />
        </g>

        {/* La línea y sus ramas, desde el pliegue del libro. */}
        <g data-part="lines" fill="none" strokeLinecap="round" className="stroke-accent">
          <path data-line="main" d="M100 704 C 92 660, 112 630, 104 590 C 96 548, 124 520, 118 470 C 112 420, 136 380, 130 330 C 126 290, 128 260, 126 226" strokeWidth="2" />
          <path data-line="moon" d="M101 566 C 84 540, 62 520, 50 470" strokeWidth="1.3" />
          <path data-line="note" d="M119 492 C 140 480, 160 486, 170 468" strokeWidth="1.3" />
          <path data-line="spiral" d="M124 398 C 104 380, 74 374, 62 344" strokeWidth="1.3" />
          <path data-line="star" d="M130 330 C 150 318, 164 304, 168 282" strokeWidth="1.3" />
        </g>

        {/* Lo que inspira: nodos como los del mapa, cada uno con su dibujo. */}
        <g data-part="nodes" strokeLinecap="round" strokeLinejoin="round">
          <Node x={50} y={458}>
            <path d="M54 452 a7 7 0 1 0 0 12 a5.5 5.5 0 1 1 0 -12 z" className="fill-ink" />
          </Node>
          <Node x={172} y={458}>
            <path d="M169 464 v-11 l6 -2 v10" fill="none" strokeWidth="1.3" className="stroke-ink" />
            <circle cx="167.5" cy="464" r="2" className="fill-ink" />
            <circle cx="173.5" cy="461" r="2" className="fill-ink" />
          </Node>
          <Node x={60} y={332}>
            <path d="M60 332 a1.8 1.8 0 0 1 3.6 0 a3.6 3.6 0 0 1 -7.2 0 a5.4 5.4 0 0 1 10.8 0 a7.2 7.2 0 0 1 -14.4 0" fill="none" strokeWidth="1.3" className="stroke-ink" />
          </Node>
          <Node x={168} y={270}>
            <path d="M168 263 l2 5 5 .6 -3.8 3.4 1.2 5 -4.4 -2.6 -4.4 2.6 1.2 -5 -3.8 -3.4 5 -.6 z" className="fill-ink" />
          </Node>
        </g>

        {/* Letras que se escapan de las páginas. */}
        <g data-part="letters" className="fill-[#6b5f50] font-serif dark:fill-[#a39c90]">
          <text x="70" y="652" fontSize="15" opacity="0.8">a</text>
          <text x="132" y="628" fontSize="13" opacity="0.7">ñ</text>
          <text x="80" y="600" fontSize="12" opacity="0.6" fontStyle="italic">¿</text>
          <text x="146" y="560" fontSize="10" opacity="0.5">r</text>
          <text x="34" y="540" fontSize="9" opacity="0.45" fontStyle="italic">e</text>
          <text x="152" y="410" fontSize="8" opacity="0.35">l</text>
          <text x="40" y="250" fontSize="7" opacity="0.3" fontStyle="italic">s</text>
        </g>

        {/* El libro abierto sobre la mesa. */}
        <g data-part="book">
          <rect y="752" width="200" height="68" className="fill-[#3b362f] dark:fill-[#0f0e0c]" />
          <path d="M100 712 C 74 698, 40 696, 10 706 L 10 760 C 40 750, 74 752, 100 766 Z" className="fill-surface stroke-ink" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M100 712 C 126 698, 160 696, 190 706 L 190 760 C 160 750, 126 752, 100 766 Z" className="fill-surface stroke-ink" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M100 712 V 766" strokeWidth="1.2" className="stroke-ink" />
          <g strokeWidth="1" strokeLinecap="round" className="stroke-muted/50">
            <path d="M24 718 C 46 712, 70 713, 90 720" fill="none" />
            <path d="M24 728 C 46 722, 70 723, 90 730" fill="none" />
            <path d="M24 738 C 46 732, 64 733, 78 738" fill="none" />
            <path d="M110 720 C 130 713, 154 712, 176 718" fill="none" />
            <path d="M110 730 C 130 723, 154 722, 176 728" fill="none" />
            <path d="M122 738 C 138 733, 158 732, 176 738" fill="none" />
          </g>
          <circle cx="100" cy="704" r="3.5" className="fill-accent" />
        </g>
      </svg>
    </div>
  );
}

function Node({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <g>
      <circle cx={x} cy={y} r="13" strokeWidth="1" className="fill-surface stroke-ink/70" />
      {children}
    </g>
  );
}
