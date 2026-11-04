import { z } from "zod";
import { llmConfigFromEnv } from "@/lib/recommend/config";
import { currentEngine, recommendLanes } from "@/lib/recommend/engine";
import { encodeEvent, RecommendRequestSchema } from "@/lib/recommend/events";
import { chatJson } from "@/lib/recommend/llm-client";
import { moderateClues, moderationMessage } from "@/lib/recommend/moderation";
import { createRateLimiter } from "@/lib/rate-limit";

/** Un carril puede tardar: el modelo con un reintento más la verificación en catálogos. */
export const maxDuration = 60;

// Cada búsqueda con el modelo cuesta: 8 búsquedas y 20 "ver otra" por IP cada 10 minutos.
const searches = createRateLimiter({ limit: 8, windowMs: 10 * 60 * 1000 });
const more = createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 });

/**
 * POST { clues, lane?, exclude? } → stream NDJSON de eventos (ver events.ts).
 * Cada carril llega apenas está listo; los errores de validación del pedido y
 * el límite de uso responden JSON común antes de abrir el stream.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = RecommendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  if (currentEngine() !== "mock") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
    const verdict = (parsed.data.lane ? more : searches)(ip);
    if (!verdict.ok) {
      return Response.json(
        { error: `Hiciste muchas búsquedas seguidas. Probá de nuevo en ${Math.ceil(verdict.retryAfterSeconds / 60)} min.` },
        { status: 429, headers: { "retry-after": String(verdict.retryAfterSeconds) } },
      );
    }
  }

  // Antes de gastar los carriles: las pistas tienen que ser algo que se pueda buscar en libros.
  const verdict = await moderateClues(parsed.data.clues, {
    llm: currentEngine() === "mock" ? undefined : llmConfigFromEnv(),
    complete: chatJson,
    onError: (error) => console.warn("[moderation] sigue sin filtro del modelo:", error instanceof Error ? error.message : error),
  });
  if (!verdict.ok) {
    console.info(`[moderation] rechazada (${verdict.reason})`);
    return Response.json({ error: moderationMessage(verdict), code: "blocked" }, { status: 422 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (event: Parameters<Parameters<typeof recommendLanes>[1]>[0]) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          open = false; // el cliente se fue
        }
      };
      try {
        await recommendLanes(parsed.data, emit);
      } finally {
        open = false;
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-lineas-engine": currentEngine(),
    },
  });
}
