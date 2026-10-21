<template>
  <!--
    The first stop for a donor the blood center desk registered: they signed in
    with the desk's temporary password (donor code or email), and choose their
    own here. The server refuses every other endpoint until they do
    (`password_change_required`), and portal.global sends them back here.
  -->
  <AuthShell :hero="hero" back-to="/auth/donor/login" back-label="Back to sign in">
    <header class="au-header">
      <h1>Choose your own password</h1>
      <p>
        You signed in with the temporary password from the blood center.
        Set your own to continue{{ firstName ? `, ${firstName}` : '' }}.
      </p>
    </header>

    <form class="au-form" novalidate @submit.prevent="submit">
      <div class="au-field">
        <label for="temporary-password">Temporary password</label>
        <div class="au-input" :class="{ 'au-input--invalid': fieldErrors.current_password }">
          <AssetIcon name="lock" :size="18" class="au-icon" />
          <input
            id="temporary-password"
            v-model="temporary"
            :type="showTemporary ? 'text' : 'password'"
            placeholder="The one the blood center gave you"
            autocomplete="current-password"
            autocapitalize="none"
            spellcheck="false"
          >
          <button
            type="button"
            class="au-icon-btn"
            :aria-label="showTemporary ? 'Hide password' : 'Show password'"
            @click="showTemporary = !showTemporary"
          >
            <AssetIcon :name="showTemporary ? 'eye' : 'eye-off'" :size="18" />
          </button>
        </div>
        <p v-if="fieldErrors.current_password" class="au-error">{{ fieldErrors.current_password }}</p>
      </div>

      <div class="au-field">
        <label for="new-password">New password</label>
        <div class="au-input" :class="{ 'au-input--invalid': fieldErrors.password || sameAsTemporary }">
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
        <p v-if="sameAsTemporary" class="au-error">Choose a password different from the temporary one.</p>
        <p v-else-if="fieldErrors.password" class="au-error">{{ fieldErrors.password }}</p>
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
        {{ loading ? 'Saving...' : 'Save and continue' }}
      </button>
    </form>

    <p class="au-footer">
      Not you?
      <button type="button" class="link-btn" @click="signOut">Sign out</button>
    </p>
  </AuthShell>
</template>

<script setup lang="ts">
import AuthShell from '~/components/auth/AuthShell.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { donorService } from '~/api/donor/DonorService'
import { authPhoto } from '~/utils/authPhotos'
import { passwordChecks } from '~/utils/passwordReset'

definePageMeta({
  middleware: ['auth'],
})

useHead({ title: 'Choose Your Password · RedAgos' })

const hero = {
  lead: 'Welcome to RedAgos.',
  accent: 'One last step',
  desc: 'Choose a password only you know. The one from the blood center works until you replace it here.',
  ...authPhoto('screening'),
}

const { user, ensureUser, refreshUser, logout } = useUser()

const firstName = computed(() => user.value?.first_name ?? '')

const temporary = ref('')
const password = ref('')
const confirmation = ref('')
const showTemporary = ref(false)
const showPassword = ref(false)
const showConfirmation = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const fieldErrors = reactive<Record<string, string>>({})

const checks = computed(() => passwordChecks(password.value))
const rules = computed(() => [
  { label: 'At least 8 characters', met: checks.value.length },
  { label: 'Upper and lower case letters', met: checks.value.mixedCase },
  { label: 'At least one number', met: checks.value.number },
])
const strong = computed(() => rules.value.every(r => r.met))
const sameAsTemporary = computed(() => password.value.length > 0 && password.value === temporary.value)
const mismatch = computed(() => confirmation.value.length > 0 && confirmation.value !== password.value)
const canSubmit = computed(() =>
  temporary.value.length > 0 && strong.value && !sameAsTemporary.value && confirmation.value === password.value,
)

// Only a donor still on the desk's password belongs here. Anyone else (the
// password already set in another tab, or a staff account) goes home.
onMounted(async () => {
  const current = await ensureUser()
  if (current && !current.temporary_sign_in) {
    await navigateTo(portalHomeFor(current), { replace: true })
  }
})

async function submit() {
  if (!canSubmit.value || loading.value) return

  loading.value = true
  errorMessage.value = ''
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key]

  try {
    await donorService.updatePassword({
      current_password: temporary.value,
      password: password.value,
      password_confirmation: confirmation.value,
    })

    // Re-read the account so the portal guard sees the change. If that read
    // fails, the save still stood: mark it here rather than bounce back.
    await refreshUser()
    if (user.value?.temporary_sign_in) {
      user.value = { ...user.value, temporary_sign_in: false }
    }

    await navigateTo('/donor/dashboard', { replace: true })
  } catch (error: any) {
    const errors = error?.errors ?? error?.data?.errors ?? {}
    const first = (field: string) => (Array.isArray(errors[field]) ? errors[field][0] : errors[field])

    if (errors.current_password) {
      fieldErrors.current_password = 'That is not the temporary password the blood center gave you.'
    } else if (errors.password) {
      fieldErrors.password = String(first('password'))
    } else {
      errorMessage.value = error?.status === 429
        ? 'Too many attempts. Please wait a minute and try again.'
        : error?.message || 'We could not save your password. Please try again.'
    }
  } finally {
    loading.value = false
  }
}

function signOut() {
  return logout('/auth/donor/login')
}
</script>

<style scoped>
/* The frame, fields and buttons come from AuthShell (.au-*). */
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

.link-btn {
  padding: 0;
  border: 0;
  background: none;
  color: var(--au-accent-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.link-btn:hover { text-decoration: underline; }
.link-btn:focus-visible { outline: 2px solid var(--au-accent); outline-offset: 2px; border-radius: 4px; }

@media (prefers-reduced-motion: reduce) {
  .rules li { transition: none; }
}
</style>
