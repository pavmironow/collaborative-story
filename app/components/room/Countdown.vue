<script setup lang="ts">
/** Counts down to a server deadline. Emits `expired` once when it reaches zero. */
const props = defineProps<{ endsAt: string | null, clockOffset: number }>()
const emit = defineEmits<{ expired: [] }>()

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 250)))
onBeforeUnmount(() => clearInterval(timer))

const remaining = computed(() => props.endsAt ? Math.max(0, Date.parse(props.endsAt) - (now.value + props.clockOffset)) : 0)
const seconds = computed(() => Math.ceil(remaining.value / 1000))
const label = computed(() => `${Math.floor(seconds.value / 60)}:${String(seconds.value % 60).padStart(2, '0')}`)
const urgent = computed(() => seconds.value <= 10)

let fired = false
watch(() => props.endsAt, () => (fired = false))
watch(remaining, (ms) => {
  if (ms === 0 && props.endsAt && !fired) {
    fired = true
    emit('expired')
  }
}, { immediate: true })
</script>

<template>
  <div
    class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-lg font-semibold tabular-nums"
    :class="urgent ? 'bg-error/10 text-error' : 'bg-elevated'"
    role="timer"
    :aria-label="`${seconds} seconds left`"
  >
    <UIcon
      name="i-lucide-timer"
      class="size-4"
    />
    {{ seconds === 0 ? 'Time’s up' : label }}
  </div>
</template>
