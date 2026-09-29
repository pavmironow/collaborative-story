import { advance, canStart } from '#shared/game'
import { toGameState, toSettings } from '#shared/room'

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const room = await loadRoom(getRouterParam(event, 'code')!)
  if (room.host_id !== userId) throw createError({ statusCode: 403, statusMessage: 'Only the host can start the story' })

  const players = await loadPlayers(room.id)
  if (!canStart(toGameState(room), players.length)) {
    throw createError({ statusCode: 409, statusMessage: room.status === 'lobby' ? 'At least 2 players are needed to start' : 'The story has already started' })
  }

  const next = advance(toGameState(room), toSettings(room), players.length, Date.now())
  // Conditional update: only one start can win, and players are locked from this moment.
  const { data, error } = await useSupabaseAdmin().from('rooms')
    .update({ status: next.status, current_round: next.round, turn_index: next.turnIndex, phase_ends_at: new Date(next.phaseEndsAt!).toISOString() })
    .eq('id', room.id).eq('status', 'lobby')
    .select('id')
  if (error) throw createError({ statusCode: 500, statusMessage: 'Could not start the story' })
  if (!data?.length) throw createError({ statusCode: 409, statusMessage: 'The story has already started' })
  return { started: true }
})
