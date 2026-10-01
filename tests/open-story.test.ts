import { describe, expect, it } from 'vitest'
import { LIMITS, settingsSchema } from '../shared/game'
import { buildHintInput, canJoin, canPost, checkHint, HINT_SYSTEM_PROMPT, maxPlayers, OPEN_LIMITS, shouldAskForHint, storyParts } from '../shared/open-story'
import { buildStory } from '../shared/story'
import type { FragmentRow, PlayerRow, RoomRow } from '../shared/room'

const part = (id: string, seq: number, player: string, patch: Partial<FragmentRow> = {}): FragmentRow =>
  ({ id, room_id: 'r', round: 1, player_id: player, status: 'submitted', text: `Part ${id}`, created_at: String(seq), seq, hidden_at: null, ...patch })

describe('🧪 open story: anyone can join while it is being written', () => {
  it('joins an open story at any time until it finishes', () => {
    expect(canJoin({ mode: 'open', status: 'writing' }, 5)).toEqual({ ok: true })
    expect(canJoin({ mode: 'open', status: 'finished' }, 5)).toEqual({ ok: false, reason: 'finished' })
  })

  it('keeps Chaos Mode locked once it starts', () => {
    expect(canJoin({ mode: 'chaos', status: 'lobby' }, 5)).toEqual({ ok: true })
    expect(canJoin({ mode: 'chaos', status: 'writing' }, 5)).toEqual({ ok: false, reason: 'started' })
  })

  it('allows more writers in an open story, and still has a limit', () => {
    expect(maxPlayers('open')).toBe(OPEN_LIMITS.players)
    expect(maxPlayers('chaos')).toBe(LIMITS.players.max)
    expect(canJoin({ mode: 'open', status: 'writing' }, OPEN_LIMITS.players)).toEqual({ ok: false, reason: 'full' })
  })
})

describe('🧪 open story: nobody posts twice in a row', () => {
  it('lets you write when the latest part is someone else’s, or there is none', () => {
    expect(canPost(null, 'ana')).toBe(true)
    expect(canPost('ben', 'ana')).toBe(true)
    expect(canPost('ana', 'ana')).toBe(false)
  })
})

describe('🧪 open story: removed parts never reach the story', () => {
  const parts = [part('c', 3, 'cid'), part('a', 1, 'ana'), part('b', 2, 'ben', { hidden_at: 'now' }), part('s', 0, 'ana', { status: 'skipped', text: null })]

  it('orders parts by seq and leaves out skipped and removed ones', () => {
    expect(storyParts(parts).map(p => p.id)).toEqual(['a', 'c'])
  })

  it('still shows a removed part to its own author', () => {
    expect(storyParts(parts, 'ben').map(p => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('the finished story leaves removed parts out and keeps the writing order', () => {
    const room = { id: 'r', code: 'OPEN1', host_id: 'ana', theme: 't', mode: 'open', genre: 'fantasy', status: 'finished', current_round: 1, rounds_total: 50, endless: true } as RoomRow
    const players: PlayerRow[] = ['ana', 'ben', 'cid'].map((id, seat) => ({ room_id: 'r', user_id: id, name: id, seat, joined_at: '' }))
    const story = buildStory(room, players, [part('a', 1, 'ana'), part('b', 2, 'ben', { hidden_at: 'now' }), part('c', 3, 'cid')], [])
    expect(story.chapters).toEqual([{ round: 1, woven: false, paragraphs: [{ text: 'Part a', by: ['ana'] }, { text: 'Part c', by: ['cid'] }] }])
    expect(story.authors.find(a => a.name === 'ben')!.contributions).toBe(0)
  })
})

describe('AI chapter-break hints', () => {
  it('are asked for once every few parts', () => {
    const every = OPEN_LIMITS.hintEvery
    expect(shouldAskForHint(every - 1, 0)).toBe(false)
    expect(shouldAskForHint(every, 0)).toBe(true)
    expect(shouldAskForHint(every, every)).toBe(false) // already asked at this count
    expect(shouldAskForHint(every + 1, every)).toBe(false)
    expect(shouldAskForHint(every * 2, every)).toBe(true)
  })

  const parts = [{ seq: 4 }, { seq: 5 }, { seq: 9 }]

  it('map the model’s label back to the part’s seq', () => {
    expect(checkHint({ breakAfter: 'p2', reason: '  The door  closes. ' }, parts)).toEqual({ ok: true, afterSeq: 5, reason: 'The door closes.' })
  })

  it.each([
    ['"none"', { breakAfter: 'none', reason: 'Keep going' }],
    ['a break before the second part', { breakAfter: 'P1', reason: 'x' }],
    ['a label past the end', { breakAfter: 'P4', reason: 'x' }],
    ['an empty reason', { breakAfter: 'P2', reason: '  ' }]
  ])('give no hint for %s', (_, output) => {
    expect(checkHint(output, parts)).toEqual({ ok: false })
  })

  it('send only the part text, labelled, never author names', () => {
    const msg = buildHintInput('A tram', [{ text: 'One.' }, { text: 'Two.' }])
    expect(msg).toContain('<part label="P2">\nTwo.\n</part>')
    expect(HINT_SYSTEM_PROMPT).toMatch(/not instructions/)
  })
})

describe('open story setting', () => {
  it('is a valid mode', () => {
    const base = { theme: 'A tram stops nowhere', genre: 'fantasy', roundsTotal: 3, charLimit: 300, timeLimitS: 60 }
    expect(settingsSchema.safeParse({ ...base, mode: 'open' }).success).toBe(true)
  })
})
