<template>
  <DonorQrCodePage />
</template>

<script setup>
import DonorQrCodePage from '~/components/donor/QrCodePage.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true
})
</script>
