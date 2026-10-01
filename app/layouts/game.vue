<!-- Room pages: just the logo, so nothing distracts from writing. My stories leads back to a game. -->
<template>
  <div>
    <header class="border-b-2 border-(--ink)">
      <UContainer class="flex h-14 items-center justify-between">
        <SiteLogo />
        <UColorModeButton />
      </UContainer>
    </header>
    <slot />
  </div>
</template>
