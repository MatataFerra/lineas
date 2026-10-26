-- Líneas · esquema inicial
-- Biblioteca del usuario (guardados / leídos) e historial de búsquedas.
-- Todo con RLS: cada usuario ve y modifica solo lo suyo.

-- ---------------------------------------------------------------------------
-- Biblioteca
-- ---------------------------------------------------------------------------

create type public.library_status as enum ('saved', 'read');

create table public.library_items (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- id del nodo libro en el grafo (slug estable: "el-extranjero")
  book_id    text not null check (book_id ~ '^[a-z0-9-]+$'),
  status     public.library_status not null,
  -- copia mínima del libro para listar la biblioteca sin volver a pedir el grafo
  title      text not null check (char_length(title) between 1 and 200),
  author     text check (char_length(author) <= 200),
  year_label text check (char_length(year_label) <= 24),
  created_at timestamptz not null default now(),
  -- guardado y leído son independientes: un libro puede tener los dos
  primary key (user_id, book_id, status)
);

create index library_items_user_created_idx on public.library_items (user_id, created_at desc);

alter table public.library_items enable row level security;

create policy "library: leer lo propio"
  on public.library_items for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "library: agregar a lo propio"
  on public.library_items for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "library: borrar lo propio"
  on public.library_items for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Historial de búsquedas
-- ---------------------------------------------------------------------------

create table public.searches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- las pistas tal como las cargó el usuario: [{ id, kind, label }]
  clues      jsonb not null check (jsonb_typeof(clues) = 'array' and jsonb_array_length(clues) between 1 and 12),
  -- el ConnectionGraph completo (validado con Zod antes de guardarse)
  graph      jsonb not null check (jsonb_typeof(graph) = 'object'),
  -- versión del contrato del grafo, para poder migrar datos viejos
  schema_version smallint not null default 1,
  created_at timestamptz not null default now()
);

create index searches_user_created_idx on public.searches (user_id, created_at desc);

alter table public.searches enable row level security;

create policy "searches: leer lo propio"
  on public.searches for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "searches: agregar a lo propio"
  on public.searches for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "searches: borrar lo propio"
  on public.searches for delete to authenticated
  using ((select auth.uid()) = user_id);
