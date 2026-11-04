import { authorSlug } from "./profile";

/** Enlace a la página del autor: el slug para la URL y el nombre tal cual, para buscarlo. */
export function authorHref(name: string): string {
  return `/autor/${authorSlug(name)}?${new URLSearchParams({ n: name })}`;
}

/** Enlace a la ficha de un libro que no está en el mapa: lleva lo necesario para mostrarlo. */
export function bookHref(book: { id: string; title: string; author: string; year?: number | null; coverUrl?: string | null }): string {
  const params = new URLSearchParams({ t: book.title, a: book.author });
  if (book.year) params.set("y", String(book.year));
  if (book.coverUrl) params.set("c", book.coverUrl);
  return `/libro/${book.id}?${params}`;
}
