import type { RealtimeChannel } from '@supabase/supabase-js'
import type { PlayerRow, RoomRow } from '#shared/room'

/**
 * Live view of one room: the room row, its players and who is online. Rows are re-read on every
 * realtime change (simple and always consistent); Presence tracks who has the page open.
 */
export function useRoom(code: string) {
  const supabase = useSupabase()
  const room = ref<RoomRow | null>(null)
  const players = ref<PlayerRow[]>([])
  const online = ref(new Set<string>())
  const userId = ref<string | null>(null)
  const status = ref<'loading' | 'ready' | 'not_found' | 'error'>('loading')
  const connected = ref(false)
  let channel: RealtimeChannel | undefined

  const me = computed(() => players.value.find(p => p.user_id === userId.value) ?? null)
  const isHost = computed(() => !!room.value && room.value.host_id === userId.value)

  async function loadRoom() {
    const { data, error } = await supabase.from('rooms').select('*').eq('code', code.toUpperCase()).maybeSingle()
    if (error) throw error
    room.value = data as RoomRow | null
  }

  async function loadPlayers() {
    if (!room.value) return
    const { data, error } = await supabase.from('players').select('*').eq('room_id', room.value.id).order('seat')
    if (error) throw error
    players.value = data as PlayerRow[]
  }

  async function refresh() {
    await loadRoom()
    await loadPlayers()
  }

  function subscribe(roomId: string) {
    channel = supabase.channel(`room:${roomId}`, { config: { presence: { key: userId.value! } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => loadRoom())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, () => loadPlayers())
      .on('presence', { event: 'sync' }, () => {
        online.value = new Set(Object.keys(channel!.presenceState()))
      })
      .subscribe(async (state) => {
        connected.value = state === 'SUBSCRIBED'
        if (state === 'SUBSCRIBED') {
          await channel!.track({ at: Date.now() })
          await refresh() // catch up on anything missed while (re)connecting
        }
      })
  }

  onMounted(async () => {
    try {
      userId.value = (await ensureSession()).userId
      await refresh()
      if (!room.value) {
        status.value = 'not_found'
        return
      }
      subscribe(room.value.id)
      status.value = 'ready'
    } catch {
      status.value = 'error'
    }
  })

  onBeforeUnmount(() => {
    if (channel) supabase.removeChannel(channel)
  })

  return { room, players, online, userId, me, isHost, status, connected, refresh }
}
