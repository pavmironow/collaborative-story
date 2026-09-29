<script setup lang="ts">
const code = (useRoute().params.code as string).toUpperCase()
const { room, players, fragments, chapters, submitters, clockOffset, online, userId, me, isHost, status, connected, refresh } = useRoom(code)
const hostName = computed(() => players.value.find(p => p.user_id === room.value?.host_id)?.name ?? 'Someone')

useHead({ title: computed(() => room.value ? `Room ${room.value.code} · Collaborative Story` : 'Collaborative Story') })
</script>

<template>
  <UContainer class="max-w-xl py-8">
    <div
      v-if="status === 'loading'"
      class="py-24 text-center text-muted"
      role="status"
    >
      <UIcon
        name="i-lucide-loader"
        class="size-6 animate-spin"
      />
      <p class="mt-2">
        Opening room {{ code }}…
      </p>
    </div>

    <UAlert
      v-else-if="status === 'not_found'"
      color="error"
      variant="subtle"
      icon="i-lucide-search-x"
      :title="`There is no room with the code ${code}`"
      description="Check the link or ask the host to share it again."
      :actions="[{ label: 'Create a new room', to: '/' }]"
    />

    <UAlert
      v-else-if="status === 'error' || !room"
      color="error"
      variant="subtle"
      icon="i-lucide-wifi-off"
      title="Could not connect to the room"
      description="Check your connection and reload the page."
    />

    <template v-else>
      <UAlert
        v-if="!connected"
        color="warning"
        variant="subtle"
        icon="i-lucide-wifi-off"
        title="Reconnecting…"
        description="Live updates are paused. Your place in the room is kept."
        class="mb-4"
      />

      <RoomJoinForm
        v-if="!me && room.status === 'lobby'"
        :room="room"
        :host-name="hostName"
        :player-count="players.length"
        @joined="refresh"
      />

      <UAlert
        v-else-if="!me"
        color="neutral"
        variant="subtle"
        icon="i-lucide-lock"
        title="This story has already started"
        description="The writers are fixed once a story begins. Ask the host to create a new room for you."
      />

      <RoomLobby
        v-else-if="room.status === 'lobby'"
        :room="room"
        :players="players"
        :online="online"
        :user-id="userId!"
        :is-host="isHost"
      />

      <RoomChaosWriting
        v-else-if="room.status === 'writing' && room.mode === 'chaos'"
        :key="`write-${room.current_round}`"
        :room="room"
        :players="players"
        :fragments="fragments"
        :chapters="chapters"
        :submitters="submitters"
        :user-id="userId!"
        :clock-offset="clockOffset"
        @submitted="refresh"
      />

      <RoomMerging
        v-else-if="room.status === 'merging'"
        :room="room"
      />

      <RoomChaosReveal
        v-else-if="room.status === 'reveal'"
        :room="room"
        :players="players"
        :fragments="fragments"
        :chapters="chapters"
        :is-host="isHost"
      />

      <div
        v-else-if="room.status === 'finished'"
        class="space-y-4"
      >
        <!-- F7 replaces this with the finished story page. -->
        <h1 class="text-2xl font-bold">
          The story is finished
        </h1>
        <RoomStorySoFar
          :theme="room.theme"
          :chapters="chapters"
          :fragments="fragments"
          :players="players"
          :before-round="room.rounds_total + 1"
        />
      </div>

      <UAlert
        v-else
        color="neutral"
        variant="subtle"
        icon="i-lucide-construction"
        title="This mode is not available yet"
        description="Fixed and random order are coming soon. Try Chaos Mode."
      />
    </template>
  </UContainer>
</template>
