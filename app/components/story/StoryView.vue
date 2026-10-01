<script setup lang="ts">
import type { Story } from '#shared/story'
import { getGenre } from '#shared/genres'

const props = defineProps<{ story: Story }>()

// AI-improved themes can be 2–3 sentences: keep them readable as a title on a phone.
const titleClass = computed(() => props.story.theme.length > 120
  ? 'text-xl sm:text-2xl'
  : props.story.theme.length > 60 ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl')
</script>

<template>
  <article class="space-y-8">
    <figure
      v-if="story.coverUrl"
      class="-mx-4 overflow-hidden sm:mx-0 sm:rounded-xl"
    >
      <img
        :src="story.coverUrl"
        :alt="`AI illustration for “${story.theme}”`"
        width="1536"
        height="1024"
        class="aspect-[3/2] w-full object-cover"
      >
    </figure>
    <div
      v-else-if="story.coverPending"
      class="-mx-4 flex aspect-[3/2] items-center justify-center bg-elevated sm:mx-0 sm:rounded-xl"
      role="status"
    >
      <p class="flex items-center gap-2 text-muted">
        <UIcon
          name="i-lucide-palette"
          class="size-5 animate-pulse"
        />
        Painting the cover…
      </p>
    </div>

    <header>
      <p class="text-sm font-medium text-primary">
        {{ getGenre(story.genre).emoji }} {{ getGenre(story.genre).label }} · a story written together
      </p>
      <h1
        class="mt-1 font-display leading-tight font-bold text-balance"
        :class="titleClass"
      >
        {{ story.theme }}
      </h1>
      <p class="mt-3 text-muted">
        by {{ story.authors.map(a => a.name).join(', ') }}
      </p>
    </header>

    <section
      v-for="chapter in story.chapters"
      :key="chapter.round"
      :aria-labelledby="`chapter-${chapter.round}`"
    >
      <h2
        :id="`chapter-${chapter.round}`"
        class="text-xs font-semibold tracking-wide text-muted uppercase"
      >
        Chapter {{ chapter.round }}
      </h2>
      <slot
        name="chapter"
        :round="chapter.round"
      />
      <div class="mt-3 space-y-5">
        <div
          v-for="(p, i) in chapter.paragraphs"
          :key="i"
        >
          <p class="text-lg leading-relaxed sm:text-xl">
            {{ p.text }}
          </p>
          <p class="mt-1 text-xs text-muted">
            {{ chapter.woven ? 'from' : '—' }} {{ p.by.join(', ') }}
          </p>
        </div>
      </div>
    </section>

    <p
      v-if="!story.chapters.length"
      class="text-muted"
    >
      Nobody wrote anything in this story.
    </p>

    <footer class="border-t border-default pt-6">
      <h2 class="font-semibold">
        Writers
      </h2>
      <ul class="mt-2 flex flex-wrap gap-2">
        <li
          v-for="a in story.authors"
          :key="a.name"
        >
          <UBadge
            variant="subtle"
            color="neutral"
          >
            {{ a.name }} · {{ a.contributions }} {{ a.contributions === 1 ? 'part' : 'parts' }}
          </UBadge>
        </li>
      </ul>
      <p
        v-if="story.mode === 'chaos'"
        class="mt-3 text-xs text-muted"
      >
        Chaos Mode: everyone wrote each round at the same time, and AI wove the parts together.
      </p>
    </footer>
  </article>
</template>
