<script setup lang="ts">
import { checkFragment } from '#shared/game'
import { canPost, shouldAskForHint, storyParts } from '#shared/open-story'
import type { ChapterRow, FragmentRow, PlayerRow, RoomRow } from '#shared/room'
import { roundLabel } from '#shared/room'

/**
 * Endless story (mode `open`): one live feed. Anyone writes whenever it is not their turn twice in a row; the
 * host ends chapters after any part (the AI may suggest where), removes parts and ends the story.
 */
const props = defineProps<{ room: RoomRow, players: PlayerRow[], fragments: FragmentRow[], chapters: ChapterRow[], userId: string, isHost: boolean, online: Set<string> }>()
const emit = defineEmits<{ submitted: [] }>()

const names = computed(() => new Map(props.players.map(p => [p.user_id, p.name])))
const chapterParts = computed(() => storyParts(props.fragments.filter(f => f.round === props.room.current_round), props.userId))
const myTurn = computed(() => canPost(props.room.last_part_by, props.userId))
const hintSeq = computed(() => props.isHost ? props.room.break_hint_seq : null)

// Writing
const text = ref('')
const length = computed(() => text.value.trim().length)
const over = computed(() => length.value > props.room.char_limit)
const sending = ref(false)
const error = ref('')
async function submit() {
  const check = checkFragment(text.value, props.room.char_limit)
  if (!check.ok) {
    error.value = check.reason === 'empty' ? 'Write something first' : `Too long by ${check.length - props.room.char_limit} characters`
    return
  }
  sending.value = true
  error.value = ''
  try {
    await api(`/api/rooms/${props.room.code}/submit`, { method: 'POST', body: { text: check.text } })
    text.value = ''
    emit('submitted')
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage ?? 'Could not send your part. Try again.'
  } finally {
    sending.value = false
  }
}

// Host controls
const busy = ref<string | null>(null)
const hostError = ref('')
async function hostAction(key: string, url: string, body?: object) {
  busy.value = key
  hostError.value = ''
  try {
    await api(url, { method: 'POST', body })
    emit('submitted')
    return true
  } catch (e) {
    hostError.value = (e as { statusMessage?: string }).statusMessage ?? 'That did not work. Try again.'
    return false
  } finally {
    busy.value = null
  }
}
const endChapter = (seq: number) => hostAction(`chapter-${seq}`, `/api/rooms/${props.room.code}/chapter`, { afterSeq: seq })
const hide = (id: string) => hostAction(`hide-${id}`, `/api/rooms/${props.room.code}/parts/${id}/hide`)
const confirmEnd = ref(false)
async function endStory() {
  if (await hostAction('finish', `/api/rooms/${props.room.code}/finish`)) confirmEnd.value = false
}

// The host's page asks for an AI chapter-break hint every few parts; the server makes sure it runs once.
watch(() => chapterParts.value.filter(p => !p.hidden_at).length, (count) => {
  if (props.isHost && shouldAskForHint(count, props.room.hint_checked_count)) {
    api(`/api/rooms/${props.room.code}/hint`, { method: 'POST' }).catch(() => {})
  }
}, { immediate: true })

// Keep the newest part in view as the feed grows.
const feedEnd = ref<HTMLElement>()
watch(() => chapterParts.value.length, () => nextTick(() => feedEnd.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })))
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-sm font-medium text-primary">
          Endless story · anyone can add a part
        </p>
        <h1 class="text-2xl font-bold">
          {{ roundLabel(room) }}
        </h1>
      </div>
      <UModal
        v-if="isHost"
        v-model:open="confirmEnd"
        title="End the story here?"
        description="The current chapter becomes the last one, and everyone sees the finished story. This can’t be undone."
      >
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-book-check"
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
              icon="i-lucide-book-check"
              :loading="busy === 'finish'"
              @click="endStory"
            >
              End story
            </UButton>
          </div>
        </template>
      </UModal>
    </div>

    <RoomStorySoFar
      :theme="room.theme"
      :chapters="chapters"
      :fragments="fragments"
      :players="players"
      :before-round="room.current_round"
      :collapsed="room.current_round > 1"
      :room="room"
      :is-host="isHost"
    />

    <UAlert
      v-if="hostError"
      color="error"
      variant="subtle"
      :title="hostError"
    />

    <section
      aria-labelledby="current-chapter"
      aria-live="polite"
    >
      <h2
        id="current-chapter"
        class="font-semibold"
      >
        {{ chapterParts.length ? `${roundLabel(room)} so far` : `${roundLabel(room)} is empty — write the first part` }}
      </h2>
      <ol class="mt-3 space-y-3">
        <li
          v-for="p in chapterParts"
          :key="p.id"
          class="ink-card p-3"
          :class="p.hidden_at ? 'bg-elevated opacity-70' : p.player_id === userId ? 'bg-sky-50 dark:bg-elevated' : 'bg-default'"
        >
          <p class="text-xs font-semibold text-muted">
            {{ names.get(p.player_id) ?? 'Someone' }}{{ p.player_id === userId ? ' (you)' : '' }}
          </p>
          <p class="mt-1 whitespace-pre-line">
            {{ p.text }}
          </p>
          <p
            v-if="p.hidden_at"
            class="mt-1 text-xs text-muted"
          >
            Removed by the host: only you can see this part.
          </p>

          <div
            v-if="hintSeq === p.seq"
            class="mt-3 rounded-lg bg-yellow-100 p-2 text-sm text-[#1F2333] ring-2 ring-(--ink)"
          >
            <UIcon
              name="i-lucide-sparkles"
              class="align-middle"
            />
            AI suggests ending the chapter here: {{ room.break_hint_reason }}
          </div>

          <div
            v-if="isHost && !p.hidden_at"
            class="mt-2 flex flex-wrap gap-x-3"
          >
            <UButton
              size="xs"
              variant="link"
              icon="i-lucide-bookmark-check"
              class="px-0"
              :loading="busy === `chapter-${p.seq}`"
              :disabled="busy !== null"
              @click="endChapter(p.seq)"
            >
              End chapter here
            </UButton>
            <UButton
              v-if="p.player_id !== userId"
              size="xs"
              variant="link"
              color="neutral"
              icon="i-lucide-eye-off"
              class="px-0"
              :loading="busy === `hide-${p.id}`"
              :disabled="busy !== null"
              @click="hide(p.id)"
            >
              Remove
            </UButton>
          </div>
        </li>
      </ol>
      <!-- Scroll target below the newest part, clear of the sticky writing box. -->
      <div
        ref="feedEnd"
        class="scroll-mb-72"
      />
    </section>

    <form
      class="sticky bottom-0 -mx-4 space-y-3 border-t border-default bg-default/95 p-4 backdrop-blur"
      @submit.prevent="submit"
    >
      <UFormField
        label="Add the next part"
        :hint="`${length}/${room.char_limit}`"
        :error="over ? `Too long by ${length - room.char_limit} character${length - room.char_limit === 1 ? '' : 's'}` : undefined"
        :help="myTurn ? 'Everyone sees your part as soon as you send it.' : undefined"
      >
        <UTextarea
          v-model="text"
          :rows="3"
          autoresize
          :maxrows="8"
          :disabled="!myTurn"
          placeholder="What happens next?"
          class="w-full"
        />
      </UFormField>
      <p
        v-if="!myTurn"
        class="text-sm text-muted"
        role="status"
      >
        You wrote the last part. You can write again once someone else adds one, so invite a friend with the link.
      </p>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        :title="error"
      />
      <UButton
        type="submit"
        block
        size="lg"
        icon="i-lucide-send"
        :loading="sending"
        :disabled="!myTurn || !length || over"
      >
        Add my part
      </UButton>
      <p class="text-center text-xs text-muted">
        {{ players.length }} {{ players.length === 1 ? 'writer' : 'writers' }} · {{ online.size }} online now
      </p>
    </form>
  </div>
</template>
