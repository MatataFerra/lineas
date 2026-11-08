import { z } from "zod";
import { portraitFor } from "@/lib/portraits/store";

const QuerySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["person", "art"]),
});

/** GET ?slug&name&kind → { imageUrl, sourceUrl } o { imageUrl: null }. Ver lib/portraits. */
export async function GET(request: Request) {
  const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const { slug, name, kind } = parsed.data;
  const portrait = await portraitFor(slug, name, kind);
  return Response.json(portrait ?? { imageUrl: null }, { headers: { "Cache-Control": "public, max-age=604800" } });
}
