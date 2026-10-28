"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { ArrowLeftIcon, ArrowRightIcon, PenIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { LANE_META, LANE_ORDER } from "@/lib/graph/labels";
import { recommendationsByLane } from "@/lib/graph/queries";
import type { ConnectionGraph, GraphNode, Lane, Recommendation } from "@/lib/graph/schema";
import { bookSnapshot, useLineas } from "@/lib/store";
import { LibraryNotice } from "@/features/library/library-notice";

export function ResultsScreen() {
  const clues = useLineas((s) => s.clues);
  const graph = useLineas((s) => s.graph);
  const status = useLineas((s) => s.status);
  const error = useLineas((s) => s.error);
  const search = useLineas((s) => s.search);

  // Si se entra directo a /resultados (o cambiaron las pistas), buscar.
  useEffect(() => {
    void search();
  }, [search]);

  const [mobileLane, setMobileLane] = useState<Lane>("affinity");

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
              onClick={() => void search()}
              className="mt-4 h-10 rounded-full bg-ink px-5 text-[13px] text-bg">
              Reintentar
            </button>
          </div>
        )}

        {(status === "loading" || status === "idle" || !graph) && status !== "error" && (
          <ResultsSkeleton />
        )}

        {status === "ready" && graph && (
          <>
            {/* Mobile: un carril a la vez */}
            <div
              role="tablist"
              aria-label="Caminos"
              className="mt-5 grid grid-cols-3 gap-1 rounded-full bg-chip p-1 md:hidden">
              {LANE_ORDER.map((lane) => (
                <button
                  key={lane}
                  role="tab"
                  type="button"
                  aria-selected={lane === mobileLane}
                  onClick={() => setMobileLane(lane)}
                  className={`h-9.5 rounded-full text-xs font-medium ${lane === mobileLane ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>
                  {LANE_META[lane].short}
                </button>
              ))}
            </div>

            <Lanes graph={graph} mobileLane={mobileLane} />

            <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
              <p className="text-[13px] text-muted">
                ¿Ninguno te convence?{" "}
                <Link href="/" className="text-ink underline underline-offset-[3px]">
                  Sumá otra pista
                </Link>{" "}
                y recalculamos.
              </p>
              <Link
                href="/conexiones"
                className="inline-flex h-11 items-center gap-2.5 rounded-full bg-ink px-5 text-[13px] font-medium text-bg hover:opacity-90">
                Ver el mapa de conexiones
                <ArrowRightIcon size={16} />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Lanes({ graph, mobileLane }: { graph: ConnectionGraph; mobileLane: Lane }) {
  const byLane = useMemo(() => recommendationsByLane(graph), [graph]);
  const nodes = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  return (
    <div className="mt-5 grid gap-6 md:mt-9 md:grid-cols-3">
      {LANE_ORDER.map((lane) => (
        <div key={lane} className={lane === mobileLane ? "" : "hidden md:block"}>
          <LaneCard lane={lane} recs={byLane[lane]} nodes={nodes} />
        </div>
      ))}
    </div>
  );
}

function LaneCard({
  lane,
  recs,
  nodes,
}: {
  lane: Lane;
  recs: Recommendation[];
  nodes: Map<string, GraphNode>;
}) {
  const [index, setIndex] = useState(0);
  const library = useLineas((s) => s.library);
  const toggleLibrary = useLineas((s) => s.toggleLibrary);
  const setFocus = useLineas((s) => s.setFocus);

  if (recs.length === 0) return null;
  const rec = recs[index % recs.length];
  const node = nodes.get(rec.nodeId)!;
  const isSaved = !!library[node.id]?.statuses.saved;
  const isRead = !!library[node.id]?.statuses.read;
  const author = node.book?.author ?? node.subtitle ?? "";
  const meta = LANE_META[lane];

  return (
    <article className="flex h-full flex-col md:rounded-2xl md:border md:border-line md:bg-surface md:p-5.5">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={`text-[11px] font-semibold tracking-[0.08em] uppercase ${lane === "beyond" ? "text-accent" : "text-muted"}`}>
          {meta.label}
        </span>
        <span className="text-[11px] text-muted">
          {(index % recs.length) + 1} de {recs.length}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-snug text-muted">{meta.hint}</p>

      <div key={node.id} className="animate-fade flex flex-1 flex-col">
        <div className="mt-4.5 flex gap-4 md:flex-col md:gap-0">
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
        <p className="mt-3.5 text-sm leading-relaxed md:text-[13px] md:leading-normal">
          {rec.pitch}
        </p>
        <Link
          href="/conexiones"
          onClick={() => setFocus(node.id)}
          className="mt-2.5 self-start text-xs text-muted underline underline-offset-[3px] hover:text-ink">
          ¿Cómo llegamos acá?
        </Link>

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
        {recs.length > 1 && (
          <button
            type="button"
            onClick={() => setIndex((i) => i + 1)}
            className="mt-1.5 h-10 text-xs text-muted hover:text-ink">
            No es lo que busco · ver otra
          </button>
        )}
      </div>
    </article>
  );
}

function ResultsSkeleton() {
  return (
    <div aria-live="polite" className="mt-9">
      <p className="animate-soft-pulse text-[13px] text-muted">
        Buscando conexiones entre tus pistas…
      </p>
      <p className="mt-1 text-xs text-muted">
        Armar el mapa y verificar cada libro puede llevar unos segundos.
      </p>
      <div className="mt-4 grid gap-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`animate-soft-pulse flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-5.5 ${i > 0 ? "hidden md:flex" : ""}`}>
            <div className="h-2.5 w-2/5 rounded bg-chip" />
            <div className="mx-auto my-2 h-55 w-37.5 rounded-[3px] bg-chip" />
            <div className="h-4.5 w-2/3 rounded bg-chip" />
            <div className="h-3 w-[45%] rounded bg-chip" />
            <div className="h-3 w-full rounded bg-chip" />
            <div className="h-3 w-[90%] rounded bg-chip" />
          </div>
        ))}
      </div>
    </div>
  );
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "tus pistas";
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}
