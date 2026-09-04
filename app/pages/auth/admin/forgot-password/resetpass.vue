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

          <NuxtLink to="/auth/admin/login" class="back-link">
            <AssetIcon name="chevron-left" :size="18" />
          </NuxtLink>

          <h1>Set a new password</h1>

          <p class="form-subtitle">
            Your new password must be different from previously used passwords
          </p>

          <form class="login-form" @submit.prevent="submitReset">
            <div class="field-group">
              <label for="new-password">New Password*</label>

              <div class="input-shell">
                <input
                  id="new-password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Enter new password"
                  required
                  autocomplete="new-password"
                />
                <button
                  type="button"
                  class="toggle-visibility"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                >
                  <AssetIcon :name="showPassword ? 'eye' : 'eye-off'" :size="18" />
                </button>
              </div>
            </div>

            <div class="field-group">
              <label for="confirm-password">Confirm Password*</label>

              <div class="input-shell">
                <input
                  id="confirm-password"
                  v-model="confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  placeholder="Re-enter new password"
                  required
                  autocomplete="new-password"
                />
                <button
                  type="button"
                  class="toggle-visibility"
                  :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <AssetIcon :name="showConfirmPassword ? 'eye' : 'eye-off'" :size="18" />
                </button>
              </div>
            </div>

            <ul v-if="password" class="password-hints">
              <li :class="{ met: hints.length }">At least 8 characters</li>
              <li :class="{ met: hints.upperLower }">Upper &amp; lowercase letters</li>
              <li :class="{ met: hints.number }">At least one number</li>
            </ul>

            <p v-if="errorMessage" class="error-message">
              {{ errorMessage }}
            </p>

            <p v-if="successMessage" class="success-message">
              {{ successMessage }}
            </p>

            <button class="sign-in-button" :disabled="loading">
              {{ loading ? 'Resetting...' : 'Reset password' }}
            </button>
          </form>

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

// Gikan ni sa verify-otp step; kung wala'y token, dili dayon tugutan ni-abot
// diri ang user aron dili ma-bypass ang OTP verification.
const email = ref(route.query.email ? String(route.query.email) : '')
const resetToken = ref(route.query.token ? String(route.query.token) : '')

if (!email.value || !resetToken.value) {
  router.replace('/auth/admin/forgot-password')
}

const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const hints = computed(() => ({
  length: password.value.length >= 8,
  upperLower: /[a-z]/.test(password.value) && /[A-Z]/.test(password.value),
  number: /[0-9]/.test(password.value),
}))

const isValidPassword = computed(
  () => hints.value.length && hints.value.upperLower && hints.value.number,
)

const submitReset = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!isValidPassword.value) {
    errorMessage.value = 'Password does not meet the requirements above.'
    return
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }

  loading.value = true

  try {
    await authService.resetPassword({
      email: email.value,
      resetToken: resetToken.value,
      password: password.value,
    })

    successMessage.value = 'Password reset successfully. Redirecting to log in...'
    setTimeout(() => {
      router.push('/auth/admin/login')
    }, 1500)
  } catch (error) {
    errorMessage.value = error?.status === 410
      ? 'This reset link has expired. Please request a new one.'
      : error?.message || 'Unable to reset password at this time. Please try again.'
  } finally {
    loading.value = false
  }
}
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
}

.form-subtitle {
  margin: 16px 0 0;
  color: #64748b;
  font-size: 16px;
  line-height: 1.5;
}

.login-form {
  margin-top: 40px;
}

.field-group {
  margin: 0 0 24px;
}

label {
  display: block;
  color: #1f2937;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.2;
}

.input-shell {
  display: flex;
  height: 52px;
  align-items: center;
  margin-top: 12px;
  padding: 0 16px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #f8fafc;
  transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
}

.input-shell:focus-within {
  border-color: #2563EB;
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
}

input {
  width: 100%;
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: #334155;
  font: inherit;
  font-size: 14px;
}

input::placeholder {
  color: #64748b;
}

.toggle-visibility {
  display: flex;
  flex: 0 0 20px;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-left: 12px;
  border: 0;
  background: none;
  padding: 0;
  color: #64748b;
  cursor: pointer;
}

.toggle-visibility:hover {
  color: #334155;
}

.toggle-visibility svg {
  width: 100%;
  height: 100%;
}

.password-hints {
  margin: -8px 0 20px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.password-hints li {
  position: relative;
  padding-left: 20px;
  color: #94a3b8;
  font-size: 12.5px;
  font-weight: 600;
}

.password-hints li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 5px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #cbd5e1;
}

.password-hints li.met {
  color: #059669;
}

.password-hints li.met::before {
  border-color: #059669;
  background: #059669;
}

.sign-in-button {
  display: flex;
  width: 100%;
  height: 52px;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 4px;
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
    text-align: left;
    margin-top: 32px;
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
}
</style>