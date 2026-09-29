<script setup lang="ts">
import type { Story } from '#shared/story'

const code = (useRoute().params.code as string).toUpperCase()
const { data: story, error } = await useFetch<Story>(`/api/stories/${code}`)

const title = computed(() => story.value ? story.value.theme : 'Collaborative Story')
const description = computed(() => story.value
  ? `A story written together by ${story.value.authors.map(a => a.name).join(', ')}.`
  : 'Write a story together with friends in short, timed rounds.')
useSeoMeta({ title, ogTitle: title, description, ogDescription: description })
</script>

<template>
  <UContainer class="max-w-2xl py-10">
    <template v-if="story">
      <StoryView :story="story" />
      <div class="mt-10 space-y-3">
        <StoryShareButton
          :code="code"
          :title="story.theme"
        />
        <UButton
          to="/"
          size="xl"
          block
          color="neutral"
          variant="outline"
          icon="i-lucide-plus"
        >
          Write your own story
        </UButton>
      </div>
    </template>
    <UAlert
      v-else
      color="neutral"
      variant="subtle"
      icon="i-lucide-book-open"
      :title="error?.statusCode === 404 ? error.statusMessage : 'Could not load this story'"
      :description="error?.statusCode === 404 ? 'If you are one of the writers, open the room link to keep playing.' : 'Check your connection and reload the page.'"
      :actions="[{ label: 'Go to the room', to: `/r/${code}` }, { label: 'Write your own story', to: '/', variant: 'outline' }]"
    />
  </UContainer>
</template>
