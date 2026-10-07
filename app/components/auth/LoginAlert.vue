<template>
  <!--
    Sign-in is refused until the address is verified, so offer the resend
    rather than leaving the user with a dead end. Donor and blood-centre had
    this; hospital and admin did not, and their users saw only the raw error.

    Three looks: a plain error (red), "verify first" (amber, it is a pending
    step, not a mistake), and "link sent" (blue, nothing is wrong any more).
  -->
  <div
    v-if="message"
    class="login-alert"
    :class="tone"
    role="alert"
  >
    <template v-if="!needsVerification">
      <div class="login-alert__row">
        <AssetIcon name="octagon-alert" :size="16" class="login-alert__icon" />
        <p class="login-alert__body">{{ message }}</p>
      </div>
    </template>

    <template v-else>
      <div class="login-alert__row" aria-live="polite">
        <AssetIcon
          :name="sent ? 'circle-check-big' : 'mail'"
          :size="16"
          class="login-alert__icon"
        />

        <div>
          <p class="login-alert__title">
            {{ sent ? 'Check your inbox' : 'Verify your email to sign in' }}
          </p>

          <p class="login-alert__body">
            <template v-if="sent">
              A new link is on its way to <strong>{{ email }}</strong>.
              Don't see it? Check your spam folder.
            </template>
            <template v-else-if="email">
              Open the verification link we sent to <strong>{{ email }}</strong>
              to activate your account.
            </template>
            <template v-else>
              {{ message }}
            </template>
          </p>
        </div>
      </div>

      <div class="login-alert__actions">
        <button
          type="button"
          class="login-alert__button"
          :disabled="resending || cooldown > 0"
          @click="$emit('resend')"
        >
          <AssetIcon v-if="resending" name="loader" :size="15" class="login-alert__spinner" />
          <AssetIcon v-else-if="cooldown <= 0" name="send" :size="15" />
          {{ buttonLabel }}
        </button>
      </div>

      <p v-if="resendFailed && resendMessage" class="login-alert__error">
        <AssetIcon name="octagon-alert" :size="14" />
        <span>{{ resendMessage }}</span>
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

/**
 * The sign-in error banner, with the email-verification recovery path.
 *
 * Lifted out of the donor login page so all four portals show the same thing.
 * The markup was previously duplicated between donor and blood-centre, while
 * hospital and admin had a bare `<p class="error-message">` with no way for an
 * unverified user to request a fresh link.
 */
const props = defineProps({
  /** The error to show. Empty renders nothing. */
  message: { type: String, default: '' },
  /** Whether the failure was specifically an unverified address. */
  needsVerification: { type: Boolean, default: false },
  resending: { type: Boolean, default: false },
  resendMessage: { type: String, default: '' },
  resendFailed: { type: Boolean, default: false },
  /** A fresh link went out; swaps the card to its "check your inbox" state. */
  sent: { type: Boolean, default: false },
  /** Seconds until the resend button unlocks again. */
  cooldown: { type: Number, default: 0 },
  /**
   * The address sign-in was refused for. Safe to show: the server only says
   * `email_not_verified` after the password checked out.
   */
  email: { type: String, default: '' },
})

defineEmits(['resend'])

const tone = computed(() => {
  if (!props.needsVerification) return 'login-alert--error'
  return props.sent && !props.resendFailed ? 'login-alert--info' : 'login-alert--warning'
})

const buttonLabel = computed(() => {
  if (props.resending) return 'Sending...'
  if (props.cooldown > 0) {
    const m = Math.floor(props.cooldown / 60)
    const s = String(props.cooldown % 60).padStart(2, '0')
    return `Resend in ${m}:${s}`
  }
  return props.sent ? 'Resend email' : 'Resend verification email'
})
</script>

<style scoped>
.login-alert {
  --tone-fg: #B42318;
  --tone-text: #7A271A;
  --tone-bg: #FEF3F2;
  --tone-border: #FECDCA;
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid var(--tone-border);
  border-radius: 12px;
  background: var(--tone-bg);
  color: var(--tone-text);
  font-size: 13px;
  line-height: 1.55;
  text-align: left;
}

.login-alert--warning {
  --tone-fg: #B54708;
  --tone-text: #7A2E0E;
  --tone-bg: #FFFAEB;
  --tone-border: #FEDF89;
}

.login-alert--info {
  --tone-fg: #1565C0;
  --tone-text: #163A63;
  --tone-bg: #EFF6FF;
  --tone-border: #C7DCF5;
}

.login-alert__row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.login-alert__icon {
  flex: 0 0 auto;
  margin-top: 2px;
  color: var(--tone-fg);
}

.login-alert__title {
  margin: 0;
  color: var(--tone-text);
  font-size: 13.5px;
  font-weight: 700;
  line-height: 1.4;
}

.login-alert__body {
  margin: 0;
  font-weight: 400;
}

.login-alert__title + .login-alert__body {
  margin-top: 2px;
}

.login-alert__body strong {
  font-weight: 600;
  overflow-wrap: anywhere;
}

/* Indent to the text column so the button lines up under the copy */
.login-alert__actions {
  padding-left: 26px;
}

.login-alert__button {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px;
  border: 1px solid var(--tone-border);
  border-radius: 10px;
  background: #ffffff;
  color: var(--tone-fg);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.12s ease;
}

.login-alert__button:hover:not(:disabled) {
  border-color: var(--tone-fg);
}

.login-alert__button:active:not(:disabled) {
  transform: scale(0.98);
}

.login-alert__button:disabled {
  cursor: not-allowed;
  color: var(--tone-text);
  opacity: 0.6;
}

.login-alert__button:focus-visible {
  outline: 2px solid var(--tone-fg);
  outline-offset: 2px;
}

.login-alert__spinner {
  animation: login-alert-spin 0.8s linear infinite;
}

@keyframes login-alert-spin {
  to { transform: rotate(360deg); }
}

.login-alert__error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  padding-left: 26px;
  color: #B42318;
  font-size: 12.5px;
}

.login-alert__error svg {
  flex-shrink: 0;
  margin-top: 2px;
}

@media (max-width: 420px) {
  .login-alert__actions,
  .login-alert__error {
    padding-left: 0;
  }

  .login-alert__button {
    width: 100%;
  }
}

/* .dark lives on <html>, outside this component, so it has to be :global */
:global(.dark .login-alert) {
  --tone-fg: #F97066;
  --tone-text: #FECDCA;
  --tone-bg: rgba(240, 68, 56, 0.10);
  --tone-border: rgba(240, 68, 56, 0.28);
}

:global(.dark .login-alert--warning) {
  --tone-fg: #FDB022;
  --tone-text: #FEF0C7;
  --tone-bg: rgba(247, 144, 9, 0.10);
  --tone-border: rgba(247, 144, 9, 0.30);
}

:global(.dark .login-alert--info) {
  --tone-fg: #64B5F6;
  --tone-text: #D6E8FB;
  --tone-bg: rgba(100, 181, 246, 0.10);
  --tone-border: rgba(100, 181, 246, 0.28);
}

:global(.dark .login-alert__button) {
  background: rgba(15, 23, 42, 0.6);
}

:global(.dark .login-alert__error) {
  color: #FDA29B;
}

@media (prefers-reduced-motion: reduce) {
  .login-alert__spinner { animation: none; }
  .login-alert__button { transition: none; }
}
</style>
