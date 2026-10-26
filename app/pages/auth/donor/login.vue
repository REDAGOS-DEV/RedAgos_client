<template>
  <div />
</template>

<script setup>
/**
 * The old per-portal sign-in, kept so bookmarks and links still work: it
 * opens the one sign-in screen, the page asked for (?redirect) carried along.
 */
definePageMeta({
  middleware: [to => navigateTo({ path: '/auth/login', query: to.query }, { replace: true })],
})
</script>
