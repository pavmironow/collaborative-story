-- Game schema. Clients only READ (RLS + Realtime); every write goes through Nuxt server
-- routes that apply shared/game.ts rules with the service role key.

create table public.rooms (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  host_id        uuid not null references auth.users (id) on delete cascade,
  theme          text not null,
  mode           text not null check (mode in ('fixed', 'random', 'chaos')),
  rounds_total   int  not null check (rounds_total between 2 and 5),
  char_limit     int  not null check (char_limit between 50 and 1000),
  time_limit_s   int  not null check (time_limit_s between 15 and 300),
  status         text not null default 'lobby' check (status in ('lobby', 'writing', 'merging', 'reveal', 'finished')),
  current_round  int  not null default 0,
  turn_index     int  not null default 0,
  phase_ends_at  timestamptz,
  seed           text not null default gen_random_uuid()::text,
  created_at     timestamptz not null default now()
);

create table public.players (
  room_id    uuid not null references public.rooms (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 24),
  seat       int  not null,
  joined_at  timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

create table public.fragments (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms (id) on delete cascade,
  round       int  not null,
  player_id   uuid not null,
  status      text not null check (status in ('submitted', 'skipped')),
  text        text,
  created_at  timestamptz not null default now(),
  unique (room_id, round, player_id),
  foreign key (room_id, player_id) references public.players (room_id, user_id) on delete cascade,
  check ((status = 'submitted') = (text is not null))
);

create table public.chapters (
  room_id              uuid not null references public.rooms (id) on delete cascade,
  round                int  not null,
  text                 text,
  source_fragment_ids  uuid[] not null default '{}',
  error                text,
  created_at           timestamptz not null default now(),
  primary key (room_id, round)
);

alter table public.rooms     enable row level security;
alter table public.players   enable row level security;
alter table public.fragments enable row level security;
alter table public.chapters  enable row level security;

-- Rooms, players and chapters are not secret: anyone with a session can read them.
create policy "read rooms"    on public.rooms    for select to authenticated using (true);
create policy "read players"  on public.players  for select to authenticated using (true);
create policy "read chapters" on public.chapters for select to authenticated using (true);

-- A fragment is readable by its author at any time. Others can read it once it is
-- no longer a hidden draft: always in the ordered modes (the story is shown as it is
-- written), and in Chaos Mode only after its round has closed.
create function public.fragment_visible(f public.fragments) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.rooms r
    where r.id = f.room_id
      and (
        r.mode <> 'chaos'
        or f.round < r.current_round
        or (f.round = r.current_round and r.status in ('merging', 'reveal', 'finished'))
      )
  )
$$;

create policy "read own or closed fragments" on public.fragments for select to authenticated
  using (player_id = (select auth.uid()) or public.fragment_visible(fragments));

-- No insert/update/delete policies: with RLS on, those are denied to clients.

alter publication supabase_realtime add table public.rooms, public.players, public.fragments, public.chapters;
