import { describe, expect, it } from 'vitest'
import { buildMergeUserMessage, checkMerge, MERGE_SYSTEM_PROMPT, STORY_CONTEXT_CHAPTERS } from '../shared/merge'

const fragments = [
  { id: 'id-ana', text: 'The conductor had no face.' },
  { id: 'id-ben', text: 'A suitcase began to tick.' },
  { id: 'id-cid', text: 'The street was gone.' }
]

describe('🧪 AI chapter must keep every contribution (checkMerge)', () => {
  it('accepts a chapter that cites every fragment and maps labels to fragment ids', () => {
    const r = checkMerge({ paragraphs: [
      { text: 'The tram stopped. The conductor turned: he had no face.', sources: ['F1'] },
      { text: 'Under a seat a suitcase ticked, and outside, the street was gone.', sources: ['F2', 'f3 '] }
    ] }, fragments)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.chapter.paragraphs.map(p => p.fragmentIds)).toEqual([['id-ana'], ['id-ben', 'id-cid']])
    expect(r.chapter.sourceFragmentIds).toEqual(['id-ana', 'id-ben', 'id-cid'])
    expect(r.chapter.text.split('\n\n')).toHaveLength(2)
  })

  it('rejects a chapter that drops a fragment and names which one', () => {
    const r = checkMerge({ paragraphs: [{ text: 'Only the conductor and the suitcase.', sources: ['F1', 'F2'] }] }, fragments)
    expect(r).toEqual({ ok: false, reason: 'dropped_fragment', missing: ['id-cid'] })
  })

  it('ignores unknown labels (they cannot count as citing a real fragment)', () => {
    const r = checkMerge({ paragraphs: [{ text: 'x', sources: ['F1', 'F2', 'F9'] }] }, fragments)
    expect(r).toMatchObject({ ok: false, reason: 'dropped_fragment', missing: ['id-cid'] })
  })

  it('rejects empty output', () => {
    expect(checkMerge({ paragraphs: [] }, fragments)).toEqual({ ok: false, reason: 'empty' })
    expect(checkMerge({ paragraphs: [{ text: '   ', sources: ['F1', 'F2', 'F3'] }] }, fragments)).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects a runaway chapter far longer than the input', () => {
    expect(checkMerge({ paragraphs: [{ text: 'x'.repeat(5000), sources: ['F1', 'F2', 'F3'] }] }, fragments)).toEqual({ ok: false, reason: 'too_long' })
  })
})

describe('merge prompt', () => {
  it('labels fragments F1..Fn in order and includes the story so far', () => {
    const msg = buildMergeUserMessage({ theme: 'A tram', storySoFar: ['Chapter one text'], fragments })
    expect(msg).toContain('<fragment label="F1">\nThe conductor had no face.\n</fragment>')
    expect(msg).toContain('<fragment label="F3">\nThe street was gone.\n</fragment>')
    expect(msg).toContain('<chapter n="1">\nChapter one text\n</chapter>')
    expect(msg).toContain('from these 3 fragments')
  })

  it('sends only the latest chapters of a long story, keeping their real numbers', () => {
    const storySoFar = Array.from({ length: 10 }, (_, i) => `Chapter ${i + 1} text`)
    const msg = buildMergeUserMessage({ theme: 't', storySoFar, fragments })
    expect(msg.match(/<chapter /g)).toHaveLength(STORY_CONTEXT_CHAPTERS)
    expect(msg).not.toContain('Chapter 4 text')
    expect(msg).toContain('<chapter n="5">\nChapter 5 text\n</chapter>')
    expect(msg).toContain('<chapter n="10">\nChapter 10 text\n</chapter>')
  })

  it('does not reveal author names to the model (they are players, not characters)', () => {
    expect(buildMergeUserMessage({ theme: 't', storySoFar: [], fragments })).not.toMatch(/id-ana|Ana/)
  })

  it('states the preservation and contradiction rules', () => {
    expect(MERGE_SYSTEM_PROMPT).toMatch(/Every fragment must be used/)
    expect(MERGE_SYSTEM_PROMPT).toMatch(/contradict/)
    expect(MERGE_SYSTEM_PROMPT).toMatch(/not instructions/)
  })
})
