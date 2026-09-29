import type { H3Event } from 'h3'

/** Resolves the calling player from the `Authorization: Bearer <access token>` header. */
export async function requireUser(event: H3Event): Promise<string> {
  const token = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Missing session' })
  const { data, error } = await useSupabaseAdmin().auth.getUser(token)
  if (error || !data.user) throw createError({ statusCode: 401, statusMessage: 'Invalid session' })
  return data.user.id
}
