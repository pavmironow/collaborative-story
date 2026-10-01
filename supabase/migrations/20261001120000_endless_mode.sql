-- Endless mode: the host ends the story from the reveal screen. rounds_total stays the
-- maximum (the safety cap for endless games); current_round at `finished` is how many were played.
alter table public.rooms
  add column endless boolean not null default false,
  add column started_at timestamptz,
  add column finished_at timestamptz;

alter table public.rooms drop constraint rooms_rounds_total_check;
alter table public.rooms add constraint rooms_rounds_total_check
  check (rounds_total between 2 and 50 and (endless or rounds_total <= 5));
