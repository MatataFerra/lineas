import { z } from "zod";
import { fetchBookDetails, type BookDetails } from "@/lib/catalog/details";
import { createRateLimiter } from "@/lib/rate-limit";

const QuerySchema = z.object({
  title: z.string().trim().min(1).max(120),
  author: z.string().trim().min(1).max(80),
  gid: z.string().regex(/^[\w-]{1,40}$/).optional(),
});

// La ficha no cambia: se guarda en memoria del servidor y el navegador la cachea un día.
const cache = new Map<string, BookDetails>();
const limiter = createRateLimiter({ limit: 60, windowMs: 10 * 60 * 1000 });

/** GET ?title&author&gid? → ficha del libro (editorial, páginas, descripción, géneros, Goodreads). */
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });

  const { title, author, gid } = parsed.data;
  const key = `${gid ?? ""}|${title.toLowerCase()}|${author.toLowerCase()}`;
  let details = cache.get(key);
  if (!details) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
    if (!limiter(ip).ok) return Response.json({ error: "Demasiados pedidos seguidos." }, { status: 429 });
    details = await fetchBookDetails({ title, author, googleBooksId: gid }, { googleBooksKey: process.env.GOOGLE_BOOKS_API_KEY });
    if (details.description || details.publisher) cache.set(key, details);
  }
  return Response.json(details, { headers: { "Cache-Control": "public, max-age=86400" } });
}
