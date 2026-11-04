"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { ArrowLeftIcon, ArrowRightIcon, PenIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { VoteControl } from "@/components/vote-control";
import { LANE_META, LANE_ORDER } from "@/lib/graph/labels";
import { recommendedBook } from "@/lib/graph/merge";
import type { Clue, Lane } from "@/lib/graph/schema";
import { bookSnapshot, useLineas, type LaneState } from "@/lib/store";
import { LibraryNotice } from "@/features/library/library-notice";

export function ResultsScreen() {
  const clues = useLineas((s) => s.clues);
  const lanes = useLineas((s) => s.lanes);
  const status = useLineas((s) => s.status);
  const error = useLineas((s) => s.error);
  const search = useLineas((s) => s.search);

  // Si se entra directo a /resultados (o cambiaron las pistas), buscar.
  useEffect(() => {
    void search();
  }, [search]);

  const [mobileLane, setMobileLane] = useState<Lane | null>(null);
  // En mobile, mientras el usuario no elija, se abre el primer carril que llega.
  const firstReady = LANE_ORDER.find((l) => lanes[l].status === "ready");
  const shownLane = mobileLane ?? firstReady ?? "affinity";

  return (
    <div className="min-h-dvh px-5.5 pt-5 pb-12 md:px-14 md:pt-7">
      <div className="mx-auto max-w-290">
        <SiteHeader />

        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-2 py-2 text-[13px] text-muted hover:text-ink md:mt-7">
          <ArrowLeftIcon size={14} />
          Volver
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-170">
            <h1 className="mt-2 font-serif text-[30px] leading-[1.1] tracking-[-0.01em] md:text-[44px] md:leading-[1.08]">
              Tu próxima lectura podría estar acá.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted md:text-[15px]">
              Partimos de {joinLabels(clues.map((c) => c.label))}. Tres caminos: uno cercano, uno
              que se desvía y uno que no esperabas.
            </p>
          </div>
          <Link
            href="/"
            className="hidden h-10 items-center gap-2 rounded-full border border-line px-4 text-[13px] hover:bg-chip md:inline-flex">
            <PenIcon size={14} />
            Editar pistas
          </Link>
        </div>

        {status === "error" && (
          <div role="alert" className="mt-9 rounded-2xl border border-line bg-surface p-6">
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={() => void search({ force: true })}
              className="mt-4 h-10 rounded-full bg-ink px-5 text-[13px] text-bg">
              Reintentar
            </button>
          </div>
        )}

        {status !== "error" && (
          <>
            {/* Mobile: un carril a la vez; el punto dice si ya llegó */}
            <div
              role="tablist"
              aria-label="Caminos"
              className="mt-5 grid grid-cols-3 gap-1 rounded-full bg-chip p-1 md:hidden">
              {LANE_ORDER.map((lane) => (
                <button
                  key={lane}
                  role="tab"
                  type="button"
                  aria-selected={lane === shownLane}
                  onClick={() => setMobileLane(lane)}
                  className={`inline-flex h-9.5 items-center justify-center gap-1.5 rounded-full text-xs font-medium ${lane === shownLane ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>
                  <LaneDot state={lanes[lane]} />
                  {LANE_META[lane].short}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-6 md:mt-9 md:grid-cols-3">
              {LANE_ORDER.map((lane) => (
                <div key={lane} className={lane === shownLane ? "" : "hidden md:block"}>
                  <LaneSlot lane={lane} state={lanes[lane]} clues={clues} />
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
              <p className="text-[13px] text-muted">
                ¿Ninguno te convence?{" "}
                <Link href="/" className="text-ink underline underline-offset-[3px]">
                  Sumá otra pista
                </Link>{" "}
                y recalculamos.
              </p>
              {status === "ready" && (
                <Link
                  href="/conexiones"
                  className="inline-flex h-11 items-center gap-2.5 rounded-full bg-ink px-5 text-[13px] font-medium text-bg hover:opacity-90">
                  Ver el mapa de conexiones
                  <ArrowRightIcon size={16} />
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LaneDot({ state }: { state: LaneState }) {
  const label = state.status === "ready" ? "listo" : state.status === "error" ? "con error" : "en camino";
  return (
    <span
      role="img"
      aria-label={label}
      className={`size-1.5 rounded-full ${state.status === "ready" ? "bg-ink" : state.status === "error" ? "bg-accent" : "animate-soft-pulse border border-muted"}`}
    />
  );
}

const WAITING_COPY: Record<Lane, () => string> = {
  affinity: () => "Primero, lo que está a un paso de tus pistas.",
  alternative: () => "Probando otra puerta: otra época, otra lengua.",
  beyond: () => "Buscando un puente que no esperabas.",
};

function LaneSlot({ lane, state, clues }: { lane: Lane; state: LaneState; clues: Clue[] }) {
  const meta = LANE_META[lane];
  const graph = state.options[state.index];

  return (
    <article
      aria-busy={state.status === "pending"}
      className="flex h-full min-h-80 flex-col md:min-h-[34rem] md:rounded-2xl md:border md:border-line md:bg-surface md:p-5.5">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={`text-[11px] font-semibold tracking-[0.08em] uppercase ${lane === "beyond" ? "text-accent" : "text-muted"}`}>
          {meta.label}
        </span>
        {state.options.length > 1 && (
          <span className="text-[11px] text-muted">
            {state.index + 1} de {state.options.length}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-snug text-muted">{meta.hint}</p>

      {state.status === "pending" && <Waiting lane={lane} from={clues[0]?.label ?? "tus pistas"} />}
      {state.status === "error" && <LaneError lane={lane} message={state.error} />}
      {state.status === "ready" && graph && <LaneCard lane={lane} state={state} />}
    </article>
  );
}

/**
 * Mientras el carril espera, se dibuja su recorrido: directo en afinidad, con
 * un desvío en alternativo y pasando por un puente en «fuera de tu mapa».
 */
const TRACES: Record<Lane, { d: string; bridge?: [number, number] }> = {
  affinity: { d: "M30 30 C 58 30, 100 48, 100 96" },
  alternative: { d: "M30 30 C 118 14, 182 44, 156 72 C 138 90, 104 74, 100 96" },
  beyond: { d: "M30 30 C 52 84, 128 2, 166 40 C 196 70, 112 60, 100 96", bridge: [166, 40] },
};

function Waiting({ lane, from }: { lane: Lane; from: string }) {
  const trace = TRACES[lane];
  return (
    <div className="flex flex-1 flex-col" role="status">
      <svg viewBox="0 0 200 220" aria-hidden="true" className="mx-auto mt-4 h-60 w-full max-w-60 text-ink">
        {/* El camino completo, tenue: se ve adónde va antes de que la línea llegue. */}
        <path d={trace.d} fill="none" stroke="var(--line)" strokeWidth="1.2" strokeDasharray="2 4" strokeLinecap="round" />
        <path
          d={trace.d}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.6"
          strokeLinecap="round"
          // Largo normalizado: la línea siempre llega al final, sea cual sea la curva.
          pathLength={100}
          strokeDasharray={100}
          className="animate-trace"
          style={{ ["--trace-length" as string]: "100" }}
        />
        <circle cx="30" cy="30" r="4.5" fill="currentColor" />
        {trace.bridge && <circle cx={trace.bridge[0]} cy={trace.bridge[1]} r="4.5" fill="var(--surface)" stroke="var(--edge)" strokeWidth="1.4" />}
        <rect x="62" y="96" width="76" height="112" rx="3" fill="none" stroke="var(--edge)" strokeWidth="1.2" strokeDasharray="4 4" className="animate-land" />
        <circle cx="100" cy="96" r="2.5" fill="var(--accent)" className="animate-land" />
      </svg>
      <p className="mt-2 text-[13px] leading-snug">
        Trazando el camino desde <span className="font-serif text-[15px] italic">{from}</span>
      </p>
      <p className="mt-1 text-xs leading-snug text-muted">{WAITING_COPY[lane]()}</p>
    </div>
  );
}

function LaneError({ lane, message }: { lane: Lane; message: string | null }) {
  const retryLane = useLineas((s) => s.retryLane);
  return (
    <div role="alert" className="flex flex-1 flex-col justify-center py-10">
      <p className="text-sm">{message ?? "No pudimos armar este camino."}</p>
      <p className="mt-1 text-xs text-muted">Los otros caminos no se ven afectados.</p>
      <button
        type="button"
        onClick={() => void retryLane(lane)}
        className="mt-4 h-10 self-start rounded-full border border-line px-4 text-[13px] hover:bg-chip">
        Reintentar este camino
      </button>
    </div>
  );
}

function LaneCard({ lane, state }: { lane: Lane; state: LaneState }) {
  const library = useLineas((s) => s.library);
  const toggleLibrary = useLineas((s) => s.toggleLibrary);
  const setFocus = useLineas((s) => s.setFocus);
  const showAnother = useLineas((s) => s.showAnother);
  const recVotes = useLineas((s) => s.recVotes);
  const voteRecommendation = useLineas((s) => s.voteRecommendation);

  const graph = state.options[state.index];
  const rec = graph.recommendations[0];
  const node = recommendedBook(graph);
  if (!rec || !node) return null;
  const isSaved = !!library[node.id]?.statuses.saved;
  const isRead = !!library[node.id]?.statuses.read;
  const author = node.book?.author ?? node.subtitle ?? "";

  return (
    <div key={node.id} className="animate-fade flex flex-1 flex-col">
      <div className={`mt-4.5 flex gap-4 transition-opacity md:flex-col md:gap-0 ${state.loadingMore ? "opacity-40" : ""}`}>
        <div className="md:hidden">
          <BookCover id={node.id} title={node.label} author={author} size="md" coverUrl={node.book?.coverUrl} />
        </div>
        <div className="mx-auto mt-5.5 mb-5 hidden md:block">
          <BookCover id={node.id} title={node.label} author={author} size="lg" coverUrl={node.book?.coverUrl} />
        </div>
        <div className="min-w-0 pt-1 md:pt-0">
          <h2 className="font-serif text-[22px] leading-[1.15] md:text-[23px]">{node.label}</h2>
          <p className="mt-1 text-[13px] text-muted">
            {author} · {node.era.label}
          </p>
          {node.book && !node.book.verified && (
            <p
              className="mt-1.5 text-[11px] text-muted"
              title="No lo encontramos en Google Books ni en Open Library. Puede ser una edición poco difundida, o un error del modelo.">
              Sin verificar en catálogos
            </p>
          )}
        </div>
      </div>
      <p className={`mt-3.5 text-sm leading-relaxed md:text-[13px] md:leading-normal ${state.loadingMore ? "opacity-40" : ""}`}>{rec.pitch}</p>
      <Link
        href="/conexiones"
        onClick={() => setFocus(node.id)}
        className="mt-2.5 self-start text-xs text-muted underline underline-offset-[3px] hover:text-ink">
        ¿Cómo llegamos acá?
      </Link>
      <VoteControl question="¿Te sirve?" value={recVotes[node.id]} onVote={(v) => void voteRecommendation(lane, v)} className="mt-3" />

      <div className="min-h-5 flex-1" />
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          aria-pressed={isSaved}
          onClick={() => void toggleLibrary(bookSnapshot(node), "saved")}
          className={`h-10.5 flex-1 rounded-full border border-accent text-[13px] font-medium ${isSaved ? "text-accent" : "bg-accent text-accent-ink"}`}>
          {isSaved ? "Guardado ✓" : "Guardar"}
        </button>
        <button
          type="button"
          aria-pressed={isRead}
          onClick={() => void toggleLibrary(bookSnapshot(node), "read")}
          className={`h-10.5 flex-1 rounded-full border border-line text-[13px] ${isRead ? "bg-chip" : ""}`}>
          {isRead ? "Leído ✓" : "Ya lo leí"}
        </button>
      </div>
      <LibraryNotice active={isSaved || isRead} />
      <button
        type="button"
        disabled={state.loadingMore}
        onClick={() => void showAnother(lane)}
        className="mt-1.5 h-10 text-xs text-muted hover:text-ink disabled:animate-soft-pulse disabled:hover:text-muted">
        {state.loadingMore ? "Buscando otro libro para este camino…" : "No es lo que busco · ver otra"}
      </button>
      {state.error && !state.loadingMore && (
        <p role="status" className="text-center text-xs text-muted">
          {state.error}
        </p>
      )}
    </div>
  );
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "tus pistas";
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}
