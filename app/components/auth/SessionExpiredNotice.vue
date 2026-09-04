<template>
  <p v-if="expired" class="session-notice" role="status">
    Your session ended, so you were signed out. Sign in again to pick up where you left off.
  </p>
</template>

<script setup>
/**
 * Explains an involuntary bounce to the login page.
 *
 * `plugins/session-expiry.client.ts` adds `?reason=session_expired` when a 401
 * forces a redirect. Without this the user is simply thrown back to a login
 * form with no indication of why, which reads as the app losing their work at
 * random.
 *
 * Reads the query itself so each login page adds one tag and no logic.
 */
const route = useRoute()

const expired = computed(() => route.query.reason === 'session_expired')
</script>

<style scoped>
.session-notice {
  margin: 0 0 18px;
  padding: 10px 14px;
  border: 1px solid #F3DDBB;
  border-radius: 8px;
  background: #FDF6EC;
  color: #B45309;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.55;
}

.dark .session-notice {
  border-color: #7C5E10;
  background: #2A2312;
  color: #FDE68A;
}
</style>
