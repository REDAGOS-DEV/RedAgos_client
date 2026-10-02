<template>
  <main class="login-screen scope-auth-donor-login">
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

          <NuxtLink to="/" class="back-link" aria-label="Back to home">
            <AssetIcon name="chevron-left" :size="16" />
            <span>Back</span>
          </NuxtLink>

          <header class="form-header">
            <h1>Welcome, Lifesaver!</h1>

            <p class="form-subtitle">
              Sign in to your RedAgos account
            </p>
          </header>

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

            <div class="field-group">
              <div class="label-row">
                <label for="password">Password</label>

                <button
                  type="button"
                  class="link-button"
                  @click="goToForgotPassword"
                >
                  Forgot password?
                </button>
              </div>

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
              :sent="resendSent"
              :cooldown="resendCooldown"
              :email="verificationEmail"
              @resend="resendVerification"
            />

            <button
              type="submit"
              class="sign-in-button"
              :disabled="loading"
            >
              <AssetIcon :name="loading ? 'loader' : 'log-in'" :size="20" :class="{ 'btn-spinner': loading }" />
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
                <AssetIcon name="hospital" :size="18" />
                Hospital
              </button>

              <button
                type="button"
                class="role-button blood-center"
                @click="navigateTo('/auth/blood-center/login')"
              >
                <AssetIcon name="blood-drop" :size="18" />
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
  resendSent,
  resendCooldown,
  verificationEmail,
  login,
  resendVerification,
  goToForgotPassword,
} = useAuthLogin('donor')
</script>

<style scoped>
* {
  box-sizing: border-box;
}

/*
  Shape rule: inputs, buttons ug role tiles kay 12px ang radius;
  ang back link ra ang pill. Ayaw na sagola.
*/
.login-screen {
  --primary: var(--rb-primary, #1565C0);
  --primary-hover: #0D47A1;
  --primary-rgb: var(--rb-primary-rgb, 21, 101, 192);
  --danger: #D32F2F;
  --success: #2E7D32;
  --text-primary: #0f1b2d;
  --text-body: #334155;
  --text-secondary: #5b6b80;
  --border: #d9e2ec;
  --border-strong: #c3cfdc;
  --field-bg: #ffffff;
  --page-bg: #eef4fb;
  --radius: 12px;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--page-bg);
  color: var(--text-primary);
  font-family: var(--rb-font-sans);
  -webkit-font-smoothing: antialiased;
}

.login-shell {
  display: grid;
  min-height: 100vh;
  min-height: 100dvh;
  grid-template-columns: minmax(420px, 540px) 1fr;
}

.form-panel {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  align-items: center;
  justify-content: flex-start;
  padding: 48px clamp(32px, 7vw, 128px);
}

.form-card {
  width: 100%;
  max-width: 400px;
}

@media (prefers-reduced-motion: no-preference) {
  .form-card {
    animation: card-enter 520ms var(--ease-out) both;
  }
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}

/* ── MOBILE BRAND ── */
.mobile-brand {
  display: none;
}

.mobile-brand-curve {
  position: relative;
  width: calc(100% + 54px);
  margin: 0 -24px 28px;
  padding: 56px 24px 52px;
  /* Elliptical radius: usa ka hapsay nga arko sa tibuok ubos, dili lang kanto */
  border-radius: 0 0 50% 50% / 0 0 46px 46px;
  background: var(--primary);
  text-align: center;
}

.mobile-logo {
  width: 52px;
  height: 52px;
  object-fit: contain;
  display: block;
  margin: 0 auto 12px;
}

.mobile-brand .brand-name {
  color: #ffffff;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.2;
  margin: 0;
}

.mobile-brand .brand-name span {
  color: #ff5a76;
}

.mobile-brand .brand-subtitle {
  color: rgba(255, 255, 255, 0.82);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin: 6px 0 0;
}

/* ── HEADER ── */
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: -10px;
  padding: 6px 12px 6px 8px;
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: color 150ms ease, background-color 150ms ease;
}

.back-link:hover {
  color: var(--text-primary);
  background: rgba(var(--primary-rgb), 0.06);
}

.form-header {
  margin-top: 28px;
}

h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(28px, 2.4vw, 34px);
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.15;
}

.form-subtitle {
  margin: 10px 0 0;
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.55;
}

/* ── FORM ── */
.login-form {
  display: grid;
  gap: 20px;
  margin-top: 36px;
}

.field-group {
  display: grid;
  gap: 8px;
  margin: 0;
}

.label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

label {
  display: block;
  color: var(--text-primary);
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.3;
}

.input-shell {
  display: flex;
  height: 50px;
  align-items: center;
  padding: 0 6px 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--field-bg);
  box-shadow: 0 1px 2px rgba(15, 27, 45, 0.04);
  transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
}

.input-shell:hover {
  border-color: var(--border-strong);
}

.input-shell:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.12);
}

.field-icon {
  display: flex;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  color: var(--text-secondary);
  transition: color 150ms ease;
}

.input-shell:focus-within .field-icon {
  color: var(--primary);
}

svg {
  width: 100%;
  height: 100%;
}

input {
  width: 100%;
  height: 100%;
  min-width: 0;
  flex: 1;
  padding-right: 8px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-body);
  font: inherit;
  font-size: 15px;
}

input::placeholder {
  color: var(--text-secondary);
  opacity: 0.85;
}

.icon-button {
  display: flex;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9px;
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

.link-button {
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 2px 4px;
  margin-right: -4px;
  border-radius: 6px;
  color: var(--primary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  transition: color 150ms ease;
}

.link-button:hover {
  color: var(--primary-hover);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.sign-in-button {
  display: flex;
  width: 100%;
  height: 50px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 6px;
  border: 0;
  border-radius: var(--radius);
  background: var(--primary);
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.005em;
  box-shadow: 0 1px 2px rgba(var(--primary-rgb), 0.2), 0 6px 16px -6px rgba(var(--primary-rgb), 0.45);
  transition: background-color 150ms ease, box-shadow 150ms ease, transform 120ms var(--ease-out);
}

.sign-in-button:hover:not(:disabled) {
  background: var(--primary-hover);
  box-shadow: 0 1px 2px rgba(var(--primary-rgb), 0.2), 0 10px 22px -8px rgba(var(--primary-rgb), 0.55);
}

.sign-in-button:active:not(:disabled) {
  transform: scale(0.985);
}

.sign-in-button:disabled {
  cursor: not-allowed;
  opacity: 0.72;
  box-shadow: none;
}

.sign-in-button svg {
  width: 20px;
  height: 20px;
}

.btn-spinner {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Ang form grid na ang naghatag og spacing, so i-zero ang margin sa alerts */
.login-form > .login-alert,
.login-form > .session-notice {
  margin: 0;
}

.signup-text {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  text-align: center;
}

.signup-text a {
  margin-left: 2px;
  border-radius: 4px;
  color: var(--primary);
  font-weight: 700;
  text-decoration: none;
}

.signup-text a:hover {
  color: var(--primary-hover);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* ── OTHER PORTALS ── */
.divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 12px;
}

.divider span {
  height: 1px;
  flex: 1;
  background: var(--border);
}

.divider p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.role-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.role-button {
  display: flex;
  height: 46px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  transition: border-color 150ms ease, background-color 150ms ease, transform 120ms var(--ease-out);
}

.role-button:active {
  transform: scale(0.985);
}

.role-button svg {
  width: 18px;
  height: 18px;
}

.hospital {
  background: #e3eefa;
  color: var(--primary);
}

.hospital:hover {
  border-color: rgba(var(--primary-rgb), 0.5);
}

.blood-center {
  color: #2da1ff;
}

.blood-center:hover {
  border-color: #2da1ff;
}

.back-link:focus-visible,
.link-button:focus-visible,
.icon-button:focus-visible,
.sign-in-button:focus-visible,
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

/* ── TABLET / MOBILE ── */
@media (max-width: 1023px) {
  .login-shell {
    display: block;
  }

  .brand-panel {
    display: none;
  }

  .form-panel {
    position: relative;
    align-items: flex-start;
    justify-content: center;
    padding: 0 24px 48px;
  }

  .form-card {
    max-width: 440px;
    margin: 0 auto;
  }

  .mobile-brand {
    display: block;
  }

  .back-link {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 1;
    margin: 0;
    color: #ffffff;
    background: rgba(255, 255, 255, 0.16);
  }

  .back-link:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.26);
  }

  .form-header {
    margin-top: 0;
    text-align: center;
  }

  h1 {
    font-size: 26px;
  }

  .form-subtitle {
    margin-top: 6px;
    font-size: 14.5px;
  }

  .login-form {
    margin-top: 28px;
  }

  /* 16px para dili mo-zoom ang iOS Safari inig focus */
  input {
    font-size: 16px;
  }
}

@media (max-width: 520px) {
  .form-panel {
    padding: 0 18px 36px;
  }

  .mobile-brand-curve {
    width: calc(100% + 36px);
    margin: 0 -18px 24px;
    padding: 56px 18px 48px;
    border-radius: 0 0 50% 50% / 0 0 46px 46px;
  }

  h1 {
    font-size: 23px;
  }

  .login-form {
    gap: 18px;
  }
}

@media (max-width: 359px) {
  .role-grid {
    grid-template-columns: 1fr;
  }
}

/*
  Dark mode: tanan selector naka-prefix og .login-screen para dili
  motulo sa ubang pages (global man ni nga rules).
*/
:global(.dark .scope-auth-donor-login) {
  --text-primary: #F1F5F9;
  --text-body: #E2E8F0;
  --text-secondary: #94A3B8;
  --border: #334155;
  --border-strong: #475569;
  --field-bg: #1b2638;
  --page-bg: #0F172A;
}

:global(.dark .scope-auth-donor-login .input-shell) {
  box-shadow: none;
}

:global(.dark .scope-auth-donor-login .input-shell:focus-within) {
  background: #213049;
  box-shadow: 0 0 0 4px rgba(100, 181, 246, 0.16);
}

:global(.dark .scope-auth-donor-login .input-shell:focus-within .field-icon),
:global(.dark .scope-auth-donor-login .link-button),
:global(.dark .scope-auth-donor-login .signup-text a) {
  color: #64B5F6;
}

:global(.dark .scope-auth-donor-login .link-button:hover),
:global(.dark .scope-auth-donor-login .signup-text a:hover) {
  color: #90CAF9;
}

:global(.dark .scope-auth-donor-login .icon-button:hover) {
  background: #334155;
}

:global(.dark .scope-auth-donor-login .back-link:hover) {
  background: rgba(255, 255, 255, 0.06);
}

:global(.dark .scope-auth-donor-login .sign-in-button) {
  box-shadow: 0 6px 18px -8px rgba(0, 0, 0, 0.6);
}

:global(.dark .scope-auth-donor-login .hospital) {
  background: rgba(21, 101, 192, 0.18);
  color: #90CAF9;
}

:global(.dark .scope-auth-donor-login .blood-center) {
  color: #64B5F6;
}

@media (max-width: 1023px) {
  :global(.dark .scope-auth-donor-login .back-link:hover) {
    background: rgba(255, 255, 255, 0.26);
  }
}
</style>
