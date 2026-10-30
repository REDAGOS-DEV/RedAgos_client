<template>
  <!--
    One sign-in screen for everyone (project owner, 2026-10-24): donors, blood
    center staff, hospital blood banks and administrators (2026-10-30, the
    User/Admin choice is gone), and the server sends each to their own portal
    by the roles on the account (AuthService::guardUnifiedSignIn). Password or
    Google. No DOH license is asked for any more.

    Fits the window: the page never scrolls (AuthShell `fit`).
  -->
  <AuthShell :hero="hero" fit>
    <header class="au-header">
      <h1>{{ copy.title }}</h1>
      <p>{{ copy.subtitle }}</p>
    </header>

    <form class="au-form" @submit.prevent="login">
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
  </AuthShell>
</template>

<script setup lang="ts">
import AuthShell from '~/components/auth/AuthShell.vue'
import type { AuthHero } from '~/components/auth/AuthShell.vue'
import SessionExpiredNotice from '~/components/auth/SessionExpiredNotice.vue'
import LoginAlert from '~/components/auth/LoginAlert.vue'
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
  resending,
  resendMessage,
  resendFailed,
  resendSent,
  resendCooldown,
  verificationEmail,
  login,
  loginWithGoogle,
  resendVerification,
  goToForgotPassword,
} = useAuthLogin('user')
</script>
