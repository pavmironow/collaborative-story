<script setup lang="ts">
/** `link: false` inside UHeader's title slot, which already wraps it in a link to "/". */
withDefaults(defineProps<{ link?: boolean }>(), { link: true })
</script>

<template>
  <component
    :is="link ? resolveComponent('NuxtLink') : 'span'"
    v-bind="link ? { 'to': '/', 'aria-label': 'Collaborative Story, home' } : {}"
    class="flex items-center gap-2 font-display text-lg font-bold text-highlighted"
  >
    <span
      class="grid size-8 place-items-center rounded-lg bg-yellow-300 text-base ring-2 ring-(--ink) shadow-[2px_2px_0_var(--ink)]"
      aria-hidden="true"
    >✒️</span>
    <span>Collaborative Story</span>
  </component>
</template>
