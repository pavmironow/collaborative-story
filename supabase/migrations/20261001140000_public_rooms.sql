-- Public rooms are listed on the homepage while they wait in the lobby, so anyone can join.
-- Private (the default) rooms are reachable only by their link or code, as before.
alter table public.rooms add column is_public boolean not null default false;

-- The homepage list: public lobbies, newest first.
create index rooms_open_lobbies on public.rooms (created_at desc) where is_public and status = 'lobby';
