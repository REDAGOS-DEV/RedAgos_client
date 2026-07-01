<template>
  <main class="hospital-signup">
    <aside class="brand-panel">
      <div class="brand-header">
        <p class="brand-name">
          Red<span>Agos</span>
        </p>
        <p class="brand-subtitle">Blood Bank System</p>
      </div>

      <section class="brand-copy">
        <h2>
          Ensure Blood<br />
          Security
        </h2>

        <p>
          Streamline your hospital's blood supply management with real-time requests, inventory tracking, and seamless coordination with blood centers.
        </p>
      </section>

      <section class="benefits">
        <h3>WHAT YOU GET</h3>
        <div class="benefit-item">
          <span class="benefit-icon">📋</span>
          <span>Submit blood requests</span>
        </div>
        <div class="benefit-item">
          <span class="benefit-icon">⚡</span>
          <span>Priority fulfillment</span>
        </div>
        <div class="benefit-item">
          <span class="benefit-icon">📊</span>
          <span>Request tracking & reports</span>
        </div>
      </section>
    </aside>
    
    <section class="form-panel">
      <div class="form-card">
        <NuxtLink to="/signup" class="back-link">
          &larr; Back to Role Selection
        </NuxtLink>

        <h1>Hospital Registration</h1>
        <p class="form-subtitle">Complete your hospital blood bank setup</p>

        <form class="signup-form" @submit.prevent="submitRegistration">
          <div class="field-group">
            <label for="hospital-name">Hospital Name *</label>
            <input
              id="hospital-name"
              v-model="form.hospitalName"
              type="text"
              placeholder="Enter hospital name"
              required
            >
          </div>

          <div class="field-group">
            <label for="registration-number">Registration Number *</label>
            <input
              id="registration-number"
              v-model="form.registrationNumber"
              type="text"
              placeholder="Hospital registration number"
              required
            >
          </div>

          <div class="field-group">
            <label for="contact-person">Contact Person *</label>
            <input
              id="contact-person"
              v-model="form.contactPerson"
              type="text"
              placeholder="Name of primary contact"
              required
            >
          </div>

          <div class="field-group">
            <label for="email">Email Address *</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              placeholder="hospital@example.com"
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
            <label for="address">Address *</label>
            <input
              id="address"
              v-model="form.address"
              type="text"
              placeholder="Hospital address"
              required
            >
          </div>

          <div class="field-group">
            <label for="city">City *</label>
            <input
              id="city"
              v-model="form.city"
              type="text"
              placeholder="City"
              required
            >
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
  hospitalName: '',
  registrationNumber: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  city: '',
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
    
    successMessage.value = 'Hospital registration submitted! Check your email for verification.'
    
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
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
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
  color: #93c5fd;
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

input {
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

input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
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
  background: #2563eb;
  color: #ffffff;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.2s;
}

.submit-button:hover:not(:disabled) {
  background: #1d4ed8;
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