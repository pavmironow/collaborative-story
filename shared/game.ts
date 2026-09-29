/**
 * Pure game rules. No Supabase, Vue or Nuxt imports: the UI and server routes call these
 * functions instead of reimplementing the rules. Every 🧪 rule in README "What must never break"
 * is covered by tests/game.test.ts.
 */
import { z } from 'zod'

export type Mode = 'fixed' | 'random' | 'chaos'
export type Status = 'lobby' | 'writing' | 'merging' | 'reveal' | 'finished'

export const LIMITS = {
  rounds: { min: 2, max: 5, default: 2 },
  charLimit: { min: 50, max: 1000, default: 300 },
  timeLimitS: { min: 15, max: 300, default: 90 },
  players: { min: 2, max: 10 },
  theme: { min: 3, max: 300 },
  name: { min: 1, max: 24 }
} as const

export const settingsSchema = z.object({
  theme: z.string().trim()
    .min(LIMITS.theme.min, `Describe the theme in at least ${LIMITS.theme.min} characters`)
    .max(LIMITS.theme.max, `Keep the theme under ${LIMITS.theme.max} characters`),
  mode: z.enum(['fixed', 'random', 'chaos'], 'Choose a mode'),
  roundsTotal: z.number().int()
    .min(LIMITS.rounds.min, `At least ${LIMITS.rounds.min} rounds`)
    .max(LIMITS.rounds.max, `At most ${LIMITS.rounds.max} rounds`),
  charLimit: z.number().int()
    .min(LIMITS.charLimit.min, `At least ${LIMITS.charLimit.min} characters`)
    .max(LIMITS.charLimit.max, `At most ${LIMITS.charLimit.max} characters`),
  timeLimitS: z.number().int()
    .min(LIMITS.timeLimitS.min, `At least ${LIMITS.timeLimitS.min} seconds`)
    .max(LIMITS.timeLimitS.max, `At most ${LIMITS.timeLimitS.max / 60} minutes`)
})

export type Settings = z.infer<typeof settingsSchema>

export const playerNameSchema = z.string().trim()
  .min(LIMITS.name.min, 'Enter your name')
  .max(LIMITS.name.max, `Keep your name under ${LIMITS.name.max} characters`)

export interface GameState {
  status: Status
  /** 1-based; 0 in the lobby. */
  round: number
  /** Index into the round's turn order (ordered modes only; always 0 in Chaos Mode). */
  turnIndex: number
  /** Deadline of the current turn or round, in epoch ms. Null outside writing. */
  phaseEndsAt: number | null
}

export const LOBBY: GameState = { status: 'lobby', round: 0, turnIndex: 0, phaseEndsAt: null }

/** Allowed status changes. The game only moves forward. */
const TRANSITIONS: Record<Status, Status[]> = {
  lobby: ['writing'],
  writing: ['writing', 'merging', 'finished'],
  merging: ['reveal'],
  reveal: ['writing', 'finished'],
  finished: []
}

export function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from].includes(to)
}

/** Players and settings are locked once the game has started. */
export function isLocked(status: Status): boolean {
  return status !== 'lobby'
}

export function canStart(state: GameState, playerCount: number): boolean {
  return state.status === 'lobby' && playerCount >= LIMITS.players.min && playerCount <= LIMITS.players.max
}

/**
 * Deterministic turn order for one round. Fixed order uses seat order; random order is a
 * permutation seeded by (seed, round), so the server and every client get the same order
 * and nobody can be picked twice within a round.
 */
export function turnOrder(playerIds: readonly string[], mode: Mode, round: number, seed: string): string[] {
  if (mode !== 'random') return [...playerIds]
  const rand = mulberry32(hash(`${seed}:${round}`))
  const order = [...playerIds]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  return order
}

export function currentWriter(state: GameState, order: readonly string[], mode: Mode): string | null {
  if (mode === 'chaos' || state.status !== 'writing') return null
  return order[state.turnIndex] ?? null
}

/**
 * A turn (ordered modes) or round (Chaos Mode) may close only when every expected writer
 * has submitted or the deadline has passed.
 */
export function canClose(state: GameState, expected: readonly string[], submitted: readonly string[], now: number): boolean {
  if (state.status !== 'writing' || state.phaseEndsAt === null) return false
  if (now >= state.phaseEndsAt) return true
  const done = new Set(submitted)
  return expected.length > 0 && expected.every(id => done.has(id))
}

/** Writers who did not submit when a turn/round closed. They are marked skipped and stay in the game. */
export function skipped(expected: readonly string[], submitted: readonly string[]): string[] {
  const done = new Set(submitted)
  return expected.filter(id => !done.has(id))
}

/**
 * The next state after the current phase ends. Throws on illegal moves so a bug can
 * never send the game backwards or past the end.
 */
export function advance(state: GameState, settings: Pick<Settings, 'mode' | 'roundsTotal' | 'timeLimitS'>, playerCount: number, now: number): GameState {
  const deadline = now + settings.timeLimitS * 1000
  const lastRound = state.round >= settings.roundsTotal
  let next: GameState

  switch (state.status) {
    case 'lobby':
      next = { status: 'writing', round: 1, turnIndex: 0, phaseEndsAt: deadline }
      break
    case 'writing':
      if (settings.mode === 'chaos') {
        next = { ...state, status: 'merging', phaseEndsAt: null }
      } else if (state.turnIndex + 1 < playerCount) {
        next = { ...state, turnIndex: state.turnIndex + 1, phaseEndsAt: deadline }
      } else if (!lastRound) {
        next = { status: 'writing', round: state.round + 1, turnIndex: 0, phaseEndsAt: deadline }
      } else {
        next = { ...state, status: 'finished', phaseEndsAt: null }
      }
      break
    case 'merging':
      next = { ...state, status: 'reveal' }
      break
    case 'reveal':
      next = lastRound
        ? { ...state, status: 'finished' }
        : { status: 'writing', round: state.round + 1, turnIndex: 0, phaseEndsAt: deadline }
      break
    case 'finished':
      throw new Error('The game has already finished')
  }

  if (!canTransition(state.status, next.status)) {
    throw new Error(`Illegal transition ${state.status} → ${next.status}`)
  }
  return next
}

export type FragmentCheck
  = | { ok: true, text: string }
    | { ok: false, reason: 'empty' | 'too_long', length: number }

/** Over-limit text is rejected, never truncated. */
export function checkFragment(text: string, charLimit: number): FragmentCheck {
  const trimmed = text.trim()
  if (trimmed.length === 0) return { ok: false, reason: 'empty', length: 0 }
  if (trimmed.length > charLimit) return { ok: false, reason: 'too_long', length: trimmed.length }
  return { ok: true, text: trimmed }
}

/** 90 → "1 min 30 s", 45 → "45 s", 120 → "2 min". */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s} s`
  return s ? `${m} min ${s} s` : `${m} min`
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
