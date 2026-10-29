/**
 * Elige candidatos de OpenRouter para Líneas, sin mirar la tabla a mano.
 *
 *   pnpm models:pick                 # top 4 y la línea para .env.local
 *   pnpm models:pick --max-cost 0.02 --top 6
 *
 * 1. Baja el catálogo (GET /api/v1/models, público).
 * 2. Se queda con modelos de texto que aceptan `response_format` (devuelven JSON),
 *    no gratuitos, con contexto suficiente y costo por búsqueda bajo el tope.
 * 3. Para los más baratos consulta sus proveedores (…/endpoints) y toma el
 *    más rápido que soporte JSON: tokens/s y latencia de los últimos 30 min.
 * 4. Estima segundos y US$ por búsqueda y ordena por velocidad.
 *
 * La estimación asume ~7k tokens de entrada y ~5k de salida por búsqueda
 * (lo que viene midiendo engine:try). La calidad no se puede medir acá:
 * para eso está engine:compare con los modelos que salgan de esta lista.
 */
const API = "https://openrouter.ai/api/v1";
const INPUT_TOKENS = 7_000;
const OUTPUT_TOKENS = 5_000;
const MIN_CONTEXT = 64_000;

const argv = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(argv[i + 1]);
};
const maxCost = flag("max-cost", 0.03); // US$ por búsqueda
const top = flag("top", 4);
const probe = flag("probe", 25); // cuántos modelos consultar en detalle

const key = process.env.OPENROUTER_API_KEY;
const headers: Record<string, string> = key ? { Authorization: `Bearer ${key}` } : {};

interface Model {
  id: string;
  name: string;
  context_length: number | null;
  pricing: { prompt: string; completion: string };
  supported_parameters?: string[];
  architecture?: { output_modalities?: string[] };
}
interface Percentiles { p50?: number | null }
interface Endpoint {
  provider_name: string;
  status?: number;
  pricing: { prompt: string; completion: string };
  supported_parameters?: string[];
  throughput_last_30m?: Percentiles | null;
  latency_last_30m?: Percentiles | null;
  uptime_last_30m?: number | null;
}

const costOf = (p: { prompt: string; completion: string }) =>
  Number(p.prompt) * INPUT_TOKENS + Number(p.completion) * OUTPUT_TOKENS;
const supportsJson = (params?: string[]) => !!params?.includes("response_format");

const res = await fetch(`${API}/models`, { headers }).catch((e: Error) => {
  console.error(`No pude conectar con OpenRouter: ${e.cause ?? e.message}`);
  process.exit(1);
});
if (!res.ok) {
  console.error(`OpenRouter respondió ${res.status} al pedir el catálogo.`);
  process.exit(1);
}
const { data: models } = (await res.json()) as { data: Model[] };

const candidates = models
  .filter((m) => !m.id.endsWith(":free") && !/batch|preview/i.test(m.id))
  .filter((m) => (m.architecture?.output_modalities ?? ["text"]).includes("text"))
  .filter((m) => supportsJson(m.supported_parameters))
  .filter((m) => (m.context_length ?? 0) >= MIN_CONTEXT)
  .map((m) => ({ model: m, cost: costOf(m.pricing) }))
  .filter((c) => c.cost > 0 && c.cost <= maxCost)
  .sort((a, b) => a.cost - b.cost)
  .slice(0, probe);

console.log(`${models.length} modelos en el catálogo · ${candidates.length} devuelven JSON y cuestan ≤ US$ ${maxCost} por búsqueda`);
console.log(`Consultando velocidad de proveedores…\n`);

let endpointsBlocked = false;
const rows = (
  await Promise.all(
    candidates.map(async ({ model, cost }) => {
      const r = await fetch(`${API}/models/${model.id}/endpoints`, { headers }).catch(() => null);
      if (!r?.ok) {
        if (r && (r.status === 401 || r.status === 403)) endpointsBlocked = true;
        return { id: model.id, cost, tps: undefined, latency: undefined, provider: "?", seconds: undefined };
      }
      const { data } = (await r.json()) as { data: { endpoints: Endpoint[] } };
      const usable = data.endpoints
        .filter((e) => (e.status ?? 0) === 0 && supportsJson(e.supported_parameters))
        .map((e) => ({
          provider: e.provider_name,
          tps: e.throughput_last_30m?.p50 ?? undefined,
          latency: e.latency_last_30m?.p50 ?? undefined, // ms
          cost: costOf(e.pricing),
        }))
        .filter((e) => e.tps);
      const best = usable.sort((a, b) => b.tps! - a.tps!)[0];
      if (!best) return null; // ningún proveedor activo con JSON
      const seconds = (best.latency ?? 1000) / 1000 + OUTPUT_TOKENS / best.tps!;
      return { id: model.id, cost: best.cost, tps: best.tps, latency: best.latency, provider: best.provider, seconds };
    }),
  )
).filter((r): r is NonNullable<typeof r> => r !== null && r.cost <= maxCost);

// Rápidos primero; si no hubo datos de velocidad, por precio.
rows.sort((a, b) => (a.seconds ?? Infinity) - (b.seconds ?? Infinity) || a.cost - b.cost);

const table = rows.map((r) => [
  r.id,
  r.seconds !== undefined ? `~${Math.round(r.seconds)} s` : "—",
  r.tps !== undefined ? String(Math.round(r.tps)) : "—",
  r.cost.toFixed(4),
  r.provider,
]);
const head = ["modelo", "por búsqueda", "tok/s", "US$/búsq.", "proveedor más rápido"];
const widths = head.map((h, i) => Math.max(h.length, ...table.map((t) => t[i].length)));
const line = (c: string[]) => c.map((x, i) => (i === 0 || i === 4 ? x.padEnd(widths[i]) : x.padStart(widths[i]))).join("  ");
console.log(line(head));
console.log(widths.map((w) => "-".repeat(w)).join("  "));
for (const t of table.slice(0, 15)) console.log(line(t));

if (endpointsBlocked) console.log("\n(No pude leer la velocidad de algunos proveedores; corré con OPENROUTER_API_KEY en .env.local.)");

const picks = rows.slice(0, top).map((r) => r.id);
if (!picks.includes("moonshotai/kimi-k2.6") && models.some((m) => m.id === "moonshotai/kimi-k2.6")) picks.push("moonshotai/kimi-k2.6");

console.log(`\nCandidatos para comparar (pegá esta línea en .env.local):\n`);
console.log(`LLM_COMPARE_MODELS=${picks.join(",")}`);
console.log(`\nDespués: pnpm engine:compare "author:Clarice Lispector" "feeling:Desarraigo"`);
