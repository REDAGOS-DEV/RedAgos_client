<template>
  <!--
    Diri motugpa ang link sa password reset email:
      /auth/reset-password?token=…&email=…
    (ResetPasswordNotification sa server). Parehas para sa upat ka portal.

    Tulo ka state: ang porma, "password updated", ug "invalid link" (walay
    token/email sa URL, o gi-ingnan sa server nga expired na).
  -->
  <AuthShell :hero="hero" :back-to="signInPath" back-label="Back to sign in">
    <!-- ── Done ── -->
    <section v-if="done" class="state" aria-live="polite">
      <span class="state-icon state-icon--ok"><AssetIcon name="circle-check-big" :size="28" /></span>
      <header class="au-header">
        <h1>Password updated</h1>
        <p>Sign in with your new password. You have been signed out on your other devices.</p>
      </header>
      <NuxtLink :to="signInPath" class="au-btn">
        <AssetIcon name="log-in" :size="18" />
        Sign in
      </NuxtLink>
    </section>

    <!-- ── Bad link ── -->
    <section v-else-if="linkProblem" class="state" aria-live="polite">
      <span class="state-icon state-icon--bad"><AssetIcon name="link" :size="26" /></span>
      <header class="au-header">
        <h1>This link no longer works</h1>
        <p>{{ linkProblem }}</p>
      </header>
      <NuxtLink :to="forgotPath" class="au-btn">
        <AssetIcon name="send" :size="18" />
        Request a new link
      </NuxtLink>
      <p class="au-footer">
        Remembered it?
        <NuxtLink :to="signInPath">Sign in</NuxtLink>
      </p>
    </section>

    <!-- ── Form ── -->
    <template v-else>
      <header class="au-header">
        <h1>Set a new password</h1>
        <p>For <strong class="for-email">{{ email }}</strong></p>
      </header>

      <form class="au-form" novalidate @submit.prevent="submit">
        <div class="au-field">
          <label for="new-password">New password</label>
          <div class="au-input" :class="{ 'au-input--invalid': fieldErrors.password }">
            <AssetIcon name="lock" :size="18" class="au-icon" />
            <input
              id="new-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Create a password"
              autocomplete="new-password"
              aria-describedby="password-rules"
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

          <!-- The server's own rule, ticked off as they type. -->
          <ul id="password-rules" class="rules" aria-label="Password requirements">
            <li v-for="rule in rules" :key="rule.label" :class="{ met: rule.met }">
              <AssetIcon :name="rule.met ? 'check-circle' : 'circle'" :size="15" />
              {{ rule.label }}
            </li>
          </ul>
          <p v-if="fieldErrors.password" class="au-error">{{ fieldErrors.password }}</p>
        </div>

        <div class="au-field">
          <label for="confirm-password">Confirm new password</label>
          <div class="au-input" :class="{ 'au-input--invalid': mismatch }">
            <AssetIcon name="lock" :size="18" class="au-icon" />
            <input
              id="confirm-password"
              v-model="confirmation"
              :type="showConfirmation ? 'text' : 'password'"
              placeholder="Re-enter your password"
              autocomplete="new-password"
            >
            <button
              type="button"
              class="au-icon-btn"
              :aria-label="showConfirmation ? 'Hide password' : 'Show password'"
              @click="showConfirmation = !showConfirmation"
            >
              <AssetIcon :name="showConfirmation ? 'eye' : 'eye-off'" :size="18" />
            </button>
          </div>
          <p v-if="mismatch" class="au-error">The passwords do not match.</p>
        </div>

        <div v-if="errorMessage" class="submit-error" role="alert">
          <AssetIcon name="octagon-alert" :size="16" />
          <span>{{ errorMessage }}</span>
        </div>

        <button type="submit" class="au-btn" :disabled="!canSubmit || loading">
          <AssetIcon :name="loading ? 'loader' : 'lock'" :size="18" :class="{ 'au-spinner': loading }" />
          {{ loading ? 'Saving...' : 'Save new password' }}
        </button>
      </form>
    </template>
  </AuthShell>
</template>

<script setup lang="ts">
import AuthShell from '~/components/auth/AuthShell.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { authService } from '~/api/auth/AuthService'
import { authPhoto } from '~/utils/authPhotos'
import {
  PORTAL_FORGOT,
  PORTAL_LOGIN,
  forgetResetPortal,
  passwordChecks,
  recallResetPortal,
} from '~/utils/passwordReset'
import { ROLE_SELECTION } from '~/utils/authRoutes'

const route = useRoute()

const hero = {
  lead: 'Almost there.',
  accent: 'Choose a new password',
  desc: 'Use at least 8 characters with upper and lower case letters and a number. Avoid one you use on other sites.',
  ...authPhoto('lab'),
}

const token = String(route.query.token ?? '')
const email = String(route.query.email ?? '')

// The portal the reset was requested from, remembered by the forgot-password
// screen. Read on the client only; the server render has no localStorage.
const portal = ref<ReturnType<typeof recallResetPortal>>(null)
onMounted(() => { portal.value = recallResetPortal() })

const signInPath = computed(() => (portal.value ? PORTAL_LOGIN[portal.value] : ROLE_SELECTION))
const forgotPath = computed(() => PORTAL_FORGOT[portal.value ?? 'donor'])

const password = ref('')
const confirmation = ref('')
const showPassword = ref(false)
const showConfirmation = ref(false)
const loading = ref(false)
const done = ref(false)
const errorMessage = ref('')
const fieldErrors = reactive<Record<string, string>>({})

const linkProblem = ref(
  token && email ? '' : 'The link is incomplete. Open it again from the email, or request a new one.',
)

const checks = computed(() => passwordChecks(password.value))
const rules = computed(() => [
  { label: 'At least 8 characters', met: checks.value.length },
  { label: 'Upper and lower case letters', met: checks.value.mixedCase },
  { label: 'At least one number', met: checks.value.number },
])
const strong = computed(() => rules.value.every(r => r.met))
const mismatch = computed(() => confirmation.value.length > 0 && confirmation.value !== password.value)
const canSubmit = computed(() => strong.value && confirmation.value === password.value)

async function submit() {
  if (!canSubmit.value || loading.value) return

  loading.value = true
  errorMessage.value = ''
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key]

  try {
    await authService.resetPassword({
      token,
      email,
      password: password.value,
      password_confirmation: confirmation.value,
    })
    forgetResetPortal()
    done.value = true
  } catch (error: any) {
    const errors = error?.errors ?? {}
    if (errors.token || errors.email) {
      // Expired, already used, or for another address.
      linkProblem.value = 'It has expired or was already used. Reset links work once, for one hour.'
    } else if (errors.password) {
      fieldErrors.password = Array.isArray(errors.password) ? errors.password[0] : String(errors.password)
    } else {
      errorMessage.value = error?.status === 429
        ? 'Too many attempts. Please wait a minute and try again.'
        : error?.message || 'We could not save your new password. Please try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* The frame, fields and buttons come from AuthShell (.au-*). */
.for-email { color: var(--au-text); overflow-wrap: anywhere; }

.rules {
  list-style: none;
  margin: 2px 0 0;
  padding: 0;
  display: grid;
  gap: 4px;
}
.rules li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--au-muted);
  transition: color 150ms ease;
}
.rules li.met { color: #2E7D32; font-weight: 600; }

.submit-error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid #F5C2C0;
  border-radius: var(--au-radius);
  background: #FEF3F2;
  color: var(--au-danger);
  font-size: 14px;
  line-height: 1.45;
}
.submit-error :deep(svg) { flex-shrink: 0; margin-top: 2px; }

/* ── Done / bad-link states ── */
.state { text-align: center; }
.state-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
}
.state-icon--ok { background: #E8F5E9; color: #2E7D32; }
.state-icon--bad { background: #FDECEC; color: var(--au-brand); }
.state .au-header { margin-bottom: 24px; }

@media (prefers-reduced-motion: reduce) {
  .rules li { transition: none; }
}
</style>
