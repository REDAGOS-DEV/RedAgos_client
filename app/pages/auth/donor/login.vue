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

            <!--
              Gi-merge ang error text ug ang resend action sa usa ka card —
              parehas ra ni sila usa ka flow (problema, unya ang solusyon),
              so dili na sila i-split into duha ka independent block.
            -->
            <SessionExpiredNotice />

            <LoginAlert
              :message="errorMessage"
              :needs-verification="needsVerification"
              :resending="resending"
              :resend-message="resendMessage"
              :resend-failed="resendFailed"
              @resend="resendVerification"
            />

            <button
              class="sign-in-button"
              :disabled="loading"
            >
              <AssetIcon :name="loading ? 'loader' : 'log-in'" :size="22" :class="{ 'btn-spinner': loading }" />
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
import SessionExpiredNotice from '~/components/auth/SessionExpiredNotice.vue'
import LoginAlert from '~/components/auth/LoginAlert.vue'
import AuthBrandPanel from '~/components/auth/AuthBrandPanel.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import logo from '~/assets/images/RedAgosLogo.png'

// Ang tibuok sign-in flow kay sa useAuthLogin na. Ang upat ka portal
// kaniadto nagdala og kaugalingong kopya, ug nagkalahi na sila sa mga
// paagi nga bug — tan-awa ang composable.
const {
  email,
  password,
  showPassword,
  loading,
  errorMessage,
  typed,
  needsVerification,
  resending,
  resendMessage,
  resendFailed,
  login,
  resendVerification,
  goToForgotPassword,
} = useAuthLogin('donor')
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.login-screen {
  --primary: #1565C0;
  --primary-hover: #0D47A1;
  --danger: #D32F2F;
  --success: #2E7D32;
  --text-primary: #1f2937;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --field-bg: #f8fafc;
  min-height: 100vh;
  background: #F7F9FC;
  color: var(--text-primary);
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
  align-items: center;
  justify-content: flex-start;
  padding: 40px clamp(24px, 8vw, 140px);
}

.form-card {
  width: 100%;
  max-width: 420px;
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
  color: var(--danger);
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
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  border-radius: 8px;
  transition: color 150ms ease;
}

.back-link:hover {
  color: var(--text-primary);
}

h1 {
  margin: 46px 0 0;
  color: var(--text-primary);
  font-size: 38px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.18;
}

.form-subtitle {
  margin: 16px 0 0;
  color: var(--text-secondary);
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
  color: var(--text-primary);
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
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--field-bg);
  transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
}

.input-shell:focus-within {
  border-color: var(--primary);
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(21, 101, 192, 0.1);
}

.field-icon {
  display: flex;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  color: var(--text-secondary);
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
  color: var(--text-secondary);
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
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}

.icon-button:hover {
  background: #f1f5f9;
  color: var(--text-primary);
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

.link-button {
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 2px;
  border-radius: 6px;
  color: var(--primary);
  font-size: 14px;
  font-weight: 800;
  transition: color 150ms ease;
}

.link-button:hover {
  color: var(--primary-hover);
}

.sign-in-button {
  display: flex;
  width: 100%;
  height: 52px;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 12px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--primary) 0%, #2563EB 100%);
  color: #ffffff;
  cursor: pointer;
  font-size: 16px;
  font-weight: 800;
  box-shadow: 0 6px 18px rgba(21, 101, 192, 0.3);
  transition: box-shadow 150ms ease, transform 150ms ease, filter 150ms ease;
}

.sign-in-button:hover:not(:disabled) {
  filter: brightness(1.05);
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(21, 101, 192, 0.38);
}

.sign-in-button:active:not(:disabled) {
  transform: translateY(0);
}

.sign-in-button:disabled {
  cursor: not-allowed;
  opacity: 0.72;
  transform: none;
}

.sign-in-button svg {
  width: 22px;
  height: 22px;
}

.btn-spinner {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.alert-card {
  margin: 16px 0 0;
  padding: 14px 16px;
  border-radius: 12px;
  background: #fbeaea;
  text-align: left;
}

.alert-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: #791f1f;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
}

.alert-message svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.alert-card--action .alert-message {
  margin-bottom: 12px;
}

.verify-resend-button {
  display: flex;
  width: 100%;
  height: 42px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--danger);
  border-radius: 10px;
  background: #ffffff;
  color: var(--danger);
  cursor: pointer;
  font-size: 13.5px;
  font-weight: 700;
  transition: background-color 150ms ease;
}

.verify-resend-button:hover:not(:disabled) { background: #fdf3f3; }

.verify-resend-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.verify-resend-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 10px 0 0;
  color: var(--success);
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.5;
  text-align: left;
}

.verify-resend-note svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.verify-resend-note--error { color: var(--danger); }

.signup-text {
  margin: 24px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
  text-align: center;
}

.signup-text a {
  color: var(--primary);
  font-weight: 800;
  text-decoration: none;
}

.signup-text a:hover {
  color: var(--primary-hover);
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
  color: var(--text-secondary);
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
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 800;
  transition: border-color 150ms ease, background-color 150ms ease, transform 150ms ease;
}

.role-button:hover {
  transform: translateY(-1px);
}

.role-button svg {
  width: 20px;
  height: 20px;
}

.hospital {
  background: #eaf3fc;
  color: var(--primary);
}

.hospital:hover {
  border-color: var(--primary);
}

.blood-center {
  background: #fbeaea;
  color: var(--danger);
}

.blood-center:hover {
  border-color: var(--danger);
}

.back-link:focus-visible,
.link-button:focus-visible,
.icon-button:focus-visible,
.sign-in-button:focus-visible,
.verify-resend-button:focus-visible,
.role-button:focus-visible,
.signup-text a:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .btn-spinner,
  .sign-in-button,
  .role-button {
    animation: none;
    transition: none;
  }
}

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

:global(.dark .login-screen) {
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --border: #334155;
  --field-bg: #263449;
  background: #0F172A;
}

:global(.dark input) {
  color: #E2E8F0;
}

:global(.dark .input-shell:focus-within) {
  background: #2c3e57;
}

:global(.dark .icon-button:hover) {
  background: #334155;
}

:global(.dark .alert-card) {
  background: rgba(211, 47, 47, 0.16);
}

:global(.dark .alert-message) {
  color: #f2b8b8;
}

:global(.dark .verify-resend-button) {
  background: #1E293B;
}

:global(.dark .verify-resend-button:hover:not(:disabled)) {
  background: #263449;
}

:global(.dark .divider span) {
  background: #334155;
}

:global(.dark .hospital) {
  background: rgba(21, 101, 192, 0.16);
}

:global(.dark .blood-center) {
  background: rgba(211, 47, 47, 0.16);
}
</style>