import { z } from 'zod'
import { GENRE_IDS, SURPRISE } from '#shared/genres'
import { LIMITS } from '#shared/game'

const bodySchema = z.object({
  idea: z.string().max(LIMITS.theme.max * 2).default(''),
  genre: z.enum([...GENRE_IDS, SURPRISE]).default('adventure')
})

// Best-effort per-user limit (per server instance): the helper is for hosts, not a free AI endpoint.
const recent = new Map<string, number[]>()
const LIMIT = 10
const WINDOW_MS = 60_000

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const now = Date.now()
  const calls = (recent.get(userId) ?? []).filter(t => now - t < WINDOW_MS)
  if (calls.length >= LIMIT) throw createError({ statusCode: 429, statusMessage: 'Too many suggestions. Wait a minute and try again.' })
  recent.set(userId, [...calls, now])

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Invalid request' })
  const genre = parsed.data.genre === SURPRISE ? 'adventure' : parsed.data.genre

  const result = await suggestTheme(parsed.data.idea, genre)
  if (!result.ok) {
    throw createError({
      statusCode: 503,
      statusMessage: result.error === 'no_api_key' ? 'The AI helper is not set up on this server.' : 'The AI helper is not available right now. Try again, or write the theme yourself.'
    })
  }
  return { theme: result.theme }
})
