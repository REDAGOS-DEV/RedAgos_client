<template>
  <!-- The blood centre's "Needs you": the same counts as the sidebar's badges. -->
  <NeedsYou :tasks="tasks" :loaded="loaded" />
</template>

<script setup>
import NeedsYou from '~/components/common/NeedsYou.vue'
import { useBloodCenterTasks } from '~/composables/useBloodCenterTasks'
import { onPageReturn } from '~/composables/useKeptAlive'

const { tasks, loaded, load } = useBloodCenterTasks()

// Fresh on every visit to a dashboard, kept alive or not; the sidebar reads
// the same counts. (onActivated also fires on the first mount, which loaded twice.)
onMounted(load)
onPageReturn(load)
</script>
