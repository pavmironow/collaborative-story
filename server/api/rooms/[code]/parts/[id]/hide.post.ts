/**
 * Host-only, open story: removes a part from the story (spam, or something hurtful). The row and
 * its text are kept; only its author still sees it, marked as removed.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const room = await loadRoom(getRouterParam(event, 'code')!)
  if (room.host_id !== userId) throw createError({ statusCode: 403, statusMessage: 'Only the host can remove a part' })
  if (room.mode !== 'open') throw createError({ statusCode: 409, statusMessage: 'Parts can only be removed from an open story' })

  const db = useSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await db.from('fragments').update({ hidden_at: now })
    .eq('room_id', room.id).eq('id', getRouterParam(event, 'id')!).eq('status', 'submitted').is('hidden_at', null)
    .select('id')
  if (error) throw createError({ statusCode: 500, statusMessage: 'Could not remove the part' })
  if (!data?.length) throw createError({ statusCode: 404, statusMessage: 'No such part, or it was already removed' })
  await db.from('rooms').update({ updated_at: now }).eq('id', room.id)
  return { hidden: true }
})
