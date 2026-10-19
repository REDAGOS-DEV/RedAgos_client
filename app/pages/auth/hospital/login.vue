<template>
  <AuthLoginLayout
    portal="hospital"
    title="Welcome, Blood Guardian!"
    subtitle="Sign in to your hospital blood bank account"
    license-hint="Your hospital blood bank's license, printed on its DOH certificate."
  >
    <template #footer>
      <!-- No self-registration link: facility accounts are created by
           a RedAgos administrator, so there is nothing to sign up for
           here. -->
      <p class="signup-text">
        Need an account? Contact your RedAgos administrator.
      </p>
    </template>
  </AuthLoginLayout>
</template>

<script setup>
import AuthLoginLayout from '~/components/auth/AuthLoginLayout.vue'

definePageMeta({
  middleware: 'hospital-portal',
})
</script>
