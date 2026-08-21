<template>
  <DonorEligibilityPage />
</template>

<script setup>
import DonorEligibilityPage from '~/components/Donor/EligibilityPage.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true
})
</script>
