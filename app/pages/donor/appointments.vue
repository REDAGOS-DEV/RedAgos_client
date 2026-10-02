<template>
  <div class="appointment-page">
    <!-- Skeleton loading state -->
    <div v-if="loading" class="appointment-page-inner">
      <div class="skeleton skeleton--header" />
      <div class="skeleton skeleton--grid">
        <div class="skeleton skeleton--card" v-for="n in 2" :key="n" />
      </div>
      <div class="skeleton skeleton--panel" />
    </div>

    <div v-else class="appointment-page-inner">
      <div class="header-row">
        <h1 class="page-title">Book a donation</h1>
        <p class="page-subtitle">Pick a blood center and time, or join a mobile blood drive.</p>
      </div>

      <!--
        Ang server mo-reject sa slot nga una sa next eligible date
        (below_min_interval). Gipakita na daan imbes mahibal-an ra inig Confirm.
      -->
      <div v-if="showBookingWizard && eligibleLater" class="eligible-banner" role="status">
        <AssetIcon name="calendar" :size="16" class="eligible-banner__icon" />
        <p class="eligible-banner__text">
          You can donate again from <strong>{{ formatDate(nextEligibleDate) }}</strong>.
          Earlier dates are not available to book.
        </p>
      </div>

      <!-- Your upcoming appointment -->
      <div v-if="appointmentsLoading || appointmentsError || activeAppointments.length"
        class="step-section">
        <h2 class="step-label">Your upcoming appointment</h2>

        <div v-if="appointmentsLoading" class="drive-state">
          <div class="spinner" />
          <p>Loading your appointments...</p>
        </div>

        <div v-else-if="appointmentsError" class="drive-state">
          <p>{{ appointmentsError }}</p>
        </div>

        <div v-else class="my-appointment-list">
          <div v-for="appointment in activeAppointments" :key="appointment.id" class="panel my-appointment-card"
            :class="{ 'my-appointment-card--rescheduling': reschedulingId === appointment.id }">
            <p v-if="reschedulingId === appointment.id" class="my-appointment-card__flag">
              Rescheduling this appointment
            </p>
            <div class="my-appointment-card__top">
              <div>
                <p class="my-appointment-card__name">
                  {{ appointment.drive_name || appointment.facility_name || 'Blood center' }}
                </p>
                <p class="my-appointment-card__meta">
                  {{ formatDate(appointment.date) }} · {{ formatTime(appointment.time) }} ·
                  {{ appointment.appointment_type === 'mobile' ? 'Mobile drive' : 'Walk-in' }}
                </p>
              </div>
              <span class="badge" :class="appointmentStatusClass(appointment.status)">
                {{ appointment.status_label || appointment.status }}
              </span>
            </div>
            <p class="my-appointment-card__note">
              {{ appointment.can_cancel
                ? 'You can cancel or reschedule this any time before it starts.'
                : 'This appointment can no longer be changed.' }}
            </p>

            <!--
              Booking no longer requires a health questionnaire, so this is the
              only thing on the donor's own screens that tells them one is due.
              Silent here means a donor arrives at the counter with nothing to
              scan.
            -->
            <div v-if="screeningNotice(appointment)" class="screening-notice"
              :class="`screening-notice--${screeningNotice(appointment).tone}`">
              <p class="screening-notice__text">{{ screeningNotice(appointment).text }}</p>
              <NuxtLink v-if="screeningNotice(appointment).cta" to="/donor/eligibility" class="screening-notice__link">
                {{ screeningNotice(appointment).cta }}
              </NuxtLink>
            </div>

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
          <!-- Ang Reschedule kay mogawas ra kung can_cancel (gikan sa server; naka-config ang window) -->
          <p v-if="!showBookingWizard" class="one-booking-note">
            <template v-if="activeAppointments.some(a => a.can_cancel)">
              You can have one upcoming appointment at a time. Use Reschedule if you need a different date or time.
            </template>
            <template v-else>
              You can have one upcoming appointment at a time. If you can no longer make it, please contact the
              blood center directly.
            </template>
          </p>
      </div>

      <!--
        Ang booking wizard. Gitago kung naa nay upcoming appointment (gawas kung
        nag-reschedule): ang server mo-reject sa ikaduha (duplicate_appointment),
        so ayaw na papunon sa donor ang tibuok form para ma-reject ra sa katapusan.
      -->
      <template v-if="showBookingWizard">
      <!-- Reschedule mode: ang wizard sa ubos mao gihapon ang gamiton, PATCH ra
           imbes POST ang i-send sa Confirm. -->
      <div v-if="reschedulingId" class="reschedule-banner">
        <p class="reschedule-banner__text">
          Pick a new slot below, then confirm to move your appointment.
        </p>
        <button type="button" class="btn-outline" @click="cancelReschedule">Keep current</button>
      </div>

      <!-- Step 1: Select type -->
      <div class="step-section">
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
      <div v-if="appointmentType === 'walkin'" class="step-section">
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
          </button>
        </div>

        <div v-else class="drive-state">
          <p>No blood centers available</p>
          <p class="drive-state__sub">No centers are accepting donations right now. Please check back later.</p>
        </div>
      </div>

      <!-- Step 2 (mobile): choose blood drive -->
      <div v-else-if="appointmentType === 'mobile'" class="step-section">
        <h2 class="step-label">
          <span class="step-label__num">2</span>
          Choose blood drive
        </h2>

        <div v-if="drivesLoading" class="drive-state">
          <div class="spinner" />
          <p>Loading blood drives...</p>
        </div>

        <div v-else-if="drivesError" class="drive-state">
          <p>{{ drivesError }}</p>
          <button type="button" class="btn-outline" @click="fetchBloodDrives">Try again</button>
        </div>

        <div v-else-if="bloodDrives.length" class="drive-list">
          <button v-for="drive in bloodDrives" :key="drive.id" type="button" class="drive-card"
            :class="{ 'drive-card--active': selectedDriveId === drive.id }"
            :disabled="driveSlotsLeft(drive) === 0 || driveTooEarly(drive)"
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
            <p v-if="driveTooEarly(drive)" class="drive-card__note">
              Before your next eligible date ({{ formatDate(nextEligibleDate) }})
            </p>
          </button>
        </div>

        <div v-else class="drive-state">
          <AssetIcon name="truck" :size="32" class="drive-state__icon" />
          <p>No blood drives posted yet.</p>
          <p class="drive-state__sub">Check back later once a blood center schedules one near you.</p>
        </div>
      </div>

      <!-- Step 3 (walk-in only): date & time slot -->
      <div v-if="appointmentType === 'walkin'" class="step-section">
        <h2 class="step-label">
          <span class="step-label__num">3</span>
          Select date &amp; time slot
        </h2>
        <div class="panel">
          <div class="form-body">
            <p class="form-label" id="date-chips-label">Date</p>
            <!-- Sunod 14 ka adlaw isip chips; ang "Other date" para sa mas layo -->
            <div class="date-chips" role="radiogroup" aria-labelledby="date-chips-label">
              <button
                v-for="chip in dateChips"
                :key="chip.value"
                type="button"
                role="radio"
                class="date-chip"
                :class="{ 'date-chip--active': selectedDate === chip.value }"
                :aria-checked="selectedDate === chip.value ? 'true' : 'false'"
                @click="selectedDate = chip.value"
              >
                <span class="date-chip__dow">{{ chip.weekday }}</span>
                <span class="date-chip__day">{{ chip.day }}</span>
                <span class="date-chip__month">{{ chip.month }}</span>
              </button>
            </div>
            <label class="date-other">
              <span>Other date</span>
              <input v-model="selectedDate" :min="minBookingDate" type="date" class="form-input date-other__input"
                :class="{ 'date-other__input--active': !selectedIsChip }">
            </label>

            <p class="slots-heading">Available times · {{ formattedSelectedDate }}</p>

            <div v-if="slotsLoading" class="drive-state">
              <div class="spinner" />
              <p>Loading time slots...</p>
            </div>

            <div v-else-if="slotsError" class="drive-state">
              <p>{{ slotsError }}</p>
            </div>

            <div v-else-if="timeSlots.length" class="slot-groups">
              <div v-for="group in slotGroups" :key="group.label" class="slot-group">
                <p v-if="slotGroups.length > 1" class="slot-group__label">{{ group.label }}</p>
                <div class="slots-grid">
                  <button v-for="slot in group.slots" :key="slot.time" type="button" class="slot-btn"
                    :class="{ 'slot-btn--active': selectedTimeSlot === slot.time, 'slot-btn--full': slot.available === 0 }"
                    :disabled="slot.available === 0" :aria-pressed="selectedTimeSlot === slot.time ? 'true' : 'false'"
                    @click="selectedTimeSlot = slot.time">
                    <span class="slot-btn__time">{{ formatTime(slot.time) }}</span>
                    <span class="slot-btn__avail">{{ slot.available === 0 ? 'Full' : `${slot.available} left` }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div v-else class="drive-state">
              <AssetIcon name="calendar" :size="32" class="drive-state__icon" />
              <p>No time slots set for this date.</p>
              <p class="drive-state__sub">This blood center hasn't opened slots for {{ formattedSelectedDate }} yet. Try another date.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Sticky: makita permi ang gipili ug ang Continue, bisan taas ang lista -->
      <div class="booking-bar">
        <p class="booking-bar__summary" aria-live="polite">
          <span v-if="selectionSummary" class="booking-bar__text">{{ selectionSummary }}</span>
          <span v-else class="booking-bar__hint">{{ selectionHint }}</span>
        </p>
        <button type="button" class="btn-primary booking-bar__btn" :disabled="!canContinue" @click="openSummary">
          Continue
          <AssetIcon name="arrow-right" :size="15" />
        </button>
      </div>
      </template>
    </div>

    <!-- Booking summary modal -->
    <div v-if="showSummary" class="modal-overlay" @click.self="closeSummary">
      <div class="modal-card modal-card--summary" role="dialog" aria-modal="true" aria-labelledby="summary-title"
        v-focus-trap @dialog-escape="closeSummary">
        <div class="summary-head">
          <div>
            <h3 id="summary-title" class="modal-title summary-head__title">
              {{ reschedulingId ? 'Review your new slot' : 'Review your booking' }}
            </h3>
            <p class="summary-head__sub">Check the details before you confirm.</p>
          </div>
          <button type="button" class="summary-close" aria-label="Close" :disabled="confirming" @click="closeSummary">
            <AssetIcon name="x" :size="18" />
          </button>
        </div>

        <dl class="summary-card">
          <div class="summary-item">
            <dt><AssetIcon :name="appointmentType === 'walkin' ? 'building-2' : 'truck'" :size="15" /> Location</dt>
            <dd>
              {{ locationLabel }}
              <span class="summary-item__sub">{{ typeLabel }}</span>
            </dd>
          </div>
          <div class="summary-item">
            <dt><AssetIcon name="calendar" :size="15" /> Date</dt>
            <dd>{{ summaryDateLabel }}</dd>
          </div>
          <div v-if="appointmentType === 'walkin'" class="summary-item">
            <dt><AssetIcon name="clock" :size="15" /> Time</dt>
            <dd>{{ formatTime(selectedTimeSlot) }}</dd>
          </div>
        </dl>

        <!--
          Ang error kay naay kaugalingong sunod nga lakang. Ang mga dili na
          molampos kung i-retry (duplicate, interval, ...) kay dili na
          magpakita og Confirm nga button.
        -->
        <div v-if="confirmError" class="confirm-error" role="alert">
          <AssetIcon name="circle-alert" :size="16" class="confirm-error__icon" />
          <span>{{ confirmError }}</span>
        </div>

        <div class="summary-actions">
          <template v-if="confirmErrorCode === 'duplicate_appointment'">
            <button type="button" class="btn-outline" @click="closeSummary">Close</button>
            <button type="button" class="btn-primary" @click="goToMyAppointment">View my appointment</button>
          </template>
          <template v-else-if="confirmErrorCode === 'slot_unavailable' || confirmErrorCode === 'drive_full'">
            <button type="button" class="btn-outline" @click="closeSummary">Close</button>
            <button type="button" class="btn-primary" @click="chooseAnother">
              {{ confirmErrorCode === 'drive_full' ? 'Choose another drive' : 'Choose another time' }}
            </button>
          </template>
          <template v-else-if="confirmBlocked">
            <button type="button" class="btn-primary" @click="closeSummary">Close</button>
          </template>
          <template v-else>
            <button type="button" class="btn-outline" :disabled="confirming" @click="closeSummary">Back</button>
            <button type="button" class="btn-primary" :disabled="confirming" @click="handleConfirm">
              <span>{{ confirming ? 'Confirming...' : (reschedulingId ? 'Confirm new slot' : 'Confirm booking') }}</span>
              <AssetIcon v-if="!confirming" name="arrow-right" :size="16" />
            </button>
          </template>
        </div>

        <p class="modal-note">You can cancel or reschedule any time before your appointment.</p>
      </div>
    </div>

    <!-- Cancel dialog (imbes window.confirm) -->
    <div v-if="cancelTarget" class="modal-overlay" @click.self="closeCancelDialog">
      <div class="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="cancel-title"
        aria-describedby="cancel-desc" v-focus-trap @dialog-escape="closeCancelDialog">
        <h3 id="cancel-title" class="modal-title">Cancel this appointment?</h3>
        <p id="cancel-desc" class="cancel-desc">
          {{ cancelTarget.drive_name || cancelTarget.facility_name || 'Blood center' }},
          {{ formatDate(cancelTarget.date) }} at {{ formatTime(cancelTarget.time) }}.
          You will need to book again if you change your mind.
        </p>
        <p v-if="appointmentActionError" class="confirm-error">{{ appointmentActionError }}</p>
        <div class="confirm-actions">
          <button type="button" class="btn-outline" :disabled="appointmentActionId !== null" @click="closeCancelDialog">
            Keep it
          </button>
          <button type="button" class="btn-danger" :disabled="appointmentActionId !== null" @click="confirmCancel">
            {{ appointmentActionId !== null ? 'Cancelling...' : 'Cancel appointment' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Confirmation modal -->
    <div v-if="showConfirmation" class="modal-overlay">
      <div class="modal-card modal-card--confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-title"
        v-focus-trap @dialog-escape="showConfirmation = false">
        <div class="confirm-icon">
          <AssetIcon name="check" :size="22" class="confirm-icon__svg" />
        </div>
        <h3 id="confirm-title" class="modal-title modal-title--center">{{ wasRescheduled ? "Appointment Updated!" : "Appointment Confirmed!" }}</h3>
        <p class="modal-sub">
          {{ wasRescheduled ? "Your appointment has been updated." : "Your appointment has been booked, and the details are on their way to your email." }}
          {{ bookedScreening.hint }}
        </p>
        <div class="summary-list">
          <div class="summary-row"><span>Location</span><span>{{ bookedLocationLabel }}</span></div>
          <div class="summary-row"><span>Date &amp; Time</span><span>{{ bookedDateTimeLabel }}</span></div>
          <div class="summary-row">
            <span>Health questionnaire</span>
            <span :class="`summary-value--${bookedScreening.tone}`">{{ bookedScreening.label }}</span>
          </div>
        </div>
        <div class="confirm-actions">
          <button v-if="bookedScreening.cta" type="button" class="btn-outline" @click="goEligibility">
            {{ bookedScreening.cta }}
          </button>
          <button v-else type="button" class="btn-outline" @click="viewQr">View QR Code</button>
          <button type="button" class="btn-primary" @click="goDashboard">Go to Dashboard</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true,
})

import AssetIcon from '~/components/common/AssetIcon.vue'
import { bookingCatalogService } from '~/api/booking-catalog/BookingCatalogService'
import { donorService } from '~/api/donor/DonorService'


const router = useRouter()

// Page-level loading state: shows the skeleton on first mount while we
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
// Ang `code` sa napakyas nga booking, para mapili ang sunod nga lakang sa modal.
const confirmErrorCode = ref('')
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
    await Promise.allSettled([fetchBloodCenters(), fetchAppointments(), fetchNextEligible()])
    if (appointmentType.value === 'walkin') {
      await fetchTimeSlots().catch(err => console.error(err))
    }
    loadedOnce = true
  } catch (err) {
    console.error('Unexpected error during load:', err)
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

// "13:30" (H:i gikan sa server) -> "1:30 PM". Display ra; ang payload kay H:i gihapon.
function formatTime(value) {
  if (!value) return '-'
  const [h, m] = String(value).split(':').map(Number)
  if (Number.isNaN(h)) return value
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m || 0).padStart(2, '0')} ${suffix}`
}

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

// Gikan sa GET /api/donors/eligibility. Ang server mo-reject sa slot nga una
// niini (below_min_interval), so gamiton ra sa client para dili na ipili.
const nextEligibleDate = ref(null)

async function fetchNextEligible() {
  try {
    const status = await donorService.eligibilityStatus()
    nextEligibleDate.value = status?.next_eligible_date ?? null
  } catch (err) {
    // Informational ra: kung mapakyas, ang server gihapon ang mo-guard.
    console.error('Failed to load eligibility status:', err)
  }
}

const eligibleLater = computed(() => !!nextEligibleDate.value && nextEligibleDate.value > todayValue)

const minBookingDate = computed(() => (eligibleLater.value ? nextEligibleDate.value : todayValue))

// Kung ang pinili nga petsa kay una sa min (e.g. bag-o lang na-load ang
// eligibility), i-abante ngadto sa min.
watch(minBookingDate, (min) => {
  if (selectedDate.value < min) selectedDate.value = min
})

function driveTooEarly(drive) {
  return eligibleLater.value && String(drive.date ?? '').slice(0, 10) < nextEligibleDate.value
}

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

// Sunod 14 ka adlaw gikan sa unang ma-book nga petsa. Local time, dili UTC.
const DATE_CHIP_COUNT = 14
const dateChips = computed(() => {
  const [y, m, d] = minBookingDate.value.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  return Array.from({ length: DATE_CHIP_COUNT }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const value = toDateInputValue(date)
    return {
      value,
      weekday: value === todayValue ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' }),
      day: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
    }
  })
})

const selectedIsChip = computed(() => dateChips.value.some(chip => chip.value === selectedDate.value))

// Morning (una sa 12:00) ug Afternoon. Ang `time` kay H:i gikan sa server.
const slotGroups = computed(() => {
  const morning = timeSlots.value.filter(slot => Number(String(slot.time).split(':')[0]) < 12)
  const afternoon = timeSlots.value.filter(slot => Number(String(slot.time).split(':')[0]) >= 12)
  return [
    { label: 'Morning', slots: morning },
    { label: 'Afternoon', slots: afternoon },
  ].filter(group => group.slots.length)
})

// Usa ra ka upcoming appointment matag donor (duplicate_appointment sa server).
// Kung na-load ang lista ug naa nay usa, ang wizard kay para ra sa reschedule.
// Kung napakyas ang pag-load, ipakita gihapon ang wizard: ang server gihapon
// ang mo-guard.
const showBookingWizard = computed(() =>
  reschedulingId.value !== null
  || !!appointmentsError.value
  || activeAppointments.value.length === 0
)

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

// Para sa sticky bar: unsa na ang napili, o unsa pa ang kulang.
const selectionSummary = computed(() => {
  if (appointmentType.value === 'walkin') {
    if (!selectedCenter.value) return ''
    const parts = [selectedCenter.value.name, formattedSelectedDate.value]
    if (selectedTimeSlot.value) parts.push(formatTime(selectedTimeSlot.value))
    return parts.join(' · ')
  }
  if (!selectedDrive.value) return ''
  return `${selectedDrive.value.name} · ${formatDate(selectedDrive.value.date)}`
})

const selectionHint = computed(() =>
  appointmentType.value === 'walkin' ? 'Choose a blood center, date and time.' : 'Choose a blood drive.'
)

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
  if (appointmentType.value === 'walkin') return `${formattedSelectedDate.value} - ${formatTime(selectedTimeSlot.value)}`
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
  return `${formatDate(booked.date)} - ${formatTime(booked.time)}`
})

// Ang tinuod nga kahimtang sa questionnaire para sa bag-ong booking, gikan sa
// 201 response. Kaniadto hardcoded og "QR code: Valid", bisan ang booking kay
// dili na manginahanglan og questionnaire, so ang bag-ong donor walay QR pa.
const bookedScreening = computed(() => {
  const booked = bookedAppointment.value
  switch (booked?.screening_status) {
    case 'answered':
      return { label: 'Done', tone: 'success', hint: 'Bring your QR code when you arrive.', cta: null }
    case 'due':
    case 'missed':
      return {
        label: 'Due now',
        tone: 'warning',
        hint: 'Answer your health questionnaire now so your visit starts with a scan.',
        cta: 'Answer questionnaire',
      }
    case 'not_due':
      return {
        label: `Opens ${formatDate(booked.screening_window_opens_on)}`,
        tone: 'muted',
        hint: "You'll answer a short health questionnaire the day before. We'll email you a reminder.",
        cta: null,
      }
    default:
      return { label: '-', tone: 'muted', hint: '', cta: null }
  }
})


/**
 * What to tell the donor about the questionnaire for one booking.
 *
 * Returns null when there is nothing to say -- an answered questionnaire needs
 * no banner, and neither does a booking that no longer holds its slot.
 */
function screeningNotice(appointment) {
  switch (appointment.screening_status) {
    case 'not_due':
      return {
        tone: 'info',
        text: `Your health questionnaire opens on ${formatDate(appointment.screening_window_opens_on)}, the day before this appointment. We'll email you a reminder.`,
        cta: null,
      }
    case 'due':
      return {
        tone: 'warn',
        text: 'Your health questionnaire is open. Complete it now so your visit starts with a scan rather than a form.',
        cta: 'Answer it now',
      }
    case 'missed':
      return {
        tone: 'warn',
        text: 'You have not completed your health questionnaire. You can still fill it in at the centre, but doing it now will be quicker.',
        cta: 'Answer it now',
      }
    default:
      // 'answered', or a booking that is no longer active.
      return null
  }
}

function bookingErrorMessage(err) {
  const code = err?.data?.code

  switch (code) {
    case 'email_unverified':
      return 'Please verify your email address before booking an appointment.'
    // No screening code here any more: booking does not require a
    // questionnaire. The donor answers it the day before, and
    // ScreeningWindowOpen reminds them when it falls due.
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

// Mga error nga dili molampos bisan i-retry ang parehas nga pinili.
const BLOCKING_BOOKING_CODES = ['duplicate_appointment', 'below_min_interval', 'appointment_not_active', 'email_unverified', 'cancellation_window_passed']
const confirmBlocked = computed(() => BLOCKING_BOOKING_CODES.includes(confirmErrorCode.value))

async function handleConfirm() {
  confirming.value = true
  confirmError.value = ''
  confirmErrorCode.value = ''

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
    confirmErrorCode.value = err?.data?.code || ''

    // Stale ang page (e.g. na-book sa laing tab): i-refresh ang lista aron
    // makita na ang appointment ug matago ang wizard.
    if (confirmErrorCode.value === 'duplicate_appointment') {
      fetchAppointments()
    }
  } finally {
    confirming.value = false
  }
}

function closeSummary() {
  if (confirming.value) return
  showSummary.value = false
}

function goToMyAppointment() {
  showSummary.value = false
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Nakuha na sa uban ang slot o napuno ang drive: kuhaa ang bag-ong lista ug
// papilia pag-usab.
function chooseAnother() {
  showSummary.value = false
  if (appointmentType.value === 'walkin') {
    selectedTimeSlot.value = null
    fetchTimeSlots()
  } else {
    selectedDriveId.value = null
    fetchBloodDrives()
  }
}

function openSummary() {
  confirmError.value = ''
  confirmErrorCode.value = ''
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

// Ang appointment nga gipangutana sa cancel dialog.
const cancelTarget = ref(null)

function handleCancel(appointment) {
  appointmentActionError.value = ''
  cancelTarget.value = appointment
}

function closeCancelDialog() {
  if (appointmentActionId.value !== null) return
  cancelTarget.value = null
}

async function confirmCancel() {
  const appointment = cancelTarget.value
  if (!appointment) return

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
    cancelTarget.value = null
  } catch (err) {
    console.error('Failed to cancel appointment:', err)
    appointmentActionError.value = bookingErrorMessage(err)
  } finally {
    appointmentActionId.value = null
  }
}

function goEligibility() {
  router.push('/donor/eligibility')
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
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 32px 60px;
  background: var(--rb-page-bg);
  transition: background-color 0.2s ease;
}

.confirm-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 0 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #FEF3F2;
  border: 1px solid #FECDCA;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  color: #7A271A;
}

.confirm-error__icon {
  flex: none;
  margin-top: 1px;
  color: #B42318;
}

/* Booking summary modal */
.modal-card.modal-card--summary {
  max-width: 440px;
  padding: 22px 22px 18px;
  gap: 0;
}

.summary-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.summary-head .summary-head__title {
  margin: 0;
}

.summary-head__sub {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.summary-close {
  display: inline-flex;
  flex: none;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  margin: -6px -8px 0 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.summary-close:hover:not(:disabled) {
  background: #f3f4f6;
  color: var(--text-primary);
}

.summary-close:focus-visible {
  outline: 2px solid var(--rb-primary, #1565C0);
  outline-offset: 2px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  margin: 0 0 16px;
  padding: 4px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #f8fafc;
}

.summary-item {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-item dt {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.summary-item dd {
  margin: 0;
  font-size: 13.5px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--text-primary);
  text-align: right;
}

.summary-item__sub {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.summary-actions {
  display: flex;
  gap: 10px;
}

.summary-actions .btn-outline,
.summary-actions .btn-primary {
  flex: 1;
  padding: 12px 14px;
  white-space: nowrap;
}

.summary-actions .btn-outline {
  flex: 0 0 auto;
  min-width: 96px;
}

.summary-actions .btn-primary:only-child {
  flex: 1;
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
  background: #EFF4FB;
  border: 1px solid #D6E4F5;
}

.reschedule-banner__text {
  margin: 0;
  font-size: 12.5px;
  font-weight: 400;
  line-height: 1.55;
  color: #475569;
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

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none !important; }
}

/* Skeleton loading */
.skeleton {
  background: linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}

.skeleton--header { height: 52px; max-width: 340px; }
.skeleton--grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.skeleton--card { height: 84px; border-radius: 12px; }
.skeleton--panel { height: 220px; border-radius: 14px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
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
  transition: border-color 0.15s ease, background 0.15s ease;
}

.type-card:hover {
  border-color: #d9e2ee;
}

.type-card--active {
  background: #eaf3fc;
  border-color: var(--primary);
}

.type-card__icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
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
  transition: border-color 0.15s ease, background 0.15s ease;
}

.center-card:hover {
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
  background: transparent;
  border-style: dashed;
  color: var(--text-secondary);
  cursor: not-allowed;
  opacity: 0.6;
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
  transition: border-color 0.15s ease, background 0.15s ease;
}

.drive-card:hover:not(:disabled) {
  border-color: #d9e2ee;
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

/* Sticky booking bar */
.booking-bar {
  position: sticky;
  bottom: 16px;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 12px 12px 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: white;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.10);
}

.booking-bar__summary {
  min-width: 0;
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
}

.booking-bar__text {
  display: block;
  overflow: hidden;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.booking-bar__hint {
  color: var(--text-secondary);
}

.booking-bar__btn {
  flex: none;
}

@media (max-width: 640px) {
  .booking-bar {
    bottom: 12px;
    padding: 10px 10px 10px 14px;
  }

  .booking-bar__btn {
    padding: 12px 18px;
  }
}

/* Date chips */
.date-chips {
  display: flex;
  gap: 8px;
  margin: 0 -22px;
  padding: 2px 22px 6px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
}

.date-chip {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  width: 64px;
  padding: 10px 0;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  scroll-snap-align: start;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.date-chip:hover:not(.date-chip--active) {
  border-color: #b9d3ef;
}

.date-chip--active {
  border-color: var(--primary);
  background: #eaf3fc;
}

.date-chip__dow,
.date-chip__month {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

.date-chip__day {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-primary);
}

.date-chip--active .date-chip__dow,
.date-chip--active .date-chip__month,
.date-chip--active .date-chip__day {
  color: var(--primary);
}

.date-chip:focus-visible {
  outline: 2px solid var(--rb-primary, #1565C0);
  outline-offset: 2px;
}

.date-other {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
}

.date-other__input {
  width: auto;
  padding: 7px 10px;
  font-size: 13px;
}

.date-other__input--active {
  border-color: var(--primary);
}

/* Time slot groups */
.slot-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.slot-group__label {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

/* Cancel dialog */
.cancel-desc {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.btn-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 11px 12px;
  border: none;
  border-radius: 10px;
  background: #c62828;
  color: white;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-danger:hover:not(:disabled) {
  background: #b71c1c;
}

.btn-danger:disabled,
.btn-outline:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-danger:focus-visible {
  outline: 2px solid #c62828;
  outline-offset: 2px;
}

.confirm-actions .btn-danger {
  flex: 1;
}

/* Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 13px 26px;
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
  opacity: 0.45;
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
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}

.modal-card {
  background: white;
  border-radius: 14px;
  padding: 26px;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.16);
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

.summary-row .summary-value--success { color: var(--success); }
.summary-row .summary-value--warning { color: #B45309; }
.summary-row .summary-value--muted { color: var(--text-secondary); }

/* Next eligible date banner */
.eligible-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #EFF4FB;
  border: 1px solid #D6E4F5;
}

.eligible-banner__icon {
  flex: none;
  margin-top: 1px;
  color: var(--primary);
}

.eligible-banner__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #334155;
}

.one-booking-note {
  margin: 4px 0 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.my-appointment-card--rescheduling {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(21, 101, 192, 0.12);
}

.my-appointment-card__flag {
  margin: 0 0 10px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--primary);
}

.drive-card__note {
  margin: -4px 0 0;
  font-size: 12px;
  font-weight: 600;
  color: #B45309;
}

.drive-state__icon {
  color: var(--text-secondary);
  opacity: 0.6;
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
/*
 * Tanan naka-anchor sa .appointment-page. `:global(…)` mogawas sa scope
 * system, so ang `:global(.dark .form-input)` kaniadto kay mo-match sa
 * .form-input sa TANANG page human ma-load ni nga stylesheet (mao ang hinungdan
 * sa ngitngit nga inputs sa profile). Ang mga modal diri kay sulod sa
 * .appointment-page (walay Teleport), so ok ra ang anchor.
 */
:global(.dark .appointment-page) {
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --border: #334155;
  background: #0F172A;
}

:global(.dark .appointment-page .type-card),
:global(.dark .appointment-page .center-card),
:global(.dark .appointment-page .drive-card),
:global(.dark .appointment-page .drive-state),
:global(.dark .appointment-page .panel),
:global(.dark .appointment-page .slot-btn),
:global(.dark .appointment-page .modal-card) {
  background: #1E293B;
  border-color: #334155;
}

:global(.dark .appointment-page .confirm-error) {
  background: rgba(240, 68, 56, 0.10);
  border-color: rgba(240, 68, 56, 0.28);
  color: #FECDCA;
}
:global(.dark .appointment-page .confirm-error__icon) { color: #F97066; }
:global(.dark .appointment-page .summary-card) {
  background: #172033;
  border-color: #334155;
}
:global(.dark .appointment-page .summary-item) { border-bottom-color: #334155; }
:global(.dark .appointment-page .summary-close:hover:not(:disabled)) { background: #263449; }

:global(.dark .appointment-page .type-card--active),
:global(.dark .appointment-page .center-card--active),
:global(.dark .appointment-page .drive-card--active),
:global(.dark .appointment-page .slot-btn--active) {
  background: rgba(66,165,245,0.14);
}

:global(.dark .appointment-page .type-card__icon) { background: rgba(66,165,245,0.16); }
:global(.dark .appointment-page .type-card--active .type-card__icon) { background: var(--primary); }

:global(.dark .appointment-page .step-label__num) { background: rgba(66,165,245,0.16); }


:global(.dark .appointment-page .form-input) {
  background: #0F172A;
  border-color: #334155;
  color: #F1F5F9;
}

:global(.dark .appointment-page .slot-btn--full) { background: #263449; }
:global(.dark .appointment-page .slot-btn:hover:not(:disabled):not(.slot-btn--active)) { background: #263449; border-color: #3f5878; }

:global(.dark .appointment-page .badge--success) { background: rgba(102,187,106,0.16); }
:global(.dark .appointment-page .badge--info) { background: rgba(66,165,245,0.16); color: #90CAF9; }
:global(.dark .appointment-page .badge--full) { background: #263449; }

:global(.dark .appointment-page .reschedule-banner) {
  background: rgba(66, 165, 245, 0.10);
  border-color: rgba(66, 165, 245, 0.24);
}

:global(.dark .appointment-page .reschedule-banner__text) { color: #CBD5E1; }

:global(.dark .appointment-page .my-appointment-card__cancel:hover:not(:disabled)) {
  background: rgba(239, 83, 80, 0.16);
}

:global(.dark .appointment-page .progress-track) { background: #334155; }
:global(.dark .appointment-page .progress-fill--full) { background: #475569; }

:global(.dark .appointment-page .btn-outline) {
  background: #263449;
  color: #E2E8F0;
}
:global(.dark .appointment-page .btn-outline:hover) { background: #334155; }

:global(.dark .appointment-page .summary-row) { border-color: #263449; }

/* background-image, not the `background` shorthand: the shorthand resets
   background-size to `auto`, which collapses the 400%-wide gradient to the
   element width and leaves the shimmer keyframes with zero travel. */
:global(.dark .appointment-page .skeleton) {
  background-image: linear-gradient(90deg, #1E293B 25%, #263449 37%, #1E293B 63%);
}

:global(.dark .appointment-page .booking-bar) {
  background: #1E293B;
  border-color: #334155;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
:global(.dark .appointment-page .date-chip) {
  background: #1E293B;
  border-color: #334155;
}
:global(.dark .appointment-page .date-chip:hover:not(.date-chip--active)) { border-color: #3f5878; }
:global(.dark .appointment-page .date-chip--active) {
  background: rgba(66, 165, 245, 0.14);
  border-color: #64B5F6;
}
:global(.dark .appointment-page .date-chip--active .date-chip__dow),
:global(.dark .appointment-page .date-chip--active .date-chip__month),
:global(.dark .appointment-page .date-chip--active .date-chip__day) { color: #90CAF9; }
:global(.dark .appointment-page .slot-btn--full) { background: transparent; }
:global(.dark .appointment-page .eligible-banner) {
  background: rgba(66, 165, 245, 0.10);
  border-color: rgba(66, 165, 245, 0.24);
}
:global(.dark .appointment-page .eligible-banner__icon),
:global(.dark .appointment-page .my-appointment-card__flag) { color: #64B5F6; }
:global(.dark .appointment-page .eligible-banner__text) { color: #CBD5E1; }
:global(.dark .appointment-page .my-appointment-card--rescheduling) {
  border-color: #64B5F6;
  box-shadow: 0 0 0 3px rgba(100, 181, 246, 0.18);
}
:global(.dark .appointment-page .drive-card__note),
:global(.dark .appointment-page .summary-row .summary-value--warning) { color: #FFB74D; }
:global(.dark .appointment-page .screening-notice--info) {
  background: rgba(66, 165, 245, 0.10);
  border-color: rgba(66, 165, 245, 0.24);
  color: #90CAF9;
}
:global(.dark .appointment-page .screening-notice--warn) {
  background: rgba(245, 158, 11, 0.10);
  border-color: rgba(245, 158, 11, 0.30);
  color: #FCD34D;
}

.btn-primary:focus-visible,
.btn-outline:focus-visible,
.slot-btn:focus-visible {
  outline: 2px solid var(--rb-primary, #1565C0);
  outline-offset: 2px;
}

/* --- Questionnaire notice on an appointment card --- */

.screening-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 12.5px;
  line-height: 1.5;
}

.screening-notice--info {
  background: #eff6ff;
  border-color: #dbeafe;
  color: #1e40af;
}

.screening-notice--warn {
  background: #fffbeb;
  border-color: #fde68a;
  color: #92400e;
}

.screening-notice__text { margin: 0; flex: 1 1 16rem; }

.screening-notice__link {
  flex: none;
  font-weight: 700;
  color: inherit;
  text-decoration: underline;
}

</style>
