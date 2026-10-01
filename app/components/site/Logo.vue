<script setup lang="ts">
/** `link: false` inside UHeader's title slot, which already wraps it in a link to "/". */
withDefaults(defineProps<{ link?: boolean }>(), { link: true })
</script>

<template>
  <NuxtLink
    v-if="link"
    to="/"
    aria-label="Collaborative Story, home"
    class="flex items-center gap-2 font-display text-lg font-bold text-highlighted"
  >
    <SiteLogoMark />
  </NuxtLink>
  <span
    v-else
    class="flex items-center gap-2 font-display text-lg font-bold text-highlighted"
  >
    <SiteLogoMark />
  </span>
</template>
