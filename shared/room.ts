/** Room row shape shared by server routes and pages, plus converters to the pure game types. */
import type { GameState, Mode, Settings, Status } from './game'

export interface RoomRow {
  id: string
  code: string
  host_id: string
  theme: string
  mode: Mode
  genre: string
  rounds_total: number
  char_limit: number
  time_limit_s: number
  status: Status
  current_round: number
  turn_index: number
  phase_ends_at: string | null
  seed: string
  created_at: string
  updated_at: string
  merge_started_at: string | null
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
}

export interface ChapterRow {
  room_id: string
  round: number
  text: string | null
  source_fragment_ids: string[]
  paragraphs: { text: string, fragmentIds: string[] }[] | null
  error: string | null
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
    timeLimitS: room.time_limit_s
  }
}

export const MODE_LABELS: Record<Mode, { label: string, description: string }> = {
  chaos: { label: 'Chaos Mode', description: 'Everyone writes at once, drafts stay hidden, and AI weaves them into one chapter.' },
  fixed: { label: 'Fixed order', description: 'Take turns in a known order. Everyone reads the story as it grows.' },
  random: { label: 'Random order', description: 'Take turns in a surprise order. Everyone writes once per round.' }
}
