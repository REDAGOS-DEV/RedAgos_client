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
      Human ma-submit, dinhi ra ta mo-puyo hangtod ma-verify: ang code nga
      gi-email (2026-11-03, kaniadto link), ug human niana diretso na siya
      maka-sign in.
    -->
    <EmailCodeStep v-if="registeredEmail" :email="registeredEmail" @verified="continueToPortal">
      <template #footer>
        <p class="au-footer">
          Already verified?
          <NuxtLink to="/auth/donor/login">Sign In</NuxtLink>
        </p>
      </template>
    </EmailCodeStep>

    <template v-else>
      <header ref="topEl" class="au-header rg-header">
        <h1>Create your donor account</h1>
      </header>

      <!--
        Tulo ka lakang (2026-11-10). Ang Continue mo-check sa lakang nga
        makita ra; ang Back walay check ug walay mawala. Usa ra ka request
        sa katapusan (useDonorRegistration), so walay tunga-tunga nga account.
      -->
      <div class="rg-progress">
        <h2 ref="stepHeading" class="rg-progress__title" tabindex="-1">
          <span class="rg-progress__count">Step {{ step }} of {{ REGISTRATION_STEPS.length }}</span>
          <span class="rg-progress__name">{{ currentStep.title }}</span>
        </h2>
        <div class="rg-progress__track" aria-hidden="true">
          <span
            v-for="entry in REGISTRATION_STEPS"
            :key="entry.step"
            class="rg-progress__seg"
            :class="{ 'is-filled': entry.step <= step }"
          />
        </div>
      </div>

      <!--
        v-show, not v-if: every field stays in the form, so what was typed is
        kept by the page as well as the state, and a password manager sees the
        address and password together when the account is created.
      -->
      <form class="au-form" novalidate @submit.prevent="onSubmit">
        <!-- ── 1 Account ── -->
        <div v-show="step === 1" class="rg-step">
          <div class="au-field">
            <label for="email">Email address</label>
            <div class="au-input" :class="{ 'au-input--invalid': errors.email }">
              <AssetIcon name="mail" :size="18" class="au-icon" />
              <input
                id="email"
                v-model="form.email"
                type="email"
                inputmode="email"
                autocapitalize="off"
                spellcheck="false"
                placeholder="you@example.com"
                autocomplete="email"
                :aria-invalid="errors.email ? 'true' : undefined"
                :aria-describedby="errors.email ? 'email-error' : undefined"
              >
            </div>
            <p v-if="errors.email" id="email-error" class="au-error">{{ errors.email }}</p>
          </div>

          <div class="au-row">
            <div class="au-field">
              <label for="password">Password</label>
              <div class="au-input" :class="{ 'au-input--invalid': errors.password }">
                <AssetIcon name="lock" :size="18" class="au-icon" />
                <input
                  id="password"
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Create a password"
                  autocomplete="new-password"
                  :aria-invalid="errors.password ? 'true' : undefined"
                  :aria-describedby="errors.password ? 'password-error' : undefined"
                >
                <button
                  type="button"
                  class="au-icon-btn"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  :aria-pressed="showPassword"
                  @click="showPassword = !showPassword"
                >
                  <AssetIcon :name="showPassword ? 'eye' : 'eye-off'" :size="18" />
                </button>
              </div>
              <p v-if="errors.password" id="password-error" class="au-error">{{ errors.password }}</p>
            </div>
            <div class="au-field">
              <label for="confirmPassword">Confirm password</label>
              <div class="au-input" :class="{ 'au-input--invalid': errors.password_confirmation }">
                <AssetIcon name="lock" :size="18" class="au-icon" />
                <input
                  id="confirmPassword"
                  v-model="form.confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  placeholder="Re-enter your password"
                  autocomplete="new-password"
                  :aria-invalid="errors.password_confirmation ? 'true' : undefined"
                  :aria-describedby="errors.password_confirmation ? 'confirmPassword-error' : undefined"
                >
                <button
                  type="button"
                  class="au-icon-btn"
                  :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
                  :aria-pressed="showConfirmPassword"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <AssetIcon :name="showConfirmPassword ? 'eye' : 'eye-off'" :size="18" />
                </button>
              </div>
              <p v-if="errors.password_confirmation" id="confirmPassword-error" class="au-error">{{ errors.password_confirmation }}</p>
            </div>
          </div>
        </div>

        <!-- ── 2 Personal details ── -->
        <div v-show="step === 2" class="rg-step">
          <div class="au-row">
            <div class="au-field">
              <label for="firstName">First name</label>
              <div class="au-input" :class="{ 'au-input--invalid': errors.first_name }">
                <input
                  id="firstName"
                  v-model="form.firstName"
                  v-person-name
                  type="text"
                  placeholder="e.g. Maria"
                  autocomplete="given-name"
                  :aria-invalid="errors.first_name ? 'true' : undefined"
                  :aria-describedby="errors.first_name ? 'firstName-error' : undefined"
                >
              </div>
              <p v-if="errors.first_name" id="firstName-error" class="au-error">{{ errors.first_name }}</p>
            </div>
            <div class="au-field">
              <label for="lastName">Last name</label>
              <div class="au-input" :class="{ 'au-input--invalid': errors.last_name }">
                <input
                  id="lastName"
                  v-model="form.lastName"
                  v-person-name
                  type="text"
                  placeholder="e.g. Santos"
                  autocomplete="family-name"
                  :aria-invalid="errors.last_name ? 'true' : undefined"
                  :aria-describedby="errors.last_name ? 'lastName-error' : undefined"
                >
              </div>
              <p v-if="errors.last_name" id="lastName-error" class="au-error">{{ errors.last_name }}</p>
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
                :invalid="Boolean(errors.birth_date)"
                :describedby="errors.birth_date ? 'dob-error' : undefined"
              />
              <p v-if="errors.birth_date" id="dob-error" class="au-error">{{ errors.birth_date }}</p>
            </div>
            <div class="au-field">
              <label for="gender">Gender</label>
              <AuthSelect
                id="gender"
                v-model="form.gender"
                :options="genders"
                placeholder="Select"
                :invalid="Boolean(errors.gender)"
                :describedby="errors.gender ? 'gender-error' : undefined"
              />
              <p v-if="errors.gender" id="gender-error" class="au-error">{{ errors.gender }}</p>
            </div>
          </div>

          <div class="au-field">
            <label for="bloodType">Blood type</label>
            <AuthSelect
              id="bloodType"
              v-model="form.bloodType"
              :options="bloodTypeOptions"
              icon="blood-drop"
              :invalid="Boolean(errors.blood_type)"
              :describedby="errors.blood_type ? 'bloodType-error' : undefined"
            />
            <p v-if="errors.blood_type" id="bloodType-error" class="au-error">{{ errors.blood_type }}</p>
          </div>
        </div>

        <!-- ── 3 Contact and ID ── -->
        <div v-show="step === 3" class="rg-step">
          <div class="au-field">
            <label for="phone">Phone number</label>
            <PhoneField
              id="phone"
              v-model="form.phone"
              class="au-phone"
              :invalid="Boolean(errors.phone)"
              :describedby="errors.phone ? 'phone-error' : undefined"
            />
            <p v-if="errors.phone" id="phone-error" class="au-error">{{ errors.phone }}</p>
          </div>

          <div class="au-field">
            <label for="address">Address</label>
            <div class="au-input" :class="{ 'au-input--invalid': errors.address }">
              <AssetIcon name="map-pin" :size="18" class="au-icon" />
              <input
                id="address"
                v-model="form.address"
                type="text"
                placeholder="Barangay, City, Province"
                autocomplete="street-address"
                :aria-invalid="errors.address ? 'true' : undefined"
                :aria-describedby="errors.address ? 'address-error' : undefined"
              >
            </div>
            <p v-if="errors.address" id="address-error" class="au-error">{{ errors.address }}</p>
          </div>

          <!--
            Required na (2026-11-10): ang type ug ang number nga sakto sa
            porma sa maong ID. Ang litrato lang ang optional.
          -->
          <div class="au-row">
            <div class="au-field">
              <label for="validIdType">Valid ID</label>
              <AuthSelect
                id="validIdType"
                v-model="form.validIdType"
                :options="validIdTypes"
                placeholder="Select an ID"
                icon="id-card"
                :invalid="Boolean(errors.valid_id_type)"
                :describedby="errors.valid_id_type ? 'validIdType-error' : undefined"
              />
              <p v-if="errors.valid_id_type" id="validIdType-error" class="au-error">{{ errors.valid_id_type }}</p>
            </div>
            <div class="au-field">
              <label for="validIdNumber">ID number</label>
              <!-- A number in the wrong shape gets the field's own tooltip; any other problem the line below. -->
              <IdNumberField
                id="validIdNumber"
                v-model="form.validIdNumber"
                :id-type="form.validIdType"
                class="au-idnum"
                required
                :invalid="Boolean(errors.valid_id_number)"
                :reveal="Boolean(errors.valid_id_number)"
                :describedby="idNumberLineShown ? 'validIdNumber-error' : undefined"
              />
              <p v-if="idNumberLineShown" id="validIdNumber-error" class="au-error">{{ errors.valid_id_number }}</p>
            </div>
          </div>

          <!-- The ID photo is not asked for here (2026-11-11): the profile takes it after sign-in. -->
          <p class="rg-later">
            <AssetIcon name="id-card" :size="16" />
            <span>You can add a photo of your ID later from your profile to finish setting up your account.</span>
          </p>

          <div class="au-field">
            <label class="terms" :class="{ 'terms--invalid': errors.terms_accepted }">
              <input
                id="terms"
                v-model="form.agreedToTerms"
                type="checkbox"
                :aria-invalid="errors.terms_accepted ? 'true' : undefined"
                :aria-describedby="errors.terms_accepted ? 'terms-error' : undefined"
              >
              <span>
                I agree to the
                <NuxtLink to="/legal/terms" target="_blank">Terms of Service</NuxtLink>
                and
                <NuxtLink to="/legal/privacy" target="_blank">Privacy Policy</NuxtLink>
              </span>
            </label>
            <p v-if="errors.terms_accepted" id="terms-error" class="au-error">{{ errors.terms_accepted }}</p>
          </div>
        </div>

        <div v-if="submitError" class="submit-error" role="alert">
          <AssetIcon name="octagon-alert" :size="16" />
          <span>{{ submitError }}</span>
        </div>

        <div class="rg-actions" :class="{ 'rg-actions--single': step === 1 }">
          <button
            v-if="step > 1"
            type="button"
            class="au-btn au-btn--outline"
            :disabled="busy"
            @click="onBack"
          >
            <AssetIcon name="arrow-left" :size="18" />
            Back
          </button>
          <button type="submit" class="au-btn" :disabled="busy" :aria-busy="busy ? 'true' : undefined">
            <template v-if="!isLastStep">
              <template v-if="checking">
                <AssetIcon name="loader" :size="18" class="au-spinner" />
                Checking...
              </template>
              <template v-else>
                Continue
                <AssetIcon name="arrow-right" :size="18" />
              </template>
            </template>
            <template v-else>
              <AssetIcon
                :name="submitting ? 'loader' : 'user-check'"
                :size="18"
                :class="{ 'au-spinner': submitting }"
              />
              {{ submitting ? 'Creating account...' : 'Create account' }}
            </template>
          </button>
        </div>
      </form>

      <p class="au-footer">
        Already have an account?
        <NuxtLink to="/auth/donor/login">Sign In</NuxtLink>
      </p>
    </template>
  </AuthShell>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import AuthShell from '~/components/auth/AuthShell.vue'
import AuthSelect from '~/components/auth/AuthSelect.vue'
import EmailCodeStep from '~/components/auth/EmailCodeStep.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import IdNumberField from '~/components/common/IdNumberField.vue'
import PhoneField from '~/components/common/PhoneField.vue'
import { VALID_ID_TYPE_OPTIONS, idNumberProblem } from '~/utils/validId'
import { authPhoto } from '~/utils/authPhotos'
import { donorService } from '~/api/donor/DonorService'
import {
  BLOOD_TYPE_OPTIONS,
  REGISTRATION_GENDERS,
  REGISTRATION_STEPS,
  useDonorRegistration,
} from '~/composables/useDonorRegistration'

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

const genders = [...REGISTRATION_GENDERS]
const bloodTypeOptions = BLOOD_TYPE_OPTIONS
const validIdTypes = VALID_ID_TYPE_OPTIONS

const registration = useDonorRegistration({
  register: payload => donorService.register(payload),
  // Continue asks the server too (2026-11-11): a taken address is said on step 1.
  checkStep: (at, payload) => donorService.checkRegistrationStep(at, payload),
})
const {
  form,
  step,
  currentStep,
  isLastStep,
  errors,
  submitting,
  checking,
  submitError,
} = registration

// Continue or Create account is waiting on the server.
const busy = computed(() => submitting.value || checking.value)

const showPassword = ref(false)
const showConfirmPassword = ref(false)

// IdNumberField draws a wrong shape as its own tooltip; the line under the
// field is for the rest (missing, already on file, too long).
const idNumberLineShown = computed(() =>
  Boolean(errors.valid_id_number) && !idNumberProblem(form.validIdType, form.validIdNumber))

// Kung dili blangko, na-submit na ang registration ug ang code step na ang
// gipakita imbes ang porma.
const registeredEmail = ref('')

// The sign-in after the code: the address and password just typed, so the
// donor lands in the portal instead of typing them again.
const signIn = useAuthLogin('donor')

/* ── Moving between the steps ── */

const topEl = ref(null)
const stepHeading = ref(null)

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** A new step: its heading takes focus, so it is read out, and the top of the form comes into view. */
async function focusStep() {
  await nextTick()
  topEl.value?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
  stepHeading.value?.focus({ preventScroll: true })
}

/** The first field the check stopped on. */
async function focusFirstInvalid() {
  await nextTick()
  const id = registration.firstInvalidInputId()
  if (id) document.getElementById(id)?.focus()
}

async function onSubmit() {
  if (!isLastStep.value) {
    if (await registration.next()) await focusStep()
    else await focusFirstInvalid()
    return
  }

  const created = await registration.submit()

  if (created) {
    // Wala nay redirect padulong sa login: ang account kay dili pa maka-sign in
    // hangtod ma-verify ang address, so dinhi ra siya magpabilin diin naa ang
    // code ug ang resend.
    registeredEmail.value = form.email.trim()

    // Gi-sulat sa localStorage aron ma-survive ang refresh.
    rememberPendingVerification(registeredEmail.value)
    return
  }

  // Refused: stopped on (or sent back to) the step with the problem.
  await focusFirstInvalid()
}

async function onBack() {
  if (registration.back()) await focusStep()
}

/**
 * The address is verified: sign in with what was typed at registration.
 *
 * After a reload the password is gone (only the address is kept), and a
 * sign-in that fails for any reason leaves the donor on the sign-in screen
 * rather than here.
 */
async function continueToPortal() {
  clearPendingVerification()

  if (!form.password) {
    return navigateTo('/auth/donor/login')
  }

  signIn.email.value = registeredEmail.value
  signIn.password.value = form.password
  await signIn.login()

  if (signIn.errorMessage.value) {
    return navigateTo('/auth/donor/login')
  }
}

onMounted(() => {
  // Ibalik ang code step: kung wala ni, ang refresh mo-balik sa blangko nga
  // porma, ug ang pag-rehistro pag-usab mo-ingon ra nga gamit na ang email.
  const pending = readPendingVerification()

  if (pending) {
    registeredEmail.value = pending.email
  }
})
</script>

<style scoped>
/*
  The frame, fields and buttons come from AuthShell (.au-*). Only what is
  specific to registration lives here.
*/

/* ── Header and progress ── */
.au-header.rg-header { margin-bottom: 22px; }

.rg-progress {
  display: grid;
  gap: 12px;
  margin-bottom: 24px;
}
.rg-progress__title {
  margin: 0;
  display: grid;
  gap: 2px;
}
/* Focused by script when a step opens, to be read out; not a control. */
.rg-progress__title:focus { outline: none; }
.rg-progress__count {
  font-size: 13px;
  font-weight: 700;
  color: var(--au-accent-text);
}
.rg-progress__name {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--au-text);
}
.rg-progress__track {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.rg-progress__seg {
  position: relative;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--au-border);
}
.rg-progress__seg::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--au-accent);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 320ms var(--au-ease);
}
.rg-progress__seg.is-filled::after { transform: scaleX(1); }

/* ── A step ── */
.rg-step { display: grid; gap: 18px; }
@media (prefers-reduced-motion: no-preference) {
  /* Replays each time the step is shown (display none → grid). */
  .rg-step { animation: rg-step-in 260ms var(--au-ease) both; }
}
@keyframes rg-step-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .rg-progress__seg::after { transition: none; }
}

/* ── Back / Continue ── */
.rg-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 12px;
}
.rg-actions--single { grid-template-columns: minmax(0, 1fr); }
.rg-actions .au-btn { margin-top: 4px; }

/* ── The phone field, drawn as an .au-input ── */
.au-field .au-phone {
  --pf-h: 50px;
  --pf-radius: var(--au-radius);
  --pf-font: 15px;
  --pf-field: var(--au-field);
  --pf-border: var(--au-border);
  --pf-text: var(--au-text);
  --pf-muted: var(--au-muted);
  --pf-placeholder: var(--au-muted);
  --pf-accent: var(--au-accent);
  --pf-focus: 0 0 0 4px var(--au-accent-soft);
  --pf-hover: var(--au-accent-soft);
}
.au-field .au-phone:focus-within { --pf-field: var(--au-field-focus); }
@media (max-width: 900px) {
  .au-field .au-phone { --pf-field: rgba(255, 255, 255, 0.8); --pf-border: rgba(11, 42, 85, 0.12); }
  .au-field .au-phone:focus-within { --pf-field: #fff; }
  /* 16px so iOS Safari does not zoom in on focus. */
  .au-field .au-phone { --pf-font: 16px; }
}

/* The ID number field (IdNumberField), drawn as the page's other inputs. */
.au-field .au-idnum {
  --idf-h: 50px;
  --idf-radius: var(--au-radius);
  --idf-font: 15px;
  --idf-pad: 14px;
  --idf-field: var(--au-field);
  --idf-border: var(--au-border);
  --idf-text: var(--au-text);
  --idf-placeholder: var(--au-muted);
  --idf-accent: var(--au-accent);
  --idf-focus: 0 0 0 4px var(--au-accent-soft);
  --idf-danger: var(--au-danger);
}
.au-field .au-idnum:focus-within { --idf-field: var(--au-field-focus); }
@media (max-width: 900px) {
  .au-field .au-idnum { --idf-field: rgba(255, 255, 255, 0.8); --idf-border: rgba(11, 42, 85, 0.12); --idf-font: 16px; }
  .au-field .au-idnum:focus-within { --idf-field: #fff; }
}

/* ── The ID photo, later ── */
.rg-later {
  margin: 0;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--au-radius);
  background: var(--au-accent-soft);
  color: var(--au-text-2);
  font-size: 13.5px;
  line-height: 1.5;
}
.rg-later :deep(.asset-icon) { margin-top: 2px; flex-shrink: 0; color: var(--au-accent-text); }

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
  font-weight: 400;
  line-height: 1.5;
  color: var(--au-text-2);
  cursor: pointer;
}
.au-field .terms { font-size: 14px; font-weight: 400; color: var(--au-text-2); }
.terms input {
  width: 18px;
  height: 18px;
  margin: 1px 0 0;
  flex-shrink: 0;
  accent-color: var(--au-accent);
  cursor: pointer;
}
.terms input:focus-visible { outline: 2px solid var(--au-accent); outline-offset: 2px; }
.terms--invalid input { outline: 2px solid var(--au-danger); outline-offset: 1px; }
.terms a {
  color: var(--au-accent-text);
  font-weight: 600;
  text-decoration: none;
}
.terms a:hover { text-decoration: underline; text-underline-offset: 3px; }
.terms a:focus-visible { outline: 2px solid var(--au-accent); outline-offset: 2px; border-radius: 4px; }

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
</style>
