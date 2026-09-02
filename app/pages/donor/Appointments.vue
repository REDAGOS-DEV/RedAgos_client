<template>
  <DonorAppointmentsPage />
</template>

<script setup>
import DonorAppointmentsPage from '~/components/donor/AppointmentsPage.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true
})
</script>
