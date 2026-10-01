-- Open story: no rounds and no timer. Anyone can join while it is open, every part is visible
-- at once, nobody posts twice in a row, and the host groups the parts into chapters.
-- `round` is the chapter a part belongs to; `seq` orders the parts within the room.

alter table public.rooms drop constraint rooms_mode_check;
alter table public.rooms add constraint rooms_mode_check check (mode in ('fixed', 'random', 'chaos', 'open'));

-- The AI's suggestion of where to end the current chapter (shown to the host only).
alter table public.rooms
  add column break_hint_seq int,
  add column break_hint_reason text,
  -- How many parts the current chapter had when the AI was last asked, so it is asked once.
  add column hint_checked_count int not null default 0,
  -- Who wrote the latest part, removed or not: "not twice in a row" is checked against it, and
  -- every client can read it (other writers' removed parts are not visible to them).
  add column last_part_by uuid;

-- Other modes keep seq = 0, so (room, round, player, seq) still allows one part per round.
alter table public.fragments add column seq int not null default 0;
-- Set when the host removes a part from an open story. The row and its text are kept.
alter table public.fragments add column hidden_at timestamptz;
alter table public.fragments drop constraint fragments_room_id_round_player_id_key;
alter table public.fragments add constraint fragments_room_round_player_seq_key unique (room_id, round, player_id, seq);
create index fragments_room_seq on public.fragments (room_id, seq);

-- Submissions. Chaos Mode is unchanged. In an open story the room row is locked, so parts are
-- numbered one after another and "not twice in a row" holds even for simultaneous posts.
create or replace function public.fragments_only_while_writing() returns trigger
language plpgsql set search_path = '' as $$
declare
  r public.rooms;
begin
  if new.status <> 'submitted' then
    return new;
  end if;
  if (select mode from public.rooms where id = new.room_id) = 'open' then
    select * into r from public.rooms where id = new.room_id and status = 'writing' for update;
    if not found then
      raise exception 'story % is closed', new.room_id using errcode = 'P0002';
    end if;
    if r.last_part_by = new.player_id then
      raise exception 'wait for another writer' using errcode = 'P0004';
    end if;
    new.round := r.current_round;
    new.seq := coalesce((select max(seq) from public.fragments where room_id = new.room_id), 0) + 1;
    update public.rooms set last_part_by = new.player_id where id = new.room_id;
    return new;
  end if;
  perform 1 from public.rooms
    where id = new.room_id and status = 'writing' and current_round = new.round
    for share;
  if not found then
    raise exception 'round % is closed', new.round using errcode = 'P0002';
  end if;
  return new;
end
$$;

-- Joining: in the lobby for every mode, and for as long as an open story is being written.
-- Open stories allow more writers, since people come and go.
create or replace function public.players_only_in_lobby() returns trigger
language plpgsql set search_path = '' as $$
declare
  r public.rooms;
begin
  select * into r from public.rooms where id = new.room_id for update;
  if not found or not (r.status = 'lobby' or (r.mode = 'open' and r.status = 'writing')) then
    raise exception 'room % is not accepting players', new.room_id using errcode = 'P0001';
  end if;
  if (select count(*) from public.players where room_id = new.room_id) >= (case when r.mode = 'open' then 30 else 10 end) then
    raise exception 'room % is full', new.room_id using errcode = 'P0003';
  end if;
  select coalesce(max(seat), -1) + 1 into new.seat from public.players where room_id = new.room_id;
  return new;
end
$$;

-- A part the host removed is hidden from everyone but its author.
create or replace function public.fragment_visible(f public.fragments) returns boolean
language sql stable security definer set search_path = '' as $$
  select f.hidden_at is null and exists (
    select 1 from public.rooms r
    where r.id = f.room_id
      and (
        r.mode <> 'chaos'
        or f.round < r.current_round
        or (f.round = r.current_round and r.status in ('merging', 'reveal', 'finished'))
      )
  )
$$;

-- Ends the current chapter after part p_after_seq. Parts written after it (while the host was
-- deciding) move on to the next chapter; their text never changes. Returns the new chapter
-- number, or null if the story is not open, the part is not in the current chapter, or the
-- chapter limit (rounds_total) is reached.
create function public.close_open_chapter(p_room uuid, p_after_seq int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room and mode = 'open' and status = 'writing' for update;
  if not found or r.current_round >= r.rounds_total then
    return null;
  end if;
  perform 1 from public.fragments
    where room_id = p_room and round = r.current_round and seq = p_after_seq and status = 'submitted';
  if not found then
    return null;
  end if;
  insert into public.chapters (room_id, round, source_fragment_ids, version)
    select p_room, r.current_round, array_agg(id order by seq), 0
    from public.fragments where room_id = p_room and round = r.current_round and seq <= p_after_seq;
  update public.fragments set round = r.current_round + 1
    where room_id = p_room and round = r.current_round and seq > p_after_seq;
  update public.rooms
    set current_round = r.current_round + 1, break_hint_seq = null, break_hint_reason = null,
        hint_checked_count = 0, updated_at = now()
    where id = p_room;
  return r.current_round + 1;
end
$$;

-- Ends an open story: the parts of the unfinished chapter become its last chapter.
create function public.finish_open_story(p_room uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms;
  ids uuid[];
begin
  select * into r from public.rooms where id = p_room and mode = 'open' and status = 'writing' for update;
  if not found then
    return false;
  end if;
  select array_agg(id order by seq) into ids from public.fragments where room_id = p_room and round = r.current_round;
  if ids is not null then
    insert into public.chapters (room_id, round, source_fragment_ids, version) values (p_room, r.current_round, ids, 0);
  end if;
  update public.rooms
    set status = 'finished', finished_at = now(), updated_at = now(), break_hint_seq = null, break_hint_reason = null,
        -- An empty last chapter is not a chapter: the story ends with the previous one.
        current_round = case when ids is null then greatest(1, r.current_round - 1) else r.current_round end
    where id = p_room;
  return true;
end
$$;

-- Server routes only (service role): they check that the caller is the host.
revoke execute on function public.close_open_chapter(uuid, int) from public, anon, authenticated;
revoke execute on function public.finish_open_story(uuid) from public, anon, authenticated;
