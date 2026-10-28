import { ConnectionGraphSchema, type Clue, type ConnectionGraph, type ConnectionGraphInput } from "./schema";

/**
 * Grafo de ejemplo, el mismo universo del diseño.
 * Se valida al cargarse: si alguien lo edita y rompe el contrato, falla en el build.
 *
 * Las conexiones están escritas a mano como contenido de muestra; antes de
 * usarlas como datos reales conviene revisarlas.
 */
const MOCK = {
  version: 1,
  clues: [
    { id: "c1", kind: "book", label: "On the Road" },
    { id: "c2", kind: "movement", label: "Generación Beat" },
    { id: "c3", kind: "feeling", label: "La libertad" },
  ],
  nodes: [
    { id: "on-the-road", kind: "book", label: "On the Road", subtitle: "Jack Kerouac", era: { from: 1957, label: "1957" }, isClue: true, book: { author: "Jack Kerouac", verified: true } },
    { id: "generacion-beat", kind: "movement", label: "Generación Beat", subtitle: "Movimiento", era: { from: 1944, to: 1960, label: "1944–1960" }, isClue: true },
    { id: "thomas-wolfe", kind: "person", label: "Thomas Wolfe", subtitle: "Novelista", era: { from: 1929, label: "1929" } },
    { id: "charlie-parker", kind: "art", label: "Charlie Parker", subtitle: "Música · bebop", era: { from: 1940, to: 1955, label: "1940s" } },
    { id: "arthur-rimbaud", kind: "person", label: "Arthur Rimbaud", subtitle: "Poeta", era: { from: 1854, to: 1891, label: "1854–1891", pivot: 1873 } },
    { id: "existencialismo", kind: "movement", label: "Existencialismo", subtitle: "Corriente de ideas", era: { from: 1940, to: 1955, label: "1940s" } },
    { id: "los-vagabundos-del-dharma", kind: "book", label: "Los vagabundos del Dharma", subtitle: "Jack Kerouac", era: { from: 1958, label: "1958" }, book: { author: "Jack Kerouac", verified: true } },
    { id: "aullido", kind: "book", label: "Aullido", subtitle: "Allen Ginsberg", era: { from: 1956, label: "1956" }, book: { author: "Allen Ginsberg", verified: true } },
    { id: "el-almuerzo-desnudo", kind: "book", label: "El almuerzo desnudo", subtitle: "William S. Burroughs", era: { from: 1959, label: "1959" }, book: { author: "William S. Burroughs", verified: true } },
    { id: "fiesta", kind: "book", label: "Fiesta", subtitle: "Ernest Hemingway", era: { from: 1926, label: "1926" }, book: { author: "Ernest Hemingway", verified: true } },
    { id: "rayuela", kind: "book", label: "Rayuela", subtitle: "Julio Cortázar", era: { from: 1963, label: "1963" }, book: { author: "Julio Cortázar", verified: true } },
    { id: "siddhartha", kind: "book", label: "Siddhartha", subtitle: "Hermann Hesse", era: { from: 1922, label: "1922" }, book: { author: "Hermann Hesse", verified: true } },
    { id: "el-extranjero", kind: "book", label: "El extranjero", subtitle: "Albert Camus", era: { from: 1942, label: "1942" }, book: { author: "Albert Camus", verified: true } },
    { id: "los-detectives-salvajes", kind: "book", label: "Los detectives salvajes", subtitle: "Roberto Bolaño", era: { from: 1998, label: "1998" }, book: { author: "Roberto Bolaño", verified: true } },
    { id: "la-hora-de-la-estrella", kind: "book", label: "La hora de la estrella", subtitle: "Clarice Lispector", era: { from: 1977, label: "1977" }, book: { author: "Clarice Lispector", verified: true } },
  ],
  edges: [
    {
      id: "wolfe-road", source: "thomas-wolfe", target: "on-the-road", type: "influence", confidence: "documented",
      summary: "Kerouac escribió a su sombra antes de encontrar su voz.",
      explanation: "Kerouac idolatraba a Thomas Wolfe: su primera novela, The Town and the City (1950), está escrita a su sombra. On the Road es el momento en que se suelta de él y encuentra una voz propia.",
    },
    {
      id: "rimbaud-beat", source: "arthur-rimbaud", target: "generacion-beat", type: "influence", confidence: "documented",
      summary: "El poeta que lo dejó todo, modelo de los Beat.",
      explanation: "El poeta adolescente que abandonó la literatura para vagar por el mundo fue un modelo para Ginsberg y Kerouac. Kerouac llegó a dedicarle un poema largo, «Rimbaud».",
    },
    {
      id: "rimbaud-detectives", source: "arthur-rimbaud", target: "los-detectives-salvajes", type: "influence", confidence: "scholarly",
      summary: "Los poetas de Bolaño cargan con su mito.",
      explanation: "Los poetas jóvenes de Bolaño heredan el mito de Rimbaud: escribir de jóvenes, romper con todo y desaparecer en el camino. La novela es, en parte, una búsqueda de esa figura.",
    },
    {
      id: "fiesta-beat", source: "fiesta", target: "generacion-beat", type: "shared_phrase", confidence: "scholarly",
      quote: "Todos ustedes son una generación perdida",
      summary: "«Una generación perdida»: un nombre que pide respuesta.",
      explanation: "El epígrafe de Fiesta cita a Gertrude Stein: «Todos ustedes son una generación perdida». La frase bautizó a la generación de Hemingway, y treinta años después «generación Beat» se pensó en espejo de ese nombre.",
    },
    {
      id: "road-beat", source: "on-the-road", target: "generacion-beat", type: "belongs_to", confidence: "documented",
      summary: "La novela que hizo visible al movimiento.",
      explanation: "On the Road es la novela que, en 1957, puso a la generación Beat en el centro de la cultura estadounidense.",
    },
    {
      id: "parker-road", source: "charlie-parker", target: "on-the-road", type: "other_arts", confidence: "documented",
      summary: "Prosa que quiere sonar como un solo de saxo.",
      explanation: "Kerouac quería escribir como improvisa un saxo de bebop: frases largas, sin corregir, al ritmo de la respiración. El jazz atraviesa toda la novela.",
    },
    {
      id: "parker-rayuela", source: "charlie-parker", target: "rayuela", type: "other_arts", confidence: "documented",
      summary: "El jazz como idioma del Club de la Serpiente.",
      explanation: "Cortázar se inspiró en Charlie Parker para su relato El perseguidor (1959). En Rayuela, el jazz es el idioma con el que se entiende el Club de la Serpiente en París.",
    },
    {
      id: "existencialismo-beat", source: "existencialismo", target: "generacion-beat", type: "shared_theme", confidence: "scholarly",
      summary: "El hipster como «existencialista americano».",
      explanation: "Los Beat leyeron a los existencialistas franceses, y en 1957 Norman Mailer describió al hipster como «el existencialista americano»: alguien que vive en el presente, sin reglas heredadas.",
    },
    {
      id: "extranjero-existencialismo", source: "el-extranjero", target: "existencialismo", type: "belongs_to", confidence: "scholarly",
      summary: "Texto central, aunque Camus rechazaba la etiqueta.",
      explanation: "El extranjero se volvió uno de los textos centrales del existencialismo, aunque Camus rechazaba que lo encasillaran en esa corriente.",
    },
    {
      id: "road-dharma", source: "on-the-road", target: "los-vagabundos-del-dharma", type: "same_author", confidence: "documented",
      summary: "La ruta sube a la montaña.",
      explanation: "Kerouac publica Los vagabundos del Dharma un año después de On the Road. Los mismos personajes con otros nombres, pero la búsqueda de libertad gira hacia el budismo y la montaña.",
    },
    {
      id: "siddhartha-dharma", source: "siddhartha", target: "los-vagabundos-del-dharma", type: "shared_theme", confidence: "interpretive",
      summary: "Dos búsquedas espirituales de raíz oriental.",
      explanation: "Dos novelas de búsqueda espiritual a través del budismo. Hesse se volvió lectura de cabecera de la contracultura que siguió a los Beat.",
    },
    {
      id: "road-detectives", source: "on-the-road", target: "los-detectives-salvajes", type: "shared_theme", confidence: "interpretive",
      summary: "Poetas en la ruta, cuarenta años después.",
      explanation: "Dos novelas de poetas en la carretera. Bolaño reescribe la road novel en México: autos, poemas y una búsqueda que no termina.",
    },
    {
      id: "aullido-beat", source: "aullido", target: "generacion-beat", type: "belongs_to", confidence: "documented",
      summary: "El poema-manifiesto del movimiento.",
      explanation: "Aullido fue el poema-manifiesto de la generación Beat. El juicio por obscenidad de 1957 lo volvió célebre y puso al grupo en los diarios.",
    },
    {
      id: "almuerzo-beat", source: "el-almuerzo-desnudo", target: "generacion-beat", type: "belongs_to", confidence: "documented",
      summary: "El lado más oscuro de los Beat.",
      explanation: "Burroughs fue la figura mayor del grupo, y aparece en On the Road con otro nombre. El almuerzo desnudo es el costado más oscuro y experimental del movimiento.",
    },
    {
      id: "hora-existencialismo", source: "la-hora-de-la-estrella", target: "existencialismo", type: "shared_theme", confidence: "interpretive",
      summary: "La misma pregunta, lejos de la ruta.",
      explanation: "Una vida mínima en Río, contada con una voz que duda de sí misma. Comparte con los existencialistas la pregunta por qué significa ser libre cuando nada tiene un sentido dado.",
    },
  ],
  recommendations: [
    { nodeId: "los-vagabundos-del-dharma", lane: "affinity", path: ["on-the-road", "los-vagabundos-del-dharma"],
      pitch: "El mismo Kerouac, pero la ruta ahora sube a la montaña: la libertad se busca en el silencio y el budismo zen, no solo en la carretera.",
      pathSummary: "El camino más corto: mismo autor, misma sed de libertad, pero mirando hacia adentro." },
    { nodeId: "aullido", lane: "affinity", path: ["generacion-beat", "aullido"],
      pitch: "El poema que fue manifiesto de la generación Beat. Corto, urgente y escrito por uno de los amigos que aparecen en On the Road.",
      pathSummary: "Del movimiento a su texto fundacional: si te mueve la generación Beat, este es su grito." },
    { nodeId: "el-almuerzo-desnudo", lane: "affinity", path: ["generacion-beat", "el-almuerzo-desnudo"],
      pitch: "El lado más oscuro y experimental de los Beat. Si On the Road es el viaje, este es lo que queda cuando el viaje se rompe.",
      pathSummary: "Dentro del mismo grupo, pero del lado de la sombra." },
    { nodeId: "fiesta", lane: "alternative", path: ["generacion-beat", "fiesta"],
      pitch: "Otra generación, la perdida, con el mismo impulso de moverse para no pensar. Más contenida e introspectiva que Kerouac.",
      pathSummary: "Una frase une a dos generaciones: la «perdida» de Hemingway y la Beat de Kerouac se nombraron una en espejo de la otra." },
    { nodeId: "rayuela", lane: "alternative", path: ["on-the-road", "charlie-parker", "rayuela"],
      pitch: "Buscar sin rumbo entre París y Buenos Aires, con jazz de fondo. La novela misma es un viaje que armás vos.",
      pathSummary: "El puente no es literario sino musical: el bebop de Charlie Parker late en la prosa de Kerouac y en la de Cortázar." },
    { nodeId: "siddhartha", lane: "alternative", path: ["on-the-road", "los-vagabundos-del-dharma", "siddhartha"],
      pitch: "Un viaje de búsqueda espiritual que muchos lectores de los Beat hicieron propio. Menos ruta, más camino interior.",
      pathSummary: "De la ruta a la montaña, y de la montaña al río: la búsqueda se vuelve interior." },
    { nodeId: "el-extranjero", lane: "beyond", path: ["generacion-beat", "existencialismo", "el-extranjero"],
      pitch: "No hay ruta ni viaje: la libertad aparece como indiferencia ante las reglas. Un desvío incómodo que ilumina lo que buscabas en los Beat.",
      pathSummary: "Lejos de la ruta pero cerca de la pregunta: qué hacer con una libertad sin reglas. La conexión pasa por el existencialismo." },
    { nodeId: "los-detectives-salvajes", lane: "beyond", path: ["generacion-beat", "arthur-rimbaud", "los-detectives-salvajes"],
      pitch: "Poetas jóvenes cruzando México en auto detrás de una leyenda. La herencia Beat, reescrita en clave latinoamericana.",
      pathSummary: "El salto más largo: de los Beat a Rimbaud, y de Rimbaud a los poetas errantes de Bolaño, más de un siglo después." },
    { nodeId: "la-hora-de-la-estrella", lane: "beyond", path: ["generacion-beat", "existencialismo", "la-hora-de-la-estrella"],
      pitch: "Lo opuesto a la carretera: una vida mínima en Río. Pero la misma pregunta de fondo sobre qué significa ser libre.",
      pathSummary: "Sin ruta y sin viaje, pero con la misma pregunta existencial que los Beat se llevaron a la carretera." },
  ],
} satisfies ConnectionGraphInput;

export const MOCK_GRAPH: ConnectionGraph = ConnectionGraphSchema.parse(MOCK);

/** Devuelve el grafo de ejemplo con las pistas que mandó el usuario. */
export function mockGraphFor(clues: Clue[]): ConnectionGraph {
  return { ...MOCK_GRAPH, clues: clues.length ? clues : MOCK_GRAPH.clues };
}
