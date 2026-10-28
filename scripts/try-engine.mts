/**
 * Prueba el motor de DeepSeek con pistas reales, sin levantar la app.
 *
 *   pnpm engine:try "book:On the Road" "movement:Generación Beat" "feeling:La libertad"
 *
 * Lee DEEPSEEK_API_KEY (y opcionales DEEPSEEK_MODEL, DEEPSEEK_REASONING,
 * GOOGLE_BOOKS_API_KEY) de .env.local. Imprime un resumen y guarda el grafo
 * completo en .engine-runs/ para revisarlo.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { verifyGraphBooks } from "@/lib/catalog/books";
import { CONFIDENCE_META, EDGE_META, LANE_META, LANE_ORDER } from "@/lib/graph/labels";
import { ClueKindSchema, type Clue } from "@/lib/graph/schema";
import { generateGraphWithLlm } from "@/lib/recommend/llm-engine";

const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
  console.error("Falta DEEPSEEK_API_KEY en .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const clues: Clue[] = (args.length ? args : ["book:On the Road", "movement:Generación Beat", "feeling:La libertad"]).map((arg, i) => {
  const [kind, ...rest] = arg.split(":");
  const parsed = ClueKindSchema.safeParse(kind);
  if (!parsed.success || rest.length === 0) {
    console.error(`Pista inválida: "${arg}". Formato: tipo:valor (tipos: ${ClueKindSchema.options.join(", ")})`);
    process.exit(1);
  }
  return { id: `c${i + 1}`, kind: parsed.data, label: rest.join(":").trim() };
});

const reasoning = process.env.DEEPSEEK_REASONING;
const started = Date.now();
console.log(`Pistas: ${clues.map((c) => `${c.kind}:${c.label}`).join(" · ")}`);
console.log(`Modelo: ${process.env.DEEPSEEK_MODEL || "deepseek-flash"} · razonamiento: ${reasoning || "none"}\n`);

const generated = await generateGraphWithLlm(clues, {
  apiKey,
  model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
  reasoningEffort: reasoning === "low" || reasoning === "high" || reasoning === "max" ? reasoning : "none",
  log: (event) => {
    if (event.type === "attempt") console.log(`→ intento ${event.attempt}…`);
    if (event.type === "invalid") console.log(`  inválido:\n${event.reason.replace(/^/gm, "    ")}`);
    if (event.type === "success") {
      const total = event.usage.reduce(
        (acc, u) => ({ in: acc.in + u.prompt_tokens, hit: acc.hit + (u.prompt_cache_hit_tokens ?? 0), out: acc.out + u.completion_tokens }),
        { in: 0, hit: 0, out: 0 },
      );
      console.log(`  ok · tokens entrada ${total.in} (cache ${total.hit}) · salida ${total.out}`);
    }
  },
});
const llmMs = Date.now() - started;
const graph = await verifyGraphBooks(generated, { googleBooksKey: process.env.GOOGLE_BOOKS_API_KEY });
const totalMs = Date.now() - started;

const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
console.log(`\n${graph.nodes.length} nodos · ${graph.edges.length} aristas · modelo ${(llmMs / 1000).toFixed(1)} s · total ${(totalMs / 1000).toFixed(1)} s\n`);

for (const lane of LANE_ORDER) {
  console.log(LANE_META[lane].label.toUpperCase());
  for (const rec of graph.recommendations.filter((r) => r.lane === lane)) {
    const book = nodes.get(rec.nodeId)!;
    const mark = book.book?.verified ? "✓" : "✗ sin verificar";
    console.log(`  ${book.label} — ${book.book?.author} (${book.era.label}) ${mark}`);
    console.log(`    recorrido: ${rec.path.map((id) => nodes.get(id)?.label).join(" → ")}`);
  }
}

const dropped = generated.recommendations.filter((r) => !graph.recommendations.some((g) => g.nodeId === r.nodeId));
if (dropped.length) console.log(`\nDescartadas por no verificarse: ${dropped.map((r) => nodes.get(r.nodeId)?.label).join(", ")}`);

const byType = Object.groupBy(graph.edges, (e) => EDGE_META[e.type].label);
const byConfidence = Object.groupBy(graph.edges, (e) => CONFIDENCE_META[e.confidence].label);
console.log(`\nAristas por tipo: ${Object.entries(byType).map(([k, v]) => `${k} ${v?.length}`).join(" · ")}`);
console.log(`Aristas por confianza: ${Object.entries(byConfidence).map(([k, v]) => `${k} ${v?.length}`).join(" · ")}`);

mkdirSync(".engine-runs", { recursive: true });
const file = `.engine-runs/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(file, JSON.stringify(graph, null, 2));
console.log(`\nGrafo completo: ${file}`);
