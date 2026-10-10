<template>
  <div class="rcv-page">
    <div class="rcv-inner">
      <header class="page-header">
        <div>
          <h1 class="page-title">Weekly Request</h1>
          <p class="page-subtitle">
            Your scheduled restock. Send each blood center its weekly request on your request days — the center
            supplies what it can, and whatever it cannot is closed when it dispatches.
          </p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn" :disabled="refreshing" @click="refresh">
            <AssetIcon name="refresh-cw" :size="14" :class="{ 'spin-icon': refreshing }" />
            {{ refreshing ? 'Refreshing…' : 'Refresh' }}
          </button>
          <NuxtLink to="/hospital/receiving/weekly/new" class="btn btn--primary">
            <AssetIcon name="plus" :size="14" />
            New weekly request
          </NuxtLink>
        </div>
      </header>

      <div v-if="statusError" class="banner banner--error" role="alert">
        <AssetIcon name="triangle-alert" :size="16" />
        <span>{{ statusError }}</span>
      </div>

      <!-- ============ TODAY ============ -->
      <section class="panel" aria-labelledby="today-title">
        <div class="panel__head">
          <div>
            <h2 id="today-title" class="panel__title">Today<span v-if="status" class="panel__date"> · {{ formatDay(status.as_of, true) }}</span></h2>
            <p class="panel__hint">Each blood center you restock from, and whether today's weekly request is due.</p>
          </div>
        </div>

        <div v-if="statusLoading" class="list-state" aria-busy="true">
          <div class="skeleton" style="width:60%" />
          <div class="skeleton" style="width:80%" />
        </div>

        <div v-else-if="!schedules.length" class="empty-state">
          <AssetIcon name="calendar" :size="36" />
          <p class="empty-state__title">No request days yet</p>
          <p class="empty-state__desc">
            Add the blood center you restock from and the days you send it your weekly request — Monday, Wednesday and
            Friday, for example. A weekly request can only be sent on those days.
          </p>
        </div>

        <ul v-else class="centres">
          <li v-for="entry in schedules" :key="entry.schedule.id" class="centre" :class="`centre--${stateFor(entry).tone}`">
            <div class="centre__main">
              <div class="centre__name">
                <AssetIcon name="building-2" :size="15" />
                {{ entry.schedule.target_facility?.name || 'Blood center' }}
              </div>
              <p v-if="entry.schedule.target_facility?.address" class="centre__address">{{ entry.schedule.target_facility.address }}</p>

              <div v-if="editing?.id === entry.schedule.target_facility?.id" class="centre__edit">
                <HospitalWeekdayPicker
                  v-model="editing.days"
                  :label="`Request days for ${entry.schedule.target_facility?.name}`"
                  :disabled="savingSchedule"
                />
                <div class="centre__edit-actions">
                  <button type="button" class="btn btn--primary btn--sm" :disabled="savingSchedule || !editing.days.length" @click="saveEdit">
                    {{ savingSchedule ? 'Saving…' : 'Save days' }}
                  </button>
                  <button type="button" class="btn btn--sm" :disabled="savingSchedule" @click="editing = null">Cancel</button>
                  <button
                    type="button"
                    class="btn btn--sm btn--quiet"
                    :disabled="savingSchedule"
                    @click="removeSchedule(entry.schedule.target_facility.id)"
                  >
                    {{ confirmRemove === entry.schedule.target_facility?.id ? 'Remove — are you sure?' : 'Remove center' }}
                  </button>
                </div>
                <p v-if="scheduleError" class="field-error" role="alert">{{ scheduleError }}</p>
              </div>

              <div v-else class="centre__days">
                <span
                  v-for="day in WEEKDAYS"
                  :key="day"
                  class="day-chip"
                  :class="{ 'day-chip--on': entry.schedule.days_of_week.includes(day), 'day-chip--today': day === status.today_weekday }"
                >{{ WEEKDAY_LABELS[day] }}</span>
                <button type="button" class="link-btn" @click="startEdit(entry.schedule)">Edit days</button>
              </div>

              <!-- The last few request days, oldest first, so a run of misses reads left to right. -->
              <div v-if="entry.recent.length" class="recent" :aria-label="`Recent request days for ${entry.schedule.target_facility?.name}`">
                <span
                  v-for="day in [...entry.recent].slice(0, 8).reverse()"
                  :key="day.date"
                  class="recent__day"
                  :class="day.sent ? 'recent__day--sent' : 'recent__day--missed'"
                  :title="`${formatDay(day.date)} — ${day.sent ? `sent (${day.weekly_request?.reference_number})` : 'no request sent'}`"
                >
                  <AssetIcon :name="day.sent ? 'check' : 'x'" :size="11" />
                  {{ formatDay(day.date) }}
                </span>
              </div>
            </div>

            <div class="centre__state">
              <span class="pill" :class="`tone--${stateFor(entry).tone}`">
                <span class="pill__dot" />
                {{ stateFor(entry).label }}
              </span>

              <NuxtLink
                v-if="entry.sent_today"
                :to="`/hospital/receiving/weekly/${entry.sent_today.id}`"
                class="link-btn mono"
              >{{ entry.sent_today.reference_number }}</NuxtLink>

              <NuxtLink
                v-else-if="entry.due_today"
                :to="`/hospital/receiving/weekly/new?target=${entry.schedule.target_facility?.id}`"
                class="btn btn--primary btn--sm"
              >Send today's request</NuxtLink>

              <span v-else-if="entry.next_request_day" class="centre__next">Next: {{ formatDay(entry.next_request_day, true) }}</span>

              <span v-if="entry.missed_count" class="centre__missed">
                {{ entry.missed_count }} request day{{ entry.missed_count === 1 ? '' : 's' }} missed in 4 weeks
              </span>
            </div>
          </li>
        </ul>

        <!-- Add a center -->
        <div class="add-centre">
          <h3 class="add-centre__title">Add a blood center</h3>
          <div class="add-centre__row">
            <select v-model.number="adding.target" class="filter-select" aria-label="Blood center" :disabled="savingSchedule">
              <option :value="null">{{ unscheduled.length ? 'Choose a blood center…' : 'Every eligible center has request days' }}</option>
              <option v-for="facility in unscheduled" :key="facility.id" :value="facility.id">{{ facility.name }}</option>
            </select>
            <HospitalWeekdayPicker v-model="adding.days" label="Request days for the new center" :disabled="savingSchedule" />
            <button
              type="button"
              class="btn"
              :disabled="savingSchedule || !adding.target || !adding.days.length"
              @click="addSchedule"
            >
              {{ savingSchedule && !editing ? 'Saving…' : 'Add center' }}
            </button>
          </div>
          <p v-if="addError" class="field-error" role="alert">{{ addError }}</p>
        </div>
      </section>

      <!-- ============ HISTORY ============ -->
      <section class="panel" aria-labelledby="history-title">
        <div class="panel__head">
          <div>
            <h2 id="history-title" class="panel__title">Weekly requests sent</h2>
            <p class="panel__hint">Newest first. Supplied counts what the center dispatched; not supplied is what it closed.</p>
          </div>
          <div class="search-box">
            <AssetIcon name="search" :size="14" class="search-box__icon" />
            <input v-model="search" type="search" class="search-box__input" placeholder="Search WR or RQ number…" aria-label="Search weekly requests">
          </div>
        </div>

        <div v-if="listLoading" class="list-state" aria-busy="true">
          <div class="skeleton" style="width:70%" />
          <div class="skeleton" style="width:90%" />
        </div>

        <div v-else-if="listError" class="list-state list-state--error" role="alert">
          <p>{{ listError }}</p>
          <button type="button" class="btn" @click="loadList">Try again</button>
        </div>

        <div v-else-if="!weeklyRequests.length" class="empty-state">
          <AssetIcon name="inbox" :size="36" />
          <p class="empty-state__title">{{ search ? 'No weekly request matches' : 'No weekly requests yet' }}</p>
          <p class="empty-state__desc">Weekly requests you send appear here with what each center supplied.</p>
        </div>

        <div v-else class="table-wrap">
          <table class="rcv-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Request day</th>
                <th>Blood center</th>
                <th class="num">Requested</th>
                <th class="num">Supplied</th>
                <th class="num">Received</th>
                <th class="num">Not supplied</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="weekly in weeklyRequests" :key="weekly.id">
                <td>
                  <NuxtLink :to="`/hospital/receiving/weekly/${weekly.id}`" class="link-btn mono">{{ weekly.reference_number }}</NuxtLink>
                  <span class="cell-sub">{{ bloodTypesOf(weekly) }}</span>
                </td>
                <td>{{ formatDay(weekly.request_day, true) }}</td>
                <td>{{ weekly.target_facility?.name || '—' }}</td>
                <td class="num">{{ weekly.totals.requested }}</td>
                <td class="num strong">{{ weekly.totals.fulfilled }}</td>
                <td class="num">
                  {{ weekly.totals.received }}
                  <span v-if="weekly.totals.awaiting_receipt" class="cell-sub cell-sub--alert">{{ weekly.totals.awaiting_receipt }} to receive</span>
                </td>
                <td class="num" :class="{ 'cell--short': weekly.totals.not_supplied }">{{ weekly.totals.not_supplied }}</td>
                <td>
                  <span class="pill" :class="`tone--${WEEKLY_STATUS_TONES[weekly.status] || 'muted'}`">{{ weekly.status_label }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>
  </div>
</template>

<script setup>
/**
 * The weekly request: the blood bank's scheduled restock from each blood center.
 *
 * The blood bank keeps its own request days per center; a weekly request may
 * only be sent on one of them, once a day. This page says, per center, whether
 * today's request is due or sent and which recent request days went without
 * one — all derived by the API — and lists what was sent and what came of it.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import HospitalWeekdayPicker from '~/components/Hospital/WeekdayPicker.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { bloodTypeCodes } from '~/types/bloodRequest'
import { RECEIVING_REFUSAL_MESSAGES, WEEKDAY_LABELS, WEEKDAYS, WEEKLY_STATUS_TONES } from '~/types/receiving'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard' })

const status = ref(null)
const statusLoading = ref(true)
const statusError = ref('')

const facilities = ref([])

const weeklyRequests = ref([])
const listLoading = ref(true)
const listError = ref('')
const search = ref('')
const refreshing = ref(false)

const editing = ref(null)
const confirmRemove = ref(null)
const adding = reactive({ target: null, days: [] })
const savingSchedule = ref(false)
const scheduleError = ref('')
const addError = ref('')

const toast = ref('')
let toastTimer = null
let searchTimer = null
let listSeq = 0

const schedules = computed(() => status.value?.schedules ?? [])

/** Eligible centers the blood bank keeps no request days with yet. */
const unscheduled = computed(() => {
  const scheduled = new Set(schedules.value.map((entry) => entry.schedule.target_facility?.id))

  return facilities.value.filter((facility) => !scheduled.has(facility.id))
})

watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadList, 300)
})

onMounted(() => {
  loadStatus()
  loadFacilities()
  loadList()
})

onUnmounted(() => {
  clearTimeout(toastTimer)
  clearTimeout(searchTimer)
})

async function refresh() {
  refreshing.value = true

  try {
    await Promise.all([loadStatus(), loadList({ quiet: true })])
  } finally {
    refreshing.value = false
  }
}

async function loadStatus() {
  statusError.value = ''

  try {
    status.value = await hospitalService.weeklyStatus()
  } catch (err) {
    statusError.value = err?.message || 'Could not load your request days.'
  } finally {
    statusLoading.value = false
  }
}

async function loadFacilities() {
  try {
    facilities.value = (await hospitalService.eligibleFacilities())?.facilities ?? []
  } catch {
    // Adding a center needs the list; the rest of the page does not.
  }
}

async function loadList({ quiet = false } = {}) {
  const seq = ++listSeq
  listLoading.value = !quiet
  listError.value = ''

  try {
    const response = await hospitalService.weeklyRequests({ search: search.value.trim() || undefined, per_page: 25 })

    if (seq !== listSeq) return
    weeklyRequests.value = response.data ?? []
  } catch (err) {
    if (seq === listSeq) listError.value = err?.message || 'Could not load your weekly requests.'
  } finally {
    if (seq === listSeq) listLoading.value = false
  }
}

/** What to say about one center today. */
function stateFor(entry) {
  if (entry.sent_today) return { label: 'Sent today', tone: 'success' }
  if (entry.due_today) return { label: 'Due today', tone: 'warning' }

  return { label: 'Not a request day', tone: 'muted' }
}

function startEdit(schedule) {
  editing.value = { id: schedule.target_facility?.id, days: [...schedule.days_of_week] }
  confirmRemove.value = null
  scheduleError.value = ''
}

async function saveEdit() {
  if (!editing.value) return

  savingSchedule.value = true
  scheduleError.value = ''

  try {
    const response = await hospitalService.saveReplenishmentSchedule(editing.value.id, editing.value.days)
    editing.value = null
    showToast(response?.message || 'Request days saved.')
    await loadStatus()
  } catch (err) {
    scheduleError.value = firstError(err) || 'Those request days could not be saved.'
  } finally {
    savingSchedule.value = false
  }
}

async function removeSchedule(targetFacilityId) {
  // The first click asks; the second removes.
  if (confirmRemove.value !== targetFacilityId) {
    confirmRemove.value = targetFacilityId
    return
  }

  savingSchedule.value = true
  scheduleError.value = ''

  try {
    const response = await hospitalService.deleteReplenishmentSchedule(targetFacilityId)
    editing.value = null
    confirmRemove.value = null
    showToast(response?.message || 'Request days removed.')
    await loadStatus()
  } catch (err) {
    scheduleError.value = RECEIVING_REFUSAL_MESSAGES[err?.data?.code] || err?.message || 'That center could not be removed.'
  } finally {
    savingSchedule.value = false
  }
}

async function addSchedule() {
  savingSchedule.value = true
  addError.value = ''

  try {
    const response = await hospitalService.saveReplenishmentSchedule(adding.target, adding.days)
    adding.target = null
    adding.days = []
    showToast(response?.message || 'Request days saved.')
    await loadStatus()
  } catch (err) {
    addError.value = firstError(err) || 'Those request days could not be saved.'
  } finally {
    savingSchedule.value = false
  }
}

/** The blood types a weekly request asked for, as one line. Its one request may restock several. */
function bloodTypesOf(weekly) {
  const codes = [...new Set((weekly.requests ?? []).flatMap((request) => bloodTypeCodes(request)))]

  return codes.length ? codes.join(' · ') : '—'
}

function firstError(err) {
  const first = Object.values(err?.errors ?? {})[0]

  return (Array.isArray(first) ? first[0] : first) || err?.message || ''
}

function showToast(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 4000)
}

/** A Y-m-d request day, read as a calendar date: "Mon, Oct 5". */
function formatDay(value, withWeekday = false) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, withWeekday
      ? { weekday: 'short', month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css; nothing is redeclared here. */
.rcv-page { min-height: 100%; background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 20px; }
.rcv-inner { max-width: 1240px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.page-title { font-size: 24px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13.5px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 72ch; }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.banner { display: flex; align-items: center; gap: 8px; margin: 0; padding: 11px 14px; border-radius: 10px; font-size: 13px; }
.banner--error { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), 0.25); }

.panel {
  background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03); overflow: hidden;
}
.panel__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 16px 16px 10px; }
.panel__title { margin: 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
.panel__date { font-weight: 600; color: var(--rb-text-secondary); }
.panel__hint { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }

/* ---------- centers ---------- */
.centres { list-style: none; margin: 0; padding: 0 16px 6px; display: flex; flex-direction: column; gap: 10px; }
.centre {
  display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  padding: 14px; border-radius: 12px; border: 1px solid var(--rb-border);
}
.centre--warning { border-color: rgba(var(--rb-warning-rgb), 0.45); box-shadow: inset 3px 0 0 var(--rb-warning); }
.centre--success { box-shadow: inset 3px 0 0 var(--rb-success); }
.centre__main { display: flex; flex-direction: column; gap: 8px; min-width: 0; flex: 1; }
.centre__name { display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.centre__address { margin: -4px 0 0; font-size: 12px; color: var(--rb-text-secondary); }
.centre__days { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.centre__edit { display: flex; flex-direction: column; gap: 10px; }
.centre__edit-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.centre__state { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; text-align: right; }
.centre__next { font-size: 12.5px; color: var(--rb-text-secondary); }
.centre__missed { font-size: 12px; font-weight: 600; color: var(--rb-accent-text); }

.day-chip {
  min-width: 38px; padding: 3px 0; text-align: center; border-radius: 7px;
  font-size: 11.5px; font-weight: 600; color: var(--rb-text-secondary); background: var(--rb-surface-alt);
}
.day-chip--on { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text); }
.day-chip--today { outline: 1.5px solid var(--rb-text-secondary); outline-offset: 1px; }

.recent { display: flex; gap: 4px; flex-wrap: wrap; }
.recent__day {
  display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 999px;
  font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums;
}
.recent__day--sent { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.recent__day--missed { background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); }

.add-centre { margin: 10px 16px 16px; padding-top: 14px; border-top: 1px dashed var(--rb-border-strong); }
.add-centre__title { margin: 0 0 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rb-text-secondary); }
.add-centre__row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

/* ---------- list ---------- */
.search-box { position: relative; min-width: 220px; max-width: 320px; flex: 1; }
.search-box__icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--rb-text-secondary); pointer-events: none; }
.search-box__input {
  width: 100%; padding: 8px 10px 8px 30px; border-radius: 10px; border: 1px solid var(--rb-border-strong);
  font: inherit; font-size: 12.5px; background: var(--rb-surface-alt); color: var(--rb-text-primary);
}
.search-box__input:focus { outline: none; border-color: var(--rb-primary); background: var(--rb-surface); }
.filter-select {
  padding: 8px 30px 8px 12px; border-radius: 10px; border: 1px solid var(--rb-border-strong); min-width: 220px;
  font: inherit; font-size: 12.5px; color: var(--rb-text-primary); cursor: pointer; appearance: none;
  background: var(--rb-surface-alt) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E") no-repeat right 12px center;
}
.filter-select:focus { outline: none; border-color: var(--rb-primary); }

.list-state { padding: 18px 16px; }
.list-state--error { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--rb-accent-text); font-size: 13px; }

.empty-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 32px 16px; text-align: center; color: var(--rb-border-strong); }
.empty-state__title { margin: 6px 0 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.empty-state__desc { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); max-width: 52ch; }

.table-wrap { overflow-x: auto; }
.rcv-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rcv-table thead th {
  text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--rb-text-secondary); padding: 10px 14px; background: var(--rb-surface-alt); white-space: nowrap;
}
.rcv-table tbody td { padding: 12px 14px; border-top: 1px solid var(--rb-surface-alt); color: var(--rb-text-primary); white-space: nowrap; vertical-align: top; }
.rcv-table tbody tr:hover { background: var(--rb-surface-hover); }
.rcv-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.strong { font-weight: 700; }
.cell--short { color: var(--rb-accent-text); font-weight: 700; }
.cell-sub { display: block; margin-top: 3px; font-size: 11.5px; color: var(--rb-text-secondary); }
.cell-sub--alert { color: var(--rb-warning-text); font-weight: 600; }

.pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.pill__dot { width: 6px; height: 6px; border-radius: 999px; background: currentColor; }

.link-btn {
  padding: 0; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text);
  background: none; border: none; cursor: pointer; text-align: left; text-decoration: none;
}
.link-btn:hover { text-decoration: underline; }

.field-error { margin: 0; font-size: 12px; color: var(--rb-accent-text); }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 9px 16px; font-size: 13px; font-weight: 600; font-family: inherit; text-decoration: none;
  border-radius: 9px; cursor: pointer; white-space: nowrap;
  background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong);
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn--sm { padding: 6px 11px; font-size: 12px; border-radius: 8px; }
.btn--primary { background: var(--rb-primary); color: #fff; border-color: var(--rb-primary); }
.btn--primary:hover:not(:disabled) { background: #10509c; }
.btn--quiet { color: var(--rb-accent-text); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.spin-icon { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.toast {
  position: fixed; right: 20px; bottom: 20px; z-index: 330; max-width: min(420px, calc(100vw - 40px));
  padding: 11px 16px; border-radius: 10px; background: var(--rb-text-primary); color: var(--rb-surface);
  font-size: 13px; font-weight: 600;
}
.toast-enter-active, .toast-leave-active { transition: opacity .2s ease, transform .2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(6px); }

.skeleton {
  height: 13px; border-radius: 6px; margin-bottom: 10px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

.tone--success { background: rgba(var(--rb-success-rgb), 0.14); color: var(--rb-success-text); }
.tone--warning { background: rgba(var(--rb-warning-rgb), 0.16); color: var(--rb-warning-text); }
.tone--danger { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }
.tone--info { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text); }
.tone--progress { background: rgba(var(--rb-purple-rgb), 0.12); color: var(--rb-purple-text); }
.tone--muted { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin-icon { animation: none; }
  .toast-enter-active, .toast-leave-active { transition: none; }
}

@media (max-width: 720px) {
  .rcv-page { padding: 14px; }
  .centre__state { align-items: flex-start; text-align: left; }
  .search-box { max-width: none; }
  .filter-select { min-width: 0; width: 100%; }
}
</style>
