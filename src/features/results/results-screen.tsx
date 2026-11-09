"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { BookCover } from "@/components/book-cover";
import { ArrowLeftIcon, ArrowRightIcon, PenIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { VoteControl } from "@/components/vote-control";
import { LANE_META, LANE_ORDER } from "@/lib/graph/labels";
import { recommendedBook } from "@/lib/graph/merge";
import type { Lane } from "@/lib/graph/schema";
import { bookSnapshot, useLineas, type LaneState, type OptionSource } from "@/lib/store";
import { NoClues } from "@/components/no-clues";
import { authorHref } from "@/lib/authors/link";
import { LaneSearch } from "./lane-search";
import { LibraryNotice } from "@/features/library/library-notice";

export function ResultsScreen() {
  const clues = useLineas((s) => s.clues);
  const lanes = useLineas((s) => s.lanes);
  const status = useLineas((s) => s.status);
  const error = useLineas((s) => s.error);
  const errorNeedsEdit = useLineas((s) => s.errorNeedsEdit);
  const search = useLineas((s) => s.search);
  const engine = useLineas((s) => s.engine);

  // Si se entra directo a /resultados (o cambiaron las pistas), buscar.
  useEffect(() => {
    void search();
  }, [search]);

  const [mobileLane, setMobileLane] = useState<Lane | null>(null);
  // En mobile, mientras el usuario no elija, se abre el primer carril que llega.
  const firstReady = LANE_ORDER.find((l) => lanes[l].status === "ready");
  const shownLane = mobileLane ?? firstReady ?? "affinity";

  if (clues.length === 0) {
    return (
      <div className="min-h-dvh px-5.5 pt-5 pb-12 md:px-14 md:pt-7">
        <div className="mx-auto max-w-290">
          <SiteHeader />
          <NoClues />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh px-5.5 pt-5 pb-12 md:px-14 md:pt-7">
      <div className="mx-auto max-w-290">
        <SiteHeader />

        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-2 py-2 mb-4 text-[13px] text-muted hover:text-ink md:mb-8 md:mt-7">
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

        {engine === "mock" && status !== "error" && (
          <p role="status" className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] leading-relaxed">
            Estás viendo resultados de ejemplo: la IA no está activa y las recomendaciones son siempre las mismas.
            {process.env.NODE_ENV === "development" && <span className="text-muted"> Sacá LINEAS_ENGINE=mock del entorno y reiniciá el servidor.</span>}
          </p>
        )}

        {status === "error" && (
          <div role="alert" className="mt-9 rounded-2xl border border-line bg-surface p-6">
            <p className="text-sm">{error}</p>
            {errorNeedsEdit ? (
              <Link href="/" className="mt-4 inline-flex h-10 items-center rounded-full bg-ink px-5 text-[13px] text-bg">
                Editar pistas
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => void search({ force: true })}
                className="mt-4 h-10 rounded-full bg-ink px-5 text-[13px] text-bg">
                Reintentar
              </button>
            )}
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
                  <LaneSlot lane={lane} state={lanes[lane]} />
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

const WAITING_COPY: Record<Lane, string> = {
  affinity: "Primero, lo que está a un paso de tus pistas.",
  alternative: "Probando otra puerta: otra época, otra lengua.",
  beyond: "Buscando un puente que no esperabas.",
};
/** Si la espera se alarga, el texto lo dice: primero qué se está haciendo, después que los otros caminos no dependen de este. */
const LATE_COPY = ["Todavía buscando. Revisamos que el libro exista en los catálogos.", "Este camino tarda más de lo normal. Los otros siguen por su cuenta."];
const LATE_AFTER = [9000, 22000];

/**
 * waiting: la búsqueda. landing: llegó el libro y el trazo va al hueco.
 * revealing: la tapa aparece en el hueco mientras la búsqueda se apaga.
 * shown: la card sola. Si al montar ya había libro, se muestra sin llegada.
 */
type Phase = "waiting" | "landing" | "revealing" | "shown";
const REVEAL_MS = 260;

function LaneSlot({ lane, state }: { lane: Lane; state: LaneState }) {
  const meta = LANE_META[lane];
  const graph = state.options[state.index];
  const [phase, setPhase] = useState<Phase>(state.status === "pending" ? "waiting" : "shown");
  const [seen, setSeen] = useState(state.status);
  if (state.status !== seen) {
    setSeen(state.status);
    setPhase(state.status === "pending" ? "waiting" : state.status === "ready" && seen === "pending" ? "landing" : "shown");
  }
  useEffect(() => {
    if (phase !== "revealing") return;
    const id = window.setTimeout(() => setPhase("shown"), REVEAL_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  const searching = phase !== "shown" && state.status !== "error";
  const showCard = state.status === "ready" && !!graph && (phase === "revealing" || phase === "shown");

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

      {state.status === "error" && <LaneError lane={lane} message={state.error} />}
      {/* La búsqueda y la card comparten lugar: durante la llegada se cruzan. */}
      <div className="grid flex-1 *:[grid-area:1/1]">
        {searching && <Waiting lane={lane} landing={phase !== "waiting"} leaving={phase === "revealing"} onLanded={() => setPhase("revealing")} />}
        {showCard && <LaneCard lane={lane} state={state} entrance={phase === "revealing" ? "arrive" : "none"} />}
      </div>
    </article>
  );
}

function Waiting({ lane, landing, leaving, onLanded }: { lane: Lane; landing: boolean; leaving: boolean; onLanded: () => void }) {
  const [late, setLate] = useState(0);
  useEffect(() => {
    const ids = LATE_AFTER.map((ms, i) => window.setTimeout(() => setLate(i + 1), ms));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);
  const copy = late === 0 ? WAITING_COPY[lane] : LATE_COPY[late - 1];

  return (
    <div className={`flex flex-col ${leaving ? "leave" : ""}`} role="status" aria-hidden={leaving || undefined}>
      {/* Mismo alto y margen que el bloque de la tapa: el hueco queda donde va a estar el libro. */}
      <div className="mt-4.5 overflow-x-clip">
        <LaneSearch lane={lane} landing={landing} onLanded={onLanded} />
      </div>
      <p key={late} className="animate-fade font-serif text-[19px] leading-snug text-muted italic">
        {copy}
      </p>
      <div className="mt-4 space-y-2" aria-hidden="true">
        {["w-11/12", "w-4/5", "w-3/5"].map((w) => (
          <div key={w} className={`h-2 rounded-full bg-chip ${w}`} />
        ))}
      </div>
    </div>
  );
}

/** Retraso y desplazamiento de cada parte de la card al llegar. */
const beat = (delay: number, rise: number, dur = 300) => ({ "--delay": `${delay}ms`, "--rise": `${rise}px`, "--dur": `${dur}ms` }) as CSSProperties;

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

function LaneCard({ lane, state, entrance }: { lane: Lane; state: LaneState; entrance: "arrive" | "none" }) {
  const library = useLineas((s) => s.library);
  const toggleLibrary = useLineas((s) => s.toggleLibrary);
  const setFocus = useLineas((s) => s.setFocus);
  const showAnother = useLineas((s) => s.showAnother);
  const recVotes = useLineas((s) => s.recVotes);
  const voteRecommendation = useLineas((s) => s.voteRecommendation);

  const graph = state.options[state.index];
  const rec = graph.recommendations[0];
  const node = recommendedBook(graph);
  // Lo que valía al montar: si cambia a mitad de la llegada, la animación no se corta.
  const [firstId] = useState(node?.id);
  const [arrivedFromSearch] = useState(entrance === "arrive");
  if (!rec || !node) return null;
  // Llega con coreografía al salir de la búsqueda, y también al pedir otra.
  const arrive = arrivedFromSearch || node.id !== firstId;
  const cls = (name: string) => (arrive ? name : "");
  const isSaved = !!library[node.id]?.statuses.saved;
  const isRead = !!library[node.id]?.statuses.read;
  const author = node.book?.author ?? node.subtitle ?? "";

  return (
    <div key={node.id} className="flex flex-1 flex-col">
      <div className={`mt-4.5 flex gap-4 transition-opacity md:flex-col md:gap-0 ${state.loadingMore ? "opacity-40" : ""}`}>
        <div className={`md:hidden ${cls("arrive-cover")}`}>
          <BookCover id={node.id} title={node.label} author={author} size="md" coverUrl={node.book?.coverUrl} />
        </div>
        <Link
          href={`/libro/${node.id}`}
          tabIndex={-1}
          aria-hidden="true"
          className={`mx-auto mt-5.5 mb-5 hidden transition-transform hover:-translate-y-0.5 md:block ${cls("arrive-cover")}`}>
          <BookCover id={node.id} title={node.label} author={author} size="lg" coverUrl={node.book?.coverUrl} />
        </Link>
        <div className={`min-w-0 pt-1 md:pt-0 ${cls("arrive")}`} style={beat(70, 6)}>
          <h2 className="font-serif text-[22px] leading-[1.15] md:text-[23px]">
            <Link href={`/libro/${node.id}`} className="hover:underline">
              {node.label}
            </Link>
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            {author ? (
              <Link href={authorHref(author)} className="underline-offset-[3px] hover:text-ink hover:underline">
                {author}
              </Link>
            ) : null}{" "}
            · {node.era.label}
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
      <div className={`flex flex-col ${cls("arrive")}`} style={beat(120, 4, 280)}>
        <p className={`mt-3.5 text-sm leading-relaxed md:text-[13px] md:leading-normal ${state.loadingMore ? "opacity-40" : ""}`}>{rec.pitch}</p>
        <Link
          href="/conexiones"
          onClick={() => setFocus(node.id)}
          className="mt-2.5 self-start text-xs text-muted underline underline-offset-[3px] hover:text-ink">
          ¿Cómo llegamos acá?
        </Link>
        <VoteControl question="¿Te sirve?" value={recVotes[node.id]} onVote={(v) => void voteRecommendation(lane, v)} className="mt-3" />
      </div>

      <div className="min-h-5 flex-1" />
      <div className={`mt-4 flex gap-2 ${cls("arrive")}`} style={beat(170, 0, 240)}>
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
      <SourceNote source={state.sources[state.index]} />
    </div>
  );
}

/** De dónde salió el libro que se ve: así se nota si la IA respondió, si vino del cache o si es el ejemplo fijo. */
function SourceNote({ source }: { source: OptionSource | undefined }) {
  const engine = useLineas((s) => s.engine);
  if (!source) return null;
  const text =
    engine === "mock"
      ? "Ejemplo fijo, sin IA."
      : source.cached
        ? "Guardado de una búsqueda anterior con estas pistas."
        : `Respuesta de la IA en ${(source.ms / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} s.`;
  return <p className="mt-1 text-center text-[11px] text-muted">{text}</p>;
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "tus pistas";
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}
