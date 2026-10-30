<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <!-- Outside the layout so it lasts from sign-in into the portal. -->
    <WorkspaceLaunchScreen />
  </div>
</template>

<script setup lang="ts">
import WorkspaceLaunchScreen from '~/components/common/WorkspaceLaunchScreen.vue'

// Every tab reads just "RedAgos" beside the logo, whatever the page names
// itself (project owner, 2026-10-30).
useHead({ title: 'RedAgos', titleTemplate: () => 'RedAgos' })
</script>
