<script setup lang="ts">
import type { ChapterRow, FragmentRow, PlayerRow, RoomRow } from '#shared/room'
import { roundLabel } from '#shared/room'

const props = defineProps<{ room: RoomRow, players: PlayerRow[], fragments: FragmentRow[], chapters: ChapterRow[], isHost: boolean }>()

const round = computed(() => props.room.current_round)
const chapter = computed(() => props.chapters.find(c => c.round === round.value))
const names = computed(() => new Map(props.players.map(p => [p.user_id, p.name])))
const authorOf = computed(() => new Map(props.fragments.map(f => [f.id, names.value.get(f.player_id) ?? '?'])))
const paragraphs = computed(() => chapter.value?.paragraphs?.length
  ? chapter.value.paragraphs.map(p => ({ text: p.text, from: p.fragmentIds.map(id => authorOf.value.get(id)).filter(Boolean).join(', ') }))
  : chapter.value?.text ? [{ text: chapter.value.text, from: '' }] : [])
const parts = computed(() => props.fragments.filter(f => f.round === round.value && f.status === 'submitted'))
const skippedNames = computed(() => props.fragments.filter(f => f.round === round.value && f.status === 'skipped').map(f => names.value.get(f.player_id)))
const last = computed(() => round.value >= props.room.rounds_total)
const hostName = computed(() => names.value.get(props.room.host_id) ?? 'the host')

const continuing = ref(false)
const error = ref('')
const ending = ref(false)
const confirmEnd = ref(false)
async function next(finish = false) {
  const busy = finish ? ending : continuing
  busy.value = true
  error.value = ''
  try {
    await api(`/api/rooms/${props.room.code}/next`, { method: 'POST', body: finish ? { finish: true } : {} })
    confirmEnd.value = false
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage ?? 'Could not continue. Try again.'
  } finally {
    busy.value = false
  }
}
const waitingFor = computed(() => {
  if (last.value) return 'finish the story'
  return props.room.endless ? 'start the next round or end the story' : 'start the next round'
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm font-medium text-primary">
        {{ roundLabel(room) }} · reveal
      </p>
      <h1 class="text-2xl font-bold">
        Chapter {{ round }}
      </h1>
    </div>

    <RoomStorySoFar
      v-if="round > 1"
      :theme="room.theme"
      :chapters="chapters"
      :fragments="fragments"
      :players="players"
      :before-round="round"
      collapsed
    />

    <section
      v-if="paragraphs.length"
      aria-label="Chapter"
      class="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4"
    >
      <p class="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <UIcon name="i-lucide-sparkles" /> Woven by AI from everyone’s parts
      </p>
      <div
        v-for="(p, i) in paragraphs"
        :key="i"
      >
        <p class="text-lg leading-relaxed">
          {{ p.text }}
        </p>
        <p
          v-if="p.from"
          class="mt-1 text-xs text-muted"
        >
          from {{ p.from }}
        </p>
      </div>
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
        {{ paragraphs.length ? 'What everyone wrote' : 'The parts' }}
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
      <div
        v-if="isHost"
        class="flex gap-2"
      >
        <UButton
          size="xl"
          block
          class="flex-1"
          :loading="continuing"
          :disabled="ending"
          :icon="last ? 'i-lucide-book-check' : 'i-lucide-arrow-right'"
          @click="next()"
        >
          {{ last ? 'Finish the story' : `Start round ${round + 1}` }}
        </UButton>
        <UModal
          v-if="room.endless && !last"
          v-model:open="confirmEnd"
          :title="`End the story after chapter ${round}?`"
          description="Everyone will see the finished story. This can’t be undone."
        >
          <UButton
            size="xl"
            color="neutral"
            variant="outline"
            icon="i-lucide-book-check"
            :disabled="continuing"
          >
            End story
          </UButton>
          <template #footer>
            <div class="flex w-full justify-end gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                @click="confirmEnd = false"
              >
                Keep writing
              </UButton>
              <UButton
                :loading="ending"
                icon="i-lucide-book-check"
                @click="next(true)"
              >
                End story
              </UButton>
            </div>
          </template>
        </UModal>
      </div>
      <p
        v-else
        class="text-center text-muted"
      >
        Waiting for {{ hostName }} to {{ waitingFor }}…
      </p>
    </div>
  </div>
</template>
