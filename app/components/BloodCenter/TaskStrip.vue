<template>
  <!-- The blood centre's "Needs you": the same counts as the sidebar's badges. -->
  <NeedsYou :tasks="tasks" :loaded="loaded" />
</template>

<script setup>
import NeedsYou from '~/components/common/NeedsYou.vue'
import { useBloodCenterTasks } from '~/composables/useBloodCenterTasks'

const { tasks, loaded, load } = useBloodCenterTasks()

// Fresh on every visit to a dashboard; the sidebar reads the same counts.
onMounted(load)
onActivated(load)
</script>
