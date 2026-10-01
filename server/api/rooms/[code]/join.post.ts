import { playerNameSchema } from '#shared/game'
import { canJoin, maxPlayers } from '#shared/open-story'

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const room = await loadRoom(getRouterParam(event, 'code')!)
  const players = await loadPlayers(room.id)

  // Rejoining (e.g. after a refresh or on a second tab) is always allowed.
  if (players.some(p => p.user_id === userId)) return { joined: true }

  const join = canJoin(room, players.length)
  if (!join.ok && join.reason === 'full') throw createError({ statusCode: 409, statusMessage: `This room is full (${maxPlayers(room.mode)} players)` })
  if (!join.ok) throw createError({ statusCode: 409, statusMessage: join.reason === 'finished' ? 'This story has finished' : 'This story has already started' })

  const name = playerNameSchema.safeParse((await readBody<{ name?: unknown }>(event))?.name)
  if (!name.success) throw createError({ statusCode: 422, statusMessage: name.error.issues[0]!.message })

  // The seat is assigned by the database trigger (serialized per room); 0 is a placeholder.
  const { error } = await useSupabaseAdmin().from('players').insert({ room_id: room.id, user_id: userId, name: name.data, seat: 0 })
  if (!error) return { joined: true }
  if (error.code === 'P0001') throw createError({ statusCode: 409, statusMessage: 'This story has already started' })
  if (error.code === 'P0003') throw createError({ statusCode: 409, statusMessage: `This room is full (${maxPlayers(room.mode)} players)` })
  if (error.code === '23505') return { joined: true } // this user joined at the same moment from another tab
  throw createError({ statusCode: 500, statusMessage: 'Could not join the room, try again' })
})
