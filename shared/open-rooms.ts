/**
 * The homepage list of public rooms people can join: lobbies waiting for writers, and open
 * stories that are being written (anyone may join those at any time).
 */
import type { Mode } from './game'
import type { RoomRow } from './room'
import { maxPlayers } from './open-story'

/** A room quiet for longer than this is most likely abandoned, so it is no longer listed. */
export const OPEN_ROOM_MAX_AGE_MS = 2 * 60 * 60 * 1000
export const OPEN_ROOMS_LIMIT = 20

export interface OpenRoom {
  code: string
  theme: string
  genre: string
  mode: Mode
  endless: boolean
  roundsTotal: number
  players: number
  maxPlayers: number
  /** An open story that is already being written (as opposed to a lobby). */
  inProgress: boolean
  /** When the lobby opened, or when the open story last got a part. */
  activeAt: string
}

type Candidate = Pick<RoomRow, 'code' | 'theme' | 'genre' | 'mode' | 'endless' | 'rounds_total' | 'status' | 'is_public' | 'created_at' | 'updated_at'> & { id: string }

/** Lobbies count from when they opened; open stories from their latest activity. */
function joinableSince(r: Candidate): string | null {
  if (!r.is_public) return null
  if (r.status === 'lobby') return r.created_at
  if (r.mode === 'open' && r.status === 'writing') return r.updated_at
  return null
}

/** Public rooms that can be joined now, recently active and not full, most recent first. */
export function toOpenRooms(rooms: Candidate[], playerCounts: Map<string, number>, now: number): OpenRoom[] {
  return rooms
    .map(room => ({ room, activeAt: joinableSince(room), players: playerCounts.get(room.id) ?? 0 }))
    .filter((r): r is typeof r & { activeAt: string } => !!r.activeAt && now - Date.parse(r.activeAt) < OPEN_ROOM_MAX_AGE_MS)
    .filter(({ room, players }) => players < maxPlayers(room.mode))
    .sort((a, b) => Date.parse(b.activeAt) - Date.parse(a.activeAt))
    .slice(0, OPEN_ROOMS_LIMIT)
    .map(({ room, players, activeAt }) => ({
      code: room.code,
      theme: room.theme,
      genre: room.genre,
      mode: room.mode,
      endless: room.endless,
      roundsTotal: room.rounds_total,
      players,
      maxPlayers: maxPlayers(room.mode),
      inProgress: room.status !== 'lobby',
      activeAt
    }))
}
