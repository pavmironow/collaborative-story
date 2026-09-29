<script setup lang="ts">
useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: { lang: 'en' }
})

useSeoMeta({
  title: 'Collaborative Story',
  description: 'Write a story together with friends in short, timed rounds.'
})
</script>

<template>
  <UApp>
    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
