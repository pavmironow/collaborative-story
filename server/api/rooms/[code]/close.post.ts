/** Any writer may ask to close the phase when their timer hits zero; the server decides. */
export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const room = await loadRoom(getRouterParam(event, 'code')!)
  const players = await loadPlayers(room.id)
  if (!players.some(p => p.user_id === userId)) throw createError({ statusCode: 403, statusMessage: 'You are not a writer in this story' })
  return { closed: await tryClosePhase(room) }
})
