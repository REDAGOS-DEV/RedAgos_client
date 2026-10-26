<template>
  <!--
    One sign-in screen for everyone (project owner, 2026-10-24): donors, blood
    center staff and hospital blood banks sign in as a User, and the server
    sends each to their own portal by the roles on the account (a sign-in
    that names no role, AuthService::guardUnifiedSignIn). Administrators pick
    Admin at the foot of the form. No DOH license is asked for any more.

    Fits the window: the page never scrolls (AuthShell `fit`).
  -->
  <AuthShell :hero="hero" fit>
    <header class="au-header">
      <!-- Admin only: says plainly that this is the privileged sign-in. -->
      <p v-if="mode === 'admin'" class="au-badge">
        <AssetIcon name="shield-check" :size="14" />
        Restricted access
      </p>
      <h1>{{ copy.title }}</h1>
      <p>{{ copy.subtitle }}</p>
    </header>

    <form class="au-form" @submit.prevent="login">
      <!-- Text, not email: the server also takes a donor code (from the blood
           center desk's sign-in) or a username. -->
      <div class="au-field">
        <label for="email">{{ mode === 'user' ? 'Email, username or donor code' : 'Email or username' }}</label>
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
            :placeholder="mode === 'user' ? 'you@example.com or DONOR-000123' : 'you@example.com'"
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

      <button type="submit" class="au-btn" :disabled="loading">
        <AssetIcon
          :name="loading ? 'loader' : 'log-in'"
          :size="18"
          :class="{ 'au-spinner': loading }"
        />
        {{ loading ? 'Signing in...' : (mode === 'admin' ? 'Sign In as Admin' : 'Sign In') }}
      </button>

      <!-- Who is signing in, laid out as the old "or sign in as" row. -->
      <div class="au-divider"><span id="login-as">Log in as</span></div>

      <div class="au-roles au-roles--compact" role="radiogroup" aria-labelledby="login-as">
        <button
          v-for="option in MODES"
          :key="option.value"
          type="button"
          role="radio"
          class="au-role"
          :class="[`au-role--${option.value}`, { 'au-role--on': mode === option.value }]"
          :aria-checked="mode === option.value"
          :disabled="loading"
          @click="setMode(option.value)"
        >
          <AssetIcon :name="option.icon" :size="16" class="au-role-icon" />
          {{ option.label }}
        </button>
      </div>
    </form>

    <div class="au-footer">
      <p v-if="mode === 'user'" class="signup-text">
        New donor?
        <NuxtLink to="/auth/donor/register">Register now</NuxtLink>
        <span class="au-footer__note">Blood center and hospital accounts are set up by a RedAgos administrator.</span>
      </p>
      <!-- Walay self-registration ang admin: ang bag-ong admin account kay
           gihimo ra sa naa nang admin pinaagi sa POST /users. -->
      <p v-else class="signup-text">
        For authorized RedAgos administrators only. New administrator accounts are created by an existing
        administrator.
      </p>
    </div>
  </AuthShell>
</template>

<script setup lang="ts">
import AuthShell from '~/components/auth/AuthShell.vue'
import type { AuthHero } from '~/components/auth/AuthShell.vue'
import SessionExpiredNotice from '~/components/auth/SessionExpiredNotice.vue'
import LoginAlert from '~/components/auth/LoginAlert.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { authPhoto } from '~/utils/authPhotos'

type LoginMode = 'user' | 'admin'

const props = withDefaults(defineProps<{
  /** Which sign-in the screen opens on. */
  initialMode?: LoginMode
}>(), {
  initialMode: 'user',
})

const MODES: Array<{ value: LoginMode; label: string; icon: string }> = [
  { value: 'user', label: 'User', icon: 'user' },
  { value: 'admin', label: 'Admin', icon: 'shield-check' },
]

const mode = ref<LoginMode>(props.initialMode)

const COPY: Record<LoginMode, { title: string; subtitle: string; hero: AuthHero }> = {
  user: {
    title: 'Welcome to RedAgos',
    subtitle: 'Sign in to your donor, blood center or hospital account',
    hero: {
      lead: 'Give blood,',
      accent: 'save lives',
      desc: "Davao City's blood bank platform, connecting donors, hospitals, and blood centers.",
      ...authPhoto('donation'),
    },
  },
  admin: {
    title: 'Administrator Sign In',
    subtitle: 'Manage facilities, users, and the rest of the system',
    hero: {
      lead: 'RedAgos',
      accent: 'administration',
      desc: 'Manage facilities, accounts, and donor identity checks.',
      ...authPhoto('lab'),
    },
  },
}
const copy = computed(() => COPY[mode.value])
const hero = computed(() => copy.value.hero)

// The whole sign-in flow lives in useAuthLogin; it follows the mode picked
// here (a User sign-in names no role, an Admin one names admin).
const portal = computed(() => (mode.value === 'admin' ? 'admin' : 'user'))
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
  clearError,
} = useAuthLogin(portal)

function setMode(next: LoginMode) {
  if (mode.value === next) return
  mode.value = next
  clearError()
}
</script>
