export default defineEventHandler(async () => {
  // Not a HEAD request: supabase-js reports no error for a HEAD 404 (missing table).
  const { error } = await useSupabaseAdmin().from('rooms').select('id').limit(1)
  return { ok: !error, database: error ? `error: ${error.message}` : 'ok' }
})
