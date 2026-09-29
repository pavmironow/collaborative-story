import type { PlayerRow, RoomRow } from '#shared/room'

export async function loadRoom(code: string): Promise<RoomRow> {
  const { data, error } = await useSupabaseAdmin().from('rooms').select('*').eq('code', code.toUpperCase()).maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: 'Could not load the room' })
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Room not found' })
  return data as RoomRow
}

export async function loadPlayers(roomId: string): Promise<PlayerRow[]> {
  const { data, error } = await useSupabaseAdmin().from('players').select('*').eq('room_id', roomId).order('seat')
  if (error) throw createError({ statusCode: 500, statusMessage: 'Could not load the players' })
  return data as PlayerRow[]
}
