<template>
  <DonorHistoryPage />
</template>

<script setup>
import DonorHistoryPage from '~/components/Donor/HistoryPage.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true
})
</script>
