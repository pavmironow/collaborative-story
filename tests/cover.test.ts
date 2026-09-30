import { describe, expect, it } from 'vitest'
import { buildCoverPrompt, COVER_EXCERPT_MAX } from '../shared/cover'
import { buildStory } from '../shared/story'
import { getGenre } from '../shared/genres'

describe('cover prompt', () => {
  it('uses the genre look, the theme and an excerpt, and forbids text in the image', () => {
    const p = buildCoverPrompt(' A tram stops ', getGenre('cats').look, 'The conductor was a cat.')
    expect(p).toContain(`Style: ${getGenre('cats').look}.`)
    expect(p).toContain('Premise: A tram stops')
    expect(p).toContain('Scene inspiration from the story: The conductor was a cat.')
    expect(p).toMatch(/No text, no letters/)
    expect(p).toMatch(/all ages/)
  })

  it('limits the excerpt length and collapses whitespace', () => {
    const p = buildCoverPrompt('t', 'look', `a\n\n  b ${'x'.repeat(2000)}`)
    const excerpt = p.split('Scene inspiration from the story: ')[1]!.split('\n')[0]!
    expect(excerpt.startsWith('a b ')).toBe(true)
    expect(excerpt.length).toBe(COVER_EXCERPT_MAX)
  })

  it('omits the excerpt line when the story is empty', () => {
    expect(buildCoverPrompt('t', 'look', '   ')).not.toContain('Scene inspiration')
  })

  it('story text used for the excerpt contains no author names (they are players, not characters)', () => {
    const room = { id: 'r', code: 'C', host_id: 'a', theme: 't', mode: 'chaos', genre: 'cats', rounds_total: 2, char_limit: 300, time_limit_s: 60, status: 'finished', current_round: 2, turn_index: 0, phase_ends_at: null, seed: 's', created_at: '', updated_at: '', merge_started_at: null } as never
    const story = buildStory(room, [{ room_id: 'r', user_id: 'a', name: 'Zelda', seat: 0, joined_at: '' }],
      [{ id: 'f', room_id: 'r', round: 1, player_id: 'a', status: 'submitted', text: 'A cat conductor.', created_at: '' }], [])
    const text = story.chapters.flatMap(c => c.paragraphs.map(p => p.text)).join(' ')
    expect(buildCoverPrompt(story.theme, 'look', text)).not.toContain('Zelda')
  })
})
