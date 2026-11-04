import { z } from "zod";
import { BookRefSchema, ClueSchema, LaneSchema, MAX_CLUES, laneGraphSchema, type BookRef, type ConnectionGraph, type Lane } from "@/lib/graph/schema";

/**
 * Lo que viaja de /api/recommend al navegador: una línea JSON por evento
 * (NDJSON). Cada carril llega apenas está listo, sin esperar a los otros.
 *
 *   lane        el subgrafo de un carril (validado)
 *   patch       llegó tarde la verificación en catálogos: portada y `verified`
 *   lane-error  ese carril no se pudo armar; los demás siguen
 *   done        no hay más eventos
 */
export type StreamEvent =
  | { type: "lane"; lane: Lane; graph: ConnectionGraph; cached: boolean }
  | { type: "patch"; lane: Lane; nodeId: string; book: BookRef }
  | { type: "lane-error"; lane: Lane; message: string }
  | { type: "done" };

export const ExcludedBookSchema = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().max(200),
});
export type ExcludedBook = z.infer<typeof ExcludedBookSchema>;

export const RecommendRequestSchema = z.object({
  clues: z.array(ClueSchema).min(1, "Agregá al menos una pista").max(MAX_CLUES, `Hasta ${MAX_CLUES} pistas`),
  /** Sin carril: los tres. Con carril: "ver otra" de ese carril. */
  lane: LaneSchema.optional(),
  exclude: z.array(ExcludedBookSchema).max(40).default([]),
});
export type RecommendRequest = z.input<typeof RecommendRequestSchema>;

const RawEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("lane"), lane: LaneSchema, graph: z.unknown(), cached: z.boolean() }),
  z.object({ type: z.literal("patch"), lane: LaneSchema, nodeId: z.string().min(1), book: BookRefSchema }),
  z.object({ type: z.literal("lane-error"), lane: LaneSchema, message: z.string() }),
  z.object({ type: z.literal("done") }),
]);

/** Valida una línea del stream. El grafo de un carril se valida con el contrato de ese carril. */
export function parseStreamEvent(line: string): StreamEvent {
  const event = RawEventSchema.parse(JSON.parse(line));
  if (event.type !== "lane") return event;
  return { ...event, graph: laneGraphSchema(event.lane).parse(event.graph) };
}

export function encodeEvent(event: StreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/** Lee un cuerpo NDJSON y llama a `onEvent` por cada línea completa, en orden de llegada. */
export async function readEventStream(body: ReadableStream<Uint8Array>, onEvent: (event: StreamEvent) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(parseStreamEvent(line));
    }
    if (done) break;
  }
  if (buffer.trim()) onEvent(parseStreamEvent(buffer.trim()));
}
