<template>
  <DonorNotificationsPage />
</template>

<script setup>
import DonorNotificationsPage from '~/components/Donor/NotificationsPage.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true
})
</script>
