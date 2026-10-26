import { z } from "zod";
import { ClueSchema } from "@/lib/graph/schema";
import { recommend } from "@/lib/recommend/engine";

const RequestSchema = z.object({
  clues: z.array(ClueSchema).min(1, "Agregá al menos una pista").max(12),
});

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const graph = await recommend(parsed.data.clues);
    return Response.json(graph);
  } catch (error) {
    console.error("[recommend]", error);
    return Response.json({ error: "No pudimos armar las recomendaciones. Probá de nuevo." }, { status: 502 });
  }
}
