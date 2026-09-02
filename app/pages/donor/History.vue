<template>
  <DonorHistoryPage />
</template>

<script setup>
import DonorHistoryPage from '~/components/donor/HistoryPage.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true
})
</script>
