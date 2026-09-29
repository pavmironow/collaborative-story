<script setup lang="ts">
import type { ChapterRow, FragmentRow, PlayerRow } from '#shared/room'

/** The accepted story up to (not including) `beforeRound`: AI chapters where they exist, otherwise the original fragments. */
const props = defineProps<{ theme: string, chapters: ChapterRow[], fragments: FragmentRow[], players: PlayerRow[], beforeRound: number }>()

const names = computed(() => new Map(props.players.map(p => [p.user_id, p.name])))
const rounds = computed(() => Array.from({ length: Math.max(0, props.beforeRound - 1) }, (_, i) => i + 1).map((round) => {
  const chapter = props.chapters.find(c => c.round === round)
  const parts = props.fragments.filter(f => f.round === round && f.status === 'submitted')
  return { round, text: chapter?.text ?? null, parts }
}))
</script>

<template>
  <section
    aria-labelledby="story-so-far"
    class="rounded-lg border border-default bg-elevated/50 p-4"
  >
    <h2
      id="story-so-far"
      class="text-sm font-semibold text-muted"
    >
      {{ rounds.length ? 'The story so far' : 'The theme' }}
    </h2>
    <p class="mt-2 italic">
      “{{ theme }}”
    </p>
    <div
      v-for="r in rounds"
      :key="r.round"
      class="mt-4"
    >
      <h3 class="text-xs font-semibold tracking-wide text-muted uppercase">
        Chapter {{ r.round }}
      </h3>
      <p
        v-if="r.text"
        class="mt-1 whitespace-pre-line"
      >
        {{ r.text }}
      </p>
      <template v-else>
        <p
          v-for="f in r.parts"
          :key="f.id"
          class="mt-1"
        >
          {{ f.text }} <span class="text-xs text-muted">— {{ names.get(f.player_id) }}</span>
        </p>
        <p
          v-if="!r.parts.length"
          class="mt-1 text-sm text-muted"
        >
          Nobody wrote in this round.
        </p>
      </template>
    </div>
  </section>
</template>
