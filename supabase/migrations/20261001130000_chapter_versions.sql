-- Chapter revisions. Every text a chapter has ever had is kept in chapter_versions (rows are
-- never changed or deleted); chapters keeps the current one, so every reader stays unchanged.
-- version 0 = no text yet (the AI merge failed and the reveal shows the original parts).
alter table public.chapters add column version int not null default 0;

create table public.chapter_versions (
  room_id        uuid not null,
  round          int  not null,
  version        int  not null check (version >= 1),
  kind           text not null check (kind in ('merge', 'ai_edit', 'manual', 'restore')),
  text           text not null,
  paragraphs     jsonb,
  -- The host's request for an AI rewrite.
  instruction    text,
  -- For a restore: the version that was copied.
  restored_from  int,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  primary key (room_id, round, version),
  foreign key (room_id, round) references public.chapters (room_id, round) on delete cascade
);

alter table public.chapter_versions enable row level security;
-- Not secret, like chapters: anyone in the room can open a chapter's history.
create policy "read chapter versions" on public.chapter_versions for select to authenticated using (true);

-- Chapters merged before this migration become version 1.
insert into public.chapter_versions (room_id, round, version, kind, text, paragraphs, created_at)
  select room_id, round, 1, 'merge', text, paragraphs, created_at from public.chapters where text is not null;
update public.chapters set version = 1 where text is not null;

-- The AI merge inserts its chapter with version = 1; record it as the first version in the same statement.
create function public.chapters_first_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.version = 1 then
    insert into public.chapter_versions (room_id, round, version, kind, text, paragraphs, created_at)
      values (new.room_id, new.round, 1, 'merge', new.text, new.paragraphs, new.created_at);
  end if;
  return new;
end
$$;

create trigger chapters_first_version after insert on public.chapters
  for each row execute function public.chapters_first_version();

-- Saves a new current version, only if the chapter is still at p_base (two edits can never
-- overwrite each other). Returns the new version number, or null if the chapter had moved on.
create function public.revise_chapter(
  p_room uuid, p_round int, p_base int, p_kind text, p_text text, p_paragraphs jsonb,
  p_instruction text, p_restored_from int, p_by uuid
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v int;
begin
  update public.chapters set version = version + 1, text = p_text, paragraphs = p_paragraphs
    where room_id = p_room and round = p_round and version = p_base
    returning version into v;
  if v is null then
    return null;
  end if;
  insert into public.chapter_versions (room_id, round, version, kind, text, paragraphs, instruction, restored_from, created_by)
    values (p_room, p_round, v, p_kind, p_text, p_paragraphs, p_instruction, p_restored_from, p_by);
  return v;
end
$$;

-- Server routes only (service role): they check that the caller is the host.
revoke execute on function public.revise_chapter(uuid, int, int, text, text, jsonb, text, int, uuid) from public, anon, authenticated;
