<template>
  <!--
    Ang usa ka sign-in screen para sa upat ka portal (donor, hospital, blood
    center, admin). Ang page kay mohatag ra sa `portal`, title, subtitle, ug
    ang footer (slot). Ang license field ug ang "or sign in as" kay automatic
    base sa portal. Ang frame ug ang styles kay sa AuthShell.
  -->
  <AuthShell :hero="hero">
    <header class="au-header">
      <!-- Admin only: says plainly that this is the privileged portal. -->
      <p v-if="restricted" class="au-badge">
        <AssetIcon name="shield-check" :size="14" />
        Restricted access
      </p>
      <h1>{{ title }}</h1>
      <p>{{ subtitle }}</p>
    </header>

    <form class="au-form" @submit.prevent="login">
      <div class="au-field">
        <label for="email">Email address</label>
        <div class="au-input">
          <AssetIcon name="mail" :size="18" class="au-icon" />
          <input
            id="email"
            v-model="email"
            type="email"
            :class="{ typed: typed.email }"
            placeholder="you@example.com"
            required
            autocomplete="email"
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

      <!-- Blood center ug hospital ra: gipangayo ang DOH license sa sign-in. -->
      <div v-if="requiresLicense" class="au-field">
        <label for="license-number">DOH license number</label>
        <div class="au-input">
          <AssetIcon name="id-card" :size="18" class="au-icon" />
          <input
            id="license-number"
            v-model="licenseNumber"
            type="text"
            :class="{ typed: typed.licenseNumber }"
            placeholder="e.g. DOH-BC-00123"
            required
            :aria-describedby="licenseHint ? 'license-hint' : undefined"
          >
        </div>
        <p v-if="licenseHint" id="license-hint" class="au-hint">{{ licenseHint }}</p>
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

      <template v-if="otherPortals.length">
        <div class="au-divider"><span>or sign in as</span></div>

        <div class="au-roles">
          <NuxtLink
            v-for="other in otherPortals"
            :key="other.key"
            :to="other.to"
            class="au-role"
            :class="`au-role--${other.key}`"
          >
            <AssetIcon :name="other.icon" :size="18" class="au-role-icon" />
            {{ other.label }}
          </NuxtLink>
        </div>
      </template>
    </form>

    <div class="au-footer">
      <slot name="footer" />
    </div>
  </AuthShell>
</template>

<script setup lang="ts">
import AuthShell from '~/components/auth/AuthShell.vue'
import type { AuthHero } from '~/components/auth/AuthShell.vue'
import SessionExpiredNotice from '~/components/auth/SessionExpiredNotice.vue'
import LoginAlert from '~/components/auth/LoginAlert.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import type { PortalKey } from '~/composables/useAuthLogin'
import { authPhoto } from '~/utils/authPhotos'

const props = defineProps<{
  portal: PortalKey
  title: string
  subtitle: string
  /** Text below the DOH license field. Only shown on portals that ask for it. */
  licenseHint?: string
  /** Marks the privileged portal (admin) with a "Restricted access" badge. */
  restricted?: boolean
}>()

// Ang brand panel (headline, description, litrato) kay para sa matag portal:
// ang copy kay naghisgot sa unsa ang naghulat sa user sulod, base sa mga
// page nga naa gyud sa portal. Ang litrato kay parehas sa landing page.
const HERO: Record<PortalKey, AuthHero> = {
  'donor': {
    // Appointments, Eligibility, QR Code ug History: tanan naa sa donor portal.
    lead: 'Your next donation',
    accent: 'starts here',
    desc: "Book your next donation, check if you're eligible, and show your QR code at the blood center. Your donation history stays in one place.",
    ...authPhoto('screening'),
  },
  'hospital': {
    lead: 'Blood for your patients,',
    accent: 'on request',
    desc: 'Check availability, submit requests, and track every unit until it arrives.',
    ...authPhoto('hospital'),
  },
  'blood-center': {
    lead: 'Every unit, from',
    accent: 'collection to dispatch',
    desc: 'Manage testing, storage, and hospital requests in one place.',
    ...authPhoto('microscope'),
  },
  'admin': {
    lead: 'RedAgos',
    accent: 'administration',
    desc: 'Manage facilities, accounts, and donor identity checks.',
    ...authPhoto('lab'),
  },
}
const hero = computed(() => HERO[props.portal])

// Ang "or sign in as" kay para sa donor, hospital ug blood center ra.
// Ang admin login kay wala gi-link gikan sa ubang portal, so wala pud dinhi.
const SWITCHABLE = [
  { key: 'donor', label: 'Donor', icon: 'blood-drop', to: '/auth/donor/login' },
  { key: 'hospital', label: 'Hospital', icon: 'hospital', to: '/auth/hospital/login' },
  { key: 'blood-center', label: 'Blood Center', icon: 'building-2', to: '/auth/blood-center/login' },
] as const

const otherPortals = computed(() =>
  SWITCHABLE.some(p => p.key === props.portal)
    ? SWITCHABLE.filter(p => p.key !== props.portal)
    : [],
)

// Ang tibuok sign-in flow kay sa useAuthLogin na. Ang layout ra ang
// gipaambit dinhi; ang role, redirect ug forgot-password path kay
// gikan gihapon sa portal config.
const {
  email,
  password,
  licenseNumber,
  requiresLicense,
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
} = useAuthLogin(props.portal)
</script>
