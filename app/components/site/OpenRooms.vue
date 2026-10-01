<script setup lang="ts">
import type { OpenRoom } from '#shared/open-rooms'
import { MODE_LABELS } from '#shared/room'
import { getGenre } from '#shared/genres'

// Rendered on the server for the first paint, then refreshed while the page is open.
const { data: rooms, status, refresh } = await useFetch<OpenRoom[]>('/api/rooms/open', { default: () => [] })

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') refresh()
  }, 10_000)
})
onBeforeUnmount(() => clearInterval(timer))

const summary = (r: OpenRoom) => [
  getGenre(r.genre).label,
  r.mode === 'chaos' ? null : MODE_LABELS[r.mode].label,
  r.endless ? 'Endless' : `${r.roundsTotal} rounds`,
  `${r.players}/${r.maxPlayers} writers`
].filter(Boolean).join(' · ')
</script>

<template>
  <section
    id="open-rooms"
    aria-labelledby="open-rooms-title"
    class="scroll-mt-20"
  >
    <h2
      id="open-rooms-title"
      class="text-2xl font-bold"
    >
      Open rooms <span class="font-sans text-base font-normal text-muted">· join a game now</span>
    </h2>

    <ul
      v-if="rooms.length"
      class="mt-3 space-y-3"
    >
      <li
        v-for="r in rooms"
        :key="r.code"
        class="ink-card flex items-center gap-3 bg-default p-3"
      >
        <span
          class="text-2xl"
          aria-hidden="true"
        >{{ getGenre(r.genre).emoji }}</span>
        <div class="min-w-0 flex-1">
          <p class="line-clamp-2 font-bold">
            {{ r.theme }}
          </p>
          <p class="text-sm text-muted">
            {{ summary(r) }}
          </p>
        </div>
        <UButton
          :to="`/r/${r.code}`"
          size="sm"
          :aria-label="`Join “${r.theme}”`"
        >
          Join
        </UButton>
      </li>
    </ul>

    <div
      v-else
      class="ink-card mt-3 bg-sky-50 p-5 dark:bg-elevated"
      :aria-busy="status === 'pending'"
    >
      <p class="font-bold">
        No open rooms right now.
      </p>
      <p class="mt-1 text-muted">
        Create one and make it public, or invite friends with a link.
      </p>
    </div>
  </section>
</template>
