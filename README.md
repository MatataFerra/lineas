# Líneas

> No sabés qué leer. Pero sabés qué te mueve.

Líneas recomienda libros a partir de **pistas**: un libro, un autor, una frase, un movimiento, un estilo, una sensación o una idea libre. Cada recomendación viene con su **recorrido**, un mapa acotado de conexiones que explica cómo se llega desde tus pistas hasta el libro: quién inspiró a quién, qué frase se repite, qué música suena de fondo.

## Estado

Prototipo funcional. El flujo completo (inicio → pistas → resultados → conexiones) funciona en desktop y mobile. Con `DEEPSEEK_API_KEY` las recomendaciones las arma DeepSeek y cada libro se verifica contra Google Books / Open Library; sin clave se usa un grafo de ejemplo (`src/lib/graph/mock.ts`).

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
```

## Supabase

1. Copiá `.env.example` a `.env.local` con la URL y la publishable key (dashboard → **Connect** → **App Frameworks** → **Next.js**).
2. Aplicá las migraciones de `supabase/migrations/` en orden: pegalas en **SQL Editor**, o con el CLI (`pnpm dlx supabase link` y `pnpm dlx supabase db push`).
3. En **Authentication → URL Configuration**: *Site URL* `http://localhost:3030` (y la de producción cuando exista) y en *Redirect URLs* agregá `http://localhost:3030/auth/callback` y `https://<tu-dominio>/auth/callback`.

Tablas (todas con RLS, cada usuario ve solo lo suyo):

- `library_items`: guardados y leídos (`status` = `saved` | `read`), con una copia mínima del libro.
- `searches`: pistas y el grafo completo de cada búsqueda.

La sesión se refresca en `src/proxy.ts` (en Next 16 `proxy` reemplaza a `middleware`). Lo que se marca antes de iniciar sesión se sube a la cuenta al entrar.

## Motor de recomendación

`src/lib/recommend/engine.ts` elige el motor: DeepSeek si hay `DEEPSEEK_API_KEY` (o `LINEAS_ENGINE=deepseek`), si no el mock.

Con DeepSeek, cada búsqueda:

1. Pide el grafo a `deepseek-flash` en modo JSON (`prompt.ts`). El mensaje de sistema es fijo para aprovechar el cache de prompts de DeepSeek; las pistas van en el mensaje del usuario.
2. Repara lo mecánico (largos, ids, aristas sueltas) en `normalize.ts` y valida con `ConnectionGraphSchema`.
3. Si no cumple el contrato, reintenta mostrándole al modelo los errores concretos (hasta 3 intentos en total).
4. Verifica cada libro contra Google Books y, si no aparece, Open Library (`src/lib/catalog/books.ts`): marca `verified`, agrega portada e ids. Una recomendación no verificada se descarta si su carril tiene otra verificada; si no, se muestra con la etiqueta «Sin verificar en catálogos».

`/api/recommend` limita a 8 búsquedas por IP cada 10 minutos y cachea en memoria las búsquedas repetidas por 24 h. Ambos son por instancia: alcanzan para empezar, no para producción con tráfico.

## Estructura

```
src/
  app/
    page.tsx                 Inicio
    resultados/page.tsx      Tres carriles de recomendaciones
    conexiones/page.tsx      Mapa (desktop) / recorrido vertical (mobile)
    api/recommend/route.ts   POST { clues } → ConnectionGraph validado
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
    recommend/               motor: selección, cliente DeepSeek, prompt, normalización, reintentos
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
