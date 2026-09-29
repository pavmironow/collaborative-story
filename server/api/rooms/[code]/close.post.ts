/** Any writer may ask to close the phase when their timer hits zero; the server decides. */
export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const room = await loadRoom(getRouterParam(event, 'code')!)
  const players = await loadPlayers(room.id)
  if (!players.some(p => p.user_id === userId)) throw createError({ statusCode: 403, statusMessage: 'You are not a writer in this story' })
  if (room.status === 'merging') return { closed: false, recovered: await recoverStuckMerge(room) }
  return { closed: await tryClosePhase(room, Date.now(), task => event.waitUntil(task)) }
})
