<script setup lang="ts">
// Placeholder until F4 (join + lobby).
const code = useRoute().params.code as string
</script>

<template>
  <UContainer class="max-w-xl py-12">
    <h1 class="text-2xl font-bold">
      Room {{ code }}
    </h1>
  </UContainer>
</template>
