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
</script>
