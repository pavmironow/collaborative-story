<script setup lang="ts">
import type { ChapterRow, ChapterVersionRow, FragmentRow, RoomRow } from '#shared/room'
import { canRevise, currentChapterText, isEdited, REVISION_LIMITS, versionLabel } from '#shared/revision'

/**
 * "Edited · History · Revise" for one chapter. Anyone can open its history; the host can ask the
 * AI for a rewrite, edit the text by hand, or restore an older version. Each change is a new version.
 */
const props = defineProps<{ room: RoomRow, chapter: ChapterRow, fragments: FragmentRow[], isHost: boolean }>()

const parts = computed(() => props.fragments.filter(f => f.round === props.chapter.round && f.status === 'submitted'))
const revisable = computed(() => props.isHost && canRevise(props.room, props.chapter, parts.value.length).ok)
const edited = computed(() => isEdited(props.chapter))

// History: read on open and again whenever the chapter gets a new version.
const historyOpen = ref(false)
const versions = ref<ChapterVersionRow[]>([])
const historyError = ref('')
async function loadHistory() {
  historyError.value = ''
  const { data, error } = await useSupabase().from('chapter_versions').select('*')
    .eq('room_id', props.room.id).eq('round', props.chapter.round).order('version', { ascending: false })
  if (error) historyError.value = 'Could not load the history. Try again.'
  else versions.value = data as ChapterVersionRow[]
}
watch(historyOpen, open => open && loadHistory())
watch(() => props.chapter.version, () => historyOpen.value && loadHistory())

// Revise: one request at a time; the base version makes a stale edit fail instead of overwriting.
const reviseOpen = ref(false)
const tab = ref('ai')
const instruction = ref('')
const draft = ref('')
const saving = ref<'ai' | 'manual' | number | null>(null)
const error = ref('')
watch(reviseOpen, (open) => {
  if (!open) return
  error.value = ''
  instruction.value = ''
  draft.value = currentChapterText(props.chapter, parts.value)
})

async function revise(body: Record<string, unknown>, busy: 'ai' | 'manual' | number) {
  saving.value = busy
  error.value = ''
  try {
    await api(`/api/rooms/${props.room.code}/chapters/${props.chapter.round}/revise`, {
      method: 'POST',
      body: { ...body, baseVersion: props.chapter.version }
    })
    reviseOpen.value = false
    if (historyOpen.value) await loadHistory()
  } catch (e) {
    const message = (e as { statusMessage?: string }).statusMessage ?? 'Could not save the change. Try again.'
    if (typeof busy === 'number') historyError.value = message
    else error.value = message
  } finally {
    saving.value = null
  }
}

const tabs = [
  { label: 'Ask AI', value: 'ai', icon: 'i-lucide-sparkles', slot: 'ai' as const },
  { label: 'Edit text', value: 'manual', icon: 'i-lucide-pencil', slot: 'manual' as const }
]
const time = (iso: string) => new Date(iso).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
    <UBadge
      v-if="edited"
      variant="subtle"
      color="neutral"
      size="sm"
      icon="i-lucide-pencil-line"
    >
      Edited by the host
    </UBadge>

    <UModal
      v-if="chapter.version > 0"
      v-model:open="historyOpen"
      :title="`Chapter ${chapter.round} · history`"
      description="Every version is kept. The players’ original parts never change."
      scrollable
    >
      <UButton
        variant="link"
        color="neutral"
        size="xs"
        icon="i-lucide-history"
        class="px-0"
      >
        History
      </UButton>
      <template #body>
        <UAlert
          v-if="historyError"
          color="error"
          variant="subtle"
          :title="historyError"
          class="mb-4"
        />
        <ol class="space-y-4">
          <li
            v-for="v in versions"
            :key="v.version"
            class="rounded-lg border p-3"
            :class="v.version === chapter.version ? 'border-primary/40 bg-primary/5' : 'border-default'"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm font-semibold">
                Version {{ v.version }} · {{ versionLabel(v) }}
              </p>
              <UBadge
                v-if="v.version === chapter.version"
                size="sm"
                variant="subtle"
              >
                Current
              </UBadge>
              <UButton
                v-else-if="revisable"
                size="xs"
                variant="outline"
                icon="i-lucide-undo-2"
                :loading="saving === v.version"
                :disabled="saving !== null"
                @click="revise({ kind: 'restore', version: v.version }, v.version)"
              >
                Restore
              </UButton>
            </div>
            <p class="mt-1 text-xs text-muted">
              {{ time(v.created_at) }}
            </p>
            <p class="mt-2 text-sm whitespace-pre-line">
              {{ v.text }}
            </p>
          </li>
        </ol>
      </template>
    </UModal>

    <UModal
      v-if="revisable"
      v-model:open="reviseOpen"
      :title="`Revise chapter ${chapter.round}`"
      description="The current version is kept in the history, so you can always go back."
      :dismissible="saving === null"
    >
      <UButton
        variant="link"
        size="xs"
        icon="i-lucide-wand-sparkles"
        class="px-0"
      >
        Revise
      </UButton>
      <template #body>
        <UTabs
          v-model="tab"
          :items="tabs"
          class="w-full"
        >
          <template #ai>
            <form
              class="space-y-3 pt-2"
              @submit.prevent="revise({ kind: 'ai', instruction }, 'ai')"
            >
              <UFormField
                label="What should change?"
                :hint="`${instruction.trim().length}/${REVISION_LIMITS.instruction.max}`"
                help="The AI rewrites this chapter and still keeps every player’s part. It takes up to half a minute."
              >
                <UTextarea
                  v-model="instruction"
                  :maxlength="REVISION_LIMITS.instruction.max"
                  placeholder="e.g. Make the dragon friendlier, and call the captain Mira everywhere"
                  autoresize
                  :rows="2"
                  class="w-full"
                />
              </UFormField>
              <UButton
                type="submit"
                block
                icon="i-lucide-sparkles"
                :loading="saving === 'ai'"
                :disabled="saving !== null || instruction.trim().length < REVISION_LIMITS.instruction.min"
              >
                Rewrite with AI
              </UButton>
            </form>
          </template>
          <template #manual>
            <form
              class="space-y-3 pt-2"
              @submit.prevent="revise({ kind: 'manual', text: draft }, 'manual')"
            >
              <UFormField
                label="Chapter text"
                :hint="`${draft.trim().length}/${REVISION_LIMITS.text.max}`"
                help="Leave an empty line between paragraphs."
              >
                <UTextarea
                  v-model="draft"
                  :maxlength="REVISION_LIMITS.text.max"
                  autoresize
                  :rows="8"
                  :maxrows="16"
                  class="w-full"
                />
              </UFormField>
              <UButton
                type="submit"
                block
                icon="i-lucide-save"
                :loading="saving === 'manual'"
                :disabled="saving !== null || !draft.trim() || draft.trim() === currentChapterText(chapter, parts)"
              >
                Save as new version
              </UButton>
            </form>
          </template>
        </UTabs>
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
          class="mt-3"
        />
      </template>
    </UModal>
  </div>
</template>
