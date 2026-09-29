import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { settingsSchema } from '../shared/game'
import { DEFAULT_GENRE, GENRE_IDS, GENRES, getGenre, resolveGenre, SURPRISE } from '../shared/genres'
import { buildMergeUserMessage, MERGE_SYSTEM_PROMPT } from '../shared/merge'

describe('genres', () => {
  it('has classic genres and fun moods, all with a tone and a look', () => {
    expect(GENRES.filter(g => g.kind === 'classic').length).toBeGreaterThanOrEqual(5)
    expect(GENRES.filter(g => g.kind === 'fun').length).toBeGreaterThanOrEqual(5)
    for (const g of GENRES) {
      expect(g.tone.length).toBeGreaterThan(20)
      expect(g.look.length).toBeGreaterThan(10)
    }
    expect(new Set(GENRE_IDS).size).toBe(GENRE_IDS.length)
  })

  it('"Surprise me" always resolves to a real genre, and can reach every genre', () => {
    const seen = new Set<string>()
    for (let i = 0; i < GENRES.length; i++) seen.add(resolveGenre(SURPRISE, () => (i + 0.5) / GENRES.length))
    expect([...seen].sort()).toEqual([...GENRE_IDS].sort())
    expect(GENRE_IDS).toContain(resolveGenre(SURPRISE, () => 0.999999))
    expect(GENRE_IDS).toContain(resolveGenre(SURPRISE, () => 0))
  })

  it('a concrete choice is kept; an unknown id falls back to the default', () => {
    expect(resolveGenre('cats')).toBe('cats')
    expect(getGenre('nope').id).toBe(DEFAULT_GENRE)
  })

  it('settings accept every genre and "surprise", and reject unknown ones', () => {
    const base = { theme: 'A tram', mode: 'chaos', roundsTotal: 2, charLimit: 300, timeLimitS: 60 }
    for (const genre of [...GENRE_IDS, SURPRISE]) expect(settingsSchema.safeParse({ ...base, genre }).success).toBe(true)
    expect(settingsSchema.safeParse({ ...base, genre: 'western' }).success).toBe(false)
    expect(settingsSchema.safeParse(base).success).toBe(false)
  })

  it('the database CHECK constraint lists exactly the same genres (no drift)', () => {
    const sql = readFileSync(new URL('../supabase/migrations/20260929180000_room_genre.sql', import.meta.url), 'utf8')
    const inDb = [...sql.matchAll(/'([a-z]+)'/g)].map(m => m[1]).filter(id => id !== DEFAULT_GENRE || sql.includes(`default '${DEFAULT_GENRE}'`))
    expect([...new Set(inDb)].sort()).toEqual([...GENRE_IDS].sort())
  })

  it('the merge prompt carries the genre tone, below the preservation rules', () => {
    const msg = buildMergeUserMessage({ theme: 't', genreTone: getGenre('musical').tone, storySoFar: [], fragments: [{ id: 'a', text: 'x' }] })
    expect(msg.startsWith(`<genre>${getGenre('musical').tone}</genre>`)).toBe(true)
    expect(MERGE_SYSTEM_PROMPT).toMatch(/style of the genre .* never at the cost of the rules above/)
  })
})
