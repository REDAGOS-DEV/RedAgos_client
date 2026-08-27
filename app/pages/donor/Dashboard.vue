<template>
  <DonorDashboardPage />
</template>

<script setup>
import DonorDashboardPage from '~/components/Donor/DashboardPage.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true
})
</script>
