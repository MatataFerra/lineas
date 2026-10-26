import type { ClueKind } from "@/lib/graph/schema";

export interface CatalogItem {
  label: string;
  detail: string;
}

/**
 * Sugerencias para el buscador de pistas.
 * TODO: libros y autores van a salir de Google Books / Open Library vía una ruta
 * del servidor (/api/catalog); el resto puede quedar como lista curada.
 */
export const CATALOG: Record<ClueKind, CatalogItem[]> = {
  book: [
    { label: "On the Road", detail: "Jack Kerouac · 1957" },
    { label: "Los vagabundos del Dharma", detail: "Jack Kerouac · 1958" },
    { label: "Aullido", detail: "Allen Ginsberg · 1956" },
    { label: "El extranjero", detail: "Albert Camus · 1942" },
    { label: "Rayuela", detail: "Julio Cortázar · 1963" },
    { label: "Siddhartha", detail: "Hermann Hesse · 1922" },
  ],
  author: [
    { label: "Jack Kerouac", detail: "Generación Beat" },
    { label: "Albert Camus", detail: "Existencialismo" },
    { label: "Julio Cortázar", detail: "Boom latinoamericano" },
    { label: "Hermann Hesse", detail: "Novela de formación" },
    { label: "Clarice Lispector", detail: "Modernismo brasileño" },
    { label: "Ernest Hemingway", detail: "Generación perdida" },
  ],
  quote: [
    { label: "Quiero sentir la libertad de viajar sin rumbo", detail: "Sugerencia" },
    { label: "Historias que me hagan sentir en otro lugar", detail: "Sugerencia" },
    { label: "Libros sobre quiénes somos y de dónde venimos", detail: "Sugerencia" },
    { label: "Algo triste pero luminoso", detail: "Sugerencia" },
  ],
  movement: [
    { label: "Generación Beat", detail: "1944–1960 · Estados Unidos" },
    { label: "Existencialismo", detail: "Siglo XX · Francia" },
    { label: "Boom latinoamericano", detail: "Décadas de 1960 y 1970" },
    { label: "Realismo mágico", detail: "Siglo XX · Latinoamérica" },
    { label: "Generación perdida", detail: "Entreguerras" },
    { label: "Modernismo", detail: "1890–1940" },
  ],
  style: [
    { label: "Prosa poética", detail: "Ritmo y musicalidad" },
    { label: "Fragmentaria", detail: "Capítulos breves, saltos en el tiempo" },
    { label: "Minimalista", detail: "Pocas palabras, mucho peso" },
    { label: "Flujo de conciencia", detail: "El pensamiento sin filtro" },
    { label: "Epistolar", detail: "Cartas y diarios" },
  ],
  feeling: [
    { label: "Nostalgia", detail: "Lo que ya no está" },
    { label: "Libertad", detail: "Soltar, irse, empezar" },
    { label: "Desarraigo", detail: "No pertenecer a ningún lugar" },
    { label: "Asombro", detail: "Ver el mundo por primera vez" },
    { label: "Melancolía", detail: "Una tristeza que acompaña" },
  ],
  idea: [
    { label: "Viajes sin rumbo", detail: "Idea" },
    { label: "Ciudades de noche", detail: "Idea" },
    { label: "Crecer lejos de casa", detail: "Idea" },
    { label: "El precio de la libertad", detail: "Idea" },
  ],
};

export function searchCatalog(kind: ClueKind, query: string): CatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return CATALOG[kind];
  return CATALOG[kind].filter((item) => item.label.toLowerCase().includes(q) || item.detail.toLowerCase().includes(q));
}

export const STARTER_IDEAS: { label: string; kind: ClueKind }[] = [
  { label: "Viajes sin rumbo", kind: "idea" },
  { label: "La generación Beat", kind: "movement" },
  { label: "Existencialismo", kind: "movement" },
  { label: "Nostalgia", kind: "feeling" },
  { label: "Ciudades de noche", kind: "idea" },
];
