<template>
  <div class="appointment-page">
    <div class="header-row fade-in" style="--delay: 0ms">
      <h1 class="page-title">Book an Appointment</h1>
      <p class="page-subtitle">Choose where and when you'd like to donate.</p>
    </div>

    <!-- Step 1: Select type -->
    <div class="step-section fade-in" style="--delay: 50ms">
      <h2 class="step-label">Step 1 - Select type</h2>
      <div class="type-grid">
        <button type="button" class="type-card" :class="{ 'type-card--active': appointmentType === 'walkin' }"
          @click="selectType('walkin')">
          <AssetIcon name="calendar" :size="16" class="type-card__icon" />

          <span class="type-card__body">
            <span class="type-card__title">Walk-in at blood center</span>
            <span class="type-card__desc">Book a time slot at a blood center</span>
          </span>
          <span class="radio" :class="{ 'radio--active': appointmentType === 'walkin' }" />
        </button>

        <button type="button" class="type-card" :class="{ 'type-card--active': appointmentType === 'mobile' }"
          @click="selectType('mobile')">
          <span class="type-card__icon">
            <AssetIcon name="truck" :size="16" />
          </span>
          <span class="type-card__body">
            <span class="type-card__title">Register for mobile drive</span>
            <span class="type-card__desc">Join an upcoming community blood drive</span>
          </span>
          <span class="radio" :class="{ 'radio--active': appointmentType === 'mobile' }" />
        </button>
      </div>
    </div>

    <!-- Step 2 (walk-in): choose blood center -->
    <div v-if="appointmentType === 'walkin'" class="step-section fade-in" style="--delay: 100ms">
      <h2 class="step-label">Step 2 - Choose blood center</h2>
      <div class="center-grid">
        <button v-for="center in bloodCenters" :key="center.id" type="button" class="center-card"
          :class="{ 'center-card--active': selectedCenterId === center.id }" @click="selectedCenterId = center.id">
          <span class="center-card__top">
            <span class="center-card__name">{{ center.name }}</span>
            <span class="radio" :class="{ 'radio--active': selectedCenterId === center.id }" />
          </span>
          <span class="center-card__meta">{{ center.location }} · {{ center.hours }}</span>
          <span class="badge badge--success">{{ center.status }}</span>
        </button>
      </div>
    </div>

    <!-- Step 2 (mobile): choose blood drive -->
    <div v-else-if="appointmentType === 'mobile'" class="step-section fade-in" style="--delay: 100ms">
      <h2 class="step-label">Step 2 - Choose blood drive</h2>
      <div class="drive-list">
        <button v-for="drive in bloodDrives" :key="drive.id" type="button" class="drive-card"
          :class="{ 'drive-card--active': selectedDriveId === drive.id }" :disabled="drive.slotsLeft === 0"
          @click="selectedDriveId = drive.id">
          <div class="drive-card__top">
            <div>
              <p class="drive-card__name">{{ drive.name }}</p>
              <p class="drive-card__meta">{{ drive.date }} · {{ drive.time }}</p>
            </div>
            <span class="badge" :class="drive.statusClass">{{ drive.statusLabel }}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :class="drive.progressClass" :style="{ width: drive.progressPct + '%' }" />
          </div>
          <div class="drive-card__bottom">
            <span>{{ drive.registered }} registered</span>
            <span>{{ drive.slotsLeft }} slots left</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Step 3 (walk-in only): date & time slot -->
    <div v-if="appointmentType === 'walkin'" class="step-section fade-in" style="--delay: 150ms">
      <h2 class="step-label">Step 3 - Select date & time slot</h2>
      <div class="panel">
        <div class="form-body">
          <label class="form-label">Date</label>
          <input v-model="selectedDate" type="date" class="form-input form-input--lg">

          <p class="slots-heading">Available time slots - {{ formattedSelectedDate }}</p>
          <div class="slots-grid">
            <button v-for="slot in timeSlots" :key="slot.time" type="button" class="slot-btn"
              :class="{ 'slot-btn--active': selectedTimeSlot === slot.time, 'slot-btn--full': slot.available === 0 }"
              :disabled="slot.available === 0" @click="selectedTimeSlot = slot.time">
              <span class="slot-btn__time">{{ slot.time }}</span>
              <span class="slot-btn__avail">{{ slot.available === 0 ? 'Full' : `${slot.available} of ${slot.total}
                available` }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="continue-row fade-in" style="--delay: 200ms">
      <button type="button" class="btn-primary" :disabled="!canContinue" @click="showSummary = true">Continue</button>
    </div>

    <!-- Booking summary modal -->
    <div v-if="showSummary" class="modal-overlay" @click.self="showSummary = false">
      <div class="modal-card">
        <h3 class="modal-title">Booking Summary</h3>
        <div class="summary-list">
          <div class="summary-row"><span>Type</span><span>{{ typeLabel }}</span></div>
          <div class="summary-row"><span>Location</span><span>{{ locationLabel }}</span></div>
          <div class="summary-row"><span>Date</span><span>{{ summaryDateLabel }}</span></div>
          <div v-if="appointmentType === 'walkin'" class="summary-row"><span>Time slot</span><span>{{ selectedTimeSlot
          }}</span></div>
        </div>
        <button type="button" class="btn-primary btn-block" :disabled="confirming" @click="handleConfirm">
          <span>{{ confirming ? 'Confirming...' : 'Confirm Appointment' }}</span>
          <AssetIcon name="arrow-right" :size="16" />
        </button>
        <p class="modal-note">You can cancel or reschedule up to 24 hours before your appointment.</p>
      </div>
    </div>

    <!-- Confirmation modal -->
    <div v-if="showConfirmation" class="modal-overlay">
      <div class="modal-card modal-card--confirm">
        <div class="confirm-icon">
          <AssetIcon name="check" :size="22" class="confirm-icon__svg" />
        </div>
        <h3 class="modal-title modal-title--center">Appointment Confirmed!</h3>
        <p class="modal-sub">Your appointment has been booked. Remember to bring your QR code when you arrive.</p>
        <div class="summary-list">
          <div class="summary-row"><span>Location</span><span>{{ locationLabel }}</span></div>
          <div class="summary-row"><span>Date &amp; Time</span><span>{{ confirmDateTimeLabel }}</span></div>
          <div class="summary-row"><span>QR code</span><span class="valid-text">Valid</span></div>
        </div>
        <div class="confirm-actions">
          <button type="button" class="btn-outline" @click="viewQr">View QR Code</button>
          <button type="button" class="btn-primary" @click="goDashboard">Go to Dashboard</button>
        </div>
      </div>
    </div>
  </div>
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
    confirming.value = false
  }
  showSummary.value = false
  showConfirmation.value = true
}
 
function viewQr() {
  router.push('/signup/donor/MyQRCode')
}
 
function goDashboard() {
  router.push('/signup/donor/Dashboard')
}
</script>
 
<style scoped>
.appointment-page {
  --primary: #1565c0;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --text-primary: #1f2937;
  --text-secondary: #9ca3af;
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px 32px 60px;
  display: flex;
  background: #F5F7FA;
  flex-direction: column;
  gap: 24px;
}
 
.header-row {
  display: flex;
  flex-direction: column;
}
 
.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
 
.page-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 2px 0 0;
}
 
.fade-in {
  animation: fadeInUp 0.5s ease both;
  animation-delay: var(--delay, 0ms);
}
 
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
 
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
 
.step-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
 
.step-label {
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-primary);
  text-transform: uppercase;
  margin: 0;
}
 
/* Type cards */
.type-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
 
.type-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 18px 20px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease;
}
 
.type-card--active {
  background: #eaf3fc;
  border-color: var(--primary);
}
 
.type-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eaf3fc;
  color: var(--primary);
}
 
.type-card__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
 
.type-card__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}
 
.type-card__desc {
  font-size: 12.5px;
  color: var(--text-secondary);
}
 
.radio {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: 2px solid #d1d5db;
  flex-shrink: 0;
  position: relative;
}
 
.radio--active {
  border-color: var(--primary);
}
 
.radio--active::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 999px;
  background: var(--primary);
}
 
/* Center cards */
.center-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
 
.center-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px 18px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
 
.center-card--active {
  background: #eaf3fc;
  border-color: var(--primary);
}
 
.center-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
 
.center-card__name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
}
 
.center-card__meta {
  font-size: 12px;
  color: var(--text-secondary);
}
 
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  width: fit-content;
}
 
.badge--success {
  background: #eaf6ea;
  color: var(--success);
}
 
.badge--info {
  background: #dbeafe;
  color: #1e40af;
}
 
/* Date & time panel */
.panel {
  background: white;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
  border: 1px solid #eef0f3;
  overflow: hidden;
}
 
.form-body {
  padding: 20px;
}
 
.form-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
 
.form-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  font-size: 14px;
  color: var(--text-primary);
  background: white;
  transition: border-color 0.15s ease;
}
 
.form-input:focus {
  outline: none;
  border-color: var(--primary);
}
 
.form-input--lg {
  padding: 12px 14px;
  font-weight: 700;
}
 
.slots-heading {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 20px 0 12px;
}
 
.slots-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
 
.slot-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: white;
  cursor: pointer;
  transition: all 0.15s ease;
}
 
.slot-btn--active {
  background: #eaf3fc;
  border-color: var(--primary);
}
 
.slot-btn--full {
  background: #f3f4f6;
  color: var(--text-secondary);
  cursor: not-allowed;
}
 
.slot-btn__time {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
}
 
.slot-btn--full .slot-btn__time {
  color: var(--text-secondary);
}
 
.slot-btn__avail {
  font-size: 11.5px;
  color: var(--text-secondary);
}
 
/* Drive cards */
.drive-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
 
.drive-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 18px 20px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
 
.drive-card--active {
  background: #eaf3fc;
  border-color: var(--primary);
}
 
.drive-card:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
 
.drive-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
 
.drive-card__name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
 
.drive-card__meta {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 2px 0 0;
}
 
.progress-track {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
}
 
.progress-fill {
  height: 100%;
  border-radius: 999px;
}
 
.progress-fill--blue {
  background: var(--primary);
}
 
.progress-fill--green {
  background: var(--success);
}
 
.drive-card__bottom {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
}
 
/* Continue button row */
.continue-row {
  display: flex;
  justify-content: flex-end;
}
 
/* Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 700;
  color: white;
  background: var(--primary);
  border: none;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
 
.btn-primary:hover:not(:disabled) {
  opacity: 0.92;
}
 
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
 
.btn-block {
  width: 100%;
}
 
.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
  background: #f3f4f6;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
}
 
.btn-outline:hover {
  background: #e5e7eb;
}
 
/* Modals */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}
 
.modal-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
}
 
.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 12px;
}
 
.modal-title--center {
  text-align: center;
}
 
.modal-sub {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  margin: 0 0 16px;
  line-height: 1.5;
}
 
.summary-list {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: 18px;
}
 
.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
  color: var(--text-secondary);
}
 
.summary-row span:last-child {
  font-weight: 700;
  color: var(--text-primary);
}
 
.summary-row:last-child {
  border-bottom: none;
}
 
.valid-text {
  color: var(--success) !important;
}
 
.modal-note {
  font-size: 11.5px;
  color: var(--text-secondary);
  text-align: center;
  margin: 4px 0 0;
  line-height: 1.5;
}
 
.modal-card--confirm {
  align-items: center;
  text-align: center;
}
 
.confirm-icon {
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: var(--success);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
  flex-shrink: 0;
}
 
.confirm-icon__svg {
  color: white;
}
 
.confirm-actions {
  display: flex;
  gap: 10px;
  width: 100%;
  margin-top: 4px;
}
 
.confirm-actions .btn-outline,
.confirm-actions .btn-primary {
  flex: 1;
  padding: 11px 12px;
}
 
@media (max-width: 900px) {
  .center-grid {
    grid-template-columns: 1fr;
  }
 
  .type-grid {
    grid-template-columns: 1fr;
  }
 
  .slots-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
 
@media (max-width: 640px) {
  .appointment-page {
    padding: 16px 16px 40px;
  }
}
</style>
