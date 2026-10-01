<script setup lang="ts">
const code = ref('')
const normalized = computed(() => code.value.trim().toUpperCase())
// Room codes are 5 characters (server/api/rooms/index.post.ts).
const valid = computed(() => /^[A-Z0-9]{5}$/.test(normalized.value))
function join() {
  if (valid.value) navigateTo(`/r/${normalized.value}`)
}
</script>

<template>
  <form
    class="flex gap-2"
    aria-label="Join a room with a code"
    @submit.prevent="join"
  >
    <UInput
      v-model="code"
      placeholder="Have a code? e.g. NEG9G"
      aria-label="Room code"
      :maxlength="5"
      autocapitalize="characters"
      class="min-w-0 flex-1 font-mono uppercase"
    />
    <UButton
      type="submit"
      color="neutral"
      variant="outline"
      :disabled="!valid"
    >
      Join
    </UButton>
  </form>
</template>
