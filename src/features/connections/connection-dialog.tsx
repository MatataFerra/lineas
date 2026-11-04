"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon } from "@/components/icons";
import { booksInOrder, connectionDetail } from "@/lib/graph/connection-detail";
import type { ConnectionGraph } from "@/lib/graph/schema";

interface ConnectionDialogProps {
  graph: ConnectionGraph;
  nodeId: string;
  onClose: () => void;
  /** Cierra el modal y deja el libro seleccionado en el mapa, con todas sus aristas. */
  onShowConnections: (nodeId: string) => void;
}

/**
 * «La conexión»: un libro del mapa en primer plano, por qué está ahí y tres
 * libros vecinos. Se recorren todos los libros del mapa con ← → o desde los
 * vecinos; la flecha de arriba vuelve al libro anterior.
 */
export function ConnectionDialog({ graph, nodeId, onClose, onShowConnections }: ConnectionDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [history, setHistory] = useState<string[]>([nodeId]);
  const current = history[history.length - 1];
  const detail = useMemo(() => connectionDetail(graph, current), [graph, current]);
  const books = useMemo(() => booksInOrder(graph), [graph]);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const go = (id: string) => setHistory((h) => [...h, id]);
  const step = (delta: number) => {
    if (!detail) return;
    const next = books[(detail.position.index - 1 + delta + books.length) % books.length];
    go(next.id);
  };
  const back = () => (history.length > 1 ? setHistory((h) => h.slice(0, -1)) : onClose());

  if (!detail) return null;
  const { node } = detail;

  return (
    <dialog
      ref={ref}
      aria-labelledby="connection-title"
      onCancel={(e) => {
        // Escape. Ver ClueDialog: no escuchamos "close" porque el cleanup lo dispara al desmontar.
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") step(1);
        if (e.key === "ArrowLeft") step(-1);
      }}
      className="animate-sheet md:animate-fade m-0 h-dvh max-h-none w-full max-w-none bg-surface p-0 text-ink md:mx-auto md:mt-[72px] md:h-fit md:max-h-[calc(100dvh-120px)] md:max-w-[760px] md:rounded-[18px] md:border md:border-line md:shadow-[0_30px_80px_rgba(0,0,0,0.18)]"
    >
      <div className="flex items-center gap-3 px-4 pt-4 md:px-6 md:pt-5">
        <button type="button" onClick={back} aria-label={history.length > 1 ? "Volver al libro anterior" : "Cerrar"} className="flex size-9 items-center justify-center rounded-full hover:bg-chip">
          <ArrowLeftIcon size={18} />
        </button>
        <span className="font-serif text-[17px]">La conexión</span>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="ml-auto flex size-9 items-center justify-center rounded-full hover:bg-chip">
          <CloseIcon size={18} />
        </button>
      </div>

      <div key={node.id} className="animate-fade px-5 pb-5 md:px-12 md:pb-6">
        <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:gap-9">
          <BookCover id={node.id} title={node.label} author={detail.author} size="lg" coverUrl={node.book?.coverUrl} />
          <div className="min-w-0 sm:pt-3">
            <h2 id="connection-title" className="font-serif text-[30px] leading-[1.08]">
              {node.label}
            </h2>
            <p className="mt-2 text-[13px] text-muted">
              {detail.author} · {detail.year}
              {detail.isClue && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-[11px] text-bg">Tu pista</span>}
            </p>
            {detail.tags.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Conectado con">
                {detail.tags.map((tag) => (
                  <li key={tag} className="rounded-full border border-line px-2.5 py-1 text-[11.5px]">
                    {tag}
                  </li>
                ))}
              </ul>
            )}
            {detail.text && <p className="mt-5 max-w-[46ch] text-[14px] leading-relaxed text-ink/85">{detail.text}</p>}
          </div>
        </div>

        {detail.related.length > 0 && (
          <section aria-labelledby="related-title" className="mt-7 border-t border-line pt-5">
            <h3 id="related-title" className="font-serif text-[17px]">
              También te puede interesar
            </h3>
            <ul className="mt-4 grid grid-cols-3 gap-4">
              {detail.related.map((book) => (
                <li key={book.id}>
                  <button type="button" onClick={() => go(book.id)} className="group flex w-full flex-col items-start gap-2.5 text-left">
                    {/* En pantallas angostas la tapa de tamaño md no entra en tres columnas. */}
                    <span className="transition-transform duration-200 group-hover:-translate-y-0.5 sm:hidden">
                      <BookCover id={book.id} title={book.label} size="graph" coverUrl={book.book?.coverUrl} />
                    </span>
                    <span className="hidden transition-transform duration-200 group-hover:-translate-y-0.5 sm:block">
                      <BookCover id={book.id} title={book.label} author={book.book?.author ?? book.subtitle} size="md" coverUrl={book.book?.coverUrl} />
                    </span>
                    <span className="line-clamp-2 font-serif text-[14px] leading-tight group-hover:underline">{book.label}</span>
                    <span className="-mt-1.5 text-[11px] leading-snug text-muted">
                      {book.book?.author ?? book.subtitle} · {book.era.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-6 flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} aria-label="Libro anterior del mapa" className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-chip hover:text-ink">
            <ArrowLeftIcon size={14} />
          </button>
          <span className="min-w-10 text-center text-[11.5px] text-muted tabular-nums">
            {detail.position.index}/{detail.position.total}
          </span>
          <button type="button" onClick={() => step(1)} aria-label="Libro siguiente del mapa" className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-chip hover:text-ink">
            <ArrowRightIcon size={14} />
          </button>
          <button type="button" onClick={() => onShowConnections(node.id)} className="ml-auto inline-flex items-center gap-1.5 py-2 text-[12.5px] hover:underline">
            Ver todas las conexiones
            <ArrowRightIcon size={13} />
          </button>
        </div>
      </div>
    </dialog>
  );
}
