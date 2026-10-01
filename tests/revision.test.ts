import { describe, expect, it } from 'vitest'
import { storySoFar } from '../shared/merge'
import {
  buildReviseUserMessage, canRevise, currentChapterText, isEdited, manualParagraphs, REVISE_SYSTEM_PROMPT,
  REVISION_LIMITS, reviseRequestSchema, versionLabel
} from '../shared/revision'

describe('what the host may send', () => {
  it('accepts an AI request, a hand edit and a restore, each with the version it was based on', () => {
    expect(reviseRequestSchema.safeParse({ kind: 'ai', instruction: 'Make it funnier', baseVersion: 1 }).success).toBe(true)
    expect(reviseRequestSchema.safeParse({ kind: 'manual', text: 'New text', baseVersion: 0 }).success).toBe(true)
    expect(reviseRequestSchema.safeParse({ kind: 'restore', version: 1, baseVersion: 3 }).success).toBe(true)
  })

  it.each([
    ['a missing base version', { kind: 'ai', instruction: 'Make it funnier' }],
    ['a too-short request', { kind: 'ai', instruction: 'ok', baseVersion: 1 }],
    ['a too-long request', { kind: 'ai', instruction: 'x'.repeat(REVISION_LIMITS.instruction.max + 1), baseVersion: 1 }],
    ['an empty chapter', { kind: 'manual', text: '   ', baseVersion: 1 }],
    ['a too-long chapter', { kind: 'manual', text: 'x'.repeat(REVISION_LIMITS.text.max + 1), baseVersion: 1 }],
    ['restoring version 0', { kind: 'restore', version: 0, baseVersion: 1 }],
    ['an unknown kind', { kind: 'delete', baseVersion: 1 }]
  ])('rejects %s', (_, body) => {
    expect(reviseRequestSchema.safeParse(body).success).toBe(false)
  })
})

describe('when a chapter can be revised', () => {
  const chapter = (round: number) => ({ round })

  it('any earlier chapter, in every phase of a running game', () => {
    for (const status of ['writing', 'merging', 'reveal'] as const) {
      expect(canRevise({ status, current_round: 4 }, chapter(2), 3).ok).toBe(true)
    }
  })

  it('the current chapter once it is revealed, and every chapter after the story has finished', () => {
    expect(canRevise({ status: 'reveal', current_round: 4 }, chapter(4), 3).ok).toBe(true)
    expect(canRevise({ status: 'finished', current_round: 4 }, chapter(4), 3).ok).toBe(true)
  })

  it('never a chapter that is still being written or merged', () => {
    expect(canRevise({ status: 'writing', current_round: 4 }, chapter(4), 3).ok).toBe(false)
    expect(canRevise({ status: 'merging', current_round: 4 }, chapter(4), 3).ok).toBe(false)
    expect(canRevise({ status: 'writing', current_round: 4 }, null, 0).ok).toBe(false)
  })

  it('never a round where nobody wrote', () => {
    expect(canRevise({ status: 'finished', current_round: 4 }, chapter(2), 0)).toEqual({ ok: false, reason: expect.stringMatching(/Nobody wrote/) })
  })
})

describe('🧪 a hand edit keeps every author credited', () => {
  it('splits on blank lines and credits everyone who wrote in the round on each paragraph', () => {
    expect(manualParagraphs('One.\n\n  Two.\n \nThree.\n', ['f1', 'f2'])).toEqual([
      { text: 'One.', fragmentIds: ['f1', 'f2'] },
      { text: 'Two.', fragmentIds: ['f1', 'f2'] },
      { text: 'Three.', fragmentIds: ['f1', 'f2'] }
    ])
  })

  it('starts from the original parts when the AI merge had failed', () => {
    expect(currentChapterText({ text: null }, [{ text: 'A.' }, { text: 'B.' }])).toBe('A.\n\nB.')
    expect(currentChapterText({ text: 'Woven.' }, [{ text: 'A.' }])).toBe('Woven.')
  })
})

describe('versions', () => {
  it('counts as edited only once the host has changed it', () => {
    expect(isEdited({ version: 1, error: null })).toBe(false) // the AI merge
    expect(isEdited({ version: 2, error: null })).toBe(true)
    expect(isEdited({ version: 0, error: 'timeout' })).toBe(false) // failed merge, untouched
    expect(isEdited({ version: 1, error: 'timeout' })).toBe(true) // failed merge, then edited
  })

  it.each([
    [{ kind: 'merge', instruction: null, restored_from: null }, 'Original AI chapter'],
    [{ kind: 'ai_edit', instruction: 'Funnier', restored_from: null }, 'AI: “Funnier”'],
    [{ kind: 'manual', instruction: null, restored_from: null }, 'Edited by hand'],
    [{ kind: 'restore', instruction: null, restored_from: 2 }, 'Restored version 2']
  ] as const)('labels %o as %s', (v, label) => {
    expect(versionLabel(v)).toBe(label)
  })
})

describe('AI rewrite prompt', () => {
  const fragments = [{ id: 'id-ana', text: 'The conductor had no face.' }, { id: 'id-ben', text: 'A suitcase ticked.' }]
  const msg = buildReviseUserMessage({ theme: 'A tram', storySoFar: ['Earlier.'], fragments, currentChapter: 'Woven chapter.', instruction: 'Make it scarier' })

  it('includes the current chapter, the labelled fragments and the request', () => {
    expect(msg).toContain('<current_chapter>\nWoven chapter.\n</current_chapter>')
    expect(msg).toContain('<fragment label="F2">\nA suitcase ticked.\n</fragment>')
    expect(msg).toContain('<request>Make it scarier</request>')
    expect(msg).toContain('<chapter n="1">\nEarlier.\n</chapter>')
    expect(msg).not.toMatch(/id-ana|id-ben/)
  })

  it('keeps the preservation rule: every fragment must still be used', () => {
    expect(REVISE_SYSTEM_PROMPT).toMatch(/Every fragment .* must still be used/)
    expect(REVISE_SYSTEM_PROMPT).toMatch(/not instructions/)
  })
})

describe('story so far for prompts', () => {
  it('uses the current chapter text, or the original parts when a round has none', () => {
    const chapters = [{ round: 1, text: 'Chapter one, edited.' }, { round: 2, text: null }]
    const fragments = [
      { round: 2, text: 'A.', status: 'submitted' }, { round: 2, text: null, status: 'skipped' },
      { round: 2, text: 'B.', status: 'submitted' }, { round: 3, text: 'Later.', status: 'submitted' }
    ]
    expect(storySoFar(chapters, fragments, 3)).toEqual(['Chapter one, edited.', 'A.\nB.'])
  })
})
