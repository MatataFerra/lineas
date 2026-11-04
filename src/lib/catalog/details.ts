import { lastName, matches, type CatalogOptions } from "./books";

/**
 * La ficha de un libro para su pantalla de detalle: editorial, páginas,
 * descripción y géneros desde Google Books. Si el catálogo no responde o no
 * lo encuentra, queda solo el enlace a Goodreads (una búsqueda: Goodreads no
 * tiene API pública).
 */
export interface BookDetails {
  publisher?: string;
  pageCount?: number;
  description?: string;
  categories: string[];
  goodreadsUrl: string;
}

export interface BookQuery {
  title: string;
  author: string;
  googleBooksId?: string;
}

interface VolumeInfo {
  title?: string;
  authors?: string[];
  publisher?: string;
  pageCount?: number;
  description?: string;
  categories?: string[];
}

/** Los géneros más comunes de Google Books, en castellano. Lo que no está acá se descarta. */
const CATEGORY_ES: Record<string, string> = {
  fiction: "Novela",
  classics: "Clásicos",
  literary: "Literaria",
  travel: "Viajes",
  poetry: "Poesía",
  biography: "Biografía",
  "biography & autobiography": "Biografía",
  philosophy: "Filosofía",
  religion: "Religión",
  history: "Historia",
  "literary criticism": "Crítica literaria",
  "short stories (single author)": "Cuentos",
  "science fiction": "Ciencia ficción",
  fantasy: "Fantasía",
  romance: "Romance",
  "mystery & detective": "Policial",
  psychological: "Psicológica",
  "coming of age": "Iniciación",
  essays: "Ensayo",
  political: "Política",
  "social science": "Ciencias sociales",
};

export async function fetchBookDetails(query: BookQuery, { googleBooksKey, timeoutMs = 4000, fetch: fetchImpl = fetch }: CatalogOptions = {}): Promise<BookDetails> {
  const goodreadsUrl = `https://www.goodreads.com/search?q=${encodeURIComponent(`${query.title} ${query.author}`)}`;
  const key = googleBooksKey ? `key=${encodeURIComponent(googleBooksKey)}` : "";
  try {
    let info: VolumeInfo | undefined;
    if (query.googleBooksId) {
      const response = await fetchImpl(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(query.googleBooksId)}?${key}`, { signal: AbortSignal.timeout(timeoutMs) });
      if (response.ok) info = ((await response.json()) as { volumeInfo?: VolumeInfo }).volumeInfo;
    } else {
      const params = new URLSearchParams({ q: `intitle:"${query.title.replace(/"/g, "")}" inauthor:${lastName(query.author)}`, maxResults: "10", printType: "books" });
      if (googleBooksKey) params.set("key", googleBooksKey);
      const response = await fetchImpl(`https://www.googleapis.com/books/v1/volumes?${params}`, { signal: AbortSignal.timeout(timeoutMs) });
      if (response.ok) {
        const items = ((await response.json()) as { items?: { volumeInfo?: VolumeInfo }[] }).items ?? [];
        // La primera edición que coincide; si hay varias, preferimos una con descripción.
        const found = items.map((i) => i.volumeInfo).filter((v): v is VolumeInfo => !!v && matches(query.title, query.author, v.title, v.authors));
        info = found.find((v) => v.description) ?? found[0];
      }
    }
    if (!info) return (await fromOpenLibrary(query, fetchImpl, timeoutMs)) ?? { goodreadsUrl, categories: [] };
    return {
      publisher: info.publisher,
      pageCount: info.pageCount || undefined,
      description: info.description ? plainText(info.description) : undefined,
      categories: translateCategories(info.categories ?? []),
      goodreadsUrl,
    };
  } catch {
    return (await fromOpenLibrary(query, fetchImpl, timeoutMs).catch(() => null)) ?? { goodreadsUrl, categories: [] };
  }

  /**
   * Respaldo: Open Library no tiene la editorial de una edición puntual (lista
   * todas las que lo publicaron), pero sí páginas, descripción de la obra y temas.
   */
  async function fromOpenLibrary(q: BookQuery, fetcher: typeof fetch, ms: number): Promise<BookDetails | null> {
    const params = new URLSearchParams({ title: q.title, author: lastName(q.author), limit: "5", fields: "key,title,author_name,number_of_pages_median,subject" });
    const response = await fetcher(`https://openlibrary.org/search.json?${params}`, { signal: AbortSignal.timeout(ms) });
    if (!response.ok) return null;
    const docs = ((await response.json()) as { docs?: OpenLibraryDoc[] }).docs ?? [];
    const doc = docs.find((d) => matches(q.title, q.author, d.title, d.author_name));
    if (!doc?.key) return null;
    const work = await fetcher(`https://openlibrary.org${doc.key}.json`, { signal: AbortSignal.timeout(ms) });
    const raw = work.ok ? ((await work.json()) as { description?: string | { value?: string } }).description : undefined;
    const description = typeof raw === "string" ? raw : raw?.value;
    return {
      pageCount: doc.number_of_pages_median || undefined,
      description: description ? plainText(description.split(/\n-{3,}|\(\[source\]/)[0]) : undefined,
      categories: translateCategories(doc.subject ?? []),
      goodreadsUrl,
    };
  }
}

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  number_of_pages_median?: number;
  subject?: string[];
}

function translateCategories(categories: string[]): string[] {
  const out = new Set<string>();
  for (const category of categories) {
    for (const part of category.split("/").map((p) => p.trim().toLowerCase()).reverse()) {
      const es = CATEGORY_ES[part];
      if (es) {
        out.add(es);
        break;
      }
    }
  }
  return [...out].slice(0, 3);
}

/** Las descripciones vienen con HTML (Google Books) o markdown (Open Library): las pasamos a texto con párrafos. */
function plainText(html: string): string {
  return html
    .replace(/<\/p>\s*<br\s*\/?>|<br\s*\/?>\s*<br\s*\/?>|<\/p>\s*<p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    // Open Library usa markdown: *énfasis*, **negrita** y [texto](enlace).
    .replace(/\*{1,2}([^*\n]+)\*{1,2}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
