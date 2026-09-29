-- AI cover for finished stories. Generated once per room (claimed like the chapter merge) and
-- stored in a public bucket; the story never depends on it.
alter table public.rooms
  add column cover_url text,
  add column cover_started_at timestamptz,
  add column cover_error text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;
