/** Room row shape shared by server routes and pages, plus converters to the pure game types. */
import type { GameState, Mode, Settings, Status } from './game'

export interface RoomRow {
  id: string
  code: string
  host_id: string
  theme: string
  mode: Mode
  genre: string
  /** Maximum rounds; for an endless game this is the safety cap (see LIMITS.endlessRounds). */
  rounds_total: number
  endless: boolean
  /** Listed on the homepage while in the lobby. */
  is_public: boolean
  char_limit: number
  time_limit_s: number
  status: Status
  current_round: number
  turn_index: number
  phase_ends_at: string | null
  seed: string
  created_at: string
  updated_at: string
  started_at: string | null
  finished_at: string | null
  merge_started_at: string | null
  cover_url: string | null
  cover_started_at: string | null
  cover_error: string | null
  /** Open story: the AI's suggested chapter break, shown to the host. */
  break_hint_seq: number | null
  break_hint_reason: string | null
  hint_checked_count: number
  /** Open story: who wrote the latest part (nobody writes twice in a row). */
  last_part_by: string | null
}

export interface PlayerRow {
  room_id: string
  user_id: string
  name: string
  seat: number
  joined_at: string
}

export interface FragmentRow {
  id: string
  room_id: string
  round: number
  player_id: string
  status: 'submitted' | 'skipped'
  text: string | null
  created_at: string
  /** Order of parts in an open story (0 in the other modes). */
  seq: number
  /** Set when the host removed the part from an open story; the text is kept. */
  hidden_at: string | null
}

export interface ChapterRow {
  room_id: string
  round: number
  text: string | null
  source_fragment_ids: string[]
  paragraphs: { text: string, fragmentIds: string[] }[] | null
  error: string | null
  created_at: string
  /** Current version in chapter_versions; 0 while there is no text (failed merge, not yet edited). */
  version: number
}

/** One saved text of a chapter. Rows are only ever added; the chapter row holds the current one. */
export interface ChapterVersionRow {
  room_id: string
  round: number
  version: number
  kind: 'merge' | 'ai_edit' | 'manual' | 'restore'
  text: string
  paragraphs: ChapterRow['paragraphs']
  instruction: string | null
  restored_from: number | null
  created_by: string | null
  created_at: string
}

export function toGameState(room: RoomRow): GameState {
  return {
    status: room.status,
    round: room.current_round,
    turnIndex: room.turn_index,
    phaseEndsAt: room.phase_ends_at ? Date.parse(room.phase_ends_at) : null
  }
}

export function toSettings(room: RoomRow): Settings {
  return {
    theme: room.theme,
    mode: room.mode,
    genre: room.genre as Settings['genre'],
    roundsTotal: room.rounds_total,
    charLimit: room.char_limit,
    timeLimitS: room.time_limit_s,
    endless: room.endless,
    isPublic: room.is_public
  }
}

/** "Round 7" in an endless game, "Round 2 of 5" otherwise. */
export function roundLabel(room: Pick<RoomRow, 'current_round' | 'rounds_total' | 'endless' | 'mode'>): string {
  if (room.mode === 'open') return `Chapter ${room.current_round}`
  return room.endless ? `Round ${room.current_round}` : `Round ${room.current_round} of ${room.rounds_total}`
}

/** "Endless" or "3 rounds", for room summaries. */
export function roundsSummary(room: Pick<RoomRow, 'rounds_total' | 'endless' | 'mode'>): string {
  if (room.mode === 'open') return 'Join any time'
  return room.endless ? 'Endless' : `${room.rounds_total} rounds`
}

export const MODE_LABELS: Record<Mode, { label: string, description: string }> = {
  chaos: { label: 'Chaos Mode', description: 'Everyone writes at once, drafts stay hidden, and AI weaves them into one chapter.' },
  fixed: { label: 'Fixed order', description: 'Take turns in a known order. Everyone reads the story as it grows.' },
  random: { label: 'Random order', description: 'Take turns in a surprise order. Everyone writes once per round.' },
  open: { label: 'Open story', description: 'No rounds, no timer. Anyone can join and add a part at any time; the host ends the chapters.' }
}
