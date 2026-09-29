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

export function stateUpdate(next: ReturnType<typeof advance>) {
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
export async function tryClosePhase(room: RoomRow, now = Date.now(), background: (task: Promise<unknown>) => void = t => void t): Promise<boolean> {
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

  // The AI merge takes seconds: run it after responding, while clients show "weaving…".
  if (next.status === 'merging') background(mergeChapter(data[0] as RoomRow).catch(e => console.error('[merge]', e)))
  return true
}

/**
 * Builds the round's chapter with the AI merge and moves the room to `reveal`. If the AI is
 * unavailable or its chapter drops a contribution, the chapter keeps no text and the reveal
 * screen shows the original fragments instead: the game always continues.
 */
export async function mergeChapter(room: RoomRow, options: { skipAi?: boolean } = {}): Promise<void> {
  const db = useSupabaseAdmin()
  const [{ data: fragments }, { data: previous }] = await Promise.all([
    db.from('fragments').select('id, round, text, status, created_at').eq('room_id', room.id).lte('round', room.current_round).order('created_at'),
    db.from('chapters').select('round, text').eq('room_id', room.id).lt('round', room.current_round).order('round')
  ])
  const submitted = (fragments ?? []).filter(f => f.status === 'submitted')
  const current = submitted.filter(f => f.round === room.current_round).map(f => ({ id: f.id as string, text: f.text as string }))
  const storySoFar = Array.from({ length: room.current_round - 1 }, (_, i) => i + 1).map(round =>
    previous?.find(c => c.round === round)?.text
    ?? submitted.filter(f => f.round === round).map(f => f.text).join('\n')
  ).filter(Boolean) as string[]

  const result = options.skipAi
    ? { ok: false as const, error: 'timeout' }
    : await generateChapter({ theme: room.theme, storySoFar, fragments: current })

  await db.from('chapters').upsert({
    room_id: room.id,
    round: room.current_round,
    text: result.ok ? result.chapter.text : null,
    paragraphs: result.ok ? result.chapter.paragraphs : null,
    source_fragment_ids: current.map(f => f.id),
    error: result.ok ? null : result.error
  }, { onConflict: 'room_id,round', ignoreDuplicates: true })

  const next = advance(toGameState(room), toSettings(room), 0, Date.now())
  await db.from('rooms').update(stateUpdate(next)).eq('id', room.id).eq('status', 'merging').eq('current_round', room.current_round)
}

/** If a merge got stuck (e.g. the server restarted mid-call), finish the round without AI. */
export const MERGE_STUCK_MS = 45_000
export async function recoverStuckMerge(room: RoomRow): Promise<boolean> {
  if (room.status !== 'merging' || Date.now() - Date.parse(room.updated_at) < MERGE_STUCK_MS) return false
  await mergeChapter(room, { skipAi: true })
  return true
}

/** Host moves from `reveal` to the next round (or the end). */
export async function continueFromReveal(room: RoomRow, playerCount: number): Promise<boolean> {
  const next = advance(toGameState(room), toSettings(room), playerCount, Date.now())
  const { data } = await useSupabaseAdmin().from('rooms').update(stateUpdate(next))
    .eq('id', room.id).eq('status', 'reveal').eq('current_round', room.current_round).select('id')
  return !!data?.length
}
