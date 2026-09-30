import { zodTextFormat } from 'openai/helpers/zod'
import { buildMergeUserMessage, checkMerge, MERGE_SYSTEM_PROMPT, mergeOutputSchema, type MergedChapter, type MergeInput } from '#shared/merge'

export type ChapterResult = { ok: true, chapter: MergedChapter } | { ok: false, error: string }

/**
 * Asks the model to weave one round's fragments into a chapter. Output is structured (paragraphs
 * citing fragment labels) and must pass checkMerge (every fragment used) or it is retried once,
 * all within one time budget. Never throws: on any failure the caller shows the original fragments.
 */
export async function generateChapter(input: MergeInput): Promise<ChapterResult> {
  if (!input.fragments.length) return { ok: false, error: 'no_fragments' }
  const api = useOpenAI()
  if (!api) return { ok: false, error: 'no_api_key' }
  const { openaiTextModel, mergeBudgetMs } = useRuntimeConfig()
  const deadline = Date.now() + Number(mergeBudgetMs)

  let error = 'unknown'
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - Date.now()
    if (remaining < 3000) {
      error = attempt === 0 ? 'timeout' : error
      break
    }
    try {
      const response = await api.responses.parse({
        model: openaiTextModel,
        instructions: MERGE_SYSTEM_PROMPT,
        input: buildMergeUserMessage(input),
        text: { format: zodTextFormat(mergeOutputSchema, 'chapter') },
        reasoning: { effort: 'low' },
        max_output_tokens: 6000
      }, { timeout: remaining })

      const refused = response.output.some(item => item.type === 'message' && item.content.some(c => c.type === 'refusal'))
      if (refused) {
        error = 'refused'
        continue
      }
      if (!response.output_parsed) {
        error = response.status === 'incomplete' ? 'too_long' : 'unparseable'
        continue
      }
      const check = checkMerge(response.output_parsed, input.fragments)
      if (check.ok) return check
      error = check.reason
    } catch (e) {
      error = openaiErrorCode(e)
      if (isPermanent(e)) break
    }
  }
  console.warn(`[merge] falling back to original fragments: ${error}`)
  return { ok: false, error }
}
