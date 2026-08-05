<template>
  <DonorSettingsPage />
</template>

<script setup>
import DonorSettingsPage from '~/components/Donor/SettingsPage.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard'
})
</script>
