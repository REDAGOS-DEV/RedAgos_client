<template>
  <DonorQrCodePage />
</template>

<script setup>
import DonorQrCodePage from '~/components/Donor/QrCodePage.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard'
})
</script>
