import { shouldAskForHint, storyParts } from '#shared/open-story'
import type { FragmentRow } from '#shared/room'

/**
 * Host-only, open story: the host's page calls this when the current chapter reaches another
 * few parts. The AI may suggest where to end the chapter; the result appears on the room row.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const room = await loadRoom(getRouterParam(event, 'code')!)
  if (room.host_id !== userId) throw createError({ statusCode: 403, statusMessage: 'Only the host gets chapter hints' })
  if (room.mode !== 'open' || room.status !== 'writing') return { result: 'skipped' }

  const { data } = await useSupabaseAdmin().from('fragments').select('seq, status, hidden_at, player_id')
    .eq('room_id', room.id).eq('round', room.current_round)
  const count = storyParts((data ?? []) as FragmentRow[]).length
  if (!shouldAskForHint(count, room.hint_checked_count)) return { result: 'skipped' }
  return { result: await suggestChapterBreak(room, count) }
})
