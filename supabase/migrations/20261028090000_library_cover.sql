-- Portada verificada (Google Books / Open Library) para mostrar la biblioteca
-- sin volver a consultar el catálogo.
alter table public.library_items
  add column cover_url text check (cover_url is null or cover_url ~ '^https://');
