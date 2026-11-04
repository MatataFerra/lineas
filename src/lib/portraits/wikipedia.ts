/**
 * Retratos desde Wikipedia: gratis, sin key y con imágenes de licencia libre
 * (Wikimedia Commons). Se busca el artículo por nombre, primero en castellano
 * y después en inglés. Para personas se exige que la descripción del artículo
 * hable de un oficio creativo, así no aparece la foto de un homónimo.
 */
export interface Portrait {
  imageUrl: string;
  /** El artículo de origen: la imagen se muestra con ese crédito. */
  sourceUrl: string;
}

interface Summary {
  type?: string;
  description?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
}

const CREATIVE =
  /escrit|poet|novel|ensay|dramat|cuent|filós|music|músic|cantant|compos|pint|artist|escult|cineast|director|periodist|historiet|writer|novelist|essayist|playwright|philosoph|composer|painter|singer|saxophon|pianist|trumpet|sculptor|filmmaker|journalist|author/i;

export async function findPortrait(name: string, kind: "person" | "art", { fetch: fetchImpl = fetch, timeoutMs = 2500 }: { fetch?: typeof fetch; timeoutMs?: number } = {}): Promise<Portrait | null> {
  for (const lang of ["es", "en"]) {
    try {
      const response = await fetchImpl(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, "_"))}`, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "Api-User-Agent": "Lineas/1.0 (recomendaciones de lectura)" },
      });
      if (!response.ok) continue;
      const page = (await response.json()) as Summary;
      if (page.type !== "standard" || !page.thumbnail?.source) continue;
      if (kind === "person" && !CREATIVE.test(page.description ?? "")) continue;
      return { imageUrl: page.thumbnail.source.split("?")[0], sourceUrl: page.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(name)}` };
    } catch {
      // Un idioma que falla no corta la búsqueda: probamos el siguiente.
    }
  }
  return null;
}
