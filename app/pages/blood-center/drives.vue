<template>
  <div class="drives-page">
    <!-- Skeleton loading state, the same as the other pages -->
    <div v-if="loading" class="drives-inner" aria-busy="true" aria-label="Loading drives">
      <div class="skeleton-head">
        <div class="skeleton skeleton--header" />
        <div class="skeleton skeleton--sub" />
      </div>
      <div class="stats-row">
        <div v-for="n in 3" :key="'skc-' + n" class="skeleton skeleton--card" />
      </div>
      <div class="skeleton skeleton--panel" style="height: 420px" />
    </div>

    <div v-else class="drives-inner">
      <!-- Header -->
      <header class="header-row">
        <div>
          <h1 class="page-title">Donation Drives</h1>
          <p class="page-subtitle">{{ headerSummary }}</p>
        </div>
        <button type="button" class="btn-primary" @click="openCreateModal">
          <AssetIcon name="plus" :size="15" />
          Create drive
        </button>
      </header>

      <!-- KPI cards, as on Inventory -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">Upcoming Drives</p>
            <span class="stat-card__badge stat-card__badge--primary"><AssetIcon name="calendar" :size="14" /></span>
          </div>
          <p class="stat-card__value">{{ upcomingDrivesCount }}</p>
          <span class="stat-chip">{{ nextDriveLabel }}</span>
        </div>

        <div class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">Registered Donors</p>
            <span class="stat-card__badge stat-card__badge--purple"><AssetIcon name="users" :size="14" /></span>
          </div>
          <p class="stat-card__value">{{ totalRegistered }}</p>
          <span class="stat-chip">Across upcoming drives</span>
        </div>

        <div class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">Units Collected</p>
            <span class="stat-card__badge stat-card__badge--success"><AssetIcon name="droplets" :size="14" /></span>
          </div>
          <p class="stat-card__value">{{ unitsCollectedMonth }}</p>
          <span class="stat-chip">At drives this month</span>
        </div>
      </div>

      <!-- Drive list -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Drives</h2>
            <p class="panel-subtitle">Every drive this centre has scheduled.</p>
          </div>

          <div class="seg" role="tablist" aria-label="Show drives">
            <button
              v-for="tab in TABS"
              :key="tab.value"
              type="button"
              role="tab"
              class="seg__btn"
              :class="{ 'seg__btn--on': view === tab.value }"
              :aria-selected="view === tab.value"
              @click="view = tab.value"
            >
              {{ tab.label }}
              <span class="seg__count">{{ countFor(tab.value) }}</span>
            </button>
          </div>
        </div>

        <div v-if="loadError" class="empty-state" role="alert">
          <span class="empty-state__icon empty-state__icon--error"><AssetIcon name="circle-alert" :size="20" /></span>
          <p class="empty-state__title">Could not load the drives</p>
          <p class="empty-state__text">{{ loadError }}</p>
          <button type="button" class="btn-outline" @click="loadDrives">Try again</button>
        </div>

        <div v-else-if="!drives.length" class="empty-state">
          <span class="empty-state__icon"><AssetIcon name="truck" :size="20" /></span>
          <p class="empty-state__title">No drives yet</p>
          <p class="empty-state__text">Schedule a drive and donors can register for it in the donor portal.</p>
          <button type="button" class="btn-primary" @click="openCreateModal">
            <AssetIcon name="plus" :size="15" />
            Create drive
          </button>
        </div>

        <div v-else-if="!visibleDrives.length" class="empty-state">
          <span class="empty-state__icon"><AssetIcon name="calendar" :size="20" /></span>
          <p class="empty-state__title">{{ view === 'completed' ? 'No completed drives' : 'No upcoming drives' }}</p>
          <p class="empty-state__text">
            {{ view === 'completed' ? 'Drives move here once their date has passed.' : 'Create one to open registrations for donors.' }}
          </p>
        </div>

        <ul v-else class="drive-list">
          <li
            v-for="drive in visibleDrives"
            :key="drive.id"
            class="drive"
            :class="{ 'drive--done': drive.status === 'Completed', 'drive--today': drive.status === 'Open' }"
          >
            <!-- Calendar block: the date is what a drive is planned around. -->
            <div class="drive__date" aria-hidden="true">
              <span class="drive__month">{{ dateParts(drive.event_date).month }}</span>
              <span class="drive__day">{{ dateParts(drive.event_date).day }}</span>
              <span class="drive__weekday">{{ dateParts(drive.event_date).weekday }}</span>
            </div>

            <div class="drive__body">
              <div class="drive__title-row">
                <p class="drive__title">{{ drive.name }}</p>
                <span class="status-badge" :class="`status-badge--${String(drive.status).toLowerCase()}`">
                  {{ drive.status === 'Open' ? 'Today' : drive.status }}
                </span>
              </div>

              <p class="drive__facts">
                <span class="drive__fact">
                  <AssetIcon name="map-pin" :size="13" />
                  {{ drive.location }}
                </span>
                <span v-if="drive.start_time && drive.end_time" class="drive__fact">
                  <AssetIcon name="clock" :size="13" />
                  {{ timeLabel(drive.start_time) }} to {{ timeLabel(drive.end_time) }}
                </span>
                <span v-if="drive.assigned_staff" class="drive__fact">
                  <AssetIcon name="users" :size="13" />
                  {{ drive.assigned_staff }}
                </span>
              </p>

              <p v-if="drive.announcement" class="drive__note">{{ drive.announcement }}</p>
            </div>

            <!-- Registrations against capacity -->
            <div class="drive__fill">
              <p class="drive__fill-head">
                <strong>{{ drive.registered_count ?? 0 }}</strong>
                <span>{{ drive.capacity ? `of ${drive.capacity} registered` : 'registered' }}</span>
              </p>
              <div class="progress-track">
                <div
                  class="progress-fill"
                  :class="`progress-fill--${fillLevel(drive)}`"
                  :style="{ width: `${Math.min(fillPercent(drive), 100)}%` }"
                />
              </div>
              <p class="drive__fill-foot">
                {{ drive.capacity ? `${Math.min(fillPercent(drive), 100)}% full` : 'No capacity limit' }}
              </p>
            </div>

            <!-- Staff manage their own drives. Both open their dialog; saving waits on the server. -->
            <div class="drive__actions">
              <template v-if="drive.status !== 'Completed'">
                <button type="button" class="btn-small" @click="openEditModal(drive)">
                  <AssetIcon name="pencil" :size="13" />
                  Edit
                </button>
                <button type="button" class="btn-ghost-danger" @click="openCancelDialog(drive)">Cancel</button>
              </template>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- Create drive modal -->
    <Transition name="modal">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreateModal">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-drive-title">
          <div class="modal-card__header">
            <div>
              <h2 id="create-drive-title" class="modal-card__title">{{ editingDrive ? 'Edit drive' : 'Create drive' }}</h2>
              <p class="modal-card__subtitle">
                {{ editingDrive
                  ? 'Registered donors keep their place; tell them if the date or venue changes.'
                  : 'Donors see the name, venue, date and time when they book.' }}
              </p>
            </div>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeCreateModal">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <form class="modal-form" @submit.prevent="handleCreateDrive">
            <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
            <p v-if="editingDrive" class="form-notice">
              <AssetIcon name="info" :size="14" />
              <span>Saving changes is not connected yet. The server needs a route to update a drive.</span>
            </p>

            <div class="form-group">
              <label class="form-label" for="drive-name">Drive name</label>
              <input id="drive-name" v-model="driveForm.name" type="text" class="form-input" placeholder="e.g. UM Matina Bloodletting Drive" maxlength="150" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="drive-venue">Venue</label>
              <input id="drive-venue" v-model="driveForm.location" type="text" class="form-input" placeholder="Venue name and address" maxlength="150" required>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="drive-date">Date</label>
                <input id="drive-date" v-model="driveForm.event_date" type="date" class="form-input" :min="todayIso" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="drive-capacity">Max donors</label>
                <div class="stepper">
                  <input id="drive-capacity" v-model.number="driveForm.max_capacity" type="number" min="1" class="form-input stepper__input" required>
                  <div class="stepper__controls">
                    <button type="button" class="stepper__btn" aria-label="More" @click="driveForm.max_capacity = (driveForm.max_capacity || 0) + 1">
                      <AssetIcon name="chevron-up" :size="10" />
                    </button>
                    <button type="button" class="stepper__btn" aria-label="Fewer" @click="driveForm.max_capacity = Math.max(1, (driveForm.max_capacity || 1) - 1)">
                      <AssetIcon name="chevron-down" :size="10" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="drive-start">Starts</label>
                <input id="drive-start" v-model="driveForm.start_time" type="time" class="form-input" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="drive-end">Ends</label>
                <input id="drive-end" v-model="driveForm.end_time" type="time" class="form-input" required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="drive-staff">Assigned staff <span class="form-optional">optional</span></label>
              <input id="drive-staff" v-model="driveForm.assigned_staff" type="text" class="form-input" placeholder="Who will run the drive">
            </div>

            <div class="form-group">
              <label class="form-label" for="drive-note">Message for donors <span class="form-optional">optional</span></label>
              <textarea id="drive-note" v-model="driveForm.announcement" class="form-textarea" rows="3" placeholder="e.g. Bring a valid ID and eat before donating." />
            </div>

            <div class="modal-actions">
              <button type="button" class="btn-outline" @click="closeCreateModal">Discard</button>
              <button
                type="submit"
                class="btn-primary"
                :disabled="submitting || Boolean(editingDrive)"
                :title="editingDrive ? 'Not connected yet: the server has no route for this.' : undefined"
              >
                {{ editingDrive ? 'Save changes' : submitting ? 'Creating…' : 'Create drive' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- Cancel drive -->
    <Transition name="modal">
      <div v-if="cancelTarget" class="modal-overlay" @click.self="closeCancelDialog">
        <div class="modal-card modal-card--narrow" role="alertdialog" aria-modal="true" aria-labelledby="cancel-drive-title">
          <div class="modal-card__header">
            <div>
              <h2 id="cancel-drive-title" class="modal-card__title">Cancel this drive?</h2>
              <p class="modal-card__subtitle">
                {{ cancelTarget.name }} &middot; {{ dateParts(cancelTarget.event_date).weekday }},
                {{ dateParts(cancelTarget.event_date).month }} {{ dateParts(cancelTarget.event_date).day }}
              </p>
            </div>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeCancelDialog">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <div class="modal-form">
            <div class="cancel-impact">
              <AssetIcon name="circle-alert" :size="16" />
              <p>
                <strong>{{ cancelTarget.registered_count ?? 0 }} donor{{ (cancelTarget.registered_count ?? 0) === 1 ? '' : 's' }}</strong>
                registered. The drive closes to new registrations, and the donors who signed up need to be told.
              </p>
            </div>

            <div class="form-group">
              <label class="form-label" for="cancel-reason">Reason</label>
              <textarea
                id="cancel-reason"
                v-model="cancelReason"
                class="form-textarea"
                rows="3"
                maxlength="255"
                placeholder="e.g. Venue unavailable because of the weather advisory"
              />
              <p class="form-hint">Shown to the registered donors.</p>
            </div>

            <p class="form-notice">
              <AssetIcon name="info" :size="14" />
              <span>Cancelling is not connected yet. The server needs a route to cancel a drive.</span>
            </p>

            <div class="modal-actions">
              <button type="button" class="btn-outline" @click="closeCancelDialog">Keep drive</button>
              <button type="button" class="btn-danger" disabled title="Not connected yet: the server has no route for this.">
                Cancel drive
              </button>
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

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'drives.manage',
})

const loading = ref(true)
const submitting = ref(false)
const showCreateModal = ref(false)
const loadError = ref('')

// Ang mga key dinhi kay pareho gyud sa mga column sa `mobile_events`, dili ang
// UI labels ('venue', 'capacity'). Usa ra ka vocabulary sa tibuok wire, so
// walay translation layer nga pwede mag-drift sa server.
const driveForm = reactive({
  name: '',
  location: '',
  event_date: '',
  max_capacity: 50,
  start_time: '08:00',
  end_time: '16:00',
  assigned_staff: '',
  announcement: '',
})

const formError = ref('')

const todayIso = computed(() => new Date().toISOString().slice(0, 10))

function resetDriveForm() {
  driveForm.name = ''
  driveForm.location = ''
  driveForm.event_date = ''
  driveForm.max_capacity = 50
  driveForm.start_time = '08:00'
  driveForm.end_time = '16:00'
  driveForm.assigned_staff = ''
  driveForm.announcement = ''
  formError.value = ''
}

// The drive being edited, or null when the modal creates one.
const editingDrive = ref(null)

function openCreateModal() {
  editingDrive.value = null
  resetDriveForm()
  showCreateModal.value = true
}

/** The same form, filled with the drive's current values. */
function openEditModal(drive) {
  editingDrive.value = drive
  formError.value = ''
  Object.assign(driveForm, {
    name: drive.name ?? '',
    location: drive.location ?? '',
    event_date: String(drive.event_date ?? '').slice(0, 10),
    max_capacity: drive.capacity ?? 50,
    start_time: String(drive.start_time ?? '08:00').slice(0, 5),
    end_time: String(drive.end_time ?? '16:00').slice(0, 5),
    assigned_staff: drive.assigned_staff ?? '',
    announcement: drive.announcement ?? '',
  })
  showCreateModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
  editingDrive.value = null
  resetDriveForm()
}

// Cancel dialog
const cancelTarget = ref(null)
const cancelReason = ref('')

function openCancelDialog(drive) {
  cancelTarget.value = drive
  cancelReason.value = ''
}

function closeCancelDialog() {
  cancelTarget.value = null
  cancelReason.value = ''
}

async function handleCreateDrive() {
  // Editing has no server route yet; the button is disabled, this is the backstop.
  if (editingDrive.value) return

  submitting.value = true
  formError.value = ''
  try {
    // POST /api/blood-center/drives — ang facility_id ug created_by kay gikan sa
    // token, dili sa payload, so wala tay ipadala nga facility dinhi.
    const newDrive = await bloodCenterService.createDrive({ ...driveForm })
    drives.value = [newDrive, ...drives.value]
    upcomingDrivesCount.value += 1
    totalRegistered.value += newDrive.registered_count ?? 0
    view.value = 'upcoming'
    closeCreateModal()
  } catch (err) {
    // Ang BaseService nagbutang sa message sa server sa `err.message` ug sa
    // per-field nga 422 sa `err.errors`. Ipakita gyud — kaniadto console ra ni,
    // mao nga ang "Save Changes" morag walay gibuhat.
    formError.value = firstFieldError(err) || err?.message || 'Could not create this drive. Please try again.'
  } finally {
    submitting.value = false
  }
}

// Ang una nga field error mao ang labing tino nga rason sa 422; ang top-level
// nga message sa Laravel kay generic ra ("The given data was invalid.").
function firstFieldError(err) {
  const errors = err?.errors
  if (!errors) return ''
  const first = Object.values(errors)[0]
  return Array.isArray(first) ? first[0] : first
}

// All values start empty/zero — populated only from the API response.
const upcomingDrivesCount = ref(0)
const totalRegistered = ref(0)
const unitsCollectedMonth = ref(0)
const drives = ref([])
// drive shape: {
//   id, name, facility_name, location, event_date, start_time, end_time,
//   capacity, registered_count, assigned_staff, announcement,
//   status: 'Completed' | 'Full' | 'Open' | 'Upcoming',   // capitalized, server-computed
//   donor_preview: []   // always empty for now: no endpoint lists a drive's donors
// }

/* ---------- display: which drives, and how each reads ---------- */

const TABS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
]

const view = ref('upcoming')

const isDone = (drive) => drive.status === 'Completed'

function countFor(value) {
  if (value === 'upcoming') return drives.value.filter((d) => !isDone(d)).length
  if (value === 'completed') return drives.value.filter(isDone).length
  return drives.value.length
}

// Upcoming soonest first; completed most recent first.
const visibleDrives = computed(() => {
  const byDate = (x, y) => String(x.event_date).localeCompare(String(y.event_date))
  if (view.value === 'upcoming') return drives.value.filter((d) => !isDone(d)).sort(byDate)
  if (view.value === 'completed') return drives.value.filter(isDone).sort((x, y) => byDate(y, x))
  return [...drives.value].sort((x, y) => byDate(y, x))
})

const nextDrive = computed(() =>
  drives.value.filter((d) => !isDone(d)).sort((x, y) => String(x.event_date).localeCompare(String(y.event_date)))[0])

const nextDriveLabel = computed(() => {
  if (!nextDrive.value) return 'None scheduled'
  const { month, day } = dateParts(nextDrive.value.event_date)
  return `Next on ${month.charAt(0)}${month.slice(1).toLowerCase()} ${day}`
})

const headerSummary = computed(() => {
  const upcoming = countFor('upcoming')
  if (!drives.value.length) return 'Schedule mobile drives and let donors register in the portal.'
  return `${upcoming} upcoming drive${upcoming === 1 ? '' : 's'} · ${totalRegistered.value} donor${totalRegistered.value === 1 ? '' : 's'} registered`
})

function dateParts(value) {
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return { month: '', day: '—', weekday: '' }
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
  }
}

// Ang TIME nga column mo-balik ug 'HH:MM:SS'. "13:30:00" -> "1:30 PM"
function timeLabel(value) {
  const [h, m] = String(value).split(':').map(Number)
  if (Number.isNaN(h)) return String(value)
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

function fillPercent(drive) {
  if (!drive.capacity) return 0
  return Math.round(((drive.registered_count ?? 0) / drive.capacity) * 100)
}

// The same three levels as the appointment slots: open, filling up, full.
function fillLevel(drive) {
  const pct = fillPercent(drive)
  if (pct >= 100) return 'full'
  if (pct >= 75) return 'busy'
  return 'open'
}

async function loadDrives() {
  loadError.value = ''
  try {
    // GET /api/blood-center/drives — facility-scoped, apil ang mga nahuman na.
    // { upcoming_drives_count, total_registered, units_collected_month, drives: [...] }
    const data = await bloodCenterService.drives()
    upcomingDrivesCount.value = data.upcoming_drives_count ?? 0
    totalRegistered.value = data.total_registered ?? 0
    unitsCollectedMonth.value = data.units_collected_month ?? 0
    drives.value = data.drives ?? []
  } catch (err) {
    // Ipakita ang kapakyasan imbes mo-render ug empty state: managlahi ang
    // "walay drive pa" ug "wala ma-load ang mga drive".
    loadError.value = err?.message || 'Could not load mobile drives. Please try again.'
    drives.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadDrives)
</script>

<style scoped>
.drives-page {
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
}

.drives-inner {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ---------- Skeletons (the same page skeleton as Inventory) ---------- */
.skeleton {
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}

.skeleton-head { display: flex; flex-direction: column; gap: 8px; }
.skeleton--header { height: 28px; max-width: 220px; border-radius: 8px; }
.skeleton--sub { height: 14px; max-width: 320px; border-radius: 6px; }
.skeleton--card { height: 108px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

/* ---------- Header ---------- */
.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 3px 0 0; }

/* ---------- Buttons (as on Inventory) ---------- */
.btn-primary,
.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 38px;
  padding: 0 16px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.btn-primary {
  color: #fff;
  background: var(--rb-primary);
  border: none;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.06);
}

.btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-outline {
  color: var(--rb-text-primary);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong);
}

.btn-outline:hover { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }

.btn-small {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.btn-small:hover { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }

.btn-danger {
  display: inline-flex;
  align-items: center;
  height: 38px;
  padding: 0 16px;
  border-radius: 10px;
  border: none;
  background: var(--rb-accent);
  color: #fff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-ghost-danger {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.3);
  background: transparent;
  color: var(--rb-accent-text);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.btn-ghost-danger:hover:not(:disabled) { background: rgba(var(--rb-accent-rgb), 0.06); }
.btn-ghost-danger:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary:focus-visible,
.btn-outline:focus-visible,
.btn-ghost-danger:focus-visible,
.btn-small:focus-visible,
.btn-danger:focus-visible,
.seg__btn:focus-visible {
  outline: none;
  box-shadow: var(--rb-focus-ring);
}

/* ---------- KPI cards (as on Inventory) ---------- */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
}

.stat-card__top { display: flex; align-items: center; justify-content: space-between; }
.stat-card__label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rb-text-secondary); margin: 0; }
.stat-card__badge { width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-card__badge--primary { background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.stat-card__badge--purple { background: rgba(var(--rb-purple-rgb), 0.08); color: var(--rb-purple-text); }
.stat-card__badge--success { background: rgba(var(--rb-success-rgb), 0.08); color: var(--rb-success-text); }
.stat-card__value { font-size: 24px; font-weight: 800; color: var(--rb-text-primary); margin: 0; line-height: 1; font-variant-numeric: tabular-nums; }
.stat-chip { display: inline-flex; align-items: center; align-self: flex-start; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

/* ---------- Panel ---------- */
.panel {
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--rb-border);
}

.panel-title { font-weight: 700; font-size: 14px; color: var(--rb-text-primary); margin: 0; }
.panel-subtitle { font-size: 12px; color: var(--rb-text-secondary); margin: 3px 0 0; }

/* Segmented view switch */
.seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
}

.seg__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.seg__btn:hover { color: var(--rb-text-primary); }

.seg__btn--on {
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.08);
}

.seg__count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--rb-border);
  font-size: 11px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.seg__btn--on .seg__count { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }

/* ---------- Drive rows ---------- */
.drive-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.drive {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 220px 150px;
  align-items: center;
  gap: 20px;
  padding: 16px 18px;
  transition: background 0.15s ease;
}

.drive + .drive { border-top: 1px solid var(--rb-border); }
.drive:hover { background: var(--rb-surface-hover); }

.drive__date {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 64px;
  padding: 6px 0 8px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 12px;
  background: var(--rb-surface);
  overflow: hidden;
}

.drive__month {
  align-self: stretch;
  margin: -6px 0 4px;
  padding: 3px 0;
  background: var(--rb-primary);
  color: #fff;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-align: center;
}

.drive__day {
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  color: var(--rb-text-primary);
  font-variant-numeric: tabular-nums;
}

.drive__weekday {
  margin-top: 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--rb-text-secondary);
}

.drive--today .drive__month { background: var(--rb-success); }
.drive--done .drive__month { background: var(--rb-text-muted); }
.drive--done .drive__title,
.drive--done .drive__day { color: var(--rb-text-secondary); }

.drive__body { min-width: 0; }

.drive__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drive__title {
  margin: 0;
  font-size: 14.5px;
  font-weight: 700;
  color: var(--rb-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.drive__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 6px 0 0;
}

.drive__fact {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}

.drive__note {
  margin: 8px 0 0;
  padding-left: 10px;
  border-left: 2px solid var(--rb-border-strong);
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--rb-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.status-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  flex-shrink: 0;
  white-space: nowrap;
}

.status-badge--upcoming { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.status-badge--open { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.status-badge--full { background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); }
.status-badge--completed { background: var(--rb-surface-alt); color: var(--rb-text-secondary); border: 1px solid var(--rb-border); }

/* Registrations */
.drive__fill-head {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--rb-text-secondary);
}

.drive__fill-head strong {
  font-size: 16px;
  font-weight: 800;
  color: var(--rb-text-primary);
  font-variant-numeric: tabular-nums;
}

.progress-track {
  height: 6px;
  border-radius: 999px;
  background: var(--rb-border-strong);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
}

.progress-fill--open { background: var(--rb-success); }
.progress-fill--busy { background: var(--rb-warning); }
.progress-fill--full { background: var(--rb-accent); }

.drive__fill-foot {
  margin: 5px 0 0;
  font-size: 11.5px;
  color: var(--rb-text-secondary);
  font-variant-numeric: tabular-nums;
}

.drive__actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

/* ---------- Empty states ---------- */
.empty-state {
  padding: 48px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.empty-state__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-bottom: 6px;
  border-radius: 12px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
  color: var(--rb-text-secondary);
}

.empty-state__icon--error { color: var(--rb-accent-text); }
.empty-state__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.empty-state__text { margin: 0 0 8px; max-width: 44ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

/* ---------- Modal ---------- */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--rb-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}

.modal-card {
  background: var(--rb-surface);
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 28px rgba(var(--rb-shadow-rgb), 0.28);
}

.modal-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--rb-border);
}

.modal-card__title { font-size: 16px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.modal-card__subtitle { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }

.modal-card__close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--rb-text-secondary);
  padding: 4px;
  display: flex;
  border-radius: 8px;
}

.modal-card__close:hover { color: var(--rb-text-primary); background: var(--rb-surface-hover); }

.modal-form {
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-text-primary);
}

.form-hint { margin: 0; font-size: 12px; color: var(--rb-text-secondary); }

/* "Not connected yet": calm, not an error. */
.form-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--rb-text-secondary);
}

.form-notice :deep(svg) { flex-shrink: 0; margin-top: 1px; }

.cancel-impact {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.25);
  background: rgba(var(--rb-accent-rgb), 0.05);
  color: var(--rb-accent-text);
}

.cancel-impact p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--rb-text-primary);
}

.cancel-impact :deep(svg) { flex-shrink: 0; margin-top: 2px; }

.modal-card--narrow { max-width: 440px; }

.form-optional { margin-left: 4px; font-weight: 500; color: var(--rb-text-secondary); }

.form-error {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 8px;
  background: rgba(var(--rb-accent-rgb), 0.08);
  color: var(--rb-accent-text);
  font-size: 13px;
  line-height: 1.45;
}

/*
 * Anchored on the page root on purpose. Several other portals ship
 * `:global(.dark .form-input) { … }` — an unscoped rule at (0,2,0) that ties
 * with a plain scoped `.form-input[data-v-...]`, so which one won came down to
 * chunk load order. The page-root ancestor takes these to (0,3,0) and settles
 * it, without this page having to hardcode a dark palette of its own.
 */
.drives-page .form-input,
.drives-page .form-textarea {
  width: 100%;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 13px;
  color: var(--rb-text-primary);
  background: var(--rb-surface);
  font-family: inherit;
  transition: border-color 0.15s ease;
}

.drives-page .form-input:focus,
.drives-page .form-textarea:focus {
  outline: none;
  border-color: var(--rb-primary);
  box-shadow: var(--rb-focus-ring);
}

.drives-page .form-input::placeholder,
.drives-page .form-textarea::placeholder {
  color: var(--rb-placeholder);
}

.drives-page .form-textarea {
  resize: vertical;
  min-height: 72px;
}

.stepper {
  position: relative;
  display: flex;
  align-items: center;
}

.stepper__input {
  padding-right: 32px;
  -moz-appearance: textfield;
  appearance: textfield;
}

.stepper__input::-webkit-inner-spin-button,
.stepper__input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
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
  color: var(--rb-text-secondary);
  padding: 1px 6px;
  display: flex;
}

.stepper__btn:hover { color: var(--rb-primary-text); }

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none !important; }
}
</style>
