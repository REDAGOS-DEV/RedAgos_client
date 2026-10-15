<template>
  <AuthLoginLayout
    portal="donor"
    title="Welcome, Lifesaver!"
    subtitle="Sign in to your RedAgos account"
  >
    <template #footer>
      <p class="signup-text">
        Need an account?
        <NuxtLink to="/auth/donor/register">
          Register Now
        </NuxtLink>
      </p>
    </template>
  </AuthLoginLayout>
</template>

<script setup>
import AuthLoginLayout from '~/components/auth/AuthLoginLayout.vue'
</script>
