/**
 * Called by every client on the "weaving" screen. Exactly one call runs the merge (inside this
 * request, so it also works on serverless hosts); the others return "busy" immediately.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const room = await loadRoom(getRouterParam(event, 'code')!)
  const players = await loadPlayers(room.id)
  if (!players.some(p => p.user_id === userId)) throw createError({ statusCode: 403, statusMessage: 'You are not a writer in this story' })
  return { result: await claimMerge(room) }
})
