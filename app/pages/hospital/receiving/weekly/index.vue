<template>
  <div class="list-page">
    <div class="list-inner">
      <PageHeader title="Weekly Request">
        <template #subtitle>Your scheduled restock. Send each blood center its weekly request on your request days — the center supplies what it can, and whatever it cannot is closed when it dispatches.</template>
      </PageHeader>

      <div v-if="statusError" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ statusError }}</p>
        <button type="button" class="btn-link" @click="loadStatus">Retry</button>
      </div>

      <!-- ============ TODAY ============ -->
      <!-- Laid out as the centre's Donor Management list (project owner, 2026-10-30). -->
      <section class="panel" aria-labelledby="today-title">
        <header class="panel-head">
          <h2 id="today-title" class="panel-title">Today<span v-if="status" class="panel-date"> · {{ formatDay(status.as_of, true) }}</span></h2>
        </header>

        <div class="table-wrap">
          <table class="list-table">
            <caption class="sr-only">Each blood center you restock from, and whether today's weekly request is due</caption>
            <thead>
              <tr>
                <th scope="col">Blood center</th>
                <th scope="col">Recent request days</th>
                <th scope="col" class="num">Missed in 4 weeks</th>
                <th scope="col">Today</th>
                <th scope="col" class="c-actions">Actions</th>
              </tr>
            </thead>

            <tbody v-if="statusLoading">
              <tr v-for="n in 2" :key="'skt-' + n">
                <td colspan="5"><span class="skeleton skeleton--line" /></td>
              </tr>
            </tbody>

            <tbody v-else-if="!schedules.length">
              <tr>
                <td colspan="5" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-state__icon"><AssetIcon name="calendar" :size="20" /></span>
                    <p class="empty-state__title">No request days yet</p>
                    <p class="empty-state__text">
                      Set the days you send each blood center your weekly request on the
                      <NuxtLink to="/hospital/request-days" class="btn-link">Request Days</NuxtLink> page.
                      A weekly request can only be sent on those days.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr v-for="entry in schedules" :key="entry.schedule.id" class="list-row">
                <td>
                  <div class="cell">
                    <span class="cell__main">{{ entry.schedule.target_facility?.name || 'Blood center' }}</span>
                    <span v-if="entry.schedule.target_facility?.address" class="cell__sub">{{ entry.schedule.target_facility.address }}</span>
                  </div>
                </td>
                <td>
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
                  <span v-else class="muted">—</span>
                </td>
                <td class="num" :class="{ 'cell--short': entry.missed_count }">{{ entry.missed_count }}</td>
                <td>
                  <div class="cell">
                    <span class="badge" :class="badgeClass(stateFor(entry).tone)">
                      <span class="badge__dot" aria-hidden="true" />
                      {{ stateFor(entry).label }}
                    </span>
                    <NuxtLink v-if="entry.sent_today" :to="`/hospital/receiving/weekly/${entry.sent_today.id}`" class="code today-ref">
                      {{ entry.sent_today.reference_number }}
                    </NuxtLink>
                    <span v-else-if="!entry.due_today && entry.next_request_day" class="cell__sub">Next: {{ formatDay(entry.next_request_day, true) }}</span>
                  </div>
                </td>
                <td class="c-actions">
                  <div class="row-actions">
                    <NuxtLink
                      v-if="entry.sent_today"
                      :to="`/hospital/receiving/weekly/${entry.sent_today.id}`"
                      class="icon-btn"
                      :aria-label="`View ${entry.sent_today.reference_number}`"
                      title="View today's request"
                    >
                      <AssetIcon name="eye" :size="15" />
                    </NuxtLink>
                    <NuxtLink
                      v-else-if="entry.due_today && canSend"
                      :to="`/hospital/receiving/weekly/new?target=${entry.schedule.target_facility?.id}`"
                      class="icon-btn icon-btn--go"
                      :aria-label="`Send today's request to ${entry.schedule.target_facility?.name}`"
                      title="Send today's request"
                    >
                      <AssetIcon name="send" :size="15" />
                    </NuxtLink>
                    <span v-else class="muted">—</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ============ HISTORY ============ -->
      <section class="panel" aria-labelledby="history-title">
        <header class="panel-head">
          <h2 id="history-title" class="panel-title">Weekly requests sent</h2>
        </header>

        <!-- The donors page's toolbar: the search is the server's, so it reaches every page. -->
        <div class="toolbar">
          <div class="toolbar__filters">
            <label class="search">
              <AssetIcon name="search" :size="15" class="search__icon" />
              <input
                v-model="search"
                type="search"
                class="search__input"
                placeholder="Search WR / RQ number"
                aria-label="Search weekly requests by WR or RQ number"
              >
            </label>
          </div>

          <div class="toolbar__actions">
            <span v-if="updatedAt" class="updated" :title="`List loaded at ${updatedAtLabel}`">
              <AssetIcon name="clock" :size="13" />
              Updated {{ updatedAtLabel }}
            </span>

            <button
              type="button"
              class="btn-outline btn-outline--squeeze"
              :disabled="refreshing"
              aria-label="Refresh the lists"
              :title="updatedAt ? `Refresh · updated ${updatedAtLabel}` : 'Refresh'"
              @click="refresh"
            >
              <AssetIcon name="refresh-cw" :size="14" :class="{ spin: refreshing }" />
              <span class="btn-text">Refresh</span>
            </button>

            <NuxtLink v-if="canSend" to="/hospital/receiving/weekly/new" class="btn-primary">
              <AssetIcon name="plus" :size="15" />
              New Weekly Request
            </NuxtLink>
          </div>
        </div>

        <div v-if="listError" class="banner banner--error banner--inset" role="alert">
          <AssetIcon name="circle-alert" :size="16" />
          <p class="banner__text">{{ listError }}</p>
          <button type="button" class="btn-link" @click="loadList(pager.page)">Retry</button>
        </div>

        <div class="table-wrap" :class="{ 'table-wrap--busy': listLoading && weeklyRequests.length }">
          <table class="list-table">
            <caption class="sr-only">Weekly requests sent, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Request day</th>
                <th scope="col">Blood center</th>
                <th scope="col" class="num">Requested</th>
                <th scope="col" class="num">Supplied</th>
                <th scope="col" class="num">Received</th>
                <th scope="col" class="num">Not supplied</th>
                <th scope="col">Status</th>
                <th scope="col" class="c-actions">Actions</th>
              </tr>
            </thead>

            <tbody v-if="listLoading && !weeklyRequests.length">
              <tr v-for="n in 5" :key="'skr-' + n">
                <td colspan="9"><span class="skeleton skeleton--line" /></td>
              </tr>
            </tbody>

            <tbody v-else-if="!weeklyRequests.length">
              <tr>
                <td colspan="9" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-state__icon"><AssetIcon :name="search.trim() ? 'search-x' : 'inbox'" :size="20" /></span>
                    <p class="empty-state__title">{{ search.trim() ? 'No weekly request matches' : 'No weekly requests yet' }}</p>
                    <p class="empty-state__text">
                      {{ search.trim() ? 'Try another WR or RQ number.' : 'Weekly requests you send appear here with what each center supplied.' }}
                    </p>
                    <button v-if="search.trim()" type="button" class="btn-outline" @click="search = ''">Clear search</button>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr v-for="weekly in weeklyRequests" :key="weekly.id" class="list-row">
                <td>
                  <div class="cell">
                    <NuxtLink :to="`/hospital/receiving/weekly/${weekly.id}`" class="code">{{ weekly.reference_number }}</NuxtLink>
                    <span class="cell__sub">{{ bloodTypesOf(weekly) }}</span>
                  </div>
                </td>
                <td class="nowrap">{{ formatDay(weekly.request_day, true) }}</td>
                <td>{{ weekly.target_facility?.name || '—' }}</td>
                <td class="num">{{ weekly.totals.requested }}</td>
                <td class="num strong">{{ weekly.totals.fulfilled }}</td>
                <td class="num">
                  <div class="cell cell--end">
                    <span>{{ weekly.totals.received }}</span>
                    <span v-if="weekly.totals.awaiting_receipt" class="cell__sub cell__sub--alert">{{ weekly.totals.awaiting_receipt }} to receive</span>
                  </div>
                </td>
                <td class="num" :class="{ 'cell--short': weekly.totals.not_supplied }">{{ weekly.totals.not_supplied }}</td>
                <td>
                  <div class="cell">
                    <span class="badge" :class="badgeClass(WEEKLY_STATUS_TONES[weekly.status])">
                      <span class="badge__dot" aria-hidden="true" />
                      {{ weekly.status_label }}
                    </span>
                    <!-- When it arrives, once the center confirmed it. -->
                    <span v-if="weekly.is_open && planOf(weekly)" class="cell__sub">{{ supplyPlanSummary(planOf(weekly)) }}</span>
                  </div>
                </td>
                <td class="c-actions">
                  <div class="row-actions">
                    <!-- Dispatched or picked up: the whole delivery into Stock Intake from here (project owner, 2026-10-30). -->
                    <button
                      v-if="canReceive && weekly.totals.awaiting_receipt"
                      type="button"
                      class="btn-outline btn-outline--sm btn-receive"
                      :aria-label="`Receive ${weekly.totals.awaiting_receipt} unit${weekly.totals.awaiting_receipt === 1 ? '' : 's'} for ${weekly.reference_number}`"
                      @click="receiving = weekly"
                    >
                      <AssetIcon name="package-check" :size="14" />
                      Receive
                    </button>
                    <NuxtLink
                      :to="`/hospital/receiving/weekly/${weekly.id}`"
                      class="icon-btn"
                      :aria-label="`View ${weekly.reference_number}`"
                      title="View"
                    >
                      <AssetIcon name="eye" :size="15" />
                    </NuxtLink>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ListPager
          :page="pager.page"
          :last-page="pager.lastPage"
          :from="pager.from"
          :to="pager.to"
          :total="pager.total"
          :busy="listLoading"
          @go="loadList"
        />
      </section>
    </div>

    <HospitalReceiveDeliveryDialog
      v-if="receiving"
      kind="weekly"
      :request-id="receiving.id"
      :reference="receiving.reference_number"
      @received="loadList(pager.page)"
      @close="receiving = null"
    />
  </div>
</template>

<script setup>
import PageHeader from '~/components/ui/PageHeader.vue'
/**
 * The weekly request: the blood bank's scheduled restock from each blood center.
 *
 * The blood bank keeps its own request days per center, on the Request Days
 * page; a weekly request may only be sent on one of them, once a day. This
 * page says, per center, whether today's request is due or sent and which
 * recent request days went without one — all derived by the API — and lists
 * what was sent and what came of it. Both lists are laid out as the centre's
 * Donor Management (project owner, 2026-10-30).
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import ListPager from '~/components/common/ListPager.vue'
import HospitalReceiveDeliveryDialog from '~/components/Hospital/ReceiveDeliveryDialog.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { bloodTypeCodes, supplyPlanSummary } from '~/types/bloodRequest'
import { WEEKLY_STATUS_TONES } from '~/types/receiving'
import { badgeClass } from '~/utils/listBadge'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.requests.view' })

const { can } = useUser()
// Sending is Requesting Staff's and the Head's; the server refuses anyone else.
const canSend = computed(() => can('hospital.requests.manage'))
// Receiving is confirmed by whoever holds that ability; the server checks it too.
const canReceive = computed(() => can('hospital.receipt.confirm'))
// The weekly request whose delivery is being received, in ReceiveDeliveryDialog.
const receiving = ref(null)

const PER_PAGE = 25

const status = ref(null)
const statusLoading = ref(true)
const statusError = ref('')

const weeklyRequests = ref([])
const listLoading = ref(true)
const listError = ref('')
const search = ref('')
const refreshing = ref(false)
const updatedAt = ref(null)
const pager = reactive({ page: 1, lastPage: 1, total: 0, from: 0, to: 0 })

let searchTimer = null
let listSeq = 0

const schedules = computed(() => status.value?.schedules ?? [])

const updatedAtLabel = computed(() => (updatedAt.value
  ? updatedAt.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  : ''))

watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadList(1), 300)
})

onMounted(() => {
  loadStatus()
  loadList()
})

onUnmounted(() => clearTimeout(searchTimer))

async function refresh() {
  refreshing.value = true

  try {
    await Promise.all([loadStatus(), loadList(pager.page)])
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

async function loadList(page = 1) {
  const seq = ++listSeq
  listLoading.value = true
  listError.value = ''

  try {
    const response = await hospitalService.weeklyRequests({ search: search.value.trim() || undefined, per_page: PER_PAGE, page })

    if (seq !== listSeq) return
    weeklyRequests.value = response.data ?? []

    const perPage = response.per_page || PER_PAGE
    pager.page = response.current_page || page
    pager.lastPage = Math.max(1, response.last_page || 1)
    pager.total = response.total ?? weeklyRequests.value.length
    pager.from = pager.total ? (pager.page - 1) * perPage + 1 : 0
    pager.to = Math.min(pager.page * perPage, pager.total)
    updatedAt.value = new Date()
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

/** The blood types a weekly request asked for, as one line. Its one request may restock several. */
function bloodTypesOf(weekly) {
  const codes = [...new Set((weekly.requests ?? []).flatMap((request) => bloodTypeCodes(request)))]

  return codes.length ? codes.join(' · ') : '—'
}

/** The center's hand-over for a weekly request, once it confirmed it. */
function planOf(weekly) {
  return (weekly.requests ?? []).find((request) => request.supply_plan)?.supply_plan ?? null
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

<!-- The lists: the blood centre's Donor Management structure (project owner, 2026-10-30). -->
<style scoped src="~/assets/css/list-ui.css"></style>

<style scoped>
.panel-date { font-weight: 600; color: var(--rb-text-secondary); }
.banner--inset { margin: 12px 16px 0; }

.cell--end { align-items: flex-end; }
.cell__sub--alert { color: var(--rb-warning-text); font-weight: 600; }
.cell--short { color: var(--rb-accent-text); font-weight: 700; }
.today-ref { margin-top: 4px; }

/* Due today: the send action stands out from the row's other icons. Receive does the same while units are on their way. */
.icon-btn--go,
.btn-receive { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.45); background: rgba(var(--rb-primary-rgb), 0.06); }
.btn-receive:hover:not(:disabled) { background: rgba(var(--rb-primary-rgb), 0.12); }

.recent { display: flex; gap: 4px; flex-wrap: wrap; }
.recent__day {
  display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 999px;
  font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap;
}
.recent__day--sent { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.recent__day--missed { background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); }
</style>
