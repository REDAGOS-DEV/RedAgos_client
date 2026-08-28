<template>
  <div class="blood-center-signup">
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
          Hospital<br />
          Blood Bank<br />
          Portal
        </h2>

        <p>
          For medical technologists and hospital blood bank
          personnel at SPMC and partner facilities.
        </p>
      </section>

      <div class="what-you-get">
        <p class="wyg-label">STAFF CAPABILITIES</p>

        <ul class="wyg-list">
          <li class="wyg-item">
            <span class="wyg-icon">
              <AssetIcon name="file-plus" :size="18" />
            </span>
            <span>Create & track blood requests</span>
          </li>

          <li class="wyg-item">
            <span class="wyg-icon">
              <AssetIcon name="search" :size="18" />
            </span>
            <span>Search blood availability</span>
          </li>

          <li class="wyg-item">
            <span class="wyg-icon">
              <AssetIcon name="clipboard-plus" :size="18" />
            </span>
            <span>Generate usage reports</span>
          </li>

          <li class="wyg-item">
            <span class="wyg-icon">
              <AssetIcon name="bell" :size="18" />
            </span>
            <span>Real-time notifications</span>
          </li>
        </ul>
      </div>
      <div class="red-glow"></div>
    </aside>

    <!-- RIGHT SIDE -->
    <main class="form-panel">
      <div class="form-card">
        <div class="top-row">
          <NuxtLink to="/auth/role-selection" class="back-link">
            <AssetIcon name="chevron-left" :size="16" />
             Back to Role Selection
          </NuxtLink>

          <span class="role-badge">
            <AssetIcon name="hospital" :size="24" />
            Blood Banks
          </span>
        </div>

        <div class="header-row">
          <div>
            <h1>Hospital Blood Bank Staff Registration</h1>
            <p class="form-subtitle">Register your hospital blood bank to access blood services</p>
          </div>
        </div>

        <div class="info-banner">
          <AssetIcon name="info" :size="14" />
          <span>Account requires approval from the System Administrator before activation.</span>
        </div>

        <form class="signup-form" @submit.prevent="submitRegistration">
          <div class="form-group">
            <label for="centerName">Blood Center Name</label>
            <input
              id="centerName"
              v-model="form.centerName"
              type="text"
              name="centerName"
              placeholder="e.g., Southern Philippines Medical Center"
            />
          </div>

          <div class="form-group">
            <label for="dohLicense">DOH License Number</label>
            <input
              id="dohLicense"
              v-model="form.dohLicense"
              type="text"
              name="dohLicense"
              placeholder="e.g., DOH-XI-0000-000"
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="contactPerson">Contact Person (Full Name)</label>
              <input
                id="contactPerson"
                v-model="form.contactPerson"
                type="text"
                name="contactPerson"
                autocomplete="name"
                placeholder="Name of authorized representative"/>
            </div>
          

            <div class="form-group">
              <label for="role">Role/Position</label>
              <div class="input-icon-wrap">
              <select id="role" v-model="form.role" name="role">
                <option value="" disabled selected>Select role</option>
                <option value="admin">Blood Bank Administrator</option>
                <option value="staff">Medical Staff</option>
                <option value="coordinator">Donor Coordinator</option>
              </select>
              <AssetIcon class="select-icon" name="chevron-left" :size="16" />
            </div>
          </div>
        </div>

          <div class="form-row">
            <div class="form-group">
              <label for="email">Email Address</label>
              <input
                id="email"
                v-model="form.email"
                type="email"
                name="email"
                autocomplete="email"
                placeholder="facility@email.com"
              />
            </div>

            <div class="form-group">
              <label for="phone">Phone Number</label>
              <input
                id="phone"
                v-model="form.phone"
                type="tel"
                name="phone"
                autocomplete="tel"
                placeholder="+63 (82) 000-0000"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="address">Facility Address</label>
            <input
              id="address"
              v-model="form.address"
              type="text"
              name="address"
              autocomplete="street-address"
              placeholder="Complete facility address"
            />
          </div>

          <div class="form-group">
            <label for="description">Brief Description (Optional)</label>
            <textarea
              id="description"
              v-model="form.description"
              rows="3"
              placeholder="Describe your facility..."
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="password">Password</label>
              <div class="input-icon-wrap">
                <AssetIcon class="field-icon field-icon-left" name="lock" :size="16" />
                <input
                  id="password"
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  name="password"
                  autocomplete="new-password"
                  placeholder="********"
                  class="has-left-icon"
                />
                <button
                  type="button"
                  class="toggle-visibility"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                >
                  <AssetIcon v-if="!showPassword" name="eye" :size="16" />
                  <AssetIcon v-else name="eye-off" :size="16" />
                </button>
              </div>
            </div>

            <div class="form-group">
              <label for="confirmPassword">Confirm Password</label>
              <div class="input-icon-wrap">
                <AssetIcon class="field-icon field-icon-left" name="lock" :size="16" />
                <input
                  id="confirmPassword"
                  v-model="form.confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  name="confirmPassword"
                  autocomplete="new-password"
                  placeholder="********"
                  class="has-left-icon"
                />
                <button
                  type="button"
                  class="toggle-visibility"
                  :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <AssetIcon v-if="!showConfirmPassword" name="eye" :size="16" />
                  <AssetIcon v-else name="eye-off" :size="16" />
                </button>
              </div>
            </div>
          </div>

          <p v-if="errorMessage" class="form-message error">{{ errorMessage }}</p>
          <p v-if="successMessage" class="form-message success">{{ successMessage }}</p>

          <button type="submit" class="submit-btn" :disabled="loading">
            {{ loading ? 'Submitting...' : 'Submit Registration' }}
          </button>

          <p class="signin-row">
            Already have an account?
            <NuxtLink to="/login">Sign In</NuxtLink>
          </p>
        </form>
      </div>
      
    </main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import logo from '~/assets/images/RedAgosLogo.png'

definePageMeta({
  alias: ['/register/hospital'],
})

const form = reactive({
  centerName: '',
  dohLicense: '',
  contactPerson: '',
  role: '',
  email: '',
  phone: '',
  address: '',
  description: '',
  password: '',
  confirmPassword: ''
})

const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const submitRegistration = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!form.centerName || !form.dohLicense || !form.contactPerson || !form.role) {
    errorMessage.value = 'Please fill out all required fields.'
    return
  }

  if (form.password !== form.confirmPassword) {
    errorMessage.value = 'Passwords do not match.'
    return
  }

  if (form.password.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters.'
    return
  }

  loading.value = true

  try {
    await new Promise(resolve => setTimeout(resolve, 1500))

    successMessage.value = 'Blood center registration submitted! Check your email for verification.'

    setTimeout(() => {
      navigateTo('/login/hospital')
    }, 2000)
  } catch (error) {
    errorMessage.value = 'Registration failed. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.blood-center-signup {
  min-height: 100vh;
  background: #eef4fb;
  display: grid;
  grid-template-columns: 540px 1fr;
}

/* ===== LEFT SIDE (BRAND PANEL) ===== */
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

.particle1 { left: 60px; bottom: 260px; animation: float 6s infinite ease-in-out; }
.particle2 { left: 200px; bottom: 340px; animation: float 8s infinite ease-in-out; }
.particle3 { left: 500px; bottom: 220px; animation: float 7s infinite ease-in-out; }
.particle4 { left: 420px; bottom: 160px; animation: float 9s infinite ease-in-out; }

.circle {
  position: absolute;
  pointer-events: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.055);
}

.circle-top { top: -96px; right: -128px; width: 320px; height: 320px; }
.circle-bottom { left: -96px; bottom: -96px; width: 384px; height: 384px; }

.brand-lockup { animation: logoFloat 5s infinite ease-in-out; }

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
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@keyframes logoFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

/* Hide brand side on tablet/mobile screens */
@media (max-width: 1023px) {
  .blood-center-signup {
    grid-template-columns: 1fr;
  }
  .brand-panel {
    display: none;
  }
}

/* ===== RIGHT SIDE (FORM PANEL) ===== */
.form-panel {
  flex: 1;
  padding: 40px 56px;
  background: #f8fafc;
  overflow-y: auto;
}

.form-card {
  max-width: 680px;
  margin: 0 auto;
}

.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
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

.header-row {
  display: block;
  margin-bottom: 4px;
}

.header-row h1 {
  font-size: 32px;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 6px;
}

.form-subtitle {
  color: #64748b;
  font-size: 15px;
  margin: 0 0 24px;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #15803d;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 0 0 1px #bbf7d0, 0 0 16px rgba(21, 128, 61, 0.25);
}

.info-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #eff6ff;
  border-left: 4px solid #2563eb;
  color: #1e3a8a;
  font-weight: 600;
  font-size: 14px;
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 32px;
}

.info-banner svg {
  flex-shrink: 0;
  color: #2563eb;
}

/* ===== FORM & INPUT FIELDS ===== */
.signup-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-row .form-group {
  min-width: 0;
  width: 100%;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

/* Base input, select, & textarea sizing */
.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  height: 46px;
  padding: 0 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  color: #0f172a;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: inherit;
  box-sizing: border-box;
}

.form-group textarea {
  height: auto;
  padding: 12px 14px;
  resize: vertical;
  min-height: 80px;
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: #94a3b8;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

/* Custom Select Dropdown Options Control */
.form-group select {
  padding-right: 38px;
  cursor: pointer;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-group select option {
  font-size: 13px;
  padding: 8px 10px;
  background-color: #ffffff;
  color: #0f172a;
}

.input-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
}

.select-icon {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%) rotate(-90deg);
  color: #64748b;
  pointer-events: none;
}

.field-icon-left {
  position: absolute;
  left: 14px;
  right: auto;
  color: #9ca3af;
  pointer-events: none;
}

.input-icon-wrap input.has-left-icon {
  width: 100%;
  padding-left: 42px;
  padding-right: 42px;
  box-sizing: border-box;
}

.toggle-visibility {
  position: absolute;
  right: 10px;
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

/* Messages and submit button */
.form-message {
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  margin: 0;
}

.form-message.error {
  background: #fef2f2;
  color: #b91c1c;
}

.form-message.success {
  background: #f0fdf4;
  color: #15803d;
}

.submit-btn {
  width: 100%;
  height: 48px;
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

.submit-btn:hover:not(:disabled) { background: #1a5c9c; }

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

.signin-row a:hover { text-decoration: underline; }

/* ===== TABLET RESPONSIVE (max-width: 860px) ===== */
@media (max-width: 860px) {
  .form-row {
    grid-template-columns: 1fr;
    gap: 18px;
  }
}

/* ===== MOBILE RESPONSIVE (max-width: 640px) ===== */
@media (max-width: 640px) {
  .form-panel {
    padding: 24px 16px 40px;
  }

  .top-row {
    flex-wrap: wrap;
    margin-bottom: 20px;
  }

  .header-row h1 {
    font-size: 22px;
  }

  .form-subtitle {
    font-size: 13.5px;
    margin-bottom: 18px;
  }

  .role-badge {
    padding: 8px 14px;
    font-size: 12px;
  }

  .info-banner {
    font-size: 12.5px;
    padding: 12px 14px;
    margin-bottom: 20px;
  }

  /* Fixed mobile inputs and dropdown menu popup sizes */
  .form-group input,
  .form-group select,
  .form-group textarea {
    height: 44px;
    font-size: 14px;
    padding-left: 12px;
    padding-right: 12px;
    border-radius: 8px;
  }

  .form-group select {
    padding-right: 34px;
  }

  .form-group select option {
    font-size: 13px;
    padding: 6px 10px;
  }

  .input-icon-wrap input.has-left-icon {
    padding-left: 38px;
    padding-right: 38px;
  }

  .submit-btn {
    height: 46px;
    font-size: 14px;
  }
}
</style>