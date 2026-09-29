/** Pure part of the cover illustration: the image prompt. */
export const COVER_EXCERPT_MAX = 600

export function buildCoverPrompt(theme: string, look: string, storyText: string): string {
  const excerpt = storyText.replace(/\s+/g, ' ').trim().slice(0, COVER_EXCERPT_MAX)
  return [
    `Book cover illustration for a short story. Style: ${look}.`,
    `Premise: ${theme.trim()}`,
    excerpt ? `Scene inspiration from the story: ${excerpt}` : '',
    'One striking scene, strong composition, suitable for all ages.',
    'No text, no letters, no title, no words, no watermark anywhere in the image.'
  ].filter(Boolean).join('\n')
}
