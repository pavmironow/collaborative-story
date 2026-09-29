import type { ChapterRow, FragmentRow } from '#shared/room'
import { buildStory } from '#shared/story'

/** Public read of a finished story: anyone with the link, no session needed. */
export default defineEventHandler(async (event) => {
  const room = await loadRoom(getRouterParam(event, 'code')!)
  if (room.status !== 'finished') throw createError({ statusCode: 404, statusMessage: 'This story is still being written' })
  const db = useSupabaseAdmin()
  const [players, { data: fragments }, { data: chapters }] = await Promise.all([
    loadPlayers(room.id),
    db.from('fragments').select('*').eq('room_id', room.id).order('round').order('created_at'),
    db.from('chapters').select('*').eq('room_id', room.id).order('round')
  ])
  return buildStory(room, players, (fragments ?? []) as FragmentRow[], (chapters ?? []) as ChapterRow[])
})
