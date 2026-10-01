import { OPEN_ROOM_MAX_AGE_MS, OPEN_ROOMS_LIMIT, toOpenRooms } from '#shared/open-rooms'

/** Joinable public rooms for the homepage. No session needed: anyone may see and join them. */
export default defineEventHandler(async (event) => {
  const db = useSupabaseAdmin()
  const now = Date.now()
  // A few extra rows, since full rooms are dropped after counting players.
  const { data: rooms, error } = await db.from('rooms')
    .select('id, code, theme, genre, mode, endless, rounds_total, status, is_public, created_at, updated_at')
    .eq('is_public', true)
    // Lobbies, and open stories while they are being written (anyone may join those).
    .or('status.eq.lobby,and(mode.eq.open,status.eq.writing)')
    .gt('updated_at', new Date(now - OPEN_ROOM_MAX_AGE_MS).toISOString())
    .order('updated_at', { ascending: false })
    .limit(OPEN_ROOMS_LIMIT * 2)
  if (error) throw createError({ statusCode: 500, statusMessage: 'Could not load open rooms' })

  const counts = new Map<string, number>()
  if (rooms.length) {
    const { data: players, error: playersError } = await db.from('players').select('room_id').in('room_id', rooms.map(r => r.id))
    if (playersError) throw createError({ statusCode: 500, statusMessage: 'Could not load open rooms' })
    for (const p of players) counts.set(p.room_id, (counts.get(p.room_id) ?? 0) + 1)
  }

  setHeader(event, 'Cache-Control', 'no-store')
  return toOpenRooms(rooms, counts, now)
})
