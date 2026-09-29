/** Server clock, so clients can correct for a skewed phone clock when counting down. */
export default defineEventHandler(() => ({ now: Date.now() }))
