<script setup lang="ts">
import type { ChapterRow, FragmentRow, PlayerRow, RoomRow } from '#shared/room'

const props = defineProps<{ room: RoomRow, players: PlayerRow[], fragments: FragmentRow[], chapters: ChapterRow[], isHost: boolean }>()

const round = computed(() => props.room.current_round)
const chapter = computed(() => props.chapters.find(c => c.round === round.value))
const names = computed(() => new Map(props.players.map(p => [p.user_id, p.name])))
const parts = computed(() => props.fragments.filter(f => f.round === round.value && f.status === 'submitted'))
const skippedNames = computed(() => props.fragments.filter(f => f.round === round.value && f.status === 'skipped').map(f => names.value.get(f.player_id)))
const last = computed(() => round.value >= props.room.rounds_total)
const hostName = computed(() => names.value.get(props.room.host_id) ?? 'the host')

const continuing = ref(false)
const error = ref('')
async function next() {
  continuing.value = true
  error.value = ''
  try {
    await api(`/api/rooms/${props.room.code}/next`, { method: 'POST' })
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage ?? 'Could not continue. Try again.'
  } finally {
    continuing.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm font-medium text-primary">
        Round {{ round }} of {{ room.rounds_total }} · reveal
      </p>
      <h1 class="text-2xl font-bold">
        Chapter {{ round }}
      </h1>
    </div>

    <section
      v-if="chapter?.text"
      aria-label="Chapter"
      class="rounded-lg border border-primary/30 bg-primary/5 p-4"
    >
      <p class="text-lg leading-relaxed whitespace-pre-line">
        {{ chapter.text }}
      </p>
    </section>
    <UAlert
      v-else-if="parts.length"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      title="Here are everyone’s parts"
      description="The combined chapter is not available, so this round is told through the original texts."
    />

    <section aria-labelledby="originals">
      <h2
        id="originals"
        class="font-semibold"
      >
        {{ chapter?.text ? 'What everyone wrote' : 'The parts' }}
      </h2>
      <ul class="mt-2 space-y-3">
        <li
          v-for="f in parts"
          :key="f.id"
          class="rounded-lg border border-default p-3"
        >
          <p class="text-xs font-semibold text-muted">
            {{ names.get(f.player_id) }}
          </p>
          <p class="mt-1 whitespace-pre-line">
            {{ f.text }}
          </p>
        </li>
      </ul>
      <p
        v-if="!parts.length"
        class="mt-2 text-muted"
      >
        Nobody wrote in this round.
      </p>
      <p
        v-if="skippedNames.length"
        class="mt-3 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-skip-forward"
          class="align-middle"
        />
        Skipped (time ran out): {{ skippedNames.join(', ') }}
      </p>
    </section>

    <div class="sticky bottom-0 -mx-4 border-t border-default bg-default/95 p-4 backdrop-blur">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        :title="error"
        class="mb-3"
      />
      <UButton
        v-if="isHost"
        size="xl"
        block
        :loading="continuing"
        :icon="last ? 'i-lucide-book-check' : 'i-lucide-arrow-right'"
        @click="next"
      >
        {{ last ? 'Finish the story' : `Start round ${round + 1}` }}
      </UButton>
      <p
        v-else
        class="text-center text-muted"
      >
        Waiting for {{ hostName }} to {{ last ? 'finish the story' : 'start the next round' }}…
      </p>
    </div>
  </div>
</template>
