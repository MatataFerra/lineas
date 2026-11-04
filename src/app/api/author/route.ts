import { z } from "zod";
import { fetchAuthorProfile, type AuthorProfile } from "@/lib/authors/profile";
import { createRateLimiter } from "@/lib/rate-limit";

const QuerySchema = z.object({ name: z.string().trim().min(2).max(80) });

// Un día en memoria del servidor y una semana en el navegador: la bibliografía de un autor casi no cambia.
const DAY_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { profile: AuthorProfile; at: number }>();
const limiter = createRateLimiter({ limit: 60, windowMs: 10 * 60 * 1000 });

/** GET ?name → perfil del autor (ver lib/authors/profile). */
export async function GET(request: Request) {
  const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });

  const key = parsed.data.name.toLowerCase();
  const hit = cache.get(key);
  let profile = hit && Date.now() - hit.at < DAY_MS ? hit.profile : null;
  if (!profile) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
    if (!limiter(ip).ok) return Response.json({ error: "Demasiados pedidos seguidos." }, { status: 429 });
    profile = await fetchAuthorProfile(parsed.data.name);
    if (profile.bio || profile.works.length) cache.set(key, { profile, at: Date.now() });
  }
  return Response.json(profile, { headers: { "Cache-Control": "public, max-age=604800" } });
}
