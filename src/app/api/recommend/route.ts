import { z } from "zod";
import { ClueSchema } from "@/lib/graph/schema";
import { currentEngine, recommend } from "@/lib/recommend/engine";
import { createRateLimiter } from "@/lib/rate-limit";

/** El modelo puede tardar: hasta 3 intentos más la verificación en catálogos. */
export const maxDuration = 120;

const RequestSchema = z.object({
  clues: z.array(ClueSchema).min(1, "Agregá al menos una pista").max(12),
});

// Cada búsqueda con el modelo cuesta: 8 por IP cada 10 minutos.
const limiter = createRateLimiter({ limit: 8, windowMs: 10 * 60 * 1000 });

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  if (currentEngine() !== "mock") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
    const verdict = limiter(ip);
    if (!verdict.ok) {
      return Response.json(
        { error: `Hiciste muchas búsquedas seguidas. Probá de nuevo en ${Math.ceil(verdict.retryAfterSeconds / 60)} min.` },
        { status: 429, headers: { "retry-after": String(verdict.retryAfterSeconds) } },
      );
    }
  }

  try {
    const { graph, engine, cached } = await recommend(parsed.data.clues);
    return Response.json(graph, { headers: { "x-lineas-engine": engine, "x-lineas-cache": cached ? "hit" : "miss" } });
  } catch (error) {
    console.error("[recommend]", error);
    return Response.json({ error: "No pudimos armar las recomendaciones. Probá de nuevo en un momento." }, { status: 502 });
  }
}
