<script setup lang="ts">
const code = (useRoute().params.code as string).toUpperCase()
const { room, players, online, userId, me, isHost, status, connected, refresh } = useRoom(code)
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

      <div v-else>
        <!-- F5 replaces this with the writing / waiting screens. -->
        <h1 class="text-2xl font-bold">
          The story has started
        </h1>
        <p class="mt-2 text-muted">
          Round {{ room.current_round }} of {{ room.rounds_total }} · status: {{ room.status }}
        </p>
      </div>
    </template>
  </UContainer>
</template>
