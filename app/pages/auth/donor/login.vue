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

          <NuxtLink to="/" class="back-link">
            <AssetIcon name="chevron-left" :size="18" />
             Back to Home
          </NuxtLink>

          <h1>Welcome, Lifesaver!</h1>

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
                  <AssetIcon name="mail" :size="18" />
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
                  <AssetIcon name="lock" :size="18" />
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
                  <AssetIcon :name="showPassword ? 'eye' : 'eye-off'" :size="18" />
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
              <AssetIcon name="log-in" :size="24" />
              {{ loading ? 'Signing In...' : 'Sign In' }}
            </button>

            <p class="signup-text">
              Need an account?
              <NuxtLink to="/auth/donor/register">
                Register Now
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
                @click="navigateTo('/auth/hospital/login')"
              >
                <AssetIcon name="hospital" :size="20" />
                Hospital
              </button>

              <button
                type="button"
                class="role-button blood-center"
                @click="navigateTo('/auth/blood-center/login')"
              >
                <AssetIcon name="blood-drop" :size="20" />
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
import { authService } from '~/api/auth/AuthService'
import { reactive, watch } from 'vue'
import logo from '~/assets/images/RedAgosLogo.png'
import AuthBrandPanel from '~/components/auth/AuthBrandPanel.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

useHead({
  title: 'Sign In · RedAgos'
})

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
  return navigateTo('/auth/donor/forgot-password')
}

const login = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await authService.login({
      email: email.value,
      password: password.value,
      role: 'donor',
    })

    const token = response?.token || response?.access_token || response?.data?.token || response?.data?.access_token

    if (token) {
      localStorage.setItem('_token', token)
    }

    const redirectPath = typeof useRoute().query.redirect === 'string'
      ? useRoute().query.redirect
      : '/donor/dashboard'

    await navigateTo(redirectPath)
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

.link-button {
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 0;
  color: #1266c3;
  font-size: 14px;
  font-weight: 800;
}

.link-button:hover {
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
  border-radius: 999px;
  background: linear-gradient(135deg, #1565C0 0%, #2563EB 100%);
  color: #ffffff;
  cursor: pointer;
  font-size: 16px;
  font-weight: 800;
  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.3);
  transition: box-shadow 150ms ease, transform 150ms ease, filter 150ms ease;
}

.sign-in-button:hover {
  filter: brightness(1.05);
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.38);
}

.sign-in-button:active {
  transform: translateY(0);
}

.sign-in-button:disabled {
  cursor: not-allowed;
  opacity: 0.72;
  transform: none;
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
  border-radius: 12px;
  background: #ffffff;
  cursor: pointer;
  font-size: 16px;
  font-weight: 800;
  transition: border-color 150ms ease, transform 150ms ease;
}

.role-button:hover {
  transform: translateY(-1px);
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
    padding: 6px 12px 6px 8px;
    border-radius: 999px;
    backdrop-filter: blur(4px);
    font-size: 13px;
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

  .forgot-row {
    justify-content: right;
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

  .role-grid {
    grid-template-columns: 1fr;
  }
}
</style>
