<template>
  <DonorProfilePage />
</template>

<script setup>
import DonorProfilePage from '~/components/donor/ProfilePage.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true
})
</script>
