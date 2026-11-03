<template>
  <div class="drives-page">
    <div class="drives-inner">
      <!-- Header -->
      <PageHeader title="Donation Drives">
        <template #actions>
          <button type="button" class="ui-btn ui-btn--primary" @click="openCreateModal">
            <AssetIcon name="plus" :size="15" />
            Create drive
          </button>
        </template>
      </PageHeader>

      <!-- Figures, as on Inventory -->
      <StatStrip :columns="3">
        <StatItem :loading="loading" label="Upcoming drives" :value="upcomingDrivesCount" :hint="nextDriveLabel" icon="calendar" tone="primary" />
        <StatItem :loading="loading" label="Booked donors" :value="totalRegistered" hint="Across upcoming drives" icon="users" tone="purple" />
        <StatItem :loading="loading" label="Units collected" :value="unitsCollectedMonth" hint="At drives this month" icon="droplets" tone="success" />
      </StatStrip>

      <!-- Drive list -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Drives</h2>
          </div>

          <div class="seg" role="tablist" aria-label="Show drives">
            <button
              v-for="tab in DRIVE_TABS"
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

        <SkeletonList v-if="loading" class="drives-skeleton" :rows="5" />
        <div v-else-if="loadError" class="empty-state" role="alert">
          <span class="empty-state__icon empty-state__icon--error"><AssetIcon name="circle-alert" :size="20" /></span>
          <p class="empty-state__title">Could not load the drives</p>
          <p class="empty-state__text">{{ loadError }}</p>
          <button type="button" class="ui-btn" @click="loadDrives">Try again</button>
        </div>

        <div v-else-if="!drives.length" class="empty-state">
          <span class="empty-state__icon"><AssetIcon name="truck" :size="20" /></span>
          <p class="empty-state__title">No drives yet</p>
          <p class="empty-state__text">Schedule a drive and donors can register for it in the donor portal.</p>
          <button type="button" class="ui-btn ui-btn--primary" @click="openCreateModal">
            <AssetIcon name="plus" :size="15" />
            Create drive
          </button>
        </div>

        <div v-else-if="!visibleDrives.length" class="empty-state">
          <span class="empty-state__icon"><AssetIcon name="calendar" :size="20" /></span>
          <p class="empty-state__title">{{ EMPTY_TAB[view].title }}</p>
          <p class="empty-state__text">{{ EMPTY_TAB[view].text }}</p>
        </div>

        <p v-if="actionError" class="form-error list-error" role="alert">{{ actionError }}</p>

        <ul v-if="visibleDrives.length && !loadError" class="drive-list">
          <li
            v-for="drive in visibleDrives"
            :key="drive.id"
            class="drive"
            :class="{ 'drive--done': drive.status === 'Completed' || drive.status === 'Cancelled', 'drive--today': drive.status === 'Open' }"
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
                  {{ driveStatusLabel(drive) }}
                </span>
                <span v-if="registrationClosed(drive)" class="status-badge status-badge--closed">Registration closed</span>
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
                <span v-if="drive.expected_participants" class="drive__fact">
                  <AssetIcon name="clipboard-list" :size="13" />
                  Expected {{ drive.expected_participants }}
                </span>
              </p>

              <p v-if="drive.status === 'Cancelled'" class="drive__note drive__note--cancelled">
                Cancelled{{ drive.cancellation_reason ? `: ${drive.cancellation_reason}` : '' }}
              </p>
              <p v-else-if="drive.announcement" class="drive__note">{{ drive.announcement }}</p>
            </div>

            <!-- Registrations against capacity -->
            <div class="drive__fill">
              <p class="drive__fill-head">
                <strong>{{ drive.registered_count ?? 0 }}</strong>
                <span>{{ drive.capacity ? `of ${drive.capacity} booked` : 'booked' }}</span>
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

            <!-- What the drive's state allows (utils/drives driveActions); the server decides. -->
            <div class="drive__actions">
              <button
                v-if="driveActions(drive).publish"
                type="button"
                class="ui-btn ui-btn--sm ui-btn--primary"
                @click="openPublishDialog(drive)"
              >
                Publish
              </button>
              <button
                v-if="driveActions(drive).closeRegistration"
                type="button"
                class="ui-btn ui-btn--sm"
                :disabled="busyId === drive.id"
                @click="setRegistration(drive, false)"
              >
                Close registration
              </button>
              <button
                v-if="driveActions(drive).reopenRegistration"
                type="button"
                class="ui-btn ui-btn--sm"
                :disabled="busyId === drive.id"
                @click="setRegistration(drive, true)"
              >
                Reopen registration
              </button>
              <button v-if="driveActions(drive).edit" type="button" class="ui-btn ui-btn--sm" @click="openEditModal(drive)">
                <AssetIcon name="pencil" :size="13" />
                Edit
              </button>
              <button
                v-if="driveActions(drive).cancel"
                type="button"
                class="ui-btn ui-btn--sm ui-btn--ghost btn-ghost-danger"
                @click="openCancelDialog(drive)"
              >
                Cancel
              </button>
              <!-- A drive held on paper: type its records in once they are back. -->
              <NuxtLink
                v-if="canRecordPaper && (drive.status === 'Completed' || drive.status === 'Open')"
                :to="`/blood-center/paper-records?drive=${drive.id}`"
                class="btn-small"
              >
                <AssetIcon name="file-text" :size="13" />
                Enter paper records
              </NuxtLink>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- Create drive modal -->
    <Transition name="modal">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreateModal">
        <div v-focus-trap class="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-drive-title" @dialog-escape="closeCreateModal">
          <div class="modal-card__header">
            <div>
              <h2 id="create-drive-title" class="modal-card__title">{{ editingDrive ? 'Edit drive' : 'Create drive' }}</h2>
            </div>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeCreateModal">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <form class="modal-form" @submit.prevent="handleCreateDrive">
            <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

            <div class="form-group">
              <label class="form-label" for="drive-name">Drive name</label>
              <input id="drive-name" v-model="driveForm.name" type="text" class="form-input" placeholder="e.g. UM Matina Bloodletting Drive" maxlength="150" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="drive-venue">Venue</label>
              <input id="drive-venue" v-model="driveForm.location" type="text" class="form-input" placeholder="Venue name and address" maxlength="150" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="drive-date">Date</label>
              <DatePicker id="drive-date" v-model="driveForm.event_date" :min="todayIso" :disabled="scheduleLocked" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="drive-start">Starts</label>
                <input id="drive-start" v-model="driveForm.start_time" type="time" class="form-input" required :disabled="scheduleLocked">
              </div>
              <div class="form-group">
                <label class="form-label" for="drive-end">Ends</label>
                <input id="drive-end" v-model="driveForm.end_time" type="time" class="form-input" required :disabled="scheduleLocked">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="drive-expected">Expected participants <span class="form-optional">optional</span></label>
                <input id="drive-expected" v-model="driveForm.expected_participants" type="number" min="1" inputmode="numeric" class="form-input" placeholder="e.g. 120">
              </div>
              <div class="form-group">
                <label class="form-label" for="drive-capacity">Registration capacity <span class="form-optional">optional</span></label>
                <input
                  id="drive-capacity"
                  v-model="driveForm.max_capacity"
                  type="number"
                  :min="editingDrive?.registered_count || 1"
                  inputmode="numeric"
                  class="form-input"
                  placeholder="No limit"
                >
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

            <label v-if="!editingDrive" class="form-check">
              <input v-model="driveForm.publish" type="checkbox">
              <span>Publish to donors now</span>
            </label>

            <div class="modal-actions">
              <button type="button" class="ui-btn" @click="closeCreateModal">Discard</button>
              <button type="submit" class="ui-btn ui-btn--primary" :disabled="submitting">
                {{ submitLabel }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- Cancel drive -->
    <Transition name="modal">
      <div v-if="cancelTarget" class="modal-overlay" @click.self="closeCancelDialog">
        <div
          v-focus-trap
          class="modal-card modal-card--narrow"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="cancel-drive-title"
          @dialog-escape="closeCancelDialog"
        >
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
            <p v-if="cancelError" class="form-error" role="alert">{{ cancelError }}</p>

            <div class="cancel-impact">
              <AssetIcon name="circle-alert" :size="16" />
              <p>
                <strong>{{ bookedLabel(cancelTarget.registered_count) }}</strong>
                booked. Their bookings are cancelled with the drive, and each donor is notified with the reason.
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
            </div>

            <div class="modal-actions">
              <button type="button" class="ui-btn" @click="closeCancelDialog">Keep drive</button>
              <button
                type="button"
                class="ui-btn ui-btn--danger"
                :disabled="cancelling || !cancelReason.trim()"
                @click="confirmCancel"
              >
                {{ cancelling ? 'Cancelling…' : 'Cancel drive' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Publish drive -->
    <Transition name="modal">
      <div v-if="publishTarget" class="modal-overlay" @click.self="closePublishDialog">
        <div
          v-focus-trap
          class="modal-card modal-card--narrow"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="publish-drive-title"
          @dialog-escape="closePublishDialog"
        >
          <div class="modal-card__header">
            <div>
              <h2 id="publish-drive-title" class="modal-card__title">Publish this drive?</h2>
              <p class="modal-card__subtitle">
                {{ publishTarget.name }} &middot; {{ dateParts(publishTarget.event_date).weekday }},
                {{ dateParts(publishTarget.event_date).month }} {{ dateParts(publishTarget.event_date).day }}
              </p>
            </div>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closePublishDialog">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <div class="modal-form">
            <p v-if="publishError" class="form-error" role="alert">{{ publishError }}</p>

            <p class="form-notice">
              <AssetIcon name="info" :size="14" />
              <span>Donors see it in the portal and can book it, and the centre's donors are notified.</span>
            </p>

            <div class="modal-actions">
              <button type="button" class="ui-btn" @click="closePublishDialog">Not yet</button>
              <button type="button" class="ui-btn ui-btn--primary" :disabled="publishing" @click="confirmPublish">
                {{ publishing ? 'Publishing…' : 'Publish' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import SkeletonList from '~/components/ui/SkeletonList.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted } from 'vue'

import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import DatePicker from '~/components/common/DatePicker.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import StatStrip from '~/components/ui/StatStrip.vue'
import StatItem from '~/components/ui/StatItem.vue'
import {
  DRIVE_TABS,
  blankDriveForm,
  driveActions,
  driveFormFrom,
  drivePayload,
  driveStatusLabel,
  driveTab,
  drivesFor,
  registrationClosed,
} from '~/utils/drives'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'drives.manage',
})

const { can } = useUser()
const canRecordPaper = computed(() => can('donations.record_paper'))

const loading = ref(true)
const submitting = ref(false)
const showCreateModal = ref(false)
const loadError = ref('')
// A row action (registration open/close) that failed, shown above the list.
const actionError = ref('')
// The drive whose row action is in flight.
const busyId = ref(null)

// Ang mga key dinhi kay pareho gyud sa mga column sa `mobile_events`, dili ang
// UI labels ('venue', 'capacity'). Usa ra ka vocabulary sa tibuok wire, so
// walay translation layer nga pwede mag-drift sa server.
const driveForm = reactive(blankDriveForm())

const formError = ref('')

const todayIso = computed(() => new Date().toISOString().slice(0, 10))

function resetDriveForm() {
  Object.assign(driveForm, blankDriveForm())
  formError.value = ''
}

// The drive being edited, or null when the modal creates one.
const editingDrive = ref(null)

// Naay naka-book: ang petsa ug oras dili na mausab (server: drive_schedule_locked).
const scheduleLocked = computed(() => Boolean(editingDrive.value) && driveActions(editingDrive.value).scheduleLocked)

const submitLabel = computed(() => {
  if (editingDrive.value) return submitting.value ? 'Saving…' : 'Save changes'
  if (submitting.value) return 'Creating…'
  return driveForm.publish ? 'Create and publish' : 'Save as draft'
})

function openCreateModal() {
  editingDrive.value = null
  resetDriveForm()
  showCreateModal.value = true
}

/** The same form, filled with the drive's current values. */
function openEditModal(drive) {
  editingDrive.value = drive
  formError.value = ''
  Object.assign(driveForm, driveFormFrom(drive))
  showCreateModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
  editingDrive.value = null
  resetDriveForm()
}

async function handleCreateDrive() {
  if (!driveForm.event_date) {
    formError.value = 'Choose the date of the drive.'
    return
  }

  submitting.value = true
  formError.value = ''
  try {
    // Ang facility_id ug created_by kay gikan sa token, dili sa payload.
    if (editingDrive.value) {
      await bloodCenterService.updateDrive(editingDrive.value.id, drivePayload(driveForm, false))
    } else {
      await bloodCenterService.createDrive(drivePayload(driveForm, true))
      view.value = 'upcoming'
    }
    closeCreateModal()
    // Reload, so the headline figures follow the change too.
    await loadDrives()
  } catch (err) {
    // Ang BaseService nagbutang sa message sa server sa `err.message` ug sa
    // per-field nga 422 sa `err.errors`. Ipakita gyud — kaniadto console ra ni,
    // mao nga ang "Save Changes" morag walay gibuhat.
    formError.value = firstFieldError(err) || err?.message || 'Could not save this drive. Please try again.'
  } finally {
    submitting.value = false
  }
}

// Cancel dialog
const cancelTarget = ref(null)
const cancelReason = ref('')
const cancelError = ref('')
const cancelling = ref(false)

function openCancelDialog(drive) {
  cancelTarget.value = drive
  cancelReason.value = ''
  cancelError.value = ''
}

function closeCancelDialog() {
  if (cancelling.value) return
  cancelTarget.value = null
  cancelReason.value = ''
  cancelError.value = ''
}

async function confirmCancel() {
  if (!cancelTarget.value || !cancelReason.value.trim()) return
  cancelling.value = true
  cancelError.value = ''
  try {
    await bloodCenterService.cancelDrive(cancelTarget.value.id, cancelReason.value.trim())
    cancelling.value = false
    closeCancelDialog()
    await loadDrives()
  } catch (err) {
    // E.g. 409 drive_in_progress: someone is already checked in at the drive.
    cancelError.value = firstFieldError(err) || err?.message || 'Could not cancel this drive. Please try again.'
  } finally {
    cancelling.value = false
  }
}

// Publish dialog: publishing tells the centre's donors, so it is asked first.
const publishTarget = ref(null)
const publishError = ref('')
const publishing = ref(false)

function openPublishDialog(drive) {
  publishTarget.value = drive
  publishError.value = ''
}

function closePublishDialog() {
  if (publishing.value) return
  publishTarget.value = null
  publishError.value = ''
}

async function confirmPublish() {
  if (!publishTarget.value) return
  publishing.value = true
  publishError.value = ''
  try {
    await bloodCenterService.publishDrive(publishTarget.value.id)
    publishing.value = false
    closePublishDialog()
    await loadDrives()
  } catch (err) {
    publishError.value = err?.message || 'Could not publish this drive. Please try again.'
  } finally {
    publishing.value = false
  }
}

/** Close or reopen registration. The bookings already held stand either way. */
async function setRegistration(drive, open) {
  busyId.value = drive.id
  actionError.value = ''
  try {
    await bloodCenterService.setDriveRegistration(drive.id, open)
    await loadDrives()
  } catch (err) {
    actionError.value = err?.message || 'Could not change registration for this drive. Please try again.'
  } finally {
    busyId.value = null
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

/** "1 donor is" / "3 donors are", for the booked count. */
function bookedLabel(count) {
  const n = count ?? 0
  return n === 1 ? '1 donor is' : `${n} donors are`
}

// All values start empty/zero — populated only from the API response.
const upcomingDrivesCount = ref(0)
const totalRegistered = ref(0)
const unitsCollectedMonth = ref(0)
const drives = ref([])
// drive shape: {
//   id, name, facility_name, location, event_date, start_time, end_time,
//   capacity (hard limit, null = none), expected_participants (estimate),
//   registered_count (active bookings), assigned_staff, announcement,
//   status: 'Draft' | 'Upcoming' | 'Open' | 'Full' | 'Completed' | 'Cancelled',
//   published_at, registration_open, registration_closed_at,
//   cancelled_at, cancellation_reason,
//   donor_preview: []   // always empty for now: no endpoint lists a drive's donors
// }

/* ---------- display: which drives, and how each reads ---------- */

const view = ref('upcoming')

const EMPTY_TAB = {
  upcoming: { title: 'No upcoming drives', text: 'Create one to open registrations for donors.' },
  completed: { title: 'No completed drives', text: 'Drives move here once their date has passed.' },
  cancelled: { title: 'No cancelled drives', text: 'Cancelled drives are kept here.' },
  all: { title: 'No drives', text: '' },
}

function countFor(value) {
  if (value === 'all') return drives.value.length
  return drives.value.filter((d) => driveTab(d) === value).length
}

const visibleDrives = computed(() => drivesFor(drives.value, view.value))

const nextDrive = computed(() => drivesFor(drives.value, 'upcoming')[0])

const nextDriveLabel = computed(() => {
  if (!nextDrive.value) return 'None scheduled'
  const { month, day } = dateParts(nextDrive.value.event_date)
  return `Next on ${month.charAt(0)}${month.slice(1).toLowerCase()} ${day}`
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
    // GET /api/blood-center/drives — facility-scoped, apil ang mga nahuman ug na-cancel.
    // { upcoming_drives_count, total_registered, units_collected_month (drives only), drives: [...] }
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
a.btn-small { text-decoration: none; }

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
  grid-template-columns: 64px minmax(0, 1fr) 220px minmax(150px, 250px);
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
.status-badge--draft { background: transparent; color: var(--rb-text-secondary); border: 1px dashed var(--rb-border-strong); }
.status-badge--cancelled { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); }
.status-badge--closed { background: rgba(var(--rb-warning-rgb), 0.12); color: var(--rb-warning-text); }

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
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.drive__note--cancelled {
  border-left-color: rgba(var(--rb-accent-rgb), 0.5);
  color: var(--rb-accent-text);
}

.list-error { margin: 12px 18px 0; }

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


/* A calm note (what publishing does), not an error. */
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

.drives-page .form-input:disabled {
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
  cursor: not-allowed;
}

.form-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-primary);
  cursor: pointer;
}

.form-check input { width: 16px; height: 16px; accent-color: var(--rb-primary); }

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
.drives-skeleton { padding: 16px 20px; }
</style>
