import type { ClueKind, Confidence, EdgeType, Lane, NodeKind } from "./schema";

export const LANE_META: Record<Lane, { label: string; short: string; hint: string }> = {
  affinity: { label: "Tu afinidad", short: "Afinidad", hint: "Lo más cercano a lo que ya te mueve." },
  alternative: { label: "Un camino alternativo", short: "Alternativo", hint: "Comparte el espíritu, pero entra por otra puerta." },
  beyond: { label: "Fuera de tu mapa", short: "Fuera de mapa", hint: "Una conexión que probablemente no esperabas." },
};

export const LANE_ORDER: Lane[] = ["affinity", "alternative", "beyond"];

export const EDGE_META: Record<EdgeType, { label: string; dash: string; width: number; arrow: boolean }> = {
  influence: { label: "Influencia", dash: "none", width: 1.6, arrow: true },
  shared_phrase: { label: "Frase compartida", dash: "7 5", width: 1.6, arrow: true },
  other_arts: { label: "Otras artes", dash: "12 4 2 4", width: 1.6, arrow: true },
  shared_theme: { label: "Tema en común", dash: "1 6", width: 2.2, arrow: false },
  belongs_to: { label: "Pertenece a", dash: "none", width: 1, arrow: true },
  same_author: { label: "Mismo autor", dash: "3 3", width: 1.4, arrow: true },
  authored: { label: "Obra de", dash: "3 3", width: 1.4, arrow: true },
};

export const EDGE_ORDER: EdgeType[] = ["influence", "shared_phrase", "other_arts", "shared_theme", "belongs_to", "same_author", "authored"];

export const CONFIDENCE_META: Record<Confidence, { label: string; hint: string }> = {
  documented: { label: "Documentado", hint: "Hay registro: cartas, entrevistas, citas." },
  scholarly: { label: "Consenso crítico", hint: "Lo sostiene la crítica, aunque no haya un registro directo." },
  interpretive: { label: "Interpretación", hint: "Un paralelismo que proponemos, no un vínculo probado." },
};

export const NODE_KIND_LABEL: Record<NodeKind, string> = {
  book: "Libro",
  person: "Autor",
  movement: "Movimiento",
  art: "Otras artes",
  concept: "Idea",
};

export const CLUE_KIND_META: Record<ClueKind, { label: string; short: string; description: string; placeholder: string }> = {
  book: { label: "Libro", short: "Libro", description: "Buscá un título o elegí de la lista", placeholder: "Buscar un libro…" },
  author: { label: "Autor", short: "Autor", description: "Encontrá un autor o autora", placeholder: "Buscar un autor o autora…" },
  quote: { label: "Frase", short: "Frase", description: "Pegá una cita o una frase que te marcó", placeholder: "Escribí o pegá una frase…" },
  movement: { label: "Movimiento / Generación", short: "Movimiento", description: "Épocas, corrientes, movimientos culturales", placeholder: "Buscar un movimiento o una época…" },
  style: { label: "Estilo", short: "Estilo", description: "Cómo te gusta que se lea la narrativa", placeholder: "Buscar un estilo…" },
  feeling: { label: "Sensación", short: "Sensación", description: "Una emoción, una experiencia, un estado de ánimo", placeholder: "¿Qué querés sentir?" },
  idea: { label: "Idea libre", short: "Idea libre", description: "Escribí lo que quieras, sin límites", placeholder: "Escribí una idea…" },
};

export const CLUE_KIND_ORDER: ClueKind[] = ["book", "author", "quote", "movement", "style", "feeling", "idea"];
