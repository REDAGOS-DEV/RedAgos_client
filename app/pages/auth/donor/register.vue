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
              <input id="firstName" v-model="form.firstName" v-person-name type="text" placeholder="e.g. Maria" autocomplete="given-name">
            </div>
            <p v-if="fieldErrors.first_name" class="au-error">{{ fieldErrors.first_name }}</p>
          </div>
          <div class="au-field">
            <label for="lastName">Last name</label>
            <div class="au-input" :class="{ 'au-input--invalid': fieldErrors.last_name }">
              <input id="lastName" v-model="form.lastName" v-person-name type="text" placeholder="e.g. Santos" autocomplete="family-name">
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
            :invalid="Boolean(fieldErrors.blood_type)"
          />
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
            <PhoneField id="phone" v-model="form.phone" class="au-phone" :invalid="Boolean(fieldErrors.phone)" />
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
              <IdNumberField
                id="validIdNumber"
                v-model="form.validIdNumber"
                :id-type="form.validIdType"
                class="au-idnum"
                :invalid="Boolean(fieldErrors.valid_id_number)"
                :reveal="revealIdNumber"
              />
              <p v-if="fieldErrors.valid_id_number" class="au-error">{{ fieldErrors.valid_id_number }}</p>
            </div>
          </div>
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
import { onMounted, reactive, ref } from 'vue'
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

const validIdTypes = VALID_ID_TYPE_OPTIONS

// Set on a submit tried with an ID number of the wrong shape, so the field's
// tooltip shows even if the donor never left the field.
const revealIdNumber = ref(false)

const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isSubmitting = ref(false)
const submitError = ref('')
const fieldErrors = reactive({})

// Kung dili blangko, na-submit na ang registration ug ang code step na ang
// gipakita imbes ang porma.
const registeredEmail = ref('')

// The sign-in after the code: the address and password just typed, so the
// donor lands in the portal instead of typing them again.
const signIn = useAuthLogin('donor')

async function handleSubmit() {
  if (isSubmitting.value) return

  if (idNumberProblem(form.validIdType, form.validIdNumber)) {
    revealIdNumber.value = true
    document.getElementById('validIdNumber')?.focus()
    return
  }

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
    // code ug ang resend.
    registeredEmail.value = form.email.trim()

    // Gi-sulat sa localStorage aron ma-survive ang refresh.
    rememberPendingVerification(registeredEmail.value)
  } catch (err) {
    applyValidationErrors(err)
    submitError.value = err?.message || 'Something went wrong while creating your account. Please try again.'
  } finally {
    isSubmitting.value = false
  }
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
</style>
