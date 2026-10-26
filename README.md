# Líneas

> No sabés qué leer. Pero sabés qué te mueve.

Líneas recomienda libros a partir de **pistas**: un libro, un autor, una frase, un movimiento, un estilo, una sensación o una idea libre. Cada recomendación viene con su **recorrido**, un mapa acotado de conexiones que explica cómo se llega desde tus pistas hasta el libro: quién inspiró a quién, qué frase se repite, qué música suena de fondo.

## Estado

Prototipo funcional con **datos de ejemplo**. El flujo completo (inicio → pistas → resultados → conexiones) funciona en desktop y mobile. El motor de recomendación todavía devuelve un grafo fijo (`src/lib/graph/mock.ts`). Todavía no se llama a ningún modelo ni hay base de datos.

## Stack

- **Next.js 16** (App Router, Turbopack, Cache Components) + **React 19** + **TypeScript**
- **Tailwind CSS 4**, con tokens claro/oscuro en `src/app/globals.css`
- **Zod 4** para el contrato del grafo; **Zustand 5** para el estado de la sesión
- Tipografías self-hosted con Fontsource (Newsreader + Inter); no dependen de Google Fonts en el build
- **Vitest** para tests

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tests del contrato del grafo y del layout
npm run lint
npm run typecheck
npm run build
```

Copiá `.env.example` a `.env.local` cuando empecemos a conectar servicios. Hoy no hace falta ninguna variable.

## Estructura

```
src/
  app/
    page.tsx                 Inicio
    resultados/page.tsx      Tres carriles de recomendaciones
    conexiones/page.tsx      Mapa (desktop) / recorrido vertical (mobile)
    api/recommend/route.ts   POST { clues } → ConnectionGraph validado
  features/
    clues/                   Home, modal/pantalla de pistas, catálogo de sugerencias
    results/                 Pantalla de resultados
    connections/             Grafo, panel del recorrido, línea de tiempo, mini mapa
  lib/
    graph/schema.ts          ← el contrato: ConnectionGraphSchema
    graph/layout.ts          ubica nodos en una línea de tiempo sin superponerlos
    graph/queries.ts         índices, saltos, aristas de un recorrido
    graph/mock.ts            grafo de ejemplo (validado al cargar)
    recommend/engine.ts      motor de recomendación (hoy: mock)
    store.ts                 estado de la sesión (pistas, grafo, guardados)
```

## El contrato del grafo

`ConnectionGraphSchema` (en `src/lib/graph/schema.ts`) es lo que devuelve el motor y lo que consume toda la UI:

- **`clues`**: las pistas del usuario.
- **`nodes`** (máx. 16): libros, personas, movimientos, otras artes e ideas, cada uno con su época (`era`) para ubicarlo en la línea de tiempo. Los que corresponden a pistas llevan `isClue`.
- **`edges`**: conexiones tipadas (`influence`, `shared_phrase`, `other_arts`, `shared_theme`, `belongs_to`, `same_author`), cada una con `confidence` (`documented` / `scholarly` / `interpretive`), un resumen corto y una explicación. Una `shared_phrase` tiene que incluir la frase.
- **`recommendations`**: hasta 3 por carril (`affinity`, `alternative`, `beyond`), cada una con su `path` desde una pista hasta el libro (máx. 2 saltos).

La validación garantiza también la integridad referencial: las aristas apuntan a nodos existentes, cada recorrido empieza en una pista, termina en el libro recomendado y tiene una arista entre cada par de paradas. Si el modelo devuelve algo que no cumple, se rechaza (y el motor real va a reintentar pasándole los errores).

## Próximos pasos

1. **Motor LLM** en `src/lib/recommend/engine.ts`: salida estructurada con el JSON Schema de `z.toJSONSchema(ConnectionGraphSchema)`, validación y reintento.
2. **Verificación de libros** contra Google Books / Open Library (`book.verified`, `coverUrl`) y búsqueda real en el modal de pistas.
3. **Supabase**: login, biblioteca, historial de búsquedas y cache de grafos.
4. **Deploy en Vercel.**
