<template>
  <div class="verify-page">
    <div class="verify-card">
      <div class="verify-icon" :class="`verify-icon--${state}`">
        <AssetIcon :name="stateIcon" :size="26" />
      </div>

      <h1 class="verify-title">{{ stateTitle }}</h1>
      <p class="verify-text">{{ stateText }}</p>

      <div v-if="state !== 'verifying'" class="verify-actions">
        <!--
          Ang naka-abot dinhi kay kasagaran bag-o pa ka-rehistro ug wala pa
          naka-sign in — dili man gyud siya makasulod hangtod karon. Ang
          dashboard kay para ra sa naay session (pananglitan, gi-usab niya ang
          email samtang naka-login, nga mo-balik sa unverified).
        -->
        <NuxtLink
          v-if="state === 'success'"
          :to="hasSession ? '/donor/dashboard' : '/auth/donor/login'"
          class="btn-primary"
        >
          {{ hasSession ? 'Go to dashboard' : 'Continue to sign in' }}
        </NuxtLink>

        <template v-else>
          <!--
            Walay session ang bag-ong rehistro, so ang address ang ipangayo ug
            ang guest resend endpoint ang gamiton. Kung naay token, ang
            authenticated nga endpoint ra — kabalo na siya kung kinsa.
          -->
          <input
            v-if="!hasSession"
            v-model="resendEmail"
            type="email"
            class="verify-input"
            placeholder="you@example.com"
            autocomplete="email"
            aria-label="Email address"
          >

          <button
            type="button"
            class="btn-primary"
            :disabled="resending || (!hasSession && !resendEmail.trim())"
            @click="resendVerification"
          >
            {{ resending ? 'Sending...' : 'Send a new verification email' }}
          </button>

          <p
            v-if="resendMessage"
            class="verify-note"
            :class="{ 'verify-note--error': resendFailed }"
          >
            {{ resendMessage }}
          </p>

          <NuxtLink to="/auth/donor/login" class="btn-outline">
            Back to login
          </NuxtLink>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { authService } from '~/api/auth/AuthService'

definePageMeta({ layout: 'default' })

// 'verifying' | 'success' | 'error'
const state = ref('verifying')
const errorMessage = ref('')

// Naay token sa browser — ibig sabon naka-sign in siya samtang gi-abli ni nga
// link. Kasagaran dili, kay ang verification kay parte na sa registration.
const hasSession = ref(false)
const resendEmail = ref('')
const resending = ref(false)
const resendMessage = ref('')
const resendFailed = ref(false)

const stateIcon = computed(() => ({
  verifying: 'loader',
  success: 'circle-check-big',
  error: 'octagon-alert',
}[state.value]))

const stateTitle = computed(() => ({
  verifying: 'Verifying your email...',
  success: 'Email verified',
  error: 'We could not verify your email',
}[state.value]))

const stateText = computed(() => {
  if (state.value === 'verifying') return 'Hang tight while we confirm your address.'
  if (state.value === 'success') {
    return 'Your address is confirmed. You can now book appointments and receive your check-in QR code.'
  }
  return errorMessage.value
})

/**
 * Duha ka klase sa 403 ang mahatag sa /email/verify, ug lahi ang hinungdan sa
 * matag usa:
 *
 *   - Walay `code` sa body: ang `signed` middleware ang mi-reject, so expired na
 *     ang link (60 minutos) o na-usab ang query string.
 *   - `code = invalid_verification_link`: OK ang signature, pero wala mo-match
 *     ang hash batok sa email nga naa sa account karon. Gi-pirmahan ang link
 *     batok sa sha1() sa address niadtong panahona nga gi-send siya, so
 *     mahitabo ni kung na-usab ang email address human ma-send ang link.
 *
 * Kaniadto pareho ra silag mensahe ("expired"), maong wala gyud makatabang ang
 * gi-ingon sa screen sa tinuod nga hinungdan.
 */
function describeFailure(err) {
  if (err?.data?.code === 'invalid_verification_link') {
    return 'This link was issued for a different email address, so it no longer matches your account. If you changed your address recently, request a new verification email below.'
  }

  if (err?.status === 403) {
    return 'This verification link has expired. Links are only valid for 60 minutes — request a new one below.'
  }

  if (err?.status === 429) {
    return 'Too many verification attempts. Please wait a minute, then reload this page.'
  }

  return err?.message || 'Something went wrong while verifying your email. Please try again.'
}

async function resendVerification() {
  resending.value = true
  resendMessage.value = ''
  resendFailed.value = false

  try {
    if (hasSession.value) {
      // POST /api/email/verification-notification (auth:sanctum, throttle:3,10)
      // 204 ang balik — walay body.
      await authService.resendVerificationEmail()
      resendMessage.value = 'Sent. Check your inbox for a fresh link, valid for 60 minutes.'
    } else {
      // POST /api/email/resend-verification (public, throttle:3,10). Pareho ra
      // ang tubag bisan unsa pa ang address, so ang server nga mensahe ang
      // ipakita — dili nato madugangan og butang nga wala niya gisulti.
      const response = await authService.resendVerificationEmailFor(resendEmail.value.trim())
      resendMessage.value = response?.message
        || 'If that address is registered and still unverified, a new verification link is on its way.'
    }
  } catch (err) {
    console.error('Failed to resend verification email:', err)
    resendFailed.value = true

    if (err?.status === 401) {
      // Wala nay bili ang token, so ang guest nga agianan na lang ang gamiton.
      hasSession.value = false
      resendMessage.value = 'Your session has expired. Enter your email address above and try again.'
    } else if (err?.status === 429) {
      resendMessage.value = 'Too many requests. Please wait a few minutes before trying again.'
    } else {
      resendMessage.value = err?.message || 'Could not send the verification email. Please try again.'
    }
  } finally {
    resending.value = false
  }
}

onMounted(async () => {
  hasSession.value = !!localStorage.getItem('_token')

  // Ang tibuok query string kay i-forward nga verbatim padulong sa API. Ang
  // `signed` middleware sa Laravel mo-validate sa signature batok sa raw nga
  // query string, so dili gyud ni mahimo nga i-rebuild o i-reorder.
  const rawQuery = window.location.search.replace(/^\?/, '')

  if (!rawQuery) {
    state.value = 'error'
    errorMessage.value = 'This verification link is incomplete. Please use the link from your email.'
    return
  }

  try {
    // POST /api/email/verify?<verbatim query>
    // 200 kung bag-o pa ma-verify, 204 kung na-verify na sauna.
    await authService.verifyEmail(rawQuery)
    state.value = 'success'
  } catch (err) {
    console.error('Failed to verify email:', err)
    state.value = 'error'
    errorMessage.value = describeFailure(err)
  }
})
</script>

<style scoped>
.verify-page {
  --primary: #1565c0;
  --accent: #d32f2f;
  --success: #2e7d32;
  --text-primary: #1f2937;
  --text-secondary: #9ca3af;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #F5F7FA;
}

.verify-card {
  width: 100%;
  max-width: 420px;
  padding: 32px 28px;
  border-radius: 16px;
  background: white;
  border: 1px solid #eef0f3;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.verify-icon {
  width: 52px;
  height: 52px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.verify-icon--verifying { background: #eaf3fc; color: var(--primary); }
.verify-icon--success { background: #eaf6ea; color: var(--success); }
.verify-icon--error { background: #fbeaea; color: var(--accent); }

.verify-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.verify-text {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.verify-actions {
  margin-top: 24px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.verify-note {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--success);
}

.verify-note--error { color: var(--accent); }

.btn-primary,
.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  text-decoration: none;
}

.verify-input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  color: var(--text-primary);
  font: inherit;
  font-size: 13.5px;
  outline: none;
}

.verify-input:focus {
  border-color: var(--primary);
  background: white;
}

.btn-primary { background: var(--primary); color: white; }
.btn-outline { background: #f3f4f6; color: var(--text-primary); }

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

:global(.dark .verify-page) {
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  background: #0F172A;
}

:global(.dark .verify-card) {
  background: #1E293B;
  border-color: #334155;
}

:global(.dark .btn-outline) {
  background: #263449;
  color: #E2E8F0;
}

:global(.dark .verify-input) {
  border-color: #334155;
  background: #263449;
  color: #E2E8F0;
}
</style>
