import type { RealtimeChannel } from '@supabase/supabase-js'
import type { ChapterRow, FragmentRow, PlayerRow, RoomRow } from '#shared/room'

/**
 * Live view of one room: the room row, its players and who is online. Rows are re-read on every
 * realtime change (simple and always consistent); Presence tracks who has the page open.
 */
export function useRoom(code: string) {
  const supabase = useSupabase()
  const room = ref<RoomRow | null>(null)
  const players = ref<PlayerRow[]>([])
  /** Only what RLS lets this player see: own drafts, plus everything from closed rounds. */
  const fragments = ref<FragmentRow[]>([])
  const chapters = ref<ChapterRow[]>([])
  /** Ids of writers who submitted in the current round (never their text). */
  const submitters = ref(new Set<string>())
  /** serverTime ≈ Date.now() + clockOffset */
  const clockOffset = ref(0)
  const userId = ref<string | null>(null)
  const status = ref<'loading' | 'ready' | 'not_found' | 'error'>('loading')
  const connected = ref(false)
  const online = ref(new Set<string>())
  const networkOnline = ref(true)
  let channel: RealtimeChannel | undefined
  let resync: ReturnType<typeof setInterval> | undefined
  const timers: ReturnType<typeof setTimeout>[] = []

  /**
   * Realtime events can trigger overlapping reloads. Only the newest request may write its
   * result, so an older, slower response never overwrites fresher data.
   */
  const latest: Record<string, number> = {}
  async function fresh<T>(key: string, load: () => Promise<T>, apply: (value: T) => void) {
    const id = (latest[key] = (latest[key] ?? 0) + 1)
    const value = await load()
    if (id === latest[key]) apply(value)
  }

  const me = computed(() => players.value.find(p => p.user_id === userId.value) ?? null)
  const isHost = computed(() => !!room.value && room.value.host_id === userId.value)

  async function loadRoom() {
    await fresh('room', async () => {
      const { data, error } = await supabase.from('rooms').select('*').eq('code', code.toUpperCase()).maybeSingle()
      if (error) throw error
      return data as RoomRow | null
    }, value => (room.value = value))
    await loadStory()
  }

  async function loadStory() {
    if (!room.value || room.value.status === 'lobby') return
    const id = room.value.id
    await fresh('story', async () => {
      const [f, c, s] = await Promise.all([
        supabase.from('fragments').select('*').eq('room_id', id).order('round').order('created_at'),
        supabase.from('chapters').select('*').eq('room_id', id).order('round'),
        supabase.rpc('round_submitters', { p_room: id })
      ])
      if (f.error || c.error || s.error) throw f.error ?? c.error ?? s.error
      return { f: f.data as FragmentRow[], c: c.data as ChapterRow[], s: s.data as string[] }
    }, ({ f, c, s }) => {
      fragments.value = f
      chapters.value = c
      submitters.value = new Set(s)
    })
  }

  async function syncClock() {
    try {
      const t0 = Date.now()
      const { now } = await $fetch<{ now: number }>('/api/time')
      clockOffset.value = now - (t0 + Date.now()) / 2
    } catch {
      clockOffset.value = 0
    }
  }

  async function loadPlayers() {
    if (!room.value) return
    const id = room.value.id
    await fresh('players', async () => {
      const { data, error } = await supabase.from('players').select('*').eq('room_id', id).order('seat')
      if (error) throw error
      return data as PlayerRow[]
    }, value => (players.value = value))
  }

  async function refresh() {
    await loadRoom()
    await loadPlayers()
  }

  function subscribe(roomId: string) {
    channel = supabase.channel(`room:${roomId}`, { config: { presence: { key: userId.value! } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => loadRoom())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, () => loadPlayers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chapters', filter: `room_id=eq.${roomId}` }, () => loadStory())
      .on('presence', { event: 'sync' }, () => {
        online.value = new Set(Object.keys(channel!.presenceState()))
      })
      .subscribe(async (state) => {
        connected.value = state === 'SUBSCRIBED'
        if (state === 'SUBSCRIBED') {
          await channel!.track({ at: Date.now() })
          // Catch up on anything missed while (re)connecting. Database events can still be lost
          // for a moment after SUBSCRIBED, so re-read again shortly afterwards.
          await safeRefresh()
          timers.push(setTimeout(safeRefresh, 1500), setTimeout(safeRefresh, 4000))
        }
      })
  }

  /** Never throws: a failed background re-read just waits for the next one. */
  async function safeRefresh() {
    try {
      await refresh()
    } catch {
      // offline or server unreachable: the next resync retries
    }
  }

  function onVisible() {
    if (document.visibilityState === 'visible') safeRefresh()
  }
  function onNetwork() {
    networkOnline.value = navigator.onLine
    if (navigator.onLine) safeRefresh()
  }

  onMounted(async () => {
    try {
      userId.value = (await ensureSession()).userId
      await Promise.all([refresh(), syncClock()])
      if (!room.value) {
        status.value = 'not_found'
        return
      }
      subscribe(room.value.id)
      status.value = 'ready'
      // Safety net: realtime is the fast path, but a lost event must never leave a screen stuck.
      resync = setInterval(safeRefresh, 5000)
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('online', onNetwork)
      window.addEventListener('offline', onNetwork)
      networkOnline.value = navigator.onLine
    } catch {
      status.value = 'error'
    }
  })

  onBeforeUnmount(() => {
    if (channel) supabase.removeChannel(channel)
    clearInterval(resync)
    timers.forEach(clearTimeout)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onNetwork)
    window.removeEventListener('offline', onNetwork)
  })

  return { room, players, fragments, chapters, submitters, clockOffset, online, userId, me, isHost, status, connected, networkOnline, refresh }
}
