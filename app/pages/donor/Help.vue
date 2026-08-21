<template>
  <DonorHelpPage />
</template>

<script setup>
import DonorHelpPage from '~/components/Donor/HelpPage.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true
})
</script>
