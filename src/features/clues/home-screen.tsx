"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightIcon, CloseIcon, PlusIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { CLUE_KIND_META } from "@/lib/graph/labels";
import type { ClueKind } from "@/lib/graph/schema";
import { useLineas } from "@/lib/store";
import { STARTER_IDEAS } from "./catalog";
import { ClueDialog } from "./clue-dialog";

export function HomeScreen() {
  const router = useRouter();
  const clues = useLineas((s) => s.clues);
  const addClue = useLineas((s) => s.addClue);
  const removeClue = useLineas((s) => s.removeClue);
  const search = useLineas((s) => s.search);

  const [draft, setDraft] = useState("");
  const [dialogKind, setDialogKind] = useState<ClueKind | null>(null);

  const go = () => {
    if (clues.length === 0) return;
    void search();
    router.push("/resultados");
  };

  return (
    <div className="flex min-h-dvh">
      <Landscape />

      <div className="flex min-w-0 flex-1 flex-col px-[22px] pt-5 pb-7 md:px-16 md:pt-7 md:pb-8">
        <SiteHeader />

        <main className="mt-12 max-w-[720px] md:mt-24">
          <h1 className="font-serif text-[38px] leading-[1.08] tracking-[-0.015em] md:text-[58px] md:leading-[1.06]">
            No sabés qué leer.
            <br />
            Pero sabés qué te mueve.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted md:mt-5 md:text-base">
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
              placeholder="¿Qué libros, ideas o historias te inspiran?"
              className="bg-transparent py-1 text-base outline-none placeholder:text-muted md:text-[15px]"
            />
            <div className="flex flex-wrap items-center gap-2 md:gap-2.5">
              {clues.map((clue) => (
                <span
                  key={clue.id}
                  title={CLUE_KIND_META[clue.kind].label}
                  className="inline-flex h-[34px] items-center gap-0.5 rounded-full border border-line bg-chip pr-0.5 pl-3 text-[13px] md:pl-3.5"
                >
                  {clue.label}
                  <button type="button" aria-label={`Quitar ${clue.label}`} onClick={() => removeClue(clue.id)} className="flex size-[30px] items-center justify-center text-muted hover:text-ink">
                    <CloseIcon size={12} strokeWidth={2} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                aria-label="Añadir pista"
                onClick={() => setDialogKind("book")}
                className="flex size-[34px] items-center justify-center rounded-full border border-dashed border-line text-muted hover:text-ink"
              >
                <PlusIcon size={14} />
              </button>
              <div className="flex-1" />
              <button
                type="button"
                aria-label="Buscar lecturas"
                onClick={go}
                disabled={clues.length === 0}
                className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <ArrowRightIcon />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDialogKind("book")}
            className="mt-2 inline-flex items-center gap-2 py-3 text-[13px] font-medium text-accent md:mt-3 md:py-2 md:font-normal md:text-muted md:hover:text-ink"
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
                className="h-[38px] rounded-full border border-line px-4 text-[13px] hover:bg-chip md:px-[18px]"
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
function Landscape() {
  return (
    <div className="relative hidden max-w-[260px] flex-[0_0_18%] overflow-hidden md:block" aria-hidden="true">
      <svg viewBox="0 0 200 820" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <rect width="200" height="820" className="fill-[#e4dccf] dark:fill-[#1c1a18]" />
        <polygon points="0,330 40,270 80,300 120,240 160,290 200,250 200,820 0,820" className="fill-[#cec3b2] dark:fill-[#29261f]" />
        <polygon points="0,420 50,360 95,400 140,340 200,390 200,820 0,820" className="fill-[#a69986] dark:fill-[#332f28]" />
        <rect y="470" width="200" height="350" className="fill-[#8b7f6e] dark:fill-[#201e1a]" />
        <polygon points="97,470 103,470 190,820 10,820" className="fill-[#4a443c] dark:fill-[#0c0b0a]" />
        <line x1="100" y1="476" x2="100" y2="820" strokeWidth="2.5" strokeDasharray="12 16" className="stroke-[#f4f0e8] dark:stroke-[#d9b36a]" />
      </svg>
    </div>
  );
}
