import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { buildMergeUserMessage, checkMerge, MERGE_SYSTEM_PROMPT, mergeOutputSchema, type MergedChapter, type MergeInput } from '#shared/merge'

let client: Anthropic | undefined

function anthropic(): Anthropic | null {
  const { anthropicApiKey, anthropicBaseUrl } = useRuntimeConfig()
  if (!anthropicApiKey) return null
  client ??= new Anthropic({ apiKey: anthropicApiKey, baseURL: anthropicBaseUrl || undefined, timeout: 30_000, maxRetries: 1 })
  return client
}

export type ChapterResult = { ok: true, chapter: MergedChapter } | { ok: false, error: string }

/**
 * Asks Claude to weave one round's fragments into a chapter. Output is structured (paragraphs
 * citing fragment labels) and must pass checkMerge (every fragment used) or it is retried once.
 * Never throws: on any failure the caller falls back to showing the original fragments.
 */
export async function generateChapter(input: MergeInput): Promise<ChapterResult> {
  if (!input.fragments.length) return { ok: false, error: 'no_fragments' }
  const api = anthropic()
  if (!api) return { ok: false, error: 'no_api_key' }
  const { anthropicModel } = useRuntimeConfig()

  let error = 'unknown'
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await api.beta.messages.parse({
        model: anthropicModel,
        max_tokens: 8000,
        // On a safety decline, the API re-runs the request on a suitable fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: zodOutputFormat(mergeOutputSchema) },
        system: MERGE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildMergeUserMessage(input) }]
      })
      if (response.stop_reason === 'refusal') {
        error = 'refused'
        continue
      }
      if (!response.parsed_output) {
        error = response.stop_reason === 'max_tokens' ? 'too_long' : 'unparseable'
        continue
      }
      const check = checkMerge(response.parsed_output, input.fragments)
      if (check.ok) return check
      error = check.reason
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return { ok: false, error: 'auth' }
      if (e instanceof Anthropic.BadRequestError || e instanceof Anthropic.NotFoundError) return { ok: false, error: `api_${e.status}` }
      error = e instanceof Anthropic.APIError ? `api_${e.status ?? 'connection'}` : 'error'
    }
  }
  console.warn(`[merge] falling back to original fragments: ${error}`)
  return { ok: false, error }
}
