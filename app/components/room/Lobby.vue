<script setup lang="ts">
import { LIMITS, formatDuration } from '#shared/game'
import type { PlayerRow, RoomRow } from '#shared/room'
import { MODE_LABELS } from '#shared/room'
import { getGenre } from '#shared/genres'

const props = defineProps<{ room: RoomRow, players: PlayerRow[], online: Set<string>, userId: string, isHost: boolean }>()

const link = computed(() => import.meta.client ? `${window.location.origin}/r/${props.room.code}` : '')
const copied = ref(false)
async function copyLink() {
  await navigator.clipboard.writeText(link.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

const enough = computed(() => props.players.length >= LIMITS.players.min)
const starting = ref(false)
const error = ref('')
async function start() {
  starting.value = true
  error.value = ''
  try {
    await api(`/api/rooms/${props.room.code}/start`, { method: 'POST' })
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage ?? 'Could not start. Try again.'
  } finally {
    starting.value = false
  }
}

const rules = computed(() => {
  const r = props.room
  const time = formatDuration(r.time_limit_s)
  const genre = getGenre(r.genre)
  return [
    { icon: 'i-lucide-drama', text: `Genre: ${genre.emoji} ${genre.label}` },
    { icon: 'i-lucide-shuffle', text: MODE_LABELS[r.mode].description },
    { icon: 'i-lucide-repeat', text: `${r.rounds_total} rounds. Everyone writes once per round.` },
    { icon: 'i-lucide-timer', text: r.mode === 'chaos' ? `${time} per round.` : `${time} per turn.` },
    { icon: 'i-lucide-type', text: `Up to ${r.char_limit} characters each time.` },
    { icon: 'i-lucide-skip-forward', text: 'Miss the timer and your turn is skipped. You still play the next round.' }
  ]
})
</script>

<template>
  <div class="space-y-8">
    <div>
      <p class="text-sm font-medium text-primary">
        Lobby · room {{ room.code }}
      </p>
      <h1 class="mt-1 text-2xl font-bold">
        “{{ room.theme }}”
      </h1>
    </div>

    <section aria-labelledby="invite">
      <h2
        id="invite"
        class="font-semibold"
      >
        Invite friends
      </h2>
      <div class="mt-2 flex gap-2">
        <UInput
          :model-value="link"
          readonly
          aria-label="Invite link"
          class="min-w-0 flex-1"
          @focus="($event.target as HTMLInputElement).select()"
        />
        <UButton
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
          :color="copied ? 'success' : 'primary'"
          @click="copyLink"
        >
          {{ copied ? 'Copied' : 'Copy link' }}
        </UButton>
      </div>
      <p class="mt-2 text-sm text-muted">
        Or open this site and enter the code <strong class="font-mono text-default">{{ room.code }}</strong>.
      </p>
    </section>

    <section aria-labelledby="players">
      <h2
        id="players"
        class="font-semibold"
      >
        Writers ({{ players.length }}/{{ LIMITS.players.max }})
      </h2>
      <ul
        class="mt-2 divide-y divide-default rounded-lg border border-default"
        aria-live="polite"
      >
        <li
          v-for="p in players"
          :key="p.user_id"
          class="flex items-center gap-3 px-4 py-3"
        >
          <span
            class="size-2.5 shrink-0 rounded-full"
            :class="online.has(p.user_id) ? 'bg-success' : 'bg-muted'"
          />
          <span class="sr-only">{{ online.has(p.user_id) ? 'online' : 'offline' }}</span>
          <span class="min-w-0 flex-1 truncate">{{ p.name }}</span>
          <UBadge
            v-if="p.user_id === userId"
            variant="subtle"
            color="neutral"
          >
            you
          </UBadge>
          <UBadge
            v-if="p.user_id === room.host_id"
            variant="subtle"
          >
            host
          </UBadge>
        </li>
      </ul>
    </section>

    <section aria-labelledby="rules">
      <h2
        id="rules"
        class="font-semibold"
      >
        Rules
      </h2>
      <ul class="mt-2 space-y-2">
        <li
          v-for="r in rules"
          :key="r.text"
          class="flex gap-3 text-sm"
        >
          <UIcon
            :name="r.icon"
            class="mt-0.5 size-4 shrink-0 text-primary"
          />
          <span>{{ r.text }}</span>
        </li>
      </ul>
    </section>

    <div class="sticky bottom-0 -mx-4 border-t border-default bg-default/95 p-4 backdrop-blur">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="error"
        class="mb-3"
      />
      <template v-if="isHost">
        <UButton
          size="xl"
          block
          :disabled="!enough"
          :loading="starting"
          icon="i-lucide-play"
          @click="start"
        >
          Start the story
        </UButton>
        <p
          v-if="!enough"
          class="mt-2 text-center text-sm text-muted"
        >
          Waiting for at least {{ LIMITS.players.min }} writers to join.
        </p>
      </template>
      <p
        v-else
        class="text-center text-muted"
      >
        <UIcon
          name="i-lucide-loader"
          class="mr-1 animate-spin align-middle"
        />
        Waiting for the host to start the story…
      </p>
    </div>
  </div>
</template>
