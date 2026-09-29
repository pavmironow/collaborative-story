-- Seats are assigned by the database under a lock on the room row, so simultaneous joins are
-- serialized and can never collide (previously the server retried and could give up with a 500).
-- The 10-player limit (LIMITS.players.max) is enforced here too, under the same lock.
create or replace function public.players_only_in_lobby() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.rooms where id = new.room_id and status = 'lobby' for update;
  if not found then
    raise exception 'room % is not accepting players', new.room_id using errcode = 'P0001';
  end if;
  if (select count(*) from public.players where room_id = new.room_id) >= 10 then
    raise exception 'room % is full', new.room_id using errcode = 'P0003';
  end if;
  select coalesce(max(seat), -1) + 1 into new.seat from public.players where room_id = new.room_id;
  return new;
end
$$;
