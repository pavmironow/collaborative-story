<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { z } from 'zod'
import { LIMITS, formatDuration, playerNameSchema, settingsSchema, type Mode } from '#shared/game'
import { MODE_LABELS } from '#shared/room'

const schema = settingsSchema.extend({ hostName: playerNameSchema })
type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  hostName: '',
  theme: '',
  mode: 'chaos',
  roundsTotal: LIMITS.rounds.default,
  charLimit: LIMITS.charLimit.default,
  timeLimitS: LIMITS.timeLimitS.default
})

const modeItems = (['chaos', 'fixed', 'random'] as Mode[]).map(value => ({ value, ...MODE_LABELS[value] }))
const charLimitItems = [150, 300, 500, 800].map(n => ({ label: `${n} characters`, value: n }))
const timeItems = [30, 60, 90, 120, 180].map(s => ({ label: formatDuration(s), value: s }))
const timeHint = computed(() => state.mode === 'chaos' ? 'Per round: everyone writes at the same time.' : 'Per player turn.')

const submitting = ref(false)
const error = ref('')

const joinCode = ref('')
const validCode = computed(() => /^[A-Z0-9]{5}$/.test(joinCode.value.trim().toUpperCase()))
function joinRoom() {
  if (validCode.value) navigateTo(`/r/${joinCode.value.trim().toUpperCase()}`)
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  submitting.value = true
  error.value = ''
  try {
    const { code } = await api<{ code: string }>('/api/rooms', { method: 'POST', body: event.data })
    await navigateTo(`/r/${code}`)
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage ?? 'Could not create the room. Check your connection and try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UContainer class="max-w-xl py-8 sm:py-12">
    <h1 class="text-3xl font-bold">
      Collaborative Story
    </h1>
    <p class="mt-2 text-muted">
      Write a story together with friends in short, timed rounds. Create a room and share the link.
    </p>

    <form
      class="mt-6 flex gap-2"
      aria-label="Join a room with a code"
      @submit.prevent="joinRoom"
    >
      <UInput
        v-model="joinCode"
        placeholder="Have a code? e.g. NEG9G"
        aria-label="Room code"
        :maxlength="5"
        autocapitalize="characters"
        class="min-w-0 flex-1 font-mono uppercase"
      />
      <UButton
        type="submit"
        color="neutral"
        variant="outline"
        :disabled="!validCode"
      >
        Join room
      </UButton>
    </form>

    <USeparator
      label="or create a new story"
      class="mt-8"
    />

    <UForm
      :schema="schema"
      :state="state"
      class="mt-6 space-y-6"
      @submit="onSubmit"
    >
      <UFormField
        label="Your name"
        name="hostName"
        required
      >
        <UInput
          v-model="state.hostName"
          :maxlength="LIMITS.name.max"
          placeholder="e.g. Pavel"
          autocomplete="nickname"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="Story theme"
        name="theme"
        :hint="`${state.theme.length}/${LIMITS.theme.max}`"
        required
      >
        <UTextarea
          v-model="state.theme"
          :maxlength="LIMITS.theme.max"
          :rows="3"
          autoresize
          placeholder="A tram in Prague stops at a station that is not on any map."
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="Mode"
        name="mode"
      >
        <URadioGroup
          v-model="state.mode"
          :items="modeItems"
          variant="card"
          class="w-full"
        />
      </UFormField>

      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField
          label="Rounds"
          name="roundsTotal"
          :help="`${LIMITS.rounds.min}–${LIMITS.rounds.max}`"
        >
          <UInputNumber
            v-model="state.roundsTotal"
            :min="LIMITS.rounds.min"
            :max="LIMITS.rounds.max"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Max length"
          name="charLimit"
        >
          <USelect
            v-model="state.charLimit"
            :items="charLimitItems"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Time limit"
          name="timeLimitS"
          :help="timeHint"
        >
          <USelect
            v-model="state.timeLimitS"
            :items="timeItems"
            class="w-full"
          />
        </UFormField>
      </div>

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
        :loading="submitting"
        icon="i-lucide-sparkles"
      >
        Create room
      </UButton>
    </UForm>
  </UContainer>
</template>
