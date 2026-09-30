import { getGenre } from '#shared/genres'
import { buildCoverPrompt } from '#shared/cover'
import type { ChapterRow, FragmentRow, RoomRow } from '#shared/room'
import { buildStory } from '#shared/story'

/** A claimed cover that has not finished after this long is considered dead and can be retried. */
export const COVER_STUCK_MS = 90_000

/**
 * Generates the cover once per finished room. Exactly one request claims it; a failure is stored
 * (not retried forever), a dead claim can be taken over. Runs inside the calling request.
 */
export async function claimCover(room: RoomRow): Promise<'done' | 'busy' | 'failed' | 'exists' | 'not_finished'> {
  if (room.status !== 'finished') return 'not_finished'
  if (room.cover_url) return 'exists'
  if (room.cover_error) return 'failed'
  const db = useSupabaseAdmin()
  const stale = new Date(Date.now() - COVER_STUCK_MS).toISOString()
  const { data } = await db.from('rooms').update({ cover_started_at: new Date().toISOString() })
    .eq('id', room.id).eq('status', 'finished').is('cover_url', null).is('cover_error', null)
    .or(`cover_started_at.is.null,cover_started_at.lt.${stale}`)
    .select('id')
  if (!data?.length) return 'busy'

  const result = await generateCover(room)
  await db.from('rooms').update(result.ok ? { cover_url: result.url } : { cover_error: result.error }).eq('id', room.id)
  return result.ok ? 'done' : 'failed'
}

async function generateCover(room: RoomRow): Promise<{ ok: true, url: string } | { ok: false, error: string }> {
  const api = useOpenAI()
  if (!api) return { ok: false, error: 'no_api_key' }
  const db = useSupabaseAdmin()
  const { openaiImageModel, coverBudgetMs } = useRuntimeConfig()

  const [players, { data: fragments }, { data: chapters }] = await Promise.all([
    loadPlayers(room.id),
    db.from('fragments').select('*').eq('room_id', room.id),
    db.from('chapters').select('*').eq('room_id', room.id)
  ])
  const story = buildStory(room, players, (fragments ?? []) as FragmentRow[], (chapters ?? []) as ChapterRow[])
  const text = story.chapters.flatMap(c => c.paragraphs.map(p => p.text)).join(' ')
  const prompt = buildCoverPrompt(room.theme, getGenre(room.genre).look, text)

  try {
    const image = await api.images.generate({
      model: openaiImageModel,
      prompt,
      size: '1536x1024',
      quality: 'low',
      output_format: 'webp',
      output_compression: 80,
      n: 1
    }, { timeout: Number(coverBudgetMs) })
    const b64 = image.data?.[0]?.b64_json
    if (!b64) return { ok: false, error: 'no_image' }

    const path = `${room.id}.webp`
    const { error } = await db.storage.from('covers').upload(path, Buffer.from(b64, 'base64'), { contentType: 'image/webp', upsert: true })
    if (error) {
      console.warn('[cover] storage upload failed:', error.message)
      return { ok: false, error: 'storage' }
    }
    return { ok: true, url: db.storage.from('covers').getPublicUrl(path).data.publicUrl }
  } catch (e) {
    console.warn('[cover] failed', e)
    return { ok: false, error: openaiErrorCode(e) }
  }
}
