<template>
  <DonorProfilePage />
</template>

<script setup>
import DonorProfilePage from '~/components/Donor/ProfilePage.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard'
})
</script>
