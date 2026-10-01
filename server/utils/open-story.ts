import { zodTextFormat } from 'openai/helpers/zod'
import { checkFragment } from '#shared/game'
import { buildHintInput, checkHint, HINT_SYSTEM_PROMPT, hintOutputSchema, storyParts } from '#shared/open-story'
import type { FragmentRow, RoomRow } from '#shared/room'

/**
 * Adds a part to an open story. The database numbers it, puts it in the current chapter and
 * refuses a second part in a row from the same writer, all under a lock on the room.
 */
export async function submitOpenPart(room: RoomRow, userId: string, text: unknown) {
  if (room.status !== 'writing') throw createError({ statusCode: 409, statusMessage: 'This story has finished' })
  const check = checkFragment(typeof text === 'string' ? text : '', room.char_limit)
  if (!check.ok) {
    throw createError({
      statusCode: 422,
      statusMessage: check.reason === 'empty' ? 'Write something first' : `Too long: ${check.length}/${room.char_limit} characters`
    })
  }
  const db = useSupabaseAdmin()
  const { error } = await db.from('fragments')
    .insert({ room_id: room.id, round: room.current_round, player_id: userId, status: 'submitted', text: check.text })
  if (error?.code === 'P0004') throw createError({ statusCode: 409, statusMessage: 'Wait for someone else to add a part first' })
  if (error?.code === 'P0002') throw createError({ statusCode: 409, statusMessage: 'This story has finished' })
  if (error) throw createError({ statusCode: 500, statusMessage: 'Could not save your part, try again' })
  // Notifies every client (they re-read the story) and keeps a public story on the open list.
  await db.from('rooms').update({ updated_at: new Date().toISOString() }).eq('id', room.id)
  return { submitted: true }
}

/** Short budget: the hint is a nicety, so it must never hold anything up. */
const HINT_BUDGET_MS = 8000

/**
 * Asks the AI whether the current chapter has reached a natural break, once per hintEvery parts
 * (the conditional update makes it run once even if the host has several tabs open). Never
 * throws for AI problems: without an answer there is simply no hint.
 */
export async function suggestChapterBreak(room: RoomRow, partsInChapter: number): Promise<'suggested' | 'none' | 'skipped'> {
  const db = useSupabaseAdmin()
  const { data: claimed } = await db.from('rooms').update({ hint_checked_count: partsInChapter })
    .eq('id', room.id).eq('status', 'writing').eq('current_round', room.current_round).neq('hint_checked_count', partsInChapter)
    .select('id')
  if (!claimed?.length) return 'skipped'

  const { data } = await db.from('fragments').select('*').eq('room_id', room.id).eq('round', room.current_round)
  const parts = storyParts((data ?? []) as FragmentRow[])
  const api = useOpenAI()
  if (!api || parts.length < 2) return 'none'

  try {
    const { openaiFastModel } = useRuntimeConfig()
    const response = await api.responses.parse({
      model: openaiFastModel,
      instructions: HINT_SYSTEM_PROMPT,
      input: buildHintInput(room.theme, parts.map(p => ({ text: p.text! }))),
      text: { format: zodTextFormat(hintOutputSchema, 'chapter_break') },
      reasoning: { effort: 'low' },
      max_output_tokens: 600
    }, { timeout: HINT_BUDGET_MS })
    const hint = response.output_parsed ? checkHint(response.output_parsed, parts) : { ok: false as const }
    if (!hint.ok) return 'none'
    // Only if the chapter is still the one the AI looked at.
    await db.from('rooms').update({ break_hint_seq: hint.afterSeq, break_hint_reason: hint.reason, updated_at: new Date().toISOString() })
      .eq('id', room.id).eq('status', 'writing').eq('current_round', room.current_round)
    return 'suggested'
  } catch (e) {
    console.warn(`[hint] no chapter-break hint: ${openaiErrorCode(e)}`)
    return 'none'
  }
}
