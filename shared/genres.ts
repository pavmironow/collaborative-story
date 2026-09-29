/**
 * Story genres: classic ones plus "fun moods" for a party-game feel. `tone` steers every AI text
 * feature (theme helper, chapter merge); `look` steers the cover illustration.
 */
export interface Genre {
  id: string
  label: string
  emoji: string
  kind: 'classic' | 'fun'
  tone: string
  look: string
}

export const GENRES = [
  { id: 'fantasy', label: 'Fantasy', emoji: '🐉', kind: 'classic', tone: 'Epic fantasy: magic, strange creatures, a sense of wonder and old legends.', look: 'painterly fantasy book cover, rich colours, soft magical light' },
  { id: 'scifi', label: 'Sci-fi', emoji: '🚀', kind: 'classic', tone: 'Science fiction: future technology, space or strange science, curious and a little eerie.', look: 'retro-futuristic sci-fi paperback cover, bold shapes, neon accents' },
  { id: 'mystery', label: 'Mystery', emoji: '🔍', kind: 'classic', tone: 'Mystery: clues, secrets and suspicious characters; build tension and leave questions open.', look: 'moody mystery novel cover, deep shadows, a single spot of warm light' },
  { id: 'horror', label: 'Spooky', emoji: '👻', kind: 'classic', tone: 'Spooky, eerie horror that stays party-friendly: creepy atmosphere, no gore.', look: 'eerie vintage horror cover, fog, muted greens and purples, nothing gory' },
  { id: 'romance', label: 'Romance', emoji: '💘', kind: 'classic', tone: 'Romance: longing glances, misunderstandings and big feelings; warm and a little dramatic.', look: 'romantic watercolour cover, warm pinks and golds, dreamy light' },
  { id: 'adventure', label: 'Adventure', emoji: '🗺️', kind: 'classic', tone: 'Adventure: journeys, danger and daring escapes; fast-paced and bold.', look: 'classic adventure illustration, bright daylight, dynamic composition' },
  { id: 'absurd', label: 'Absurd comedy', emoji: '🤪', kind: 'fun', tone: 'Absurd comedy: treat ridiculous events with total seriousness; escalate the silliness with deadpan narration.', look: 'playful surreal cartoon, saturated colours, exaggerated proportions' },
  { id: 'musical', label: 'Everything is a musical', emoji: '🎤', kind: 'fun', tone: 'A musical: characters regularly burst into short rhyming song lines about what is happening; theatrical and upbeat.', look: 'Broadway musical poster, spotlights, sparkles, theatrical poses' },
  { id: 'cats', label: 'Cats are in charge', emoji: '🐈', kind: 'fun', tone: 'The world is secretly run by cats: cats make the important decisions, humans are mostly staff; smug feline logic everywhere.', look: 'whimsical storybook illustration of dignified cats in charge, cosy colours' },
  { id: 'bedtime', label: 'Kids\' bedtime story', emoji: '🌙', kind: 'fun', tone: 'A gentle kids\' bedtime story: simple words, kind characters, soft humour and a cosy mood.', look: 'soft pastel children\'s picture book illustration, gentle night-time glow' },
  { id: 'soap', label: 'Soap opera drama', emoji: '🎭', kind: 'fun', tone: 'Over-the-top soap opera: shocking revelations, secret twins, dramatic pauses and gasps.', look: 'glossy melodramatic TV soap poster, dramatic lighting, intense stares' },
  { id: 'documentary', label: 'Nature documentary', emoji: '🎙️', kind: 'fun', tone: 'Narrated like a hushed wildlife documentary: describe everyone as fascinating creatures in their natural habitat.', look: 'wildlife documentary still, golden-hour light, telephoto look' }
] as const satisfies readonly Genre[]

export type GenreId = typeof GENRES[number]['id']
export const SURPRISE = 'surprise'
export const GENRE_IDS = GENRES.map(g => g.id) as [GenreId, ...GenreId[]]
export const DEFAULT_GENRE: GenreId = 'adventure'

export function getGenre(id: string): Genre {
  return GENRES.find(g => g.id === id) ?? GENRES.find(g => g.id === DEFAULT_GENRE)!
}

/** "Surprise me" becomes a concrete genre when the room is created, so everyone sees the same one. */
export function resolveGenre(choice: string, random: () => number = Math.random): GenreId {
  if (choice !== SURPRISE) return getGenre(choice).id as GenreId
  return GENRES[Math.floor(random() * GENRES.length) % GENRES.length]!.id
}
