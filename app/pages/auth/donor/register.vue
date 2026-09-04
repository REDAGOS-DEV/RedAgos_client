<template>
  <div class="register-page">
    <!-- LEFT SIDE -->
    <aside class="brand-panel">
      <div class="brand-lockup">
        <div class="brand-mark">
          <img :src="logo" alt="RedAgos Logo" class="logo-image" />
        </div>

        <div>
          <p class="brand-name">
            Red<span>Agos</span>
          </p>
          <p class="brand-subtitle">Blood Bank System</p>
        </div>
      </div>

      <section class="brand-copy">
        <h2>
          Become a<br />
          Life Saver
        </h2>

        <p>
          Register as a donor to schedule donations, track your<br />
          history, and help save lives in Davao City.
        </p>
      </section>

      <div class="what-you-get">
        <p class="wyg-label">What You Get</p>

        <ul class="wyg-list">
          <li class="wyg-item">
            <span class="wyg-icon">
              <AssetIcon name="calendar" :size="18" />
            </span>
            <span>Book donation appointments</span>
          </li>

          <li class="wyg-item">
            <span class="wyg-icon">
              <AssetIcon name="qr-code" :size="18" />
            </span>
            <span>QR-based check-in</span>
          </li>

          <li class="wyg-item">
            <span class="wyg-icon">
              <AssetIcon name="clock" :size="18" />
            </span>
            <span>Donation history tracking</span>
          </li>
        </ul>
      </div>

    </aside>

    <!-- RIGHT SIDE -->
    <main class="form-panel">
      <div class="form-topbar">
        <NuxtLink to="/auth/role-selection" class="back-link">
          <AssetIcon name="chevron-left" :size="16" />
        </NuxtLink>

        <span class="role-badge">
          <AssetIcon name="heart" :size="16" />
          Donor
        </span>
      </div>

      <!--
        Ang email verification kay parte na sa registration, dili na sa ulahi.
        Human ma-submit, dinhi ra ta mo-puyo hangtod ma-verify — walay
        redirect padulong sa login, kay dili man gyud siya makasulod kung wala
        pa na-verify ang address.
      -->
      <section v-if="registeredEmail" class="verify-step">
        <div class="verify-step-icon">
          <AssetIcon name="mail" :size="26" />
        </div>

        <h1>Check your email</h1>

        <p class="verify-step-lead">
          We sent a verification link to
        </p>

        <div class="verify-step-chip">
          <span class="verify-step-chip-email">{{ registeredEmail }}</span>
        </div>

        <p class="verify-step-lead">
          Open it to activate your account — you will not be able to sign in until you do.
        </p>

        <p class="verify-step-hint">
          The link is valid for 60 minutes. No email? Check your spam folder first.
        </p>

        <button
          type="button"
          class="resend-btn"
          :disabled="isResending"
          @click="resendVerification"
        >
          <AssetIcon name="refresh-cw" :size="15" />
          {{ isResending ? 'Sending...' : 'Resend verification email' }}
        </button>

        <p
          v-if="resendMessage"
          class="verify-step-note"
          :class="{ 'verify-step-note--error': resendFailed }"
        >
          {{ resendMessage }}
        </p>

        <p class="signin-row">
          Already verified?
          <NuxtLink to="/auth/donor/login">Sign In</NuxtLink>
        </p>
      </section>

      <template v-else>
      <div class="form-header">
        <h1>Create Donor Account</h1>
        <p>Fill in your details to get started</p>
      </div>

      <form class="donor-form" @submit.prevent="handleSubmit">
        <div class="form-row">
          <div class="form-field">
            <label for="firstName">First Name</label>
            <input id="firstName" v-model="form.firstName" type="text" placeholder="yannie" />
            <p v-if="fieldErrors.first_name" class="field-error">{{ fieldErrors.first_name }}</p>
          </div>
          <div class="form-field">
            <label for="lastName">Last Name</label>
            <input id="lastName" v-model="form.lastName" type="text" placeholder="chen" />
            <p v-if="fieldErrors.last_name" class="field-error">{{ fieldErrors.last_name }}</p>
          </div>
        </div>

        <div class="form-field">
          <label for="email">Email Address</label>
          <input id="email" v-model="form.email" type="email" placeholder="yanchen@email.com" />
          <p v-if="fieldErrors.email" class="field-error">{{ fieldErrors.email }}</p>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="phone">Phone Number</label>
            <input id="phone" v-model="form.phone" type="tel" placeholder="+63 9XX XXX XXXX" />
            <p v-if="fieldErrors.phone" class="field-error">{{ fieldErrors.phone }}</p>
          </div>
          <div class="form-field">
            <label for="bloodType">Blood Type</label>
            <div class="select-wrap">
              <select id="bloodType" v-model="form.bloodType">
                <option value="" disabled selected>Select</option>
                <option v-for="type in bloodTypes" :key="type" :value="type">{{ type }}</option>
              </select>
            </div>
            <p v-if="fieldErrors.blood_type" class="field-error">{{ fieldErrors.blood_type }}</p>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="dob">Date of Birth</label>
            <div class="input-icon-wrap">
              <input id="dob" v-model="form.dob" type="date" placeholder="mm/dd/yyyy" />
            </div>
            <p v-if="fieldErrors.birth_date" class="field-error">{{ fieldErrors.birth_date }}</p>
          </div>
          <div class="form-field">
            <label for="gender">Gender</label>
            <div class="select-wrap">
              <select id="gender" v-model="form.gender">
                <option value="" disabled selected>Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <p v-if="fieldErrors.gender" class="field-error">{{ fieldErrors.gender }}</p>
          </div>
        </div>

        <div class="form-field">
          <label for="address">Address</label>
          <input id="address" v-model="form.address" type="text" placeholder="Barangay, City, Province" />
          <p v-if="fieldErrors.address" class="field-error">{{ fieldErrors.address }}</p>
        </div>

        <!--
          Optional gyud ni. Ang litrato sa ID kay sa profile na i-upload; diri
          ang number ra, para makit-an dayon sa counter ang donor pinaagi sa ID
          nga iyang dala.
        -->
        <div class="form-row">
          <div class="form-field">
            <label for="validIdType">Valid ID <span class="optional-tag">optional</span></label>
            <div class="select-wrap">
              <select id="validIdType" v-model="form.validIdType">
                <option value="">Select an ID</option>
                <option v-for="option in validIdTypes" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <p v-if="fieldErrors.valid_id_type" class="field-error">{{ fieldErrors.valid_id_type }}</p>
          </div>

          <div class="form-field">
            <label for="validIdNumber">ID Number</label>
            <input id="validIdNumber" v-model="form.validIdNumber" type="text" placeholder="As printed on the card" />
            <p v-if="fieldErrors.valid_id_number" class="field-error">{{ fieldErrors.valid_id_number }}</p>
          </div>
        </div>
        <p class="field-hint">Speeds up check-in at the donation counter. You can add this later from your profile.</p>

        <div class="form-row">
          <div class="form-field">
            <label for="password">Password</label>
            <div class="input-icon-wrap">
              <AssetIcon class="field-icon field-icon-left" name="lock" :size="16" />
              <input id="password" v-model="form.password" :type="showPassword ? 'text' : 'password'"
                placeholder="********" class="has-left-icon" />
              <button type="button" class="toggle-visibility" @click="showPassword = !showPassword">
                <AssetIcon v-if="!showPassword" name="eye-off" :size="16" />
                <AssetIcon v-else name="eye" :size="16" />
              </button>
            </div>
            <p v-if="fieldErrors.password" class="field-error">{{ fieldErrors.password }}</p>
          </div>

          <div class="form-field">
            <label for="confirmPassword">Confirm Password</label>
            <div class="input-icon-wrap">
              <AssetIcon class="field-icon field-icon-left" name="lock" :size="16" />
              <input id="confirmPassword" v-model="form.confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'" placeholder="********" class="has-left-icon" />
              <button type="button" class="toggle-visibility" @click="showConfirmPassword = !showConfirmPassword">
                <AssetIcon v-if="!showConfirmPassword" name="eye-off" :size="16" />
                <AssetIcon v-else name="eye" :size="16" />
              </button>
            </div>
            <p v-if="fieldErrors.password_confirmation" class="field-error">{{ fieldErrors.password_confirmation }}</p>
          </div>
        </div>

        <label class="terms-row">
          <input type="checkbox" v-model="form.agreedToTerms" />
          <span>
            I agree to the
            <NuxtLink to="/terms">Terms of Service</NuxtLink>
            and
            <NuxtLink to="/privacy">Privacy Policy</NuxtLink>
          </span>
        </label>
        <p v-if="fieldErrors.terms_accepted" class="field-error">{{ fieldErrors.terms_accepted }}</p>
        <p v-if="submitError" class="submit-error">{{ submitError }}</p>

        <button type="submit" class="submit-btn" :disabled="!form.agreedToTerms || isSubmitting">
          {{ isSubmitting ? 'Submitting...' : 'Submit Registration' }}
        </button>

        <p class="signin-row">
          Already have an account?
          <NuxtLink to="/auth/donor/login">Sign In</NuxtLink>
        </p>
      </form>
      </template>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import logo from '~/assets/images/RedAgosLogo.png'
import { donorService } from '~/api/donor/DonorService'
import { authService } from '~/api/auth/AuthService'

definePageMeta({
  layout: 'default',
  alias: ['/register/donor'],
})

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

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
      blood_type: form.bloodType,
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
.register-page {
  display: grid;
  grid-template-columns: 480px 1fr;
  min-height: 100vh;
}

@media (max-width: 1023px) {
  .register-page {
    grid-template-columns: 1fr;
  }
}

/* ===== LEFT PANEL (BRANDING) ===== */
.brand-panel {
  position: relative;
  display: block;
  overflow: hidden;
  padding: 48px;
  background: #206fbd;
  color: #ffffff;
}

.brand-mark {
  display: flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
}

.brand-name {
  margin: 0;
  color: #ffffff;
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
}

.brand-name span { color: #ff2f55; }

.brand-subtitle {
  margin: 8px 0 0;
  color: #ffffff;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 3px;
  line-height: 1;
  text-transform: uppercase;
}

.brand-copy {
  position: relative;
  z-index: 1;
  max-width: 390px;
  margin-top: 76px;
}

.brand-copy h2 {
  margin: 0;
  color: #ffffff;
  font-size: 37px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.62;
}

.brand-copy p {
  margin: 28px 0 0;
  color: rgba(255, 255, 255, 0.62);
  font-size: 14px;
  line-height: 2.15;
}

.what-you-get {
  position: absolute;
  z-index: 1;
  left: 48px;
  bottom: 56px;
  right: 48px;
}

.wyg-label {
  margin: 0 0 16px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.wyg-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.wyg-item {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
}

.wyg-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

@media (max-width: 1023px) {
  .brand-panel { display: none; }
}

/* ===== RIGHT PANEL (FORM) ===== */
.form-panel {
  padding: 48px 64px;
  background: #eef4fb;
  min-height: 100%;
}

.form-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 32px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

.back-link:hover { color: #374151; }

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 999px;
  background: #fff5f5;
  color: #ff2f55;
  font-size: 14px;
  font-weight: 700;
}

.role-badge svg { color: #ff2f55; }

.form-header { margin-bottom: 28px; }

.form-header h1 {
  margin: 0;
  color: #111827;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.form-header p {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.donor-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 720px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.optional-tag {
  font-weight: 400;
  color: #94a3b8;
  font-size: 11px;
}

.field-hint {
  margin: -6px 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.form-field label {
  color: #111827;
  font-size: 13px;
  font-weight: 700;
}

/* Base input & select layout */
.form-field input,
.form-field select {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  background: #ffffff;
  color: #111827;
  font-size: 14px;
  font-family: inherit;
  line-height: normal;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  box-sizing: border-box;
}

.form-field input::placeholder { color: #9ca3af; }

.form-field input:focus,
.form-field select:focus {
  outline: none;
  border-color: #206fbd;
  box-shadow: 0 0 0 3px rgba(32, 111, 189, 0.12);
}

/* DROPDOWN (SELECT) FIXES */
.select-wrap {
  position: relative;
  width: 100%;
}

.form-field select {
  padding-right: 38px;
  cursor: pointer;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-wrap::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 14px;
  width: 7px;
  height: 7px;
  border-right: 2px solid #6b7280;
  border-bottom: 2px solid #6b7280;
  transform: translateY(-65%) rotate(45deg);
  pointer-events: none;
}

/* NATIVE DROPDOWN OPTIONS LIST CONTROL */
.form-field select option {
  font-size: 13px;
  padding: 8px 10px;
  background-color: #ffffff;
  color: #111827;
}

/* DATE PICKER (CALENDAR) FIXES */
.form-field input[type='date'] {
  padding-right: 12px;
  color: #111827;
}

.form-field input[type='date']::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.6;
  padding: 4px;
  margin: 0;
  border-radius: 4px;
}

.form-field input[type='date']::-webkit-calendar-picker-indicator:hover {
  opacity: 1;
  background-color: #f3f4f6;
}

/* ICON INPUT WRAPPERS */
.input-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.field-icon {
  position: absolute;
  right: 14px;
  color: #9ca3af;
  pointer-events: none;
}

.field-icon-left {
  left: 14px;
  right: auto;
}

.input-icon-wrap input.has-left-icon {
  padding-left: 42px;
  padding-right: 42px;
}

.toggle-visibility {
  position: absolute;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 6px;
}

.toggle-visibility:hover { color: #6b7280; }

.terms-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}

.terms-row input[type='checkbox'] {
  margin-top: 2px;
  width: 16px;
  height: 16px;
  accent-color: #206fbd;
  cursor: pointer;
}

.terms-row a {
  color: #206fbd;
  font-weight: 600;
  text-decoration: none;
}

.terms-row a:hover { text-decoration: underline; }

.field-error,
.submit-error {
  margin: 0;
  color: #C62828;
  font-size: 12.5px;
  font-weight: 500;
}

.submit-btn {
  width: 100%;
  height: 48px;
  margin-top: 4px;
  border: none;
  border-radius: 12px;
  background: #206fbd;
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
}

.submit-btn:hover:not(:disabled) { background: #1a5c9c; }

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.signin-row {
  margin: 4px 0 0;
  text-align: center;
  color: #6b7280;
  font-size: 13px;
}

/* PENDING EMAIL VERIFICATION */
.verify-step {
  max-width: 460px;
  margin: 24px auto 0;
  padding: 36px 32px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #ffffff;
  text-align: center;
}
.verify-step-icon {
  display: flex;
  width: 56px;
  height: 56px;
  align-items: center;
  justify-content: center;
  margin: 0 auto 18px;
  border-radius: 999px;
  background: #e8f1fb;
  color: #206fbd;
}
.verify-step h1 {
  margin: 0;
  color: #111827;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.verify-step-lead {
  margin: 12px 0 0;
  color: #4b5563;
  font-size: 14px;
  line-height: 1.6;
}

.verify-step-chip {
  display: inline-flex;
  align-items: center;
  margin: 10px 0;
  padding: 8px 14px;
  border: 1px solid #dbe6f3;
  border-radius: 999px;
  background: #f4f8fd;
  max-width: 100%;
}

.verify-step-chip-email {
  color: #111827;
  font-size: 13.5px;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.verify-step-hint {
  margin: 10px 0 22px;
  color: #6b7280;
  font-size: 12.5px;
  line-height: 1.5;
}

/* Secondary/outline style: this is a recovery action, not the primary
   next step (opening the email is), so it should read as subordinate
   to the "Submit Registration" button's visual weight. */
.resend-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 46px;
  border: 1px solid #206fbd;
  border-radius: 12px;
  background: #ffffff;
  color: #206fbd;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
}

.resend-btn:hover:not(:disabled) { background: #f0f6fc; }

.resend-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.verify-step-note {
  margin: 14px 0 0;
  color: #166534;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.5;
}
.verify-step-note--error { color: #dc2626; }
.verify-step .signin-row { margin-top: 18px; }

.signin-row a {
  color: #206fbd;
  font-weight: 700;
  text-decoration: none;
}

.signin-row a:hover { text-decoration: underline; }

/* TABLET RESPONSIVE */
@media (max-width: 860px) {
  .form-row {
    grid-template-columns: 1fr;
    gap: 18px;
  }
}

/* MOBILE RESPONSIVE */
@media (max-width: 640px) {
  .form-panel {
    padding: 24px 16px 40px;
  }

  .form-topbar {
    margin-bottom: 24px;
  }

  .form-header {
    margin-bottom: 24px;
  }

  .form-header h1 {
    font-size: 24px;
  }

  .role-badge {
    padding: 8px 14px;
    font-size: 12px;
  }

  /* Input & select mobile sizing */
  .form-field input,
  .form-field select {
    height: 44px;
    font-size: 14px;
    padding-left: 12px;
    padding-right: 12px;
    border-radius: 10px;
  }

  .form-field select {
    padding-right: 34px;
  }

  .form-field select option {
    font-size: 13px;
    padding: 6px 10px;
  }

  .input-icon-wrap input.has-left-icon {
    padding-left: 40px;
    padding-right: 40px;
  }

  .submit-btn {
    height: 46px;
    font-size: 14px;
  }

  .verify-step {
    padding: 28px 20px;
  }

  .verify-step-chip {
    max-width: 100%;
  }

  .verify-step-chip-email {
    max-width: 180px;
  }
}

.submit-btn:focus-visible,
.resend-btn:focus-visible {
  outline: 2px solid var(--rb-primary, #1565C0);
  outline-offset: 2px;
}
</style>