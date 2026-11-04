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
  title?: string;
  extract?: string;
  description?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
}

/**
 * Solo imágenes de Wikimedia Commons, que son de licencia libre. Las de
 * /wikipedia/en/ son de uso justo (portadas, retratos con copyright) y no se
 * pueden reutilizar fuera de Wikipedia.
 */
export function isFreeImage(url: string | null | undefined): url is string {
  return !!url && /^https:\/\/(upload|thumb)\.wikimedia\.org\/wikipedia\/commons\//.test(url);
}

const CREATIVE =
  /escrit|poet|novel|ensay|dramat|cuent|filós|music|músic|cantant|compos|pint|artist|escult|cineast|director|periodist|historiet|writer|novelist|essayist|playwright|philosoph|composer|painter|singer|saxophon|pianist|trumpet|sculptor|filmmaker|journalist|author/i;

export interface Article {
  title: string;
  description?: string;
  /** El primer párrafo del artículo, en texto plano. */
  extract?: string;
  imageUrl?: string;
  sourceUrl: string;
  lang: "es" | "en";
}

/**
 * El resumen del artículo de Wikipedia con ese nombre (castellano, después
 * inglés). `creative`: solo artículos cuya descripción habla de un oficio
 * creativo; `image`: solo artículos con imagen.
 */
export async function findArticle(
  name: string,
  { creative = false, image = false, fetch: fetchImpl = fetch, timeoutMs = 2500 }: { creative?: boolean; image?: boolean; fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<Article | null> {
  for (const lang of ["es", "en"] as const) {
    try {
      const response = await fetchImpl(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, "_"))}`, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "Api-User-Agent": "Lineas/1.0 (recomendaciones de lectura)" },
      });
      if (!response.ok) continue;
      const page = (await response.json()) as Summary;
      if (page.type !== "standard") continue;
      const imageUrl = page.thumbnail?.source?.split("?")[0];
      if (image && !isFreeImage(imageUrl)) continue;
      if (creative && !CREATIVE.test(page.description ?? "")) continue;
      return {
        title: page.title ?? name,
        description: page.description,
        extract: page.extract,
        ...(isFreeImage(imageUrl) ? { imageUrl } : {}),
        sourceUrl: page.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(name)}`,
        lang,
      };
    } catch {
      // Un idioma que falla no corta la búsqueda: probamos el siguiente.
    }
  }
  return null;
}

export async function findPortrait(name: string, kind: "person" | "art", options: { fetch?: typeof fetch; timeoutMs?: number } = {}): Promise<Portrait | null> {
  const article = await findArticle(name, { ...options, creative: kind === "person", image: true });
  return article?.imageUrl ? { imageUrl: article.imageUrl, sourceUrl: article.sourceUrl } : null;
}
