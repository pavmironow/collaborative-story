<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { z } from 'zod'
import { LIMITS, formatDuration, playerNameSchema, settingsSchema, type Mode } from '#shared/game'
import { MODE_LABELS } from '#shared/room'
import { DEFAULT_GENRE } from '#shared/genres'

useSeoMeta({ title: 'Create a room · Collaborative Story' })

const schema = settingsSchema.extend({ hostName: playerNameSchema })
type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  hostName: '',
  theme: '',
  mode: 'chaos',
  genre: DEFAULT_GENRE,
  roundsTotal: LIMITS.rounds.default,
  charLimit: LIMITS.charLimit.default,
  timeLimitS: LIMITS.timeLimitS.default,
  endless: false
})

const modeItems = (['chaos', 'fixed', 'random'] as Mode[]).map(value => ({ value, ...MODE_LABELS[value] }))
const charLimitItems = [150, 300, 500, 800].map(n => ({ label: `${n} characters`, value: n }))
const timeItems = [30, 60, 90, 120, 180].map(s => ({ label: formatDuration(s), value: s }))
const timeHint = computed(() => state.mode === 'chaos' ? 'Per round: everyone writes at the same time.' : 'Per player turn.')

const submitting = ref(false)
const error = ref('')

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
      Create a room
    </h1>
    <p class="mt-2 text-muted">
      Pick a genre and a theme, then share the link with your friends.
    </p>

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
        label="Genre"
        name="genre"
        help="Sets the mood for the AI helper, the chapters and the cover."
      >
        <RoomGenrePicker v-model="state.genre" />
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
        <RoomThemeHelper
          v-model="state.theme"
          :genre="state.genre"
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
          :help="state.endless ? `You end the story (max ${LIMITS.endlessRounds} rounds)` : `${LIMITS.rounds.min}–${LIMITS.rounds.max}`"
        >
          <UInput
            v-if="state.endless"
            model-value="∞"
            disabled
            aria-label="Rounds: endless"
            class="w-full"
          />
          <UInputNumber
            v-else
            v-model="state.roundsTotal"
            :min="LIMITS.rounds.min"
            :max="LIMITS.rounds.max"
            class="w-full"
          />
          <USwitch
            v-model="state.endless"
            label="Endless"
            class="mt-2"
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
