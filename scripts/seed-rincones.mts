/**
 * Siembra los rincones de Explorar: le pide al modelo la constelación de
 * cada tema, verifica cada libro en Google Books / Open Library, descarta lo
 * que no aparece y guarda el resultado en src/data/rincones.json.
 *
 *   pnpm explore:seed                 genera solo los que faltan
 *   pnpm explore:seed beat ruta       regenera esos
 *   pnpm explore:seed --all           regenera todos
 *   pnpm explore:seed --review        revisa de nuevo los que ya están, sin regenerarlos
 *   pnpm explore:seed --review paris  revisa solo esos
 *
 * Cada rincón nuevo pasa por una segunda lectura del modelo, como crítico:
 * marca libros que no van o con datos dudosos y conexiones exageradas, y se
 * quitan. Después se unifica el mismo libro escrito distinto entre rincones.
 *
 * Es curaduría hecha una vez: el JSON se revisa en el diff antes de commitear.
 */
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { lookupBook } from "@/lib/catalog/books";
import { fixDirections, prune, unifyBooks } from "@/lib/explore/curate";
import { RINCON_LIMITS, rinconIssues, RinconSchema, type Rincon, type RinconGroup } from "@/lib/explore/rincon";
import { ConfidenceSchema, EdgeTypeSchema, EraSchema, NodeKindSchema, type GraphEdge, type GraphNode } from "@/lib/graph/schema";
import { engineFromEnv, llmConfigFromEnv } from "@/lib/recommend/config";
import { chatJson } from "@/lib/recommend/llm-client";
import { slug } from "@/lib/recommend/normalize";

const OUT = new URL("../src/data/rincones.json", import.meta.url);

interface Seed {
  slug: string;
  title: string;
  group: RinconGroup;
  kind: "movement" | "concept";
  hint: string;
}

const SEEDS: Seed[] = [
  { slug: "generacion-beat", title: "Generación Beat", group: "movimiento", kind: "movement", hint: "Kerouac, Ginsberg, Burroughs; la ruta, el jazz, la prosa espontánea" },
  { slug: "existencialismo", title: "Existencialismo", group: "movimiento", kind: "movement", hint: "Sartre, Camus, Beauvoir; la libertad, el absurdo, la angustia" },
  { slug: "boom-latinoamericano", title: "Boom latinoamericano", group: "movimiento", kind: "movement", hint: "García Márquez, Cortázar, Vargas Llosa, Fuentes; años 60" },
  { slug: "surrealismo", title: "Surrealismo", group: "movimiento", kind: "movement", hint: "Breton, el sueño, la escritura automática; también pintura y cine" },
  { slug: "generacion-perdida", title: "Generación perdida", group: "movimiento", kind: "movement", hint: "Hemingway, Fitzgerald, Stein; expatriados en París tras la Primera Guerra" },
  { slug: "modernismo-ingles", title: "Modernismo en inglés", group: "movimiento", kind: "movement", hint: "Woolf, Joyce, Eliot, Faulkner; el flujo de conciencia" },
  { slug: "novela-negra", title: "Novela negra", group: "movimiento", kind: "movement", hint: "Hammett, Chandler, Highsmith; la ciudad corrupta, el detective" },
  { slug: "realismo-ruso", title: "Realismo ruso", group: "movimiento", kind: "movement", hint: "Dostoievski, Tolstói, Chéjov, Gógol; siglo XIX" },
  { slug: "romanticismo", title: "Romanticismo", group: "movimiento", kind: "movement", hint: "Mary Shelley, Byron, Goethe, Bécquer; la naturaleza, lo sublime" },
  { slug: "paris-entreguerras", title: "París de entreguerras", group: "epoca", kind: "concept", hint: "los años 20 y 30 en París: Shakespeare and Company, cafés, exiliados" },
  { slug: "contracultura", title: "La contracultura de los 60", group: "epoca", kind: "concept", hint: "Kesey, Thompson, Didion, Vonnegut; rock, psicodelia, protesta" },
  { slug: "posguerra-europea", title: "Posguerra europea", group: "epoca", kind: "concept", hint: "después de 1945: Levi, Böll, Duras, Calvino; memoria y reconstrucción" },
  { slug: "fin-de-siglo", title: "Fin de siglo", group: "epoca", kind: "concept", hint: "1880-1910: decadentismo, Wilde, Huysmans, Darío, modernismo hispano" },
  { slug: "el-viaje", title: "El viaje", group: "tema", kind: "concept", hint: "viajar como forma de conocerse: de la Odisea a la ruta y el viaje interior" },
  { slug: "la-memoria", title: "La memoria", group: "tema", kind: "concept", hint: "recordar, olvidar, reconstruir el pasado: Proust, Sebald, Modiano" },
  { slug: "el-doble", title: "El doble", group: "tema", kind: "concept", hint: "el otro yo, el espejo, la identidad partida: Poe, Stevenson, Borges, Saramago" },
  { slug: "distopias", title: "Distopías", group: "tema", kind: "concept", hint: "sociedades vigiladas o controladas: Orwell, Huxley, Atwood, Bradbury" },
  { slug: "el-exilio", title: "El exilio", group: "tema", kind: "concept", hint: "dejar el país, el desarraigo, la lengua extranjera" },
  { slug: "la-soledad", title: "La soledad", group: "tema", kind: "concept", hint: "estar solo y la búsqueda del otro, en la ciudad y fuera de ella" },
  { slug: "la-ciudad-de-noche", title: "La ciudad de noche", group: "tema", kind: "concept", hint: "noctámbulos, bares, insomnio, la ciudad que no duerme" },
  { slug: "buenos-aires", title: "Buenos Aires", group: "lugar", kind: "concept", hint: "la ciudad en la literatura: Borges, Arlt, Cortázar, Marechal, Piglia" },
  { slug: "nueva-york", title: "Nueva York", group: "lugar", kind: "concept", hint: "la ciudad en la literatura: Fitzgerald, Dos Passos, Auster, Lorca" },
  { slug: "paris", title: "París", group: "lugar", kind: "concept", hint: "la ciudad en la literatura: Balzac, Baudelaire, Cortázar, Modiano" },
  { slug: "mexico", title: "México", group: "lugar", kind: "concept", hint: "Rulfo, Paz, Fuentes, Lowry, Bolaño" },
  { slug: "dublin", title: "Dublín", group: "lugar", kind: "concept", hint: "Joyce, Beckett, Wilde, Yeats; la ciudad como personaje" },
  { slug: "tokio", title: "Tokio", group: "lugar", kind: "concept", hint: "Murakami, Kawabata, Mishima, Tanizaki y la ciudad moderna" },
];

const PROMPT = `Sos el curador de Líneas, una app que conecta libros a través de personas, movimientos e ideas. Armá la constelación de un rincón de Explorar.

Respondé solo con JSON:
{
  "intro": "2 o 3 frases (máx. 380 caracteres) en español rioplatense neutro, concretas, sin adjetivos de folleto: qué une a lo que hay en el mapa",
  "nodes": [ { "kind": "book" | "person" | "movement" | "art" | "concept", "label": "...", "subtitle": "...", "originalTitle": "...", "era": { "from": 1957, "to": 1969, "label": "1957", "pivot": 1957 } } ],
  "edges": [ { "source": "<label exacto>", "target": "<label exacto>", "type": "...", "confidence": "...", "summary": "≤ 120 caracteres", "explanation": "≤ 400 caracteres", "quote": "solo para shared_phrase" } ]
}

Reglas:
- Exactamente ${RINCON_LIMITS.maxBooks} libros (kind "book"): obras conocidas y fáciles de conseguir, de autores distintos cuando se pueda. label = el título con el que circula en español; originalTitle = el título original si es otro; subtitle = el autor (nombre completo).
- Entre 3 y ${RINCON_LIMITS.maxOthers} nodos más: personas (autores o figuras clave; subtitle = su oficio), obras de otras artes (kind "art": discos, películas, pinturas), o ideas (kind "concept").
- No incluyas el nodo del centro: ya existe y se llama exactamente como el rincón. Usá su nombre como source o target.
- era: para un libro, el año de publicación (from y label "1957"); para una persona, nacimiento y muerte (from, to, label "1922–1969", pivot = el año de su obra principal).
- Tipos de arista: influence (A inspiró a B, de lo anterior a lo posterior), shared_phrase (comparten una frase; quote obligatoria), other_arts (influencia desde música, cine, pintura), shared_theme (comparten una pregunta), belongs_to (libro → movimiento o idea, incluido el centro), same_author (dos libros del mismo autor), authored (persona → libro suyo).
- confidence: documented (hay registro: cartas, entrevistas, dedicatorias), scholarly (consenso crítico), interpretive (una lectura nuestra). No presentes una interpretación como un hecho.
- Cada libro tiene una arista belongs_to hacia el centro (target = el nombre exacto del rincón), con un summary que diga cómo encarna el tema.
- Cada nodo con al menos una arista; entre 12 y 18 aristas en total. Si una persona está y escribió un libro del mapa, uní con authored.
- Nada inventado: si no estás seguro de un dato, no lo pongas.`;

const RawSchema = z.object({
  intro: z.string(),
  nodes: z.array(z.object({ kind: NodeKindSchema, label: z.string().min(1).max(80), subtitle: z.string().optional(), originalTitle: z.string().optional(), era: EraSchema.optional() })),
  edges: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      type: EdgeTypeSchema,
      confidence: ConfidenceSchema,
      summary: z.string().min(1),
      explanation: z.string().min(1),
      quote: z.string().optional(),
    }),
  ),
});

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

async function build(seed: Seed): Promise<{ rincon?: Rincon; issues: string[]; dropped: string[] }> {
  const config = { ...llmConfigFromEnv(), maxTokens: 8000, timeoutMs: 90_000 };
  const result = await chatJson(
    [
      { role: "system", content: PROMPT },
      { role: "user", content: `Rincón: ${seed.title} (${seed.group}). Orientación: ${seed.hint}.` },
    ],
    config,
  );
  const raw = RawSchema.safeParse(JSON.parse(result.content.replace(/^```(?:json)?\s*|\s*```$/g, "")));
  if (!raw.success) return { issues: [z.prettifyError(raw.error)], dropped: [] };

  // Ids estables: el slug del nombre. Así el mismo autor o libro es el mismo nodo en todos los rincones.
  const centerEra = { from: Math.min(...raw.data.nodes.flatMap((n) => (n.era ? [n.era.from] : []))), label: seed.title.slice(0, 24) };
  const center: GraphNode = { id: seed.slug, kind: seed.kind, label: seed.title, era: centerEra, isClue: false };
  const idOf = new Map<string, string>([[slug(seed.title), seed.slug]]);
  const nodes: GraphNode[] = [center];
  for (const n of raw.data.nodes) {
    const id = slug(n.label);
    if (!id || idOf.has(slug(n.label)) || !n.era) continue;
    idOf.set(slug(n.label), id);
    nodes.push({ id, kind: n.kind, label: n.label, ...(n.subtitle ? { subtitle: clip(n.subtitle, 60) } : {}), ...(n.originalTitle ? { originalTitle: clip(n.originalTitle, 120) } : {}), era: n.era, isClue: false });
  }

  // Cada libro, contra el catálogo. Lo que no aparece no entra.
  const dropped: string[] = [];
  await Promise.all(
    nodes.map(async (node, i) => {
      if (node.kind !== "book") return;
      const author = node.subtitle ?? "";
      const report = await lookupBook([node.label, node.originalTitle ?? ""], author, { googleBooksKey: process.env.GOOGLE_BOOKS_API_KEY });
      const m = report.match;
      nodes[i] = {
        ...node,
        book: {
          author,
          verified: !!m,
          ...(m?.coverUrl ? { coverUrl: m.coverUrl } : {}),
          ...(m?.googleBooksId ? { googleBooksId: m.googleBooksId } : {}),
          ...(m?.openLibraryKey ? { openLibraryKey: m.openLibraryKey } : {}),
          ...(m?.isbn ? { isbn: m.isbn } : {}),
        },
      };
      if (!m) dropped.push(node.label);
    }),
  );
  let kept = nodes.filter((n) => n.kind !== "book" || n.book?.verified);
  let ids = new Set(kept.map((n) => n.id));

  const edges: GraphEdge[] = [];
  for (const e of raw.data.edges) {
    const source = idOf.get(slug(e.source));
    const target = idOf.get(slug(e.target));
    if (!source || !target || source === target || !ids.has(source) || !ids.has(target)) continue;
    if (e.type === "shared_phrase" && !e.quote) continue;
    const id = `${source}--${e.type}--${target}`;
    if (edges.some((x) => x.id === id)) continue;
    edges.push({ id, source, target, type: e.type, confidence: e.confidence, summary: clip(e.summary, 140), explanation: clip(e.explanation, 600), ...(e.quote ? { quote: clip(e.quote, 200) } : {}) });
  }

  // Lo que quedó suelto al sacar libros no verificados, afuera; y no más libros que el máximo.
  const linked = new Set(edges.flatMap((e) => [e.source, e.target]));
  kept = kept.filter((n) => linked.has(n.id));
  const books = kept.filter((n) => n.kind === "book");
  if (books.length > RINCON_LIMITS.maxBooks) {
    const extra = new Set(books.slice(RINCON_LIMITS.maxBooks).map((n) => n.id));
    kept = kept.filter((n) => !extra.has(n.id));
  }
  const others = kept.filter((n) => n.kind !== "book" && n.id !== seed.slug);
  if (others.length > RINCON_LIMITS.maxOthers) {
    const extra = new Set(others.slice(RINCON_LIMITS.maxOthers).map((n) => n.id));
    kept = kept.filter((n) => !extra.has(n.id));
  }
  ids = new Set(kept.map((n) => n.id));
  const finalEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  const finalLinked = new Set(finalEdges.flatMap((e) => [e.source, e.target]));
  kept = kept.filter((n) => finalLinked.has(n.id));

  const rincon: Rincon = { slug: seed.slug, title: seed.title, group: seed.group, intro: clip(raw.data.intro.trim(), 420), centerId: seed.slug, nodes: kept, edges: finalEdges.filter((e) => finalLinked.has(e.source) && finalLinked.has(e.target)) };
  const issues = rinconIssues(rincon);
  const parsed = RinconSchema.safeParse(rincon);
  if (!parsed.success && !issues.length) issues.push(z.prettifyError(parsed.error));
  return issues.length ? { issues, dropped } : { rincon: parsed.data, issues, dropped };
}

const REVIEW_PROMPT = `Sos el editor de Líneas y revisás un rincón de Explorar que armó otro curador. Sé exigente: es lo que ven todos los lectores.

Marcá para quitar:
- Libros que no encarnan claramente el tema del rincón, o cuyo título o autor no son exactos (título mal escrito, obra que no existe con ese nombre, autor equivocado).
- Personas, obras u ideas que sobran o no se justifican.
- Conexiones falsas, exageradas o con una confianza que no corresponde (algo interpretativo presentado como documentado).

No marques lo que está bien solo por marcar algo. Respondé solo con JSON:
{"removeNodes": ["id", ...], "removeEdges": ["id", ...], "notes": "una frase con lo que quitaste y por qué"}`;

const ReviewSchema = z.object({ removeNodes: z.array(z.string()).default([]), removeEdges: z.array(z.string()).default([]), notes: z.string().default("") });

async function review(r: Rincon): Promise<{ rincon: Rincon; notes: string }> {
  const lines = [
    `Rincón: ${r.title} (${r.group}). Centro: ${r.centerId}.`,
    `Intro: ${r.intro}`,
    "Nodos:",
    ...r.nodes.filter((n) => n.id !== r.centerId).map((n) => `- ${n.id} · ${n.kind} · ${n.label}${n.originalTitle ? ` (${n.originalTitle})` : ""}${n.subtitle ? ` · ${n.subtitle}` : ""} · ${n.era.label}`),
    "Conexiones:",
    ...r.edges.map((e) => `- ${e.id} · ${e.confidence}: ${e.summary}`),
  ];
  const result = await chatJson(
    [
      { role: "system", content: REVIEW_PROMPT },
      { role: "user", content: lines.join("\n") },
    ],
    { ...llmConfigFromEnv(), maxTokens: 1500, timeoutMs: 60_000 },
  );
  // A veces explica antes de responder: se toma el objeto JSON que haya en el texto.
  const json = result.content.slice(result.content.indexOf("{"), result.content.lastIndexOf("}") + 1);
  const parsed = ReviewSchema.parse(JSON.parse(json));
  return { rincon: prune(r, parsed.removeNodes, parsed.removeEdges), notes: parsed.notes };
}

async function pool<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: size }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await run(item);
  }));
}

/* ------------------------------------------------------------------ */

if (engineFromEnv() === "mock") {
  console.error("No hay clave de modelo: configurá OPENROUTER_API_KEY o DEEPSEEK_API_KEY en .env.local.");
  process.exit(1);
}

const args = process.argv.slice(2);
const existing: Rincon[] = await readFile(OUT, "utf8")
  .then((t) => JSON.parse(t) as Rincon[])
  .catch(() => []);
const have = new Set(existing.map((r) => r.slug));
const wanted = args.includes("--all") ? SEEDS : args.includes("--review") ? [] : args.length ? SEEDS.filter((s) => args.includes(s.slug)) : SEEDS.filter((s) => !have.has(s.slug));
console.log(`Rincones a generar: ${wanted.length} (${wanted.map((s) => s.slug).join(", ") || "ninguno"})\n`);

const results = new Map(existing.map((r) => [r.slug, r]));
const generated: string[] = [];
const failed: string[] = [];
await pool(wanted, 4, async (seed) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { rincon, issues, dropped } = await build(seed);
      if (rincon) {
        results.set(seed.slug, rincon);
        generated.push(seed.slug);
        const books = rincon.nodes.filter((n) => n.kind === "book").length;
        console.log(`✓ ${seed.slug}: ${books} libros, ${rincon.nodes.length - books - 1} más, ${rincon.edges.length} conexiones${dropped.length ? ` · sin verificar, afuera: ${dropped.join("; ")}` : ""}`);
        return;
      }
      console.log(`✗ ${seed.slug} (intento ${attempt}): ${issues.join(" | ")}${dropped.length ? ` · sin verificar: ${dropped.join("; ")}` : ""}`);
    } catch (error) {
      console.log(`✗ ${seed.slug} (intento ${attempt}): ${error instanceof Error ? error.message : error}`);
    }
  }
  failed.push(seed.slug);
});

// Segunda lectura: lo recién generado, o todo con --review.
const listed = args.filter((a) => results.has(a));
const toReview = args.includes("--review") ? (listed.length ? listed : [...results.keys()]) : generated;
if (toReview.length) console.log(`\nRevisando ${toReview.length}…`);
await pool(toReview, 4, async (slugName) => {
  const before = results.get(slugName)!;
  try {
    const { rincon, notes } = await review(fixDirections(before));
    const issues = rinconIssues(rincon);
    if (issues.length) {
      // Si la revisión lo deja flojo, afuera: la próxima corrida lo genera de nuevo.
      results.delete(slugName);
      failed.push(slugName);
      console.log(`✗ ${slugName}: la revisión lo dejó incompleto (${issues.join(" | ")}) · ${notes}`);
      return;
    }
    results.set(slugName, rincon);
    const removed = before.nodes.length - rincon.nodes.length;
    console.log(`· ${slugName}: ${removed ? `quitó ${removed} nodos, ` : ""}${before.edges.length - rincon.edges.length} conexiones · ${notes}`);
  } catch (error) {
    console.log(`! ${slugName}: no se pudo revisar (${error instanceof Error ? error.message : error}); queda como estaba`);
  }
});

const unified = unifyBooks(SEEDS.flatMap((s) => (results.has(s.slug) ? [fixDirections(results.get(s.slug)!)] : [])));
const ordered = unified.filter((r) => {
  const parsed = RinconSchema.safeParse(r);
  if (!parsed.success) console.log(`✗ ${r.slug} quedó inválido al unificar: ${z.prettifyError(parsed.error)}`);
  return parsed.success;
});
await writeFile(OUT, `${JSON.stringify(ordered, null, 2)}\n`);
console.log(`\nGuardados ${ordered.length} rincones en src/data/rincones.json${failed.length ? ` · faltan: ${failed.join(", ")} (corré de nuevo para regenerarlos)` : ""}`);
