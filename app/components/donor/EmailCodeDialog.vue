<template>
  <!--
    Confirm the signed-in donor's address with the code mailed to it
    (2026-11-03; it was a link before): from the dashboard, the QR page and
    the profile. Built on the portal's confirm dialog (ConfirmDialog.vue).
  -->
  <Teleport to="body">
    <Transition name="ecd" appear>
      <div class="ecd-backdrop" @click.self="close">
        <form
          class="ecd"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ecd-title"
          novalidate
          v-focus-trap
          @dialog-escape="close"
          @submit.prevent="verify"
        >
          <div class="ecd__head">
            <span class="ecd__icon" aria-hidden="true"><AssetIcon name="mail" :size="20" /></span>
            <h2 id="ecd-title" class="ecd__title">Verify your email</h2>
          </div>

          <p class="ecd__sent" :class="{ 'ecd__sent--error': sendFailed }" role="status">
            <template v-if="sending">Sending a code to <strong>{{ email }}</strong>…</template>
            <template v-else-if="sendFailed">{{ sendError }}</template>
            <template v-else>Code sent to <strong>{{ email }}</strong></template>
          </p>

          <CodeInput
            ref="codeInput"
            v-model="code"
            class="ecd__code"
            :length="CODE_LENGTH"
            :invalid="Boolean(error)"
            :disabled="busy"
            @complete="verify"
          />

          <p v-if="error" class="ecd__error" role="alert">{{ error }}</p>

          <button type="button" class="ecd__resend" :disabled="busy || sending || cooldown > 0" @click="send">
            {{ resendLabel }}
          </button>

          <div class="ecd__actions">
            <button type="button" class="ecd-btn ecd-btn--safe" @click="close">Cancel</button>
            <button type="submit" class="ecd-btn ecd-btn--go" :disabled="busy || code.length < CODE_LENGTH">
              {{ verifying ? 'Verifying…' : 'Verify' }}
            </button>
          </div>
        </form>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import CodeInput from '~/components/common/CodeInput.vue'
import { authService } from '~/api/auth/AuthService'

const props = defineProps({
  /** The signed-in donor's address. */
  email: { type: String, required: true },
  /** A code has just gone out already (a changed address), so none is sent on opening. */
  sent: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'verified'])

const CODE_LENGTH = 6
const RESEND_AFTER_S = 60

const codeInput = ref(null)
const code = ref('')
const error = ref('')
const verifying = ref(false)
const verified = ref(false)
const busy = computed(() => verifying.value || verified.value)

const sending = ref(false)
const sendFailed = ref(false)
const sendError = ref('')
const { cooldown, label: cooldownLabel, start: startCooldown } = useResendCooldown()

const resendLabel = computed(() => {
  if (cooldown.value > 0) return `Resend code in ${cooldownLabel.value}`
  return 'Resend code'
})

function close() {
  emit('close')
}

// Leaving the page closes it: the donor pages are kept alive, and the dialog
// sits on <body>, so it would otherwise stay over the next page.
const route = useRoute()
watch(() => route.path, close)

async function send() {
  if (sending.value || cooldown.value > 0) return

  sending.value = true
  sendFailed.value = false
  error.value = ''

  try {
    // POST /api/email/verification-notification (auth, throttle:3,10). The
    // code before this one stops working.
    await authService.resendVerificationEmail()
    lastSent.set(props.email, Date.now())
    code.value = ''
    startCooldown(RESEND_AFTER_S)
  } catch (err) {
    sendFailed.value = true
    sendError.value = err?.status === 429
      ? 'Too many codes requested. Wait a few minutes, or use the last code we sent.'
      : (err?.message || 'Could not send a code. Please try again.')
    if (err?.status === 429) startCooldown(120)
  } finally {
    sending.value = false
  }

  codeInput.value?.focus()
}

async function verify() {
  if (busy.value || code.value.length < CODE_LENGTH) return

  verifying.value = true
  error.value = ''

  try {
    await authService.verifyEmail(props.email, code.value)
    verified.value = true
    lastSent.delete(props.email)
    emit('verified')
  } catch (err) {
    error.value = err?.status === 429
      ? 'Too many tries. Please wait a minute, then try again.'
      : (err?.errors?.code?.[0] || err?.message || 'Could not check the code. Please try again.')
    code.value = ''
  } finally {
    verifying.value = false
  }

  if (error.value) {
    await nextTick()
    codeInput.value?.focus()
  }
}

onMounted(() => {
  if (props.sent) lastSent.set(props.email, Date.now())

  // Opened again within the minute: the code already sent still works, and
  // mailing another would make it useless before it is read.
  const since = Math.floor((Date.now() - (lastSent.get(props.email) ?? 0)) / 1000)

  if (since < RESEND_AFTER_S) {
    startCooldown(RESEND_AFTER_S - since)
  } else {
    send()
  }
})
</script>

<script>
/** Address → when this tab last had a code mailed to it. Outlives the dialog. */
const lastSent = new Map()
</script>

<style scoped>
.ecd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
}

.ecd {
  width: 100%;
  max-width: 420px;
  padding: 22px;
  border-radius: 18px;
  background: var(--rb-surface, #FFFFFF);
  box-shadow: 0 20px 48px -12px rgba(15, 23, 42, 0.35);
}

.ecd__head { display: flex; align-items: center; gap: 12px; }
.ecd__icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text, var(--rb-primary));
}
.ecd__title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--rb-text-primary, #1F2937);
}

.ecd__sent {
  margin: 14px 0 18px;
  font-size: var(--rb-fs-small, 14px);
  line-height: 1.55;
  color: var(--rb-text-secondary, #64748B);
  overflow-wrap: anywhere;
}
.ecd__sent strong { font-weight: 600; color: var(--rb-text-primary, #1F2937); }
.ecd__sent--error { color: #C62828; font-weight: 600; }

.ecd__code {
  --ci-size: 50px;
  --ci-bg: var(--rb-surface-muted, #F8FAFC);
  --ci-bg-active: var(--rb-surface, #FFFFFF);
  --ci-border: var(--rb-border, #E2E8F0);
  --ci-text: var(--rb-text-primary, #1F2937);
  --ci-accent: var(--rb-primary);
  --ci-ring: rgba(var(--rb-primary-rgb), 0.14);
  --ci-danger: #C62828;
}

.ecd__error {
  margin: 10px 0 0;
  font-size: var(--rb-fs-small, 14px);
  font-weight: 600;
  color: #C62828;
  text-align: center;
}

.ecd__resend {
  display: block;
  margin: 14px auto 0;
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--rb-primary-text, var(--rb-primary));
  font: inherit;
  font-size: var(--rb-fs-small, 14px);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.ecd__resend:hover:not(:disabled) { text-decoration: underline; text-underline-offset: 3px; }
.ecd__resend:disabled { color: var(--rb-text-secondary, #64748B); cursor: not-allowed; }
.ecd__resend:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

.ecd__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.ecd-btn {
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  font: inherit;
  font-size: var(--rb-fs-small, 14px);
  font-weight: 700;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}
.ecd-btn:active:not(:disabled) { transform: translateY(1px); }
.ecd-btn:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.ecd-btn--safe {
  border: 1px solid var(--rb-border, #E2E8F0);
  background: transparent;
  color: var(--rb-text-primary, #1F2937);
}
.ecd-btn--safe:hover { background: var(--rb-surface-hover, #F1F5F9); }
.ecd-btn--go { border: 0; background: var(--rb-primary); color: #FFFFFF; }
.ecd-btn--go:hover:not(:disabled) { background: var(--rb-primary-hover, var(--rb-primary)); }
.ecd-btn--go:disabled { opacity: 0.6; cursor: not-allowed; }

/* Dark: the card is the portal's surface. */
html.dark .ecd { background: var(--ink-surface, #1E293B); box-shadow: 0 20px 48px -12px rgba(0, 0, 0, 0.6); }
html.dark .ecd__icon { background: color-mix(in srgb, var(--rb-primary-text) 16%, transparent); }
html.dark .ecd__sent--error,
html.dark .ecd__error { color: #EF9A9A; }
html.dark .ecd__code {
  --ci-bg: var(--ink-hover, #263449);
  --ci-bg-active: var(--ink-surface, #1E293B);
  --ci-border: var(--ink-border, #334155);
  --ci-accent: var(--rb-primary-text);
  --ci-ring: color-mix(in srgb, var(--rb-primary-text) 20%, transparent);
  --ci-danger: #EF9A9A;
}
html.dark .ecd-btn--safe { border-color: var(--ink-border, #334155); }
html.dark .ecd-btn--safe:hover { background: var(--ink-hover, #263449); }

/* Phones: a sheet from the bottom, the go button on top, both full width. */
@media (max-width: 639px) {
  .ecd-backdrop { align-items: flex-end; padding: 0; }
  .ecd {
    max-width: none;
    padding: 20px 16px calc(16px + env(safe-area-inset-bottom));
    border-radius: 20px 20px 0 0;
  }
  .ecd__actions { flex-direction: column-reverse; }
  .ecd-btn { min-height: 46px; }
}

.ecd-enter-active,
.ecd-leave-active { transition: opacity 160ms ease; }
.ecd-enter-active .ecd,
.ecd-leave-active .ecd { transition: transform 180ms ease; }
.ecd-enter-from,
.ecd-leave-to { opacity: 0; }
.ecd-enter-from .ecd,
.ecd-leave-to .ecd { transform: translateY(8px) scale(0.98); }
@media (max-width: 639px) {
  .ecd-enter-from .ecd,
  .ecd-leave-to .ecd { transform: translateY(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .ecd-enter-active,
  .ecd-leave-active,
  .ecd-enter-active .ecd,
  .ecd-leave-active .ecd { transition: none; }
}
</style>
