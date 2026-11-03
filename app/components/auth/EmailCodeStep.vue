<template>
  <!--
    Enter the code mailed to the address (2026-11-03), the way an address is
    verified now in place of a link. Registration shows it once the account is
    made; the sign-in screen shows it when sign-in is refused for an unverified
    address. What follows `verified` is the parent's.
  -->
  <section class="code-step" aria-labelledby="code-step-title">
    <span class="code-step__icon"><AssetIcon name="mail" :size="26" /></span>

    <header class="au-header">
      <h1 id="code-step-title">Check your email</h1>
      <p>Enter the 6-digit code we sent to</p>
    </header>

    <p class="code-step__email">{{ email }}</p>

    <form class="code-step__form" novalidate @submit.prevent="verify">
      <CodeInput
        id="verification-code"
        ref="codeInput"
        v-model="code"
        class="code-step__code"
        :length="CODE_LENGTH"
        :invalid="Boolean(error)"
        :disabled="busy"
        @complete="verify"
      />

      <p v-if="error" class="au-error code-step__error" role="alert">{{ error }}</p>

      <button type="submit" class="au-btn" :disabled="busy || code.length < CODE_LENGTH">
        <AssetIcon
          :name="verifying ? 'loader' : (verified ? 'circle-check-big' : 'shield-check')"
          :size="18"
          :class="{ 'au-spinner': verifying }"
        />
        {{ verifying ? 'Verifying...' : (verified ? 'Verified' : 'Verify email') }}
      </button>
    </form>

    <p class="code-step__resend">
      Didn't get it?
      <button type="button" class="au-link" :disabled="busy || resending || cooldown > 0" @click="resend">
        {{ resendLabel }}
      </button>
    </p>

    <p
      v-if="resendNote"
      class="code-step__note"
      :class="{ 'code-step__note--error': resendFailed }"
      role="status"
    >
      {{ resendNote }}
    </p>

    <slot name="footer" />
  </section>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import CodeInput from '~/components/common/CodeInput.vue'
import { authService } from '~/api/auth/AuthService'

const props = defineProps({
  /** The address the code went to. */
  email: { type: String, required: true },
})

const emit = defineEmits(['verified'])

const CODE_LENGTH = 6

const codeInput = ref(null)
const code = ref('')
const error = ref('')
const verifying = ref(false)
const verified = ref(false)
const busy = computed(() => verifying.value || verified.value)

const resending = ref(false)
const resendNote = ref('')
const resendFailed = ref(false)
const { cooldown, label: cooldownLabel, start: startCooldown } = useResendCooldown()

const resendLabel = computed(() => {
  if (resending.value) return 'Sending...'
  if (cooldown.value > 0) return `Resend code in ${cooldownLabel.value}`
  return 'Resend code'
})

async function verify() {
  if (busy.value || code.value.length < CODE_LENGTH) return

  verifying.value = true
  error.value = ''

  try {
    await authService.verifyEmail(props.email, code.value)
    verified.value = true
    emit('verified')
  } catch (err) {
    error.value = err?.status === 429
      ? 'Too many tries. Please wait a minute, then try again.'
      : (err?.errors?.code?.[0] || err?.message || 'Could not check the code. Please try again.')
    code.value = ''
  } finally {
    verifying.value = false
  }

  // Ready for the next try: the field was disabled while the code was checked.
  if (error.value) {
    await nextTick()
    codeInput.value?.focus()
  }
}

async function resend() {
  if (resending.value || cooldown.value > 0) return

  resending.value = true
  resendNote.value = ''
  resendFailed.value = false

  try {
    // POST /api/email/resend-verification (public, throttle:3,10). The reply is
    // the same whatever the address, and the code before this one stops working.
    await authService.resendVerificationEmailFor(props.email)
    resendNote.value = 'We sent a new code. Use the newest one.'
    code.value = ''
    error.value = ''
    startCooldown(60)
  } catch (err) {
    resendFailed.value = true
    resendNote.value = err?.status === 429
      ? 'Too many codes requested. Please wait a few minutes before asking again.'
      : (err?.message || 'Could not send a new code. Please try again.')
    if (err?.status === 429) startCooldown(120)
  } finally {
    resending.value = false
  }

  codeInput.value?.focus()
}

onMounted(() => {
  // A code has only just gone out, so a resend straight away would replace it
  // before it arrives.
  startCooldown(30)
  codeInput.value?.focus()
})
</script>

<style scoped>
.code-step { text-align: center; }

.code-step__icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  background: var(--au-accent-soft);
  color: var(--au-accent-text);
}

.code-step .au-header { margin-bottom: 12px; }

.code-step__email {
  display: inline-block;
  max-width: 100%;
  margin: 0 0 24px;
  padding: 8px 16px;
  border-radius: 999px;
  background: var(--au-panel);
  color: var(--au-text);
  font-weight: 700;
  overflow-wrap: anywhere;
}

.code-step__form {
  display: grid;
  gap: 14px;
}

.code-step__code {
  --ci-bg: var(--au-field);
  --ci-bg-active: var(--au-field-focus);
  --ci-border: var(--au-border);
  --ci-text: var(--au-text);
  --ci-accent: var(--au-accent);
  --ci-ring: var(--au-accent-soft);
  --ci-danger: var(--au-danger);
  --ci-radius: var(--au-radius);
}

.code-step__error { text-align: center; }

.code-step__resend {
  margin: 20px 0 0;
  font-size: 14px;
  color: var(--au-text-2);
}
.code-step__resend .au-link {
  margin-right: 0;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.code-step__resend .au-link:disabled {
  color: var(--au-muted);
  text-decoration: none;
  cursor: not-allowed;
}

.code-step__note {
  margin: 8px 0 0;
  font-size: 13.5px;
  color: var(--au-text-2);
}
.code-step__note--error { color: var(--au-danger); font-weight: 600; }

@media (max-width: 900px) {
  .code-step__code { --ci-bg: rgba(255, 255, 255, 0.8); --ci-bg-active: #fff; }
}
</style>
