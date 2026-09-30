import OpenAI from 'openai'

let client: OpenAI | undefined

/** Server-only OpenAI client, or null when no key is configured (AI features then fall back). */
export function useOpenAI(): OpenAI | null {
  const { openaiApiKey, openaiBaseUrl } = useRuntimeConfig()
  if (!openaiApiKey) return null
  // Retries are handled by the callers within their own time budgets (serverless request limits).
  client ??= new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseUrl || undefined, maxRetries: 0 })
  return client
}

/** Maps SDK errors to short codes stored with the result (never shown raw to players). */
export function openaiErrorCode(e: unknown): string {
  if (e instanceof OpenAI.APIConnectionTimeoutError) return 'timeout'
  if (e instanceof OpenAI.AuthenticationError || e instanceof OpenAI.PermissionDeniedError) return 'auth'
  if (e instanceof OpenAI.APIError) return `api_${e.status ?? 'connection'}`
  return 'error'
}

/** Errors that will not succeed on a retry. */
export function isPermanent(e: unknown): boolean {
  return e instanceof OpenAI.AuthenticationError || e instanceof OpenAI.PermissionDeniedError
    || e instanceof OpenAI.BadRequestError || e instanceof OpenAI.NotFoundError
}
