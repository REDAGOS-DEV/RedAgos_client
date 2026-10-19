<template>
  <AuthForgotPassword portal="hospital" />
</template>

<script setup>
import AuthForgotPassword from '~/components/auth/AuthForgotPassword.vue'

definePageMeta({
  middleware: 'hospital-portal',
})
</script>
