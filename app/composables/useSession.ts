/**
 * Ensures the browser has a Supabase session, creating an anonymous user on first visit.
 * The session is kept in localStorage, so a refresh keeps the same user id (and seat).
 */
export async function ensureSession(): Promise<{ userId: string, accessToken: string }> {
  const supabase = useSupabase()
  let { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error || !data.session) throw new Error(error?.message ?? 'Could not start a session')
    session = data.session
  }
  return { userId: session.user.id, accessToken: session.access_token }
}

/** `$fetch` to our server routes with the player's session token attached. */
export async function api<T>(url: string, options: Parameters<typeof $fetch>[1] = {}): Promise<T> {
  const { accessToken } = await ensureSession()
  return await $fetch<T>(url, { ...options, headers: { Authorization: `Bearer ${accessToken}` } }) as T
}
