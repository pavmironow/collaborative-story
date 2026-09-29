import { describe, expect, it } from 'vitest'
import type { ChapterRow, FragmentRow, PlayerRow, RoomRow } from '../shared/room'
import { buildStory } from '../shared/story'

const room = { id: 'r', code: 'ABCDE', host_id: 'a', theme: 'A tram', mode: 'chaos', rounds_total: 2, char_limit: 300, time_limit_s: 60, status: 'finished', current_round: 2, turn_index: 0, phase_ends_at: null, seed: 's', created_at: '', updated_at: '' } as RoomRow
const players: PlayerRow[] = [
  { room_id: 'r', user_id: 'c', name: 'Cid', seat: 2, joined_at: '' },
  { room_id: 'r', user_id: 'a', name: 'Ana', seat: 0, joined_at: '' },
  { room_id: 'r', user_id: 'b', name: 'Ben', seat: 1, joined_at: '' }
]
const frag = (id: string, round: number, player: string, text: string | null, status: FragmentRow['status'] = 'submitted'): FragmentRow =>
  ({ id, room_id: 'r', round, player_id: player, status, text, created_at: id })
const fragments = [
  frag('f1', 1, 'a', 'No face.'), frag('f2', 1, 'b', 'A suitcase.'), frag('f3', 1, 'c', 'No street.'),
  frag('f4', 2, 'b', 'Brakes.'), frag('f5', 2, 'a', null, 'skipped'), frag('f6', 2, 'c', 'A map.')
]
const aiChapter: ChapterRow = { room_id: 'r', round: 1, text: 'P1\n\nP2', source_fragment_ids: ['f1', 'f2', 'f3'], error: null, created_at: '',
  paragraphs: [{ text: 'P1', fragmentIds: ['f3', 'f1'] }, { text: 'P2', fragmentIds: ['f2'] }] }
const failedChapter: ChapterRow = { room_id: 'r', round: 2, text: null, paragraphs: null, source_fragment_ids: ['f4', 'f6'], error: 'no_api_key', created_at: '' }

describe('🧪 the finished story credits its authors (buildStory)', () => {
  const story = buildStory(room, players, fragments, [aiChapter, failedChapter])

  it('uses the AI chapter when there is one, crediting each paragraph in seat order', () => {
    expect(story.chapters[0]).toEqual({ round: 1, woven: true, paragraphs: [{ text: 'P1', by: ['Ana', 'Cid'] }, { text: 'P2', by: ['Ben'] }] })
  })

  it('falls back to the original parts, each credited, when the AI chapter failed', () => {
    expect(story.chapters[1]).toEqual({ round: 2, woven: false, paragraphs: [{ text: 'Brakes.', by: ['Ben'] }, { text: 'A map.', by: ['Cid'] }] })
  })

  it('lists every writer in seat order with contribution counts (skips count 0)', () => {
    expect(story.authors).toEqual([{ name: 'Ana', contributions: 1 }, { name: 'Ben', contributions: 2 }, { name: 'Cid', contributions: 2 }])
  })

  it('never includes skipped turns as text', () => {
    expect(JSON.stringify(story)).not.toContain('null')
  })

  it('omits a round in which nobody wrote', () => {
    const s = buildStory(room, players, fragments.filter(f => f.round === 1), [aiChapter])
    expect(s.chapters.map(c => c.round)).toEqual([1])
  })

  it('ordered mode: the story is the players\' own text in writing order', () => {
    const s = buildStory({ ...room, mode: 'fixed' }, players, fragments, [])
    expect(s.chapters.map(c => c.paragraphs.map(p => p.text))).toEqual([['No face.', 'A suitcase.', 'No street.'], ['Brakes.', 'A map.']])
  })

  it('an unfinished story only includes rounds up to the current one', () => {
    const s = buildStory({ ...room, status: 'writing', current_round: 1 }, players, fragments, [aiChapter])
    expect(s.finished).toBe(false)
    expect(s.chapters.map(c => c.round)).toEqual([1])
  })
})
