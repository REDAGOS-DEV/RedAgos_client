<template>
  <div class="list-page">
    <div class="list-inner">
      <PageHeader title="Weekly Request" :subtitle="hospitalPageSubtitle('weekly', can)">
        <template #actions>
          <button
            type="button"
            class="ui-btn"
            :disabled="refreshing"
            aria-label="Refresh the lists"
            :title="updatedAt ? `Refresh · updated ${updatedAtLabel}` : 'Refresh'"
            @click="refresh"
          >
            <AssetIcon name="refresh-cw" :size="15" :class="{ spin: refreshing }" />
            Refresh
          </button>
          <NuxtLink to="/hospital/request-days" class="ui-btn">
            <AssetIcon name="calendar" :size="15" />
            Request Days
          </NuxtLink>
          <NuxtLink v-if="canSend" to="/hospital/receiving/weekly/new" class="ui-btn ui-btn--primary">
            <AssetIcon name="plus" :size="15" />
            New Weekly Request
          </NuxtLink>
        </template>
      </PageHeader>

      <!-- Today across every center, from the same status the cards read. -->
      <StatStrip>
        <StatItem :loading="statusLoading" label="Due today" :value="dueCount" icon="send" tone="warning" :alert="dueCount > 0" hint="Still to send" />
        <StatItem :loading="statusLoading" label="Sent today" :value="sentCount" icon="check-circle" tone="success" hint="Already with the center" />
        <StatItem :loading="statusLoading" label="Missed in 4 weeks" :value="missedCount" icon="circle-alert" tone="danger" :alert="missedCount > 0" hint="Request days with none sent" />
        <StatItem :loading="statusLoading" label="Next request day" :value="nextDayLabel" icon="calendar" tone="primary" :hint="nextDayHint" />
      </StatStrip>

      <div v-if="statusError" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ statusError }}</p>
        <button type="button" class="btn-link" @click="loadStatus">Retry</button>
      </div>

      <!-- ============ TODAY ============ -->
      <section aria-labelledby="today-title" class="today">
        <header class="today__head">
          <h2 id="today-title" class="panel-title">Today<span v-if="status?.as_of" class="panel-date"> · {{ formatDay(status.as_of, true) }}</span></h2>
          <p class="today__rule">The center supplies what it can. Whatever it cannot is closed when it dispatches.</p>
        </header>

        <div v-if="statusLoading && !skeletonCards.length" class="panel center__sk-empty" aria-busy="true">
          <div class="empty-state">
            <span class="sk empty-state__icon" />
            <span class="sk sk--line" style="width: 150px" />
            <span class="sk sk--line" style="width: min(420px, 80%)" />
            <span class="sk sk--line" style="width: min(300px, 60%)" />
          </div>
        </div>

        <div v-else-if="statusLoading" class="centers" aria-busy="true">
          <div v-for="(card, index) in skeletonCards" :key="index" class="center">
            <div class="center__top">
              <div class="center__sk-name">
                <span class="sk sk--line" style="width: min(220px, 62%)" />
                <span class="sk sk--line" style="width: min(140px, 40%)" />
              </div>
              <span class="sk sk--line" style="width: 84px" />
            </div>
            <div v-if="card.days" class="days">
              <div v-for="day in card.days" :key="day" class="day">
                <span class="sk day__mark" />
                <span class="sk sk--line day__sk-date" />
              </div>
            </div>
            <p v-else class="center__none center__sk-none"><span class="sk sk--line" style="width: min(220px, 60%)" /></p>
            <div class="center__foot">
              <span class="sk sk--line" style="width: min(240px, 50%)" />
              <span v-if="card.action" class="sk center__sk-action" />
            </div>
          </div>
        </div>

        <div v-else-if="!schedules.length" class="panel">
          <div class="empty-state">
            <span class="empty-state__icon"><AssetIcon name="calendar" :size="20" /></span>
            <p class="empty-state__title">No request days yet</p>
            <p class="empty-state__text">
              Set the days you send each blood center your weekly request on the
              <NuxtLink to="/hospital/request-days" class="btn-link">Request Days</NuxtLink> page.
              A weekly request can only be sent on those days.
            </p>
          </div>
        </div>

        <ul v-else class="centers">
          <li
            v-for="entry in orderedSchedules"
            :key="entry.schedule.id"
            class="center"
            :class="{ 'center--due': entry.due_today && !entry.sent_today }"
          >
            <div class="center__top">
              <div class="cell">
                <span class="cell__main center__name">{{ entry.schedule.target_facility?.name || 'Blood center' }}</span>
                <span v-if="entry.schedule.target_facility?.address" class="cell__sub">{{ entry.schedule.target_facility.address }}</span>
              </div>
              <span class="badge" :class="badgeClass(stateFor(entry).tone)">
                <span class="badge__dot" aria-hidden="true" />
                {{ stateFor(entry).label }}
              </span>
            </div>

            <!-- The last few request days, oldest first, so a run of misses reads left to right. -->
            <ol v-if="entry.recent.length" class="days" :aria-label="`Recent request days for ${entry.schedule.target_facility?.name}`">
              <li
                v-for="day in [...entry.recent].slice(0, 8).reverse()"
                :key="day.date"
                class="day"
                :class="day.sent ? 'day--sent' : 'day--missed'"
                :title="`${formatDay(day.date)} — ${day.sent ? `sent (${day.weekly_request?.reference_number})` : 'no request sent'}`"
              >
                <span class="day__mark"><AssetIcon :name="day.sent ? 'check' : 'x'" :size="11" /></span>
                <span class="day__date">{{ formatDay(day.date) }}</span>
              </li>
            </ol>
            <p v-else class="center__none">No request days have passed yet.</p>

            <footer class="center__foot">
              <span class="center__note">
                <strong v-if="entry.missed_count" class="center__missed">{{ entry.missed_count }} missed in 4 weeks</strong>
                <template v-else>None missed in 4 weeks</template>
                <template v-if="!entry.sent_today && !entry.due_today && entry.next_request_day"> · Next: {{ formatDay(entry.next_request_day, true) }}</template>
              </span>

              <NuxtLink v-if="entry.sent_today" :to="`/hospital/receiving/weekly/${entry.sent_today.id}`" class="ui-btn ui-btn--sm" :title="`View ${entry.sent_today.reference_number}`">
                <AssetIcon name="eye" :size="14" />
                {{ entry.sent_today.reference_number }}
              </NuxtLink>
              <NuxtLink
                v-else-if="entry.due_today && canSend"
                :to="`/hospital/receiving/weekly/new?target=${entry.schedule.target_facility?.id}`"
                class="ui-btn ui-btn--sm ui-btn--primary"
                :aria-label="`Send today's request to ${entry.schedule.target_facility?.name}`"
              >
                <AssetIcon name="send" :size="14" />
                Send request
              </NuxtLink>
            </footer>
          </li>
        </ul>
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
                <th scope="col">Supplied</th>
                <th scope="col" class="num">Received</th>
                <th scope="col" class="num">Not supplied</th>
                <th scope="col">Status</th>
                <th scope="col" class="c-actions">Actions</th>
              </tr>
            </thead>

            <tbody v-if="listLoading && !weeklyRequests.length">
              <SkeletonRows :columns="8" :rows="5" />
            </tbody>

            <tbody v-else-if="!weeklyRequests.length">
              <tr>
                <td colspan="8" class="empty-cell">
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
              <tr v-for="weekly in weeklyRequests" :key="weekly.id" class="list-row list-row--link" @click="openWeekly(weekly)">
                <td>
                  <div class="cell">
                    <NuxtLink :to="`/hospital/receiving/weekly/${weekly.id}`" class="code" @click.stop>{{ weekly.reference_number }}</NuxtLink>
                    <span class="cell__sub">{{ bloodTypesOf(weekly) }}</span>
                  </div>
                </td>
                <td class="nowrap">{{ formatDay(weekly.request_day, true) }}</td>
                <td>{{ weekly.target_facility?.name || '—' }}</td>
                <td>
                  <div class="supply" :aria-label="`${weekly.totals.fulfilled} of ${weekly.totals.requested} units supplied`">
                    <span class="supply__figure"><strong>{{ weekly.totals.fulfilled }}</strong> of {{ weekly.totals.requested }}</span>
                    <span class="supply__track" aria-hidden="true"><span class="supply__fill" :style="{ width: `${supplyPercent(weekly)}%` }" /></span>
                  </div>
                </td>
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
                  <div class="row-actions" @click.stop>
                    <!-- Dispatched or picked up: the whole delivery into Stock Intake from here (project owner, 2026-10-30). -->
                    <button
                      v-if="canReceive && weekly.totals.awaiting_receipt"
                      type="button"
                      class="btn-primary btn-receive"
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
import SkeletonRows from '~/components/ui/SkeletonRows.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import StatStrip from '~/components/ui/StatStrip.vue'
import StatItem from '~/components/ui/StatItem.vue'
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
import { hospitalPageSubtitle } from '~/utils/hospitalPageSubtitles'

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

// The loading cards copy the last answer this browser saw. A first visit has
// none, so it draws one center with no past request days.
const SHAPE_KEY = 'weekly_status_shape'
const skeletonCards = ref([{ days: 0, action: false }])

function readShape() {
  try {
    const saved = JSON.parse(localStorage.getItem(SHAPE_KEY))
    if (Array.isArray(saved)) {
      skeletonCards.value = saved.slice(0, 12).map(card => ({
        days: Math.min(8, Math.max(0, Number(card?.days) || 0)),
        action: Boolean(card?.action),
      }))
    }
  } catch {
    // Nothing usable saved: the first-visit card stands.
  }
}

function rememberShape() {
  try {
    localStorage.setItem(SHAPE_KEY, JSON.stringify(orderedSchedules.value.map(entry => ({
      days: Math.min(8, entry.recent.length),
      action: Boolean(entry.sent_today || (entry.due_today && canSend.value)),
    }))))
  } catch {
    // Private window or blocked storage: the next load guesses again.
  }
}

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

// What to do first: due, then sent, then the rest.
const urgency = entry => (entry.sent_today ? 1 : entry.due_today ? 0 : 2)
const orderedSchedules = computed(() => [...schedules.value].sort((a, b) => urgency(a) - urgency(b)))

const dueCount = computed(() => schedules.value.filter(entry => entry.due_today && !entry.sent_today).length)
const sentCount = computed(() => schedules.value.filter(entry => entry.sent_today).length)
const missedCount = computed(() => schedules.value.reduce((sum, entry) => sum + (entry.missed_count || 0), 0))

// The soonest request day still ahead, across every center.
const nextEntry = computed(() => schedules.value
  .filter(entry => entry.next_request_day)
  .sort((a, b) => String(a.next_request_day).localeCompare(String(b.next_request_day)))[0] ?? null)
const nextDayLabel = computed(() => (nextEntry.value ? formatDay(nextEntry.value.next_request_day) : '—'))
const nextDayHint = computed(() => (statusLoading.value
  ? '\u00A0'
  : nextEntry.value?.schedule?.target_facility?.name ?? 'Set on Request Days'))

function openWeekly(weekly) {
  navigateTo(`/hospital/receiving/weekly/${weekly.id}`)
}

function supplyPercent(weekly) {
  const requested = Number(weekly.totals.requested) || 0
  return requested ? Math.min(100, Math.round(((Number(weekly.totals.fulfilled) || 0) / requested) * 100)) : 0
}

const updatedAtLabel = computed(() => (updatedAt.value
  ? updatedAt.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  : ''))

watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadList(1), 300)
})

onMounted(() => {
  readShape()
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
    rememberShape()
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

/* Receive stands out from the row's other icons while units are on their way. */
.btn-receive { height: 32px; padding: 0 12px; font-size: 12.5px; border-radius: 9px; }
.row-actions { align-items: center; justify-content: flex-end; }

/* A .cell is a column, which would stretch the badge across it. */
.cell > .badge { align-self: flex-start; }

/* Today: a card per center. */
.today { display: flex; flex-direction: column; gap: 10px; }
.today__head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 16px; }
.today__rule { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.centers { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(380px, 100%), 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
.center {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 16px 18px;
  border: 1px solid var(--rb-border);
  border-radius: var(--rb-radius-lg);
  background: var(--rb-surface);
  box-shadow: var(--rb-shadow-sm);
}
.center--due { border-color: rgba(var(--rb-warning-rgb), 0.6); }
.center__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.center__name { font-size: 14px; font-weight: 700; }
.center__none { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.center__foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; margin-top: auto; min-height: 34px; }
.center__foot .ui-btn { text-decoration: none; }
.center__note { font-size: 12.5px; color: var(--rb-text-secondary); }
.center__missed { font-weight: 600; color: var(--rb-accent-text); }
.center__sk-name { display: flex; flex: 1; flex-direction: column; gap: 8px; min-height: 38px; }
.center__sk-empty { min-height: 271px; }
.center__sk-none { display: flex; align-items: center; min-height: 19px; }
.center__sk-action { width: 112px; height: 32px; border-radius: 9px; }
.day__sk-date { width: 28px; height: 8px; margin-top: 4px; }

/* Recent request days: one mark each, sent or missed. */
.days { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 4px; margin: 0; padding: 0; list-style: none; }
.day { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; min-height: 41px; }
.day__mark { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; }
.day--sent .day__mark { background: rgba(var(--rb-success-rgb), 0.14); color: var(--rb-success-text); }
.day--missed .day__mark { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }
.day__date { font-size: 10.5px; font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--rb-text-secondary); }

/* Supplied, of what was asked. */
.supply { display: inline-flex; flex-direction: column; gap: 5px; min-width: 88px; }
.supply__figure { font-size: 13px; font-variant-numeric: tabular-nums; color: var(--rb-text-secondary); }
.supply__figure strong { color: var(--rb-text-primary); }
.supply__track { height: 4px; overflow: hidden; border-radius: 999px; background: var(--rb-border); }
.supply__fill { display: block; height: 100%; border-radius: inherit; background: var(--rb-success); }
</style>
