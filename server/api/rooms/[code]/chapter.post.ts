import { z } from 'zod'

const bodySchema = z.object({ afterSeq: z.number().int().min(1) })

/** Host-only, open story: ends the current chapter after the given part. */
export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const body = bodySchema.safeParse(await readBody(event))
  if (!body.success) throw createError({ statusCode: 422, statusMessage: 'Choose the part the chapter ends with' })
  const room = await loadRoom(getRouterParam(event, 'code')!)
  if (room.host_id !== userId) throw createError({ statusCode: 403, statusMessage: 'Only the host can end a chapter' })
  if (room.mode !== 'open' || room.status !== 'writing') throw createError({ statusCode: 409, statusMessage: 'Chapters can only be ended while an open story is being written' })

  const { data: chapter, error } = await useSupabaseAdmin().rpc('close_open_chapter', { p_room: room.id, p_after_seq: body.data.afterSeq })
  if (error) throw createError({ statusCode: 500, statusMessage: 'Could not end the chapter' })
  if (chapter === null) {
    throw createError({
      statusCode: 409,
      statusMessage: room.current_round >= room.rounds_total ? `A story can have at most ${room.rounds_total} chapters` : 'That part is no longer in the current chapter'
    })
  }
  return { chapter: chapter as number }
})
