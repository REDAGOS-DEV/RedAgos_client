<template>
  <DonorSettingsPage />
</template>

<script setup>
import DonorSettingsPage from '~/components/donor/SettingsPage.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true
})
</script>
