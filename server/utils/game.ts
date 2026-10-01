import { advance, canClose, skipped, SUBMIT_GRACE_MS, turnOrder } from '#shared/game'
import type { PlayerRow, RoomRow } from '#shared/room'
import { toGameState, toSettings } from '#shared/room'
import { getGenre } from '#shared/genres'
import { storySoFar } from '#shared/merge'

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
  const now = new Date().toISOString()
  return {
    status: next.status,
    current_round: next.round,
    turn_index: next.turnIndex,
    phase_ends_at: next.phaseEndsAt ? new Date(next.phaseEndsAt).toISOString() : null,
    merge_started_at: null,
    updated_at: now,
    ...(next.status === 'finished' ? { finished_at: now } : {})
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
      { onConflict: 'room_id,round,player_id,seq', ignoreDuplicates: true } // seq is 0 outside open stories
    )
  }

  // The AI merge is not started here: clients on the "weaving" screen call POST /merge (see claimMerge).
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
  const sofar = storySoFar(previous ?? [], submitted, room.current_round)

  const result = options.skipAi
    ? { ok: false as const, error: 'timeout' }
    : await generateChapter({ theme: room.theme, genreTone: getGenre(room.genre).tone, storySoFar: sofar, fragments: current })

  await db.from('chapters').upsert({
    room_id: room.id,
    round: room.current_round,
    text: result.ok ? result.chapter.text : null,
    paragraphs: result.ok ? result.chapter.paragraphs : null,
    source_fragment_ids: current.map(f => f.id),
    error: result.ok ? null : result.error,
    // Version 1 is recorded in chapter_versions by the chapters_first_version trigger.
    version: result.ok ? 1 : 0
  }, { onConflict: 'room_id,round', ignoreDuplicates: true })

  const next = advance(toGameState(room), toSettings(room), 0, Date.now())
  await db.from('rooms').update(stateUpdate(next)).eq('id', room.id).eq('status', 'merging').eq('current_round', room.current_round)
}

/** A claimed merge that has not finished after this long is considered dead and can be taken over. */
export const MERGE_STUCK_MS = 45_000

/**
 * Runs the chapter merge for the current round if nobody else is running it. The first claim
 * runs the AI merge; a claim taken over from a dead merge (after MERGE_STUCK_MS) finishes the
 * round without AI so the game never stays stuck. Returns what this call did.
 */
export async function claimMerge(room: RoomRow): Promise<'merged' | 'recovered' | 'busy' | 'not_merging'> {
  if (room.status !== 'merging') return 'not_merging'
  const db = useSupabaseAdmin()
  const now = new Date()
  const stale = new Date(now.getTime() - MERGE_STUCK_MS).toISOString()
  const takeover = !!room.merge_started_at
  const { data } = await db.from('rooms').update({ merge_started_at: now.toISOString() })
    .eq('id', room.id).eq('status', 'merging').eq('current_round', room.current_round)
    .or(takeover ? `merge_started_at.lt.${stale}` : 'merge_started_at.is.null')
    .select('*')
  if (!data?.length) return 'busy'
  await mergeChapter(data[0] as RoomRow, { skipAi: takeover })
  return takeover ? 'recovered' : 'merged'
}

/** Host moves from `reveal` to the next round, or to the end (last round, or `finish` in an endless game). */
export async function continueFromReveal(room: RoomRow, playerCount: number, options: { finish?: boolean } = {}): Promise<boolean> {
  const next = advance(toGameState(room), toSettings(room), playerCount, Date.now(), options.finish ? 'finish' : undefined)
  const { data } = await useSupabaseAdmin().from('rooms').update(stateUpdate(next))
    .eq('id', room.id).eq('status', 'reveal').eq('current_round', room.current_round).select('id')
  return !!data?.length
}
