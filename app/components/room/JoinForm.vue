<script setup lang="ts">
import { z } from 'zod'
import { LIMITS, playerNameSchema } from '#shared/game'
import type { RoomRow } from '#shared/room'
import { MODE_LABELS } from '#shared/room'

const props = defineProps<{ room: RoomRow, hostName: string, playerCount: number }>()
const emit = defineEmits<{ joined: [] }>()

const state = reactive({ name: '' })
const schema = z.object({ name: playerNameSchema })
const submitting = ref(false)
const error = ref('')

async function onSubmit() {
  submitting.value = true
  error.value = ''
  try {
    await api(`/api/rooms/${props.room.code}/join`, { method: 'POST', body: { name: state.name } })
    emit('joined')
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage ?? 'Could not join. Check your connection and try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <p class="text-sm font-medium text-primary">
      {{ hostName }} invited you to write a story
    </p>
    <h1 class="mt-1 text-2xl font-bold">
      “{{ room.theme }}”
    </h1>
    <p class="mt-2 text-muted">
      {{ MODE_LABELS[room.mode].label }} · {{ room.rounds_total }} rounds · {{ playerCount }} {{ playerCount === 1 ? 'player' : 'players' }} so far
    </p>

    <UForm
      :schema="schema"
      :state="state"
      class="mt-6 space-y-4"
      @submit="onSubmit"
    >
      <UFormField
        label="Your name"
        name="name"
        help="Shown next to everything you write."
      >
        <UInput
          v-model="state.name"
          :maxlength="LIMITS.name.max"
          autofocus
          autocomplete="nickname"
          placeholder="e.g. Ben"
          size="xl"
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
        :loading="submitting"
      >
        Join the story
      </UButton>
    </UForm>
  </div>
</template>
