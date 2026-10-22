<template>
  <div class="appointments-page">
    <div v-if="initialLoading" class="appointments-inner" aria-busy="true" aria-label="Loading appointments">
      <div class="skeleton-head">
        <div class="skeleton skeleton--header" />
        <div class="skeleton skeleton--sub" />
      </div>
      <div class="skeleton skeleton--panel" />
    </div>

    <div v-else class="appointments-inner">
      <header class="header-row">
        <div>
          <h1 class="page-title">Appointments</h1>
          <p class="page-subtitle">{{ listSummary }}</p>
        </div>
      </header>

      <div v-if="loadError" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ loadError }}</p>
        <button type="button" class="btn-link" @click="load(pager.page)">Retry</button>
      </div>

      <div v-if="notice" class="banner" :class="`banner--${notice.tone}`" role="status">
        <AssetIcon :name="notice.tone === 'error' ? 'circle-alert' : 'circle-check-big'" :size="16" />
        <p class="banner__text">{{ notice.text }}</p>
        <button type="button" class="btn-link" @click="notice = null">Dismiss</button>
      </div>

      <section class="panel">
        <div class="toolbar">
          <div class="toolbar__filters">
            <label class="search">
              <AssetIcon name="search" :size="15" class="search__icon" />
              <input
                v-model="search"
                type="search"
                class="search__input"
                placeholder="Search donor / drive…"
                aria-label="Search by donor, drive or appointment ID"
                @input="onSearchInput"
              >
            </label>
            <DateRangeFilter v-model:from="fromDate" v-model:to="toDate" @change="load()" />
            <SelectField v-model="statusFilter" class="sel-filter" size="sm" aria-label="Filter by status"
              :options="[{ value: '', label: 'All statuses' }, ...APPOINTMENT_STATUSES]" @change="load()" />
          </div>

          <div class="toolbar__actions">
            <span v-if="updatedAt" class="updated">
              <AssetIcon name="clock" :size="13" />
              Updated {{ updatedAtLabel }}
            </span>
            <button type="button" class="btn-outline" :disabled="exporting || !pager.total" @click="exportList">
              <AssetIcon name="download" :size="14" />
              {{ exporting ? 'Exporting…' : 'Export' }}
            </button>
            <button type="button" class="btn-outline" :disabled="loading" @click="load(pager.page)">
              <AssetIcon name="refresh-cw" :size="14" :class="{ spin: loading }" />
              Refresh
            </button>
            <button v-if="canManage" type="button" class="btn-primary" @click="openBooking">
              <AssetIcon name="plus" :size="15" />
              New Appointment
            </button>
          </div>
        </div>

        <div class="table-wrap" :class="{ 'table-wrap--busy': loading && rows.length }">
          <table class="appt-table">
            <caption class="sr-only">Appointments at this centre and its drives</caption>
            <thead>
              <tr>
                <th scope="col" class="c-id">ID</th>
                <th scope="col" class="c-donor">Donor</th>
                <th scope="col" class="c-date">Date</th>
                <th scope="col" class="c-slot">Slot</th>
                <th scope="col" class="c-place">Drive / Center</th>
                <th scope="col" class="c-status">Status</th>
                <th scope="col" class="c-actions">Actions</th>
              </tr>
            </thead>

            <tbody v-if="loading && !rows.length">
              <tr v-for="n in 6" :key="'sk-' + n">
                <td colspan="7"><span class="skeleton skeleton--line" /></td>
              </tr>
            </tbody>

            <tbody v-else-if="!rows.length">
              <tr>
                <td colspan="7" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-state__icon"><AssetIcon :name="hasFilters ? 'search-x' : 'calendar'" :size="20" /></span>
                    <p class="empty-state__title">{{ hasFilters ? 'No appointments match' : 'No appointments yet' }}</p>
                    <p class="empty-state__text">
                      {{ hasFilters
                        ? 'Try another donor or drive, or widen the dates.'
                        : 'Bookings donors make in the portal, and ones the desk takes by phone, appear here.' }}
                    </p>
                    <button v-if="hasFilters" type="button" class="btn-outline" @click="clearFilters">Clear filters</button>
                    <button v-else-if="canManage" type="button" class="btn-primary" @click="openBooking">
                      <AssetIcon name="plus" :size="15" />
                      New Appointment
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr v-for="row in rows" :key="row.id" class="appt-row" :class="{ 'appt-row--today': row.date === todayIso }">
                <td class="c-id"><span class="code">{{ row.code }}</span></td>
                <td class="c-donor">
                  <div class="donor">
                    <span class="donor__name">{{ row.donor?.full_name || 'Unknown donor' }}</span>
                    <span v-if="row.donor?.blood_type" class="blood">{{ row.donor.blood_type }}</span>
                  </div>
                  <span v-if="row.booked_by" class="sub" :title="row.notes || undefined">
                    Booked by {{ row.booked_by }}<template v-if="row.notes"> · has a note</template>
                  </span>
                </td>
                <td class="c-date nowrap">{{ formatShortDate(row.date) }}</td>
                <td class="c-slot nowrap">{{ row.slot_start }} - {{ row.slot_end }}</td>
                <td class="c-place">{{ row.place }}</td>
                <td class="c-status">
                  <span class="badge" :class="`badge--${appointmentTone(row.status, row.status_label)}`">
                    <span class="badge__dot" aria-hidden="true" />
                    {{ row.status_label }}
                  </span>
                </td>
                <td class="c-actions">
                  <!-- A scheduled row always shows its four actions, as the
                       mock-up does; one that does not apply yet is greyed out
                       and says why. The server's `can` decides which. -->
                  <div class="row-actions">
                    <button
                      v-if="canVerify && (row.status === 'scheduled' || row.status === 'confirmed')"
                      type="button"
                      class="icon-btn"
                      :disabled="busyId === row.id || !row.can.collect"
                      :aria-label="`Mark ${row.donor?.full_name} as collected`"
                      :title="collectHint(row)"
                      @click="markCollected(row)"
                    >
                      <AssetIcon name="check" :size="15" />
                    </button>
                    <NuxtLink
                      v-if="row.can.open_counter && canOpenCounter"
                      to="/blood-center/donation"
                      class="icon-btn"
                      :aria-label="`Open the donation counter for ${row.donor?.full_name}`"
                      title="In progress: open the donation counter"
                    >
                      <AssetIcon name="arrow-right" :size="15" />
                    </NuxtLink>
                    <button
                      v-if="canVerify && (row.status === 'scheduled' || row.status === 'confirmed')"
                      type="button"
                      class="icon-btn"
                      :disabled="busyId === row.id || !row.can.no_show"
                      :aria-label="`Mark ${row.donor?.full_name} as a no-show`"
                      :title="row.can.no_show ? 'Mark no-show' : 'A no-show can be marked from the appointment day'"
                      @click="ask('no_show', row)"
                    >
                      <AssetIcon name="user-x" :size="15" />
                    </button>
                    <button
                      v-if="canManage && row.status === 'scheduled'"
                      type="button"
                      class="icon-btn"
                      :disabled="busyId === row.id || !row.can.cancel"
                      :aria-label="`Cancel ${row.donor?.full_name}'s appointment`"
                      title="Cancel appointment"
                      @click="ask('cancel', row)"
                    >
                      <AssetIcon name="x" :size="15" />
                    </button>
                    <button
                      v-if="canDelete && row.status !== 'confirmed'"
                      type="button"
                      class="icon-btn icon-btn--danger"
                      :disabled="busyId === row.id || !row.can.delete"
                      :aria-label="row.can.delete ? `Delete appointment ${row.code}` : `${row.code} is kept with its donation record`"
                      :title="row.can.delete ? 'Delete appointment' : 'Kept: a visit was recorded against it'"
                      @click="ask('delete', row)"
                    >
                      <AssetIcon name="trash-2" :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer class="pager">
          <span class="pager__info">{{ pager.total }} record(s)</span>
          <div class="pager__btns">
            <button type="button" class="btn-outline btn-outline--sm" :disabled="pager.page <= 1 || loading" @click="load(pager.page - 1)">
              <AssetIcon name="chevron-left" :size="14" />
              Prev
            </button>
            <span class="pager__page">Page {{ pager.page }} / {{ pager.lastPage }}</span>
            <button type="button" class="btn-outline btn-outline--sm" :disabled="pager.page >= pager.lastPage || loading" @click="load(pager.page + 1)">
              Next
              <AssetIcon name="chevron-right" :size="14" />
            </button>
          </div>
        </footer>
      </section>
    </div>

    <!-- ============ CONFIRM ============ -->
    <Transition name="modal">
      <div v-if="confirm.open" class="modal-overlay" @click.self="closeConfirm">
        <div class="modal-card modal-card--sm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
          <div class="modal-card__header">
            <h2 id="confirm-title" class="modal-card__title">
              <AssetIcon name="triangle-alert" :size="17" />
              {{ confirmCopy.title }}
            </h2>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeConfirm">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>
          <div class="modal-card__body">
            <p id="confirm-text" class="modal-text">{{ confirmCopy.text }}</p>
            <p v-if="confirm.error" class="form-error" role="alert">{{ confirm.error }}</p>
          </div>
          <div class="modal-card__footer">
            <button type="button" class="btn-outline" @click="closeConfirm">Back</button>
            <button type="button" class="btn-primary" :class="{ 'btn-primary--danger': confirm.action === 'delete' }" :disabled="confirm.busy" @click="runConfirmed">
              {{ confirm.busy ? 'Working…' : confirmCopy.button }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ============ NEW APPOINTMENT ============ -->
    <Transition name="modal">
      <div v-if="booking.open" class="modal-overlay" @click.self="closeBooking">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="booking-title">
          <div class="modal-card__header">
            <h2 id="booking-title" class="modal-card__title">
              <AssetIcon name="calendar" :size="17" />
              New Appointment
            </h2>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeBooking">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <form id="booking-form" class="modal-card__body modal-form" novalidate @submit.prevent="submitBooking">
            <p class="form-hint">For a donor who phones in. They get the same confirmation as a portal booking.</p>
            <p v-if="booking.error" class="form-error" role="alert">{{ booking.error }}</p>

            <!-- Donor -->
            <div class="form-group">
              <label class="form-label" for="b-donor">Donor <span class="req">*</span></label>
              <div v-if="booking.donor" class="picked">
                <div class="picked__text">
                  <span class="picked__name">{{ booking.donor.name }}</span>
                  <span class="picked__meta">
                    {{ booking.donor.code }}<template v-if="booking.donor.bloodType"> · {{ booking.donor.bloodType }}</template><template v-if="booking.donor.phone"> · {{ booking.donor.phone }}</template>
                  </span>
                  <span v-if="booking.donor.standing" class="badge" :class="`badge--${booking.donor.standing.tone}`">
                    <span class="badge__dot" aria-hidden="true" />
                    {{ booking.donor.standing.key === 'waiting' ? `Can donate ${booking.donor.standing.label.toLowerCase()}` : booking.donor.standing.label }}
                  </span>
                </div>
                <button type="button" class="btn-link" @click="clearDonor">Change</button>
              </div>
              <div v-else class="combo">
                <input
                  id="b-donor"
                  v-model="donorSearch.term"
                  type="search"
                  class="form-input"
                  placeholder="Search donor by name, phone, email or ID…"
                  autocomplete="off"
                  @input="onDonorInput"
                >
                <ul v-if="donorSearch.term.trim().length >= 2" class="combo__list" role="listbox" aria-label="Matching donors">
                  <li v-if="donorSearch.loading" class="combo__note">Searching…</li>
                  <template v-else-if="donorSearch.results.length">
                    <li v-for="d in donorSearch.results" :key="d.uuid">
                      <button type="button" class="combo__option" role="option" @click="pickDonor(d)">
                        <span class="combo__main">{{ d.name }}<span v-if="d.bloodType" class="blood">{{ d.bloodType }}</span></span>
                        <span class="combo__sub">{{ d.code }}<template v-if="d.phone"> · {{ d.phone }}</template><template v-if="d.standing"> · {{ d.standing.label }}</template></span>
                      </button>
                    </li>
                  </template>
                  <li v-else class="combo__note">
                    No donor on your list matches. Try their donor ID, email or mobile number, or
                    <NuxtLink to="/blood-center/donors" class="inline-link">register them as a new donor</NuxtLink> first.
                  </li>
                </ul>
              </div>
              <p v-if="fieldError('donor_uuid')" class="field-error">{{ fieldError('donor_uuid') }}</p>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="b-date">Date <span class="req">*</span></label>
                <DatePicker id="b-date" v-model="booking.date" :min="todayIso" :max="horizonIso"
                  :disabled="Boolean(booking.drive)" @update:model-value="loadSlots" />
                <p v-if="booking.drive" class="form-hint">The drive's date.</p>
                <p v-if="fieldError('date')" class="field-error">{{ fieldError('date') }}</p>
              </div>
              <div class="form-group">
                <label class="form-label" for="b-slot">Time Slot <span class="req">*</span></label>
                <SelectField id="b-slot" v-model="booking.timeSlot"
                  :options="slotChoices.map(slot => ({ value: slot.time, label: slot.label, disabled: slot.disabled }))"
                  :placeholder="booking.loadingSlots ? 'Loading slots…' : (slotChoices.length ? 'Select a time' : 'No slots this day')"
                  :disabled="booking.loadingSlots || !slotChoices.length" />
                <p v-if="fieldError('time_slot')" class="field-error">{{ fieldError('time_slot') }}</p>
              </div>
            </div>

            <!-- Drive: one of this centre's mobile blood drives. -->
            <div class="form-group">
              <label class="form-label" for="b-drive">Drive <span class="form-optional">optional</span></label>
              <div v-if="booking.drive" class="picked">
                <div class="picked__text">
                  <span class="picked__name">{{ booking.drive.name }}</span>
                  <span class="picked__meta">
                    {{ formatShortDate(booking.drive.date) }}<template v-if="booking.drive.start_time"> · {{ booking.drive.start_time }}–{{ booking.drive.end_time }}</template><template v-if="booking.drive.location"> · {{ booking.drive.location }}</template>
                    · {{ booking.drive.registered }}{{ booking.drive.max_capacity ? ` / ${booking.drive.max_capacity}` : '' }} registered
                  </span>
                </div>
                <button type="button" class="btn-link" @click="clearDrive">Use {{ centerName }}</button>
              </div>
              <div v-else class="combo">
                <input
                  id="b-drive"
                  v-model="driveSearch"
                  type="search"
                  class="form-input"
                  :placeholder="`${centerName} (default) - search drive…`"
                  autocomplete="off"
                >
                <ul v-if="driveSearch.trim()" class="combo__list" role="listbox" aria-label="Upcoming drives">
                  <template v-if="driveMatches.length">
                    <li v-for="drive in driveMatches" :key="drive.id">
                      <button type="button" class="combo__option" role="option" @click="pickDrive(drive)">
                        <span class="combo__main">{{ drive.name }}</span>
                        <span class="combo__sub">{{ formatShortDate(drive.date) }}<template v-if="drive.location"> · {{ drive.location }}</template></span>
                      </button>
                    </li>
                  </template>
                  <li v-else class="combo__note">No upcoming drive matches.</li>
                </ul>
              </div>
              <p v-if="fieldError('drive_id')" class="field-error">{{ fieldError('drive_id') }}</p>
            </div>

            <div class="form-group">
              <label class="form-label" for="b-notes">Notes</label>
              <textarea id="b-notes" v-model="booking.notes" class="form-input form-textarea" rows="3" maxlength="1000" placeholder="e.g. Called at 10am; prefers the morning" />
            </div>
          </form>

          <div class="modal-card__footer">
            <button type="button" class="btn-outline" @click="closeBooking">Cancel</button>
            <button type="submit" form="booking-form" class="btn-primary" :disabled="booking.saving || !canSaveBooking">
              <AssetIcon name="check" :size="15" />
              {{ booking.saving ? 'Saving…' : 'Save Appointment' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import DatePicker from '~/components/common/DatePicker.vue'
import SelectField from '~/components/common/SelectField.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import DateRangeFilter from '~/components/common/DateRangeFilter.vue'
import { COLLECTION_ABILITIES } from '~/composables/useBloodCenterNav'
import { APPOINTMENT_STATUSES, appointmentTone, exactIdentifier, isoDaysFromToday, slotOptionLabel } from '~/utils/appointments'
import { eligibilityBadge, formatPhone, formatShortDate } from '~/utils/donorRecords'
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'appointments.view',
})

const { can, user } = useUser()

// The centre's own name, where a booking is not at one of its drives
// (project owner, 2026-10-17). The booking options carry it too.
const servedCenterName = ref('')
const centerName = computed(() => servedCenterName.value || user.value?.facility?.name || 'this centre')
const canManage = computed(() => can('appointments.manage'))
const canDelete = computed(() => can('appointments.delete'))
const canVerify = computed(() => can('appointments.verify'))

// The ✓ marks the booking collected (project owner, 2026-10-17): from the
// appointment day on, a late arrival included; greyed out only before the day.
function collectHint(row) {
  if (row.can.collect) return row.date < todayIso ? 'Mark collected (late arrival)' : 'Mark collected'
  return 'Can be marked collected on the appointment day'
}
const canOpenCounter = computed(() => can(COLLECTION_ABILITIES))

/**
 * API SHAPE (/api/blood-center/appointments)
 * -------------------------------------------------------------------------
 *  GET    /appointments?search=&from=&to=&status=&page=   -> paginator; rows:
 *         { id, code, date, slot_start, slot_end, status, status_label,
 *           place, drive, notes, booked_by, donor: {...}, can: { collect,
 *           no_show, cancel, delete, open_counter } }
 *  GET    /appointments/export?(same filters)             -> CSV
 *  GET    /appointments/options?date=&drive_id=           -> { date, slots, drives }
 *  POST   /appointments  { donor_uuid, date?, time_slot, drive_id?, notes? }
 *  POST   /appointments/{id}/cancel
 *  DELETE /appointments/{id}
 *  POST   /appointments/{id}/collected | /no-show (the ✓; no-show is the counter's)
 * A "drive" is one of this centre's mobile blood drives (MobileEvent).
 * -------------------------------------------------------------------------
 */

const PER_PAGE = 20
const HORIZON_DAYS = 90

const todayIso = isoDaysFromToday(0)
const horizonIso = isoDaysFromToday(HORIZON_DAYS)

const initialLoading = ref(true)
const loading = ref(false)
const loadError = ref('')
const notice = ref(null)
const updatedAt = ref(null)
const rows = ref([])
const pager = reactive({ page: 1, lastPage: 1, total: 0 })

const search = ref('')
const fromDate = ref('')
const toDate = ref('')
const statusFilter = ref('')

const hasFilters = computed(() => Boolean(search.value.trim() || fromDate.value || toDate.value || statusFilter.value))
const updatedAtLabel = computed(() => updatedAt.value?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) ?? '')
const listSummary = computed(() => (hasFilters.value
  ? `${pager.total} appointment${pager.total === 1 ? '' : 's'} match the filters`
  : 'Bookings at this centre and its drives, newest day first.'))

function filterParams() {
  const params = {}
  if (search.value.trim()) params.search = search.value.trim()
  if (fromDate.value) params.from = fromDate.value
  if (toDate.value) params.to = toDate.value
  if (statusFilter.value) params.status = statusFilter.value
  return params
}

function errorMessage(err, fallback) {
  return Object.values(err?.errors ?? err?.data?.errors ?? {}).flat()[0] || err?.message || fallback
}

async function load(page = 1) {
  loading.value = true
  loadError.value = ''
  try {
    const res = await bloodCenterService.staffAppointments({ ...filterParams(), page, per_page: PER_PAGE })
    rows.value = res?.data ?? []
    Object.assign(pager, { page: res?.current_page ?? page, lastPage: Math.max(1, res?.last_page ?? 1), total: res?.total ?? rows.value.length })
    updatedAt.value = new Date()
  } catch (err) {
    loadError.value = errorMessage(err, 'Could not load appointments.')
  } finally {
    loading.value = false
    initialLoading.value = false
  }
}

let searchTimer = null

function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => load(), 300)
}

function clearFilters() {
  search.value = ''
  fromDate.value = ''
  toDate.value = ''
  statusFilter.value = ''
  load()
}

/* ---------- export ---------- */

const exporting = ref(false)

async function exportList() {
  exporting.value = true
  try {
    const blob = await bloodCenterService.exportAppointments(filterParams())
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `appointments-${todayIso}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    notice.value = { tone: 'error', text: 'Could not export the appointments. Please try again.' }
  } finally {
    exporting.value = false
  }
}

/* ---------- row actions ---------- */

const busyId = ref(null)

async function markCollected(row) {
  busyId.value = row.id
  try {
    await bloodCenterService.markAppointmentCollected(row.id)
    notice.value = { tone: 'success', text: `${row.donor?.full_name ?? 'The donor'} is marked as collected.` }
    await load(pager.page)
  } catch (err) {
    notice.value = { tone: 'error', text: errorMessage(err, 'Could not mark this appointment collected.') }
  } finally {
    busyId.value = null
  }
}

const confirm = reactive({ open: false, action: '', row: null, busy: false, error: '' })

const CONFIRM = {
  no_show: { title: 'Mark as no-show?', button: 'Mark no-show', run: (row) => bloodCenterService.markAppointmentNoShow(row.id), done: 'Marked as a no-show.' },
  cancel: { title: 'Cancel this appointment?', button: 'Cancel appointment', run: (row) => bloodCenterService.cancelAppointment(row.id), done: 'Appointment cancelled.' },
  delete: { title: 'Delete this appointment?', button: 'Delete', run: (row) => bloodCenterService.deleteAppointment(row.id), done: 'Appointment deleted.' },
}

const confirmCopy = computed(() => {
  const row = confirm.row
  const who = row?.donor?.full_name ?? 'this donor'
  const when = row ? `${formatShortDate(row.date)} at ${row.slot_start}` : ''
  const base = CONFIRM[confirm.action] ?? CONFIRM.cancel
  const text = {
    no_show: `${who} did not come for ${when}. The slot is freed and the booking is closed.`,
    cancel: `${who}'s appointment on ${when} is cancelled and the slot is freed. Their check-in QR stops working.`,
    delete: `${row?.code} is removed from the list. Use this for a booking entered by mistake; to call one off, cancel it instead.`,
  }[confirm.action] ?? ''
  return { ...base, text }
})

function ask(action, row) {
  Object.assign(confirm, { open: true, action, row, busy: false, error: '' })
}

function closeConfirm() {
  if (confirm.busy) return
  confirm.open = false
}

async function runConfirmed() {
  const { action, row } = confirm
  confirm.busy = true
  confirm.error = ''
  busyId.value = row.id
  try {
    await CONFIRM[action].run(row)
    confirm.busy = false
    confirm.open = false
    notice.value = { tone: 'success', text: CONFIRM[action].done }
    await load(pager.page)
  } catch (err) {
    confirm.error = errorMessage(err, 'That did not work. Please try again.')
    confirm.busy = false
  } finally {
    busyId.value = null
  }
}

/* ---------- new appointment ---------- */

const booking = reactive({
  open: false,
  donor: null,
  date: todayIso,
  timeSlot: '',
  drive: null,
  drives: [],
  slots: [],
  notes: '',
  loadingSlots: false,
  saving: false,
  error: '',
  errors: {},
})

const donorSearch = reactive({ term: '', results: [], loading: false })
const driveSearch = ref('')

const canSaveBooking = computed(() => Boolean(booking.donor && booking.timeSlot && (booking.drive || booking.date)))

function fieldError(field) {
  return booking.errors?.[field]?.[0] ?? ''
}

/** Slots as the picker lists them: full and already-past ones shown, not chosen. */
const slotChoices = computed(() => {
  const now = new Date()
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const day = booking.drive?.date ?? booking.date

  return booking.slots.map((slot) => {
    const past = day === todayIso && slot.time <= nowTime
    const full = slot.available !== null && slot.available !== undefined && slot.available <= 0
    return { ...slot, label: slotOptionLabel(slot, past), disabled: past || full }
  })
})

const driveMatches = computed(() => {
  const term = driveSearch.value.trim().toLowerCase()
  return booking.drives.filter((drive) => !term || drive.name.toLowerCase().includes(term) || (drive.location ?? '').toLowerCase().includes(term)).slice(0, 8)
})

function mapCandidate(row) {
  return {
    uuid: row.uuid,
    name: row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' '),
    code: row.donor_code,
    bloodType: row.blood_type || '',
    phone: formatPhone(row.phone),
    standing: row.eligibility ? eligibilityBadge(row) : null,
  }
}

let donorTimer = null

function onDonorInput() {
  clearTimeout(donorTimer)
  const term = donorSearch.term.trim()
  if (term.length < 2) {
    donorSearch.results = []
    return
  }
  donorSearch.loading = true
  donorTimer = setTimeout(() => findDonors(term), 300)
}

/**
 * The centre's own Donors list first. Failing that, an exact ID, email or
 * mobile number reaches a donor who has only given elsewhere.
 */
async function findDonors(term) {
  try {
    const res = await bloodCenterService.donors({ search: term, per_page: 8 })
    let results = (res?.data ?? []).map(mapCandidate)

    const exact = exactIdentifier(term)
    if (!results.length && exact) {
      try {
        const found = await bloodCenterService.lookupDonor(exact)
        if (found?.uuid) results = [mapCandidate({ ...found, ...(found.donation_summary ?? {}) })]
      } catch {
        // Not found: the empty list says so.
      }
    }

    if (donorSearch.term.trim() === term) donorSearch.results = results
  } catch (err) {
    donorSearch.results = []
    booking.error = errorMessage(err, 'Could not search donors.')
  } finally {
    donorSearch.loading = false
  }
}

function pickDonor(donor) {
  booking.donor = donor
  donorSearch.term = ''
  donorSearch.results = []
  const { donor_uuid: _gone, ...rest } = booking.errors
  booking.errors = rest
}

function clearDonor() {
  booking.donor = null
}

async function loadSlots() {
  booking.loadingSlots = true
  try {
    const params = booking.drive ? { drive_id: booking.drive.id } : { date: booking.date }
    const res = await bloodCenterService.appointmentOptions(params)
    booking.slots = res?.slots ?? []
    booking.drives = res?.drives ?? booking.drives
    if (res?.center_name) servedCenterName.value = res.center_name
    if (!booking.slots.some((s) => s.time === booking.timeSlot)) booking.timeSlot = ''
    if (!booking.timeSlot) booking.timeSlot = slotChoices.value.find((s) => !s.disabled)?.time ?? ''
  } catch (err) {
    booking.slots = []
    booking.error = errorMessage(err, 'Could not load the time slots.')
  } finally {
    booking.loadingSlots = false
  }
}

function pickDrive(drive) {
  booking.drive = drive
  driveSearch.value = ''
  booking.timeSlot = ''
  loadSlots()
}

function clearDrive() {
  booking.drive = null
  booking.timeSlot = ''
  loadSlots()
}

function openBooking() {
  Object.assign(booking, {
    open: true, donor: null, date: todayIso, timeSlot: '', drive: null, slots: [], notes: '',
    loadingSlots: false, saving: false, error: '', errors: {},
  })
  donorSearch.term = ''
  donorSearch.results = []
  driveSearch.value = ''
  loadSlots()
}

function closeBooking() {
  if (booking.saving) return
  booking.open = false
}

async function submitBooking() {
  if (!canSaveBooking.value || booking.saving) return
  booking.saving = true
  booking.error = ''
  booking.errors = {}

  try {
    const payload = {
      donor_uuid: booking.donor.uuid,
      time_slot: booking.timeSlot,
      notes: booking.notes.trim() || null,
      ...(booking.drive ? { drive_id: booking.drive.id } : { date: booking.date }),
    }
    const res = await bloodCenterService.bookAppointment(payload)
    booking.saving = false
    booking.open = false
    notice.value = { tone: 'success', text: res?.message || 'Appointment booked.' }
    await load(1)
  } catch (err) {
    booking.errors = err?.errors ?? err?.data?.errors ?? {}
    booking.error = err?.message || 'Could not book this appointment.'
    // Someone else took the slot meanwhile: show what is left.
    if (err?.data?.code === 'slot_unavailable' || err?.data?.code === 'drive_full') loadSlots()
  } finally {
    booking.saving = false
  }
}

/* ---------- keyboard and lifecycle ---------- */

function onKeydown(event) {
  if (event.key !== 'Escape') return
  if (confirm.open) closeConfirm()
  else if (booking.open) closeBooking()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  load()
})

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  clearTimeout(donorTimer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.appointments-page {
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
}

.appointments-inner { display: flex; flex-direction: column; gap: 16px; }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ---------- Skeletons ---------- */
.skeleton {
  display: block;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}

.skeleton-head { display: flex; flex-direction: column; gap: 8px; }
.skeleton--header { height: 28px; max-width: 220px; border-radius: 8px; }
.skeleton--sub { height: 14px; max-width: 320px; border-radius: 6px; }
.skeleton--panel { height: 480px; }
.skeleton--line { height: 16px; width: 100%; border-radius: 6px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

/* ---------- Header ---------- */
.header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0; color: var(--rb-text-primary); }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 3px 0 0; }

/* ---------- Buttons ---------- */
.btn-primary,
.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.btn-primary { color: #fff; background: var(--rb-primary); border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-primary--danger { background: var(--rb-accent); border-color: var(--rb-accent); }
.btn-primary--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-accent) 88%, #000); }

.btn-outline { color: var(--rb-text-primary); background: var(--rb-surface); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline--sm { height: 30px; padding: 0 10px; font-size: 12px; border-radius: 8px; gap: 4px; }

.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--rb-primary-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn-link:hover { text-decoration: underline; }
.inline-link { color: var(--rb-primary-text); font-weight: 600; }

.btn-primary:focus-visible,
.btn-outline:focus-visible,
.btn-link:focus-visible,
.icon-btn:focus-visible,
.modal-card__close:focus-visible,
.combo__option:focus-visible,
.inline-link:focus-visible {
  outline: none;
  box-shadow: var(--rb-focus-ring);
}

.spin { animation: spin 0.9s linear infinite; }

@keyframes spin { to { transform: rotate(360deg); } }

/* ---------- Banners ---------- */
.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 13px;
}

.banner > :deep(.asset-icon) { flex-shrink: 0; }
.banner__text { flex: 1; margin: 0; line-height: 1.45; color: var(--rb-text-primary); }
.banner--success > :deep(.asset-icon) { color: var(--rb-success-text); }
.banner--error > :deep(.asset-icon) { color: var(--rb-accent-text); }
.banner--error { border-color: rgba(var(--rb-accent-rgb), 0.35); }

/* ---------- Panel and toolbar ---------- */
.panel {
  container-type: inline-size;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  overflow: hidden;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--rb-border);
}

.toolbar__filters,
.toolbar__actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toolbar__filters { flex: 1 1 auto; min-width: 0; }
.toolbar__actions { justify-content: flex-end; margin-left: auto; }

.updated {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: 4px;
  font-size: 12px;
  color: var(--rb-text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* A small basis, so the filters and buttons share one line until the list
   is narrow; the search is what gives way. */
.search { position: relative; flex: 1 1 180px; min-width: 160px; max-width: 280px; }

.search__icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--rb-text-secondary);
  pointer-events: none;
}

.search__input,
.select {
  height: 36px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.search__input { width: 100%; padding: 0 12px 0 34px; }

/* As wide as the chosen option, not the longest one (where supported). */
.select {
  field-sizing: content;
  padding: 0 30px 0 12px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 10px 6px;
  appearance: none;
  cursor: pointer;
}

.search__input::placeholder { color: var(--rb-placeholder); }

.search__input:focus,
.select:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

/* ---------- Table ---------- */
.table-wrap { position: relative; overflow-x: auto; transition: opacity 0.15s ease; }
.table-wrap--busy { opacity: 0.55; }

.appt-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 13px; }

.appt-table thead th {
  padding: 10px;
  background: var(--rb-surface-alt);
  border-bottom: 1px solid var(--rb-border);
  text-align: left;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rb-text-secondary);
  white-space: nowrap;
}

.appt-table tbody td {
  padding: 11px 10px;
  border-bottom: 1px solid var(--rb-border);
  vertical-align: middle;
  color: var(--rb-text-primary);
  overflow: hidden;
}

.appt-table th:first-child,
.appt-table td:first-child { padding-left: 16px; }

.appt-table th:last-child,
.appt-table td:last-child { padding-right: 16px; }

.appt-table tbody tr:last-child td { border-bottom: 0; }
.appt-row { transition: background 0.12s ease; }
.appt-row:hover { background: var(--rb-surface-hover); }

/* Today's bookings carry a marker on the edge, never a filled row. */
.appt-row--today td:first-child { box-shadow: inset 3px 0 0 var(--rb-primary); }

.c-id { width: 128px; }
.c-date { width: 118px; }
.c-slot { width: 118px; }
.c-status { width: 124px; }
.c-actions { width: 180px; }

/* Too narrow for both names: the place goes, the donor stays. */
@container (max-width: 860px) {
  .c-place { display: none; }
}

.code { font-family: var(--rb-font-mono); font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); white-space: nowrap; }
.donor { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.donor__name { font-weight: 700; text-transform: capitalize; overflow-wrap: anywhere; }
.sub { display: block; margin-top: 2px; font-size: 11.5px; color: var(--rb-text-secondary); }
.nowrap { white-space: nowrap; }

.blood {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface-alt);
  color: var(--rb-text-primary);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

/* Status: the colour lives on the dot, never on the badge's fill. */
.badge {
  --tone: var(--rb-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--rb-text-primary);
  white-space: nowrap;
}

.badge__dot { width: 6px; height: 6px; border-radius: 999px; background: var(--tone); flex-shrink: 0; }
.badge--info { --tone: var(--rb-primary); }
.badge--ok { --tone: var(--rb-success); }
.badge--warn { --tone: var(--rb-warning); }
.badge--crit { --tone: var(--rb-accent); }
.badge--neutral { --tone: var(--rb-text-muted); color: var(--rb-text-secondary); }

.row-actions { display: flex; gap: 6px; }

.icon-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
  text-decoration: none;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.icon-btn:hover:not(:disabled) { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.45); background: var(--rb-surface-hover); }
.icon-btn--danger:hover:not(:disabled) { color: var(--rb-accent-text); border-color: rgba(var(--rb-accent-rgb), 0.45); }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.empty-cell { padding: 0 !important; }

.empty-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 24px; text-align: center; }

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

.empty-state__title { margin: 0; font-size: 14px; font-weight: 700; }
.empty-state__text { margin: 0 0 8px; max-width: 46ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

/* ---------- Pager ---------- */
.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  padding: 12px 16px;
  border-top: 1px solid var(--rb-border);
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}

.pager__btns { display: flex; align-items: center; gap: 8px; }
.pager__page { font-variant-numeric: tabular-nums; }

/* ---------- Modals ---------- */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--rb-overlay);
}

.modal-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 600px;
  max-height: calc(100vh - 40px);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(var(--rb-shadow-rgb), 0.28);
}

.modal-card--sm { max-width: 440px; }

.modal-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--rb-border);
  flex-shrink: 0;
}

.modal-card__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15.5px; font-weight: 700; }
.modal-card__title :deep(.asset-icon) { color: var(--rb-text-secondary); }

.modal-card__close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: none;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.modal-card__close:hover { color: var(--rb-text-primary); background: var(--rb-surface-hover); }

.modal-card__body { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; overflow-y: auto; min-height: 0; }

.modal-card__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--rb-border);
  flex-shrink: 0;
}

.modal-text { margin: 0; font-size: 13.5px; line-height: 1.55; }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.form-label { font-size: 12.5px; font-weight: 600; }
.form-optional { margin-left: 4px; font-weight: 500; color: var(--rb-text-secondary); }
.req { color: var(--rb-accent-text); }
.form-hint { margin: 0; font-size: 12px; line-height: 1.45; color: var(--rb-text-secondary); }
.field-error { margin: 0; font-size: 12px; color: var(--rb-accent-text); }

.form-error {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-accent-text);
  font-size: 13px;
  line-height: 1.45;
}

/* Anchored on the page root: other portals ship unscoped dark .form-input rules. */
.appointments-page .form-input {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
  color-scheme: light dark;
}

.appointments-page .form-input:disabled { background-color: var(--rb-surface-alt); color: var(--rb-text-secondary); cursor: not-allowed; }
.appointments-page .form-input::placeholder { color: var(--rb-placeholder); }
.appointments-page .form-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.appointments-page .form-select {
  padding-right: 30px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 10px 6px;
  appearance: none;
  cursor: pointer;
}

.appointments-page .form-textarea { height: auto; min-height: 76px; padding: 10px 12px; line-height: 1.5; resize: vertical; }

/* Search-and-pick for the donor and the drive. */
.combo { position: relative; }

.combo__list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 5;
  max-height: 260px;
  overflow-y: auto;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  box-shadow: 0 10px 24px rgba(var(--rb-shadow-rgb), 0.18);
}

.combo__option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: none;
  text-align: left;
  font-family: inherit;
  color: var(--rb-text-primary);
  cursor: pointer;
}

.combo__option:hover { background: var(--rb-surface-hover); }
.combo__main { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; }
.combo__sub { font-size: 11.5px; color: var(--rb-text-secondary); }
.combo__note { padding: 10px; font-size: 12.5px; line-height: 1.45; color: var(--rb-text-secondary); }

.picked {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface-alt);
}

.picked__text { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 0; }
.picked__name { font-size: 13.5px; font-weight: 700; }
.picked__meta { font-size: 12px; color: var(--rb-text-secondary); overflow-wrap: anywhere; }

.modal-enter-active,
.modal-leave-active { transition: opacity 0.18s ease; }

.modal-enter-from,
.modal-leave-to { opacity: 0; }

@media (max-width: 760px) {
  .toolbar__filters { flex-basis: 100%; }
  .search { max-width: none; flex: 1 1 100%; }
  .toolbar__actions { width: 100%; }
  .form-row { grid-template-columns: 1fr; }
  .modal-overlay { padding: 10px; align-items: flex-end; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .spin { animation: none !important; }
}
</style>

<style scoped>
/* The system dropdown in a toolbar: a fixed width rather than the row's. */
.sel-filter { width: 180px; flex: none; }
</style>
