import { z } from 'zod'

const bodySchema = z.object({ finish: z.boolean().optional() }).optional()

/** Host continues from the reveal screen; `{ finish: true }` ends an endless story. */
export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const body = bodySchema.safeParse(await readBody(event).catch(() => undefined))
  if (!body.success) throw createError({ statusCode: 422, statusMessage: 'Invalid request' })
  const room = await loadRoom(getRouterParam(event, 'code')!)
  if (room.host_id !== userId) throw createError({ statusCode: 403, statusMessage: 'Only the host can continue' })
  if (room.status !== 'reveal') throw createError({ statusCode: 409, statusMessage: 'Nothing to continue right now' })
  const finish = body.data?.finish === true
  if (finish && !room.endless) throw createError({ statusCode: 409, statusMessage: 'Only an endless story can be ended early' })
  const players = await loadPlayers(room.id)
  return { continued: await continueFromReveal(room, players.length, { finish }) }
})
