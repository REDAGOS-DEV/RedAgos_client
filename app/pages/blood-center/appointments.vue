<template>
  <div class="appointments-page">
    <!-- Skeleton loading state, the same as the other pages -->
    <div v-if="initialLoading" class="appointments-inner" aria-busy="true" aria-label="Loading appointments">
      <div class="skeleton-head">
        <div class="skeleton skeleton--header" />
        <div class="skeleton skeleton--sub" />
      </div>
      <div class="stats-row">
        <div v-for="n in 4" :key="'skc-' + n" class="skeleton skeleton--card" />
      </div>
      <div class="skeleton skeleton--panel" style="height: 460px" />
    </div>

    <div v-else class="appointments-inner">
      <!-- Header -->
      <header class="header-row">
        <div class="header-copy">
          <h1 class="page-title">Appointments</h1>
          <p class="page-subtitle">{{ headerSummary }}</p>
        </div>

        <div class="header-actions">
          <div class="date-control">
            <span class="date-control__chip" :class="{ 'date-control__chip--today': isToday }">
              {{ isToday ? 'Today' : 'Viewing' }}
            </span>
            <div class="date-filter-wrap">
              <input type="date" v-model="datePickerValue" class="date-filter" aria-label="Appointment date"
                @change="onDateFilterChange" />
              <AssetIcon name="calendar" :size="16" class="form-input-icon__icon" />
            </div>
          </div>

          <button v-if="!isToday" type="button" class="btn-outline" @click="resetToToday">
            Back to today
          </button>

          <!-- The slot list is read-only, so this opens a view, not an editor. -->
          <button type="button" class="btn-outline" @click="openManageSlots">
            <AssetIcon name="clock" :size="14" />
            Time Slots
          </button>
        </div>
      </header>

      <!-- Error banner -->
      <div v-if="loadError" class="error-banner" role="alert">
        <span>{{ loadError }}</span>
        <button type="button" class="error-banner__retry" @click="loadAll">Retry</button>
      </div>

      <!-- Stat cards -->
      <div class="stats-row">
        <div v-for="card in statCards" :key="card.key" class="stat-card" :class="`stat-card--${card.tone}`">
          <div class="stat-card__top">
            <p class="stat-card__label">{{ card.label }}</p>
            <span class="stat-card__icon">
              <AssetIcon :name="card.icon" :size="14" />
            </span>
          </div>
          <p class="stat-card__value" :class="{ skeleton: loadingStats }">{{ loadingStats ? '' : card.value }}</p>
          <span class="stat-card__hint">{{ loadingStats ? '\u00A0' : card.hint }}</span>
        </div>
      </div>

      <!-- Main panel -->
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Appointment Overview</h2>
            <p class="panel-subtitle">{{ selectedDateLabel }}</p>
          </div>
        </div>

        <div class="tabs" role="tablist">
          <button type="button" role="tab" class="tab" :class="{ 'tab--active': activeTab === 'walkin' }"
            :aria-selected="activeTab === 'walkin'" @click="activeTab = 'walkin'">
            Walk-in Appointments
            <span class="tab-count">{{ walkInAppointments.length }}</span>
          </button>
          <button type="button" role="tab" class="tab" :class="{ 'tab--active': activeTab === 'drives' }"
            :aria-selected="activeTab === 'drives'" @click="activeTab = 'drives'">
            Blood Drive Registrations
            <span class="tab-count">{{ bloodDrives.length }}</span>
          </button>
        </div>

        <!-- WALK-IN APPOINTMENTS TAB -->
        <section v-if="activeTab === 'walkin'" class="tab-content">
          <div class="section-head">
            <div>
              <p class="section-label">Time slots</p>
              <p v-if="slotSummary" class="section-hint">{{ slotSummary }}</p>
            </div>
            <div class="section-head__right">
              <div class="slot-legend" aria-hidden="true">
                <span class="legend-item"><i class="legend-dot legend-dot--open" />Open</span>
                <span class="legend-item"><i class="legend-dot legend-dot--busy" />Filling up</span>
                <span class="legend-item"><i class="legend-dot legend-dot--full" />Full</span>
              </div>
              <button v-if="selectedSlotId" type="button" class="btn-link" @click="selectedSlotId = null">
                Show all slots
              </button>
            </div>
          </div>

          <div v-if="loadingSlots" class="time-slot-grid">
            <div v-for="n in 6" :key="'sk-' + n" class="time-slot-card skeleton-block" />
          </div>

          <div v-else-if="timeSlots.length === 0" class="empty-state empty-state--inline">
            <span class="empty-state__icon"><AssetIcon name="clock" :size="18" /></span>
            <p class="empty-state__title">No time slots</p>
            <p class="empty-state__text">This centre has no bookable time slots configured.</p>
          </div>

          <!-- Morning and afternoon apart: how the counter plans its day. -->
          <div v-else class="slot-periods">
            <div v-for="period in slotPeriods" :key="period.key" class="slot-period">
              <p class="slot-period__head">
                <span class="slot-period__name">{{ period.label }}</span>
                <span class="slot-period__meta">{{ period.booked }}/{{ period.capacity }} booked</span>
              </p>

              <div class="time-slot-grid">
                <button v-for="slot in period.slots" :key="slot.id" type="button" class="time-slot-card"
                  :class="[
                    `time-slot-card--${slot.level}`,
                    {
                      'time-slot-card--selected': selectedSlotId === slot.id,
                      'time-slot-card--past': slot.past,
                      'time-slot-card--now': slot.current,
                    },
                  ]"
                  :aria-pressed="selectedSlotId === slot.id" @click="toggleSlot(slot.id)">
                  <span class="slot-head">
                    <span class="slot-time">
                      <i class="legend-dot" :class="`legend-dot--${slot.level}`" aria-hidden="true" />
                      {{ slot.label }}
                    </span>
                    <span v-if="slot.current" class="slot-tag slot-tag--now">Now</span>
                    <span v-else-if="slot.past" class="slot-tag">Past</span>
                  </span>
                  <span class="slot-meter">
                    <span class="slot-meter__fill" :style="{ width: slot.pct + '%' }" />
                  </span>
                  <span class="slot-count">
                    <strong>{{ slot.booked }}</strong>/{{ slot.capacity }}
                    {{ slot.level === 'full' ? 'Full' : 'booked' }}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div class="toolbar">
            <div class="filters-row">
              <select v-model="statusFilter" class="form-input filter-select" aria-label="Filter by status">
                <option value="all">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="in-progress">In progress</option>
                <option value="collected">Collected</option>
                <option value="deferred">Deferred</option>
                <option value="no-show">No-show</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select v-model="bloodTypeFilter" class="form-input filter-select" aria-label="Filter by blood type">
                <option value="all">All Blood Types</option>
                <option v-for="bt in bloodTypes" :key="bt" :value="bt">{{ bt }}</option>
              </select>
              <button v-if="selectedSlotId" type="button" class="filter-chip" @click="selectedSlotId = null">
                Slot: {{ formatSlotTime(selectedSlotId) }}
                <AssetIcon name="x" :size="12" />
              </button>
            </div>

            <div class="toolbar-meta">
              <span v-if="!loadingAppointments" class="result-count">
                Showing <strong>{{ filteredAppointments.length }}</strong> of {{ walkInAppointments.length }}
              </span>
              <button v-if="hasActiveFilters" type="button" class="btn-link" @click="clearFilters">
                Clear filters
              </button>
            </div>
          </div>

          <div class="appointment-list">
            <template v-if="loadingAppointments">
              <div v-for="n in 4" :key="'skap-' + n" class="appointment-card skeleton-block" />
            </template>

            <div v-else-if="walkInAppointments.length === 0" class="empty-state">
              <span class="empty-state__icon"><AssetIcon name="calendar" :size="20" /></span>
              <p class="empty-state__title">No appointments on {{ selectedDateLabel }}</p>
              <p class="empty-state__text">Bookings made in the donor portal for this centre will appear here.</p>
            </div>

            <div v-else-if="filteredAppointments.length === 0" class="empty-state">
              <span class="empty-state__icon"><AssetIcon name="user-x" :size="20" /></span>
              <p class="empty-state__title">No matches</p>
              <p class="empty-state__text">No appointments match the current filters.</p>
              <button type="button" class="btn-outline btn-outline--sm" @click="clearFilters">Clear filters</button>
            </div>

            <template v-else>
              <article v-for="appt in filteredAppointments" :key="appt.id" class="appointment-card"
                :class="[`appointment-card--${appt.statusKey}`, { 'appointment-card--next': appt.id === nextUpId }]">
                <div class="appt-time">
                  <span class="appt-time__clock">{{ appt.slotTime.split(' ')[0] }}</span>
                  <span class="appt-time__period">{{ appt.slotTime.split(' ')[1] }}</span>
                </div>

                <span class="appt-avatar" aria-hidden="true">{{ initials(appt.donorName) }}</span>

                <div class="appt-info">
                  <div class="appt-name-row">
                    <span class="appt-name">{{ appt.donorName }}</span>
                    <span class="pill pill--blood">{{ appt.bloodType }}</span>
                    <span v-if="appt.id === nextUpId" class="next-tag">Up next</span>
                  </div>
                  <div class="appt-meta">
                    <span class="appt-code">{{ appt.donorCode }}</span>
                    <span class="meta-sep" aria-hidden="true">&middot;</span>
                    <span class="kind-tag" :class="`kind-tag--${appt.kindKey}`">{{ appt.kind }}</span>
                    <template v-if="appt.phone">
                      <span class="meta-sep" aria-hidden="true">&middot;</span>
                      <a :href="`tel:${appt.phone}`" class="appt-phone">{{ appt.phone }}</a>
                    </template>
                  </div>
                </div>

                <div class="appt-status-col">
                  <span class="pill pill--status" :class="'pill--' + appt.statusKey">
                    <span class="status-dot" />
                    {{ appt.status }}
                  </span>

                  <div class="appt-actions">
                    <button v-if="appt.canMarkNoShow" type="button" class="row-action row-action--ghost"
                      :disabled="rowBusyId === appt.id" @click="markNoShow(appt)">
                      No-show
                    </button>

                    <button v-if="appt.canCheckIn" type="button" class="row-action row-action--primary"
                      :disabled="rowBusyId === appt.id" @click="checkInAppointment(appt)">
                      <span v-if="rowBusyId === appt.id" class="btn-spinner" />
                      {{ rowBusyId === appt.id ? 'Working…' : 'Check in' }}
                    </button>

                    <NuxtLink v-else-if="appt.canOpenCounter" to="/blood-center/collection"
                      class="row-action row-action--primary">
                      Open counter
                      <AssetIcon name="arrow-right" :size="12" />
                    </NuxtLink>
                  </div>
                </div>
              </article>
            </template>
          </div>
        </section>

        <!-- BLOOD DRIVE REGISTRATIONS TAB -->
        <section v-else class="tab-content">
          <div class="drives-header">
            <div>
              <p class="section-label">Mobile blood drives</p>
              <p class="section-hint">Registrations donors made through the portal.</p>
            </div>
            <!-- KEPT YANNIE'S VERSION – simplified path -->
            <NuxtLink to="/blood-center/drives" class="btn-outline-blue">
              Go to Mobile Drives
              <AssetIcon name="arrow-right" :size="14" />
            </NuxtLink>
          </div>

          <template v-if="loadingDrives">
            <div v-for="n in 2" :key="'skd-' + n" class="drive-card skeleton-block" style="height: 200px" />
          </template>

          <div v-else-if="bloodDrives.length === 0" class="empty-state">
            <span class="empty-state__icon"><AssetIcon name="droplets" :size="20" /></span>
            <p class="empty-state__title">No upcoming drives</p>
            <p class="empty-state__text">Drives this centre schedules in Donation Drives will show their registrations here.</p>
          </div>

          <div v-else class="drive-grid">
            <div v-for="drive in bloodDrives" :key="drive.id" class="drive-card">
              <div class="drive-card__top">
                <div>
                  <p class="drive-card__title">{{ drive.name }}</p>
                  <p class="drive-card__meta">{{ drive.dateLabel }}</p>
                </div>
                <span class="status-badge" :class="`status-badge--${drive.statusKey}`">{{ drive.status || '—' }}</span>
              </div>

              <div class="drive-progress">
                <div class="drive-progress__head">
                  <span class="drive-progress-label">Registered donors</span>
                  <span v-if="drive.capacity" class="drive-progress__pct">{{ driveProgressPct(drive) }}%</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" :class="{ 'progress-fill--full': driveProgressPct(drive) >= 100 }"
                    :style="{ width: driveProgressPct(drive) + '%' }" />
                </div>
                <div class="progress-meta">
                  <span><strong>{{ drive.registered }}</strong> registered</span>
                  <span>{{ drive.capacity ? `${drive.capacity} capacity` : 'No limit set' }}</span>
                </div>
              </div>

              <p v-if="drive.status === 'Open'" class="drive-note drive-note--open">
                Registration is open. Donors can book in the portal.
              </p>

              <template v-if="drive.previewDonors.length">
                <p class="preview-label">Registered Donors (Preview)</p>
                <div class="donor-preview-list">
                  <div v-for="donor in drive.previewDonors" :key="donor.id" class="donor-row">
                    <span class="donor-row__avatar" :style="{ background: colorFor(donor.name) }">{{
                      initials(donor.name) }}</span>
                    <div class="donor-row__info">
                      <p class="donor-row__name">{{ donor.name }}</p>
                      <p class="donor-row__meta">{{ donor.bloodType }} &middot; Registered {{
                        donor.registeredDate }} &middot; Screening: {{ donor.screeningStatus }}</p>
                    </div>
                    <span class="pill" :class="'pill--' + donor.status.toLowerCase()">{{ donor.status }}</span>
                  </div>
                </div>
              </template>

              <p v-else class="drive-note">The donor list for each drive is not available yet.</p>

              <div class="drive-card__actions">
                <button type="button" class="btn-outline btn-outline--sm" disabled title="Not available yet"
                  @click="openViewDonors(drive)">View all {{ drive.registered }} donors</button>
                <button type="button" class="btn-outline-blue" disabled title="Not available yet"
                  @click="openManageDrive(drive)">Manage Drive &amp; Attendance</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- TIME SLOTS MODAL (read-only) -->
    <Transition name="modal">
      <div v-if="showManageSlotsModal" class="modal-overlay" @click.self="closeManageSlots">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="slots-modal-title">
          <div class="modal-card__header">
            <h2 id="slots-modal-title" class="modal-card__title">Time Slots</h2>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeManageSlots">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <div class="modal-form">
            <div class="info-note">
              These are the slots donors choose from when booking in the portal. View only: hours and
              capacity are set by the system administrator.
            </div>

            <div class="form-group">
              <label class="form-label" for="slots-date">Date</label>
              <div class="form-input-icon">
                <input id="slots-date" v-model="slotsForm.date" type="date" class="form-input"
                  @change="fetchSlotsForForm" />
                <AssetIcon name="calendar" :size="14" class="form-input-icon__icon" />
              </div>
            </div>

            <div class="slot-readout-head">
              <span class="form-label">Time slots &amp; capacity</span>
              <span v-if="!loadingSlotForm && slotsForm.slots.length" class="slot-readout-total">
                {{ slotsFormTotal }} donors / day
              </span>
            </div>

            <div v-if="loadingSlotForm" class="slot-readout">
              <div v-for="n in 5" :key="'skf-' + n" class="slot-readout__row skeleton-block" />
            </div>
            <div v-else-if="slotsForm.slots.length" class="slot-readout">
              <div v-for="slot in slotsForm.slots" :key="slot.id" class="slot-readout__row">
                <span class="slot-readout__time">
                  <AssetIcon name="clock" :size="14" />
                  {{ formatSlotTime(slot.time) }}
                </span>
                <span class="slot-readout__cap"><strong>{{ slot.capacity }}</strong> max donors</span>
              </div>
            </div>
            <p v-else-if="!saveSlotsError" class="modal-empty">No slots are configured for this date.</p>

            <p v-if="saveSlotsError" class="modal-error">{{ saveSlotsError }}</p>

            <div class="modal-actions">
              <button type="button" class="btn-outline" @click="closeManageSlots">Close</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- VIEW DONORS MODAL (Blood Drive) -->
    <Transition name="modal">
      <div v-if="showDonorsModal" class="modal-overlay" @click.self="closeViewDonors">
        <div class="modal-card modal-card--wide" role="dialog" aria-modal="true" aria-labelledby="donors-modal-title">
          <div class="modal-card__header">
            <h2 id="donors-modal-title" class="modal-card__title">{{ selectedDrive?.name }} &middot; Registered Donors</h2>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeViewDonors">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <div class="modal-form">
            <div v-if="loadingDriveDonors" class="donor-list">
              <div v-for="n in 5" :key="'skdd-' + n" class="donor-row skeleton-block" />
            </div>
            <div v-else class="donor-list">
              <p v-if="driveDonors.length === 0" class="modal-empty">The donor list for this drive is not
                available yet.</p>
              <div v-for="donor in driveDonors" :key="donor.id" class="donor-row">
                <span class="donor-row__avatar" :style="{ background: colorFor(donor.name) }">{{
                  initials(donor.name) }}</span>
                <div class="donor-row__info">
                  <p class="donor-row__name">{{ donor.name }}</p>
                  <p class="donor-row__meta">{{ donor.bloodType }} &middot; Registered {{
                    donor.registeredDate }} &middot; Screening: {{ donor.screeningStatus }}</p>
                </div>
                <span class="pill" :class="'pill--' + donor.status.toLowerCase()">{{ donor.status }}</span>
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn-outline" @click="closeViewDonors">Close</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
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

const { user, can } = useUser()

// Ang /time-slots kay donor-facing, so kinahanglan gyud og center_id. Ang
// queue dili — gikuha na niya ang facility gikan sa token.
const facilityId = computed(() => user.value?.facility?.id ?? null)

// Lima ka status ang gi-store sa server. Ang counter naay kaugalingon nga
// pinulongan, so usa ra ka lugar ang mo-translate. Ang `key` kay slug para sa
// pill class ug sa filter — ang label "In progress" naay space.
const STATUSES = {
  scheduled: { key: 'scheduled', label: 'Scheduled' },
  // Gi-scan na ang QR (o gi-check in), so nagsugod na ang visit.
  confirmed: { key: 'in-progress', label: 'In progress' },
  completed: { key: 'collected', label: 'Collected' },
  no_show: { key: 'no-show', label: 'No-show' },
  cancelled: { key: 'cancelled', label: 'Cancelled' },
}

// Ang deferred nga donor kay `completed` usab ang appointment — ang donation
// ra ang mo-ingon nga wala diay nakuhaan og dugo.
const DEFERRED = { key: 'deferred', label: 'Deferred' }

function displayStatus(row) {
  if (row.status === 'completed' && row.donation_status === 'rejected') return DEFERRED
  return STATUSES[row.status] ?? { key: row.status, label: row.status }
}

// Parehas sa `bookedCountsByTime()` sa server: ang scheduled ug confirmed ra
// ang mo-hawid og slot. Ang cancelled ug no_show mo-libre pagbalik sa lugar.
const HOLDS_A_SLOT = ['scheduled', 'confirmed']

// A slot reads "Filling up" from this share of its capacity onward.
const BUSY_THRESHOLD = 75

// Slots carry only a start time. Until the API returns a duration, a slot is
// treated as an hour long when deciding whether it is already past.
const ASSUMED_SLOT_MINUTES = 60

const AVATAR_COLORS = ['#1565C0', '#2E7D32', '#F57C00', '#D32F2F', '#6D4C41', '#5E35B1']

function todayIso() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function slotKeyOf(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** "HH:MM" minutes since midnight, or null when the string isn't a time. */
function minutesOf(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** "13:30" -> "1:30 PM". Anything unexpected passes through untouched. */
function formatSlotTime(hhmm) {
  const total = minutesOf(hhmm)
  if (total === null) return hhmm
  const h = Math.floor(total / 60)
  const mm = String(total % 60).padStart(2, '0')
  return `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`
}

/**
 * Ang queue mo-return og server field names; lahi ang gidahom sa template.
 * Usa ra ka lugar ang mo-tabok aron dili magkatag ang mapping.
 */
function mapAppointment(row) {
  const at = new Date(row.appointment_datetime)
  const status = displayStatus(row)
  const isWalkIn = row.event_id === null

  return {
    id: row.id,
    rawStatus: row.status,
    donorUuid: row.donor?.uuid || null,
    donorName: row.donor?.full_name || 'Unknown donor',
    donorCode: row.donor?.donor_code || '—',
    bloodType: row.donor?.blood_type || '—',
    phone: row.donor?.phone || '',
    kind: isWalkIn ? 'Walk-in' : 'Mobile drive',
    kindKey: isWalkIn ? 'walkin' : 'drive',
    slotKey: slotKeyOf(at),
    slotTime: at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    dateDay: at.getDate(),
    dateMonth: at.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    status: status.label,
    statusKey: status.key,

    canCheckIn: row.status === 'scheduled',
    canOpenCounter: row.status === 'confirmed',
    canMarkNoShow: row.status === 'scheduled' || row.status === 'confirmed',
  }
}

/**
 * Ang stats gikan ra sa parehas nga queue payload — walay separate nga
 * endpoint, ug wala man kinahanglana: naa na ang tanan nga row diri.
 */
function deriveStats(rows) {
  const count = (key) => rows.filter((r) => r.statusKey === key).length

  return {
    todayWalkIns: rows.filter((r) => r.kind === 'Walk-in').length,
    inProgress: count('in-progress'),
    collectedToday: count('collected'),
    noShows: count('no-show'),
  }
}

const initialLoading = ref(true)
const activeTab = ref('walkin')
const loadError = ref('')

const stats = reactive({ todayWalkIns: 0, inProgress: 0, collectedToday: 0, noShows: 0 })
const loadingStats = ref(false)

// Which row is mid-request, so only that row's buttons disable rather than
// the whole queue freezing.
const rowBusyId = ref(null)

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

// Time Slots modal
const showManageSlotsModal = ref(false)
const loadingSlotForm = ref(false)
const saveSlotsError = ref('')
const slotsForm = reactive({ date: '', slots: [] })

// View Donors modal (blood drive)
const showDonorsModal = ref(false)
const loadingDriveDonors = ref(false)
const selectedDrive = ref(null)
const driveDonors = ref([])

// Ticks once a minute so slots fade to "Past" while the page stays open.
const now = ref(new Date())
let clockTimer = null

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

// `new Date('YYYY-MM-DD')` parses as UTC midnight, which lands on the previous
// day in any timezone west of UTC. Appending a time makes it local.
const selectedDateLabel = computed(() => {
  const d = new Date(`${selectedDateFilter.value}T00:00:00`)
  if (isNaN(d.getTime())) return selectedDateFilter.value
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
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

/** Slots with everything the card needs to draw itself. */
const decoratedSlots = computed(() => {
  const nowMinutes = now.value.getHours() * 60 + now.value.getMinutes()
  // A slot lasts until the next one starts; the list is evenly spaced.
  const firstTwo = timeSlots.value.slice(0, 2).map((s) => minutesOf(s.time))
  const step = firstTwo.length === 2 && firstTwo[1] > firstTwo[0] ? firstTwo[1] - firstTwo[0] : ASSUMED_SLOT_MINUTES

  return timeSlots.value.map((slot) => {
    const booked = slotBookings.value[slot.time] || 0
    const capacity = slot.capacity || 0
    const isFull = booked >= capacity
    const pct = capacity ? Math.min(100, Math.round((booked / capacity) * 100)) : 100
    const start = minutesOf(slot.time)

    return {
      ...slot,
      booked,
      pct,
      level: isFull ? 'full' : pct >= BUSY_THRESHOLD ? 'busy' : 'open',
      label: formatSlotTime(slot.time),
      past: isToday.value && start !== null && start + step <= nowMinutes,
      current: isToday.value && start !== null && start <= nowMinutes && nowMinutes < start + step,
    }
  })
})

/** The slots split at noon, each half with its own tally. */
const slotPeriods = computed(() => {
  const periods = [
    { key: 'morning', label: 'Morning', slots: decoratedSlots.value.filter((s) => (minutesOf(s.time) ?? 0) < 12 * 60) },
    { key: 'afternoon', label: 'Afternoon', slots: decoratedSlots.value.filter((s) => (minutesOf(s.time) ?? 0) >= 12 * 60) },
  ]

  return periods
    .filter((period) => period.slots.length)
    .map((period) => ({
      ...period,
      booked: period.slots.reduce((sum, s) => sum + s.booked, 0),
      capacity: period.slots.reduce((sum, s) => sum + (s.capacity || 0), 0),
    }))
})

const slotSummary = computed(() => {
  if (loadingSlots.value || !decoratedSlots.value.length) return ''
  const booked = decoratedSlots.value.reduce((sum, s) => sum + s.booked, 0)
  const capacity = decoratedSlots.value.reduce((sum, s) => sum + (s.capacity || 0), 0)
  const open = decoratedSlots.value.filter((s) => s.level !== 'full' && !s.past).length
  return `${booked} of ${capacity} seats booked · ${open} slot${open === 1 ? '' : 's'} still open`
})

const filteredAppointments = computed(() => {
  return walkInAppointments.value.filter((appt) => {
    const statusOk = statusFilter.value === 'all' || appt.statusKey === statusFilter.value
    const bloodOk = bloodTypeFilter.value === 'all' || appt.bloodType === bloodTypeFilter.value
    // A picked slot card narrows the list to its donors.
    const slotOk = !selectedSlotId.value || appt.slotKey === selectedSlotId.value
    return statusOk && bloodOk && slotOk
  })
})

/**
 * The scheduled donor the counter should expect next: the earliest booking,
 * today, whose slot has not ended. Display only.
 */
const nextUpId = computed(() => {
  if (!isToday.value) return null
  const open = new Set(decoratedSlots.value.filter((s) => !s.past).map((s) => s.time))
  const next = walkInAppointments.value
    .filter((a) => a.statusKey === 'scheduled' && open.has(a.slotKey))
    .sort((x, y) => x.slotKey.localeCompare(y.slotKey))[0]
  return next?.id ?? null
})

/** One line under the title: the day at a glance. */
const headerSummary = computed(() => {
  const rows = walkInAppointments.value
  const booked = rows.filter((r) => r.statusKey !== 'cancelled').length
  const day = isToday.value ? 'today' : `on ${selectedDateLabel.value}`
  const parts = [`${booked} donor${booked === 1 ? '' : 's'} booked ${day}`]
  const next = rows.find((r) => r.id === nextUpId.value)
  if (next) parts.push(`next at ${next.slotTime}`)
  else if (isToday.value && booked && !stats.inProgress) parts.push('no one waiting')
  return parts.join(' · ')
})

const hasActiveFilters = computed(
  () => statusFilter.value !== 'all' || bloodTypeFilter.value !== 'all' || !!selectedSlotId.value,
)

function clearFilters() {
  statusFilter.value = 'all'
  bloodTypeFilter.value = 'all'
  selectedSlotId.value = null
}

function toggleSlot(id) {
  selectedSlotId.value = selectedSlotId.value === id ? null : id
}

const statCards = computed(() => {
  const rows = walkInAppointments.value
  const live = rows.filter((r) => r.statusKey !== 'cancelled').length
  const collectedPct = live ? Math.round((stats.collectedToday / live) * 100) : 0

  return [
    {
      key: 'walkins',
      label: isToday.value ? "Today's Walk-ins" : 'Walk-ins',
      value: stats.todayWalkIns,
      icon: 'user-check',
      tone: 'blue',
      hint: `${rows.length} appointment${rows.length === 1 ? '' : 's'} in total`,
    },
    {
      key: 'progress',
      label: 'In Progress',
      value: stats.inProgress,
      icon: 'clock',
      tone: 'orange',
      hint: stats.inProgress ? 'Checked in, at the counter' : 'Nobody at the counter',
    },
    {
      key: 'collected',
      label: isToday.value ? 'Collected Today' : 'Collected',
      value: stats.collectedToday,
      icon: 'droplets',
      tone: 'green',
      hint: live ? `${collectedPct}% of booked donors` : 'No bookings yet',
    },
    {
      key: 'noshows',
      label: 'No-shows',
      value: stats.noShows,
      icon: 'user-x',
      tone: 'red',
      hint: stats.noShows ? 'Their slots were released' : 'Everyone showed up so far',
    },
  ]
})

const slotsFormTotal = computed(() =>
  slotsForm.slots.reduce((sum, s) => sum + (Number(s.capacity) || 0), 0),
)

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

/**
 * Same person, same colour — keyed on the donor rather than the row index, so
 * an avatar doesn't change colour every time a filter reorders the list.
 */
function colorFor(seed) {
  let h = 0
  for (const ch of String(seed || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
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
    Object.assign(stats, { todayWalkIns: 0, inProgress: 0, collectedToday: 0, noShows: 0 })
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

/**
 * This centre's own drives, from the same facility-scoped list the Donation
 * Drives page reads. The donor-facing /blood-drives is every centre's
 * catalogue, which is why other centres' drives showed up here.
 */
async function loadBloodDrives() {
  if (!can('drives.view')) {
    bloodDrives.value = []
    return
  }

  loadingDrives.value = true

  try {
    const data = await bloodCenterService.drives()

    bloodDrives.value = (data?.drives ?? [])
      // Registrations only matter for drives that have not happened yet.
      .filter((drive) => drive.status !== 'Completed')
      .sort((x, y) => String(x.event_date).localeCompare(String(y.event_date)))
      .map((drive) => ({
        id: drive.id,
        name: drive.name,
        location: drive.location,
        dateLabel: [
          drive.event_date
            ? new Date(`${drive.event_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : null,
          drive.location,
        ].filter(Boolean).join(' · '),
        status: drive.status,
        statusKey: String(drive.status || 'closed').toLowerCase(),
        registered: drive.registered_count ?? 0,
        capacity: drive.capacity ?? null,
        previewDonors: drive.donor_preview ?? [],
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

/**
 * Mark an expected donor as arrived, then hand over to the counter.
 *
 * The queue only starts the visit. Everything after check-in — screening,
 * collection, completion — belongs to the one continuous transaction on
 * /blood-center/collection, which holds the donor context the QR scan verified.
 */
async function checkInAppointment(appt) {
  rowBusyId.value = appt.id
  loadError.value = ''

  try {
    await bloodCenterService.checkInAppointment(appt.id)
    await loadQueue()
  } catch (err) {
    loadError.value = err?.data?.code === 'appointment_not_pending'
      ? 'This appointment has already been checked in or closed.'
      : err?.message || 'The donor could not be checked in.'
  } finally {
    rowBusyId.value = null
  }
}

async function markNoShow(appt) {
  if (!window.confirm(`Mark ${appt.donorName} as a no-show?`)) return

  rowBusyId.value = appt.id
  loadError.value = ''

  try {
    await bloodCenterService.markAppointmentNoShow(appt.id)
    await loadQueue()
  } catch (err) {
    loadError.value = err?.message || 'The appointment could not be updated.'
  } finally {
    rowBusyId.value = null
  }
}

async function openManageSlots() {
  showManageSlotsModal.value = true
  saveSlotsError.value = ''
  // Pre-fill with the date the page is showing (already YYYY-MM-DD, which is
  // what <input type="date"> expects).
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
  // Placeholder: wala pay backend para sa drive attendance.
  if (import.meta.dev) {
    console.warn('[Appointments] openManageDrive is not wired up yet', drive.id)
  }
}

// ESC closes whichever modal is open, same as the backdrop click.
function onKeydown(e) {
  if (e.key !== 'Escape') return
  if (showDonorsModal.value) closeViewDonors()
  else if (showManageSlotsModal.value) closeManageSlots()
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  clockTimer = setInterval(() => { now.value = new Date() }, 60_000)
  await loadAll()
  initialLoading.value = false
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  clearInterval(clockTimer)
})
</script>

<style scoped>
.appointments-page {
  /* Local names kept; the values are the shared tokens, as on every other page. */
  --primary: var(--rb-primary);
  --accent: var(--rb-accent);
  --success: var(--rb-success);
  --warning: var(--rb-warning);
  --text-primary: var(--rb-text-primary);
  --text-secondary: var(--rb-text-secondary);
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  font-family: var(--rb-font-sans);
  color: var(--text-primary);
}

/* ---------- Loading ---------- */
.btn-spinner {
  width: 11px;
  height: 11px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.appointments-inner {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* ---------- Header ---------- */
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  flex-wrap: wrap;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  color: var(--text-primary);
}

.page-subtitle {
  font-size: 13.5px;
  color: var(--text-secondary);
  margin: 6px 0 0;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.date-control {
  display: flex;
  align-items: center;
  height: 40px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 12px;
  background: var(--rb-surface);
  padding-left: 5px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.date-control:focus-within {
  border-color: var(--primary);
  box-shadow: var(--rb-focus-ring);
}

.date-control__chip {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 5px 9px;
  border-radius: 8px;
  background: var(--rb-surface-alt);
  color: var(--text-secondary);
}

.date-control__chip--today {
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
}

.date-filter-wrap {
  position: relative;
  width: 150px;
}

.date-filter {
  width: 100%;
  height: 38px;
  padding: 0 40px 0 10px;
  appearance: none;
  border: none;
  background: transparent;
  color: var(--rb-text-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.date-filter:focus {
  outline: none;
}

/* Our calendar icon is drawn beside these; the browser's own would double it.
   It stays clickable, stretched invisibly over the whole field. */
.date-filter::-webkit-calendar-picker-indicator,
.form-input-icon input[type='date']::-webkit-calendar-picker-indicator {
  opacity: 0;
  position: absolute;
  right: 0;
  top: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

/* ---------- Buttons ---------- */
.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  padding: 0 16px;
  border-radius: 12px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  border: 1px solid var(--rb-border-strong);
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.btn-outline:hover:not(:disabled) {
  background: var(--rb-surface-hover);
  border-color: var(--rb-border-hover);
}

.btn-outline:active:not(:disabled) {
  transform: translateY(1px);
}

.btn-outline:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-outline--sm {
  height: 34px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 12.5px;
}

.btn-outline-blue {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
  background: rgba(var(--rb-primary-rgb), 0.08);
  color: var(--rb-primary-text);
  border: none;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s ease;
}

.btn-outline-blue:hover:not(:disabled) {
  background: rgba(var(--rb-primary-rgb), 0.15);
}

.btn-outline-blue:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--rb-primary-text);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.btn-link:hover {
  text-decoration: underline;
}

/* ---------- Error banner ---------- */
.error-banner {
  background: #FDF1F1;
  color: #C62828;
  border: 1px solid #F2D2D2;
  border-left: 4px solid #D32F2F;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.error-banner__retry {
  flex-shrink: 0;
  height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.error-banner__retry:hover {
  background: rgba(211, 47, 47, 0.08);
}

/* ---------- Stat cards ---------- */
/* auto-fit, not a fixed count: the content column changes width when the
   rail expands, so the grid answers to its container, not the viewport. */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
}

.stat-card {
  --tone-rgb: var(--rb-primary-rgb);
  --tone-text: var(--rb-primary-text);
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--rb-surface);
  border-radius: 14px;
  border: 1px solid var(--rb-border);
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  padding: 16px;
}

/* Coloured cap so the four numbers read as four different things at a glance. */
.stat-card--blue { --tone: var(--rb-primary); --tone-rgb: var(--rb-primary-rgb); --tone-text: var(--rb-primary-text); }
.stat-card--orange { --tone: var(--rb-warning); --tone-rgb: var(--rb-warning-rgb); --tone-text: var(--rb-warning-text); }
.stat-card--green { --tone: var(--rb-success); --tone-rgb: var(--rb-success-rgb); --tone-text: var(--rb-success-text); }
.stat-card--red { --tone: var(--rb-accent); --tone-rgb: var(--rb-accent-rgb); --tone-text: var(--rb-accent-text); }

.stat-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.stat-card__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  margin: 0;
}

.stat-card__icon {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(var(--tone-rgb), 0.08);
  color: var(--tone-text);
}

.stat-card__value {
  min-height: 24px;
  font-size: 24px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  margin: 0;
  color: var(--text-primary);
  line-height: 1;
}

.stat-card__value.skeleton {
  width: 48px;
}

/* The chip under the number, as on Inventory. */
.stat-card__hint {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  color: var(--text-secondary);
}

/* ---------- Panel ---------- */
.panel {
  background: var(--rb-surface);
  border-radius: 14px;
  border: 1px solid var(--rb-border);
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px 14px;
}

.panel-title {
  font-size: 16px;
  font-weight: 800;
  margin: 0;
  color: var(--text-primary);
}

.panel-subtitle {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 3px 0 0;
}

/* Tabs share the panel's 22px gutter: label and underline land on one line. */
.tabs {
  display: flex;
  justify-content: flex-start;
  gap: 28px;
  border-top: 1px solid var(--rb-border);
  border-bottom: 1px solid var(--rb-border);
  padding: 0 22px;
  background: var(--rb-surface-alt);
  overflow-x: auto;
  scrollbar-width: thin;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  padding: 14px 0 12px;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 3px solid transparent;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.tab:focus-visible {
  outline: 2px solid var(--rb-primary-text);
  outline-offset: -2px;
}

.tab:hover {
  color: var(--text-primary);
}

.tab--active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.tab-count {
  min-width: 22px;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--rb-border);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.tab--active .tab-count {
  background: var(--primary);
  color: #fff;
}

.tab-content {
  padding: 22px;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin: 0 0 12px;
}

.section-head__right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.section-label {
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-primary);
  margin: 0;
}

.section-hint {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 4px 0 0;
}

.slot-legend {
  display: flex;
  gap: 12px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-secondary);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.legend-dot--open { background: var(--rb-success); }
.legend-dot--busy { background: var(--rb-warning); }
.legend-dot--full { background: var(--rb-accent); }

/* ---------- Time slots ---------- */
.time-slot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.slot-periods {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-bottom: 24px;
}

.slot-period__head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0 0 8px;
}

.slot-period__name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.slot-period__meta {
  font-size: 12px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.slot-time .legend-dot {
  display: inline-block;
  margin-right: 6px;
  vertical-align: middle;
}

/* Open slots show their colour too, not only once someone books. */
.time-slot-card--open {
  border-color: rgba(var(--rb-success-rgb), 0.3);
}

.time-slot-card--busy {
  border-color: rgba(var(--rb-warning-rgb), 0.45);
}

.time-slot-card {
  --meter: var(--rb-success);
  position: relative;
  border: 1px solid var(--rb-border-strong);
  border-radius: 12px;
  padding: 12px 14px;
  background: var(--rb-surface);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.time-slot-card:hover {
  border-color: rgba(var(--rb-primary-rgb), 0.5);
  background: var(--rb-surface-hover);
}

/* The slot the counter is in right now. */
.time-slot-card--now {
  border-color: rgba(var(--rb-primary-rgb), 0.55);
}

.time-slot-card:focus-visible {
  outline: none;
  box-shadow: var(--rb-focus-ring);
}

.time-slot-card--busy { --meter: var(--rb-warning); }

.time-slot-card--full {
  --meter: var(--rb-accent);
  border-color: rgba(var(--rb-accent-rgb), 0.35);
  background: rgba(var(--rb-accent-rgb), 0.05);
}

.time-slot-card--past {
  opacity: 0.6;
}

.time-slot-card--selected,
.time-slot-card--selected:hover {
  opacity: 1;
  border-color: var(--primary);
  background: rgba(var(--rb-primary-rgb), 0.08);
  box-shadow: none;
}

.time-slot-grid .skeleton-block {
  min-height: 78px;
}

.slot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.slot-time {
  font-weight: 800;
  font-size: 14px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.slot-tag {
  font-size: 9.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--rb-surface-alt);
  color: var(--text-secondary);
}

.slot-tag--now {
  background: var(--rb-primary);
  color: #fff;
}

.slot-meter {
  display: block;
  height: 6px;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  overflow: hidden;
}

.slot-meter__fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--meter);
  transition: width 0.4s ease;
}

.slot-count {
  font-size: 11.5px;
  color: var(--text-secondary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.slot-count strong {
  color: var(--text-primary);
  font-weight: 800;
}

.time-slot-card--full .slot-count,
.time-slot-card--full .slot-count strong {
  color: var(--rb-accent-text);
  font-weight: 800;
}

/* ---------- Toolbar / filters ---------- */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px;
  margin-bottom: 14px;
  border-radius: 14px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
}

.filters-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.toolbar-meta {
  display: flex;
  align-items: center;
  gap: 14px;
}

.result-count {
  font-size: 12.5px;
  color: var(--text-secondary);
}

.result-count strong {
  color: var(--text-primary);
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.35);
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.filter-chip:hover {
  background: rgba(var(--rb-primary-rgb), 0.16);
}

.form-input {
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--rb-surface);
  font-family: inherit;
  transition: border-color 0.15s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--rb-focus-ring);
}

/*
 * One caret, drawn by us. The `background` shorthand is deliberate, and so is
 * repeating it in the dark rule: a later `background: <colour>` resets
 * background-image to none, and the dark override for .form-input is exactly
 * such a rule.
 */
.filter-select {
  flex: 0 0 190px;
  height: 36px;
  padding-top: 0;
  padding-bottom: 0;
  font-weight: 600;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background: var(--rb-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E") no-repeat right 12px center;
  background-size: 10px 6px;
  padding-right: 32px;
}

.form-input-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.form-input-icon .form-input {
  width: 100%;
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

/* ---------- Appointment rows ---------- */
.appointment-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/*
 * The status stripe is an inset shadow rather than a border-left so the card
 * keeps its radius; the hover rule repeats it because box-shadow doesn't stack
 * across rules.
 */
.appointment-card {
  --stripe: var(--rb-border-strong);
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  padding: 12px 16px 12px 20px;
  background: var(--rb-surface);
  box-shadow: inset 4px 0 0 var(--stripe);
  transition: box-shadow 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.appointment-card:hover {
  border-color: var(--rb-border-strong);
  box-shadow:
    inset 4px 0 0 var(--stripe),
    0 1px 3px rgba(var(--rb-shadow-rgb), 0.06),
    0 10px 22px -14px rgba(var(--rb-shadow-rgb), 0.3);
}

.appointment-card--scheduled { --stripe: var(--rb-warning); }
.appointment-card--in-progress { --stripe: var(--rb-primary); }
.appointment-card--collected { --stripe: var(--rb-success); }
.appointment-card--deferred,
.appointment-card--no-show { --stripe: var(--rb-accent); }
.appointment-card--cancelled { --stripe: var(--rb-border-strong); }

/* The donor the counter should expect next. */
.appointment-card--next {
  border-color: rgba(var(--rb-primary-rgb), 0.45);
  background: rgba(var(--rb-primary-rgb), 0.03);
}

.next-tag {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--rb-primary);
  color: #fff;
}

.appointment-card--cancelled .appt-name,
.appointment-card--no-show .appt-name {
  color: var(--text-secondary);
}

.appointment-card--cancelled .appt-name {
  text-decoration: line-through;
}

.appointment-list .skeleton-block {
  min-height: 78px;
  box-shadow: none;
}

.appt-time {
  width: 64px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-right: 14px;
  border-right: 1px solid var(--rb-border);
}

.appt-time__clock {
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.appt-time__period {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  margin-top: 4px;
  color: var(--text-secondary);
}

.appt-avatar {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.appt-info {
  flex: 1;
  min-width: 0;
}

.appt-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.appt-name {
  font-weight: 800;
  font-size: 14.5px;
  text-transform: capitalize;
  color: var(--text-primary);
  line-height: 1.35;
}

.appt-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  margin: 5px 0 0;
}

.appt-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  font-weight: 600;
}

.meta-sep {
  opacity: 0.6;
}

.kind-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 6px;
}

.kind-tag--walkin {
  background: rgba(var(--rb-primary-rgb), 0.08);
  color: var(--rb-primary-text);
}

.kind-tag--drive {
  background: rgba(var(--rb-success-rgb), 0.1);
  color: var(--rb-success-text);
}

.appt-phone {
  color: inherit;
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}

.appt-phone:hover {
  color: var(--rb-primary-text);
  text-decoration: underline;
}

.appt-status-col {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.appt-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.row-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  min-width: 92px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  border-radius: 10px;
  padding: 0 14px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.row-action:hover:not(:disabled) {
  background: var(--rb-surface-hover);
  border-color: var(--rb-border-hover);
}

.row-action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.row-action--ghost {
  min-width: 0;
  color: var(--text-secondary);
}

.row-action--ghost:hover:not(:disabled) {
  color: var(--rb-accent-text);
  border-color: rgba(var(--rb-accent-rgb), 0.4);
  background: rgba(var(--rb-accent-rgb), 0.06);
}

.row-action--primary {
  background: var(--rb-primary);
  border-color: var(--rb-primary);
  color: #fff;
  box-shadow: 0 4px 10px -6px rgba(var(--rb-primary-rgb), 0.8);
}

.row-action--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--rb-primary) 86%, #000);
  border-color: color-mix(in srgb, var(--rb-primary) 86%, #000);
  color: #fff;
}

/* ---------- Pills ---------- */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 999px;
  white-space: nowrap;
}

.pill--status {
  min-width: 104px;
  justify-content: center;
  padding: 6px 12px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: currentColor;
}

.pill--in-progress .status-dot {
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.8); }
}

.pill--blood { background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); }
.pill--in-progress,
.pill--confirmed,
.pill--attended { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.pill--collected { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.pill--no-show,
.pill--deferred { background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); }
.pill--pending,
.pill--scheduled { background: rgba(var(--rb-warning-rgb), 0.12); color: var(--rb-warning-text); }
.pill--cancelled { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

/* ---------- Empty states ---------- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  padding: 36px 16px;
  border: 1px dashed var(--rb-border-strong);
  border-radius: 14px;
}

.empty-state--inline {
  grid-column: 1 / -1;
  padding: 22px 16px;
}

.empty-state__icon {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  background: rgba(var(--rb-primary-rgb), 0.08);
  color: var(--rb-primary-text);
}

.empty-state__title {
  font-size: 14px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
}

.empty-state__text {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 0 0 6px;
  max-width: 360px;
}

/* ---------- Blood drives ---------- */
.drives-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.drive-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 14px;
}

.drive-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  padding: 18px 20px;
  background: var(--rb-surface);
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}

.drive-card:hover {
  border-color: var(--rb-border-strong);
  box-shadow: 0 10px 22px -14px rgba(var(--rb-shadow-rgb), 0.3);
}

.drive-card__top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 12px;
}

.drive-card__heading {
  display: flex;
  gap: 12px;
  min-width: 0;
}

.drive-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--rb-accent-rgb), 0.1);
  color: var(--rb-accent-text);
}

.drive-card__title {
  font-weight: 800;
  font-size: 15px;
  margin: 0;
  color: var(--text-primary);
}

.drive-card__meta {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 4px 0 0;
}

.status-badge {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 5px 10px;
  border-radius: 999px;
  flex-shrink: 0;
  white-space: nowrap;
}

.status-badge--upcoming { background: #e3f2fd; color: var(--primary); }
.status-badge--open { background: #e8f5e9; color: var(--success); }
.status-badge--closed { background: #f3f4f6; color: #6b7280; }
.status-badge--full { background: #fdeaea; color: var(--accent); }

.drive-progress {
  padding: 14px;
  border-radius: 12px;
  background: var(--rb-surface-alt);
}

.drive-progress__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}

.drive-progress-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.drive-progress__pct {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.progress-track {
  height: 10px;
  border-radius: 999px;
  background: var(--rb-border);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--primary);
  transition: width 0.5s ease;
}

.progress-fill--full {
  background: var(--success);
}

.progress-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  margin: 8px 0 0;
}

.progress-meta strong {
  color: var(--text-primary);
}

.drive-note {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 14px 0 0;
}

.drive-note--open {
  padding: 9px 12px;
  border-radius: 10px;
  background: rgba(var(--rb-success-rgb), 0.08);
  color: var(--rb-success-text);
  font-weight: 600;
}

.preview-label {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin: 16px 0 10px;
  border-top: 1px solid var(--rb-border);
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
  width: 34px;
  height: 34px;
  border-radius: 999px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
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
  margin-top: auto;
  padding-top: 16px;
  flex-wrap: wrap;
}

/* ---------- Modals ---------- */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}

.modal-card {
  background: var(--rb-surface);
  border-radius: 18px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.35);
}

.modal-card--wide {
  max-width: 560px;
}

.modal-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--rb-border);
}

.modal-card__heading {
  display: flex;
  align-items: center;
  gap: 10px;
}

.modal-card__icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
}

.modal-card__title {
  font-size: 16px;
  font-weight: 800;
  margin: 0;
}

.modal-card__close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 6px;
  border-radius: 8px;
  display: flex;
  transition: color 0.15s ease, background 0.15s ease;
}

.modal-card__close:hover {
  color: var(--text-primary);
  background: var(--rb-surface-hover);
}

.modal-form {
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.info-note {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--rb-primary-text);
  background: rgba(var(--rb-primary-rgb), 0.07);
  border: 1px solid rgba(var(--rb-primary-rgb), 0.18);
  border-radius: 10px;
  padding: 10px 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 11px;
  font-weight: 800;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.slot-readout-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.slot-readout-total {
  font-size: 12px;
  font-weight: 700;
  color: var(--rb-primary-text);
}

.slot-readout {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  overflow: hidden;
}

.slot-readout__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 11px 14px;
  font-size: 13px;
}

.slot-readout__row + .slot-readout__row {
  border-top: 1px solid var(--rb-border);
}

.slot-readout__row:nth-child(even) {
  background: var(--rb-surface-alt);
}

.slot-readout .skeleton-block {
  min-height: 42px;
  border-radius: 0;
}

.slot-readout__time {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.slot-readout__cap {
  color: var(--text-secondary);
}

.slot-readout__cap strong {
  color: var(--text-primary);
  font-size: 14px;
}

.modal-empty {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  padding: 18px 0;
  margin: 0;
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
  font-weight: 600;
  margin: 0;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-card,
.modal-leave-to .modal-card {
  transform: translateY(12px) scale(0.98);
}

/* ---------- Skeletons (the same page skeleton as Inventory) ---------- */
.skeleton-head { display: flex; flex-direction: column; gap: 8px; }
.skeleton--header { height: 28px; max-width: 220px; border-radius: 8px; }
.skeleton--sub { height: 14px; max-width: 320px; border-radius: 6px; }
.skeleton--card { height: 108px; border-radius: 14px; }
.skeleton--panel { border-radius: 14px; }

.skeleton,
.skeleton-block {
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: skeleton-loading 1.4s ease infinite;
  border-radius: 8px;
  color: transparent;
  border-color: transparent;
}

.skeleton-block {
  min-height: 60px;
}

@keyframes skeleton-loading {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .btn-spinner,
  .pill--in-progress .status-dot,
  .skeleton,
  .skeleton-block {
    animation: none !important;
  }

}

/* ============ DARK MODE ============ */
:global(.dark .appointments-page) {
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  background: #0F172A;
}

:global(.dark .appointments-page .stat-card),
:global(.dark .appointments-page .panel),
:global(.dark .appointments-page .appointment-card),
:global(.dark .appointments-page .drive-card),
:global(.dark .appointments-page .modal-card),
:global(.dark .appointments-page .date-control),
:global(.dark .appointments-page .time-slot-card),
:global(.dark .appointments-page .form-input),
:global(.dark .appointments-page .btn-outline),
:global(.dark .appointments-page .row-action:not(.row-action--primary)) {
  background: #1E293B;
  border-color: #334155;
}

/* After the rule above, whose `background` shorthand would otherwise reset
   the caret to none. */
:global(.dark .appointments-page .filter-select) {
  background: #1E293B url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E") no-repeat right 12px center;
  background-size: 10px 6px;
  border-color: #334155;
  color: #F1F5F9;
}

:global(.dark .appointments-page .btn-outline),
:global(.dark .appointments-page .row-action:not(.row-action--primary)),
:global(.dark .appointments-page .date-filter) {
  color: #F1F5F9;
}

:global(.dark .appointments-page .btn-outline:hover:not(:disabled)),
:global(.dark .appointments-page .row-action:not(.row-action--primary):hover:not(:disabled)) {
  background: #263449;
  border-color: #475569;
}

:global(.dark .appointments-page .row-action--ghost) {
  color: #94A3B8;
}

:global(.dark .appointments-page .row-action--ghost:hover:not(:disabled)) {
  color: #F87171;
  border-color: rgba(248, 113, 113, 0.4);
  background: rgba(248, 113, 113, 0.08);
}

:global(.dark .appointments-page .row-action--primary) {
  background: #2563EB;
  border-color: #2563EB;
  box-shadow: none;
}

:global(.dark .appointments-page .row-action--primary:hover:not(:disabled)) {
  background: #1D4ED8;
  border-color: #1D4ED8;
}

:global(.dark .appointments-page .stat-card__value),
:global(.dark .appointments-page .page-title),
:global(.dark .appointments-page .panel-title),
:global(.dark .appointments-page .section-label),
:global(.dark .appointments-page .slot-time),
:global(.dark .appointments-page .slot-count strong),
:global(.dark .appointments-page .appt-name),
:global(.dark .appointments-page .appt-time__clock),
:global(.dark .appointments-page .drive-card__title),
:global(.dark .appointments-page .drive-progress__pct),
:global(.dark .appointments-page .donor-row__name),
:global(.dark .appointments-page .modal-card__title),
:global(.dark .appointments-page .empty-state__title),
:global(.dark .appointments-page .slot-readout__time),
:global(.dark .appointments-page .slot-readout__cap strong),
:global(.dark .appointments-page .result-count strong),
:global(.dark .appointments-page .progress-meta strong) {
  color: #F1F5F9;
}

:global(.dark .appointments-page .stat-card__label),
:global(.dark .appointments-page .stat-card__hint),
:global(.dark .appointments-page .page-subtitle),
:global(.dark .appointments-page .panel-subtitle),
:global(.dark .appointments-page .section-hint),
:global(.dark .appointments-page .appt-meta),
:global(.dark .appointments-page .appt-time__period),
:global(.dark .appointments-page .drive-card__meta),
:global(.dark .appointments-page .drive-progress-label),
:global(.dark .appointments-page .progress-meta),
:global(.dark .appointments-page .drive-note),
:global(.dark .appointments-page .preview-label),
:global(.dark .appointments-page .donor-row__meta),
:global(.dark .appointments-page .empty-state__text),
:global(.dark .appointments-page .modal-empty),
:global(.dark .appointments-page .form-label),
:global(.dark .appointments-page .result-count),
:global(.dark .appointments-page .legend-item),
:global(.dark .appointments-page .loading-text) {
  color: #94A3B8;
}

:global(.dark .appointments-page .tabs),
:global(.dark .appointments-page .toolbar),
:global(.dark .appointments-page .drive-progress) {
  background: #0F172A;
  border-color: #334155;
}

:global(.dark .appointments-page .tab) {
  color: #94A3B8;
}
:global(.dark .appointments-page .tab:hover) {
  color: #F1F5F9;
}
:global(.dark .appointments-page .tab--active) {
  color: #60A5FA;
  border-bottom-color: #60A5FA;
}
:global(.dark .appointments-page .tab-count) {
  background: #334155;
  color: #CBD5E1;
}
:global(.dark .appointments-page .tab--active .tab-count) {
  background: #60A5FA;
  color: #0F172A;
}

:global(.dark .appointments-page .date-control__chip) {
  background: #0F172A;
  color: #94A3B8;
}
:global(.dark .appointments-page .date-control__chip--today) {
  background: #1A3A5F;
  color: #60A5FA;
}

:global(.dark .appointments-page .time-slot-card--full) {
  background: rgba(248, 113, 113, 0.08);
  border-color: rgba(248, 113, 113, 0.35);
}
:global(.dark .appointments-page .time-slot-card--selected) {
  background: #1A3A5F;
  border-color: #60A5FA;
  box-shadow: none;
}
:global(.dark .appointments-page .time-slot-card--full .slot-count),
:global(.dark .appointments-page .time-slot-card--full .slot-count strong) {
  color: #F87171;
}
:global(.dark .appointments-page .slot-meter),
:global(.dark .appointments-page .slot-tag) {
  background: #0F172A;
}

:global(.dark .appointments-page .form-input:focus) {
  border-color: #60A5FA;
  background: #263449;
}
:global(.dark .appointments-page .form-input-icon__icon) {
  color: #94A3B8;
}

:global(.dark .appointments-page .appt-time) {
  border-right-color: #334155;
}

:global(.dark .appointments-page .filter-chip) {
  background: #1A3A5F;
  border-color: rgba(96, 165, 250, 0.4);
  color: #60A5FA;
}

:global(.dark .appointments-page .kind-tag--walkin) {
  background: #1A3A5F;
  color: #60A5FA;
}
:global(.dark .appointments-page .kind-tag--drive) {
  background: #1A3A2A;
  color: #34D399;
}

:global(.dark .appointments-page .pill--blood) {
  background: #2D1A1A;
  color: #F87171;
}
:global(.dark .appointments-page .pill--collected) {
  background: #1A3A2A;
  color: #34D399;
}
:global(.dark .appointments-page .pill--in-progress),
:global(.dark .appointments-page .pill--confirmed),
:global(.dark .appointments-page .pill--attended) {
  background: #1A3A5F;
  color: #60A5FA;
}
:global(.dark .appointments-page .pill--no-show),
:global(.dark .appointments-page .pill--deferred) {
  background: #2D1A1A;
  color: #F87171;
}
:global(.dark .appointments-page .pill--cancelled) {
  background: rgba(156, 163, 175, 0.16);
  color: #d1d5db;
}
:global(.dark .appointments-page .pill--pending),
:global(.dark .appointments-page .pill--scheduled) {
  background: #3E2C1A;
  color: #FBBF24;
}

:global(.dark .appointments-page .empty-state) {
  border-color: #334155;
}
:global(.dark .appointments-page .empty-state__icon),
:global(.dark .appointments-page .modal-card__icon) {
  background: #1A3A5F;
  color: #60A5FA;
}

:global(.dark .appointments-page .drive-card__icon) {
  background: #2D1A1A;
  color: #F87171;
}

:global(.dark .appointments-page .status-badge--upcoming) {
  background: #1A3A5F;
  color: #60A5FA;
}
:global(.dark .appointments-page .status-badge--open) {
  background: #1A3A2A;
  color: #34D399;
}
:global(.dark .appointments-page .status-badge--closed) {
  background: #0F172A;
  color: #94A3B8;
}
:global(.dark .appointments-page .status-badge--full) {
  background: #2D1A1A;
  color: #F87171;
}

:global(.dark .appointments-page .progress-track) {
  background: #334155;
}
:global(.dark .appointments-page .progress-fill) {
  background: #60A5FA;
}
:global(.dark .appointments-page .progress-fill--full) {
  background: #34D399;
}

:global(.dark .appointments-page .drive-note--open) {
  background: #1A3A2A;
  color: #34D399;
}

:global(.dark .appointments-page .preview-label) {
  border-top-color: #334155;
}

:global(.dark .appointments-page .btn-outline-blue) {
  background: #1A3A5F;
  color: #60A5FA;
}
:global(.dark .appointments-page .btn-outline-blue:hover:not(:disabled)) {
  background: #1E4A7A;
}

:global(.dark .appointments-page .btn-link) {
  color: #60A5FA;
}

:global(.dark .appointments-page .modal-overlay) {
  background: rgba(0, 0, 0, 0.7);
}
:global(.dark .appointments-page .modal-card__header) {
  border-bottom-color: #334155;
}
:global(.dark .appointments-page .modal-card__close) {
  color: #94A3B8;
}
:global(.dark .appointments-page .modal-card__close:hover) {
  color: #F1F5F9;
  background: #263449;
}
:global(.dark .appointments-page .info-note) {
  background: #1A3A5F;
  border-color: rgba(96, 165, 250, 0.3);
  color: #93C5FD;
}
:global(.dark .appointments-page .slot-readout),
:global(.dark .appointments-page .slot-readout__row + .slot-readout__row) {
  border-color: #334155;
}
:global(.dark .appointments-page .slot-readout__row:nth-child(even)) {
  background: #0F172A;
}
:global(.dark .appointments-page .slot-readout-total) {
  color: #60A5FA;
}
:global(.dark .appointments-page .modal-error) {
  color: #F87171;
}

:global(.dark .appointments-page .error-banner) {
  background: rgba(239, 83, 80, 0.10);
  color: #EF9A9A;
  border-color: rgba(239, 83, 80, 0.24);
  border-left-color: #EF5350;
}

/* ---------- Focus rings ---------- */
.btn-outline:focus-visible,
.btn-outline-blue:focus-visible,
.btn-link:focus-visible,
.row-action:focus-visible,
.filter-chip:focus-visible,
.error-banner__retry:focus-visible,
.modal-card__close:focus-visible {
  outline: 2px solid var(--rb-primary, #1565C0);
  outline-offset: 2px;
}
</style>