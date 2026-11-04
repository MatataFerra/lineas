"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import type { BookDetails } from "@/lib/catalog/details";
import { bookSnapshot, useLineas } from "@/lib/store";
import { LibraryNotice } from "@/features/library/library-notice";

/**
 * El detalle de un libro: lo que sabemos por el mapa (autor, año, por qué lo
 * recomendamos) más la ficha del catálogo (editorial, páginas, descripción),
 * que llega aparte. Sirve también para libros de la biblioteca que ya no están
 * en el mapa de esta búsqueda.
 */
export function BookScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const graph = useLineas((s) => s.graph);
  const status = useLineas((s) => s.status);
  const search = useLineas((s) => s.search);
  const library = useLineas((s) => s.library);
  const toggleLibrary = useLineas((s) => s.toggleLibrary);
  const showAnother = useLineas((s) => s.showAnother);
  const setFocus = useLineas((s) => s.setFocus);

  useEffect(() => {
    void search();
  }, [search]);

  const node = graph?.nodes.find((n) => n.id === id && n.kind === "book");
  const rec = graph?.recommendations.find((r) => r.nodeId === id);
  const entry = library[id];
  const snapshot = node ? bookSnapshot(node) : entry;
  const details = useBookDetails(snapshot?.title, snapshot?.author ?? undefined, node?.book?.googleBooksId);

  if (!snapshot) {
    return (
      <Shell>
        {status === "loading" ? (
          <p className="animate-soft-pulse mt-10 text-[13px] text-muted">Buscando el libro…</p>
        ) : (
          <div className="mt-10 max-w-md">
            <h1 className="font-serif text-[28px] leading-tight">No tenemos este libro a mano</h1>
            <p className="mt-2 text-sm text-muted">Puede ser de una búsqueda anterior. Volvé a los resultados o buscalo en tu biblioteca.</p>
            <div className="mt-5 flex gap-2">
              <Link href="/resultados" className="h-10 rounded-full bg-ink px-5 text-[13px] leading-10 text-bg">
                Ver resultados
              </Link>
              <Link href="/biblioteca" className="h-10 rounded-full border border-line px-5 text-[13px] leading-10 hover:bg-chip">
                Mi biblioteca
              </Link>
            </div>
          </div>
        )}
      </Shell>
    );
  }

  const isSaved = !!entry?.statuses.saved;
  const isRead = !!entry?.statuses.read;
  const year = node?.era.label ?? snapshot.yearLabel;
  const book = node ? bookSnapshot(node) : snapshot;

  const meta: [string, string | undefined][] = [
    ["Autor", snapshot.author ?? undefined],
    ["Editorial", details.data?.publisher],
    ["Año", year ?? undefined],
    ["Páginas", details.data?.pageCount ? String(details.data.pageCount) : undefined],
  ];

  return (
    <Shell>
      <button type="button" onClick={() => router.back()} className="mt-5 inline-flex items-center gap-2 py-2 text-[13px] text-muted hover:text-ink md:mt-6">
        <ArrowLeftIcon size={14} />
        Volver
      </button>

      <article className="mt-4 grid gap-8 md:mt-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-14 lg:grid-cols-[240px_minmax(0,620px)]">
        <aside className="flex gap-5 md:flex-col md:gap-0">
          <BookCover id={snapshot.id} title={snapshot.title} author={snapshot.author ?? undefined} size="lg" coverUrl={snapshot.coverUrl} />
          <dl className="grid content-start gap-3.5 text-[13px] md:mt-8 md:border-t md:border-line md:pt-6">
            {meta.filter(([, value]) => value || details.loading).map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11.5px] text-muted">{label}</dt>
                <dd className={value ? "" : "text-muted"}>{value ?? "…"}</dd>
              </div>
            ))}
            {details.data && (
              <a href={details.data.goodreadsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-accent hover:underline">
                Ver en Goodreads
                <span aria-hidden="true">↗</span>
              </a>
            )}
          </dl>
        </aside>

        <div className="min-w-0">
          <h1 className="font-serif text-[34px] leading-[1.06] tracking-[-0.01em] md:text-[46px]">{snapshot.title}</h1>
          <p className="mt-2 text-sm text-muted">{[snapshot.author, year].filter(Boolean).join(" · ")}</p>

          {details.data && details.data.categories.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Géneros">
              {details.data.categories.map((c) => (
                <li key={c} className="rounded-full border border-line px-3 py-1 text-xs">
                  {c}
                </li>
              ))}
            </ul>
          )}

          {details.loading && (
            <div aria-hidden="true" className="mt-6 flex flex-col gap-2.5">
              {[100, 94, 97, 60].map((w) => (
                <span key={w} className="animate-soft-pulse h-3 rounded bg-chip" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}
          {details.data?.description && <Description text={details.data.description} />}

          {rec && (
            <section className="mt-9" aria-labelledby="why-title">
              <h2 id="why-title" className="font-serif text-[20px]">
                ¿Por qué te lo recomendamos?
              </h2>
              <p className="mt-2.5 text-[15px] leading-relaxed">{rec.pitch}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{rec.pathSummary}</p>
              <Link href="/conexiones" onClick={() => setFocus(id)} className="mt-3 inline-flex items-center gap-1.5 text-[13px] underline underline-offset-[3px] hover:text-accent">
                Ver el camino en el mapa
                <ArrowRightIcon size={12} />
              </Link>
            </section>
          )}

          <div className="mt-9 flex flex-col gap-2.5 sm:max-w-[420px]">
            <button
              type="button"
              aria-pressed={isSaved}
              onClick={() => void toggleLibrary(book, "saved")}
              className={`h-12 rounded-full border border-accent text-sm font-medium ${isSaved ? "text-accent" : "bg-accent text-accent-ink"}`}>
              {isSaved ? "Guardado en tu biblioteca ✓" : "Guardar en mi biblioteca"}
            </button>
            <div className="flex gap-2.5">
              <button
                type="button"
                aria-pressed={isRead}
                onClick={() => void toggleLibrary(book, "read")}
                className={`h-11 flex-1 rounded-full border border-line text-[13px] ${isRead ? "bg-chip" : "hover:bg-chip"}`}>
                {isRead ? "Leído ✓" : "Ya lo leí"}
              </button>
              {rec && (
                <button
                  type="button"
                  onClick={() => {
                    void showAnother(rec.lane);
                    router.push("/resultados");
                  }}
                  className="h-11 flex-1 rounded-full border border-line text-[13px] hover:bg-chip">
                  No es lo que busco
                </button>
              )}
            </div>
            <LibraryNotice active={isSaved || isRead} />
          </div>
        </div>
      </article>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh px-[22px] pt-5 pb-16 md:px-14 md:pt-7">
      <div className="mx-auto max-w-[1160px]">
        <SiteHeader />
        {children}
      </div>
    </div>
  );
}

/** Las descripciones del catálogo pueden ser largas: cinco líneas y «Leer más». */
function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 420;
  return (
    <div className="mt-6">
      <p className={`text-[15px] leading-relaxed whitespace-pre-line ${long && !open ? "line-clamp-5" : ""}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1.5 text-[13px] text-muted underline underline-offset-[3px] hover:text-ink">
          {open ? "Leer menos" : "Leer más"}
        </button>
      )}
    </div>
  );
}

function useBookDetails(title?: string, author?: string, googleBooksId?: string) {
  const [state, setState] = useState<{ key: string; data: BookDetails | null }>({ key: "", data: null });
  const key = title && author ? `${title}|${author}|${googleBooksId ?? ""}` : "";

  useEffect(() => {
    if (!title || !author) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ title, author });
    if (googleBooksId) params.set("gid", googleBooksId);
    fetch(`/api/book?${params}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<BookDetails>) : null))
      .then((data) => setState({ key: `${title}|${author}|${googleBooksId ?? ""}`, data }))
      .catch(() => {});
    return () => controller.abort();
  }, [title, author, googleBooksId]);

  return { data: state.key === key ? state.data : null, loading: !!key && state.key !== key };
}
