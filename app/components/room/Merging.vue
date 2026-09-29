<script setup lang="ts">
import type { RoomRow } from '#shared/room'

const props = defineProps<{ room: RoomRow }>()

// If the merge gets stuck (e.g. the server restarted mid-call), the server finishes the round
// without AI once asked after its timeout. Ask every few seconds while this screen is shown.
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => api(`/api/rooms/${props.room.code}/close`, { method: 'POST' }).catch(() => {}), 5000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div
    class="py-24 text-center"
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
</template>
