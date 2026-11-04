import { normalizeText } from "@/lib/catalog/books";
import { findArticle } from "@/lib/portraits/wikipedia";

/**
 * La página de un autor sin guardar nada en la base: biografía y retrato de
 * Wikipedia, obras de Open Library (ordenadas por cantidad de ediciones, una
 * buena medida de cuáles importan). Las dos fuentes son gratis y sin key; la
 * respuesta se cachea en el servidor y en el navegador.
 */
export interface AuthorWork {
  /** Slug del título, el mismo formato que los ids del mapa. */
  id: string;
  title: string;
  year: number | null;
  coverUrl: string | null;
}

export interface AuthorProfile {
  name: string;
  description?: string;
  bio?: string;
  imageUrl?: string;
  sourceUrl?: string;
  lifespan?: string;
  works: AuthorWork[];
}

interface OLAuthor {
  key?: string;
  name?: string;
  work_count?: number;
  birth_date?: string;
  death_date?: string;
}

interface OLWork {
  key?: string;
  title?: string;
  first_publish_year?: number;
  cover_i?: number;
  edition_count?: number;
}

const MAX_WORKS = 12;

export function authorSlug(name: string): string {
  return normalizeText(name).replace(/ /g, "-");
}

export async function fetchAuthorProfile(name: string, { fetch: fetchImpl = fetch, timeoutMs = 4000 }: { fetch?: typeof fetch; timeoutMs?: number } = {}): Promise<AuthorProfile> {
  const [article, works] = await Promise.all([
    findArticle(name, { creative: true, fetch: fetchImpl, timeoutMs }).catch(() => null),
    openLibraryWorks(name, fetchImpl, timeoutMs).catch(() => ({ author: null, works: [] as AuthorWork[] })),
  ]);
  return {
    name: article?.title ?? name,
    description: article?.description,
    bio: article?.extract,
    imageUrl: article?.imageUrl,
    sourceUrl: article?.sourceUrl,
    lifespan: lifespan(works.author),
    works: works.works,
  };
}

async function openLibraryWorks(name: string, fetchImpl: typeof fetch, timeoutMs: number) {
  const signal = () => AbortSignal.timeout(timeoutMs);
  const found = await fetchImpl(`https://openlibrary.org/search/authors.json?${new URLSearchParams({ q: name, limit: "10" })}`, { signal: signal() });
  if (!found.ok) return { author: null, works: [] };
  const wanted = normalizeText(name);
  const candidates = (((await found.json()) as { docs?: OLAuthor[] }).docs ?? []).filter((a) => a.key && normalizeText(a.name ?? "") === wanted);
  // Homónimos y registros duplicados: el de más obras es el autor que se busca.
  const author = candidates.sort((a, b) => (b.work_count ?? 0) - (a.work_count ?? 0))[0];
  if (!author) return { author: null, works: [] };

  const params = new URLSearchParams({ author: author.key!, sort: "editions", limit: String(MAX_WORKS * 2), lang: "es", fields: "key,title,first_publish_year,cover_i,edition_count" });
  const response = await fetchImpl(`https://openlibrary.org/search.json?${params}`, { signal: signal() });
  if (!response.ok) return { author, works: [] };
  const docs = ((await response.json()) as { docs?: OLWork[] }).docs ?? [];

  // Open Library repite obras (traducciones cargadas como obras aparte): una por título, la de más ediciones.
  const byTitle = new Map<string, OLWork>();
  for (const doc of docs) {
    if (!doc.title) continue;
    const key = normalizeText(doc.title);
    const current = byTitle.get(key);
    if (!current || (doc.edition_count ?? 0) > (current.edition_count ?? 0)) byTitle.set(key, doc);
  }
  const works = [...byTitle.values()]
    .sort((a, b) => (b.edition_count ?? 0) - (a.edition_count ?? 0))
    .slice(0, MAX_WORKS)
    .map((w) => ({
      id: authorSlug(w.title!),
      title: w.title!,
      year: w.first_publish_year ?? null,
      coverUrl: w.cover_i ? `https://covers.openlibrary.org/b/id/${w.cover_i}-M.jpg` : null,
    }));
  return { author, works };
}

function lifespan(author: OLAuthor | null): string | undefined {
  const year = (date?: string) => date?.match(/\d{4}/)?.[0];
  const from = year(author?.birth_date);
  const to = year(author?.death_date);
  return from ? `${from}–${to ?? ""}` : undefined;
}
