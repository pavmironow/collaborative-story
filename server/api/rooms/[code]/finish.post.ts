/** Host-only, open story: ends the story. The unfinished chapter becomes the last one. */
export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const room = await loadRoom(getRouterParam(event, 'code')!)
  if (room.host_id !== userId) throw createError({ statusCode: 403, statusMessage: 'Only the host can end the story' })
  if (room.mode !== 'open') throw createError({ statusCode: 409, statusMessage: 'Only an open story is ended this way' })

  const { data: finished, error } = await useSupabaseAdmin().rpc('finish_open_story', { p_room: room.id })
  if (error) throw createError({ statusCode: 500, statusMessage: 'Could not end the story' })
  if (!finished) throw createError({ statusCode: 409, statusMessage: 'This story has already finished' })
  return { finished: true }
})
