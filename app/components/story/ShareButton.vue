<script setup lang="ts">
const props = defineProps<{ code: string, title: string }>()

const url = computed(() => import.meta.client ? `${window.location.origin}/s/${props.code}` : `/s/${props.code}`)
const copied = ref(false)

async function share() {
  if (navigator.share) {
    try {
      await navigator.share({ title: props.title, url: url.value })
      return
    } catch {
      // cancelled or unavailable: fall back to copying
    }
  }
  await navigator.clipboard.writeText(url.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <UButton
    size="xl"
    block
    :icon="copied ? 'i-lucide-check' : 'i-lucide-share-2'"
    :color="copied ? 'success' : 'primary'"
    @click="share"
  >
    {{ copied ? 'Link copied' : 'Share the story' }}
  </UButton>
</template>
