<template>
  <!--
    Ang forgot-password para sa upat ka portal. Ang page kay mohatag ra sa
    `portal`. Duha ka state:

      1. ang porma (email), ug
      2. "Check your email" human ma-send, uban ang resend.

    Ang link sa email kay moadto sa /auth/reset-password (pages/auth/
    reset-password.vue), parehas para sa tanan. Tan-awa ang utils/
    passwordReset.ts para sa tibuok flow.
  -->
  <AuthShell :hero="hero" :back-to="loginPath" back-label="Back to sign in">
    <!-- ── Sent ── -->
    <section v-if="sentTo" class="sent" aria-live="polite">
      <span class="sent-icon"><AssetIcon name="mail" :size="26" /></span>

      <header class="au-header">
        <h1>Check your email</h1>
        <p>If an account uses this address, we sent it a reset link.</p>
      </header>

      <p class="sent-email">{{ sentTo }}</p>
      <p class="au-hint sent-hint">
        The link expires in 60 minutes. No email? Check your spam folder first.
      </p>

      <button
        type="button"
        class="au-btn au-btn--outline"
        :disabled="loading || cooldown > 0"
        @click="send"
      >
        <AssetIcon name="refresh-cw" :size="16" :class="{ 'au-spinner': loading }" />
        <template v-if="loading">Sending...</template>
        <template v-else-if="cooldown > 0">Resend in {{ cooldown }}s</template>
        <template v-else>Resend link</template>
      </button>

      <p v-if="notice" class="sent-note" role="status">{{ notice }}</p>
      <p v-if="errorMessage" class="sent-note sent-note--error" role="alert">{{ errorMessage }}</p>

      <p class="au-footer">
        Wrong address?
        <button type="button" class="au-link" @click="startOver">Use a different email</button>
      </p>
    </section>

    <!-- ── Form ── -->
    <template v-else>
      <header class="au-header">
        <p v-if="restricted" class="au-badge">
          <AssetIcon name="shield-check" :size="14" />
          Restricted access
        </p>
        <h1>Forgot your password?</h1>
        <p>Enter your account email and we'll send you a link to set a new one.</p>
      </header>

      <form class="au-form" novalidate @submit.prevent="send">
        <div class="au-field">
          <label for="reset-email">Email address</label>
          <div class="au-input" :class="{ 'au-input--invalid': errorMessage }">
            <AssetIcon name="mail" :size="18" class="au-icon" />
            <input
              id="reset-email"
              v-model="email"
              type="email"
              placeholder="you@example.com"
              required
              autocomplete="email"
              :aria-describedby="errorMessage ? 'reset-error' : undefined"
            >
          </div>
          <p v-if="errorMessage" id="reset-error" class="au-error" role="alert">{{ errorMessage }}</p>
        </div>

        <button type="submit" class="au-btn" :disabled="loading">
          <AssetIcon :name="loading ? 'loader' : 'send'" :size="18" :class="{ 'au-spinner': loading }" />
          {{ loading ? 'Sending...' : 'Send reset link' }}
        </button>
      </form>

      <p class="au-footer">
        Remembered it?
        <NuxtLink :to="loginPath">Sign in</NuxtLink>
      </p>
    </template>
  </AuthShell>
</template>

<script setup lang="ts">
import AuthShell from '~/components/auth/AuthShell.vue'
import type { AuthHero } from '~/components/auth/AuthShell.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { authService } from '~/api/auth/AuthService'
import type { PortalKey } from '~/composables/useAuthLogin'
import { authPhoto } from '~/utils/authPhotos'
import type { AuthPhotoKey } from '~/utils/authPhotos'
import { PORTAL_LOGIN, rememberResetPortal } from '~/utils/passwordReset'

const props = defineProps<{
  portal: PortalKey
  /** Admin: shows the "Restricted access" badge, like the admin sign-in. */
  restricted?: boolean
}>()

// The same photo as the portal's sign-in, so the two screens read as one.
const PHOTO: Record<PortalKey, AuthPhotoKey> = {
  'user': 'donation',
  'donor': 'screening',
  'hospital': 'hospital',
  'blood-center': 'microscope',
  'admin': 'lab',
}

const hero = computed<AuthHero>(() => ({
  lead: 'Locked out?',
  accent: "We'll help you back in",
  desc: 'We email you a secure link that works for one hour. Setting a new password also signs you out on your other devices.',
  ...authPhoto(PHOTO[props.portal]),
}))

const loginPath = computed(() => PORTAL_LOGIN[props.portal])

const email = ref('')
const sentTo = ref('')
const loading = ref(false)
const errorMessage = ref('')
const notice = ref('')

// The server allows one reset email per address per 60 seconds
// (AUTH_PASSWORD_RESET_THROTTLE_SECONDS), so the resend button waits as long.
const cooldown = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

function startCooldown() {
  cooldown.value = 60
  clearInterval(timer)
  timer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) clearInterval(timer)
  }, 1000)
}

async function send() {
  const address = (sentTo.value || email.value).trim()
  errorMessage.value = ''
  notice.value = ''

  if (!address) {
    errorMessage.value = 'Please enter your email address.'
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    errorMessage.value = 'Please enter a valid email address.'
    return
  }

  loading.value = true
  try {
    await authService.forgotPassword({ email: address })
    // Same reply whether or not the address is registered: the server never
    // confirms who has an account, and neither does this screen.
    rememberResetPortal(props.portal)
    if (sentTo.value) notice.value = 'Sent again. Check your inbox for the newest link.'
    sentTo.value = address
    startCooldown()
  } catch (error: any) {
    // throttle:3,10 on the route: a 429 means the address is fine, just wait.
    errorMessage.value = error?.status === 429
      ? 'Too many reset requests. Please wait a few minutes and try again.'
      : error?.message || 'We could not send the reset link right now. Please try again.'
  } finally {
    loading.value = false
  }
}

function startOver() {
  email.value = sentTo.value
  sentTo.value = ''
  notice.value = ''
  errorMessage.value = ''
}

onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
/* The frame, fields and buttons come from AuthShell (.au-*). */
.sent { text-align: center; }
.sent-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  background: var(--au-accent-soft);
  color: var(--au-accent-text);
}
.sent .au-header { margin-bottom: 14px; }
.sent-email {
  display: inline-block;
  max-width: 100%;
  margin: 0 0 12px;
  padding: 8px 16px;
  border-radius: 999px;
  background: var(--au-panel);
  color: var(--au-text);
  font-weight: 700;
  overflow-wrap: anywhere;
}
.sent-hint { margin-bottom: 24px; }
.sent-note { margin: 12px 0 0; font-size: 13.5px; color: var(--au-text-2); }
.sent-note--error { color: var(--au-danger); font-weight: 600; }
.sent .au-footer .au-link { font-size: 14px; font-weight: 700; margin-left: 2px; }
</style>
