import { LIMITS, isLocked, playerNameSchema } from '#shared/game'

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const room = await loadRoom(getRouterParam(event, 'code')!)
  const players = await loadPlayers(room.id)

  // Rejoining (e.g. after a refresh or on a second tab) is always allowed.
  if (players.some(p => p.user_id === userId)) return { joined: true }

  if (isLocked(room.status)) throw createError({ statusCode: 409, statusMessage: 'This story has already started' })
  if (players.length >= LIMITS.players.max) throw createError({ statusCode: 409, statusMessage: `This room is full (${LIMITS.players.max} players)` })

  const name = playerNameSchema.safeParse((await readBody<{ name?: unknown }>(event))?.name)
  if (!name.success) throw createError({ statusCode: 422, statusMessage: name.error.issues[0]!.message })

  // The seat is assigned by the database trigger (serialized per room); 0 is a placeholder.
  const { error } = await useSupabaseAdmin().from('players').insert({ room_id: room.id, user_id: userId, name: name.data, seat: 0 })
  if (!error) return { joined: true }
  if (error.code === 'P0001') throw createError({ statusCode: 409, statusMessage: 'This story has already started' })
  if (error.code === 'P0003') throw createError({ statusCode: 409, statusMessage: `This room is full (${LIMITS.players.max} players)` })
  if (error.code === '23505') return { joined: true } // this user joined at the same moment from another tab
  throw createError({ statusCode: 500, statusMessage: 'Could not join the room, try again' })
})
