"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { PlusIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useLineas, type LibraryEntry } from "@/lib/store";

type Filter = "all" | "saved" | "read";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "saved", label: "Por leer" },
  { id: "read", label: "Leídos" },
];

const latest = (entry: LibraryEntry) => Object.values(entry.statuses).sort().at(-1) ?? "";

export function LibraryScreen() {
  const user = useLineas((s) => s.user);
  const authReady = useLineas((s) => s.authReady);
  const library = useLineas((s) => s.library);
  const libraryError = useLineas((s) => s.libraryError);
  const [filter, setFilter] = useState<Filter>("all");

  const entries = useMemo(
    () =>
      Object.values(library)
        .filter((e) => (filter === "all" ? true : filter === "saved" ? e.statuses.saved && !e.statuses.read : !!e.statuses.read))
        .sort((a, b) => latest(b).localeCompare(latest(a))),
    [library, filter],
  );

  return (
    <div className="min-h-dvh px-[22px] pt-5 pb-12 md:px-14 md:pt-7">
      <div className="mx-auto max-w-[1160px]">
        <SiteHeader />

        <h1 className="mt-10 font-serif text-[30px] leading-[1.1] md:mt-16 md:text-[44px]">Mi biblioteca</h1>
        <p className="mt-2.5 text-sm text-muted md:text-[15px]">Los libros que te acompañan, las lecturas que te transforman.</p>

        {authReady && !user && isSupabaseConfigured() && (
          <p className="mt-6 rounded-xl border border-line bg-surface p-4 text-sm">
            Lo que guardes ahora se pierde al cerrar la pestaña.{" "}
            <Link href="/ingresar?next=%2Fbiblioteca" className="underline underline-offset-[3px]">
              Ingresá
            </Link>{" "}
            para conservar tu biblioteca.
          </p>
        )}
        {libraryError && (
          <p role="alert" className="mt-6 text-sm text-accent">
            {libraryError}
          </p>
        )}

        <div role="group" aria-label="Filtrar" className="mt-7 flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`h-9 rounded-full border px-4 text-[13px] ${filter === f.id ? "border-ink bg-ink text-bg" : "border-line hover:bg-chip"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col">
              <BookCover id={entry.id} title={entry.title} author={entry.author ?? undefined} size="md" />
              <span className="mt-3 font-serif text-base leading-tight">{entry.title}</span>
              <span className="mt-1 text-xs text-muted">{[entry.author, entry.yearLabel].filter(Boolean).join(" · ")}</span>
              <span className="mt-1.5 text-[11px] text-muted">{entry.statuses.read ? "Leído" : "Por leer"}</span>
            </li>
          ))}
          <li>
            <Link
              href="/"
              className="flex h-[170px] w-[116px] flex-col items-center justify-center gap-2 rounded-[3px] border border-dashed border-line text-xs text-muted hover:text-ink"
            >
              <PlusIcon size={18} />
              Buscar libros
            </Link>
          </li>
        </ul>

        {entries.length === 0 && (
          <p className="mt-6 text-sm text-muted">
            {filter === "all" ? "Todavía no guardaste libros. Tocá «Guardar» en cualquier recomendación." : "No hay libros en esta categoría."}
          </p>
        )}
      </div>
    </div>
  );
}
