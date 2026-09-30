<script setup lang="ts">
import { GENRES, SURPRISE } from '#shared/genres'

const model = defineModel<string>({ required: true })

const groups = [
  { title: 'Classic', items: GENRES.filter(g => g.kind === 'classic') },
  { title: 'Fun moods', items: GENRES.filter(g => g.kind === 'fun') }
]
</script>

<template>
  <div
    role="radiogroup"
    aria-label="Genre"
    class="space-y-3"
  >
    <div
      v-for="group in groups"
      :key="group.title"
    >
      <p class="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
        {{ group.title }}
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="g in group.items"
          :key="g.id"
          role="radio"
          :aria-checked="model === g.id"
          :color="model === g.id ? 'primary' : 'neutral'"
          :variant="model === g.id ? 'solid' : 'outline'"
          size="sm"
          @click="model = g.id"
        >
          {{ g.emoji }} {{ g.label }}
        </UButton>
      </div>
    </div>
    <UButton
      role="radio"
      :aria-checked="model === SURPRISE"
      :color="model === SURPRISE ? 'primary' : 'neutral'"
      :variant="model === SURPRISE ? 'solid' : 'soft'"
      size="sm"
      icon="i-lucide-dices"
      @click="model = SURPRISE"
    >
      Surprise me
    </UButton>
  </div>
</template>
