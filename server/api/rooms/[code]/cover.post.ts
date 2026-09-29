/** Called by players on the finished screen. One request paints the cover; the others return "busy". */
export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const room = await loadRoom(getRouterParam(event, 'code')!)
  const players = await loadPlayers(room.id)
  if (!players.some(p => p.user_id === userId)) throw createError({ statusCode: 403, statusMessage: 'You are not a writer in this story' })
  return { result: await claimCover(room) }
})
