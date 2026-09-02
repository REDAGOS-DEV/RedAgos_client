<template>
  <DonorHelpPage />
</template>

<script setup>
import DonorHelpPage from '~/components/donor/HelpPage.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true
})
</script>
