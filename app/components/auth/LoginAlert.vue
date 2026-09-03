<template>
  <div
    v-if="message"
    class="login-alert"
    :class="{ 'login-alert--action': needsVerification }"
    role="alert"
  >
    <div class="login-alert__message">
      <AssetIcon name="octagon-alert" :size="16" />
      <span>{{ message }}</span>
    </div>

    <!--
      Sign-in is refused until the address is verified, so offer the resend
      rather than leaving the user with a dead end. Donor and blood-centre had
      this; hospital and admin did not, and their users saw only the raw error.
    -->
    <template v-if="needsVerification">
      <button
        type="button"
        class="login-alert__button"
        :disabled="resending"
        @click="$emit('resend')"
      >
        <AssetIcon v-if="resending" name="loader" :size="15" class="login-alert__spinner" />
        <AssetIcon v-else name="mail" :size="15" />
        {{ resending ? 'Sending…' : 'Resend verification email' }}
      </button>

      <p
        v-if="resendMessage"
        class="login-alert__note"
        :class="{ 'login-alert__note--error': resendFailed }"
      >
        <AssetIcon :name="resendFailed ? 'octagon-alert' : 'circle-check-big'" :size="14" />
        <span>{{ resendMessage }}</span>
      </p>
    </template>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

/**
 * The sign-in error banner, with the email-verification recovery path.
 *
 * Lifted out of the donor login page so all four portals show the same thing.
 * The markup was previously duplicated between donor and blood-centre, while
 * hospital and admin had a bare `<p class="error-message">` with no way for an
 * unverified user to request a fresh link.
 */
defineProps({
  /** The error to show. Empty renders nothing. */
  message: { type: String, default: '' },
  /** Whether the failure was specifically an unverified address. */
  needsVerification: { type: Boolean, default: false },
  resending: { type: Boolean, default: false },
  resendMessage: { type: String, default: '' },
  resendFailed: { type: Boolean, default: false },
})

defineEmits(['resend'])
</script>

<style scoped>
.login-alert {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid #FCA5A5;
  border-radius: 8px;
  background: #FEF2F2;
  color: #991B1B;
  font-size: 13.5px;
  line-height: 1.5;
}

.login-alert__message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.login-alert__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  align-self: flex-start;
  padding: 8px 14px;
  border: 1px solid #B91C1C;
  border-radius: 7px;
  background: transparent;
  color: #991B1B;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.login-alert__button:hover:not(:disabled) {
  background: #FEE2E2;
}

.login-alert__button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-alert__button:focus-visible {
  outline: 2px solid #B91C1C;
  outline-offset: 2px;
}

.login-alert__spinner {
  animation: login-alert-spin 0.8s linear infinite;
}

@keyframes login-alert-spin {
  to { transform: rotate(360deg); }
}

.login-alert__note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  font-size: 12.5px;
  color: #166534;
}

.login-alert__note--error {
  color: #991B1B;
}

.dark .login-alert {
  border-color: #7F1D1D;
  background: #2A1414;
  color: #FCA5A5;
}

.dark .login-alert__button {
  border-color: #DC2626;
  color: #FCA5A5;
}

.dark .login-alert__button:hover:not(:disabled) {
  background: #3B1B1B;
}

.dark .login-alert__note {
  color: #86EFAC;
}

.dark .login-alert__note--error {
  color: #FCA5A5;
}

@media (prefers-reduced-motion: reduce) {
  .login-alert__spinner { animation: none; }
}
</style>
