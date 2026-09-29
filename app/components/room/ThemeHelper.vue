<script setup lang="ts">
/** "Improve with AI" for the story theme. The host always decides: nothing changes until "Use this". */
const theme = defineModel<string>({ required: true })
const props = defineProps<{ genre: string }>()

const loading = ref(false)
const suggestion = ref('')
const error = ref('')
const previous = ref<string | null>(null)

async function suggest() {
  loading.value = true
  error.value = ''
  try {
    const res = await api<{ theme: string }>('/api/ai/theme', { method: 'POST', body: { idea: theme.value, genre: props.genre } })
    suggestion.value = res.theme
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage ?? 'The AI helper is not available right now.'
  } finally {
    loading.value = false
  }
}

function accept() {
  previous.value = theme.value
  theme.value = suggestion.value
  suggestion.value = ''
}

function undo() {
  if (previous.value === null) return
  theme.value = previous.value
  previous.value = null
}
</script>

<template>
  <div class="mt-2 space-y-2">
    <div class="flex flex-wrap items-center gap-2">
      <UButton
        size="sm"
        color="neutral"
        variant="soft"
        icon="i-lucide-wand-sparkles"
        :loading="loading"
        @click="suggest"
      >
        {{ theme.trim() ? 'Improve with AI' : 'Suggest a theme with AI' }}
      </UButton>
      <UButton
        v-if="previous !== null && !suggestion"
        size="sm"
        color="neutral"
        variant="ghost"
        icon="i-lucide-undo-2"
        @click="undo"
      >
        Undo
      </UButton>
    </div>

    <div
      v-if="suggestion"
      class="rounded-lg border border-primary/40 bg-primary/5 p-3"
      role="region"
      aria-label="AI suggestion"
      aria-live="polite"
    >
      <p class="text-xs font-semibold text-primary">
        Suggestion
      </p>
      <p class="mt-1">
        {{ suggestion }}
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton
          size="sm"
          icon="i-lucide-check"
          @click="accept"
        >
          Use this
        </UButton>
        <UButton
          size="sm"
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          :loading="loading"
          @click="suggest"
        >
          Try again
        </UButton>
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          @click="suggestion = ''"
        >
          Keep mine
        </UButton>
      </div>
    </div>

    <p
      v-if="error"
      class="text-sm text-error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>
