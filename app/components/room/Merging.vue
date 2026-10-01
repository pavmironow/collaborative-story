<script setup lang="ts">
import type { ChapterRow, FragmentRow, PlayerRow, RoomRow } from '#shared/room'

const props = defineProps<{ room: RoomRow, players: PlayerRow[], fragments: FragmentRow[], chapters: ChapterRow[], isHost: boolean }>()

// Every client asks the server to run the merge; exactly one request runs it (the others get
// "busy"). Asking again every few seconds lets a later request take over if that one died.
let timer: ReturnType<typeof setInterval> | undefined
const ask = () => api(`/api/rooms/${props.room.code}/merge`, { method: 'POST' }).catch(() => {})
onMounted(() => {
  ask()
  timer = setInterval(ask, 5000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="space-y-6">
    <div
      class="py-16 text-center"
      role="status"
    >
      <UIcon
        name="i-lucide-sparkles"
        class="size-8 animate-pulse text-primary"
      />
      <p class="mt-3 text-lg font-semibold">
        Weaving everyone’s ideas into chapter {{ room.current_round }}…
      </p>
      <p class="mt-1 text-sm text-muted">
        This usually takes a few seconds.
      </p>
    </div>
    <RoomStorySoFar
      :theme="room.theme"
      :chapters="chapters"
      :fragments="fragments"
      :players="players"
      :before-round="room.current_round"
      collapsed
      :room="room"
      :is-host="isHost"
    />
  </div>
</template>
