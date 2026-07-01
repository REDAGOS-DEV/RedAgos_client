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

          <NuxtLink
            to="/"
            class="back-link"
          >
            &larr; Back to Home
          </NuxtLink>

          <h1>Welcome Back!</h1>

          <p class="form-subtitle">
            Sign in to your RedAgos account
          </p>

          <form
            class="login-form"
            @submit.prevent="login"
          >
            <div class="field-group">
              <label for="email">Email Address</label>

              <div class="input-shell">
                <span class="field-icon">
                  <svg
                    aria-hidden="true"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M4 6h16v12H4z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="m4 7 8 6 8-6"
                    />
                  </svg>
                </span>

                <input
                  id="email"
                  v-model="email"
                  type="email"
                  class="typed-input"
                  :class="{ typed: typed.email }"
                  placeholder="you@example.com"
                  required
                  autocomplete="email"
                >
              </div>
            </div>

            <div class="field-group password-group">
              <label for="password">Password</label>

              <div class="input-shell">
                <span class="field-icon">
                  <svg
                    aria-hidden="true"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <rect
                      width="14"
                      height="10"
                      x="5"
                      y="11"
                      rx="2"
                    />
                    <path
                      stroke-linecap="round"
                      d="M8 11V8a4 4 0 1 1 8 0v3"
                    />
                  </svg>
                </span>

                <input
                  id="password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  class="typed-input"
                  :class="{ typed: typed.password }"
                  placeholder="********"
                  required
                  autocomplete="current-password"
                >

                <button
                  type="button"
                  class="icon-button"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                >
                  <svg
                    aria-hidden="true"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div class="forgot-row">
              <button
                type="button"
                class="link-button"
                @click="goToForgotPassword"
              >
                Forgot password?
              </button>
            </div>

            <p
              v-if="errorMessage"
              class="error-message"
            >
              {{ errorMessage }}
            </p>

            <button
              class="sign-in-button"
              :disabled="loading"
            >
              <svg
                aria-hidden="true"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="3"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 3h4v18h-4"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m10 17 5-5-5-5"
                />
                <path
                  stroke-linecap="round"
                  d="M15 12H3"
                />
              </svg>
              {{ loading ? 'Signing In...' : 'Sign In' }}
            </button>

            <p class="signup-text">
              Need an account?
              <NuxtLink to="/signup">
                Sign Up
              </NuxtLink>
            </p>

            <div class="divider">
              <span></span>
              <p>or sign in as</p>
              <span></span>
            </div>

            <div class="role-grid">
              <button
                type="button"
                class="role-button hospital"
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4 21h16M6 21V7l6-3 6 3v14M9 11h2M13 11h2M9 15h2M13 15h2"
                  />
                </svg>
                Hospital
              </button>

              <button
                type="button"
                class="role-button blood-center"
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 3s6 6.1 6 10a6 6 0 1 1-12 0c0-3.9 6-10 6-10z"
                  />
                  <path
                    stroke-linecap="round"
                    d="M9.5 14.5a2.5 2.5 0 0 0 5 0"
                  />
                </svg>
                Blood Center
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup>
import { authService } from '~~/api/auth/AuthService'
import { reactive, watch } from 'vue'
import AuthBrandPanel from '~/components/auth/AuthBrandPanel.vue'

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const typed = reactive({ email: false, password: false })

watch(email, (value) => {
  typed.email = value.trim().length > 0
})

watch(password, (value) => {
  typed.password = value.trim().length > 0
})

const goToForgotPassword = () => {
  return navigateTo('/forgot-password')
}

const login = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await authService.login({
      email: email.value,
      password: password.value,
    })

    const token = response?.token || response?.access_token || response?.data?.token || response?.data?.access_token

    if (token) {
      localStorage.setItem('_token', token)
    }

    await navigateTo('/')
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : 'Unable to sign in. Please check your credentials.'
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

.password-group {
  margin-top: 19px;
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

.icon-button {
  display: flex;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  margin-left: 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
}

.icon-button:hover {
  background: #f1f5f9;
  color: #334155;
}

.icon-button svg {
  width: 18px;
  height: 18px;
}

.forgot-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 22px;
}

.forgot-row a,
.signup-text a {
  color: #1266c3;
  font-size: 14px;
  font-weight: 800;
  text-decoration: none;
}

.forgot-row a:hover,
.signup-text a:hover {
  color: #0d4f9c;
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

.error-message {
  margin: 16px 0 0;
  color: #dc2626;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}

.signup-text {
  margin: 24px 0 0;
  color: #64748b;
  font-size: 14px;
  text-align: center;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 44px;
}

.divider span {
  height: 1px;
  flex: 1;
  background: #d5dde7;
}

.divider p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
}

.role-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 44px;
}

.role-button {
  display: flex;
  height: 46px;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 1px solid #d6e0eb;
  border-radius: 8px;
  background: #ffffff;
  cursor: pointer;
  font-size: 16px;
  font-weight: 800;
}

.role-button svg {
  width: 20px;
  height: 20px;
}

.hospital {
  color: #1266c3;
}

.hospital:hover {
  border-color: #1266c3;
}

.blood-center {
  color: #2da1ff;
}

.blood-center:hover {
  border-color: #2da1ff;
}

@keyframes logoFloat{ 0%,100%{ transform:translateY(0);} 50% { transform:translateY(-8px);} }
@keyframes float{ 0%,100%{ transform:translateY(0);} 50%{ transform:translateY(-18px);} }
@keyframes floatParticle { 0%, 100% { transform:translateY(0);} 50% { transform:translateY(-20px);} }

@media (max-width: 1023px) {
  .login-shell {
    display: block;
  }

  .brand-panel {
    display: none;
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

  .role-grid {
    grid-template-columns: 1fr;
  }
}
</style>