<template>
  <!--
    One sign-in screen for everyone (project owner, 2026-10-24): donors, blood
    center staff, hospital blood banks and administrators (2026-10-30, the
    User/Admin choice is gone), and the server sends each to their own portal
    by the roles on the account (AuthService::guardUnifiedSignIn). Password or
    Google. No DOH license is asked for any more.

    Fits the window: the page never scrolls (AuthShell `fit`).

    An unverified address is refused with a code mailed to it: the form gives
    way to the code step, and a right code signs in with what was typed.
  -->
  <AuthShell :hero="hero" fit>
    <EmailCodeStep v-if="needsVerification" :email="verificationEmail" @verified="login()">
      <template #footer>
        <p class="au-footer">
          <button type="button" class="au-link" @click="clearError">Back to sign in</button>
        </p>
      </template>
    </EmailCodeStep>

    <template v-else>
      <header class="au-header">
        <h1>{{ copy.title }}</h1>
        <p>{{ copy.subtitle }}</p>
      </header>

      <form class="au-form" @submit.prevent="login()">
        <!-- Text, not email: the server also takes a donor code (from the blood
             center desk's sign-in) or a username. -->
        <div class="au-field">
          <label for="email">Email/Username</label>
          <div class="au-input">
            <AssetIcon name="mail" :size="18" class="au-icon" />
            <input
              id="email"
              v-model="email"
              type="text"
              inputmode="email"
              autocapitalize="none"
              spellcheck="false"
              :class="{ typed: typed.email }"
              placeholder="you@example.com"
              required
              autocomplete="username"
            >
          </div>
        </div>

        <div class="au-field">
          <div class="au-label-row">
            <label for="password">Password</label>
            <button type="button" class="au-link" @click="goToForgotPassword">
              Forgot password?
            </button>
          </div>
          <div class="au-input">
            <AssetIcon name="lock" :size="18" class="au-icon" />
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              :class="{ typed: typed.password }"
              placeholder="Enter your password"
              required
              autocomplete="current-password"
            >
            <button
              type="button"
              class="au-icon-btn"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <AssetIcon :name="showPassword ? 'eye' : 'eye-off'" :size="18" />
            </button>
          </div>
        </div>

        <SessionExpiredNotice />

        <!--
          Google confirmed an address no account uses (2026-11-22): instead of
          a warning, an offer to register a donor account with that address.
        -->
        <div v-if="googleSignUpEmail" class="gso" role="status">
          <AssetIcon name="info" :size="16" class="gso__icon" />
          <div class="gso__body">
            <p class="gso__text">
              No RedAgos account uses <strong>{{ googleSignUpEmail }}</strong>.
              Register a donor account with this email?
            </p>
            <div class="gso__actions">
              <NuxtLink
                :to="{ path: '/auth/donor/register', query: { email: googleSignUpEmail } }"
                class="gso__register"
              >
                Register with this email
                <AssetIcon name="arrow-right" :size="15" />
              </NuxtLink>
              <button type="button" class="au-link gso__dismiss" @click="clearError">Not now</button>
            </div>
          </div>
        </div>
        <LoginAlert v-else :message="errorMessage" />

        <button type="submit" class="au-btn" :disabled="loading">
          <AssetIcon
            :name="loading ? 'loader' : 'log-in'"
            :size="18"
            :class="{ 'au-spinner': loading }"
          />
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>

        <!-- "Sign in with" Google, in place of the old User/Admin choice (2026-10-30). -->
        <GoogleSignIn :disabled="loading" @credential="loginWithGoogle" />
      </form>

      <div class="au-footer">
        <p class="signup-text">
          New donor?
          <NuxtLink to="/auth/donor/register">Register now</NuxtLink>
          <span class="au-footer__note">Blood center, hospital and administrator accounts are set up by a RedAgos administrator.</span>
        </p>
      </div>
    </template>
  </AuthShell>
</template>

<script setup lang="ts">
import AuthShell from '~/components/auth/AuthShell.vue'
import type { AuthHero } from '~/components/auth/AuthShell.vue'
import SessionExpiredNotice from '~/components/auth/SessionExpiredNotice.vue'
import LoginAlert from '~/components/auth/LoginAlert.vue'
import EmailCodeStep from '~/components/auth/EmailCodeStep.vue'
import GoogleSignIn from '~/components/auth/GoogleSignIn.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { authPhoto } from '~/utils/authPhotos'

const hero: AuthHero = {
  lead: 'Give blood,',
  accent: 'save lives',
  desc: "Davao City's blood bank platform, connecting donors, hospitals, and blood centers.",
  ...authPhoto('donation'),
}
const copy = {
  title: 'Welcome to RedAgos',
  subtitle: 'Sign in to your RedAgos account',
}

// The whole sign-in flow lives in useAuthLogin; the one screen names no role.
const {
  email,
  password,
  showPassword,
  loading,
  errorMessage,
  typed,
  needsVerification,
  verificationEmail,
  googleSignUpEmail,
  login,
  loginWithGoogle,
  goToForgotPassword,
  clearError,
} = useAuthLogin('user')
</script>

<style scoped>
/* The register offer, in LoginAlert's place: blue (an offer), not red. */
.gso {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid rgba(21, 101, 192, 0.28);
  border-radius: 12px;
  background: #EFF5FC;
  color: var(--au-text);
  font-size: 13px;
  line-height: 1.55;
  text-align: left;
}
.gso__icon { flex: 0 0 auto; margin-top: 2px; color: var(--au-accent-text); }
.gso__body { display: grid; gap: 10px; min-width: 0; }
.gso__text { margin: 0; }
.gso__text strong { font-weight: 600; overflow-wrap: anywhere; }
.gso__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; }
.gso__register {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  background: var(--au-accent);
  color: #fff;
  font-weight: 700;
  text-decoration: none;
  transition: background-color 150ms ease;
}
.gso__register:hover { background: var(--au-accent-hover); }
.gso__register:focus-visible { outline: 2px solid var(--au-accent); outline-offset: 2px; }
.auth-shell .gso__dismiss { margin-right: 0; }
</style>
