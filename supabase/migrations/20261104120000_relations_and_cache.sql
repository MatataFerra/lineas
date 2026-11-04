-- Líneas · relaciones validadas por lectores y cache de carriles
--
-- Un grafo canónico propio: nodos (por slug) y aristas (por origen, destino y
-- tipo) que entran solo cuando alguien las vota o guarda el libro de su
-- recorrido. Cada voto es de un usuario; los contadores up/down se recalculan
-- en la misma transacción. Nada de esto se escribe directo desde el cliente:
-- las tablas kg_* se leen con la clave pública y se escriben por RPC.

-- ---------------------------------------------------------------------------
-- Grafo canónico
-- ---------------------------------------------------------------------------

create table public.kg_nodes (
  slug           text primary key check (slug ~ '^[a-z0-9-]+$' and char_length(slug) <= 120),
  kind           text not null check (kind in ('book', 'person', 'movement', 'art', 'concept')),
  label          text not null check (char_length(label) between 1 and 80),
  subtitle       text check (char_length(subtitle) <= 60),
  original_title text check (char_length(original_title) <= 120),
  -- { from, to?, label, pivot? } como en el contrato del grafo
  era            jsonb not null check (jsonb_typeof(era) = 'object'),
  created_at     timestamptz not null default now()
);

create table public.kg_edges (
  id          bigint generated always as identity primary key,
  source      text not null references public.kg_nodes (slug) on delete cascade,
  target      text not null references public.kg_nodes (slug) on delete cascade,
  type        text not null check (type in ('influence', 'shared_phrase', 'other_arts', 'shared_theme', 'belongs_to', 'same_author', 'authored')),
  confidence  text not null check (confidence in ('documented', 'scholarly', 'interpretive')),
  summary     text not null check (char_length(summary) between 1 and 140),
  explanation text not null check (char_length(explanation) between 1 and 600),
  quote       text check (char_length(quote) <= 200),
  up          integer not null default 0 check (up >= 0),
  down        integer not null default 0 check (down >= 0),
  score       integer generated always as (up - down) stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (source <> target),
  -- shared_theme no tiene dirección: se guarda con source < target para no duplicarla
  check (type <> 'shared_theme' or source < target),
  unique (source, target, type)
);

create index kg_edges_source_idx on public.kg_edges (source);
create index kg_edges_target_idx on public.kg_edges (target);

alter table public.kg_nodes enable row level security;
alter table public.kg_edges enable row level security;

create policy "kg_nodes: lectura pública" on public.kg_nodes for select to anon, authenticated using (true);
create policy "kg_edges: lectura pública" on public.kg_edges for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Votos y señales
-- ---------------------------------------------------------------------------

create table public.edge_votes (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  edge_id    bigint not null references public.kg_edges (id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, edge_id)
);

create index edge_votes_edge_idx on public.edge_votes (edge_id);

alter table public.edge_votes enable row level security;

create policy "edge_votes: leer lo propio" on public.edge_votes for select to authenticated using ((select auth.uid()) = user_id);

create type public.rec_signal as enum ('up', 'down', 'saved', 'read', 'skipped');

create table public.rec_signals (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- firma de las pistas (kind + label normalizados), para agrupar búsquedas iguales
  clues_key  text not null check (char_length(clues_key) <= 2000),
  book_slug  text not null check (book_slug ~ '^[a-z0-9-]+$'),
  lane       text not null check (lane in ('affinity', 'alternative', 'beyond')),
  signal     public.rec_signal not null,
  created_at timestamptz not null default now()
);

create index rec_signals_book_idx on public.rec_signals (book_slug);
create index rec_signals_user_idx on public.rec_signals (user_id, created_at desc);

alter table public.rec_signals enable row level security;

create policy "rec_signals: leer lo propio" on public.rec_signals for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

-- Inserta un nodo si no existe (los datos del primero que llega se conservan).
create function public.kg_upsert_node(p_node jsonb) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.kg_nodes (slug, kind, label, subtitle, original_title, era)
  values (
    p_node ->> 'id',
    p_node ->> 'kind',
    p_node ->> 'label',
    nullif(p_node ->> 'subtitle', ''),
    nullif(p_node ->> 'originalTitle', ''),
    p_node -> 'era'
  )
  on conflict (slug) do nothing;
$$;

-- Inserta una arista si no existe y devuelve su id. shared_theme se normaliza a source < target.
create function public.kg_upsert_edge(p_edge jsonb) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source text := p_edge ->> 'source';
  v_target text := p_edge ->> 'target';
  v_type   text := p_edge ->> 'type';
  v_id     bigint;
begin
  if v_type = 'shared_theme' and v_target < v_source then
    select v_target, v_source into v_source, v_target;
  end if;

  insert into public.kg_edges (source, target, type, confidence, summary, explanation, quote)
  values (v_source, v_target, v_type, p_edge ->> 'confidence', p_edge ->> 'summary', p_edge ->> 'explanation', nullif(p_edge ->> 'quote', ''))
  on conflict (source, target, type) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.kg_edges where source = v_source and target = v_target and type = v_type;
  end if;
  return v_id;
end;
$$;

revoke all on function public.kg_upsert_node(jsonb) from public, anon, authenticated;
revoke all on function public.kg_upsert_edge(jsonb) from public, anon, authenticated;

-- Voto de una arista: 1, -1, o 0 para quitarlo. Crea nodos y arista si hace falta
-- y recalcula los contadores dentro de la misma transacción.
create function public.vote_edge(p_source jsonb, p_target jsonb, p_edge jsonb, p_value smallint)
returns table (edge_id bigint, up integer, down integer, my_vote smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_edge bigint;
begin
  if v_user is null then
    raise exception 'Hace falta iniciar sesión para votar' using errcode = '42501';
  end if;
  if p_value not in (-1, 0, 1) then
    raise exception 'Voto inválido' using errcode = '22023';
  end if;
  if (p_source ->> 'id') is distinct from (p_edge ->> 'source') or (p_target ->> 'id') is distinct from (p_edge ->> 'target') then
    raise exception 'Los nodos no coinciden con la arista' using errcode = '22023';
  end if;

  perform public.kg_upsert_node(p_source);
  perform public.kg_upsert_node(p_target);
  v_edge := public.kg_upsert_edge(p_edge);

  -- Serializa los votos de la misma arista para que el recuento sea exacto.
  perform 1 from public.kg_edges e where e.id = v_edge for update;

  if p_value = 0 then
    delete from public.edge_votes v where v.user_id = v_user and v.edge_id = v_edge;
  else
    insert into public.edge_votes (user_id, edge_id, value)
    values (v_user, v_edge, p_value)
    on conflict on constraint edge_votes_pkey do update set value = excluded.value, updated_at = now();
  end if;

  update public.kg_edges e
  set up = (select count(*) from public.edge_votes v where v.edge_id = v_edge and v.value = 1),
      down = (select count(*) from public.edge_votes v where v.edge_id = v_edge and v.value = -1),
      updated_at = now()
  where e.id = v_edge;

  return query
    select e.id, e.up, e.down, (select v.value from public.edge_votes v where v.edge_id = v_edge and v.user_id = v_user)
    from public.kg_edges e where e.id = v_edge;
end;
$$;

-- Señal sobre una recomendación. Si es positiva (up, saved), el recorrido entra
-- al grafo canónico aunque nadie haya votado sus aristas todavía.
create function public.record_rec_signal(p_clues_key text, p_lane text, p_book_slug text, p_signal public.rec_signal, p_nodes jsonb, p_edges jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb;
begin
  if v_user is null then
    raise exception 'Hace falta iniciar sesión' using errcode = '42501';
  end if;
  if jsonb_typeof(p_nodes) <> 'array' or jsonb_typeof(p_edges) <> 'array' or jsonb_array_length(p_nodes) > 8 or jsonb_array_length(p_edges) > 4 then
    raise exception 'Recorrido inválido' using errcode = '22023';
  end if;

  insert into public.rec_signals (user_id, clues_key, book_slug, lane, signal)
  values (v_user, p_clues_key, p_book_slug, p_lane, p_signal);

  if p_signal in ('up', 'saved') then
    for v_item in select * from jsonb_array_elements(p_nodes) loop
      perform public.kg_upsert_node(v_item);
    end loop;
    for v_item in select * from jsonb_array_elements(p_edges) loop
      perform public.kg_upsert_edge(v_item);
    end loop;
  end if;
end;
$$;

revoke all on function public.vote_edge(jsonb, jsonb, jsonb, smallint) from public, anon;
revoke all on function public.record_rec_signal(text, text, text, public.rec_signal, jsonb, jsonb) from public, anon;
grant execute on function public.vote_edge(jsonb, jsonb, jsonb, smallint) to authenticated;
grant execute on function public.record_rec_signal(text, text, text, public.rec_signal, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Cache de carriles (solo el servidor, con la clave secreta)
-- ---------------------------------------------------------------------------

create table public.graph_cache (
  -- versión del prompt + carril + pistas normalizadas
  key        text primary key check (char_length(key) <= 4000),
  lane       text not null check (lane in ('affinity', 'alternative', 'beyond')),
  -- alternativas ya generadas para ese carril: [ConnectionGraph]
  graphs     jsonb not null check (jsonb_typeof(graphs) = 'array'),
  updated_at timestamptz not null default now()
);

create index graph_cache_updated_idx on public.graph_cache (updated_at);

-- RLS sin políticas: con la clave pública no se lee ni se escribe.
alter table public.graph_cache enable row level security;
