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
          <AssetIcon name="truck" :size="16" class="type-card__icon" />
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

      <div v-if="drivesLoading" class="drive-state">
        <div class="spinner" />
        <p>Loading blood drives...</p>
      </div>

      <div v-else-if="bloodDrives.length" class="drive-list">
        <button v-for="drive in bloodDrives" :key="drive.id" type="button" class="drive-card"
          :class="{ 'drive-card--active': selectedDriveId === drive.id }" :disabled="driveSlotsLeft(drive) === 0"
          @click="selectedDriveId = drive.id">
          <div class="drive-card__top">
            <div>
              <p class="drive-card__name">{{ drive.name }}</p>
              <p class="drive-card__meta">{{ drive.date }} · {{ drive.time }}</p>
            </div>
            <span class="badge" :class="driveStatusClass(drive)">{{ driveStatusLabel(drive) }}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :class="driveProgressClass(drive)"
              :style="{ width: driveProgressPct(drive) + '%' }" />
          </div>
          <div class="drive-card__bottom">
            <span>{{ drive.registered }} registered</span>
            <span>{{ driveSlotsLeft(drive) }} slots left</span>
          </div>
        </button>
      </div>

      <div v-else class="drive-state">
        <AssetIcon name="truck" :size="32" style="color:#e5e7eb" />
        <p>No blood drives posted yet.</p>
        <p class="drive-state__sub">Check back later once a blood center schedules one near you.</p>
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

          <div v-if="slotsLoading" class="drive-state">
            <div class="spinner" />
            <p>Loading time slots...</p>
          </div>

          <div v-else-if="slotsError" class="drive-state">
            <p>{{ slotsError }}</p>
          </div>

          <div v-else-if="timeSlots.length" class="slots-grid">
            <button v-for="slot in timeSlots" :key="slot.time" type="button" class="slot-btn"
              :class="{ 'slot-btn--active': selectedTimeSlot === slot.time, 'slot-btn--full': slot.available === 0 }"
              :disabled="slot.available === 0" @click="selectedTimeSlot = slot.time">
              <span class="slot-btn__time">{{ slot.time }}</span>
              <span class="slot-btn__avail">{{ slot.available === 0 ? 'Full' : `${slot.available} of ${slot.total}
                available` }}</span>
            </button>
          </div>

          <div v-else class="drive-state">
            <AssetIcon name="calendar" :size="32" style="color:#e5e7eb" />
            <p>No time slots set for this date.</p>
            <p class="drive-state__sub">This blood center hasn't opened slots for {{ formattedSelectedDate }} yet — try another date.</p>
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
import AssetIcon from '~/components/common/AssetIcon.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard'
})

const router = useRouter()

const appointmentType = ref('walkin')
const selectedCenterId = ref('subnational')
const selectedDriveId = ref(null)
const selectedDate = ref('2026-04-20')
const selectedTimeSlot = ref(null)

const showSummary = ref(false)
const showConfirmation = ref(false)
const confirming = ref(false)

function selectType(type) {
  appointmentType.value = type
  selectedTimeSlot.value = null
}

const bloodCenters = reactive([
  { id: 'subnational', name: 'Sub-National Blood Center', location: 'Davao City', hours: 'Mon – Fri 8 AM – 3 PM', status: 'Open today' },
  { id: 'prc', name: 'PRC Davao Blood Services', location: 'Davao City', hours: 'Mon – Sat 7 AM – 4 PM', status: 'Open today' },
  { id: 'spmc', name: 'SPMC Blood Bank', location: 'Davao City', hours: '24/7', status: 'Open today' },
])

// Backend contract: GET /api/time-slots?center_id=&date=
// The blood center configures its own slot schedule and capacity per day —
// donors only ever see whatever the center has actually set for that date.
// Response fields: [{ time, available, total }]
const timeSlots = ref([])
const slotsLoading = ref(false)
const slotsError = ref('')

async function fetchTimeSlots() {
  if (!selectedCenterId.value || !selectedDate.value) {
    timeSlots.value = []
    return
  }
  slotsLoading.value = true
  slotsError.value = ''
  try {
    const data = await $fetch('/api/time-slots', {
      query: { center_id: selectedCenterId.value, date: selectedDate.value },
    })
    timeSlots.value = data ?? []
  } catch (err) {
    console.error('Failed to load time slots:', err)
    slotsError.value = 'Could not load time slots. Please try again.'
    timeSlots.value = []
  } finally {
    slotsLoading.value = false
  }
}

// Refetch whenever the donor is on the walk-in flow and changes center or date;
// also reset the picked slot since it may no longer apply.
watch([selectedCenterId, selectedDate], () => {
  selectedTimeSlot.value = null
  if (appointmentType.value === 'walkin') fetchTimeSlots()
})

watch(appointmentType, (type) => {
  if (type === 'walkin') fetchTimeSlots()
})

onMounted(() => {
  if (appointmentType.value === 'walkin') fetchTimeSlots()
})

// Backend contract: GET /api/blood-drives
// Only returns drives that a blood center has actually posted/scheduled —
// donors should only ever see events that exist in the backend, never mock/placeholder ones.
// Response fields: [{ id, name, date, time, registered, total_slots, status }]
// status: 'upcoming' | 'open' | 'closed' (closed = past cutoff, before slots run out)
const bloodDrives = ref([])
const drivesLoading = ref(false)
const drivesError = ref('')

async function fetchBloodDrives() {
  drivesLoading.value = true
  drivesError.value = ''
  try {
    const data = await $fetch('/api/blood-drives')
    bloodDrives.value = data ?? []
  } catch (err) {
    console.error('Failed to load blood drives:', err)
    drivesError.value = 'Could not load blood drives. Please try again.'
    bloodDrives.value = []
  } finally {
    drivesLoading.value = false
  }
}

function driveSlotsLeft(drive) {
  return Math.max((drive.total_slots ?? 0) - (drive.registered ?? 0), 0)
}

function driveProgressPct(drive) {
  if (!drive.total_slots) return 0
  return Math.round(((drive.registered ?? 0) / drive.total_slots) * 100)
}

function driveProgressClass(drive) {
  return driveSlotsLeft(drive) === 0 ? 'progress-fill--full' : drive.status === 'upcoming' ? 'progress-fill--blue' : 'progress-fill--green'
}

function driveStatusLabel(drive) {
  if (driveSlotsLeft(drive) === 0) return 'Full'
  if (drive.status === 'upcoming') return 'Upcoming'
  return 'Open'
}

function driveStatusClass(drive) {
  if (driveSlotsLeft(drive) === 0) return 'badge--full'
  if (drive.status === 'upcoming') return 'badge--info'
  return 'badge--success'
}

// Fetch drives as soon as the donor switches to the "mobile drive" flow,
// and only once — re-selecting the tab won't refetch.
let drivesFetched = false
watch(appointmentType, (type) => {
  if (type === 'mobile' && !drivesFetched) {
    drivesFetched = true
    fetchBloodDrives()
  }
})

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formattedSelectedDate = computed(() => formatDate(selectedDate.value))

const selectedDrive = computed(() => bloodDrives.value.find(d => d.id === selectedDriveId.value) || null)
const selectedCenter = computed(() => bloodCenters.find(c => c.id === selectedCenterId.value) || null)

const canContinue = computed(() => {
  if (appointmentType.value === 'walkin') {
    return !!(selectedCenterId.value && selectedDate.value && selectedTimeSlot.value)
  }
  if (appointmentType.value === 'mobile') {
    return !!selectedDriveId.value
  }
  return false
})

const typeLabel = computed(() => appointmentType.value === 'walkin' ? 'Walk-in at blood center' : 'Register for mobile drive')

const locationLabel = computed(() => {
  if (appointmentType.value === 'walkin') return selectedCenter.value?.name || '—'
  return selectedDrive.value?.name || '—'
})

const summaryDateLabel = computed(() => {
  if (appointmentType.value === 'walkin') return formattedSelectedDate.value
  return selectedDrive.value?.date || '—'
})

const confirmDateTimeLabel = computed(() => {
  if (appointmentType.value === 'walkin') return `${formattedSelectedDate.value} - ${selectedTimeSlot.value}`
  return `${selectedDrive.value?.date || '—'} - ${selectedDrive.value?.time || '—'}`
})

async function handleConfirm() {
  confirming.value = true
  try {
    // Backend contract: POST /api/appointments
    // Body: { type, center_id | drive_id, date, time_slot }
    // Response: mag-generate ug QR code para sa appointment/registration
    await $fetch('/api/appointments', {
      method: 'POST',
      body: {
        type: appointmentType.value,
        center_id: appointmentType.value === 'walkin' ? selectedCenterId.value : null,
        drive_id: appointmentType.value === 'mobile' ? selectedDriveId.value : null,
        date: appointmentType.value === 'walkin' ? selectedDate.value : selectedDrive.value?.date,
        time_slot: appointmentType.value === 'walkin' ? selectedTimeSlot.value : selectedDrive.value?.time,
      },
    })
  } catch (err) {
    // NOTE: sa dev/UI stage pa lang, wala pay live nga /api/appointments endpoint,
    // so mag-fail gyud ni nga call. Padayon lang ta sa pag-ipakita sa confirmation
    // modal aron dili maka-block sa UI flow — tangtangon na lang ni nga catch
    // (o himuon nga mag-alert) sa dihang naka-connect na ang tinuod nga backend.
    console.error('Failed to confirm appointment (expected while backend is not yet wired up):', err)
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
  transition: background-color 0.2s ease;
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

.badge--full {
  background: #f3f4f6;
  color: var(--text-secondary);
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

.progress-fill--full {
  background: #d1d5db;
}

.drive-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  background: white;
  border: 1px solid #eef0f3;
  border-radius: 12px;
}

.drive-state__sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin: -4px 0 0;
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

/* ============ Dark mode ============ */
:global(.dark .appointment-page) {
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  background: #0F172A;
}

:global(.dark .type-card),
:global(.dark .center-card),
:global(.dark .drive-card),
:global(.dark .drive-state),
:global(.dark .panel),
:global(.dark .slot-btn),
:global(.dark .modal-card) {
  background: #1E293B;
  border-color: #334155;
}

:global(.dark .type-card--active),
:global(.dark .center-card--active),
:global(.dark .drive-card--active),
:global(.dark .slot-btn--active) {
  background: rgba(66,165,245,0.14);
}

:global(.dark .type-card__icon) { background: rgba(66,165,245,0.16); }

:global(.dark .form-input) {
  background: #0F172A;
  border-color: #334155;
  color: #F1F5F9;
}

:global(.dark .slot-btn--full) { background: #263449; }

:global(.dark .badge--success) { background: rgba(102,187,106,0.16); }
:global(.dark .badge--info) { background: rgba(66,165,245,0.16); color: #90CAF9; }
:global(.dark .badge--full) { background: #263449; }

:global(.dark .progress-track) { background: #334155; }
:global(.dark .progress-fill--full) { background: #475569; }

:global(.dark .btn-outline) {
  background: #263449;
  color: #E2E8F0;
}
:global(.dark .btn-outline:hover) { background: #334155; }

:global(.dark .summary-row) { border-color: #263449; }
</style>