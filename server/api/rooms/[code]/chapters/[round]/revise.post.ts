import { z } from 'zod'
import { getGenre } from '#shared/genres'
import { storySoFar } from '#shared/merge'
import { canRevise, currentChapterText, manualParagraphs, reviseRequestSchema } from '#shared/revision'
import type { ChapterRow, ChapterVersionRow, FragmentRow } from '#shared/room'

const CONFLICT = 'This chapter was just changed. Look at the new version and try again.'

/**
 * Host-only: saves a new version of a revealed chapter (AI rewrite, hand edit, or restore of an
 * older version). Older versions and the players' original fragments are never changed.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUser(event)
  const parsed = reviseRequestSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message ?? 'Invalid request', data: z.flattenError(parsed.error).fieldErrors })
  }
  const req = parsed.data
  const round = Number(getRouterParam(event, 'round'))
  if (!Number.isInteger(round) || round < 1) throw createError({ statusCode: 404, statusMessage: 'No such chapter' })

  const room = await loadRoom(getRouterParam(event, 'code')!)
  if (room.host_id !== userId) throw createError({ statusCode: 403, statusMessage: 'Only the host can change the story' })

  const db = useSupabaseAdmin()
  const [{ data: chapter }, { data: fragments }] = await Promise.all([
    db.from('chapters').select('*').eq('room_id', room.id).eq('round', round).maybeSingle(),
    db.from('fragments').select('*').eq('room_id', room.id).lte('round', round).eq('status', 'submitted').order('created_at')
  ])
  const submitted = (fragments ?? []) as FragmentRow[]
  const parts = submitted.filter(f => f.round === round)
  const check = canRevise(room, chapter as ChapterRow | null, parts.length)
  if (!check.ok) throw createError({ statusCode: 409, statusMessage: check.reason })
  const current = chapter as ChapterRow
  if (current.version !== req.baseVersion) throw createError({ statusCode: 409, statusMessage: CONFLICT })

  let text: string
  let paragraphs: ChapterRow['paragraphs']
  let restoredFrom: number | null = null
  switch (req.kind) {
    case 'manual':
      text = req.text
      paragraphs = manualParagraphs(text, parts.map(f => f.id))
      break
    case 'restore': {
      if (req.version === current.version) throw createError({ statusCode: 409, statusMessage: 'This version is already the current one' })
      const { data: old } = await db.from('chapter_versions').select('*')
        .eq('room_id', room.id).eq('round', round).eq('version', req.version).maybeSingle()
      if (!old) throw createError({ statusCode: 404, statusMessage: 'No such version' })
      text = (old as ChapterVersionRow).text
      paragraphs = (old as ChapterVersionRow).paragraphs
      restoredFrom = req.version
      break
    }
    case 'ai': {
      const { data: previous } = await db.from('chapters').select('round, text').eq('room_id', room.id).lt('round', round)
      const result = await reviseChapterWithAi({
        theme: room.theme,
        genreTone: getGenre(room.genre).tone,
        storySoFar: storySoFar(previous ?? [], submitted, round),
        fragments: parts.map(f => ({ id: f.id, text: f.text! })),
        currentChapter: currentChapterText(current, parts),
        instruction: req.instruction
      })
      if (!result.ok) {
        throw createError({ statusCode: 502, statusMessage: 'The AI could not rewrite this chapter, so nothing was changed. Try another request or edit the text by hand.' })
      }
      text = result.chapter.text
      paragraphs = result.chapter.paragraphs
      break
    }
  }

  const { data: version, error } = await db.rpc('revise_chapter', {
    p_room: room.id,
    p_round: round,
    p_base: req.baseVersion,
    p_kind: req.kind === 'ai' ? 'ai_edit' : req.kind,
    p_text: text,
    p_paragraphs: paragraphs,
    p_instruction: req.kind === 'ai' ? req.instruction : null,
    p_restored_from: restoredFrom,
    p_by: userId
  })
  if (error) throw createError({ statusCode: 500, statusMessage: 'Could not save the chapter' })
  if (version === null) throw createError({ statusCode: 409, statusMessage: CONFLICT })
  return { version: version as number }
})
