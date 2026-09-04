<template>
  <div class="appointments-page">
    <div v-if="initialLoading" class="loading-wrap">
      <div class="spinner" />
    </div>

    <div v-else class="appointments-inner">
      <!-- Header -->
      <div class="header-row">
        <div>
          <h1 class="page-title">Donor Appointments</h1>
          <p class="page-subtitle">Manage walk-ins, booking slots, and blood drive registrations from one place.</p>
        </div>
        <div class="header-actions">
          <div class="date-filter-wrap">
            <input type="date" v-model="datePickerValue" class="date-filter" @change="onDateFilterChange" />
            <AssetIcon name="calendar" :size="16" class="form-input-icon__icon" />
          </div>
          <button v-if="!isToday" type="button" class="btn-clear-date" @click="resetToToday">
            <AssetIcon name="x" :size="12" />
            Today
          </button>
          <button type="button" class="btn-primary" @click="openManageSlots">
            <AssetIcon name="clock" :size="16" />
            Manage Time Slots
          </button>
          <NuxtLink to="/blood-center/notifications" class="bell-btn" aria-label="Open notifications">
            <AssetIcon name="bell" :size="16" />
          </NuxtLink>
        </div>
      </div>

      <!-- Error banner -->
      <div v-if="loadError" class="error-banner">
        {{ loadError }}
        <button type="button" class="btn-link" @click="loadAll">Retry</button>
      </div>

      <!-- Stat cards -->
      <div class="stats-row">
        <div class="stat-card stat-card--blue">
          <div class="stat-card__icon stat-card__icon--blue">
            <AssetIcon name="user-check" :size="18" />
          </div>
          <div class="stat-card__body">
            <p class="stat-card__label">Today's Walk-ins</p>
            <p class="stat-card__value" :class="{ skeleton: loadingStats }">{{ loadingStats ? '' :
              stats.todayWalkIns }}</p>
          </div>
        </div>
        <div class="stat-card stat-card--orange">
          <div class="stat-card__icon stat-card__icon--orange">
            <AssetIcon name="check-circle" :size="18" />
          </div>
          <div class="stat-card__body">
            <p class="stat-card__label">Confirmed Arrived</p>
            <p class="stat-card__value" :class="{ skeleton: loadingStats }">{{ loadingStats ? '' :
              stats.confirmedArrived }}</p>
          </div>
        </div>
        <div class="stat-card stat-card--green">
          <div class="stat-card__icon stat-card__icon--green">
            <AssetIcon name="droplets" :size="18" />
          </div>
          <div class="stat-card__body">
            <p class="stat-card__label">Donated Today</p>
            <p class="stat-card__value" :class="{ skeleton: loadingStats }">{{ loadingStats ? '' :
              stats.donatedToday }}</p>
          </div>
        </div>
        <div class="stat-card stat-card--red">
          <div class="stat-card__icon stat-card__icon--red">
            <AssetIcon name="user-x" :size="18" />
          </div>
          <div class="stat-card__body">
            <p class="stat-card__label">No-shows</p>
            <p class="stat-card__value" :class="{ skeleton: loadingStats }">{{ loadingStats ? '' :
              stats.noShows }}</p>
          </div>
        </div>
      </div>

      <!-- Main panel -->
      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Appointment Overview</h2>
        </div>
        <div class="tabs">
          <button type="button" class="tab" :class="{ 'tab--active': activeTab === 'walkin' }"
            @click="activeTab = 'walkin'">
            Walk-in Appointments ({{ walkInAppointments.length }})
          </button>
          <button type="button" class="tab" :class="{ 'tab--active': activeTab === 'drives' }"
            @click="activeTab = 'drives'">
            Blood Drive Registrations ({{ bloodDrives.length }})
          </button>
        </div>

        <!-- WALK-IN APPOINTMENTS TAB -->
        <section v-if="activeTab === 'walkin'" class="tab-content">
          <p class="section-label">Time slots &middot; {{ selectedDateLabel }}</p>

          <div class="time-slot-grid">
            <div v-if="loadingSlots" v-for="n in 4" :key="'sk-' + n"
              class="time-slot-card skeleton-block" />
            <button v-for="slot in timeSlots" v-else :key="slot.id" type="button" class="time-slot-card"
              :class="{ 'time-slot-card--full': (slotBookings[slot.time] || 0) >= slot.capacity, 'time-slot-card--selected': selectedSlotId === slot.id }"
              @click="selectedSlotId = slot.id">
              <span class="slot-time">{{ slot.time }}</span>
              <span class="slot-count"
                :class="{ 'slot-count--full': (slotBookings[slot.time] || 0) >= slot.capacity }">
                {{ slotBookings[slot.time] || 0 }}/{{ slot.capacity }}
                {{ (slotBookings[slot.time] || 0) >= slot.capacity ? 'Full' : 'booked' }}
              </span>
            </button>
            <p v-if="!loadingSlots && timeSlots.length === 0" class="empty-state empty-state--inline">
              This centre has no bookable time slots configured.
            </p>
          </div>

          <div class="filters-row">
            <select v-model="statusFilter" class="form-input filter-select">
              <option value="all">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="arrived">Arrived</option>
              <option value="donated">Donated</option>
              <option value="no-show">No-show</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select v-model="bloodTypeFilter" class="form-input filter-select">
              <option value="all">All Blood Types</option>
              <option v-for="bt in bloodTypes" :key="bt" :value="bt">{{ bt }}</option>
            </select>
          </div>

          <div class="appointment-list">
            <div v-if="loadingAppointments" v-for="n in 4" :key="'skap-' + n"
              class="appointment-card skeleton-block" />

            <p v-else-if="walkInAppointments.length === 0" class="empty-state">
              No appointments booked at this centre on {{ selectedDateLabel }}.
            </p>

            <p v-else-if="filteredAppointments.length === 0" class="empty-state">
              No appointments match the current filters.
            </p>

            <div v-else v-for="appt in filteredAppointments" :key="appt.id"
              class="appointment-card">
              <div class="appt-date-badge">
                <span class="appt-day">{{ appt.dateDay }}</span>
                <span class="appt-month">{{ appt.dateMonth }}</span>
              </div>

              <div class="appt-info">
                <div class="appt-name-row">
                  <span class="appt-name">{{ appt.donorName }}</span>
                  <span class="pill pill--blood">{{ appt.bloodType }}</span>
                </div>
                <p class="appt-meta">{{ appt.donorCode }} &middot; {{ appt.kind }} &middot; {{
                  appt.slotTime }} slot</p>
                <p v-if="appt.phone" class="appt-screening">{{ appt.phone }}</p>
              </div>

              <div class="appt-status-col">
                <span v-if="appt.arrivedBadge" class="pill pill--outline">Arrived</span>
                <span class="pill" :class="'pill--' + appt.status.toLowerCase()">{{ appt.status
                }}</span>
                <button type="button" class="view-link" @click="viewAppointment(appt)">View</button>
              </div>
            </div>
          </div>
        </section>

        <!-- BLOOD DRIVE REGISTRATIONS TAB -->
        <section v-else class="tab-content">
          <div class="drives-header">
            <!-- KEPT YANNIE'S VERSION – simplified path -->
            <NuxtLink to="/blood-center/drives" class="btn-outline-blue">
              Go to Mobile Drives
              <AssetIcon name="arrow-right" :size="14" />
            </NuxtLink>
          </div>

          <div v-if="loadingDrives" v-for="n in 2" :key="'skd-' + n" class="drive-card skeleton-block"
            style="height: 220px" />

          <p v-else-if="bloodDrives.length === 0" class="empty-state">No blood drive registrations found.</p>

          <div v-else v-for="drive in bloodDrives" :key="drive.id" class="drive-card">
            <div class="drive-card__top">
              <div>
                <p class="drive-card__title">{{ drive.name }}</p>
                <p class="drive-card__meta">{{ drive.dateLabel }}</p>
              </div>
              <span class="status-badge" :class="`status-badge--${drive.status.toLowerCase()}`">{{
                drive.status }}</span>
            </div>

            <p class="drive-progress-label">Registered donors</p>
            <div class="progress-track">
              <div class="progress-fill"
                :class="{ 'progress-fill--full': driveProgressPct(drive) >= 100 }"
                :style="{ width: driveProgressPct(drive) + '%' }" />
            </div>
            <div class="progress-meta">
              <span>{{ drive.registered }} registered</span>
              <span>{{ drive.capacity }} capacity</span>
            </div>

            <p v-if="drive.status === 'Open'" class="drive-note">Registration still open &mdash; donors can
              book via the portal.</p>

            <template v-if="drive.previewDonors.length">
              <p class="preview-label">Registered Donors (Preview)</p>
              <div class="donor-preview-list">
                <div v-for="(donor, di) in drive.previewDonors" :key="donor.id" class="donor-row">
                  <span class="donor-row__avatar" :style="{ background: avatarColor(di) }">{{
                    initials(donor.name) }}</span>
                  <div class="donor-row__info">
                    <p class="donor-row__name">{{ donor.name }}</p>
                    <p class="donor-row__meta">{{ donor.bloodType }} &middot; Registered {{
                      donor.registeredDate }} &middot; Screening: {{ donor.screeningStatus }}</p>
                  </div>
                  <span class="pill" :class="'pill--' + donor.status.toLowerCase()">{{ donor.status
                  }}</span>
                </div>
              </div>
            </template>

            <p v-if="!drive.previewDonors.length" class="drive-note">Per-drive donor lists need a
              backend endpoint that does not exist yet.</p>

            <div class="drive-card__actions">
              <button type="button" class="btn-outline" disabled
                title="Listing the donors on one drive needs a backend endpoint that does not exist yet."
                @click="openViewDonors(drive)">View all {{ drive.registered }} donors</button>
              <button type="button" class="btn-outline-blue" disabled
                title="Drive management has no backend yet."
                @click="openManageDrive(drive)">Manage Drive &amp; Attendance</button>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- MANAGE TIME SLOTS MODAL -->
    <Transition name="modal">
      <div v-if="showManageSlotsModal" class="modal-overlay" @click.self="closeManageSlots">
        <div class="modal-card">
          <div class="modal-card__header">
            <h2 class="modal-card__title">Manage Time Slots</h2>
            <button type="button" class="modal-card__close" @click="closeManageSlots">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <div class="modal-form">
            <p class="modal-subtitle">The slots donors choose from when booking via the portal.
              Read-only for now &mdash; capacity is configured on the facility record, and there is no
              endpoint yet to change it from here.</p>

            <div class="form-group">
              <label class="form-label">Date</label>
              <div class="form-input-icon">
                <input v-model="slotsForm.date" type="date" class="form-input"
                  @change="fetchSlotsForForm" />
                <AssetIcon name="calendar" :size="14" class="form-input-icon__icon" />
              </div>
            </div>

            <label class="form-label">Time slots &amp; capacity</label>

            <div v-if="loadingSlotForm" class="slots-form-grid">
              <div v-for="n in 6" :key="'skf-' + n" class="slot-input skeleton-block" />
            </div>
            <div v-else class="slots-form-grid">
              <div v-for="slot in slotsForm.slots" :key="slot.id" class="slot-input">
                <label class="form-label form-label--muted">{{ slot.time }} - max donors</label>
                <div class="stepper">
                  <input v-model.number="slot.capacity" type="number" min="0" disabled
                    class="form-input stepper__input" />
                </div>
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn-cancel" @click="closeManageSlots">Close</button>
            </div>
            <p v-if="saveSlotsError" class="modal-error">{{ saveSlotsError }}</p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- VIEW DONORS MODAL (Blood Drive) -->
    <Transition name="modal">
      <div v-if="showDonorsModal" class="modal-overlay" @click.self="closeViewDonors">
        <div class="modal-card modal-card--wide">
          <div class="modal-card__header">
            <h2 class="modal-card__title">{{ selectedDrive?.name }} &mdash; Registered Donors</h2>
            <button type="button" class="modal-card__close" @click="closeViewDonors">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <div class="modal-form">
            <div v-if="loadingDriveDonors" class="donor-list">
              <div v-for="n in 5" :key="'skdd-' + n" class="donor-row skeleton-block" />
            </div>
            <div v-else class="donor-list">
              <p v-if="driveDonors.length === 0" class="empty-state">Listing the donors registered to
                one drive needs a backend endpoint that does not exist yet.</p>
              <div v-for="(donor, di) in driveDonors" :key="donor.id" class="donor-row">
                <span class="donor-row__avatar" :style="{ background: avatarColor(di) }">{{
                  initials(donor.name)
                }}</span>
                <div class="donor-row__info">
                  <p class="donor-row__name">{{ donor.name }}</p>
                  <p class="donor-row__meta">{{ donor.bloodType }} &middot; Registered {{
                    donor.registeredDate
                  }} &middot; Screening: {{ donor.screeningStatus }}</p>
                </div>
                <span class="pill" :class="'pill--' + donor.status.toLowerCase()">{{ donor.status
                }}</span>
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn-cancel" @click="closeViewDonors">Close</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { bookingCatalogService } from '~/api/booking-catalog/BookingCatalogService'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'appointments.view',
})

/**
 * API SHAPE
 * -------------------------------------------------------------------------
 * Tinuod na nga mga ruta karon — dili na ang `/api/bloodcenter/*` nga wala
 * gyud gitutok sa server.
 *
 *  GET /api/blood-center/collection/queue?date=YYYY-MM-DD
 *    -> { date,
 *         appointments: [{ id, appointment_datetime, status, event_id,
 *                          donor: { uuid, donor_code, full_name, blood_type, phone } }],
 *         in_progress: [...] }
 *    Facility-scoped gikan sa token: ang staff makakita ra sa kaugalingon
 *    nilang center, so walay center_id nga i-pasa diri.
 *
 *  GET /api/time-slots?center_id=&date=YYYY-MM-DD
 *    -> [{ time, available, total }]
 *
 *  GET /api/blood-drives
 *    -> [{ id, name, location, date, registered, total_slots, status }]
 *
 * WALA PAY BACKEND: pag-save sa per-slot capacity, ug ang listahan sa mga
 * donor kada drive. Gi-disable ang maong mga control imbis mo-call og ruta
 * nga mo-404.
 * -------------------------------------------------------------------------
 */

const { user } = useUser()

// Ang /time-slots kay donor-facing, so kinahanglan gyud og center_id. Ang
// queue dili — gikuha na niya ang facility gikan sa token.
const facilityId = computed(() => user.value?.facility?.id ?? null)

// Lima ka status ang gi-store sa server. Ang counter naay kaugalingon nga
// pinulongan, so usa ra ka lugar ang mo-translate.
const STATUS_LABELS = {
  scheduled: 'Scheduled',
  confirmed: 'Arrived',
  completed: 'Donated',
  no_show: 'No-show',
  cancelled: 'Cancelled',
}

// Parehas sa `bookedCountsByTime()` sa server: ang scheduled ug confirmed ra
// ang mo-hawid og slot. Ang cancelled ug no_show mo-libre pagbalik sa lugar.
const HOLDS_A_SLOT = ['scheduled', 'confirmed']

function todayIso() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function slotKeyOf(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Ang queue mo-return og server field names; lahi ang gidahom sa template.
 * Usa ra ka lugar ang mo-tabok aron dili magkatag ang mapping.
 */
function mapAppointment(row) {
  const at = new Date(row.appointment_datetime)

  return {
    id: row.id,
    rawStatus: row.status,
    donorName: row.donor?.full_name || 'Unknown donor',
    donorCode: row.donor?.donor_code || '—',
    bloodType: row.donor?.blood_type || '—',
    phone: row.donor?.phone || '',
    kind: row.event_id === null ? 'Walk-in' : 'Mobile drive',
    slotKey: slotKeyOf(at),
    slotTime: at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    dateDay: at.getDate(),
    dateMonth: at.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    status: STATUS_LABELS[row.status] ?? row.status,
    arrivedBadge: row.status === 'confirmed',
  }
}

/**
 * Ang stats gikan ra sa parehas nga queue payload — walay separate nga
 * endpoint, ug wala man kinahanglana: naa na ang tanan nga row diri.
 */
function deriveStats(rows) {
  const count = (status) => rows.filter((r) => r.rawStatus === status).length

  return {
    todayWalkIns: rows.filter((r) => r.kind === 'Walk-in').length,
    confirmedArrived: count('confirmed'),
    donatedToday: count('completed'),
    noShows: count('no_show'),
  }
}

const initialLoading = ref(true)
const activeTab = ref('walkin')
const loadError = ref('')

const stats = reactive({ todayWalkIns: 0, confirmedArrived: 0, donatedToday: 0, noShows: 0 })
const loadingStats = ref(false)

const timeSlots = ref([])
const loadingSlots = ref(false)
const selectedSlotId = ref(null)

const statusFilter = ref('all')
const bloodTypeFilter = ref('all')
const bloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']

const walkInAppointments = ref([])
const loadingAppointments = ref(false)

const bloodDrives = ref([])
const loadingDrives = ref(false)

// Manage Time Slots modal
const showManageSlotsModal = ref(false)
const loadingSlotForm = ref(false)
const saveSlotsError = ref('')
const slotsForm = reactive({ date: '', slots: [] })

// View Donors modal (blood drive)
const showDonorsModal = ref(false)
const loadingDriveDonors = ref(false)
const selectedDrive = ref(null)
const driveDonors = ref([])

const AVATAR_COLORS = ['#1565C0', '#2E7D32', '#F57C00', '#D32F2F', '#6D4C41', '#5E35B1']

// Ang queue kay usa ka adlaw ra ang gi-serve niya, so wala nay 'all dates'
// diri — mo-default ta karong adlawa, sama sa server pag walay `date`.
const selectedDateFilter = ref(todayIso())

const isToday = computed(() => selectedDateFilter.value === todayIso())

const datePickerValue = computed({
  get: () => selectedDateFilter.value,
  set: (val) => {
    selectedDateFilter.value = val || todayIso()
  },
})

function resetToToday() {
  selectedDateFilter.value = todayIso()
  onDateFilterChange()
}

const selectedDateLabel = computed(() => {
  const d = new Date(selectedDateFilter.value)
  if (isNaN(d.getTime())) return selectedDateFilter.value
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})

/**
 * Pila ka booking kada oras. Gikuha sa queue imbis sa /time-slots kay ang
 * `available` didto mo-report og 0 sa mga oras nga milabay na — sakto na sa
 * donor nga mo-book, apan sa counter mo-basa unta nga "Full" ang usa ka slot
 * nga walay bisan usa ka tawo.
 */
const slotBookings = computed(() => {
  const counts = {}

  for (const appt of walkInAppointments.value) {
    if (!HOLDS_A_SLOT.includes(appt.rawStatus)) continue
    counts[appt.slotKey] = (counts[appt.slotKey] || 0) + 1
  }

  return counts
})

const filteredAppointments = computed(() => {
  return walkInAppointments.value.filter((appt) => {
    const statusOk = statusFilter.value === 'all' || appt.status.toLowerCase() === statusFilter.value
    const bloodOk = bloodTypeFilter.value === 'all' || appt.bloodType === bloodTypeFilter.value
    return statusOk && bloodOk
  })
})

function driveProgressPct(drive) {
  if (!drive.capacity) return 0
  return Math.min(100, Math.round((drive.registered / drive.capacity) * 100))
}

function initials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function avatarColor(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

/**
 * Usa ra ka call ang mo-hatag sa listahan ug sa stat cards. Ang stats gi-derive
 * gikan sa parehas nga rows aron dili gyud sila magkalahi ang gi-ihap.
 */
async function loadQueue() {
  loadingAppointments.value = true
  loadingStats.value = true

  try {
    const data = await bloodCenterService.collectionQueue({ date: selectedDateFilter.value })
    const rows = (data?.appointments ?? []).map(mapAppointment)

    walkInAppointments.value = rows
    Object.assign(stats, deriveStats(rows))
  } catch (err) {
    walkInAppointments.value = []
    Object.assign(stats, { todayWalkIns: 0, confirmedArrived: 0, donatedToday: 0, noShows: 0 })
    loadError.value = err?.message || 'Could not load the appointment queue.'
    console.error('Failed to load collection queue:', err)
  } finally {
    loadingAppointments.value = false
    loadingStats.value = false
  }
}

async function loadTimeSlots() {
  if (!facilityId.value) {
    timeSlots.value = []
    return
  }

  loadingSlots.value = true

  try {
    const rows = await bookingCatalogService.timeSlots({
      center_id: facilityId.value,
      date: selectedDateFilter.value,
    })

    // Ang `total` ra ang gikuha diri — ang `booked` gikan sa queue, tan-awa
    // ang komento sa `slotBookings`.
    timeSlots.value = (rows ?? []).map((slot) => ({
      id: slot.time,
      time: slot.time,
      capacity: slot.total,
    }))
  } catch (err) {
    timeSlots.value = []
    loadError.value = err?.message || 'Could not load time slots.'
    console.error('Failed to load time slots:', err)
  } finally {
    loadingSlots.value = false
  }
}

async function loadBloodDrives() {
  loadingDrives.value = true

  try {
    const rows = await bookingCatalogService.bloodDrives()

    bloodDrives.value = (rows ?? []).map((drive) => ({
      id: drive.id,
      name: drive.name,
      location: drive.location,
      dateLabel: [
        drive.date
          ? new Date(drive.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : null,
        drive.location,
      ].filter(Boolean).join(' · '),
      status: drive.status,
      registered: drive.registered,
      capacity: drive.total_slots,
      // Walay endpoint pa nga mo-list sa mga donor kada drive.
      previewDonors: [],
    }))
  } catch (err) {
    bloodDrives.value = []
    loadError.value = err?.message || 'Could not load blood drive registrations.'
    console.error('Failed to load blood drives:', err)
  } finally {
    loadingDrives.value = false
  }
}

async function loadAll() {
  loadError.value = ''
  await Promise.all([loadQueue(), loadTimeSlots(), loadBloodDrives()])
}

function onDateFilterChange() {
  selectedSlotId.value = null
  loadError.value = ''
  loadQueue()
  loadTimeSlots()
}

function viewAppointment(appt) {
  // Placeholder: walay donor detail route/modal pa. Ang buton mo-render nga
  // daw molihok apan wala gyuy mahitabo — ipakita ni sa dev aron dili malimtan,
  // hilom sa production.
  if (import.meta.dev) {
    console.warn('[Appointments] viewAppointment is not wired up yet', appt.id)
  }
}

async function openManageSlots() {
  showManageSlotsModal.value = true
  saveSlotsError.value = ''
  // Pre-fill with the currently selected date filter, when it's a real date
  // (the filter dropdown's values are already YYYY-MM-DD strings, matching
  // what <input type="date"> expects, so this binds correctly).
  slotsForm.date = selectedDateFilter.value
  await fetchSlotsForForm()
}

async function fetchSlotsForForm() {
  if (!facilityId.value || !slotsForm.date) {
    slotsForm.slots = []
    return
  }

  loadingSlotForm.value = true
  saveSlotsError.value = ''

  try {
    const rows = await bookingCatalogService.timeSlots({
      center_id: facilityId.value,
      date: slotsForm.date,
    })

    slotsForm.slots = (rows ?? []).map((slot) => ({
      id: slot.time,
      time: slot.time,
      capacity: slot.total,
    }))
  } catch (err) {
    slotsForm.slots = []
    saveSlotsError.value = err?.message || 'Could not load slots for this date.'
    console.error('Failed to load slots for the form:', err)
  } finally {
    loadingSlotForm.value = false
  }
}

function closeManageSlots() {
  showManageSlotsModal.value = false
}

// Ang per-drive nga listahan sa donor walay ruta sa server, so ang modal
// mo-abli nga blangko imbis mo-call og endpoint nga mo-404.
function openViewDonors(drive) {
  selectedDrive.value = drive
  showDonorsModal.value = true
  loadingDriveDonors.value = false
  driveDonors.value = []
}

function closeViewDonors() {
  showDonorsModal.value = false
  selectedDrive.value = null
  driveDonors.value = []
}

function openManageDrive(drive) {
  // Placeholder: tan-awa ang viewAppointment sa ibabaw.
  if (import.meta.dev) {
    console.warn('[Appointments] openManageDrive is not wired up yet', drive.id)
  }
}

onMounted(async () => {
  await loadAll()
  initialLoading.value = false
})
</script>

<style scoped>
.appointments-page {
  --primary: #1565c0;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --text-primary: #1f2937;
  --text-secondary: #9ca3af;
  max-width: 1200px;
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px 32px 40px;
  font-family: var(--rb-font-sans);
  color: var(--text-primary);
}

/* Loading */
.loading-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60vh;
}

.spinner {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 4px solid #e3ebf6;
  border-top-color: var(--primary);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  
  .spinner {
    animation: none !important;
  }
}

.appointments-inner {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* Header */
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.page-subtitle {
  font-size: 13.5px;
  color: var(--text-secondary);
  margin: 4px 0 0;
  line-height: 1.5;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.bell-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #eef0f3;
  color: var(--primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: background-color 0.15s ease;
}

.bell-btn:hover {
  background: #f9fafb;
}

.date-filter-wrap {
  position: relative;
  width: 150px;
}

.date-filter {
  width: 100%;
  height: 42px;
  padding: 0 42px 0 14px;
  appearance: none;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
}

.date-filter:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(21, 101, 192, 0.15);
}

.date-filter::-webkit-calendar-picker-indicator {
  opacity: 0;
  position: absolute;
  right: 0;
  top: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.btn-clear-date {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  background: #f3f4f6;
  color: #374151;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease;
}

.btn-clear-date:hover {
  background: #e5e7eb;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: var(--primary);
  border: none;
  cursor: pointer;
  transition: opacity 0.15s ease;
  white-space: nowrap;
}

.btn-primary:hover {
  opacity: 0.92;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-outline {
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  background: #f3f4f6;
  color: #374151;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s ease;
}

.btn-outline:hover {
  background: #e5e7eb;
}

.btn-outline-blue {
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  background: #e3f2fd;
  color: var(--primary);
  border: none;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: background 0.15s ease;
}

.btn-outline-blue:hover {
  background: #d3e6fa;
}

.btn-link {
  background: none;
  border: none;
  color: var(--primary);
  text-decoration: underline;
  cursor: pointer;
  font-size: 13px;
}

.btn-cancel {
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  background: #f3f4f6;
  color: #374151;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-cancel:hover {
  background: #e5e7eb;
}

.error-banner {
  background: #FDF1F1;
  color: #C62828;
  border: 1px solid #F2D2D2;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Stat cards */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  background: #fff;
  border-radius: 14px;
  border: 1px solid #eef0f3;
  border-top: 3px solid transparent;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  padding: 20px 22px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.stat-card--blue {
  border-top-color: var(--primary);
}
.stat-card--orange {
  border-top-color: var(--warning);
}
.stat-card--green {
  border-top-color: var(--success);
}
.stat-card--red {
  border-top-color: var(--accent);
}


.stat-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-card__icon--blue {
  background: #E3F2FD;
  color: var(--primary);
}

.stat-card__icon--orange {
  background: #f3e1d2;
  color: var(--warning);
}

.stat-card__icon--green {
  background: #E8F5E9;
  color: var(--success);
}

.stat-card__icon--red {
  background: #FDEAEA;
  color: var(--accent);
}

.stat-card__body {
  min-width: 0;
}

.stat-card__label {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-secondary);
  margin: 0;
}

.stat-card__value {
  font-size: 28px;
  font-weight: 800;
  margin: 4px 0 0;
  color: var(--text-primary);
  line-height: 1.1;
}

/* Panel */
.panel {
  background: #fff;
  border-radius: 14px;
  border: 1px solid #eef0f3;
  padding: 8px 0 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 28px 10px;
}

.panel-title {
  font-size: 14px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.tabs {
  display: flex;
  justify-content: center;
  gap: 75px;
  border-bottom: 1px solid #f3f4f6;
  padding: 0 32px;
  background: #FAFBFC;
}

.tab {
  background: none;
  border: none;
  padding: 12px 18px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 10px 10px 0 0;
  border-bottom: 2px solid transparent;
  transition: color 0.15s ease, background 0.15s ease;
}

.tab:hover {
  color: var(--text-primary);
}

.tab--active {
  color: var(--primary);
  background: #fff;
  border-bottom: 2px solid var(--primary);
}

.tab-content {
  padding: 28px;
}

.section-label {
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-primary);
  margin: 0 0 12px;
}

/* Time slots */
.time-slot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin-bottom: 28px;
}

.time-slot-card {
  border: 1.5px solid #e5e7eb;
  border-radius: 14px;
  padding: 16px;
  background: #fff;
  text-align: center;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}

.time-slot-card:hover {
  border-color: #bcd7f2;
  background: #FAFCFF;
}

.time-slot-card--selected {
  border-color: var(--primary);
  background: #E3F2FD;
  box-shadow: 0 0 0 1px var(--primary);
}

.time-slot-card--full {
  border-color: #f3c1c1;
  background: #fdeaea;
  cursor: not-allowed;
}

.slot-time {
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
}

.slot-count {
  font-size: 11.5px;
  color: var(--text-secondary);
  font-weight: 600;
}

.slot-count--full {
  color: var(--accent);
  font-weight: 700;
}

/* Filters */
.filters-row {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.form-input {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 13px;
  color: var(--text-primary);
  background: #fafbfc;
  font-family: inherit;
  transition: border-color 0.15s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
  background: #fff;
}

.filter-select {
  flex: 1;
  cursor: pointer;
}

.form-input-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.form-input-icon .form-input {
  padding-right: 32px;
}

.form-input-icon__icon {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: #6b7280;
}

/* Appointment cards */
.appointment-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.appointment-card {
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid #eef0f3;
  border-radius: 14px;
  padding: 16px 18px;
  background: #fff;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}

.appointment-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border-color: #e3ecf6;
}

.appt-date-badge {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: #E3F2FD;
  color: var(--primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.appt-day {
  display: block;
  font-weight: 800;
  font-size: 17px;
  line-height: 1;
}

.appt-month {
  display: block;
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-top: 3px;
}

.appt-info {
  flex: 1;
  min-width: 0;
}

.appt-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.appt-name {
  font-weight: 700;
  font-size: 14.5px;
  color: var(--text-primary);
  line-height: 1.4;
}

.appt-meta {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 3px 0 0;
}

.appt-screening {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 5px 0 0;
}

.screening-status {
  font-weight: 700;
}

.screening-status--passed {
  color: var(--success);
}

.screening-status--failed {
  color: var(--accent);
}

.screening-status--pending {
  color: var(--warning);
}

.appt-status-col {
  min-width: 100px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
  flex-shrink: 0;
}

.view-link {
  font-size: 12px;
  color: var(--primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.view-link:hover {
  text-decoration: underline;
}

/* Pills / badges */
.pill {
  font-size: 10.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  white-space: nowrap;
}

.pill--outline {
  background: #fff;
  border: 1px solid #d1d5db;
  color: #374151;
}

.pill--blood {
  background: #fdeaea;
  color: var(--accent);
}

.pill--arrived {
  background: #e8f5e9;
  color: var(--success);
}

.pill--confirmed {
  background: #e3f2fd;
  color: var(--primary);
}

.pill--donated {
  background: #e8f5e9;
  color: var(--success);
}

.pill--no-show {
  background: #fdeaea;
  color: var(--accent);
}

.pill--pending,
.pill--scheduled {
  background: #fff3e0;
  color: var(--warning);
}

.pill--cancelled {
  background: #f3f4f6;
  color: #6b7280;
}

.pill--attended {
  background: #e3f2fd;
  color: var(--primary);
}

/* Blood drives */
.drives-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.drive-card {
  border: 1px solid #eef0f3;
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 16px;
}

.drive-card__top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 12px;
}

.drive-card__title {
  font-weight: 700;
  font-size: 14px;
  margin: 0;
}

.drive-card__meta {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 4px 0 0;
}

.status-badge {
  font-size: 10.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  flex-shrink: 0;
  white-space: nowrap;
}

.status-badge--upcoming {
  background: #e3f2fd;
  color: var(--primary);
}

.status-badge--open {
  background: #e8f5e9;
  color: var(--success);
}

.status-badge--closed {
  background: #f3f4f6;
  color: #6b7280;
}

.status-badge--full {
  background: #fdeaea;
  color: var(--accent);
}

.drive-progress-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0 0 6px;
}

.progress-track {
  height: 6px;
  border-radius: 999px;
  background: #eef0f3;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--primary);
  transition: width 0.4s ease;
}

.progress-fill--full {
  background: var(--success);
}

.progress-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  color: var(--text-secondary);
  margin: 6px 0 10px;
}

.drive-note {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 8px 0 14px;
}

.preview-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-secondary);
  margin: 4px 0 10px;
  border-top: 1px solid #f3f4f6;
  padding-top: 14px;
}

.donor-preview-list,
.donor-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.donor-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 0;
}

.donor-row__avatar {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.donor-row__info {
  flex: 1;
  min-width: 0;
}

.donor-row__name {
  font-size: 13px;
  font-weight: 700;
  margin: 0;
}

.donor-row__meta {
  font-size: 11.5px;
  color: var(--text-secondary);
  margin: 2px 0 0;
}

.drive-card__actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f3f4f6;
  flex-wrap: wrap;
}

.empty-state {
  color: var(--text-secondary);
  font-size: 13px;
  padding: 20px 0;
  text-align: center;
}

.empty-state--inline {
  grid-column: 1 / -1;
  padding: 12px 0;
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
  background: #fff;
  border-radius: 14px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
}

.modal-card--wide {
  max-width: 560px;
}

.modal-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid #f3f4f6;
}

.modal-card__title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
}

.modal-card__close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 4px;
  display: flex;
  transition: color 0.15s ease;
}

.modal-card__close:hover {
  color: var(--text-primary);
}

.modal-form {
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.form-label--muted {
  text-transform: none;
  font-weight: 600;
  font-size: 12px;
  color: #374151;
  letter-spacing: 0;
}

.slots-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.slot-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stepper {
  position: relative;
  display: flex;
  align-items: center;
}

.stepper__input {
  padding-right: 32px;
}

.stepper__controls {
  position: absolute;
  right: 4px;
  display: flex;
  flex-direction: column;
}

.stepper__btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 1px 6px;
  display: flex;
  transition: color 0.15s ease;
}

.stepper__btn:hover {
  color: var(--primary);
}

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}

.modal-error {
  color: #C62828;
  font-size: 12.5px;
  font-weight: 500;
  margin: 0;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Loading skeletons */
.skeleton,
.skeleton-block {
  background: linear-gradient(90deg, #eceff3 25%, #f5f7fb 37%, #eceff3 63%);
  background-size: 400% 100%;
  animation: skeleton-loading 1.4s ease infinite;
  border-radius: 8px;
  color: transparent;
}

.skeleton-block {
  min-height: 60px;
}

@keyframes skeleton-loading {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

/* Responsive */
@media (max-width: 900px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .time-slot-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .appointments-page {
    padding: 16px 16px 32px;
  }
  .header-row {
    flex-direction: column;
    align-items: stretch;
  }
  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .filters-row {
    flex-direction: column;
  }
  .appointment-card {
    flex-wrap: wrap;
  }
  .drive-card__actions {
    flex-direction: column;
    align-items: stretch;
  }
}

/* ============ DARK MODE ============ */
:global(.dark .appointments-page) {
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  background: #0F172A;
}

:global(.dark .stat-card),
:global(.dark .panel),
:global(.dark .time-slot-card),
:global(.dark .appointment-card),
:global(.dark .drive-card),
:global(.dark .modal-card),
:global(.dark .bell-btn),
:global(.dark .date-filter),
:global(.dark .form-input),
:global(.dark .btn-cancel),
:global(.dark .btn-outline),
:global(.dark .btn-outline-blue) {
  background: #1E293B;
  border-color: #334155;
}

:global(.dark .stat-card--blue) { border-top-color: #60A5FA; }
:global(.dark .stat-card--orange) { border-top-color: #FBBF24; }
:global(.dark .stat-card--green) { border-top-color: #34D399; }
:global(.dark .stat-card--red) { border-top-color: #F87171; }

:global(.dark .stat-card__value),
:global(.dark .page-title),
:global(.dark .panel-title),
:global(.dark .section-label),
:global(.dark .slot-time),
:global(.dark .appt-name),
:global(.dark .drive-card__title),
:global(.dark .donor-row__name),
:global(.dark .modal-card__title),
:global(.dark .form-label--muted) {
  color: #F1F5F9;
}

:global(.dark .stat-card__label),
:global(.dark .page-subtitle),
:global(.dark .appt-meta),
:global(.dark .appt-screening),
:global(.dark .drive-card__meta),
:global(.dark .drive-progress-label),
:global(.dark .progress-meta),
:global(.dark .drive-note),
:global(.dark .preview-label),
:global(.dark .donor-row__meta),
:global(.dark .empty-state),
:global(.dark .modal-subtitle),
:global(.dark .form-label) {
  color: #94A3B8;
}

:global(.dark .stat-card__icon--blue) { background: #1E3A5F; color: #60A5FA; }
:global(.dark .stat-card__icon--orange) { background: #3E2C1A; color: #FBBF24; }
:global(.dark .stat-card__icon--green) { background: #1A3A2A; color: #34D399; }
:global(.dark .stat-card__icon--red) { background: #3A1A1A; color: #F87171; }


:global(.dark .panel) {
  border-color: #334155;
}

:global(.dark .tabs) {
  background: #0F172A;
  border-bottom-color: #334155;
}

:global(.dark .tab) {
  color: #94A3B8;
}
:global(.dark .tab:hover) {
  color: #F1F5F9;
}
:global(.dark .tab--active) {
  color: #60A5FA;
  background: #1E293B;
  border-bottom-color: #60A5FA;
}

:global(.dark .time-slot-card) {
  border-color: #334155;
  background: #1E293B;
}
:global(.dark .time-slot-card:hover) {
  border-color: #60A5FA;
  background: #263449;
}
:global(.dark .time-slot-card--selected) {
  border-color: #60A5FA;
  background: #1A3A5F;
  box-shadow: 0 0 0 1px #60A5FA;
}
:global(.dark .time-slot-card--full) {
  border-color: #F87171;
  background: #2D1A1A;
}
:global(.dark .slot-count--full) {
  color: #F87171;
}

:global(.dark .form-input) {
  background: #1E293B;
  color: #F1F5F9;
  border-color: #334155;
}
:global(.dark .form-input:focus) {
  border-color: #60A5FA;
  background: #263449;
}
:global(.dark .form-input-icon__icon) {
  color: #94A3B8;
}

:global(.dark .appointment-card) {
  border-color: #334155;
  background: #1E293B;
}
:global(.dark .appointment-card:hover) {
  border-color: #60A5FA;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

:global(.dark .appt-date-badge) {
  background: #1A3A5F;
  color: #60A5FA;
}

:global(.dark .view-link) {
  color: #60A5FA;
}

:global(.dark .pill--outline) {
  background: #1E293B;
  border-color: #475569;
  color: #94A3B8;
}
:global(.dark .pill--blood) {
  background: #2D1A1A;
  color: #F87171;
}
:global(.dark .pill--arrived),
:global(.dark .pill--donated) {
  background: #1A3A2A;
  color: #34D399;
}
:global(.dark .pill--confirmed),
:global(.dark .pill--attended) {
  background: #1A3A5F;
  color: #60A5FA;
}
:global(.dark .pill--no-show) {
  background: #2D1A1A;
  color: #F87171;
}
:global(.dark .pill--cancelled) {
  background: rgba(156, 163, 175, 0.16);
  color: #d1d5db;
}

:global(.dark .pill--pending),
:global(.dark .pill--scheduled) {
  background: #3E2C1A;
  color: #FBBF24;
}

:global(.dark .screening-status--passed) { color: #34D399; }
:global(.dark .screening-status--failed) { color: #F87171; }
:global(.dark .screening-status--pending) { color: #FBBF24; }

:global(.dark .drive-card) {
  border-color: #334155;
}

:global(.dark .status-badge--upcoming) {
  background: #1A3A5F;
  color: #60A5FA;
}
:global(.dark .status-badge--open) {
  background: #1A3A2A;
  color: #34D399;
}
:global(.dark .status-badge--closed) {
  background: #1E293B;
  color: #94A3B8;
}

:global(.dark .progress-track) {
  background: #334155;
}
:global(.dark .progress-fill) {
  background: #60A5FA;
}
:global(.dark .progress-fill--full) {
  background: #34D399;
}

:global(.dark .preview-label),
:global(.dark .drive-card__actions) {
  border-top-color: #334155;
}

:global(.dark .donor-row__avatar) {
  color: #fff;
}

:global(.dark .btn-primary) {
  background: #60A5FA;
  color: #0F172A;
}
:global(.dark .btn-primary:hover) {
  opacity: 0.9;
}
:global(.dark .btn-cancel) {
  background: #263449;
  color: #F1F5F9;
}
:global(.dark .btn-cancel:hover) {
  background: #334155;
}
:global(.dark .btn-outline) {
  background: #263449;
  color: #F1F5F9;
}
:global(.dark .btn-outline:hover) {
  background: #334155;
}
:global(.dark .btn-outline-blue) {
  background: #1A3A5F;
  color: #60A5FA;
}
:global(.dark .btn-outline-blue:hover) {
  background: #1E4A7A;
}
:global(.dark .btn-clear-date) {
  background: #263449;
  color: #F1F5F9;
}
:global(.dark .btn-clear-date:hover) {
  background: #334155;
}
:global(.dark .bell-btn) {
  background: #1E293B;
  border-color: #334155;
  color: #60A5FA;
}
:global(.dark .bell-btn:hover) {
  background: #263449;
}

:global(.dark .modal-overlay) {
  background: rgba(0, 0, 0, 0.7);
}
:global(.dark .modal-card__header) {
  border-bottom-color: #334155;
}
:global(.dark .modal-card__close) {
  color: #94A3B8;
}
:global(.dark .modal-card__close:hover) {
  color: #F1F5F9;
}
:global(.dark .modal-error) {
  color: #F87171;
}

:global(.dark .error-banner) {
  background: rgba(239, 83, 80, 0.10);
  color: #EF9A9A;
  border-color: rgba(239, 83, 80, 0.24);
}

:global(.dark .stepper__btn) {
  color: #94A3B8;
}
:global(.dark .stepper__btn:hover) {
  color: #60A5FA;
}

:global(.dark .skeleton-block) {
  background: linear-gradient(90deg, #1E293B 25%, #263449 37%, #1E293B 63%);
  background-size: 400% 100%;
  animation: skeleton-loading-dark 1.4s ease infinite;
}

@keyframes skeleton-loading-dark {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

:global(.dark .btn-link) {
  color: #60A5FA;
}

.btn-primary:focus-visible,
.btn-outline:focus-visible,
.btn-outline-blue:focus-visible,
.btn-cancel:focus-visible,
.bell-btn:focus-visible,
.btn-link:focus-visible {
  outline: 2px solid var(--rb-primary, #1565C0);
  outline-offset: 2px;
}
</style>