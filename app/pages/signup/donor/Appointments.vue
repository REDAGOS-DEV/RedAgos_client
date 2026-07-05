<template>
  <main class="appointment-booking">
    <header class="page-header">
      <h1>Book Appointment</h1>
      <p>Schedule your blood donation appointment</p>
    </header>

    <form class="booking-form" @submit.prevent="submitBooking">
      <div class="field-group">
        <label for="preferred-date">Preferred Date *</label>
        <input id="preferred-date" v-model="form.date" type="date" required>
      </div>

      <div class="field-group">
        <label for="preferred-time">Preferred Time *</label>
        <select id="preferred-time" v-model="form.time" required>
          <option value="">Select time slot</option>
          <option value="08:00">8:00 AM</option>
          <option value="09:00">9:00 AM</option>
          <option value="10:00">10:00 AM</option>
          <option value="14:00">2:00 PM</option>
          <option value="15:00">3:00 PM</option>
          <option value="16:00">4:00 PM</option>
        </select>
      </div>

      <div class="field-group">
        <label for="blood-center">Blood Center *</label>
        <select id="blood-center" v-model="form.center" required>
          <option value="">Select blood center</option>
          <option value="main">Main Blood Center - Davao</option>
          <option value="south">Southern Philippines Medical Center</option>
          <option value="brokenshire">Brokenshire Blood Center</option>
        </select>
      </div>

      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      <p v-if="successMessage" class="success-message">{{ successMessage }}</p>

      <button type="submit" class="submit-btn" :disabled="loading">
        {{ loading ? 'Booking...' : 'Confirm Appointment' }} →
      </button>
    </form>
  </main>
</template>

<script setup>
import { ref } from 'vue'

const form = ref({
  date: '',
  time: '',
  center: '',
})

const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const submitBooking = async () => {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await new Promise(resolve => setTimeout(resolve, 1200))
    successMessage.value = 'Appointment confirmed! Check your email for details.'
    setTimeout(() => {
      navigateTo('/signup/donor')
    }, 2000)
  } catch (error) {
    errorMessage.value = 'Booking failed. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
main {
  min-height: 100vh;
  background: #f8fafc;
  padding: 40px;
}

.page-header {
  margin-bottom: 40px;
  max-width: 600px;
}

.page-header h1 {
  font-size: 32px;
  font-weight: 800;
  color: #1f2937;
  margin-bottom: 8px;
}

.page-header p {
  font-size: 16px;
  color: #64748b;
}

.booking-form {
  background: #ffffff;
  max-width: 500px;
  padding: 32px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.field-group {
  margin-bottom: 24px;
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
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
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

.submit-btn {
  width: 100%;
  height: 52px;
  margin-top: 24px;
  border: 0;
  border-radius: 8px;
  background: #ef4444;
  color: #ffffff;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
}

.submit-btn:hover:not(:disabled) {
  background: #dc2626;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>