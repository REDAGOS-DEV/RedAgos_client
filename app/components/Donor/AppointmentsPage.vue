Exit code: 0
Wall time: 2.4 seconds
Output:
<template>
  <div class="appointment-page">
    <!-- Skeleton loading state -->
    <div v-if="loading" class="appointment-page-inner">
      <div class="skeleton skeleton--header" />
      <div class="skeleton skeleton--steps" />
      <div class="skeleton skeleton--grid">
        <div class="skeleton skeleton--card" v-for="n in 2" :key="n" />
      </div>
      <div class="skeleton skeleton--panel" />
    </div>

    <div v-else class="appointment-page-inner">
      <div class="header-row fade-in" style="--delay: 0ms">
        <h1 class="page-title">Plan your next donation!</h1>
        <p class="page-subtitle">Schedule your next blood donation by choosing your preferred date, time, and donation center.</p>
      </div>

      <!-- Your upcoming appointment -->
      <div v-if="appointmentsLoading || appointmentsError || activeAppointments.length"
        class="step-section fade-in" style="--delay: 20ms">
        <h2 class="step-label">Your upcoming appointment</h2>

        <div v-if="appointmentsLoading" class="drive-state">
          <div class="spinner" />
          <p>Loading your appointments...</p>
        </div>

        <div v-else-if="appointmentsError" class="drive-state">
          <p>{{ appointmentsError }}</p>
        </div>

        <div v-else class="my-appointment-list">
          <div v-for="appointment in activeAppointments" :key="appointment.id" class="panel my-appointment-card">
            <div class="my-appointment-card__top">
              <div>
                <p class="my-appointment-card__name">
                  {{ appointment.drive_name || appointment.facility_name || 'Blood center' }}
                </p>
                <p class="my-appointment-card__meta">
                  {{ formatDate(appointment.date) }} · {{ appointment.time }} ·
                  {{ appointment.appointment_type === 'mobile' ? 'Mobile drive' : 'Walk-in' }}
                </p>
              </div>
              <span class="badge" :class="appointmentStatusClass(appointment.status)">{{ appointment.status }}</span>
            </div>
            <p class="my-appointment-card__note">
              {{ appointment.can_cancel
                ? 'You can still cancel or reschedule this appointment.'
                : 'The 24-hour window for changing this appointment has passed.' }}
            </p>

            <div v-if="appointment.can_cancel" class="my-appointment-card__actions">
              <button type="button" class="btn-outline" :disabled="appointmentActionId === appointment.id"
                @click="startReschedule(appointment)">
                Reschedule
              </button>
              <button type="button" class="my-appointment-card__cancel"
                :disabled="appointmentActionId === appointment.id" @click="handleCancel(appointment)">
                {{ appointmentActionId === appointment.id ? 'Cancelling...' : 'Cancel appointment' }}
              </button>
            </div>
          </div>
        </div>
          <p v-if="appointmentActionError" class="my-appointment-error">{{ appointmentActionError }}</p>
      </div>

      <!-- Reschedule mode: ang wizard sa ubos mao gihapon ang gamiton, PATCH ra
           imbes POST ang i-send sa Confirm. -->
      <div v-if="reschedulingId" class="reschedule-banner fade-in">
        <p class="reschedule-banner__text">
          Pick a new slot below, then confirm to move your appointment.
        </p>
        <button type="button" class="btn-outline" @click="cancelReschedule">Keep current</button>
      </div>

      <!-- Step indicator -->
      <div class="step-indicator fade-in" style="--delay: 40ms">
        <div class="step-indicator__item" :class="{ 'step-indicator__item--active': activeStepNum >= 1 }">
          <span class="step-indicator__circle" :class="{ 'step-indicator__circle--filled': activeStepNum >= 1 }">1</span>
          <span class="step-indicator__label">Type</span>
        </div>
        <div class="step-indicator__line" :class="{ 'step-indicator__line--active': activeStepNum >= 2 }" />
        <div class="step-indicator__item" :class="{ 'step-indicator__item--active': activeStepNum >= 2 }">
          <span class="step-indicator__circle" :class="{ 'step-indicator__circle--filled': activeStepNum >= 2 }">2</span>
          <span class="step-indicator__label">{{ appointmentType === 'walkin' ? 'Center' : 'Drive' }}</span>
        </div>
        <template v-if="appointmentType === 'walkin'">
          <div class="step-indicator__line" :class="{ 'step-indicator__line--active': activeStepNum >= 3 }" />
          <div class="step-indicator__item" :class="{ 'step-indicator__item--active': activeStepNum >= 3 }">
            <span class="step-indicator__circle" :class="{ 'step-indicator__circle--filled': activeStepNum >= 3 }">3</span>
            <span class="step-indicator__label">Date &amp; Time</span>
          </div>
        </template>
      </div>

      <!-- Step 1: Select type -->
      <div class="step-section fade-in" style="--delay: 80ms">
        <h2 class="step-label">
          <span class="step-label__num">1</span>
          Select type
        </h2>
        <div class="type-grid">
          <button type="button" class="type-card" :class="{ 'type-card--active': appointmentType === 'walkin' }"
            @click="selectType('walkin')">
            <span class="type-card__icon">
              <AssetIcon name="calendar" :size="18" />
            </span>

            <span class="type-card__body">
              <span class="type-card__title">Walk-in at blood center</span>
              <span class="type-card__desc">Book a time slot at a blood center</span>
            </span>
            <span class="radio" :class="{ 'radio--active': appointmentType === 'walkin' }" />
          </button>

          <button type="button" class="type-card" :class="{ 'type-card--active': appointmentType === 'mobile' }"
            @click="selectType('mobile')">
            <span class="type-card__icon">
              <AssetIcon name="truck" :size="18" />
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
      <div v-if="appointmentType === 'walkin'" class="step-section fade-in" style="--delay: 120ms">
        <h2 class="step-label">
          <span class="step-label__num">2</span>
          Choose blood center
        </h2>
        <div v-if="centersLoading" class="drive-state">
          <div class="spinner" />
          <p>Loading blood centers...</p>
        </div>

        <div v-else-if="centersError" class="drive-state">
          <p>{{ centersError }}</p>
        </div>

        <div v-else-if="bloodCenters.length" class="center-grid">
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

        <div v-else class="drive-state">
          <p>No blood centers available</p>
          <p class="drive-state__sub">No centers are accepting donations right now. Please check back later.</p>
        </div>
      </div>

      <!-- Step 2 (mobile): choose blood drive -->
      <div v-else-if="appointmentType === 'mobile'" class="step-section fade-in" style="--delay: 120ms">
        <h2 class="step-label">
          <span class="step-label__num">2</span>
          Choose blood drive
        </h2>

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
                <p class="drive-card__meta">{{ formatDate(drive.date) }} · {{ drive.location }}</p>
              </div>
              <span class="badge" :class="driveStatusClass(drive)">{{ drive.status }}</span>
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
      <div v-if="appointmentType === 'walkin'" class="step-section fade-in" style="--delay: 160ms">
        <h2 class="step-label">
          <span class="step-label__num">3</span>
          Select date &amp; time slot
        </h2>
        <div class="panel">
          <div class="form-body">
            <label class="form-label">Date</label>
            <input v-model="selectedDate" :min="todayValue" type="date" class="form-input form-input--lg">

            <p class="slots-heading">Available time slots: {{ formattedSelectedDate }}</p>

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
              <p class="drive-state__sub">This blood center hasn't opened slots for {{ formattedSelectedDate }} yet â€” try another date.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="continue-row fade-in" style="--delay: 200ms">
        <button type="button" class="btn-primary" :disabled="!canContinue" @click="openSummary">
          Continue
          <AssetIcon name="arrow-right" :size="15" />
        </button>
      </div>
    </div>

    <!-- Booking summary modal -->
    <div v-if="showSummary" class="modal-overlay" @click.self="showSummary = false">
      <div class="modal-card">
        <h3 class="modal-title">{{ reschedulingId ? "Reschedule Summary" : "Booking Summary" }}</h3>
        <div class="summary-list">
          <div class="summary-row"><span>Type</span><span>{{ typeLabel }}</span></div>
          <div class="summary-row"><span>Location</span><span>{{ locationLabel }}</span></div>
          <div class="summary-row"><span>Date</span><span>{{ summaryDateLabel }}</span></div>
          <div v-if="appointmentType === 'walkin'" class="summary-row"><span>Time slot</span><span>{{ selectedTimeSlot
              }}</span></div>
        </div>
        <p v-if="confirmError" class="confirm-error">{{ confirmError }}</p>
        <button type="button" class="btn-primary btn-block" :disabled="confirming" @click="handleConfirm">
          <span>{{ confirming ? 'Confirming...' : (reschedulingId ? 'Reschedule Appointment' : 'Confirm Appointment') }}</span>
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
        <h3 class="modal-title modal-title--center">{{ wasRescheduled ? "Appointment Updated!" : "Appointment Confirmed!" }}</h3>
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
import { bookingCatalogService } from '~/api/booking-catalog/BookingCatalogService'
import { donorService } from '~/api/donor/DonorService'


const router = useRouter()

// Page-level loading state â€” shows the skeleton on first mount while we
// fetch whatever's needed before the form is interactive.
const loading = ref(true)

const appointmentType = ref('walkin')
const selectedCenterId = ref(null)
const selectedDriveId = ref(null)
// Ang date input kailangan og YYYY-MM-DD base sa LOCAL na oras. Dili
// pwde ang toISOString() — UTC man to, so sa UTC+8 mag-off og isa ka
// adlaw kung sayo pa sa buntag.
function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const todayValue = toDateInputValue(new Date())
const selectedDate = ref(todayValue)

const selectedTimeSlot = ref(null)

const showSummary = ref(false)
const showConfirmation = ref(false)
const confirming = ref(false)
const confirmError = ref('')
const bookedAppointment = ref(null)
const reschedulingId = ref(null)
const wasRescheduled = ref(false)
const appointmentActionId = ref(null)
const appointmentActionError = ref('')

// Walay oras ang mobile drives sa database — date-only ang event_date. Pero
// required ang time_slot para sa duha ka type, so gamiton ni: mao ra gyud sad
// ang default sa server sa resolveSlot().
const MOBILE_DRIVE_TIME = '09:00'


function selectType(type) {
  appointmentType.value = type
  selectedTimeSlot.value = null
}

// Step indicator progress: 1 = type chosen, 2 = center/drive chosen, 3 = time slot chosen (walk-in only)
const activeStepNum = computed(() => {
  if (appointmentType.value === 'walkin') {
    if (selectedTimeSlot.value) return 3
    if (selectedCenterId.value) return 2
    return 1
  }
  if (selectedDriveId.value) return 2
  return 1
})

const bloodCenters = ref([])
const centersLoading = ref(false)
const centersError = ref('')

async function fetchBloodCenters() {
  centersLoading.value = true
  centersError.value = ''
  try {
    // GET /api/blood-centers
    // Response: [{ id, name, location, hours, status }]
    // Ang server mo-filter na sa accepting-donations nga centers, so ang
    // status kanunay "Open today".
    const data = await bookingCatalogService.bloodCenters()
    bloodCenters.value = data ?? []
  } catch (err) {
    console.error('Failed to load blood centers:', err)
    centersError.value = 'Could not load blood centers. Please try again.'
    bloodCenters.value = []
  } finally {
    centersLoading.value = false
  }
}


// Backend contract: GET /api/time-slots?center_id=&date=
// The blood center configures its own slot schedule and capacity per day
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
    // GET /api/time-slots?center_id=&date=
    // Response: [{ time, available, total }]. Ang `available` kay slot_capacity
    // sa center minus ang na-book na; ang mga past nga oras kay 0 dayon, ang
    // server na ang mo-compute — dili ni angay sundogon sa client.
    const data = await bookingCatalogService.timeSlots({
      center_id: selectedCenterId.value,
      date: selectedDate.value,
    })
    timeSlots.value = data ?? []
  } catch (err) {
    console.error('Failed to load time slots:', err)
    slotsError.value = err?.message || 'Could not load time slots. Please try again.'
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

// Gi-keepalive ni nga page, so dili ma-unmount ang component kung mo-navigate
// ang donor palayo — mabuhi ang state ug ang gi-fill na nga form. Ang bayad
// ana kay mahimong stale ang data, maong mo-refresh ta sa background matag
// balik: walay skeleton, kay naa na may sulod nga makita.
//
// Mo-fire sad ang onActivated dayon human sa unang onMounted, maong gi-guard
// ni sa loadedOnce aron dili doble ang unang fetch.
let loadedOnce = false

async function load({ silent = false } = {}) {
  if (!silent) loading.value = true
  try {
    await Promise.all([fetchBloodCenters(), fetchAppointments()])
    if (appointmentType.value === 'walkin') await fetchTimeSlots()
    loadedOnce = true
  } finally {
    loading.value = false
  }
}

onMounted(() => load())
onActivated(() => {
  if (loadedOnce) load({ silent: true })
})


// Ang mo-return ra kay ang mga drive nga gi-post gyud sa blood center, ug
// upcoming pa (event_date >= today), na-order by date.
// Response: [{ id, name, location, date, registered, total_slots, status }]
// status: 'Full' | 'Open' | 'Upcoming' — capitalized, ug walay 'closed'.
// Walay `time` field: ang event_date kay date-only sa database.
const bloodDrives = ref([])
const drivesLoading = ref(false)
const drivesError = ref('')

async function fetchBloodDrives() {
  drivesLoading.value = true
  drivesError.value = ''
  try {
    // GET /api/blood-drives
    // Ang `registered` kay live count sa active nga appointments.
    const data = await bookingCatalogService.bloodDrives()
    bloodDrives.value = data ?? []
  } catch (err) {
    console.error('Failed to load blood drives:', err)
    drivesError.value = err?.message || 'Could not load blood drives. Please try again.'
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

// Ang server na ang mo-compute sa status ('Full' | 'Open' | 'Upcoming'), so
// mapping ra ni sa CSS class. Ang pag-recompute diri kay mao gyud ang hinungdan
// nga nag-drift ang duha ka logic — capitalized diay ang gipadala sa server.
const DRIVE_STATUS_CLASS = {
  Full: 'badge--full',
  Upcoming: 'badge--info',
  Open: 'badge--success',
}

const DRIVE_PROGRESS_CLASS = {
  Full: 'progress-fill--full',
  Upcoming: 'progress-fill--blue',
  Open: 'progress-fill--green',
}

function driveStatusClass(drive) {
  return DRIVE_STATUS_CLASS[drive.status] || 'badge--info'
}

function driveProgressClass(drive) {
  return DRIVE_PROGRESS_CLASS[drive.status] || 'progress-fill--blue'
}

// Fetch drives as soon as the donor switches to the "mobile drive" flow,
let drivesFetched = false
watch(appointmentType, (type) => {
  if (type === 'mobile' && !drivesFetched) {
    drivesFetched = true
    fetchBloodDrives()
  }
})

function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const myAppointments = ref([])
const appointmentsLoading = ref(false)
const appointmentsError = ref('')

const ACTIVE_APPOINTMENT_STATUSES = ['scheduled', 'confirmed']

const APPOINTMENT_STATUS_CLASS = {
  scheduled: 'badge--info',
  confirmed: 'badge--success',
}

function appointmentStatusClass(status) {
  return APPOINTMENT_STATUS_CLASS[status] || 'badge--info'
}

async function fetchAppointments() {
  appointmentsLoading.value = true
  appointmentsError.value = ''
  try {
    // GET /api/donors/appointments
    // Response: [{ id, appointment_datetime, date, time, status, appointment_type,
    //              facility_name, drive_name, can_cancel }]
    // Tanan appointment ang mo-return — bisan cancelled ug completed — newest
    // first. Walay filter param, so client na ang mo-pili.
    const data = await donorService.appointments()
    myAppointments.value = data ?? []
  } catch (err) {
    console.error('Failed to load appointments:', err)
    appointmentsError.value = err?.message || 'Could not load your appointments. Please try again.'
    myAppointments.value = []
  } finally {
    appointmentsLoading.value = false
  }
}

// Booking page ni, so ang aktibo ug umaabot ra ang gipakita — ang past ug
// cancelled kay para sa history, dili diri. Soonest first, dili newest.
const activeAppointments = computed(() =>
  myAppointments.value
    .filter(appointment =>
      ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)
      && new Date(appointment.appointment_datetime) >= new Date()
    )
    .sort((a, b) => new Date(a.appointment_datetime) - new Date(b.appointment_datetime))
)


const formattedSelectedDate = computed(() => formatDate(selectedDate.value))

const selectedDrive = computed(() => bloodDrives.value.find(d => d.id === selectedDriveId.value) || null)
const selectedCenter = computed(() => bloodCenters.value.find(c => c.id === selectedCenterId.value) || null)

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
  if (appointmentType.value === 'walkin') return selectedCenter.value?.name || '-'
  return selectedDrive.value?.name || '-'
})

const summaryDateLabel = computed(() => {
  if (appointmentType.value === 'walkin') return formattedSelectedDate.value
  return formatDate(selectedDrive.value?.date)
})

const confirmDateTimeLabel = computed(() => {
  if (appointmentType.value === 'walkin') return `${formattedSelectedDate.value} - ${selectedTimeSlot.value}`
  // Walay oras ang mobile drives — date ra ang naa sa event_date, so ang
  // dangling "- —" gikuha na.
  return formatDate(selectedDrive.value?.date)
})

// Ang gipakita sa confirmation modal kay gikan sa 201 response, dili sa local
// nga pinili — para sa mobile, ang server na ang mo-resolve sa oras.
const bookedLocationLabel = computed(() =>
  bookedAppointment.value?.drive_name
    || bookedAppointment.value?.facility_name
    || locationLabel.value
)

const bookedDateTimeLabel = computed(() => {
  const booked = bookedAppointment.value
  if (!booked) return confirmDateTimeLabel.value
  return `${formatDate(booked.date)} - ${booked.time}`
})


function bookingErrorMessage(err) {
  const code = err?.data?.code

  switch (code) {
    case 'email_unverified':
      return 'Please verify your email address before booking an appointment.'
    case 'screening_expired':
      return 'Your eligibility screening has expired. Please complete a new screening first.'
    case 'screening_required':
      return err?.message || 'Please complete an eligibility screening before booking.'
    case 'below_min_interval':
      return err?.data?.next_eligible_date
        ? `You cannot donate again until ${formatDate(err.data.next_eligible_date)}.`
        : err?.message
    case 'duplicate_appointment':
      return 'You already have an upcoming appointment. Cancel or reschedule it first.'
    case 'slot_unavailable':
      return 'That time slot has just been taken. Please choose another.'
    case 'drive_full':
      return 'This blood drive is fully booked. Please choose another.'
    case 'appointment_not_active':
      return 'This appointment can no longer be changed.'
    case 'cancellation_window_passed':
      return err?.message || 'This appointment is too close to its start time to change.'
    default:
      return err?.message || 'Could not confirm your appointment. Please try again.'
  }
}

async function handleConfirm() {
  confirming.value = true
  confirmError.value = ''

  try {
    // POST /api/donors/appointments
    // Body: { type, center_id?, drive_id?, date?, time_slot }
    // Response 201: { id, appointment_datetime, date, time, status,
    //                 appointment_type, facility_name, drive_name, can_cancel }
    const payload = {
      type: appointmentType.value,
      time_slot: appointmentType.value === 'walkin' ? selectedTimeSlot.value : MOBILE_DRIVE_TIME,
    }

    if (appointmentType.value === 'walkin') {
      payload.center_id = selectedCenterId.value
      payload.date = selectedDate.value
    } else {
      payload.drive_id = selectedDriveId.value
    }

    // Parehas ra ang payload sa book ug sa reschedule — parehas sila og
    // StoreAppointmentRequest sa server.
    bookedAppointment.value = reschedulingId.value
      ? await donorService.rescheduleAppointment(reschedulingId.value, payload)
      : await donorService.bookAppointment(payload)

    // I-refresh aron makita dayon ang bag-ong appointment sa listahan sa luyo.
    await fetchAppointments()

    // Sulod ra sa success path — dili na sama sa una nga mo-show ang confirmation
    // bisan na-reject ang booking.
    wasRescheduled.value = reschedulingId.value !== null
    reschedulingId.value = null
    showSummary.value = false
    showConfirmation.value = true

  } catch (err) {
    console.error('Failed to confirm appointment:', err)
    confirmError.value = bookingErrorMessage(err)
  } finally {
    confirming.value = false
  }
}

function openSummary() {
  confirmError.value = ''
  showSummary.value = true
}

function startReschedule(appointment) {
  appointmentActionError.value = ''
  reschedulingId.value = appointment.id

  // I-preset ang wizard sa type sa existing nga appointment aron dili magsugod
  // ang donor og blangko.
  appointmentType.value = appointment.appointment_type === 'mobile' ? 'mobile' : 'walkin'
  selectedTimeSlot.value = null

  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function cancelReschedule() {
  reschedulingId.value = null
  confirmError.value = ''
}

async function handleCancel(appointment) {
  const confirmed = window.confirm(
    'Cancel this appointment? You will need to book again if you change your mind.'
  )
  if (!confirmed) return

  appointmentActionId.value = appointment.id
  appointmentActionError.value = ''

  try {
    // DELETE /api/donors/appointments/{id}
    // Dili ni mo-delete sa row — mo-set ra og status = 'cancelled', ug mo-return
    // sa updated nga appointment.
    await donorService.cancelAppointment(appointment.id)

    // Kung gi-reschedule pa diay ni, i-undo ang mode.
    if (reschedulingId.value === appointment.id) {
      reschedulingId.value = null
    }

    await fetchAppointments()
  } catch (err) {
    console.error('Failed to cancel appointment:', err)
    appointmentActionError.value = bookingErrorMessage(err)
  } finally {
    appointmentActionId.value = null
  }
}

function viewQr() {
  router.push('/donor/qrcode')
}

function goDashboard() {
  router.push('/donor/dashboard')
}
</script>

<style scoped>
.appointment-page {
  --primary: #1565c0;
  --primary-dark: #0d47a1;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --text-primary: #1f2937;
  --text-secondary: #9ca3af;
  --border: #eef0f3;
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px 32px 60px;
  background: #F5F7FA;
  transition: background-color 0.2s ease;
}

.confirm-error {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fbeaea;
  border: 1px solid #f5cccc;
  font-size: 12.5px;
  line-height: 1.5;
  color: #d32f2f;
}

.my-appointment-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.my-appointment-card {
  padding: 16px;
}

.my-appointment-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.my-appointment-card__name {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.my-appointment-card__meta {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.my-appointment-card__note {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.my-appointment-card__actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.my-appointment-card__cancel {
  padding: 9px 16px;
  border-radius: 8px;
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.my-appointment-card__cancel:hover:not(:disabled) {
  background: rgba(211, 47, 47, 0.08);
}

.my-appointment-card__cancel:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.my-appointment-error {
  margin: 12px 0 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--accent);
}

.reschedule-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #eaf3fc;
  border: 1px solid #d3e6fa;
}

.reschedule-banner__text {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: #1f4e79;
}

.appointment-page-inner {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.header-row {
  display: flex;
  flex-direction: column;
}

.page-title {
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  margin: 0;
}

.page-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 3px 0 0;
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

@media (prefers-reduced-motion: reduce) {
  .fade-in, .skeleton { animation: none !important; }
}

/* Skeleton loading */
.skeleton {
  background: linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}

.skeleton--header { height: 52px; max-width: 340px; }
.skeleton--steps { height: 40px; max-width: 420px; }
.skeleton--grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.skeleton--card { height: 84px; border-radius: 12px; }
.skeleton--panel { height: 220px; border-radius: 14px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

/* Step indicator */
.step-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-indicator__item {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.55;
  transition: opacity 0.2s ease;
}

.step-indicator__item--active {
  opacity: 1;
}

.step-indicator__circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: #e5e7eb;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  transition: background 0.2s ease, color 0.2s ease;
}

.step-indicator__circle--filled {
  background: var(--primary);
  color: white;
}

.step-indicator__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.step-indicator__line {
  flex: 1;
  max-width: 48px;
  height: 2px;
  background: #e5e7eb;
  transition: background 0.2s ease;
}

.step-indicator__line--active {
  background: var(--primary);
}

.step-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.step-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--text-primary);
  margin: 0;
}

.step-label__num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: #eaf3fc;
  color: var(--primary);
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
}

/* Type cards */
.type-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.type-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: white;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px 20px;
  cursor: pointer;
  text-align: left;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.type-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
  border-color: #d9e2ee;
}

.type-card--active {
  background: #eaf3fc;
  border-color: var(--primary);
}

.type-card--active:hover {
  box-shadow: 0 6px 16px rgba(21, 101, 192, 0.12);
}

.type-card__icon {
  width: 42px;
  height: 42px;
  border-radius: 11px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eaf3fc;
  color: var(--primary);
  transition: background 0.15s ease;
}

.type-card--active .type-card__icon {
  background: var(--primary);
  color: white;
}

.type-card__body {
  display: flex;
  flex-direction: column;
  gap: 3px;
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
  line-height: 1.4;
}

.radio {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: 2px solid #d1d5db;
  flex-shrink: 0;
  position: relative;
  transition: border-color 0.15s ease;
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
  gap: 14px;
}

.center-card {
  display: flex;
  flex-direction: column;
  gap: 9px;
  text-align: left;
  background: white;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px 18px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.center-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
  border-color: #d9e2ee;
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
  line-height: 1.35;
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
  border: 1px solid var(--border);
  overflow: hidden;
}

.form-body {
  padding: 22px;
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
  border-radius: 9px;
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
  margin: 22px 0 12px;
}

.slots-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
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

.slot-btn:hover:not(:disabled):not(.slot-btn--active) {
  border-color: #b9d3ef;
  background: #f7fafd;
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
  font-size: 11px;
  color: var(--text-secondary);
}

/* Drive cards */
.drive-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.drive-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
  background: white;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px 20px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.drive-card:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
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
  transition: width 0.3s ease;
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
  border: 1px solid var(--border);
  border-radius: 14px;
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
  position: sticky;
  bottom: 16px;
  z-index: 5;
}

/* Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 13px 26px;
  border-radius: 11px;
  font-size: 13.5px;
  font-weight: 700;
  color: white;
  background: var(--primary);
  box-shadow: 0 4px 14px rgba(21, 101, 192, 0.25);
  border: none;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.94;
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(21, 101, 192, 0.3);
}

.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-block {
  width: 100%;
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 11px;
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
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}

.modal-card {
  background: white;
  border-radius: 18px;
  padding: 26px;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.2);
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

  .step-indicator__label {
    display: none;
  }
}

/* ============ Dark mode ============ */
:global(.dark .appointment-page) {
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --border: #334155;
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

:global(.dark .confirm-error) {
  background: rgba(239, 83, 80, 0.14);
  border-color: rgba(239, 83, 80, 0.3);
  color: #EF9A9A;
}

:global(.dark .type-card--active),
:global(.dark .center-card--active),
:global(.dark .drive-card--active),
:global(.dark .slot-btn--active) {
  background: rgba(66,165,245,0.14);
}

:global(.dark .type-card__icon) { background: rgba(66,165,245,0.16); }
:global(.dark .type-card--active .type-card__icon) { background: var(--primary); }

:global(.dark .step-label__num) { background: rgba(66,165,245,0.16); }

:global(.dark .step-indicator__circle) { background: #263449; color: #94a3b8; }
:global(.dark .step-indicator__line) { background: #263449; }

:global(.dark .form-input) {
  background: #0F172A;
  border-color: #334155;
  color: #F1F5F9;
}

:global(.dark .slot-btn--full) { background: #263449; }
:global(.dark .slot-btn:hover:not(:disabled):not(.slot-btn--active)) { background: #263449; border-color: #3f5878; }

:global(.dark .badge--success) { background: rgba(102,187,106,0.16); }
:global(.dark .badge--info) { background: rgba(66,165,245,0.16); color: #90CAF9; }
:global(.dark .badge--full) { background: #263449; }

:global(.dark .reschedule-banner) {
  background: rgba(66, 165, 245, 0.14);
  border-color: rgba(66, 165, 245, 0.3);
}

:global(.dark .reschedule-banner__text) { color: #90CAF9; }

:global(.dark .my-appointment-card__cancel:hover:not(:disabled)) {
  background: rgba(239, 83, 80, 0.16);
}

:global(.dark .progress-track) { background: #334155; }
:global(.dark .progress-fill--full) { background: #475569; }

:global(.dark .btn-outline) {
  background: #263449;
  color: #E2E8F0;
}
:global(.dark .btn-outline:hover) { background: #334155; }

:global(.dark .summary-row) { border-color: #263449; }

:global(.dark .skeleton) {
  background: linear-gradient(90deg, #1E293B 25%, #263449 37%, #1E293B 63%);
}
</style>
