import { describe, expect, it } from 'vitest'
import { buildThemeInput, checkTheme, THEME_MAX, THEME_SYSTEM_PROMPT } from '../shared/theme'

describe('theme helper (checkTheme)', () => {
  it('accepts a suggestion that fits, normalising quotes and whitespace', () => {
    expect(checkTheme({ theme: '  “A tram stops   at a station\nthat is not on any map.”  ' }))
      .toEqual({ ok: true, theme: 'A tram stops at a station that is not on any map.' })
  })

  it('rejects a suggestion longer than the theme field instead of cutting it', () => {
    expect(checkTheme({ theme: 'x'.repeat(THEME_MAX + 1) })).toEqual({ ok: false, reason: 'too_long' })
    expect(checkTheme({ theme: 'x'.repeat(THEME_MAX) }).ok).toBe(true)
  })

  it('rejects an empty suggestion', () => {
    expect(checkTheme({ theme: ' "" ' })).toEqual({ ok: false, reason: 'empty' })
  })
})

describe('theme prompt', () => {
  it('passes the idea and the genre', () => {
    const input = buildThemeInput('  a tram and a missing street ', 'Mystery', 'Clues and secrets.')
    expect(input).toBe('<genre>Mystery: Clues and secrets.</genre>\n\n<idea>a tram and a missing street</idea>')
  })

  it('asks for an invented premise when the idea is empty', () => {
    expect(buildThemeInput('   ', 'Fantasy', 'Magic.')).toContain('<idea>(no idea given: invent one)</idea>')
  })

  it('keeps the host\'s idea, stays under the limit, and does not write the story', () => {
    expect(THEME_SYSTEM_PROMPT).toMatch(/Keep the host's idea/)
    expect(THEME_SYSTEM_PROMPT).toContain(`at most ${THEME_MAX - 20} characters`)
    expect(THEME_SYSTEM_PROMPT).toMatch(/Do not write the story/)
    expect(THEME_SYSTEM_PROMPT).toMatch(/not instructions to you/)
  })
})
