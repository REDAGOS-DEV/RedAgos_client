<template>
  <AuthShell :hero="hero" wide>
    <template #brand-extra>
      <ul class="perks">
        <li v-for="perk in perks" :key="perk.label">
          <span class="perk-icon"><AssetIcon :name="perk.icon" :size="16" /></span>
          {{ perk.label }}
        </li>
      </ul>
    </template>

    <!--
      Ang email verification kay parte na sa registration, dili na sa ulahi.
      Human ma-submit, dinhi ra ta mo-puyo hangtod ma-verify. Walay redirect
      padulong sa login, kay dili man gyud siya makasulod kung wala pa
      na-verify ang address.
    -->
    <section v-if="registeredEmail" class="verify-step" aria-live="polite">
      <span class="verify-icon"><AssetIcon name="mail" :size="26" /></span>

      <header class="au-header">
        <h1>Check your email</h1>
        <p>We sent a verification link to</p>
      </header>

      <p class="verify-email">{{ registeredEmail }}</p>

      <p class="verify-lead">
        Open it to activate your account. You can sign in once your email is verified.
      </p>
      <p class="au-hint verify-hint">
        The link is valid for 60 minutes. No email? Check your spam folder first.
      </p>

      <button
        type="button"
        class="au-btn au-btn--outline"
        :disabled="isResending"
        @click="resendVerification"
      >
        <AssetIcon name="refresh-cw" :size="16" :class="{ 'au-spinner': isResending }" />
        {{ isResending ? 'Sending...' : 'Resend verification email' }}
      </button>

      <p
        v-if="resendMessage"
        class="verify-note"
        :class="{ 'verify-note--error': resendFailed }"
        role="status"
      >
        {{ resendMessage }}
      </p>

      <p class="au-footer">
        Already verified?
        <NuxtLink to="/auth/donor/login">Sign In</NuxtLink>
      </p>
    </section>

    <template v-else>
      <header class="au-header">
        <h1>Create your donor account</h1>
        <p>It takes about two minutes. You will verify your email next.</p>
      </header>

      <form class="au-form" novalidate @submit.prevent="handleSubmit">
        <!-- About you -->
        <div class="au-row">
          <div class="au-field">
            <label for="firstName">First name</label>
            <div class="au-input" :class="{ 'au-input--invalid': fieldErrors.first_name }">
              <input id="firstName" v-model="form.firstName" type="text" placeholder="e.g. Maria" autocomplete="given-name">
            </div>
            <p v-if="fieldErrors.first_name" class="au-error">{{ fieldErrors.first_name }}</p>
          </div>
          <div class="au-field">
            <label for="lastName">Last name</label>
            <div class="au-input" :class="{ 'au-input--invalid': fieldErrors.last_name }">
              <input id="lastName" v-model="form.lastName" type="text" placeholder="e.g. Santos" autocomplete="family-name">
            </div>
            <p v-if="fieldErrors.last_name" class="au-error">{{ fieldErrors.last_name }}</p>
          </div>
        </div>

        <div class="au-row">
          <div class="au-field">
            <label for="dob">Date of birth</label>
            <DatePicker
              id="dob"
              v-model="form.dob"
              size="lg"
              theme="light"
              placeholder="Select your birth date"
              :max="todayIso"
              :invalid="Boolean(fieldErrors.birth_date)"
            />
            <p v-if="fieldErrors.birth_date" class="au-error">{{ fieldErrors.birth_date }}</p>
          </div>
          <div class="au-field">
            <label for="gender">Gender</label>
            <AuthSelect
              id="gender"
              v-model="form.gender"
              :options="genders"
              placeholder="Select"
              :invalid="Boolean(fieldErrors.gender)"
            />
            <p v-if="fieldErrors.gender" class="au-error">{{ fieldErrors.gender }}</p>
          </div>
        </div>

        <div class="au-field">
          <label for="bloodType">Blood type</label>
          <AuthSelect
            id="bloodType"
            v-model="form.bloodType"
            :options="bloodTypeOptions"
            icon="blood-drop"
            describedby="bloodTypeHint"
            :invalid="Boolean(fieldErrors.blood_type)"
          />
          <p id="bloodTypeHint" class="au-hint">
            Not sure? Leave it as “I don’t know yet”. The lab records it from your first donation.
          </p>
          <p v-if="fieldErrors.blood_type" class="au-error">{{ fieldErrors.blood_type }}</p>
        </div>

        <!-- How to reach you -->
        <div class="au-row">
          <div class="au-field">
            <label for="email">Email address</label>
            <div class="au-input" :class="{ 'au-input--invalid': fieldErrors.email }">
              <AssetIcon name="mail" :size="18" class="au-icon" />
              <input id="email" v-model="form.email" type="email" placeholder="you@example.com" autocomplete="email">
            </div>
            <p v-if="fieldErrors.email" class="au-error">{{ fieldErrors.email }}</p>
          </div>
          <div class="au-field">
            <label for="phone">Phone number</label>
            <div class="au-input" :class="{ 'au-input--invalid': fieldErrors.phone }">
              <AssetIcon name="phone" :size="18" class="au-icon" />
              <input id="phone" v-model="form.phone" type="tel" placeholder="09XX XXX XXXX" autocomplete="tel">
            </div>
            <p v-if="fieldErrors.phone" class="au-error">{{ fieldErrors.phone }}</p>
          </div>
        </div>

        <div class="au-field">
          <label for="address">Address</label>
          <div class="au-input" :class="{ 'au-input--invalid': fieldErrors.address }">
            <AssetIcon name="map-pin" :size="18" class="au-icon" />
            <input id="address" v-model="form.address" type="text" placeholder="Barangay, City, Province" autocomplete="street-address">
          </div>
          <p v-if="fieldErrors.address" class="au-error">{{ fieldErrors.address }}</p>
        </div>

        <!--
          Optional gyud ni. Ang litrato sa ID kay sa profile na i-upload; diri
          ang number ra, para makit-an dayon sa counter ang donor pinaagi sa ID
          nga iyang dala.
        -->
        <div class="au-field">
          <div class="au-row">
            <div class="au-field">
              <label for="validIdType">Valid ID <span class="au-optional">Optional</span></label>
              <AuthSelect
                id="validIdType"
                v-model="form.validIdType"
                :options="validIdTypes"
                placeholder="Select an ID"
                icon="id-card"
                :invalid="Boolean(fieldErrors.valid_id_type)"
              />
              <p v-if="fieldErrors.valid_id_type" class="au-error">{{ fieldErrors.valid_id_type }}</p>
            </div>
            <div class="au-field">
              <label for="validIdNumber">ID number</label>
              <div class="au-input" :class="{ 'au-input--invalid': fieldErrors.valid_id_number }">
                <input id="validIdNumber" v-model="form.validIdNumber" type="text" placeholder="As printed on the card">
              </div>
              <p v-if="fieldErrors.valid_id_number" class="au-error">{{ fieldErrors.valid_id_number }}</p>
            </div>
          </div>
          <p class="au-hint">Speeds up check-in at the donation counter. You can add it later from your profile.</p>
        </div>

        <!-- Password -->
        <div class="au-row">
          <div class="au-field">
            <label for="password">Password</label>
            <div class="au-input" :class="{ 'au-input--invalid': fieldErrors.password }">
              <AssetIcon name="lock" :size="18" class="au-icon" />
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Create a password"
                autocomplete="new-password"
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
            <p v-if="fieldErrors.password" class="au-error">{{ fieldErrors.password }}</p>
          </div>
          <div class="au-field">
            <label for="confirmPassword">Confirm password</label>
            <div class="au-input" :class="{ 'au-input--invalid': fieldErrors.password_confirmation }">
              <AssetIcon name="lock" :size="18" class="au-icon" />
              <input
                id="confirmPassword"
                v-model="form.confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                placeholder="Re-enter your password"
                autocomplete="new-password"
              >
              <button
                type="button"
                class="au-icon-btn"
                :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                <AssetIcon :name="showConfirmPassword ? 'eye' : 'eye-off'" :size="18" />
              </button>
            </div>
            <p v-if="fieldErrors.password_confirmation" class="au-error">{{ fieldErrors.password_confirmation }}</p>
          </div>
        </div>

        <label class="terms">
          <input v-model="form.agreedToTerms" type="checkbox">
          <span>
            I agree to the
            <NuxtLink to="/legal/terms" target="_blank">Terms of Service</NuxtLink>
            and
            <NuxtLink to="/legal/privacy" target="_blank">Privacy Policy</NuxtLink>
          </span>
        </label>
        <p v-if="fieldErrors.terms_accepted" class="au-error">{{ fieldErrors.terms_accepted }}</p>

        <div v-if="submitError" class="submit-error" role="alert">
          <AssetIcon name="octagon-alert" :size="16" />
          <span>{{ submitError }}</span>
        </div>

        <button type="submit" class="au-btn" :disabled="!form.agreedToTerms || isSubmitting">
          <AssetIcon
            :name="isSubmitting ? 'loader' : 'user-check'"
            :size="18"
            :class="{ 'au-spinner': isSubmitting }"
          />
          {{ isSubmitting ? 'Creating account...' : 'Create account' }}
        </button>
      </form>

      <p class="au-footer">
        Already have an account?
        <NuxtLink to="/auth/donor/login">Sign In</NuxtLink>
      </p>
    </template>
  </AuthShell>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import AuthShell from '~/components/auth/AuthShell.vue'
import AuthSelect from '~/components/auth/AuthSelect.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import { authPhoto } from '~/utils/authPhotos'
import { donorService } from '~/api/donor/DonorService'
import { authService } from '~/api/auth/AuthService'

definePageMeta({
  layout: 'default',
  alias: ['/register/donor'],
})

// Brand panel copy for the shared AuthShell frame.
const hero = {
  lead: 'Become a',
  accent: 'lifesaver',
  desc: 'Register as a donor to schedule donations, track your history, and help save lives in Davao City.',
  ...authPhoto('drive'),
}

// What a donor account unlocks, shown under the brand panel copy.
const perks = [
  { icon: 'calendar-check', label: 'Book donation appointments' },
  { icon: 'qr-code', label: 'QR check-in at the blood center' },
  { icon: 'history', label: 'Your full donation history' },
]

// A birth date cannot be in the future.
const todayIso = new Date().toLocaleDateString('en-CA')

const genders = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

// "I don't know yet" is the empty value: it is sent as null (see handleSubmit).
const bloodTypeOptions = [
  { value: '', label: "I don't know yet" },
  ...bloodTypes.map(type => ({ value: type, label: type })),
]

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  bloodType: '',
  dob: '',
  gender: '',
  address: '',
  validIdType: '',
  validIdNumber: '',
  password: '',
  confirmPassword: '',
  agreedToTerms: false,
})

const validIdTypes = [
  { value: 'philsys', label: 'PhilSys (National ID)' },
  { value: 'umid', label: 'UMID' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'passport', label: 'Passport' },
  { value: 'postal_id', label: 'Postal ID' },
  { value: 'prc_id', label: 'PRC ID' },
  { value: 'voters_id', label: "Voter's ID" },
  { value: 'sss_id', label: 'SSS ID' },
]

const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isSubmitting = ref(false)
const submitError = ref('')
const fieldErrors = reactive({})

// Kung dili blangko, na-submit na ang registration ug ang verification step na
// ang gipakita imbes ang porma.
const registeredEmail = ref('')
const isResending = ref(false)
const resendMessage = ref('')
const resendFailed = ref(false)

async function handleSubmit() {
  if (isSubmitting.value) return

  isSubmitting.value = true
  submitError.value = ''
  clearFieldErrors()

  try {
    await donorService.register({
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email,
      phone: form.phone,
      // An unanswered blood type is sent as null, not '', so the server stores
      // "not known" rather than being handed something to look up.
      blood_type: form.bloodType || null,
      gender: form.gender,
      birth_date: form.dob,
      address: form.address,
      valid_id_type: form.validIdType || null,
      valid_id_number: form.validIdNumber || null,
      password: form.password,
      password_confirmation: form.confirmPassword,
      terms_accepted: form.agreedToTerms,
    })

    // Wala nay redirect padulong sa login: ang account kay dili pa maka-sign in
    // hangtod ma-verify ang address, so dinhi ra siya magpabilin diin naa ang
    // instruksyon ug ang resend.
    registeredEmail.value = form.email.trim()

    // Gi-sulat sa localStorage aron ma-survive ang refresh, ug aron makaila ang
    // page sa signal gikan sa tab nga mo-abli sa verification link.
    rememberPendingVerification(registeredEmail.value)
  } catch (err) {
    applyValidationErrors(err)
    submitError.value = err?.message || 'Something went wrong while creating your account. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

async function resendVerification() {
  if (isResending.value) return

  isResending.value = true
  resendMessage.value = ''
  resendFailed.value = false

  try {
    const response = await authService.resendVerificationEmailFor(registeredEmail.value)
    resendMessage.value = response?.message || 'Sent. Check your inbox for a fresh link.'
  } catch (err) {
    resendFailed.value = true
    resendMessage.value = err?.status === 429
      ? 'Too many requests. Please wait a few minutes before trying again.'
      : (err?.message || 'Could not send the verification email. Please try again.')
  } finally {
    isResending.value = false
  }
}

/**
 * Balhin padulong sa login kay na-verify na ang address.
 *
 * Gi-tawag ra ni gikan sa marker nga gisulat sa verify-email page human mo-tubag
 * og 200/204 ang `POST /api/email/verify` — so ang backend gyud ang nag-ingon,
 * dili ang pag-klik sa link ug dili pod usa ka timeout.
 */
function proceedToLogin() {
  clearVerificationHandoff()

  return navigateTo('/auth/donor/login')
}

/**
 * Ang tab nga nag-rehistro kay wala nakakita sa verification — sa laing tab man
 * na nahitabo. Duha ka agianan padulong dinhi:
 *
 *   - `storage`: nag-abli pa ang duha ka tab, ug mi-verify siya sa pikas. Ang
 *     event mo-fire ra sa mga tab nga WALA nagsulat, so kini ra gyud.
 *   - mount: gi-refresh niya kini nga tab human ma-verify. Ang `storage` wala
 *     mi-fire para niya, so ang marker mismo ang basahon.
 *
 * Kung walay pending nga registration, wala gyuy bation nga marker: gi-clear man
 * siya sa `rememberPendingVerification` sa matag bag-ong sign-up.
 */
let stopListening = () => {}

onMounted(() => {
  // Kanunay maminaw, bisan walay pending karon: mahimong mo-rehistro siya dinhi
  // mismo karon ug unya mo-verify sa laing tab, ug kung hulaton pa nato ang
  // pending sa mount, wala gyuy maminaw niadtong signal.
  stopListening = onEmailVerified(() => {
    // Ang panel ra ang gi-balhin. Kung nagbasa pa siya sa porma, pasagdi siya.
    if (registeredEmail.value) {
      proceedToLogin()
    }
  })

  const pending = readPendingVerification()

  if (!pending) {
    return
  }

  if (hasVerifiedSignal()) {
    proceedToLogin()
    return
  }

  // Ibalik ang panel: kung wala ni, ang refresh mo-balik sa blangko nga porma ug
  // mawala ang resend button nga mao ra ang ilang agianan.
  registeredEmail.value = pending.email
})

onBeforeUnmount(() => stopListening())

function clearFieldErrors() {
  for (const key of Object.keys(fieldErrors)) {
    delete fieldErrors[key]
  }
}

function applyValidationErrors(error) {
  if (!error?.errors) return

  for (const [field, messages] of Object.entries(error.errors)) {
    fieldErrors[field] = Array.isArray(messages) ? messages[0] : String(messages)
  }
}
</script>

<style scoped>
/*
  The frame, fields and buttons come from AuthShell (.au-*). Only what is
  specific to registration lives here.
*/

/* ── Brand panel perks ── */
.perks {
  position: relative;
  list-style: none;
  margin: -8px 0 28px;
  padding: 0;
  display: grid;
  gap: 10px;
}
.perks li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--au-text);
}
.perk-icon {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: #fff;
  color: var(--au-accent-text);
  box-shadow: 0 1px 2px rgba(11, 31, 58, 0.06);
}

/* ── Terms ── */
.terms {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--au-text-2);
  cursor: pointer;
}
.terms input {
  width: 18px;
  height: 18px;
  margin: 1px 0 0;
  flex-shrink: 0;
  accent-color: var(--au-accent);
  cursor: pointer;
}
.terms a {
  color: var(--au-accent-text);
  font-weight: 600;
  text-decoration: none;
}
.terms a:hover { text-decoration: underline; text-underline-offset: 3px; }

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
  font-weight: 500;
  line-height: 1.45;
}
.submit-error :deep(svg) { margin-top: 2px; }

/* ── Verification step ── */
.verify-step { text-align: center; }
.verify-icon {
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
.verify-step .au-header { margin-bottom: 12px; }
.verify-email {
  display: inline-block;
  max-width: 100%;
  margin: 0 0 20px;
  padding: 8px 16px;
  border-radius: 999px;
  background: var(--au-panel);
  color: var(--au-text);
  font-weight: 700;
  overflow-wrap: anywhere;
}
.verify-lead {
  max-width: 40ch;
  margin: 0 auto 8px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--au-text-2);
}
.verify-hint { margin-bottom: 24px; }
.verify-note {
  margin: 12px 0 0;
  font-size: 13.5px;
  color: var(--au-text-2);
}
.verify-note--error { color: var(--au-danger); font-weight: 600; }
</style>
