"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { ArrowRightIcon, CheckIcon, ClueKindIcon, CloseIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { CLUE_KIND_META, CLUE_KIND_ORDER } from "@/lib/graph/labels";
import type { ClueKind } from "@/lib/graph/schema";
import { useLineas } from "@/lib/store";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { searchCatalog, type CatalogItem } from "./catalog";

interface ClueDialogProps {
  initialKind?: ClueKind;
  onClose: () => void;
  /** Mobile: el botón "Buscar con N pistas" del pie. */
  onSearch: () => void;
}

/**
 * Agregar pistas.
 * Desktop: modal; elegir un resultado lo agrega y cierra.
 * Mobile: pantalla completa; se marcan y desmarcan varias pistas sin salir.
 *
 * Se monta solo mientras está abierto (el padre lo renderiza condicionalmente),
 * así cada apertura empieza limpia.
 */
export function ClueDialog({ initialKind = "book", onClose, onSearch }: ClueDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [kind, setKind] = useState<ClueKind>(initialKind);
  const [query, setQuery] = useState("");

  const clues = useLineas((s) => s.clues);
  const addClue = useLineas((s) => s.addClue);
  const toggleClue = useLineas((s) => s.toggleClue);
  const removeClue = useLineas((s) => s.removeClue);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const results = useMemo(() => searchCatalog(kind, query), [kind, query]);
  const trimmed = query.trim();
  const exact = results.some((r) => r.label.toLowerCase() === trimmed.toLowerCase());
  const meta = CLUE_KIND_META[kind];
  const isChosen = (label: string) => clues.some((c) => c.label.toLowerCase() === label.toLowerCase());

  const pick = (label: string) => {
    if (isDesktop) {
      addClue(label, kind);
      onClose();
    } else {
      toggleClue(label, kind);
      setQuery("");
    }
  };

  return (
    <dialog
      ref={ref}
      aria-label="Añadir pistas"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="animate-sheet md:animate-fade m-0 h-dvh max-h-none w-full max-w-none bg-bg p-0 text-ink md:mx-auto md:mt-[72px] md:h-fit md:max-h-[calc(100dvh-120px)] md:max-w-[880px] md:rounded-[18px] md:border md:border-line md:bg-surface md:shadow-[0_30px_80px_rgba(0,0,0,0.18)]"
    >
      <div className="flex h-full flex-col md:block md:h-auto md:p-7 md:pb-5">
        {/* Encabezado mobile */}
        <div className="flex shrink-0 items-center justify-between border-b border-line px-3 pt-3 pb-2 md:hidden">
          <button type="button" aria-label="Cerrar" onClick={onClose} className="flex size-11 items-center justify-center">
            <CloseIcon />
          </button>
          <h2 className="font-serif text-[21px]">Añadir pistas</h2>
          <button type="button" onClick={onClose} className="h-11 px-2.5 text-sm font-semibold text-accent">
            Listo
          </button>
        </div>

        {/* Encabezado desktop */}
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div>
            <h2 className="font-serif text-[28px]">
              Añadir una pista
            </h2>
            <p className="mt-1.5 text-[13px] leading-normal text-muted">
              Elegí una categoría o escribí libremente. Cada pista nos ayuda a encontrar mejores recomendaciones.
            </p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="flex size-10 shrink-0 items-center justify-center hover:opacity-75">
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pt-4 pb-6 md:mt-5 md:grid md:grid-cols-[280px_minmax(0,1fr)] md:gap-7 md:overflow-visible md:p-0">
          {/* Pistas actuales (mobile) */}
          <div className="md:hidden">
            <div className="px-5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Tus pistas · {clues.length}</div>
            <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto px-5">
              {clues.length === 0 && <span className="text-[13px] text-muted">Todavía no agregaste ninguna.</span>}
              {clues.map((clue) => (
                <span key={clue.id} className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full border border-line bg-chip pr-0.5 pl-3 text-[13px] whitespace-nowrap">
                  <span className="text-[11px] text-muted">{CLUE_KIND_META[clue.kind].short}</span>
                  {clue.label}
                  <button type="button" aria-label={`Quitar ${clue.label}`} onClick={() => removeClue(clue.id)} className="flex size-[30px] items-center justify-center text-muted">
                    <CloseIcon size={12} strokeWidth={2} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Categorías: pastillas en mobile, lista en desktop */}
          <div role="group" aria-label="Tipo de pista" className="no-scrollbar mt-5 flex gap-2 overflow-x-auto px-5 md:mt-0 md:flex-col md:gap-0.5 md:overflow-visible md:px-0">
            {CLUE_KIND_ORDER.map((k) => {
              const active = k === kind;
              const m = CLUE_KIND_META[k];
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setKind(k);
                    setQuery("");
                  }}
                  className={[
                    "flex shrink-0 items-center gap-[7px] rounded-full border px-3.5 py-0 text-[13px] font-medium whitespace-nowrap h-10",
                    "md:h-auto md:items-start md:gap-3.5 md:rounded-[10px] md:border-0 md:px-3 md:py-[11px] md:text-left md:whitespace-normal",
                    active ? "border-ink bg-ink text-bg md:bg-chip-active md:text-ink" : "border-line md:bg-transparent md:hover:bg-chip-active/60",
                  ].join(" ")}
                >
                  <ClueKindIcon kind={k} size={18} className={`shrink-0 md:mt-px ${active ? "md:text-accent" : "md:text-muted"}`} />
                  <span className="flex flex-col gap-0.5">
                    <span className="md:text-sm">{isDesktop ? m.label : m.short}</span>
                    <span className="hidden text-xs leading-snug font-normal text-muted md:block">{m.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex min-w-0 flex-col px-5 md:mt-0 md:px-0">
            <p className="mb-2.5 text-[13px] text-muted md:hidden">{meta.description}.</p>
            <label className="flex h-12 items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 md:h-11 md:rounded-[10px] md:bg-bg">
              <SearchIcon size={16} className="text-muted" />
              <span className="sr-only">{meta.placeholder}</span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && trimmed) {
                    e.preventDefault();
                    pick(results[0]?.label ?? trimmed);
                  }
                }}
                placeholder={meta.placeholder}
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted md:text-sm"
              />
            </label>

            <div className="mt-5 mb-2 hidden text-[11px] font-semibold tracking-[0.08em] text-muted uppercase md:block">
              {trimmed ? "Resultados" : "Sugerencias"}
            </div>

            <div className="mt-2.5 flex flex-col md:mt-0 md:max-h-[360px] md:gap-0.5 md:overflow-y-auto">
              {trimmed && !exact && (
                <button
                  type="button"
                  onClick={() => pick(trimmed)}
                  className="mb-1.5 flex items-center gap-3 rounded-xl border border-dashed border-line px-3.5 py-3 text-left text-sm hover:bg-chip/60"
                >
                  <PlusIcon size={16} strokeWidth={2} className="text-accent" />
                  Agregar «{trimmed}»{isDesktop ? ` como ${meta.short.toLowerCase()}` : ""}
                </button>
              )}
              {results.map((item) => (
                <ResultRow key={item.label} item={item} kind={kind} chosen={isChosen(item.label)} isDesktop={isDesktop} onPick={() => pick(item.label)} />
              ))}
              {trimmed && results.length === 0 && (
                <p className="mt-2 text-[13px] text-muted">No encontramos coincidencias. Podés agregarla igual como pista.</p>
              )}
            </div>
          </div>
        </div>

        {/* Pie */}
        <div className="shrink-0 border-t border-line px-5 pt-3 pb-6 md:hidden">
          <button
            type="button"
            onClick={onSearch}
            disabled={clues.length === 0}
            className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full bg-accent text-[15px] font-medium text-accent-ink disabled:opacity-50"
          >
            Buscar con {clues.length} {clues.length === 1 ? "pista" : "pistas"}
            <ArrowRightIcon size={16} />
          </button>
        </div>
        <div className="mt-[18px] hidden justify-end border-t border-line pt-3.5 md:flex">
          <button type="button" onClick={onClose} className="h-10 px-4 text-[13px] text-muted hover:text-ink">
            Cancelar
          </button>
        </div>
      </div>
    </dialog>
  );
}

function ResultRow({ item, kind, chosen, isDesktop, onPick }: { item: CatalogItem; kind: ClueKind; chosen: boolean; isDesktop: boolean; onPick: () => void }) {
  const words = item.label.split(" ");
  const initials = words[0].charAt(0) + (words.length > 1 ? words[words.length - 1].charAt(0) : "");
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={isDesktop ? undefined : chosen}
      className="flex items-center gap-3.5 border-b border-line py-2.5 text-left md:rounded-[10px] md:border-0 md:px-3 md:py-2 md:hover:bg-chip/60"
    >
      {kind === "book" ? (
        <BookCover id={item.label} title={item.label} size="sm" />
      ) : kind === "author" ? (
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-chip font-serif text-base">
          {initials}
        </span>
      ) : (
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-chip font-serif text-lg text-muted">
          {item.label.charAt(0)}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="text-sm leading-tight font-medium">{item.label}</span>
        <span className="text-xs text-muted">{item.detail}</span>
      </span>
      {isDesktop ? (
        <span className="rounded-full border border-line px-[9px] py-[3px] text-[11px] text-muted">{CLUE_KIND_META[kind].short}</span>
      ) : (
        <span
          aria-hidden="true"
          className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${chosen ? "border-accent bg-accent text-accent-ink" : "border-line text-muted"}`}
        >
          {chosen ? <CheckIcon size={14} /> : <PlusIcon size={14} strokeWidth={2} />}
        </span>
      )}
    </button>
  );
}
