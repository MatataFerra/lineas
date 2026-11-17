import Link from "next/link";
import type { CSSProperties } from "react";
import { PlusIcon } from "@/components/icons";

/** Sin pistas no hay búsqueda: se invita a volver a la home a armarlas. */
export function NoClues() {
  return (
    <div className="mt-10">
      <Forks />
      <div className="mt-6 max-w-md">
        <h2 className="font-serif text-[28px] leading-tight">Todavía no hay pistas</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">Contanos un libro, una frase, una época o una sensación, y trazamos tres caminos desde ahí.</p>
        <Link
          href="/"
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[13px] font-medium text-accent-ink transition-[opacity,scale] duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95"
        >
          <PlusIcon size={14} strokeWidth={2} />
          Agregar pistas
        </Link>
      </div>
    </div>
  );
}

/**
 * La pista que falta (el anillo punteado) y los caminos que saldrían de ella:
 * un tronco que se abre en tres, y cada uno se vuelve a abrir antes de
 * perderse. Se dibujan una vez, de la pista hacia afuera.
 */
const BRANCHES = [
  "M96 84 C150 84 170 40 236 36",
  "M96 84 C150 84 180 86 236 88",
  "M96 84 C150 84 170 128 236 134",
];
const FORKS = [
  "M236 36 C300 36 330 12 540 10",
  "M236 36 C300 36 340 54 540 58",
  "M236 88 C300 88 340 72 540 74",
  "M236 88 C300 88 330 110 540 112",
  "M236 134 C300 134 340 122 540 126",
  "M236 134 C300 134 330 156 540 162",
];
const JOINTS: [number, number][] = [
  [236, 36],
  [236, 88],
  [236, 134],
];

function Forks() {
  return (
    <svg
      viewBox="0 0 560 168"
      preserveAspectRatio="xMinYMid meet"
      className="block h-auto w-full max-w-xl fill-none stroke-edge [mask-image:linear-gradient(to_right,#000_50%,transparent)]"
      aria-hidden="true"
    >
      <circle cx="10" cy="84" r="6" className="stroke-accent" strokeWidth="1.5" strokeDasharray="2.5 2.5" vectorEffect="non-scaling-stroke" />
      <Stroke d="M16 84 H96" width={1.5} delay={0} />
      {BRANCHES.map((d) => (
        <Stroke key={d} d={d} width={1.25} delay={280} />
      ))}
      {JOINTS.map(([cx, cy]) => (
        <circle key={cy} cx={cx} cy={cy} r="2.5" className="arrive fill-edge stroke-none" style={{ "--delay": "780ms", "--rise": "0px" } as CSSProperties} />
      ))}
      {FORKS.map((d) => (
        <Stroke key={d} d={d} width={1} delay={820} />
      ))}
    </svg>
  );
}

function Stroke({ d, width, delay }: { d: string; width: number; delay: number }) {
  return (
    <path
      d={d}
      pathLength={1}
      strokeWidth={width}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      className="draw"
      style={{ "--delay": `${delay}ms` } as CSSProperties}
    />
  );
}
