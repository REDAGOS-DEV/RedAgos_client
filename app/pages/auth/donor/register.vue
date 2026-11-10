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

          <div class="au-field">
            <span id="idPhoto-label" class="au-label">ID photo <span class="au-optional">Optional</span></span>
            <input
              ref="idPhotoInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              @change="onIdPhotoPicked"
            >

            <div v-if="idPhoto" class="rg-photo">
              <img :src="idPhotoUrl" alt="Your ID photo" class="rg-photo__img">
              <div class="rg-photo__meta">
                <span class="rg-photo__name">{{ idPhoto.name }}</span>
                <span class="rg-photo__size">{{ fileSize(idPhoto.size) }}</span>
              </div>
              <div class="rg-photo__actions">
                <button
                  ref="idPhotoChangeBtn"
                  type="button"
                  class="rg-photo__btn"
                  aria-label="Change ID photo"
                  :disabled="submitting"
                  @click="pickIdPhoto"
                >
                  <AssetIcon name="refresh-cw" :size="14" />
                  Change
                </button>
                <button
                  type="button"
                  class="rg-photo__btn rg-photo__btn--remove"
                  aria-label="Remove ID photo"
                  :disabled="submitting"
                  @click="onRemoveIdPhoto"
                >
                  <AssetIcon name="trash-2" :size="14" />
                  Remove
                </button>
              </div>
            </div>

            <button
              v-else
              ref="idPhotoUploadBtn"
              type="button"
              class="rg-drop"
              :class="{ 'rg-drop--invalid': idPhotoError }"
              aria-describedby="idPhoto-label"
              :disabled="submitting"
              @click="pickIdPhoto"
            >
              <span class="rg-drop__icon"><AssetIcon name="upload" :size="18" /></span>
              <span>Upload ID photo</span>
            </button>

            <p v-if="idPhotoError" id="idPhoto-error" class="au-error" role="alert">{{ idPhotoError }}</p>
          </div>

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
            :disabled="submitting"
            @click="onBack"
          >
            <AssetIcon name="arrow-left" :size="18" />
            Back
          </button>
          <button type="submit" class="au-btn" :disabled="submitting">
            <template v-if="!isLastStep">
              Continue
              <AssetIcon name="arrow-right" :size="18" />
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
import { useToast } from '~/composables/useToast'
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
})
const {
  form,
  step,
  currentStep,
  isLastStep,
  errors,
  submitting,
  submitError,
  idPhoto,
  idPhotoError,
} = registration

const toast = useToast()

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
    if (registration.next()) await focusStep()
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

/* ── The ID photo (optional) ── */

const idPhotoInput = ref(null)
const idPhotoUploadBtn = ref(null)
const idPhotoChangeBtn = ref(null)
const idPhotoUrl = ref('')

// A preview of a government ID: the object URL is let go as soon as it is not shown.
watch(idPhoto, (file) => {
  if (idPhotoUrl.value) URL.revokeObjectURL(idPhotoUrl.value)
  idPhotoUrl.value = file ? URL.createObjectURL(file) : ''
})

onBeforeUnmount(() => {
  if (idPhotoUrl.value) URL.revokeObjectURL(idPhotoUrl.value)
})

function pickIdPhoto() {
  idPhotoInput.value?.click()
}

async function onIdPhotoPicked(event) {
  const input = event.target
  const file = input.files?.[0]
  // Emptied so the same file can be picked again after Remove.
  input.value = ''
  if (!file) return

  if (registration.chooseIdPhoto(file)) {
    await nextTick()
    idPhotoChangeBtn.value?.focus()
  }
}

async function onRemoveIdPhoto() {
  registration.removeIdPhoto()
  await nextTick()
  idPhotoUploadBtn.value?.focus()
}

function fileSize(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * The registration takes no file, so the photo goes up through the profile's
 * own upload once the new account is signed in. It is optional: a failure is
 * said, and never keeps the donor out of the portal.
 */
async function sendHeldIdPhoto() {
  try {
    await registration.sendIdPhoto(data => donorService.submitIdentity(data))
    toast.success('ID photo sent for review')
  } catch {
    toast.warning('Your ID photo was not sent', 'You can add it from your profile.')
  }
}

/**
 * The address is verified: sign in with what was typed at registration.
 *
 * After a reload the password is gone (only the address is kept), and a
 * sign-in that fails for any reason leaves the donor on the sign-in screen
 * rather than here. The held ID photo goes with the page in both cases; it
 * can be added from the profile.
 */
async function continueToPortal() {
  clearPendingVerification()

  if (!form.password) {
    return navigateTo('/auth/donor/login')
  }

  signIn.email.value = registeredEmail.value
  signIn.password.value = form.password
  await signIn.login({ beforeHome: idPhoto.value ? sendHeldIdPhoto : undefined })

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

/* ── The ID photo ── */
.rg-drop {
  width: 100%;
  min-height: 60px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1.5px dashed #C3D3E6;
  border-radius: var(--au-radius);
  background: var(--au-field);
  color: var(--au-text);
  font: inherit;
  font-size: 14.5px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: border-color 150ms ease, background-color 150ms ease;
}
.rg-drop:hover:not(:disabled) { border-color: var(--au-accent); background: var(--au-accent-soft); }
.rg-drop--invalid { border-color: var(--au-danger); }
.rg-drop:disabled { opacity: 0.6; cursor: not-allowed; }
.rg-drop__icon {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #fff;
  color: var(--au-accent-text);
  box-shadow: 0 1px 2px rgba(11, 31, 58, 0.06);
}

.rg-photo {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--au-border);
  border-radius: var(--au-radius);
  background: var(--au-field);
}
.rg-photo__img {
  width: 72px;
  height: 52px;
  display: block;
  object-fit: cover;
  border-radius: 8px;
  background: var(--au-border);
}
.rg-photo__meta { display: grid; gap: 2px; min-width: 0; }
.rg-photo__name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  color: var(--au-text);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.rg-photo__size { font-size: 12.5px; color: var(--au-muted); }
.rg-photo__actions { display: flex; gap: 6px; }
.rg-photo__btn {
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid var(--au-border);
  border-radius: 9px;
  background: #fff;
  color: var(--au-text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 150ms ease, background-color 150ms ease;
}
.rg-photo__btn:hover:not(:disabled) { border-color: var(--au-accent); background: var(--au-accent-soft); }
.rg-photo__btn--remove { color: var(--au-danger); }
.rg-photo__btn--remove:hover:not(:disabled) { border-color: var(--au-danger); background: #FEF3F2; }
.rg-photo__btn:disabled { opacity: 0.6; cursor: not-allowed; }

.rg-drop:focus-visible,
.rg-photo__btn:focus-visible {
  outline: 2px solid var(--au-accent);
  outline-offset: 2px;
}

@media (max-width: 900px) {
  .rg-drop,
  .rg-photo { background: rgba(255, 255, 255, 0.8); }
  .rg-drop { border-color: rgba(11, 42, 85, 0.2); }
  .rg-photo { border-color: rgba(11, 42, 85, 0.12); }
  .rg-drop--invalid { border-color: var(--au-danger); }
}
/* Phones: the buttons on their own row, wide enough for a thumb. */
@media (max-width: 480px) {
  .rg-photo { grid-template-columns: 64px minmax(0, 1fr); }
  .rg-photo__img { width: 64px; height: 46px; }
  .rg-photo__actions { grid-column: 1 / -1; }
  .rg-photo__btn { flex: 1; height: 44px; }
}

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
