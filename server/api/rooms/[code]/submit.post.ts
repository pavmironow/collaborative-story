import { checkFragment, SUBMIT_GRACE_MS } from '#shared/game'

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const room = await loadRoom(getRouterParam(event, 'code')!)
  const players = await loadPlayers(room.id)
  if (!players.some(p => p.user_id === userId)) throw createError({ statusCode: 403, statusMessage: 'You are not a writer in this story' })
  if (room.status !== 'writing') throw createError({ statusCode: 409, statusMessage: 'Writing is closed right now' })
  if (!expectedWriters(room, players).includes(userId)) throw createError({ statusCode: 409, statusMessage: 'It is not your turn' })
  if (room.phase_ends_at && Date.now() > Date.parse(room.phase_ends_at) + SUBMIT_GRACE_MS) {
    throw createError({ statusCode: 409, statusMessage: 'Time is up for this round' })
  }

  const body = await readBody<{ text?: unknown }>(event)
  const check = checkFragment(typeof body?.text === 'string' ? body.text : '', room.char_limit)
  if (!check.ok) {
    throw createError({
      statusCode: 422,
      statusMessage: check.reason === 'empty' ? 'Write something first' : `Too long: ${check.length}/${room.char_limit} characters`
    })
  }

  const db = useSupabaseAdmin()
  const { error } = await db.from('fragments').insert({ room_id: room.id, round: room.current_round, player_id: userId, status: 'submitted', text: check.text })
  if (error?.code === '23505') throw createError({ statusCode: 409, statusMessage: 'You already submitted this round' })
  if (error?.code === 'P0002') throw createError({ statusCode: 409, statusMessage: 'Time is up for this round' })
  if (error) throw createError({ statusCode: 500, statusMessage: 'Could not save your text, try again' })

  // Notify everyone (progress), then close early if this was the last writer.
  await db.from('rooms').update({ updated_at: new Date().toISOString() }).eq('id', room.id)
  const closed = await tryClosePhase(room)
  return { submitted: true, closed }
})
