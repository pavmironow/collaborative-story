<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const items = computed<NavigationMenuItem[]>(() => [
  { label: 'My stories', to: '/stories', icon: 'i-lucide-library', active: route.path.startsWith('/stories') },
  { label: 'How to play', to: '/how-to-play', icon: 'i-lucide-circle-help', active: route.path === '/how-to-play' }
])
</script>

<template>
  <div>
    <UHeader
      title="Collaborative Story"
      mode="drawer"
      :toggle="{ color: 'neutral', variant: 'ghost' }"
      class="border-b-2 border-(--ink)"
    >
      <template #title>
        <SiteLogo :link="false" />
      </template>

      <UNavigationMenu
        :items="items"
        variant="link"
      />

      <template #right>
        <UColorModeButton />
        <UButton
          to="/new"
          icon="i-lucide-plus"
          size="sm"
        >
          <span class="hidden sm:inline">Create room</span>
          <span class="sm:hidden">Create</span>
        </UButton>
      </template>

      <template #body>
        <UNavigationMenu
          :items="items"
          orientation="vertical"
          class="-mx-2.5"
        />
      </template>
    </UHeader>

    <slot />

    <UFooter class="mt-12 border-t-2 border-(--ink)">
      <template #left>
        <p class="text-sm text-muted">
          Write a story together, one round at a time.
        </p>
      </template>
      <template #right>
        <ULink
          to="/how-to-play"
          class="text-sm"
        >
          How to play
        </ULink>
        <ULink
          to="/stories"
          class="text-sm"
        >
          My stories
        </ULink>
      </template>
    </UFooter>
  </div>
</template>
