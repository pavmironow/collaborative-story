import { describe, expect, it } from 'vitest'
import { LIMITS, settingsSchema } from '../shared/game'
import { OPEN_ROOM_MAX_AGE_MS, OPEN_ROOMS_LIMIT, toOpenRooms } from '../shared/open-rooms'

const NOW = Date.parse('2026-10-01T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const room = (id: string, patch: Partial<Parameters<typeof toOpenRooms>[0][number]> = {}) => ({
  id, code: id.toUpperCase(), theme: `Theme ${id}`, genre: 'fantasy', mode: 'chaos' as const, endless: false, rounds_total: 3,
  status: 'lobby' as const, is_public: true, created_at: ago(60_000), ...patch
})

describe('🧪 only public lobbies are listed', () => {
  it('never lists a private room, a started room or a finished one', () => {
    const rooms = [
      room('pub'),
      room('priv', { is_public: false }),
      room('writing', { status: 'writing' }),
      room('done', { status: 'finished' })
    ]
    expect(toOpenRooms(rooms, new Map(), NOW).map(r => r.code)).toEqual(['PUB'])
  })

  it('hides full rooms, since nobody else can join them', () => {
    const counts = new Map([['full', LIMITS.players.max], ['almost', LIMITS.players.max - 1]])
    expect(toOpenRooms([room('full'), room('almost')], counts, NOW).map(r => r.code)).toEqual(['ALMOST'])
  })

  it('hides lobbies older than the cut-off (most likely abandoned)', () => {
    const rooms = [room('fresh', { created_at: ago(OPEN_ROOM_MAX_AGE_MS - 1000) }), room('stale', { created_at: ago(OPEN_ROOM_MAX_AGE_MS + 1000) })]
    expect(toOpenRooms(rooms, new Map(), NOW).map(r => r.code)).toEqual(['FRESH'])
  })
})

describe('open rooms list', () => {
  it('is newest first, capped, and carries what the homepage shows', () => {
    const rooms = Array.from({ length: OPEN_ROOMS_LIMIT + 5 }, (_, i) => room(`r${i}`, { created_at: ago(i * 1000) }))
    const list = toOpenRooms([...rooms].reverse(), new Map([['r0', 3]]), NOW)
    expect(list).toHaveLength(OPEN_ROOMS_LIMIT)
    expect(list[0]).toEqual({
      code: 'R0', theme: 'Theme r0', genre: 'fantasy', mode: 'chaos', endless: false, roundsTotal: 3,
      players: 3, maxPlayers: LIMITS.players.max, createdAt: ago(0)
    })
  })

  it('never exposes internal ids', () => {
    expect(Object.keys(toOpenRooms([room('a')], new Map(), NOW)[0]!)).not.toContain('id')
  })
})

describe('room visibility setting', () => {
  const base = { theme: 'A tram stops nowhere', mode: 'chaos', genre: 'fantasy', roundsTotal: 3, charLimit: 300, timeLimitS: 60 }

  it('is private unless the host makes it public', () => {
    expect(settingsSchema.parse(base).isPublic).toBe(false)
    expect(settingsSchema.parse({ ...base, isPublic: true }).isPublic).toBe(true)
  })
})
