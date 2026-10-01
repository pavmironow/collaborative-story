<script setup lang="ts">
import type { RoomRow } from '#shared/room'
import { roundLabel } from '#shared/room'
import { getGenre } from '#shared/genres'

useSeoMeta({ title: 'My stories · Collaborative Story' })

type MyRoom = Pick<RoomRow, 'code' | 'theme' | 'genre' | 'status' | 'current_round' | 'rounds_total' | 'endless' | 'cover_url' | 'host_id' | 'created_at'>
interface Entry { name: string, joined_at: string, rooms: MyRoom | null }

const state = ref<'loading' | 'ready' | 'error'>('loading')
const entries = ref<Entry[]>([])
const userId = ref<string | null>(null)

// Rooms this browser has joined: the anonymous session is the only identity, so a visitor
// without one simply has no stories yet (no session is created just to look).
async function load() {
  state.value = 'loading'
  try {
    const supabase = useSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    userId.value = session?.user.id ?? null
    if (!userId.value) {
      entries.value = []
    } else {
      const { data, error } = await supabase.from('players')
        .select('name, joined_at, rooms(code, theme, genre, status, current_round, rounds_total, endless, cover_url, host_id, created_at)')
        .eq('user_id', userId.value)
        .order('joined_at', { ascending: false })
      if (error) throw error
      entries.value = data as unknown as Entry[]
    }
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

const rooms = computed(() => entries.value.filter(e => e.rooms).map(e => ({ ...e.rooms!, as: e.name })))
const active = computed(() => rooms.value.filter(r => r.status !== 'finished'))
const finished = computed(() => rooms.value.filter(r => r.status === 'finished'))

function progress(r: MyRoom): string {
  if (r.status === 'lobby') return 'In the lobby'
  return `${roundLabel(r)} · ${r.status === 'writing' ? 'writing now' : r.status === 'merging' ? 'weaving the chapter' : 'reading the chapter'}`
}
const when = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
</script>

<template>
  <UContainer class="max-w-3xl py-10 sm:py-14">
    <h1 class="text-4xl font-bold">
      My stories
    </h1>
    <p class="mt-3 text-muted">
      Games you have played in this browser.
    </p>

    <div
      v-if="state === 'loading'"
      class="mt-8 space-y-3"
      role="status"
      aria-label="Loading your stories"
    >
      <USkeleton
        v-for="i in 3"
        :key="i"
        class="h-20 rounded-xl"
      />
    </div>

    <UAlert
      v-else-if="state === 'error'"
      class="mt-8"
      color="error"
      variant="subtle"
      icon="i-lucide-wifi-off"
      title="Could not load your stories"
      description="Check your connection and try again."
      :actions="[{ label: 'Try again', onClick: load }]"
    />

    <div
      v-else-if="!rooms.length"
      class="ink-card mt-8 bg-sky-50 p-6 text-center dark:bg-elevated"
    >
      <p class="font-display text-xl font-bold">
        No stories yet
      </p>
      <p class="mt-1 text-muted">
        Create a room or join one with a code, and it will show up here.
      </p>
      <UButton
        to="/new"
        icon="i-lucide-sparkles"
        class="mt-4"
      >
        Create a room
      </UButton>
    </div>

    <template v-else>
      <section
        v-if="active.length"
        aria-labelledby="in-progress"
        class="mt-8"
      >
        <h2
          id="in-progress"
          class="text-2xl font-bold"
        >
          In progress
        </h2>
        <ul class="mt-3 space-y-3">
          <li
            v-for="r in active"
            :key="r.code"
            class="ink-card flex items-center gap-4 bg-default p-4"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate font-bold">
                {{ getGenre(r.genre).emoji }} {{ r.theme }}
              </p>
              <p class="text-sm text-muted">
                {{ progress(r) }} · as {{ r.as }}{{ r.host_id === userId ? ' (host)' : '' }}
              </p>
            </div>
            <UButton
              :to="`/r/${r.code}`"
              trailing-icon="i-lucide-arrow-right"
            >
              Open
            </UButton>
          </li>
        </ul>
      </section>

      <section
        v-if="finished.length"
        aria-labelledby="finished"
        class="mt-10"
      >
        <h2
          id="finished"
          class="text-2xl font-bold"
        >
          Finished
        </h2>
        <ul class="mt-3 grid gap-4 sm:grid-cols-2">
          <li
            v-for="r in finished"
            :key="r.code"
            class="ink-card flex flex-col overflow-hidden bg-default"
          >
            <img
              v-if="r.cover_url"
              :src="r.cover_url"
              alt=""
              class="aspect-[3/2] w-full border-b-2 border-(--ink) object-cover"
              loading="lazy"
            >
            <div class="flex flex-1 flex-col p-4">
              <p class="line-clamp-2 font-bold">
                {{ getGenre(r.genre).emoji }} {{ r.theme }}
              </p>
              <p class="mt-1 text-sm text-muted">
                {{ r.current_round }} {{ r.current_round === 1 ? 'chapter' : 'chapters' }} · {{ when(r.created_at) }}
              </p>
              <div class="mt-3 flex gap-2 pt-1">
                <UButton
                  :to="`/s/${r.code}`"
                  size="sm"
                  icon="i-lucide-book-open"
                >
                  Read
                </UButton>
                <UButton
                  v-if="r.host_id === userId"
                  :to="`/r/${r.code}`"
                  size="sm"
                  variant="outline"
                  color="neutral"
                  icon="i-lucide-wand-sparkles"
                >
                  Revise
                </UButton>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </template>

    <p class="mt-10 text-sm text-muted">
      <UIcon
        name="i-lucide-info"
        class="align-middle"
      />
      Your stories are linked to this browser. Clearing its site data empties this list, but story links keep working.
    </p>
  </UContainer>
</template>
