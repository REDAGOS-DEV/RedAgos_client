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

          <NuxtLink to="/login" class="back-link">
            &larr; Back to Sign In
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
                  <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16v12H4z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="m4 7 8 6 8-6" />
                  </svg>
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
              <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 3h4v18h-4" />
                <path stroke-linecap="round" stroke-linejoin="round" d="m10 17 5-5-5-5" />
                <path stroke-linecap="round" d="M15 12H3" />
              </svg>
              {{ loading ? 'Sending...' : 'Send Reset Link' }}
            </button>
          </form>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup>
import AuthBrandPanel from '~/components/auth/AuthBrandPanel.vue'

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
    await new Promise((resolve) => setTimeout(resolve, 600))
    successMessage.value = 'If this email is registered, a reset link has been sent.'
  } catch {
    errorMessage.value = 'Unable to send reset link at this time. Please try again later.'
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
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
