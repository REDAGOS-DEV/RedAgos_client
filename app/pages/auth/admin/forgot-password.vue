<template>
  <main class="login-screen">
    <div class="login-shell">
      <AuthBrandPanel />

      <section class="form-panel">
        <div class="form-card">
          <div class="mobile-brand">
            <p class="brand-name">
              Red<span>Agos</span>
            </p>
            <p class="brand-subtitle">Blood Bank System</p>
          </div>

          <NuxtLink to="/auth/admin/login" class="back-link">
            <AssetIcon name="chevron-left" :size="18" />
             Back to Sign In
          </NuxtLink>

          <h1>Forgot Password</h1>

          <p class="form-subtitle">
            Enter your email and we'll send you a reset link
          </p>

          <form class="login-form" @submit.prevent="submitReset">
            <div class="field-group">
              <label for="reset-email">Email Address</label>

              <div class="input-shell">
                <span class="field-icon">
                  <AssetIcon name="mail" :size="18" />
                </span>

                <input
                  id="reset-email"
                  v-model="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  autocomplete="email"
                />
              </div>
            </div>

            <p v-if="errorMessage" class="error-message">
              {{ errorMessage }}
            </p>

            <p v-if="successMessage" class="success-message">
              {{ successMessage }}
            </p>

            <button class="sign-in-button" :disabled="loading">
              <AssetIcon name="log-in" :size="24" />
              {{ loading ? 'Sending...' : 'Send Reset Link' }}
            </button>
          </form>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup>
import { authService } from '~/api/auth/AuthService'
import AuthBrandPanel from '~/components/auth/AuthBrandPanel.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

const email = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const submitReset = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!email.value.trim()) {
    errorMessage.value = 'Please enter your email address.'
    return
  }

  loading.value = true

  try {
    await authService.forgotPassword({ email: email.value.trim() })

    // Parehas ra ang mensahe bisan wala ang email sa database — dili ta
    // mo-confirm kung kinsa ang rehistrado.
    successMessage.value = 'If this email is registered, a reset link has been sent.'
  } catch (error) {
    // Ang server naay throttle:3,10, so lahi og kahulogan ang 429: sakto ang
    // email, kinahanglan lang mohulat.
    errorMessage.value = error?.status === 429
      ? 'Too many reset requests. Please wait a few minutes and try again.'
      : error?.message || 'Unable to send reset link at this time. Please try again later.'
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

.mobile-brand {
  display: none;
}

.mobile-brand .brand-name {
  color: #1769c9;
}

.mobile-brand .brand-subtitle {
  color: #64748b;
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
  margin-top: 54px;
}

.field-group {
  margin: 0;
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
  padding: 0 14px;
  border: 1px solid #d6e0eb;
  border-radius: 8px;
  background: #ffffff;
}

.field-icon {
  display: flex;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  color: #64748b;
}

svg {
  width: 100%;
  height: 100%;
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

.sign-in-button {
  display: flex;
  width: 100%;
  height: 52px;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 12px;
  border: 0;
  border-radius: 8px;
  background: #1e6fc8;
  color: #ffffff;
  cursor: pointer;
  font-size: 16px;
  font-weight: 800;
}

.sign-in-button:hover {
  background: #185dac;
}

.sign-in-button:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.sign-in-button svg {
  width: 24px;
  height: 24px;
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
    justify-content: center;
    padding: 56px 24px;
  }

  .form-card {
    margin: 0;
  }

  .mobile-brand {
    display: block;
    margin-bottom: 48px;
  }
}

@media (max-width: 520px) {
  .form-panel {
    padding: 36px 18px;
  }

  h1 {
    font-size: 34px;
  }
}
</style>
