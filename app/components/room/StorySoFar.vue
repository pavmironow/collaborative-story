<script setup lang="ts">
import type { ChapterRow, FragmentRow, PlayerRow, RoomRow } from '#shared/room'

/** The accepted story up to (not including) `beforeRound`: AI chapters where they exist, otherwise the original fragments. */
const props = defineProps<{ theme: string, chapters: ChapterRow[], fragments: FragmentRow[], players: PlayerRow[], beforeRound: number, collapsed?: boolean, room?: RoomRow, isHost?: boolean }>()

/** Long (endless) stories show only the latest chapters until the reader asks for all of them. */
const RECENT = 2

const names = computed(() => new Map(props.players.map(p => [p.user_id, p.name])))
const rounds = computed(() => Array.from({ length: Math.max(0, props.beforeRound - 1) }, (_, i) => i + 1).map((round) => {
  const chapter = props.chapters.find(c => c.round === round)
  const parts = props.fragments.filter(f => f.round === round && f.status === 'submitted')
  return { round, text: chapter?.text ?? null, chapter, parts }
}))
const open = ref(!props.collapsed)
const showAll = ref(false)
const visible = computed(() => showAll.value ? rounds.value : rounds.value.slice(-RECENT))
const heading = computed(() => {
  const n = rounds.value.length
  if (!n) return 'The theme'
  return n === 1 ? 'The story so far · chapter 1' : `The story so far · chapters 1–${n}`
})
</script>

<template>
  <section
    aria-labelledby="story-so-far"
    class="ink-card bg-sky-50 p-4 dark:bg-elevated"
  >
    <h2
      id="story-so-far"
      class="text-sm font-semibold text-muted"
    >
      <button
        v-if="collapsed"
        type="button"
        class="flex w-full items-center gap-1.5 text-left"
        :aria-expanded="open"
        aria-controls="story-so-far-body"
        @click="open = !open"
      >
        <UIcon :name="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" />
        {{ heading }}
      </button>
      <template v-else>
        {{ heading }}
      </template>
    </h2>
    <div
      v-show="open"
      id="story-so-far-body"
    >
      <p class="mt-2 italic">
        “{{ theme }}”
      </p>
      <UButton
        v-if="rounds.length > RECENT && !showAll"
        variant="link"
        size="sm"
        class="mt-2 px-0"
        @click="showAll = true"
      >
        Show all {{ rounds.length }} chapters
      </UButton>
      <div
        v-for="r in visible"
        :key="r.round"
        class="mt-4"
      >
        <h3 class="text-xs font-semibold tracking-wide text-muted uppercase">
          Chapter {{ r.round }}
        </h3>
        <RoomChapterTools
          v-if="room && r.chapter"
          :room="room"
          :chapter="r.chapter"
          :fragments="fragments"
          :is-host="!!isHost"
          class="mt-1"
        />
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
    </div>
  </section>
</template>
