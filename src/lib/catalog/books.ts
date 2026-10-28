import { ConnectionGraphSchema, type BookRef, type ConnectionGraph, type Lane } from "@/lib/graph/schema";

/**
 * Verificación de libros contra catálogos reales (Google Books y, si no
 * aparece, Open Library). Es la defensa principal contra libros inventados:
 * lo que no se encuentra queda marcado como no verificado y, si el carril
 * tiene alternativas verificadas, se descarta.
 */

export interface CatalogOptions {
  googleBooksKey?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface CatalogMatch {
  source: "google" | "openlibrary";
  title: string;
  authors: string[];
  year?: number;
  coverUrl?: string;
  googleBooksId?: string;
  openLibraryKey?: string;
  isbn?: string;
}

interface GoogleVolume {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    imageLinks?: { smallThumbnail?: string; thumbnail?: string };
    industryIdentifiers?: { type: string; identifier: string }[];
  };
}

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
}

export async function findBook(title: string, author: string, options: CatalogOptions = {}): Promise<CatalogMatch | null> {
  return (await searchGoogle(title, author, options).catch(() => null)) ?? (await searchOpenLibrary(title, author, options).catch(() => null));
}

async function searchGoogle(title: string, author: string, { googleBooksKey, timeoutMs = 5000, fetch: fetchImpl = fetch }: CatalogOptions): Promise<CatalogMatch | null> {
  const params = new URLSearchParams({ q: `intitle:${title} inauthor:${lastName(author)}`, maxResults: "8", printType: "books" });
  if (googleBooksKey) params.set("key", googleBooksKey);
  const response = await fetchImpl(`https://www.googleapis.com/books/v1/volumes?${params}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) return null;
  const data = (await response.json()) as { items?: GoogleVolume[] };
  const candidates = (data.items ?? []).filter((item) => matches(title, author, item.volumeInfo?.title, item.volumeInfo?.authors));
  if (candidates.length === 0) return null;
  // Preferimos una edición con portada.
  const best = candidates.find((c) => c.volumeInfo?.imageLinks?.thumbnail) ?? candidates[0];
  const info = best.volumeInfo ?? {};
  const isbn = info.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier ?? info.industryIdentifiers?.find((i) => i.type === "ISBN_10")?.identifier;
  const thumb = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;
  return {
    source: "google",
    title: info.title ?? title,
    authors: info.authors ?? [],
    year: parseYear(info.publishedDate),
    coverUrl: thumb ? thumb.replace(/^http:/, "https:").replace("&edge=curl", "") : undefined,
    googleBooksId: best.id,
    isbn,
  };
}

async function searchOpenLibrary(title: string, author: string, { timeoutMs = 5000, fetch: fetchImpl = fetch }: CatalogOptions): Promise<CatalogMatch | null> {
  const params = new URLSearchParams({ title, author: lastName(author), limit: "8", fields: "key,title,author_name,first_publish_year,cover_i,isbn" });
  const response = await fetchImpl(`https://openlibrary.org/search.json?${params}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) return null;
  const data = (await response.json()) as { docs?: OpenLibraryDoc[] };
  const doc = (data.docs ?? []).find((d) => matches(title, author, d.title, d.author_name));
  if (!doc) return null;
  return {
    source: "openlibrary",
    title: doc.title ?? title,
    authors: doc.author_name ?? [],
    year: doc.first_publish_year,
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
    openLibraryKey: doc.key,
    isbn: doc.isbn?.[0],
  };
}

/** Marca cada libro del grafo como verificado (o no) y descarta recomendaciones dudosas cuando hay alternativas. */
export async function verifyGraphBooks(graph: ConnectionGraph, options: CatalogOptions = {}): Promise<ConnectionGraph> {
  const books = graph.nodes.filter((n) => n.kind === "book");
  const matches = await Promise.all(books.map((n) => findBook(n.label, n.book?.author ?? n.subtitle ?? "", options).catch(() => null)));
  const byId = new Map(books.map((n, i) => [n.id, matches[i]]));

  const nodes = graph.nodes.map((node) => {
    if (node.kind !== "book") return node;
    const match = byId.get(node.id);
    const book: BookRef = {
      author: node.book?.author ?? node.subtitle ?? "",
      verified: !!match,
      ...(match?.coverUrl ? { coverUrl: match.coverUrl } : {}),
      ...(match?.googleBooksId ? { googleBooksId: match.googleBooksId } : {}),
      ...(match?.openLibraryKey ? { openLibraryKey: match.openLibraryKey } : {}),
      ...(match?.isbn ? { isbn: match.isbn } : {}),
    };
    return { ...node, book };
  });

  const verified = new Set(nodes.filter((n) => n.book?.verified).map((n) => n.id));
  const verifiedPerLane = new Map<Lane, number>();
  for (const rec of graph.recommendations) {
    if (verified.has(rec.nodeId)) verifiedPerLane.set(rec.lane, (verifiedPerLane.get(rec.lane) ?? 0) + 1);
  }
  const recommendations = graph.recommendations.filter((rec) => verified.has(rec.nodeId) || !verifiedPerLane.get(rec.lane));

  return ConnectionGraphSchema.parse({ ...graph, nodes, recommendations });
}

/* ------------------------------------------------------------------ */

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function lastName(author: string): string {
  const parts = author.trim().split(/\s+/);
  return parts[parts.length - 1] ?? author;
}

function matches(title: string, author: string, candidateTitle?: string, candidateAuthors?: string[]): boolean {
  if (!candidateTitle || !candidateAuthors?.length) return false;
  const surname = normalizeText(lastName(author));
  const authorOk = candidateAuthors.some((a) => normalizeText(a).split(" ").includes(surname));
  if (!authorOk) return false;
  const wanted = significantWords(title);
  const found = new Set(significantWords(candidateTitle));
  if (wanted.length === 0) return false;
  const overlap = wanted.filter((w) => found.has(w)).length / wanted.length;
  return overlap >= 0.6;
}

const STOP = new Set(["el", "la", "los", "las", "un", "una", "de", "del", "y", "the", "a", "an", "of", "and", "le", "les", "des", "en"]);
function significantWords(title: string): string[] {
  const words = normalizeText(title.split(/[:(]/)[0]).split(" ").filter(Boolean);
  const meaningful = words.filter((w) => !STOP.has(w));
  return meaningful.length ? meaningful : words;
}

function parseYear(date?: string): number | undefined {
  const year = date ? Number.parseInt(date.slice(0, 4), 10) : NaN;
  return Number.isFinite(year) ? year : undefined;
}
