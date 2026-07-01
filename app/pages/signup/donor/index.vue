<template>
  <div class="register-page">
    <!-- LEFT SIDE -->
    <aside class="brand-panel">
      <div class="particle particle1"></div>
      <div class="particle particle2"></div>
      <div class="particle particle3"></div>
      <div class="particle particle4"></div>

      <div class="circle circle-top"></div>
      <div class="circle circle-bottom"></div>

      <div class="top-ring"></div>
      <div class="top-ring-2"></div>

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

      <div class="red-glow"></div>
    </aside>

    <!-- RIGHT SIDE -->
    <main class="form-panel">
      <div class="form-topbar">
        <NuxtLink to="/signup" class="back-link">
          <AssetIcon name="chevron-left" :size="16" />
          Back to Role Selection
        </NuxtLink>

        <span class="role-badge">
          <AssetIcon name="heart" :size="14" />
          Donor
        </span>
      </div>

      <div class="form-header">
        <h1>Create Donor Account</h1>
        <p>Fill in your details to get started</p>
      </div>

      <form class="donor-form" @submit.prevent="handleSubmit">
        <div class="form-row">
          <div class="form-field">
            <label for="firstName">First Name</label>
            <input id="firstName" v-model="form.firstName" type="text" placeholder="Juan" />
          </div>
          <div class="form-field">
            <label for="lastName">Last Name</label>
            <input id="lastName" v-model="form.lastName" type="text" placeholder="Dela Cruz" />
          </div>
        </div>

        <div class="form-field">
          <label for="email">Email Address</label>
          <input id="email" v-model="form.email" type="email" placeholder="juan@email.com" />
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="phone">Phone Number</label>
            <input id="phone" v-model="form.phone" type="tel" placeholder="+63 9XX XXX XXXX" />
          </div>
          <div class="form-field">
            <label for="bloodType">Blood Type</label>
            <div class="select-wrap">
              <select id="bloodType" v-model="form.bloodType">
                <option value="" disabled selected>Select</option>
                <option v-for="type in bloodTypes" :key="type" :value="type">{{ type }}</option>
              </select>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="dob">Date of Birth</label>
            <div class="input-icon-wrap">
              <input id="dob" v-model="form.dob" type="date" placeholder="mm/dd/yyyy" />
              <AssetIcon class="field-icon" name="calendar" :size="16" />
            </div>
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
          </div>
        </div>

        <div class="form-field">
          <label for="address">Address</label>
          <input id="address" v-model="form.address" type="text" placeholder="Barangay, City, Province" />
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="password">Password</label>
            <div class="input-icon-wrap">
              <AssetIcon class="field-icon field-icon-left" name="lock" :size="16" />
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="********"
                class="has-left-icon"
              />
              <button type="button" class="toggle-visibility" @click="showPassword = !showPassword">
                <AssetIcon v-if="!showPassword" name="eye" :size="16" />
                <AssetIcon v-else name="eye-off" :size="16" />
              </button>
            </div>
          </div>

          <div class="form-field">
            <label for="confirmPassword">Confirm Password</label>
            <div class="input-icon-wrap">
              <AssetIcon class="field-icon field-icon-left" name="lock" :size="16" />
              <input
                id="confirmPassword"
                v-model="form.confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                placeholder="********"
                class="has-left-icon"
              />
              <button type="button" class="toggle-visibility" @click="showConfirmPassword = !showConfirmPassword">
                <AssetIcon v-if="!showConfirmPassword" name="eye" :size="16" />
                <AssetIcon v-else name="eye-off" :size="16" />
              </button>
            </div>
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

        <button type="submit" class="submit-btn" :disabled="!form.agreedToTerms">
          Submit Registration
        </button>

        <p class="signin-row">
          Already have an account?
          <NuxtLink to="/login">Sign Up</NuxtLink>
        </p>
      </form>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import logo from '~/assets/images/RedAgosLogo.png'

definePageMeta({
  layout: 'auth',
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
  password: '',
  confirmPassword: '',
  agreedToTerms: false,
})

const showPassword = ref(false)
const showConfirmPassword = ref(false)

function handleSubmit() {
  // TODO: wire up to Laravel API endpoint (e.g. POST /api/donors/register)
  console.log('Submitting donor registration:', form)
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

/* ===== LEFT SIDE ===== */
.brand-panel {
  position: relative;
  display: block;
  overflow: hidden;
  padding: 48px;
  background: #206fbd;
  color: #ffffff;
}

.top-ring {
  position: absolute;
  top: -120px;
  left: -120px;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.15);
}

.top-ring-2 {
  position: absolute;
  top: -70px;
  left: -70px;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.15);
}

.particle {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #ff5a74;
}

.particle1 {
  left: 60px;
  bottom: 260px;
  animation: float 6s infinite ease-in-out;
}

.particle2 {
  left: 200px;
  bottom: 340px;
  animation: float 8s infinite ease-in-out;
}

.particle3 {
  left: 500px;
  bottom: 220px;
  animation: float 7s infinite ease-in-out;
}

.particle4 {
  left: 420px;
  bottom: 160px;
  animation: float 9s infinite ease-in-out;
}

.circle {
  position: absolute;
  pointer-events: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.055);
}

.circle-top {
  top: -96px;
  right: -128px;
  width: 320px;
  height: 320px;
}

.circle-bottom {
  left: -96px;
  bottom: -96px;
  width: 384px;
  height: 384px;
}

.brand-lockup {
  animation: logoFloat 5s infinite ease-in-out;
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

.brand-name span {
  color: #ff2f55;
}

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

.red-glow {
  position: absolute;
  left: -120px;
  bottom: -250px;
  width: 650px;
  height: 650px;
  border-radius: 50%;
  background: radial-gradient(circle, #ff4d6d 0%, #ff2f55 20%, rgba(255, 47, 85, 0.4) 60%, transparent 85%);
  filter: blur(100px);
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

.red-glow {
  position: absolute;
  left: -120px;
  bottom: -250px;
  width: 650px;
  height: 650px;
  border-radius: 50%;
  background: radial-gradient(circle, #ff4d6d 0%, #ff2f55 20%, rgba(255, 47, 85, 0.4) 60%, transparent 85%);
  filter: blur(100px);
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes logoFloat {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

@media (max-width: 1023px) {
  .brand-panel {
    display: none;
  }
}

/* ===== RIGHT SIDE ===== */
.form-panel {
  padding: 48px 64px;
  background: #eef2f6;
  min-height: 100%;
}

.form-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.back-link:hover {
  color: #374151;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 999px;
  background: #fff5f5;
  color: #ff2f55;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 8px 24px rgba(255, 47, 85, 0.18);
}

.role-badge svg {
  color: #ff2f55;
}

.form-header {
  margin-bottom: 32px;
}

.form-header h1 {
  margin: 0;
  color: #111827;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.form-header p {
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 15px;
}

.donor-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 720px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-field label {
  color: #111827;
  font-size: 14px;
  font-weight: 700;
}

.form-field input,
.form-field select {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  background: #ffffff;
  color: #111827;
  font-size: 14px;
  font-family: inherit;
  appearance: none;
  box-sizing: border-box;
}

.form-field input::placeholder {
  color: #9ca3af;
}

.form-field input:focus,
.form-field select:focus {
  outline: none;
  border-color: #206fbd;
  box-shadow: 0 0 0 3px rgba(32, 111, 189, 0.12);
}

.select-wrap {
  position: relative;
}

.select-wrap::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 16px;
  width: 8px;
  height: 8px;
  border-right: 2px solid #6b7280;
  border-bottom: 2px solid #6b7280;
  transform: translateY(-70%) rotate(45deg);
  pointer-events: none;
}

.input-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.field-icon {
  position: absolute;
  right: 16px;
  color: #9ca3af;
  pointer-events: none;
}

.field-icon-left {
  left: 16px;
  right: auto;
}

.input-icon-wrap input.has-left-icon {
  padding-left: 44px;
  padding-right: 44px;
}

.toggle-visibility {
  position: absolute;
  right: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
}

.toggle-visibility:hover {
  color: #6b7280;
}

.terms-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.terms-row input[type='checkbox'] {
  margin-top: 3px;
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

.terms-row a:hover {
  text-decoration: underline;
}

.submit-btn {
  width: 100%;
  padding: 16px;
  margin-top: 8px;
  border: none;
  border-radius: 12px;
  background: #206fbd;
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
}

.submit-btn:hover:not(:disabled) {
  background: #1a5c9c;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.signin-row {
  margin: 4px 0 0;
  text-align: center;
  color: #6b7280;
  font-size: 14px;
}

.signin-row a {
  color: #206fbd;
  font-weight: 700;
  text-decoration: none;
}

.signin-row a:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .form-panel {
    padding: 32px 20px;
  }
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>