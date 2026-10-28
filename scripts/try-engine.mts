/**
 * Prueba el motor con pistas reales, sin levantar la app.
 *
 *   pnpm engine:try "book:On the Road" "movement:Generación Beat" "feeling:La libertad"
 *
 * Usa la misma configuración que la app (.env.local): proveedor, modelos,
 * razonamiento. Imprime el detalle y guarda el grafo en .engine-runs/.
 */
import { CONFIDENCE_META, EDGE_META, LANE_META, LANE_ORDER } from "@/lib/graph/labels";
import { engineFromEnv, llmConfigFromEnv } from "@/lib/recommend/config";
import { parseClues, runEngine, saveRun } from "./engine-run.mjs";

if (engineFromEnv() === "mock") {
  console.error("No hay clave de modelo: configurá OPENROUTER_API_KEY o DEEPSEEK_API_KEY en .env.local.");
  process.exit(1);
}

const clues = parseClues(process.argv.slice(2));
const config = llmConfigFromEnv();
console.log(`Pistas: ${clues.map((c) => `${c.kind}:${c.label}`).join(" · ")}`);
console.log(`Proveedor: ${config.provider} · modelos: ${config.models.join(", ")} · razonamiento: ${config.reasoning}${config.jsonSchema ? " · JSON Schema" : ""}\n`);

const run = await runEngine(clues, config, (event) => {
  if (event.type === "attempt") console.log(`→ intento ${event.attempt}…`);
  if (event.type === "invalid") console.log(`  inválido:\n${event.reason.replace(/^/gm, "    ")}`);
  if (event.type === "salvaged") {
    const parts = [
      event.droppedRecommendations.length ? `recomendaciones descartadas: ${event.droppedRecommendations.join(", ")}` : "",
      event.droppedEdges.length ? `aristas descartadas: ${event.droppedEdges.join(", ")}` : "",
    ].filter(Boolean);
    console.log(`  rescatado sin reintentar · ${parts.join(" · ")}`);
  }
  if (event.type === "success") console.log(`  ok · respondió ${event.model}`);
});

if (!run.ok || !run.graph || !run.generated || !run.quality) {
  console.error(`\nFalló: ${run.error}`);
  process.exit(1);
}

const { graph, generated, quality, usage } = run;
const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
const cost = usage.costUsd !== undefined ? ` · costo US$ ${usage.costUsd.toFixed(4)}` : "";
console.log(`\ntokens entrada ${usage.input} (cache ${usage.cached}) · salida ${usage.output}${cost}`);
console.log(`${graph.nodes.length} nodos · ${graph.edges.length} aristas · modelo ${(run.llmMs / 1000).toFixed(1)} s · total ${(run.totalMs / 1000).toFixed(1)} s\n`);

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
if (run.misses.length) {
  console.log("\nNo encontrados en catálogos:");
  for (const m of run.misses) console.log(`  ${m.title} (${m.author}): ${m.tried.map((t) => `${t.source} «${t.query}» → ${t.outcome}`).join(" · ")}`);
  if (run.misses.some((m) => m.tried.some((t) => t.source === "google" && t.outcome.startsWith("http-")))) {
    console.log("  → Google Books respondió con error. Sin GOOGLE_BOOKS_API_KEY la cuota es compartida y se agota rápido.");
  }
}

console.log(`\nRecorridos de 2 saltos: ${quality.twoHopPaths}/${quality.recommendations} · colgados directo de una idea: ${quality.directFromConcept}`);
console.log(`Aristas de historia (influencia, otras artes, frase): ${quality.historyEdges}${quality.historyEdges < 4 ? "  ← pocas: el mapa es más temático que histórico" : ""}`);
const byType = Object.groupBy(graph.edges, (e) => EDGE_META[e.type].label);
const byConfidence = Object.groupBy(graph.edges, (e) => CONFIDENCE_META[e.confidence].label);
console.log(`Aristas por tipo: ${Object.entries(byType).map(([k, v]) => `${k} ${v?.length}`).join(" · ")}`);
console.log(`Aristas por confianza: ${Object.entries(byConfidence).map(([k, v]) => `${k} ${v?.length}`).join(" · ")}`);

console.log(`\nGrafo completo: ${saveRun(graph, run.model ?? config.models[0])}`);
