export default defineEventHandler(async () => {
  const { error } = await useSupabaseAdmin().from('rooms').select('id', { head: true, count: 'exact' })
  return { ok: true, database: error ? `error: ${error.message}` : 'ok' }
})
