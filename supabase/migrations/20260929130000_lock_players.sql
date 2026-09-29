-- Players are locked once the story starts, even if a join races with "start".
create function public.players_only_in_lobby() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.rooms where id = new.room_id and status = 'lobby' for share;
  if not found then
    raise exception 'room % is not accepting players', new.room_id using errcode = 'P0001';
  end if;
  return new;
end
$$;

create trigger players_only_in_lobby before insert on public.players
  for each row execute function public.players_only_in_lobby();
