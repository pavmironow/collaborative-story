<script setup lang="ts">
const steps = [
  { icon: 'i-lucide-sparkles', title: 'Create', text: 'Pick a genre and a theme, then share the link or the room code.' },
  { icon: 'i-lucide-pen-line', title: 'Write', text: 'Short timed rounds. Everyone writes at once, nobody sees the others’ drafts.' },
  { icon: 'i-lucide-book-open', title: 'Read', text: 'AI weaves the parts into one chapter. Share the finished story.' }
]
</script>

<template>
  <UContainer class="py-10 sm:py-16">
    <section class="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
      <div>
        <h1 class="text-4xl leading-tight font-bold sm:text-5xl">
          Write a story <span class="ink-mark">together</span>, one round at a time.
        </h1>
        <p class="mt-4 max-w-prose text-lg text-muted">
          Everyone writes at once. Nobody sees the others’ drafts. Then the parts are woven into one chapter, and the story grows round by round.
        </p>
        <div class="mt-8 max-w-md space-y-4">
          <UButton
            to="/new"
            size="xl"
            icon="i-lucide-sparkles"
          >
            Create a room
          </UButton>
          <SiteJoinByCode />
        </div>
      </div>

      <div class="space-y-8">
        <SiteOpenRooms />

        <figure class="ink-card bg-sky-50 p-6 dark:bg-elevated">
          <figcaption class="text-xs font-bold tracking-wide text-muted uppercase">
            From a story written by Ana, Ben &amp; Cid
          </figcaption>
          <blockquote class="mt-3 space-y-3 text-lg leading-relaxed">
            <p>The keeper found a second staircase, one that only went down. It was warm, as if someone had just walked it.</p>
            <p>At the bottom waited a door with her own name carved into it, in handwriting she did not recognise.</p>
          </blockquote>
          <p class="mt-3 text-sm text-muted">
            🐉 Fantasy · Chaos Mode · 3 writers
          </p>
        </figure>
      </div>
    </section>

    <section
      aria-labelledby="how-it-works"
      class="mt-16"
    >
      <h2
        id="how-it-works"
        class="text-2xl font-bold"
      >
        How it works
      </h2>
      <ol class="mt-4 grid gap-4 sm:grid-cols-3">
        <li
          v-for="(step, i) in steps"
          :key="step.title"
          class="ink-card bg-default p-4"
        >
          <p class="flex items-center gap-2 font-display text-lg font-bold">
            <UIcon
              :name="step.icon"
              class="text-primary"
            />
            {{ i + 1 }} · {{ step.title }}
          </p>
          <p class="mt-1 text-muted">
            {{ step.text }}
          </p>
        </li>
      </ol>
      <UButton
        to="/how-to-play"
        variant="link"
        trailing-icon="i-lucide-arrow-right"
        class="mt-3 px-0"
      >
        Full rules
      </UButton>
    </section>
  </UContainer>
</template>
