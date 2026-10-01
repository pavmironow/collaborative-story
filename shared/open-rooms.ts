/** The homepage list of public rooms that are waiting in the lobby for writers. */
import { LIMITS, type Mode } from './game'
import type { RoomRow } from './room'

/** A lobby older than this is most likely abandoned, so it is no longer listed. */
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
  createdAt: string
}

type Candidate = Pick<RoomRow, 'code' | 'theme' | 'genre' | 'mode' | 'endless' | 'rounds_total' | 'status' | 'is_public' | 'created_at'> & { id: string }

/** Public lobbies that are recent and not full, newest first. */
export function toOpenRooms(rooms: Candidate[], playerCounts: Map<string, number>, now: number): OpenRoom[] {
  return rooms
    .filter(r => r.is_public && r.status === 'lobby' && now - Date.parse(r.created_at) < OPEN_ROOM_MAX_AGE_MS)
    .map(r => ({ room: r, players: playerCounts.get(r.id) ?? 0 }))
    .filter(({ players }) => players < LIMITS.players.max)
    .sort((a, b) => Date.parse(b.room.created_at) - Date.parse(a.room.created_at))
    .slice(0, OPEN_ROOMS_LIMIT)
    .map(({ room, players }) => ({
      code: room.code,
      theme: room.theme,
      genre: room.genre,
      mode: room.mode,
      endless: room.endless,
      roundsTotal: room.rounds_total,
      players,
      maxPlayers: LIMITS.players.max,
      createdAt: room.created_at
    }))
}
