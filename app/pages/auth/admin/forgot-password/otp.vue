<template>
  <main class="login-screen">
    <div class="login-shell">
      <AuthBrandPanel />

      <section class="form-panel">
        <div class="form-card">
          <div class="mobile-brand">
            <div class="mobile-brand-curve">
              <img :src="logo" alt="RedAgos Logo" class="mobile-logo" />
              <p class="brand-name">
                Red<span>Agos</span>
              </p>
              <p class="brand-subtitle">Blood Bank System</p>
            </div>
          </div>

          <h1>Check your email</h1>
          <p class="form-subtitle">
            Input the code that was sent to <strong>{{ maskedEmail }}</strong>
          </p>

          <form class="login-form" @submit.prevent="submitOtp">
            <div class="otp-group">
              <input
                v-for="(digit, index) in otp"
                :key="index"
                :ref="(el) => (otpRefs[index] = el)"
                v-model="otp[index]"
                type="text"
                inputmode="numeric"
                maxlength="1"
                class="otp-box"
                @input="onOtpInput(index, $event)"
                @keydown="onOtpKeydown(index, $event)"
                @paste="onOtpPaste"
              />
            </div>

            <p v-if="errorMessage" class="error-message">
              {{ errorMessage }}
            </p>

            <p v-if="successMessage" class="success-message">
              {{ successMessage }}
            </p>

            <button class="sign-in-button" :disabled="loading || !isComplete">
              {{ loading ? 'Verifying...' : 'Continue' }}
            </button>
          </form>

          <p class="resend-line">
            Didn't get any code?
            <button
              type="button"
              class="resend-link"
              :disabled="resendLoading || resendCooldown > 0"
              @click="resendCode"
            >
              {{ resendCooldown > 0 ? `Resend in ${resendCooldown}s` : (resendLoading ? 'Sending...' : 'Click to resend') }}
            </button>
          </p>

          <NuxtLink to="/auth/admin/login" class="back-to-login">
            <AssetIcon name="chevron-left" :size="14" />
            Back to log in
          </NuxtLink>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup>
import { authService } from '~/api/auth/AuthService'
import AuthBrandPanel from '~/components/auth/AuthBrandPanel.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import logo from '~/assets/images/RedAgosLogo.png'

const route = useRoute()
const router = useRouter()

// Kinahanglan naa'y email query gikan sa forgot-password page; kung wala,
// balik dayon sa forgot-password aron dili maka-request og OTP nga wala'y context.
const email = ref(route.query.email ? String(route.query.email) : '')

if (!email.value) {
  router.replace('/auth/admin/forgot-password')
}

const maskedEmail = computed(() => {
  if (!email.value) return ''
  const [name, domain] = email.value.split('@')
  if (!domain) return email.value
  const visible = name.slice(0, 2)
  return `${visible}${'*'.repeat(Math.max(name.length - 2, 3))}@${domain}`
})

const OTP_LENGTH = 6
const otp = ref(Array(OTP_LENGTH).fill(''))
const otpRefs = ref([])

const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const resendLoading = ref(false)
const resendCooldown = ref(0)
let cooldownTimer = null

const isComplete = computed(() => otp.value.every((d) => d !== ''))

const onOtpInput = (index, event) => {
  const value = event.target.value.replace(/[^0-9]/g, '')
  otp.value[index] = value.slice(-1)

  if (value && index < OTP_LENGTH - 1) {
    otpRefs.value[index + 1]?.focus()
  }
}

const onOtpKeydown = (index, event) => {
  if (event.key === 'Backspace' && !otp.value[index] && index > 0) {
    otpRefs.value[index - 1]?.focus()
  }
}

const onOtpPaste = (event) => {
  event.preventDefault()
  const pasted = event.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, OTP_LENGTH)
  pasted.split('').forEach((char, i) => {
    otp.value[i] = char
  })
  const nextIndex = Math.min(pasted.length, OTP_LENGTH - 1)
  otpRefs.value[nextIndex]?.focus()
}

const startCooldown = () => {
  resendCooldown.value = 30
  clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    resendCooldown.value -= 1
    if (resendCooldown.value <= 0) clearInterval(cooldownTimer)
  }, 1000)
}

const submitOtp = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!isComplete.value) {
    errorMessage.value = 'Please enter the complete 6-digit code.'
    return
  }

  loading.value = true

  try {
    const code = otp.value.join('')
    const { resetToken } = await authService.verifyResetOtp({
      email: email.value,
      code,
    })

    router.push({
      path: '/auth/admin/resetpass',
      query: { email: email.value, token: resetToken },
    })
  } catch (error) {
    errorMessage.value = error?.status === 429
      ? 'Too many attempts. Please wait a few minutes and try again.'
      : error?.message || 'Invalid or expired code. Please try again.'
    otp.value = Array(OTP_LENGTH).fill('')
    otpRefs.value[0]?.focus()
  } finally {
    loading.value = false
  }
}

const resendCode = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  resendLoading.value = true

  try {
    await authService.forgotPassword({ email: email.value })
    successMessage.value = 'A new code has been sent to your email.'
    startCooldown()
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to resend code right now.'
  } finally {
    resendLoading.value = false
  }
}

onUnmounted(() => clearInterval(cooldownTimer))
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.login-screen {
  min-height: 100vh;
  background: #eef4fb;
  color: #1f2937;
  font-family: var(--rb-font-sans);
}

.login-shell {
  display: grid;
  min-height: 100vh;
  grid-template-columns: 540px 1fr;
}

.form-panel {
  display: flex;
  min-height: 100vh;
  justify-content: flex-start;
  padding: 0;
}

.form-card {
  width: 100%;
  max-width: 460px;
  margin-top: 62px;
  margin-left: 140px;
}

/* ── MOBILE BRAND ── */
.mobile-brand {
  display: none;
}

.mobile-brand-curve {
  position: relative;
  width: calc(100% + 48px);
  margin: -36px -24px 20px;
  padding: 44px 24px 56px;
  background: linear-gradient(135deg, #1A237E 0%, #1565C0 55%, #2563EB 100%);
  border-radius: 0 0 50% 50% / 0 0 46px 46px;
  text-align: center;
  box-shadow: 0 12px 28px rgba(21, 101, 192, 0.25);
}

.mobile-logo {
  width: 56px;
  height: 56px;
  object-fit: contain;
  display: block;
  margin: 0 auto 10px;
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.25));
}

.mobile-brand .brand-name {
  color: #ffffff;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.01em;
  margin: 0;
}

.mobile-brand .brand-name span {
  color: #eb3535;
}

.mobile-brand .brand-subtitle {
  color: rgba(255, 255, 255, 0.82);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 4px 0 0;
}

.back-link {
  display: inline-flex;
  align-items: center;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

.back-link:hover {
  color: #334155;
}

h1 {
  margin: 46px 0 0;
  color: #1f2937;
  font-size: 38px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.18;
  text-align: center;
}

.form-subtitle {
  margin: 16px 0 0;
  color: #64748b;
  font-size: 16px;
  line-height: 1.5;
  text-align: center;
}

.login-form {
  margin-top: 40px;
}

/* ── OTP BOXES ── */
.otp-group {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.otp-box {
  width: 52px;
  height: 56px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #f8fafc;
  color: #1f2937;
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  outline: 0;
  transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
}

.otp-box:focus {
  border-color: #2563EB;
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
}

.sign-in-button {
  display: flex;
  width: 100%;
  height: 52px;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #1565C0 0%, #2563EB 100%);
  color: #ffffff;
  cursor: pointer;
  font-size: 16px;
  font-weight: 800;
  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.3);
  transition: box-shadow 150ms ease, transform 150ms ease, filter 150ms ease;
}

.sign-in-button:hover:not(:disabled) {
  filter: brightness(1.05);
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.38);
}

.sign-in-button:active:not(:disabled) {
  transform: translateY(0);
}

.sign-in-button:disabled {
  cursor: not-allowed;
  opacity: 0.72;
  transform: none;
}

.resend-line {
  margin: 20px 0 0;
  color: #64748b;
  font-size: 14px;
  text-align: center;
}

.resend-link {
  border: 0;
  background: none;
  padding: 0;
  margin-left: 4px;
  color: #2563EB;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.resend-link:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.back-to-login {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 16px;
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.back-to-login:hover {
  color: #334155;
}

.error-message,
.success-message {
  margin: 16px 0 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
  text-align: center;
}

.error-message {
  color: #dc2626;
}

.success-message {
  color: #059669;
}

@media (max-width: 1023px) {
  .login-shell {
    display: block;
  }

  .form-panel {
    position: relative;
    justify-content: center;
    padding: 0 24px 56px;
  }

  .form-card {
    margin: 0;
    text-align: center;
  }

  .mobile-brand {
    display: block;
  }

  .back-link {
    position: absolute;
    top: 16px;
    left: 18px;
    z-index: 5;
    color: #ffffff;
    background: rgba(255, 255, 255, 0.16);
    padding: 8px;
    border-radius: 999px;
    backdrop-filter: blur(4px);
  }

  .back-link:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.26);
  }

  .mobile-brand-curve {
    padding-top: 56px;
  }

  h1 {
    margin-top: 22px;
    font-size: 24px;
    line-height: 1.25;
  }

  .form-subtitle {
    margin-top: 8px;
    font-size: 14px;
  }

  .login-form {
    margin-top: 32px;
  }

  .otp-box {
    width: 44px;
    height: 48px;
    font-size: 18px;
  }
}

@media (max-width: 520px) {
  .form-panel {
    padding: 0 18px 40px;
  }

  .mobile-brand-curve {
    width: calc(100% + 36px);
    margin: -20px -18px 18px;
    padding: 52px 18px 48px;
  }

  h1 {
    font-size: 22px;
  }

  .otp-group {
    gap: 8px;
  }

  .otp-box {
    width: 40px;
    height: 46px;
    font-size: 17px;
  }
}
</style>