-- Story genre (see shared/genres.ts). "Surprise me" is resolved before insert.
alter table public.rooms add column genre text not null default 'adventure'
  check (genre in ('fantasy', 'scifi', 'mystery', 'horror', 'romance', 'adventure', 'absurd', 'musical', 'cats', 'bedtime', 'soap', 'documentary'));
