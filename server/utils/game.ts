import { advance, canClose, skipped, SUBMIT_GRACE_MS, turnOrder } from '#shared/game'
import type { PlayerRow, RoomRow } from '#shared/room'
import { toGameState, toSettings } from '#shared/room'

/** Who must write in the current phase: everyone in Chaos Mode, the current writer otherwise. */
export function expectedWriters(room: RoomRow, players: PlayerRow[]): string[] {
  const ids = players.map(p => p.user_id)
  if (room.mode === 'chaos') return ids
  const writer = turnOrder(ids, room.mode, room.current_round, room.seed)[room.turn_index]
  return writer ? [writer] : []
}

export async function submittedIds(room: RoomRow): Promise<string[]> {
  const { data, error } = await useSupabaseAdmin().from('fragments').select('player_id')
    .eq('room_id', room.id).eq('round', room.current_round).eq('status', 'submitted')
  if (error) throw createError({ statusCode: 500, statusMessage: 'Could not load submissions' })
  return data.map(f => f.player_id as string)
}

function stateUpdate(next: ReturnType<typeof advance>) {
  return {
    status: next.status,
    current_round: next.round,
    turn_index: next.turnIndex,
    phase_ends_at: next.phaseEndsAt ? new Date(next.phaseEndsAt).toISOString() : null,
    updated_at: new Date().toISOString()
  }
}

/**
 * Closes the current writing turn/round if the rules allow it. Safe to call from any number
 * of clients at once: the conditional UPDATE lets exactly one caller win.
 * Returns true only for the caller that actually closed it.
 */
export async function tryClosePhase(room: RoomRow, now = Date.now()): Promise<boolean> {
  if (room.status !== 'writing') return false
  const db = useSupabaseAdmin()
  const players = await loadPlayers(room.id)
  const expected = expectedWriters(room, players)
  const submitted = await submittedIds(room)
  // Timeouts count only after the grace period; "everyone submitted" closes immediately.
  if (!canClose(toGameState(room), expected, submitted, now - SUBMIT_GRACE_MS)) return false

  const next = advance(toGameState(room), toSettings(room), players.length, now)
  const { data, error } = await db.from('rooms').update(stateUpdate(next))
    .eq('id', room.id).eq('status', 'writing').eq('current_round', room.current_round).eq('turn_index', room.turn_index)
    .select('*')
  if (error) throw createError({ statusCode: 500, statusMessage: 'Could not close the round' })
  if (!data?.length) return false // another caller closed it first

  const missing = skipped(expected, submitted)
  if (missing.length) {
    await db.from('fragments').upsert(
      missing.map(player_id => ({ room_id: room.id, round: room.current_round, player_id, status: 'skipped', text: null })),
      { onConflict: 'room_id,round,player_id', ignoreDuplicates: true }
    )
  }

  if (next.status === 'merging') await mergeChapter(data[0] as RoomRow)
  return true
}

/**
 * Builds the round's chapter and moves the room to `reveal`. Until the AI merge (F6) exists,
 * the chapter has no text and the reveal screen shows the original fragments.
 */
export async function mergeChapter(room: RoomRow): Promise<void> {
  const db = useSupabaseAdmin()
  const { data: fragments } = await db.from('fragments').select('id')
    .eq('room_id', room.id).eq('round', room.current_round).eq('status', 'submitted')
  await db.from('chapters').upsert({
    room_id: room.id, round: room.current_round, text: null,
    source_fragment_ids: (fragments ?? []).map(f => f.id), error: 'not_generated'
  }, { onConflict: 'room_id,round', ignoreDuplicates: true })

  const next = advance(toGameState(room), toSettings(room), 0, Date.now())
  await db.from('rooms').update(stateUpdate(next)).eq('id', room.id).eq('status', 'merging').eq('current_round', room.current_round)
}

/** Host moves from `reveal` to the next round (or the end). */
export async function continueFromReveal(room: RoomRow, playerCount: number): Promise<boolean> {
  const next = advance(toGameState(room), toSettings(room), playerCount, Date.now())
  const { data } = await useSupabaseAdmin().from('rooms').update(stateUpdate(next))
    .eq('id', room.id).eq('status', 'reveal').eq('current_round', room.current_round).select('id')
  return !!data?.length
}
