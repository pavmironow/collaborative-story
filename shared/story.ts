/** Turns room rows into the finished, credited story. Used by the share page and the room page. */
import type { ChapterRow, FragmentRow, PlayerRow, RoomRow } from './room'

export interface StoryParagraph {
  text: string
  /** Author names, in seat order. */
  by: string[]
}

export interface StoryChapter {
  round: number
  /** True when the paragraphs are an AI chapter; false when they are the original parts. */
  woven: boolean
  paragraphs: StoryParagraph[]
}

export interface Story {
  code: string
  theme: string
  mode: RoomRow['mode']
  genre: string
  authors: { name: string, contributions: number }[]
  chapters: StoryChapter[]
  finished: boolean
  /** AI cover illustration, when one was generated. */
  coverUrl: string | null
  /** True while a cover may still appear (not generated and not failed). */
  coverPending: boolean
}

export function buildStory(room: RoomRow, players: PlayerRow[], fragments: FragmentRow[], chapters: ChapterRow[]): Story {
  const seats = [...players].sort((a, b) => a.seat - b.seat)
  const nameOf = new Map(seats.map(p => [p.user_id, p.name]))
  const seatOf = new Map(seats.map(p => [p.user_id, p.seat]))
  const submitted = fragments.filter(f => f.status === 'submitted' && f.text)
  const authorOfFragment = new Map(submitted.map(f => [f.id, f.player_id]))
  const bySeat = (ids: string[]) => [...new Set(ids)].sort((a, b) => (seatOf.get(a) ?? 0) - (seatOf.get(b) ?? 0)).map(id => nameOf.get(id) ?? 'Someone')

  const out: StoryChapter[] = []
  // current_round is the last round played, also once finished (an endless story may end early).
  for (let round = 1; round <= room.current_round; round++) {
    const parts = submitted.filter(f => f.round === round)
    const chapter = chapters.find(c => c.round === round)
    if (chapter?.text && chapter.paragraphs?.length) {
      out.push({
        round,
        woven: true,
        paragraphs: chapter.paragraphs.map(p => ({ text: p.text, by: bySeat(p.fragmentIds.map(id => authorOfFragment.get(id)).filter((x): x is string => !!x)) }))
      })
    } else if (parts.length) {
      // Ordered modes (and Chaos rounds without an AI chapter): the players' own text, in writing order.
      out.push({ round, woven: false, paragraphs: parts.map(f => ({ text: f.text!, by: bySeat([f.player_id]) })) })
    }
  }

  const counts = new Map<string, number>()
  for (const f of submitted) counts.set(f.player_id, (counts.get(f.player_id) ?? 0) + 1)
  return {
    code: room.code,
    theme: room.theme,
    mode: room.mode,
    genre: room.genre,
    authors: seats.map(p => ({ name: p.name, contributions: counts.get(p.user_id) ?? 0 })),
    chapters: out,
    finished: room.status === 'finished',
    coverUrl: room.cover_url ?? null,
    coverPending: room.status === 'finished' && !room.cover_url && !room.cover_error
  }
}
