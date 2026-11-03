<template>
  <div />
</template>

<script setup>
/**
 * Where the emailed verification link used to land. Addresses are verified
 * with a code now (2026-11-03), so a link still sitting in an inbox opens the
 * sign-in screen, which asks for a code when the address is unverified.
 */
definePageMeta({
  middleware: [() => navigateTo('/auth/login', { replace: true })],
})
</script>
