<template>
  <main class="admin-signup">
    <aside class="brand-panel">
      <div class="brand-header">
        <p class="brand-name">
          Red<span>Agos</span>
        </p>
        <p class="brand-subtitle">Blood Bank System</p>
      </div>

      <section class="brand-copy">
        <h2>
          Manage the<br />
          System
        </h2>

        <p>
          Monitor system operations, manage users, generate reports, and ensure optimal performance of RedAgos across all facilities.
        </p>
      </section>

      <section class="benefits">
        <h3>WHAT YOU GET</h3>
        <div class="benefit-item">
          <span class="benefit-icon">⚙️</span>
          <span>System configuration tools</span>
        </div>
        <div class="benefit-item">
          <span class="benefit-icon">👥</span>
          <span>User & role management</span>
        </div>
        <div class="benefit-item">
          <span class="benefit-icon">📊</span>
          <span>Advanced analytics & logs</span>
        </div>
      </section>
    </aside>
    
    <section class="form-panel">
      <div class="form-card">
        <NuxtLink to="/signup" class="back-link">
          &larr; Back to Role Selection
        </NuxtLink>

        <h1>Administrator Registration</h1>
        <p class="form-subtitle">Setup system administrator account</p>

        <form class="signup-form" @submit.prevent="submitRegistration">
          <div class="field-group">
            <label for="first-name">First Name *</label>
            <input
              id="first-name"
              v-model="form.firstName"
              type="text"
              placeholder="Your first name"
              required
            >
          </div>

          <div class="field-group">
            <label for="last-name">Last Name *</label>
            <input
              id="last-name"
              v-model="form.lastName"
              type="text"
              placeholder="Your last name"
              required
            >
          </div>

          <div class="field-group">
            <label for="employee-id">Employee ID *</label>
            <input
              id="employee-id"
              v-model="form.employeeId"
              type="text"
              placeholder="System employee ID"
              required
            >
          </div>

          <div class="field-group">
            <label for="department">Department *</label>
            <input
              id="department"
              v-model="form.department"
              type="text"
              placeholder="Your department"
              required
            >
          </div>

          <div class="field-group">
            <label for="email">Email Address *</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              placeholder="admin@redagos.com"
              required
            >
          </div>

          <div class="field-group">
            <label for="phone">Phone Number *</label>
            <input
              id="phone"
              v-model="form.phone"
              type="tel"
              placeholder="+63 XXX XXX XXXX"
              required
            >
          </div>

          <div class="field-group">
            <label for="authorization-code">Authorization Code *</label>
            <input
              id="authorization-code"
              v-model="form.authorizationCode"
              type="text"
              placeholder="Admin authorization code"
              required
            >
          </div>

          <div class="field-group">
            <label for="access-level">Access Level *</label>
            <select v-model="form.accessLevel" required>
              <option value="">Select access level</option>
              <option value="super-admin">Super Administrator</option>
              <option value="system-admin">System Administrator</option>
              <option value="operations-manager">Operations Manager</option>
            </select>
          </div>

          <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
          <p v-if="successMessage" class="success-message">{{ successMessage }}</p>

          <button type="submit" class="submit-button" :disabled="loading">
            {{ loading ? 'Registering...' : 'Complete Registration' }} →
          </button>
        </form>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'

const form = ref({
  firstName: '',
  lastName: '',
  employeeId: '',
  department: '',
  email: '',
  phone: '',
  authorizationCode: '',
  accessLevel: '',
})

const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const submitRegistration = async () => {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    successMessage.value = 'Administrator registration submitted! Awaiting approval from super-admin.'
    
    setTimeout(() => {
      navigateTo('/')
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

main {
  min-height: 100vh;
  background: #eef4fb;
  display: grid;
  grid-template-columns: 540px 1fr;
}

.brand-panel {
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  color: #ffffff;
  padding: 48px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.brand-header {
  margin-bottom: 48px;
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
  color: #d1d5db;
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
  margin-bottom: 48px;
}

.brand-copy h2 {
  margin: 0;
  color: #ffffff;
  font-size: 48px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.brand-copy p {
  margin: 24px 0 0;
  color: rgba(255, 255, 255, 0.85);
  font-size: 16px;
  line-height: 1.6;
}

.benefits {
  flex: 1;
}

.benefits h3 {
  margin: 0 0 16px 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.benefit-item {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
}

.benefit-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.form-panel {
  display: flex;
  min-height: 100vh;
  justify-content: flex-start;
  padding: 0;
}

.form-card {
  width: 100%;
  max-width: 560px;
  margin-top: 62px;
  margin-left: 140px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

.back-link:hover {
  color: #334155;
}

h1 {
  margin: 46px 0 0;
  color: #1f2937;
  font-size: 38px;
  font-weight: 800;
  line-height: 1.18;
}

.form-subtitle {
  margin: 16px 0 0;
  color: #64748b;
  font-size: 16px;
  line-height: 1.5;
}

.signup-form {
  margin-top: 54px;
}

.field-group {
  margin-bottom: 19px;
}

label {
  display: block;
  color: #1f2937;
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 12px;
}

input,
select {
  width: 100%;
  height: 52px;
  padding: 0 14px;
  border: 1px solid #d6e0eb;
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  font-size: 14px;
  font-family: inherit;
}

input:focus,
select:focus {
  outline: none;
  border-color: #1f2937;
  box-shadow: 0 0 0 3px rgba(31, 41, 55, 0.1);
}

.error-message {
  margin: 16px 0;
  color: #dc2626;
  font-size: 14px;
  font-weight: 700;
}

.success-message {
  margin: 16px 0;
  color: #059669;
  font-size: 14px;
  font-weight: 700;
}

.submit-button {
  width: 100%;
  height: 52px;
  margin-top: 32px;
  border: 0;
  border-radius: 8px;
  background: #1f2937;
  color: #ffffff;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.2s;
}

.submit-button:hover:not(:disabled) {
  background: #374151;
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 1023px) {
  main {
    display: block;
  }

  .form-panel {
    justify-content: center;
    padding: 56px 24px;
  }

  .form-card {
    margin: 0;
  }
}
</style>