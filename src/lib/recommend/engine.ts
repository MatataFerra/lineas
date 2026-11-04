// Solo servidor: si algo de cliente importa este módulo, el build falla.
import "server-only";
import { createHash } from "node:crypto";
import { verifyGraphBooks } from "@/lib/catalog/books";
import { authorKey, authorOf, laneSubgraph, recommendedBook } from "@/lib/graph/merge";
import { MOCK_GRAPH } from "@/lib/graph/mock";
import { LaneSchema, type Clue, type ConnectionGraph, type Lane } from "@/lib/graph/schema";
import { engineFromEnv, llmConfigFromEnv, type EngineName } from "./config";
import type { ExcludedBook, StreamEvent } from "./events";
import { readLaneCache, writeLaneCache } from "./lane-cache";
import { generateLaneWithLlm } from "./llm-engine";
import { SYSTEM_PROMPT } from "./prompt";

/**
 * Motor de recomendación. Corre solo en el servidor (lo llama /api/recommend).
 *
 * Cada carril se pide por separado y en paralelo: llega al navegador apenas
 * está listo, sin esperar a los otros. Si dos carriles traen el mismo autor,
 * el que llegó después se regenera excluyendo los libros ya mostrados.
 *
 * - "openrouter" / "deepseek": pide el carril al modelo, lo valida (con un
 *   reintento) y verifica el libro contra Google Books / Open Library.
 * - "mock": el grafo de ejemplo, con demoras escalonadas para diseñar la llegada.
 *
 * Qué motor y qué modelos se usan lo deciden las variables de entorno (config.ts).
 */
export type { EngineName } from "./config";

export function currentEngine(): EngineName {
  return engineFromEnv();
}

/** Cuánto esperamos al catálogo antes de mostrar el libro como «sin verificar» (y corregirlo después). */
const VERIFY_BUDGET_MS = 1500;

/** Cambiar el prompt invalida el cache solo. */
const PROMPT_VERSION = createHash("sha1").update(SYSTEM_PROMPT).digest("hex").slice(0, 8);

export function cacheKey(clues: Clue[], lane: Lane): string {
  const sorted = clues.map((c) => [c.kind, c.label.trim().toLowerCase()]).sort((a, b) => (a.join() < b.join() ? -1 : 1));
  return JSON.stringify([PROMPT_VERSION, lane, sorted]);
}

export interface RecommendInput {
  clues: Clue[];
  /** Sin carril: los tres. Con carril: "ver otra" de ese carril. */
  lane?: Lane;
  exclude: ExcludedBook[];
}

export async function recommendLanes(input: RecommendInput, emit: (event: StreamEvent) => void): Promise<void> {
  const lanes = input.lane ? [input.lane] : LaneSchema.options;
  const engine = currentEngine();
  // Lo ya mostrado (en esta respuesta o antes): no se repite autor ni libro.
  const shown: ExcludedBook[] = [...input.exclude];

  const runLane = engine === "mock" ? mockLane : llmLane;
  await Promise.all(
    lanes.map(async (lane, i) => {
      try {
        await runLane({ ...input, lane, delayMs: input.lane ? 500 : 600 * (i + 1) }, shown, emit);
      } catch (error) {
        console.error(`[recommend] carril ${lane}`, error);
        emit({ type: "lane-error", lane, message: "No pudimos armar este camino." });
      }
    }),
  );
  emit({ type: "done" });
}

type LaneRun = (input: { clues: Clue[]; lane: Lane; delayMs: number }, shown: ExcludedBook[], emit: (event: StreamEvent) => void) => Promise<void>;

const llmLane: LaneRun = async ({ clues, lane }, shown, emit) => {
  const key = cacheKey(clues, lane);

  // Primero, una alternativa ya generada que no choque con lo mostrado.
  const cachedHit = (await readLaneCache(key, lane)).find((g) => !collides(g, shown));
  if (cachedHit) {
    shown.push(bookOf(cachedHit));
    emit({ type: "lane", lane, graph: { ...cachedHit, clues }, cached: true });
    return;
  }

  const config = llmConfigFromEnv();
  const log = (event: Parameters<NonNullable<Parameters<typeof generateLaneWithLlm>[1]["log"]>>[0]) => {
    if (event.type === "invalid") console.warn(`[recommend] ${lane} intento ${event.attempt} inválido:\n${event.reason}`);
    if (event.type === "success") console.info(`[recommend] ${lane} ok con ${event.model} en intento ${event.attempt}`, JSON.stringify(event.usage));
  };

  let graph = await generateLaneWithLlm({ clues, lane, exclude: [...shown] }, { ...config, log });
  // Otro carril llegó antes con el mismo autor (o libro): se regenera una vez, excluyéndolo.
  if (collides(graph, shown)) {
    console.info(`[recommend] ${lane} repite autor; regenerando`);
    graph = await generateLaneWithLlm({ clues, lane, exclude: [...shown] }, { ...config, log });
  }
  shown.push(bookOf(graph));

  const verification = verifyGraphBooks(graph, { googleBooksKey: process.env.GOOGLE_BOOKS_API_KEY, onlyRecommended: true });
  const inTime = await Promise.race([verification, sleep(VERIFY_BUDGET_MS).then(() => null)]);
  if (inTime) {
    writeLaneCache(key, lane, inTime, sameBook);
    emit({ type: "lane", lane, graph: inTime, cached: false });
    return;
  }

  emit({ type: "lane", lane, graph, cached: false });
  const verified = await verification.catch(() => null);
  if (!verified) return;
  writeLaneCache(key, lane, verified, sameBook);
  const book = recommendedBook(verified);
  if (book?.book) emit({ type: "patch", lane, nodeId: book.id, book: book.book });
};

const mockLane: LaneRun = async ({ clues, lane, delayMs }, shown, emit) => {
  await sleep(delayMs);
  const options = MOCK_GRAPH.recommendations
    .filter((r) => r.lane === lane)
    .map((rec) => ({ ...laneSubgraph(MOCK_GRAPH, rec), clues: clues.length ? clues : MOCK_GRAPH.clues }));
  const graph = options.find((g) => !collides(g, shown));
  if (!graph) {
    emit({ type: "lane-error", lane, message: "No hay más libros de ejemplo en este camino." });
    return;
  }
  shown.push(bookOf(graph));
  emit({ type: "lane", lane, graph, cached: false });
};

function bookOf(graph: ConnectionGraph): ExcludedBook {
  const node = recommendedBook(graph);
  return { title: node?.label ?? "", author: node ? authorOf(node) : "" };
}

/** El libro del carril ya se mostró, o es del mismo autor que otro mostrado. */
export function collides(graph: ConnectionGraph, shown: ExcludedBook[]): boolean {
  const book = bookOf(graph);
  const title = book.title.trim().toLowerCase();
  const author = authorKey(book.author);
  return shown.some((s) => s.title.trim().toLowerCase() === title || (author !== "" && authorKey(s.author) === author));
}

function sameBook(a: ConnectionGraph, b: ConnectionGraph): boolean {
  return bookOf(a).title === bookOf(b).title;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
