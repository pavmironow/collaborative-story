<script setup lang="ts">
import { LIMITS } from '#shared/game'

useSeoMeta({ title: 'How to play · Collaborative Story' })

const sections = [
  {
    icon: 'i-lucide-sparkles',
    title: 'Start a room',
    body: [
      'The host picks a genre and a theme: the opening idea everyone writes from. The AI helper can turn a rough idea into a premise.',
      `Share the link or the 5-letter room code. ${LIMITS.players.min} to ${LIMITS.players.max} writers can join while the room is in the lobby. Once the host starts, the writers and the rules are locked.`
    ]
  },
  {
    icon: 'i-lucide-door-open',
    title: 'Public and private rooms',
    body: [
      'A private room (the default) can only be joined with its link or code.',
      'A public room is listed under Open rooms on the homepage while it waits in the lobby, so anyone can join. Its theme is visible to everyone. Once the story starts, it disappears from the list.'
    ]
  },
  {
    icon: 'i-lucide-zap',
    title: 'Chaos Mode',
    body: [
      'Every round, everyone writes their part at the same time, against the timer. Nobody can read the others’ drafts until the round closes.',
      'When everyone has sent their part, or the time is up, the AI weaves all the parts into one chapter. It must keep every player’s idea. If the AI is unavailable, the chapter is shown as the original parts and the game goes on.',
      'Fixed and random turn order are coming soon.'
    ]
  },
  {
    icon: 'i-lucide-timer',
    title: 'Rounds, timer and skips',
    body: [
      `A story has ${LIMITS.rounds.min} to ${LIMITS.rounds.max} rounds. Each part has a character limit; longer text is never cut, you are asked to shorten it.`,
      'Miss the timer and your part for that round is skipped. Nobody writes for you, and you play the next round as usual.'
    ]
  },
  {
    icon: 'i-lucide-infinity',
    title: 'Endless stories',
    body: [
      `In an endless room the rounds keep coming until the host presses “End story” between rounds (at most ${LIMITS.endlessRounds} rounds).`
    ]
  },
  {
    icon: 'i-lucide-wand-sparkles',
    title: 'Revising chapters',
    body: [
      'The host can revise any revealed chapter while the room is open, even after the story has finished: ask the AI for a change, or edit the text by hand.',
      'Every version is kept, and anyone can open a chapter’s history. The players’ original parts never change.'
    ]
  },
  {
    icon: 'i-lucide-book-open',
    title: 'The finished story',
    body: [
      'Every finished story has its own page with the full text and its authors. Anyone with the link can read it, no sign-up needed. The AI may also paint a cover.',
      'Your stories are listed under My stories in this browser.'
    ]
  }
]
</script>

<template>
  <UContainer class="max-w-2xl py-10 sm:py-14">
    <h1 class="text-4xl font-bold">
      How to play
    </h1>
    <p class="mt-3 text-lg text-muted">
      A story game for 2 to 10 friends. No accounts: pick a name and write.
    </p>

    <div class="mt-8 space-y-5">
      <section
        v-for="s in sections"
        :key="s.title"
        class="ink-card bg-default p-5"
        :aria-labelledby="`rule-${s.icon}`"
      >
        <h2
          :id="`rule-${s.icon}`"
          class="flex items-center gap-2 text-xl font-bold"
        >
          <UIcon
            :name="s.icon"
            class="text-primary"
          />
          {{ s.title }}
        </h2>
        <p
          v-for="(p, i) in s.body"
          :key="i"
          class="mt-2"
        >
          {{ p }}
        </p>
      </section>
    </div>

    <UButton
      to="/new"
      size="xl"
      icon="i-lucide-sparkles"
      class="mt-8"
    >
      Create a room
    </UButton>
  </UContainer>
</template>
