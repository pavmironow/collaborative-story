import { describe, expect, it } from 'vitest'
import {
  LIMITS, LOBBY, advance, formatDuration, canClose, canStart, canTransition, checkFragment, currentWriter,
  isLocked, roundsToStore, settingsSchema, skipped, turnOrder, type GameState, type Mode, type Settings, type Status
} from '../shared/game'

const PLAYERS = ['ana', 'ben', 'cid', 'dan']
const T0 = 1_000_000

function settings(mode: Mode, roundsTotal = 2): Settings {
  return { theme: 'A tram stops at a station that is not on any map', mode, genre: 'adventure', roundsTotal, charLimit: 300, timeLimitS: 60, endless: false, isPublic: false }
}

/** Plays a whole game and records who wrote in each round and every status visited. */
function play(mode: Mode, roundsTotal: number, players = PLAYERS, seed = 'room-1') {
  const s = settings(mode, roundsTotal)
  let state = advance(LOBBY, s, players.length, T0)
  const writes: Record<number, string[]> = {}
  const statuses: Status[] = ['lobby', state.status]
  let steps = 0
  while (state.status !== 'finished') {
    if (++steps > 1000) throw new Error('game did not finish')
    if (state.status === 'writing') {
      const order = turnOrder(players, mode, state.round, seed)
      writes[state.round] ??= []
      if (mode === 'chaos') writes[state.round]!.push(...order)
      else writes[state.round]!.push(currentWriter(state, order, mode)!)
    }
    state = advance(state, s, players.length, T0 + steps)
    statuses.push(state.status)
  }
  return { writes, statuses, final: state }
}

describe('🧪 each player gets exactly one turn per round', () => {
  for (const mode of ['fixed', 'random', 'chaos'] as Mode[]) {
    it(`${mode}: every round has each player exactly once`, () => {
      const { writes } = play(mode, 3)
      expect(Object.keys(writes)).toEqual(['1', '2', '3'])
      for (const round of Object.values(writes)) {
        expect([...round].sort()).toEqual([...PLAYERS].sort())
      }
    })
  }

  it('fixed: order is the seat order in every round', () => {
    expect(play('fixed', 2).writes).toEqual({ 1: PLAYERS, 2: PLAYERS })
  })
})

describe('🧪 random order: nobody picked twice before everyone has written', () => {
  it('each round is a permutation of the players, for many seeds and group sizes', () => {
    for (let n = 2; n <= LIMITS.players.max; n++) {
      const players = Array.from({ length: n }, (_, i) => `p${i}`)
      for (let seed = 0; seed < 50; seed++) {
        for (let round = 1; round <= LIMITS.rounds.max; round++) {
          const order = turnOrder(players, 'random', round, `seed-${seed}`)
          expect(order).toHaveLength(n)
          expect(new Set(order).size).toBe(n)
          expect([...order].sort()).toEqual([...players].sort())
        }
      }
    }
  })

  it('is deterministic, so server and clients agree on the order', () => {
    expect(turnOrder(PLAYERS, 'random', 1, 'room-x')).toEqual(turnOrder(PLAYERS, 'random', 1, 'room-x'))
  })

  it('is actually shuffled (not always seat order)', () => {
    const orders = new Set(Array.from({ length: 20 }, (_, i) => turnOrder(PLAYERS, 'random', 1, `s${i}`).join()))
    expect(orders.size).toBeGreaterThan(1)
  })

  it('does not mutate the input list', () => {
    const players = [...PLAYERS]
    turnOrder(players, 'random', 1, 'room-1')
    expect(players).toEqual(PLAYERS)
  })
})

describe('🧪 players and rules are locked once the game starts', () => {
  it('only the lobby is unlocked', () => {
    expect(isLocked('lobby')).toBe(false)
    for (const s of ['writing', 'merging', 'reveal', 'finished'] as Status[]) expect(isLocked(s)).toBe(true)
  })

  it('the game cannot start with fewer than 2 or more than 10 players, or twice', () => {
    expect(canStart(LOBBY, 1)).toBe(false)
    expect(canStart(LOBBY, 2)).toBe(true)
    expect(canStart(LOBBY, 10)).toBe(true)
    expect(canStart(LOBBY, 11)).toBe(false)
    expect(canStart(advance(LOBBY, settings('chaos'), 3, T0), 3)).toBe(false)
  })
})

describe('🧪 a missed turn is skipped and the player stays in later rounds', () => {
  it('reports exactly the writers who did not submit', () => {
    expect(skipped(PLAYERS, ['ben', 'dan'])).toEqual(['ana', 'cid'])
    expect(skipped(PLAYERS, PLAYERS)).toEqual([])
  })

  it('a skipped player is still in the next round\'s order', () => {
    const missed = skipped(PLAYERS, ['ana', 'ben', 'dan'])
    expect(missed).toEqual(['cid'])
    for (const mode of ['fixed', 'random', 'chaos'] as Mode[]) {
      expect(turnOrder(PLAYERS, mode, 2, 'room-1')).toContain('cid')
    }
  })
})

describe('🧪 the game only moves forward', () => {
  it('fixed: lobby → writing… → finished', () => {
    const { statuses } = play('fixed', 2)
    expect(statuses[0]).toBe('lobby')
    expect(statuses.at(-1)).toBe('finished')
    expect(new Set(statuses)).toEqual(new Set(['lobby', 'writing', 'finished']))
  })

  it('chaos: each round goes writing → merging → reveal', () => {
    expect(play('chaos', 2).statuses).toEqual([
      'lobby', 'writing', 'merging', 'reveal', 'writing', 'merging', 'reveal', 'finished'
    ])
  })

  it('never goes backwards or skips a step', () => {
    for (const mode of ['fixed', 'random', 'chaos'] as Mode[]) {
      const { statuses } = play(mode, 3)
      for (let i = 1; i < statuses.length; i++) expect(canTransition(statuses[i - 1]!, statuses[i]!)).toBe(true)
    }
    expect(canTransition('reveal', 'merging')).toBe(false)
    expect(canTransition('writing', 'lobby')).toBe(false)
    expect(canTransition('lobby', 'finished')).toBe(false)
    expect(canTransition('merging', 'writing')).toBe(false)
  })

  it('advancing a finished game throws', () => {
    const { final } = play('chaos', 2)
    expect(() => advance(final, settings('chaos'), 4, T0)).toThrow()
  })

  it('round number never decreases', () => {
    const s = settings('fixed', 3)
    let state = advance(LOBBY, s, 3, T0)
    let prev = state.round
    while (state.status !== 'finished') {
      state = advance(state, s, 3, T0)
      expect(state.round).toBeGreaterThanOrEqual(prev)
      prev = state.round
    }
  })
})

describe('🧪 a round closes only when everyone submitted or the deadline passed', () => {
  const writing: GameState = { status: 'writing', round: 1, turnIndex: 0, phaseEndsAt: T0 + 60_000 }

  it('stays open while someone is missing and time remains', () => {
    expect(canClose(writing, PLAYERS, ['ana', 'ben', 'cid'], T0)).toBe(false)
    expect(canClose(writing, PLAYERS, [], T0 + 59_999)).toBe(false)
  })

  it('closes early once everyone has submitted', () => {
    expect(canClose(writing, PLAYERS, [...PLAYERS].reverse(), T0)).toBe(true)
  })

  it('closes at the deadline even if nobody submitted', () => {
    expect(canClose(writing, PLAYERS, [], T0 + 60_000)).toBe(true)
  })

  it('ordered modes: closes when the single current writer submits', () => {
    expect(canClose(writing, ['ana'], ['ana'], T0)).toBe(true)
    expect(canClose(writing, ['ana'], ['ben'], T0)).toBe(false)
  })

  it('never closes outside the writing phase', () => {
    for (const status of ['lobby', 'merging', 'reveal', 'finished'] as Status[]) {
      expect(canClose({ ...writing, status }, PLAYERS, PLAYERS, T0 + 999_999)).toBe(false)
    }
  })

  it('advance sets a fresh deadline for every turn/round', () => {
    const s = settings('fixed')
    const first = advance(LOBBY, s, 2, T0)
    expect(first.phaseEndsAt).toBe(T0 + 60_000)
    expect(advance(first, s, 2, T0 + 5_000).phaseEndsAt).toBe(T0 + 65_000)
  })
})

describe('🧪 the game always finishes after rounds_total', () => {
  for (const mode of ['fixed', 'random', 'chaos'] as Mode[]) {
    for (let rounds = LIMITS.rounds.min; rounds <= LIMITS.rounds.max; rounds++) {
      it(`${mode}, ${rounds} rounds, nobody ever submits`, () => {
        // play() never submits anything: every phase ends by timeout.
        const { writes, final } = play(mode, rounds)
        expect(final.status).toBe('finished')
        expect(Object.keys(writes)).toHaveLength(rounds)
      })
    }
  }
})

describe('🧪 endless stories: the host ends them, and the cap always does', () => {
  const endless: Settings = { ...settings('chaos', LIMITS.endlessRounds), endless: true }
  const reveal = (round: number): GameState => ({ status: 'reveal', round, turnIndex: 0, phaseEndsAt: null })

  it('stores the safety cap as rounds_total, whatever the client sent', () => {
    expect(roundsToStore({ endless: true, roundsTotal: 3 })).toBe(LIMITS.endlessRounds)
    expect(roundsToStore({ endless: false, roundsTotal: 3 })).toBe(3)
  })

  it('keeps going past the usual maximum until the host ends it', () => {
    const next = advance(reveal(LIMITS.rounds.max + 2), endless, 4, T0)
    expect(next).toMatchObject({ status: 'writing', round: LIMITS.rounds.max + 3 })
  })

  it('finishes from the reveal screen when the host ends it, keeping the rounds played', () => {
    expect(advance(reveal(7), endless, 4, T0, 'finish')).toEqual({ status: 'finished', round: 7, turnIndex: 0, phaseEndsAt: null })
  })

  it('finishes on its own at the safety cap', () => {
    const { final, writes } = play('chaos', LIMITS.endlessRounds)
    expect(final.status).toBe('finished')
    expect(Object.keys(writes)).toHaveLength(LIMITS.endlessRounds)
  })

  it('cannot be ended mid-round', () => {
    const writing: GameState = { status: 'writing', round: 3, turnIndex: 0, phaseEndsAt: T0 }
    expect(() => advance(writing, endless, 4, T0, 'finish')).toThrow(/between rounds/)
  })

  it('a normal story cannot be ended early', () => {
    expect(() => advance(reveal(1), settings('chaos', 3), 4, T0, 'finish')).toThrow(/endless/)
  })

  it('endless defaults to off', () => {
    const { endless: _, ...rest } = settings('chaos')
    expect(settingsSchema.parse(rest).endless).toBe(false)
  })
})

describe('🧪 over-limit text is rejected, never truncated', () => {
  it('accepts text up to the limit, trimmed', () => {
    expect(checkFragment('  hello  ', 5)).toEqual({ ok: true, text: 'hello' })
  })

  it('rejects text over the limit and reports its length', () => {
    expect(checkFragment('x'.repeat(301), 300)).toEqual({ ok: false, reason: 'too_long', length: 301 })
  })

  it('rejects empty or whitespace-only text', () => {
    expect(checkFragment('   \n ', 300)).toEqual({ ok: false, reason: 'empty', length: 0 })
  })
})

describe('settings validation', () => {
  const valid = settings('chaos')

  it('accepts valid settings', () => {
    expect(settingsSchema.safeParse(valid).success).toBe(true)
  })

  it.each([
    ['1 round (minimum is 2)', { roundsTotal: 1 }],
    ['6 rounds', { roundsTotal: 6 }],
    ['fractional rounds', { roundsTotal: 2.5 }],
    ['char limit too small', { charLimit: 10 }],
    ['char limit too large', { charLimit: 5000 }],
    ['timer too short', { timeLimitS: 5 }],
    ['timer too long', { timeLimitS: 3600 }],
    ['empty theme', { theme: '   ' }],
    ['unknown mode', { mode: 'battle' }]
  ])('rejects %s', (_, patch) => {
    expect(settingsSchema.safeParse({ ...valid, ...patch }).success).toBe(false)
  })
})

describe('formatDuration', () => {
  it.each([[30, '30 s'], [60, '1 min'], [90, '1 min 30 s'], [120, '2 min'], [185, '3 min 5 s']])('%i s → %s', (s, label) => {
    expect(formatDuration(s)).toBe(label)
  })
})
