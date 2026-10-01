import { z } from 'zod'
import { playerNameSchema, roundsToStore, settingsSchema } from '#shared/game'
import { resolveGenre } from '#shared/genres'

const bodySchema = settingsSchema.extend({ hostName: playerNameSchema })

// No 0/O/1/I/L: codes are read aloud and typed on phones.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generateCode(length = 5): string {
  return Array.from(crypto.getRandomValues(new Uint32Array(length)), n => ALPHABET[n % ALPHABET.length]).join('')
}

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid settings', data: z.flattenError(parsed.error).fieldErrors })
  }
  const { hostName, theme, mode, genre, charLimit, timeLimitS, endless } = parsed.data
  const db = useSupabaseAdmin()

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: room, error } = await db.from('rooms').insert({
      code: generateCode(), host_id: userId, theme, mode, genre: resolveGenre(genre),
      rounds_total: roundsToStore(parsed.data), endless, char_limit: charLimit, time_limit_s: timeLimitS
    }).select('id, code').single()

    if (error?.code === '23505') continue // code collision, try another
    if (error || !room) throw createError({ statusCode: 500, statusMessage: 'Could not create the room' })

    const { error: playerError } = await db.from('players').insert({ room_id: room.id, user_id: userId, name: hostName, seat: 0 })
    if (playerError) {
      await db.from('rooms').delete().eq('id', room.id)
      throw createError({ statusCode: 500, statusMessage: 'Could not add the host to the room' })
    }
    return { code: room.code }
  }
  throw createError({ statusCode: 503, statusMessage: 'Could not allocate a room code, try again' })
})
