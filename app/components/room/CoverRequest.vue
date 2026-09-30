<script setup lang="ts">
/**
 * Asks the server to paint the cover once the story is finished. Every writer's device asks;
 * exactly one request paints it. The room updates live when the cover is ready.
 */
const props = defineProps<{ code: string }>()

let timer: ReturnType<typeof setInterval> | undefined
const ask = () => api(`/api/rooms/${props.code}/cover`, { method: 'POST' }).catch(() => {})
onMounted(() => {
  ask()
  timer = setInterval(ask, 15000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <span class="hidden" />
</template>
