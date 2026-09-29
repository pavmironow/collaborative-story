import { zodTextFormat } from 'openai/helpers/zod'
import { getGenre } from '#shared/genres'
import { buildThemeInput, checkTheme, THEME_SYSTEM_PROMPT, themeOutputSchema } from '#shared/theme'

/** Short budget: this runs while the host waits on the create screen, inside one request. */
const BUDGET_MS = 8000

export async function suggestTheme(idea: string, genreId: string): Promise<{ ok: true, theme: string } | { ok: false, error: string }> {
  const api = useOpenAI()
  if (!api) return { ok: false, error: 'no_api_key' }
  const { openaiFastModel } = useRuntimeConfig()
  const genre = getGenre(genreId)
  const deadline = Date.now() + BUDGET_MS

  let error = 'unknown'
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - Date.now()
    if (remaining < 1500) break
    try {
      const response = await api.responses.parse({
        model: openaiFastModel,
        instructions: THEME_SYSTEM_PROMPT,
        input: buildThemeInput(idea, genre.label, genre.tone),
        text: { format: zodTextFormat(themeOutputSchema, 'theme') },
        reasoning: { effort: 'low' },
        max_output_tokens: 1000
      }, { timeout: remaining })
      if (!response.output_parsed) {
        error = 'unparseable'
        continue
      }
      const check = checkTheme(response.output_parsed)
      if (check.ok) return check
      error = check.reason
    } catch (e) {
      error = openaiErrorCode(e)
      if (isPermanent(e)) break
    }
  }
  console.warn(`[theme] no suggestion: ${error}`)
  return { ok: false, error }
}
