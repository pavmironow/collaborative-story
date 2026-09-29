-- Touched on every submission so clients get a realtime event and re-read progress.
alter table public.rooms add column updated_at timestamptz not null default now();

-- Who has submitted in the current round: ids only, never text, so progress can be
-- shown without revealing hidden Chaos Mode drafts.
create function public.round_submitters(p_room uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select f.player_id
  from public.fragments f
  join public.rooms r on r.id = f.room_id
  where f.room_id = p_room and f.round = r.current_round and f.status = 'submitted'
$$;

revoke execute on function public.round_submitters(uuid) from public, anon;
grant execute on function public.round_submitters(uuid) to authenticated;

-- A submission is only accepted while its round is still being written. The row lock
-- orders it against a concurrent close: it either lands before the close (and is merged)
-- or is rejected, never saved-but-left-out.
create function public.fragments_only_while_writing() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'submitted' then
    perform 1 from public.rooms
      where id = new.room_id and status = 'writing' and current_round = new.round
      for share;
    if not found then
      raise exception 'round % is closed', new.round using errcode = 'P0002';
    end if;
  end if;
  return new;
end
$$;

create trigger fragments_only_while_writing before insert on public.fragments
  for each row execute function public.fragments_only_while_writing();
