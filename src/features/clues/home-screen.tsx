"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightIcon, ClueKindIcon, CloseIcon, PlusIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { CLUE_KIND_META } from "@/lib/graph/labels";
import { MAX_CLUES, type ClueKind } from "@/lib/graph/schema";
import { useLineas } from "@/lib/store";
import { STARTER_IDEAS } from "./catalog";
import { ClueDialog } from "./clue-dialog";
import { InspirationArt } from "./inspiration-art";

export function HomeScreen() {
  const router = useRouter();
  const clues = useLineas((s) => s.clues);
  const addClue = useLineas((s) => s.addClue);
  const removeClue = useLineas((s) => s.removeClue);
  const search = useLineas((s) => s.search);

  const [draft, setDraft] = useState("");
  const [dialogKind, setDialogKind] = useState<ClueKind | null>(null);
  const full = clues.length >= MAX_CLUES;

  const go = () => {
    if (clues.length === 0) return;
    void search();
    router.push("/resultados");
  };

  return (
    <div className="flex min-h-dvh">
      <InspirationArt discoveries={clues.length} />

      <div className="flex min-w-0 flex-1 flex-col px-[22px] pt-5 pb-7 md:px-16 md:pt-7 md:pb-8">
        <SiteHeader />

        <main className="mt-12 w-full max-w-[1240px] md:mt-20 lg:mt-24">
          <h1 className="font-serif text-[38px] leading-[1.08] tracking-[-0.015em] md:text-[58px] md:leading-[1.06] xl:text-[68px]">
            No sabés qué leer.
            <br />
            Pero sabés qué te mueve.
          </h1>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-muted md:mt-5 md:text-base">
            Un libro, una frase, una idea, una época.
            <br className="hidden md:block" /> Contanos qué te inspira y encontramos tu próxima lectura.
          </p>

          <div className="mt-7 flex flex-col gap-3 rounded-2xl border border-line bg-surface py-3.5 pr-3 pl-3.5 md:mt-9 md:gap-3.5 md:py-[18px] md:pr-[18px] md:pl-[22px]">
            <label htmlFor="pista-libre" className="sr-only">
              Escribí una pista
            </label>
            <input
              id="pista-libre"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) {
                  addClue(draft, "idea");
                  setDraft("");
                }
              }}
              disabled={full}
              placeholder={full ? `Llegaste a ${MAX_CLUES} pistas. Quitá una para sumar otra.` : "¿Qué libros, ideas o historias te inspiran?"}
              className="bg-transparent py-1 text-base outline-none placeholder:text-muted md:text-[15px]"
            />
            {/* Las pistas se acomodan en filas; la flecha queda siempre a la derecha, abajo. */}
            <div className="flex items-end gap-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 md:gap-2.5">
                {clues.map((clue) => (
                  <span
                    key={clue.id}
                    title={CLUE_KIND_META[clue.kind].label}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-chip pr-0.5 pl-2.5 text-[13px] md:pl-3"
                  >
                    <ClueKindIcon kind={clue.kind} size={14} className="text-muted" />
                    {clue.label}
                    <button type="button" aria-label={`Quitar ${clue.label}`} onClick={() => removeClue(clue.id)} className="flex size-[30px] items-center justify-center text-muted hover:text-ink">
                      <CloseIcon size={12} strokeWidth={2} />
                    </button>
                  </span>
                ))}
                {!full && (
                  <button
                    type="button"
                    aria-label="Añadir pista"
                    onClick={() => setDialogKind("book")}
                    className="flex size-9 items-center justify-center rounded-lg text-ink hover:bg-chip"
                  >
                    <PlusIcon size={16} />
                  </button>
                )}
              </div>
              <button
                type="button"
                aria-label="Buscar lecturas"
                onClick={go}
                disabled={clues.length === 0}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <ArrowRightIcon />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDialogKind("book")}
            disabled={full}
            className="mt-2 inline-flex disabled:pointer-events-none disabled:opacity-0 items-center gap-2 py-3 text-[13px] font-medium text-accent md:mt-3 md:py-2 md:font-normal md:text-muted md:hover:text-ink"
          >
            <PlusIcon size={12} strokeWidth={2.2} />
            Añadir otra pista
          </button>

          <h2 className="mt-8 font-serif text-lg md:mt-16 md:text-[19px]">O empezá por alguna de estas ideas</h2>
          <div className="mt-3.5 flex flex-wrap gap-2 md:mt-4 md:gap-2.5">
            {STARTER_IDEAS.map((idea) => (
              <button
                key={idea.label}
                type="button"
                onClick={() => addClue(idea.label, idea.kind)}
                disabled={full}
                className="h-[38px] rounded-full border border-line px-4 text-[13px] hover:bg-chip disabled:opacity-40 disabled:hover:bg-transparent md:px-[18px]"
              >
                {idea.label}
              </button>
            ))}
          </div>
        </main>

        <footer className="mt-auto pt-8 text-xs leading-relaxed text-muted md:pt-14">
          ¿No sabés qué buscar todavía?
          <br />
          <button type="button" onClick={() => setDialogKind("feeling")} className="text-ink underline underline-offset-[3px]">
            Empezá por una sensación.
          </button>
        </footer>
      </div>

      {dialogKind && (
        <ClueDialog
          initialKind={dialogKind}
          onClose={() => setDialogKind(null)}
          onSearch={() => {
            setDialogKind(null);
            go();
          }}
        />
      )}
    </div>
  );
}

/** Franja de paisaje del diseño original: una ruta que se pierde en el horizonte. */
