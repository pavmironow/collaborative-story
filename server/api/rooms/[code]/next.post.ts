export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const room = await loadRoom(getRouterParam(event, 'code')!)
  if (room.host_id !== userId) throw createError({ statusCode: 403, statusMessage: 'Only the host can continue' })
  if (room.status !== 'reveal') throw createError({ statusCode: 409, statusMessage: 'Nothing to continue right now' })
  const players = await loadPlayers(room.id)
  return { continued: await continueFromReveal(room, players.length) }
})
