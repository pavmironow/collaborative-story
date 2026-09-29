<script setup lang="ts">
import { checkFragment } from '#shared/game'
import type { ChapterRow, FragmentRow, PlayerRow, RoomRow } from '#shared/room'

const props = defineProps<{
  room: RoomRow
  players: PlayerRow[]
  fragments: FragmentRow[]
  chapters: ChapterRow[]
  submitters: Set<string>
  userId: string
  clockOffset: number
}>()
const emit = defineEmits<{ submitted: [] }>()

const mine = computed(() => props.fragments.find(f => f.round === props.room.current_round && f.player_id === props.userId && f.status === 'submitted'))
const done = computed(() => !!mine.value || props.submitters.has(props.userId))
const doneCount = computed(() => props.players.filter(p => props.submitters.has(p.user_id)).length)

const text = ref('')
const length = computed(() => text.value.trim().length)
const over = computed(() => length.value > props.room.char_limit)
const canSubmit = computed(() => checkFragment(text.value, props.room.char_limit).ok)
const submitting = ref(false)
const error = ref('')

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  error.value = ''
  try {
    await api(`/api/rooms/${props.room.code}/submit`, { method: 'POST', body: { text: text.value } })
    emit('submitted')
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage ?? 'Could not send your text. Check your connection and try again.'
  } finally {
    submitting.value = false
  }
}

// When the timer ends, ask the server to close the round. It refuses until the grace
// period is over, so keep asking until the room moves on (this component then unmounts).
const timeUp = ref(false)
let closer: ReturnType<typeof setInterval> | undefined
function onExpired() {
  timeUp.value = true
  const ask = () => api(`/api/rooms/${props.room.code}/close`, { method: 'POST' }).catch(() => {})
  ask()
  closer = setInterval(ask, 1500)
}
onBeforeUnmount(() => clearInterval(closer))
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-sm font-medium text-primary">
          Chaos Mode · everyone writes at once
        </p>
        <h1 class="text-2xl font-bold">
          Round {{ room.current_round }} of {{ room.rounds_total }}
        </h1>
      </div>
      <RoomCountdown
        :ends-at="room.phase_ends_at"
        :clock-offset="clockOffset"
        @expired="onExpired"
      />
    </div>

    <RoomStorySoFar
      :theme="room.theme"
      :chapters="chapters"
      :fragments="fragments"
      :players="players"
      :before-round="room.current_round"
    />

    <section
      v-if="done"
      aria-labelledby="your-part"
      class="rounded-lg border border-success/40 bg-success/5 p-4"
    >
      <h2
        id="your-part"
        class="flex items-center gap-2 font-semibold text-success"
      >
        <UIcon name="i-lucide-check-circle" /> Your part is in
      </h2>
      <p
        v-if="mine"
        class="mt-2 whitespace-pre-line"
      >
        {{ mine.text }}
      </p>
      <p class="mt-2 text-sm text-muted">
        Hidden from the others until the round ends.
      </p>
    </section>

    <form
      v-else
      class="space-y-3"
      @submit.prevent="submit"
    >
      <UFormField
        label="Continue the story"
        :hint="`${length}/${room.char_limit}`"
        :error="over ? `Too long by ${length - room.char_limit} character${length - room.char_limit === 1 ? '' : 's'}` : undefined"
        help="Nobody sees your text until the round ends."
      >
        <UTextarea
          v-model="text"
          :rows="5"
          autoresize
          :disabled="timeUp"
          placeholder="What happens next?"
          class="w-full"
        />
      </UFormField>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="error"
      />
      <UButton
        type="submit"
        size="xl"
        block
        :disabled="!canSubmit || timeUp"
        :loading="submitting"
        icon="i-lucide-send"
      >
        Submit my part
      </UButton>
    </form>

    <section aria-labelledby="progress">
      <h2
        id="progress"
        class="font-semibold"
        aria-live="polite"
      >
        {{ timeUp ? 'Time’s up. Closing the round…' : `${doneCount} of ${players.length} writers done` }}
      </h2>
      <ul class="mt-2 flex flex-wrap gap-2">
        <li
          v-for="p in players"
          :key="p.user_id"
        >
          <UBadge
            :color="submitters.has(p.user_id) ? 'success' : 'neutral'"
            variant="subtle"
            :icon="submitters.has(p.user_id) ? 'i-lucide-check' : 'i-lucide-pencil'"
          >
            {{ p.name }}{{ p.user_id === userId ? ' (you)' : '' }} · {{ submitters.has(p.user_id) ? 'done' : 'writing' }}
          </UBadge>
        </li>
      </ul>
    </section>
  </div>
</template>
