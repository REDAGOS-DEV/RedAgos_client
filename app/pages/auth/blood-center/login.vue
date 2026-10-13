<template>
  <AuthLoginLayout
    portal="blood-center"
    title="Welcome, Blood Steward!"
    subtitle="Sign in to your blood center account"
    license-hint="Your blood center's license, printed on its DOH certificate."
  >
    <template #footer>
      <!-- No self-registration link: a RedAgos administrator creates the
           facility and its supervisor, and the supervisor adds staff
           from Staff Accounts. So staff are pointed at their supervisor. -->
      <p class="signup-text">
        No account yet? Ask your blood center supervisor to add you.
      </p>
    </template>
  </AuthLoginLayout>
</template>

<script setup>
import AuthLoginLayout from '~/components/auth/AuthLoginLayout.vue'
</script>
