/**
 * Corre la misma búsqueda con varios modelos (en paralelo) y compara tiempo,
 * tokens, costo y forma del mapa.
 *
 *   pnpm engine:compare --models moonshotai/kimi-k2.6,<otro-modelo> "author:Clarice Lispector" "feeling:Desarraigo"
 *
 * Los nombres de modelo son los de openrouter.ai/models (proveedor/modelo).
 *
 * Sin --models usa LLM_COMPARE_MODELS de .env.local. Cada modelo corre solo
 * (sin respaldos) para que la comparación sea justa. Proveedor: el de la
 * configuración (OpenRouter si hay OPENROUTER_API_KEY). --reasoning low|high
 * pisa el razonamiento configurado.
 */
import { engineFromEnv, llmConfigFromEnv, parseReasoning } from "@/lib/recommend/config";
import { parseClues, runEngine, saveRun, type RunResult } from "./engine-run.mjs";

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const value = argv[i + 1];
  argv.splice(i, 2);
  return value;
};
const modelsArg = flag("models") ?? process.env.LLM_COMPARE_MODELS ?? "";
const reasoningArg = flag("reasoning");
const models = modelsArg.split(",").map((m) => m.trim()).filter(Boolean);

if (engineFromEnv() === "mock") {
  console.error("No hay clave de modelo: configurá OPENROUTER_API_KEY o DEEPSEEK_API_KEY en .env.local.");
  process.exit(1);
}
if (models.length < 2) {
  console.error("Pasá al menos dos modelos: --models a,b  (o LLM_COMPARE_MODELS en .env.local)");
  process.exit(1);
}

const clues = parseClues(argv);
const base = llmConfigFromEnv();
const reasoning = reasoningArg ? parseReasoning(reasoningArg) : base.reasoning;
console.log(`Pistas: ${clues.map((c) => `${c.kind}:${c.label}`).join(" · ")}`);
console.log(`Proveedor: ${base.provider} · razonamiento: ${reasoning}${base.jsonSchema ? " · JSON Schema" : ""}`);
console.log(`Corriendo ${models.length} modelos en paralelo…\n`);

const results = await Promise.all(
  models.map(async (model) => {
    const run = await runEngine(clues, { ...base, models: [model], reasoning });
    console.log(`  ${run.ok ? "✓" : "✗"} ${model} · ${(run.totalMs / 1000).toFixed(1)} s${run.ok ? "" : ` · ${run.error}`}`);
    return { model, run };
  }),
);

const rows = results.map(({ model, run }) => row(model, run));
const headers = ["modelo", "ok", "intentos", "modelo s", "total s", "tokens sal.", "costo US$", "recs", "verif.", "2 saltos", "historia", "interpret."];
const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
const line = (cells: string[]) => cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join("  ");
console.log(`\n${line(headers)}\n${widths.map((w) => "-".repeat(w)).join("  ")}`);
for (const r of rows) console.log(line(r));

console.log("\nGrafos guardados:");
for (const { model, run } of results) if (run.graph) console.log(`  ${model}: ${saveRun(run.graph, model)}`);
console.log("\nLos números miden la forma del mapa; si las conexiones son ciertas lo tiene que leer una persona.");

function row(model: string, run: RunResult): string[] {
  const q = run.quality;
  return [
    model,
    run.ok ? "sí" : "no",
    String(run.attempts),
    (run.llmMs / 1000).toFixed(1),
    (run.totalMs / 1000).toFixed(1),
    String(run.usage.output),
    run.usage.costUsd !== undefined ? run.usage.costUsd.toFixed(4) : "—",
    q ? String(q.recommendations) : "—",
    q ? String(q.verified) : "—",
    q ? String(q.twoHopPaths) : "—",
    q ? String(q.historyEdges) : "—",
    q ? `${Math.round(q.interpretiveShare * 100)}%` : "—",
  ];
}
