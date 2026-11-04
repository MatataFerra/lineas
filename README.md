# Líneas

> No sabés qué leer. Pero sabés qué te mueve.

Líneas recomienda libros a partir de **pistas**: un libro, un autor, una frase, un movimiento, un estilo, una sensación o una idea libre. Cada recomendación viene con su **recorrido**, un mapa acotado de conexiones que explica cómo se llega desde tus pistas hasta el libro: quién inspiró a quién, qué frase se repite, qué música suena de fondo.

## Estado

Prototipo funcional. El flujo completo (inicio → pistas → resultados → conexiones) funciona en desktop y mobile. Con `OPENROUTER_API_KEY` (o `DEEPSEEK_API_KEY`) las recomendaciones las arma un modelo y cada libro se verifica contra Google Books / Open Library; sin clave se usa un grafo de ejemplo (`src/lib/graph/mock.ts`).

Con Supabase configurado hay login por enlace mágico, biblioteca persistida (guardados / leídos) e historial de búsquedas. Sin variables de entorno la app funciona igual, en modo local.

## Stack

- **Next.js 16** (App Router, Turbopack, Cache Components) + **React 19** + **TypeScript**
- **Tailwind CSS 4**, con tokens claro/oscuro en `src/app/globals.css`
- **Zod 4** para el contrato del grafo; **Zustand 5** para el estado de la sesión
- Tipografías self-hosted con Fontsource (Newsreader + Inter); no dependen de Google Fonts en el build
- **Vitest** para tests

## Desarrollo

```bash
pnpm install
pnpm dev           # http://localhost:3030
pnpm test          # tests del contrato del grafo y del layout
pnpm lint
pnpm typecheck
pnpm build
pnpm engine:try "book:Rayuela" "feeling:Nostalgia"   # prueba el motor real sin levantar la app
pnpm models:pick        # sugiere qué modelos comparar (JSON, precio, velocidad)
pnpm engine:compare --models a/modelo,b/modelo "book:Rayuela"   # misma búsqueda en varios modelos
```

## Supabase

1. Copiá `.env.example` a `.env.local` con la URL y la publishable key (dashboard → **Connect** → **App Frameworks** → **Next.js**).
2. Aplicá las migraciones de `supabase/migrations/` en orden: pegalas en **SQL Editor**, o con el CLI (`pnpm dlx supabase link` y `pnpm dlx supabase db push`).
3. En **Authentication → URL Configuration**: *Site URL* `http://localhost:3030` (y la de producción cuando exista) y en *Redirect URLs* agregá `http://localhost:3030/auth/callback` y `https://<tu-dominio>/auth/callback`.

Tablas (todas con RLS, cada usuario ve solo lo suyo):

- `library_items`: guardados y leídos (`status` = `saved` | `read`), con una copia mínima del libro.
- `searches`: pistas y el grafo completo de cada búsqueda.
- `kg_nodes`, `kg_edges`, `edge_votes`, `rec_signals`: relaciones validadas (ver abajo).
- `graph_cache`: carriles ya generados; solo el servidor, con `SUPABASE_SECRET_KEY`.

La sesión se refresca en `src/proxy.ts` (en Next 16 `proxy` reemplaza a `middleware`). Lo que se marca antes de iniciar sesión se sube a la cuenta al entrar.

## Motor de recomendación

`src/lib/recommend/config.ts` elige el motor según las variables de entorno:

- **OpenRouter** (`OPENROUTER_API_KEY`): una clave para muchos modelos. `LLM_MODELS` es una lista: el primero es el preferido y el resto son respaldos si falla. Cada pedido va al proveedor más rápido de ese modelo (`provider.sort: "throughput"`). Por defecto `anthropic/claude-haiku-5.5` con respaldo `deepseek/deepseek-v4.1-flash-1017` (elegidos con `engine:compare`: el más rápido sin reintentos).
- **DeepSeek** (`DEEPSEEK_API_KEY`): la API oficial, `deepseek-flash` por defecto.
- **Mock**: sin claves, o con `LINEAS_ENGINE=mock`. Emite los carriles con demoras escalonadas, para diseñar la llegada sin gastar tokens.

### Tres carriles en paralelo, por stream

Cada carril (afinidad, alternativo, fuera de tu mapa) es un pedido aparte con **una** recomendación y su recorrido. Los tres corren en paralelo y `/api/recommend` los manda al navegador como **NDJSON** apenas cada uno está listo (`src/lib/recommend/events.ts`):

- `lane`: el subgrafo de un carril, validado con `laneGraphSchema(lane)`.
- `patch`: la verificación en catálogos llegó tarde (portada, `verified`).
- `lane-error`: ese carril falló; los otros siguen.
- `done`.

Por carril (`engine.ts`, `llm-engine.ts`):

1. Busca primero en el cache (`lane-cache.ts`): alternativas ya generadas para esas pistas y ese carril, 30 días, en Supabase (`graph_cache`) si hay `SUPABASE_SECRET_KEY` y si no en memoria. La clave incluye un hash del prompt: cambiarlo invalida el cache.
2. Si no hay, pide el subgrafo al modelo. El servidor fija los ids de las pistas (`clueNodeIds`) para que los carriles se puedan unir. Las conexiones validadas por lectores cercanas a las pistas entran al prompt (`knowledge.ts`, con un presupuesto de 150 ms).
3. Repara lo mecánico en `normalize.ts`, valida, descarta aristas rotas sin pagar otro intento (`salvage`) y, si hace falta, hace **un** reintento mostrándole los errores, dentro de 20 s.
4. Si otro carril ya mostró ese autor o ese libro, se regenera una vez excluyéndolo.
5. Verifica el libro recomendado contra Google Books / Open Library. Si el catálogo tarda más de 1,5 s, el carril sale «sin verificar» y la verificación llega después como `patch`.

«No es lo que busco · ver otra» recorre las opciones ya recibidas y, al final, pide un carril nuevo con los libros a excluir. Límite por IP cada 10 minutos: 8 búsquedas y 20 «ver otra» (en memoria, por instancia).

Para elegir modelo con datos: `pnpm engine:compare --models a,b,c "pista:…"` corre los tres carriles en paralelo con cada modelo y compara cuándo llega el primer carril, el total, tokens, costo y forma del mapa (`quality.ts`).

### Relaciones validadas por lectores

En el recorrido, cada conexión tiene «¿Te convence?» y cada recomendación «¿Te sirve?». Guardar, «Ya lo leí» y «ver otra» cuentan como señales implícitas. Votan solo usuarios con sesión y el agregado es global:

- `kg_nodes` / `kg_edges`: grafo canónico. Una arista entra cuando alguien la vota o guarda el libro de su recorrido; lleva `up`, `down` y `score`.
- `edge_votes`: un voto por usuario y arista. `rec_signals`: señales sobre recomendaciones.
- Se escribe solo por RPC (`vote_edge`, `record_rec_signal`), que recalculan los contadores en la misma transacción; las tablas `kg_*` se leen con la clave pública.

## Estructura

```
src/
  app/
    page.tsx                 Inicio
    resultados/page.tsx      Tres carriles de recomendaciones
    conexiones/page.tsx      Mapa (desktop) / recorrido vertical (mobile)
    api/recommend/route.ts   POST { clues, lane?, exclude? } → stream NDJSON de carriles
    auth/callback/route.ts   canje del enlace mágico (PKCE)
    ingresar/page.tsx        login por email
    biblioteca/page.tsx      Mi biblioteca
  features/
    clues/                   Home, modal/pantalla de pistas, catálogo de sugerencias
    results/                 Pantalla de resultados
    connections/             Grafo, panel del recorrido, línea de tiempo, mini mapa
  lib/
    graph/schema.ts          ← el contrato: ConnectionGraphSchema
    graph/layout.ts          ubica nodos en una línea de tiempo sin superponerlos
    graph/queries.ts         índices, saltos, aristas de un recorrido
    graph/mock.ts            grafo de ejemplo (validado al cargar)
    recommend/               motor: configuración, cliente OpenRouter/DeepSeek, prompt, normalización, reintentos, calidad
    catalog/books.ts         verificación en Google Books / Open Library
    supabase/                clientes de navegador y servidor, tipos de la base
    store.ts                 estado de la sesión (pistas, grafo, usuario, biblioteca)
  proxy.ts                   refresco de sesión de Supabase
supabase/migrations/         SQL versionado
```

## El contrato del grafo

`ConnectionGraphSchema` (en `src/lib/graph/schema.ts`) es lo que devuelve el motor y lo que consume toda la UI:

- **`clues`**: las pistas del usuario.
- **`nodes`** (máx. 16): libros, personas, movimientos, otras artes e ideas, cada uno con su época (`era`) para ubicarlo en la línea de tiempo. Los que corresponden a pistas llevan `isClue`.
- **`edges`**: conexiones tipadas (`influence`, `shared_phrase`, `other_arts`, `shared_theme`, `belongs_to`, `same_author`), cada una con `confidence` (`documented` / `scholarly` / `interpretive`), un resumen corto y una explicación. Una `shared_phrase` tiene que incluir la frase.
- **`recommendations`**: hasta 3 por carril (`affinity`, `alternative`, `beyond`), cada una con su `path` desde una pista hasta el libro (máx. 2 saltos).

La validación garantiza también la integridad referencial: las aristas apuntan a nodos existentes, cada recorrido empieza en una pista, termina en el libro recomendado y tiene una arista entre cada par de paradas. Si el modelo devuelve algo que no cumple, se rechaza y se reintenta pasándole los errores.

## Próximos pasos

1. **Probar y ajustar el prompt** con búsquedas reales (`pnpm engine:try`).
2. **Búsqueda real en el modal de pistas** contra Google Books.
3. **Tus búsquedas**: pantalla de historial (los datos ya se guardan) y cache de grafos compartido en Supabase.
4. **Deploy en Vercel.**
