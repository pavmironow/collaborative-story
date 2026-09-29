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

  const db = useSupabaseAdmin()
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: last } = await db.from('players').select('seat').eq('room_id', room.id).order('seat', { ascending: false }).limit(1).maybeSingle()
    const { error } = await db.from('players').insert({ room_id: room.id, user_id: userId, name: name.data, seat: (last?.seat ?? -1) + 1 })
    if (!error) return { joined: true }
    if (error.code === 'P0001') throw createError({ statusCode: 409, statusMessage: 'This story has already started' })
    if (error.code !== '23505') break
    // 23505: two players took the same seat at once, or this user already joined. Re-check and retry.
    const { data: me } = await db.from('players').select('user_id').eq('room_id', room.id).eq('user_id', userId).maybeSingle()
    if (me) return { joined: true }
  }
  throw createError({ statusCode: 500, statusMessage: 'Could not join the room, try again' })
})
