<template>
  <div class="cdash">
    <div v-if="initialLoading" class="cdash-inner" aria-busy="true" aria-label="Loading the dashboard">
      <div class="skeleton-head">
        <div class="skeleton skeleton--header" />
        <div class="skeleton skeleton--sub" />
      </div>
      <div class="grid-2">
        <div class="skeleton skeleton--card" />
        <div class="skeleton skeleton--card" />
      </div>
      <div class="skeleton skeleton--panel" />
    </div>

    <div v-else class="cdash-inner">
      <header class="header-row">
        <div>
          <h1 class="page-title">Collection dashboard</h1>
          <p class="page-subtitle">Donor &amp; Collection{{ data ? ` · ${longDate(data.today.date)}` : '' }}</p>
        </div>
        <div class="header-actions">
          <span v-if="updatedAt" class="updated">
            <AssetIcon name="clock" :size="13" />
            Updated {{ updatedAtLabel }}
          </span>
          <button type="button" class="btn-outline" :disabled="loading" @click="load">
            <AssetIcon name="refresh-cw" :size="14" :class="{ spin: loading }" />
            Refresh
          </button>
          <!-- The counter is where the work is done. Whoever screens has it in their queue card below. -->
          <NuxtLink v-if="canWorkCounter && !can('donations.screen')" to="/blood-center/donation" class="btn-primary">
            <AssetIcon name="heart" :size="14" />
            Open counter
          </NuxtLink>
        </div>
      </header>

      <!-- What waits for this person now (useBloodCenterTasks), first on every dashboard. -->
      <TaskStrip class="needs-you" />

      <div v-if="error" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ error }}</p>
        <button type="button" class="btn-link" @click="load">Retry</button>
      </div>

      <template v-if="data">
        <!--
          ============ YOUR SCREENING QUEUE ============
          For whoever screens (donations.screen): who waits for them now and
          how today's screening has gone, with the counter one click away. The
          ring is the day's screening done: screened, of everyone who has come.
        -->
        <section v-if="can('donations.screen')" class="queue" aria-labelledby="queue-title">
          <div class="dial dial--hero" role="img" :aria-label="`${screenedToday} of ${queueTotal} screened today`">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle class="dial__base" cx="60" cy="60" r="50" />
              <circle class="dial__arc" cx="60" cy="60" r="50" :style="ringStyle(queueDone, 50)" />
            </svg>
            <span class="dial__center">
              <strong>{{ Math.round(queueDone * 100) }}%</strong>
              <small>screened</small>
            </span>
          </div>
          <div class="queue__main">
            <p class="queue__kicker">Your screening queue</p>
            <h2 id="queue-title" class="queue__title">
              <template v-if="queueWaiting">
                <strong>{{ queueWaiting }}</strong> {{ queueWaiting === 1 ? 'donor waits' : 'donors wait' }} for screening
              </template>
              <template v-else>No one is waiting for screening</template>
            </h2>
            <p class="queue__sub">
              {{ data.today.donations.screening }} in screening now · {{ plural(data.today.appointments.waiting ?? 0, 'appointment') }} still to arrive
            </p>
            <dl class="queue__stats">
              <div>
                <dt>Screened today</dt>
                <dd>{{ screenedToday }}</dd>
              </div>
              <!-- The deferrals list opens from its own figure. -->
              <div>
                <dt>Deferred today</dt>
                <dd :class="{ 'queue__warn': data.today.donations.deferred }">{{ data.today.donations.deferred }}</dd>
                <NuxtLink v-if="can('donors.view_clinical')" to="/blood-center/deferrals" class="queue__view">
                  Deferrals <AssetIcon name="arrow-right" :size="12" />
                </NuxtLink>
              </div>
              <div>
                <dt>Deferral rate</dt>
                <dd>{{ deferralRate === null ? '—' : `${deferralRate}%` }}</dd>
              </div>
            </dl>
          </div>
          <div class="queue__actions">
            <NuxtLink to="/blood-center/donation" class="btn-primary btn-primary--lg">
              Open donation counter
              <AssetIcon name="arrow-right" :size="14" />
            </NuxtLink>
          </div>
        </section>

        <!-- ============ TODAY AT THE COUNTER ============ -->
        <section aria-labelledby="today-title" class="section">
          <h2 id="today-title" class="section-title">Today at the counter</h2>

          <div class="bento">
            <!-- Appointments: a ring in the list's colours, the count in its middle. -->
            <article class="card bento__appts">
              <div class="card__head">
                <p class="card__label">Appointments today</p>
                <NuxtLink v-if="can('appointments.view')" to="/blood-center/appointments" class="card__link">
                  Appointments
                  <AssetIcon name="arrow-right" :size="13" />
                </NuxtLink>
              </div>
              <div class="donut-row">
                <div class="dial" role="img" :aria-label="appointmentRows.map(r => `${r.label} ${r.value}`).join(', ')">
                  <svg viewBox="0 0 120 120" aria-hidden="true">
                    <circle class="dial__base" cx="60" cy="60" r="48" />
                    <circle v-for="seg in appointmentArcs" :key="seg.key" class="dial__seg" :class="`dial__seg--${seg.tone}`"
                      cx="60" cy="60" r="48" :style="{ strokeDasharray: `${seg.length} ${RING48 - seg.length}`, strokeDashoffset: -seg.offset }" />
                  </svg>
                  <span class="dial__center">
                    <strong>{{ data.today.appointments.total }}</strong>
                    <small>booked</small>
                  </span>
                </div>
                <ul class="legend-list">
                  <li v-for="row in appointmentRows" :key="row.key">
                    <span class="dot" :class="`dot--${row.tone}`" aria-hidden="true" />
                    <span class="legend-list__label">{{ row.label }}</span>
                    <span class="legend-list__value">{{ row.value }}</span>
                  </li>
                </ul>
              </div>
            </article>

            <!-- Donor visits: a bar a stage, its count above it. -->
            <article class="card bento__visits">
              <div class="card__head">
                <div>
                  <p class="card__label">Donor visits today</p>
                  <p class="card__value">{{ data.today.donations.total }}</p>
                </div>
                <NuxtLink v-if="can('donations.view')" to="/blood-center/donations" class="card__link">
                  Donations
                  <AssetIcon name="arrow-right" :size="13" />
                </NuxtLink>
              </div>
              <ol class="caps caps--stages" aria-label="Where today's visits have got to">
                <li v-for="stage in stageRows" :key="stage.key" class="cap" :class="`cap--${stage.tone}`">
                  <span class="cap__val">{{ stage.value }}</span>
                  <span class="cap__track"><span class="cap__fill" :style="{ height: capHeight(stage.value, stageMax) }" /></span>
                  <span class="cap__label">{{ stage.label }}</span>
                </li>
              </ol>
              <p class="card__note">Each visit is counted once, at the furthest step it reached.</p>
            </article>
          </div>
        </section>

        <!-- ============ DONOR POOL ============ -->
        <section aria-labelledby="pool-title" class="section">
          <div class="section-head">
            <h2 id="pool-title" class="section-title">Donor pool</h2>
            <span class="section-meta">{{ plural(data.pool.total, 'donor') }} on your list</span>
          </div>

          <div class="bento">
            <!-- How much of the list can give today, as a gauge; the rest beside it. -->
            <article class="card bento__pool">
              <div class="gauge" role="img" :aria-label="`${data.pool.eligible} of ${data.pool.total} donors eligible now`">
                <svg viewBox="0 0 200 110" aria-hidden="true">
                  <path class="gauge__base" d="M 20 100 A 80 80 0 0 1 180 100" />
                  <path class="gauge__arc" d="M 20 100 A 80 80 0 0 1 180 100" :style="gaugeStyle(poolShare)" />
                </svg>
                <span class="gauge__center">
                  <strong>{{ data.pool.eligible }}</strong>
                  <small>eligible now · {{ Math.round(poolShare * 100) }}%</small>
                </span>
              </div>
              <ul class="pool-list">
                <li v-for="kpi in poolKpis.filter(k => k.key !== 'eligible')" :key="kpi.key" :title="kpi.hint">
                  <span class="dot" :class="`dot--${kpi.tone}`" aria-hidden="true" />
                  <span class="pool-list__label">{{ kpi.label }}<small>{{ kpi.hint }}</small></span>
                  <span class="pool-list__value">{{ kpi.value }}</span>
                </li>
              </ul>
            </article>

            <!-- Eligible by blood group: a capsule each, the count above, the low ones in amber. -->
            <article class="card bento__groups">
              <div class="card__head">
                <div>
                  <p class="card__label">Eligible donors by blood group</p>
                  <p class="card__sub">Active donors who can give today: who to call in when a group runs low.</p>
                </div>
                <NuxtLink v-if="can('donors.view_contact')" to="/blood-center/donors" class="card__link">
                  {{ can('donors.manage') ? 'Remind eligible' : 'Donor Management' }}
                  <AssetIcon name="arrow-right" :size="13" />
                </NuxtLink>
              </div>
              <ul class="caps caps--groups" aria-label="Eligible donors by blood group">
                <li v-for="row in groupRows" :key="row.code" class="cap" :class="isLowGroup(row.count) ? 'cap--low' : 'cap--info'">
                  <span class="cap__val">
                    {{ row.count }}
                    <span v-if="isLowGroup(row.count)" class="cap__tag">Low</span>
                  </span>
                  <span class="cap__track"><span class="cap__fill" :style="{ height: capHeight(row.count, groupMax) }" /></span>
                  <span class="cap__label cap__label--type">{{ row.code }}</span>
                </li>
              </ul>
              <p v-if="data.pool.eligible_untyped" class="card__note">
                {{ plural(data.pool.eligible_untyped, 'eligible donor') }} not yet typed.
              </p>
            </article>
          </div>
        </section>

        <div class="grid-main">
          <!-- ============ DONATION TREND ============ -->
          <section aria-labelledby="trend-title" class="card trend">
            <div class="card__head">
              <div>
                <h2 id="trend-title" class="card__label card__label--title">Donations, last 7 days</h2>
                <p class="card__sub">
                  <strong class="figure">{{ totals.donations }}</strong> donations ·
                  <strong class="figure">{{ totals.deferrals }}</strong> deferred at screening
                </p>
              </div>
              <div class="trend__tools">
                <ul class="legend" aria-label="Legend">
                  <li><span class="legend__swatch legend__swatch--s1" aria-hidden="true" />Donations</li>
                  <li><span class="legend__swatch legend__swatch--s2" aria-hidden="true" />Deferrals</li>
                </ul>
                <button type="button" class="btn-outline btn-outline--sm" :aria-pressed="showTable" @click="showTable = !showTable">
                  <AssetIcon :name="showTable ? 'bar-chart' : 'list'" :size="13" />
                  {{ showTable ? 'Chart' : 'Table' }}
                </button>
                <!-- The longer view, by period and against the one before, lives in Reports. -->
                <NuxtLink v-if="can('donations.view')" to="/blood-center/reports" class="trend__more">
                  See reports <AssetIcon name="arrow-right" :size="13" />
                </NuxtLink>
              </div>
            </div>

            <div v-show="!showTable" ref="chartBox" class="chart">
              <svg
                v-if="chart"
                :width="chart.width"
                :height="chart.height"
                class="chart__svg"
                role="img"
                tabindex="0"
                :aria-label="`Donations per day over the last 7 days: ${totals.donations} donations and ${totals.deferrals} deferrals. Use the left and right arrow keys to read each day.`"
                @keydown="onChartKey"
                @blur="activeIndex = null"
                @pointerleave="activeIndex = null"
              >
                <g class="chart__grid">
                  <g v-for="tick in chart.ticks" :key="tick.value">
                    <line :x1="chart.left" :x2="chart.width - chart.right" :y1="tick.y" :y2="tick.y" />
                    <text :x="chart.left - 8" :y="tick.y" text-anchor="end" dominant-baseline="middle">{{ tick.value }}</text>
                  </g>
                </g>

                <defs>
                  <linearGradient id="cdash-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" class="chart__stop chart__stop--top" />
                    <stop offset="100%" class="chart__stop chart__stop--bottom" />
                  </linearGradient>
                </defs>

                <!-- The day under the pointer: a guide down to its date. -->
                <line v-if="activeColumn" class="chart__guide" :x1="activeColumn.center" :x2="activeColumn.center" :y1="chart.top" :y2="chart.top + chart.plotHeight" />

                <!-- Donations as a filled curve, deferrals as a line over it. -->
                <path :d="chart.donationArea" class="chart__area" fill="url(#cdash-area)" />
                <path :d="chart.deferralLine" class="chart__line chart__line--s2" />
                <path :d="chart.donationLine" class="chart__line chart__line--s1" />

                <g v-for="(col, i) in chart.columns" :key="col.date" class="chart__col">
                  <circle v-if="col.deferrals || activeIndex === i" :cx="col.center" :cy="col.yDeferrals" :r="activeIndex === i ? 4.5 : 3" class="chart__dot chart__dot--s2" />
                  <circle :cx="col.center" :cy="col.yDonations" :r="activeIndex === i ? 5.5 : 3.5" class="chart__dot chart__dot--s1" />
                  <rect
                    :x="col.bandX"
                    :y="chart.top"
                    :width="col.bandWidth"
                    :height="chart.plotHeight"
                    class="chart__hit"
                    @pointerenter="activeIndex = i"
                    @pointermove="activeIndex = i"
                  />
                </g>

                <g class="chart__axis">
                  <text v-for="label in chart.xLabels" :key="label.date" :x="label.x" :y="chart.height - 6" :text-anchor="label.anchor">{{ label.text }}</text>
                </g>
              </svg>

              <div v-if="activeColumn" class="tooltip" :style="tooltipStyle" role="status">
                <p class="tooltip__date">{{ weekday(activeColumn.date) }}, {{ dayMonth(activeColumn.date) }}</p>
                <p class="tooltip__row"><span class="tooltip__key tooltip__key--s1" aria-hidden="true" /><strong>{{ activeColumn.donations }}</strong> donations</p>
                <p class="tooltip__row"><span class="tooltip__key tooltip__key--s2" aria-hidden="true" /><strong>{{ activeColumn.deferrals }}</strong> deferrals</p>
              </div>

              <p v-if="!peak" class="chart__empty">No donations or deferrals recorded in the last 7 days.</p>
            </div>

            <div v-if="showTable" class="trend-table-wrap">
              <table class="trend-table">
                <caption class="sr-only">Donations and deferrals per day, newest first</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col" class="num">Donations</th>
                    <th scope="col" class="num">Deferrals</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="day in trendNewestFirst" :key="day.date">
                    <td>{{ weekday(day.date) }}, {{ dayMonth(day.date) }}</td>
                    <td class="num">{{ day.donations }}</td>
                    <td class="num">{{ day.deferrals }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- ============ COMING UP ============ -->
          <section aria-labelledby="upcoming-title" class="card upcoming">
            <div class="card__head">
              <div>
                <h2 id="upcoming-title" class="card__label card__label--title">Coming up</h2>
                <p class="card__sub">Booked appointments, next 7 days</p>
              </div>
            </div>

            <ul class="caps caps--days" aria-label="Booked appointments, next 7 days">
              <li v-for="day in data.upcoming.days" :key="day.date" class="cap cap--info" :title="`${weekday(day.date)}, ${dayMonth(day.date)}: ${day.appointments} booked`">
                <span class="cap__val">{{ day.appointments }}</span>
                <span class="cap__track"><span class="cap__fill" :style="{ height: capHeight(day.appointments, dayMax) }" /></span>
                <span class="cap__label">{{ weekday(day.date) }}<small>{{ dayMonth(day.date) }}</small></span>
              </li>
            </ul>

            <div class="drives">
              <div class="drives__head">
                <p class="card__label">Blood donation drives</p>
                <NuxtLink v-if="can('drives.manage')" to="/blood-center/drives" class="card__link">
                  All drives
                  <AssetIcon name="arrow-right" :size="13" />
                </NuxtLink>
              </div>
              <ul v-if="data.upcoming.drives.length" class="drive-list">
                <li v-for="drive in data.upcoming.drives" :key="drive.id" class="drive">
                  <p class="drive__name">{{ drive.name }}</p>
                  <p class="drive__meta">
                    {{ drive.event_date === data.today.date ? 'Today' : `${weekday(drive.event_date)}, ${dayMonth(drive.event_date)}` }}{{ drive.start_time ? ` · ${drive.start_time.slice(0, 5)}` : '' }}{{ drive.location ? ` · ${drive.location}` : '' }}
                  </p>
                  <p class="drive__count">
                    {{ drive.registered }}{{ drive.max_capacity ? ` / ${drive.max_capacity}` : '' }} registered
                  </p>
                </li>
              </ul>
              <p v-else class="card__note">No drives in the next 7 days.</p>
            </div>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import TaskStrip from '~/components/BloodCenter/TaskStrip.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import {
  bloodGroupRows,
  dayMonth,
  longDate,
  niceScale,
  plural,
  trendPeak,
  trendTotals,
  weekday,
} from '~/utils/collectionDashboard'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { COLLECTION_ABILITIES } from '~/composables/useBloodCenterNav'
import { smoothPath } from '~/utils/smoothPath'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  // Every role at the counter holds it, and nothing outside the department does.
  requires: 'donations.view',
})

const { can } = useUser()
// Who works the counter: the roles that open, screen or collect a donation.
const canWorkCounter = computed(() => can(COLLECTION_ABILITIES))

/**
 * API SHAPE: GET /api/blood-center/collection/dashboard
 * -------------------------------------------------------------------------
 *  { as_of, today: { date, appointments: { total, waiting, in_progress,
 *    collected, no_show, cancelled }, donations: { total, registered,
 *    screening, collected, deferred, closed } },
 *    pool: { total, eligible, waiting, deferred, inactive, new_this_week,
 *    eligible_by_blood_type: [{ code, count }], eligible_untyped },
 *    upcoming: { days: [{ date, appointments }], drives: [...] },
 *    trend: [{ date, donations, deferrals }] }   (30 days, oldest first)
 * -------------------------------------------------------------------------
 */

const REFRESH_MS = 60_000

const data = ref(null)
const loading = ref(false)
const initialLoading = ref(true)
const error = ref('')
const updatedAt = ref(null)

const updatedAtLabel = computed(() => updatedAt.value
  ? updatedAt.value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  : '')

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await bloodCenterService.collectionDashboard()
    updatedAt.value = new Date()
  } catch (err) {
    error.value = err?.message || 'Could not load the dashboard.'
  } finally {
    loading.value = false
    initialLoading.value = false
    await nextTick()
    measure()
  }
}

/* ---------- today ---------- */

const appointmentRows = computed(() => {
  const a = data.value?.today.appointments ?? {}
  return [
    { key: 'waiting', label: 'Waiting to arrive', value: a.waiting ?? 0, tone: 'info' },
    { key: 'in_progress', label: 'In progress', value: a.in_progress ?? 0, tone: 'warn' },
    { key: 'collected', label: 'Collected', value: a.collected ?? 0, tone: 'ok' },
    { key: 'no_show', label: 'No-show', value: a.no_show ?? 0, tone: 'muted' },
    { key: 'cancelled', label: 'Cancelled', value: a.cancelled ?? 0, tone: 'neutral' },
  ]
})

const stageRows = computed(() => {
  const d = data.value?.today.donations ?? {}
  return [
    { key: 'registered', label: 'Registered', value: d.registered ?? 0, tone: 'neutral' },
    { key: 'screening', label: 'In screening', value: d.screening ?? 0, tone: 'warn' },
    { key: 'collected', label: 'Collected', value: d.collected ?? 0, tone: 'ok' },
    { key: 'deferred', label: 'Deferred', value: d.deferred ?? 0, tone: 'crit' },
  ]
})

/* ---------- pool ---------- */

const poolKpis = computed(() => {
  const p = data.value?.pool ?? {}
  return [
    { key: 'eligible', label: 'Eligible now', value: p.eligible ?? 0, tone: 'ok', hint: 'Can donate today' },
    { key: 'in_progress', label: 'In a visit now', value: p.in_progress ?? 0, tone: 'info', hint: 'Registered or screening' },
    { key: 'waiting', label: 'Waiting period', value: p.waiting ?? 0, tone: 'warn', hint: 'Donated recently' },
    { key: 'deferred', label: 'Deferred', value: p.deferred ?? 0, tone: 'crit', hint: 'Not to be called in' },
    { key: 'inactive', label: 'Inactive', value: p.inactive ?? 0, tone: 'neutral', hint: 'Marked by your centre' },
    { key: 'new', label: 'New this week', value: p.new_this_week ?? 0, tone: 'neutral', hint: 'Registered in 7 days' },
  ]
})

const groupRows = computed(() => bloodGroupRows(data.value?.pool.eligible_by_blood_type ?? []))
// A group with under 10 eligible donors, or under a tenth of the largest: the
// ones to call in first.
function isLowGroup(count) {
  return count < Math.max(10, Math.ceil(groupMax.value * 0.1))
}

/* ---------- the physician's queue ---------- */
// "Registered" is a visit that has arrived and not been screened yet.
const queueWaiting = computed(() => data.value?.today.donations.registered ?? 0)
const screenedToday = computed(() => (data.value?.today.donations.collected ?? 0) + (data.value?.today.donations.deferred ?? 0))
const deferralRate = computed(() => (screenedToday.value
  ? Math.round(((data.value?.today.donations.deferred ?? 0) / screenedToday.value) * 100)
  : null))
const groupMax = computed(() => Math.max(1, ...groupRows.value.map((r) => r.count)))

/* ---------- coming up ---------- */

const dayMax = computed(() => Math.max(1, ...(data.value?.upcoming.days ?? []).map((d) => d.appointments)))

/* ---------- the graphics: rings, a gauge, capsules ---------- */

// A ring of radius r filled to a fraction.
function ringStyle(fraction, r) {
  const length = 2 * Math.PI * r
  return { strokeDasharray: `${length * Math.min(1, Math.max(0, fraction))} ${length}` }
}

// The day's screening done: screened, of everyone who has come in.
const queueTotal = computed(() => screenedToday.value + queueWaiting.value + (data.value?.today.donations.screening ?? 0))
const queueDone = computed(() => (queueTotal.value ? screenedToday.value / queueTotal.value : 0))

// The appointments ring: a segment a status, in the list's order.
const RING48 = 2 * Math.PI * 48
const appointmentArcs = computed(() => {
  const total = data.value?.today.appointments.total || 0
  let offset = 0
  return appointmentRows.value.filter(r => r.value > 0).map((row) => {
    const length = total ? (row.value / total) * RING48 : 0
    const arc = { key: row.key, tone: row.tone, length, offset }
    offset += length
    return arc
  })
})

// The pool gauge: the share of the list that can give today.
const poolShare = computed(() => {
  const p = data.value?.pool
  return p?.total ? p.eligible / p.total : 0
})
const GAUGE = Math.PI * 80
function gaugeStyle(fraction) {
  return { strokeDasharray: `${GAUGE * Math.min(1, Math.max(0, fraction))} ${GAUGE}` }
}

// Capsule bars: a sliver for anything above zero, so a one still shows.
const stageMax = computed(() => Math.max(1, ...stageRows.value.map(s => s.value)))
function capHeight(value, max) {
  return value ? `${Math.max(8, (value / max) * 100)}%` : '0%'
}

/* ---------- trend chart ---------- */

// The week only: this page is for the day's work. The longer trend, by any
// period and against the one before, is in Reports.
const trend = computed(() => (data.value?.trend ?? []).slice(-7))
const totals = computed(() => trendTotals(trend.value))
const peak = computed(() => trendPeak(trend.value))
const trendNewestFirst = computed(() => [...trend.value].reverse())
const showTable = ref(false)

const chartBox = ref(null)
const chartWidth = ref(0)
const activeIndex = ref(null)
let resizeObserver = null

function measure() {
  if (chartBox.value) chartWidth.value = chartBox.value.clientWidth
}

const CHART_HEIGHT = 220

/**
 * The column chart in pixels: one stacked column per day, donations at the
 * baseline and deferrals above them, 2px of surface between the two, the
 * rounded end on whichever is on top. Columns are capped at 24px wide.
 */
const chart = computed(() => {
  const width = chartWidth.value
  const days = trend.value
  if (!width || !days.length) return null

  const left = 34
  const right = 8
  const top = 12
  const bottom = 26
  const plotWidth = width - left - right
  const plotHeight = CHART_HEIGHT - top - bottom
  const scale = niceScale(peak.value)
  const band = plotWidth / days.length
  const y = (v) => top + plotHeight - (v / scale.max) * plotHeight
  const base = top + plotHeight

  const columns = days.map((day, i) => {
    const bandX = left + i * band
    return {
      ...day,
      bandX,
      bandWidth: band,
      center: bandX + band / 2,
      top: y(Math.max(day.donations, day.deferrals)),
      yDonations: y(day.donations),
      yDeferrals: y(day.deferrals),
    }
  })

  const donationLine = smoothPath(columns.map(c => ({ x: c.center, y: c.yDonations })))
  const first = columns[0]
  const last = columns[columns.length - 1]

  // A label under every day of the week; today is called today.
  const xLabels = columns
    .map((col, i) => ({ col, i }))
    .map(({ col, i }) => ({
      date: col.date,
      x: col.center,
      text: i === days.length - 1 ? 'Today' : dayMonth(col.date),
      anchor: 'middle',
    }))

  return {
    width,
    height: CHART_HEIGHT,
    left,
    right,
    top,
    plotHeight,
    columns,
    donationLine,
    donationArea: `${donationLine} L${last.center},${base} L${first.center},${base} Z`,
    deferralLine: smoothPath(columns.map(c => ({ x: c.center, y: c.yDeferrals }))),
    xLabels,
    ticks: scale.ticks.map((value) => ({ value, y: y(value) })),
  }
})

const activeColumn = computed(() => (activeIndex.value === null ? null : chart.value?.columns[activeIndex.value] ?? null))

const tooltipStyle = computed(() => {
  const col = activeColumn.value
  if (!col || !chart.value) return {}
  const half = 70
  const x = Math.min(Math.max(col.center, half), chart.value.width - half)
  return { left: `${x}px`, top: `${Math.max(0, col.top - 8)}px` }
})

function onChartKey(event) {
  const last = trend.value.length - 1
  if (last < 0) return

  const moves = {
    ArrowLeft: () => Math.max(0, (activeIndex.value ?? last + 1) - 1),
    ArrowRight: () => Math.min(last, (activeIndex.value ?? -1) + 1),
    Home: () => 0,
    End: () => last,
  }

  if (event.key === 'Escape') {
    activeIndex.value = null
    return
  }

  if (moves[event.key]) {
    event.preventDefault()
    activeIndex.value = moves[event.key]()
  }
}

/* ---------- lifecycle ---------- */

let timer = null

// Refreshes once a minute while the tab is visible, and as soon as it is shown again.
function onVisibility() {
  if (document.visibilityState === 'visible') load()
}

// The chart's box only exists once data has loaded, which may be a retry
// after a failed first load; follow it rather than looking once.
watch(chartBox, (el, previous) => {
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver ??= new ResizeObserver(measure)
  if (previous) resizeObserver.unobserve(previous)
  if (el) {
    resizeObserver.observe(el)
    measure()
  }
})

onMounted(async () => {
  await load()

  timer = setInterval(() => {
    if (document.visibilityState === 'visible') load()
  }, REFRESH_MS)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  resizeObserver?.disconnect()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<style scoped>
/* Chart colours: categorical slots 1 and 2, validated on this app's own
   surfaces (#FFFFFF light, #1E293B dark) for colour-blind separation and
   contrast. Text never takes a series colour. */
.cdash {
  --series-1: #2a78d6;
  --series-2: #eb6834;
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
}

:global(.dark .cdash) {
  --series-1: #3987e5;
  --series-2: #d95926;
}

.cdash-inner { display: flex; flex-direction: column; gap: 20px; }

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
.skeleton--header { height: 28px; max-width: 200px; border-radius: 8px; }
.skeleton--sub { height: 14px; max-width: 320px; border-radius: 6px; }
.skeleton--card { height: 220px; }
.skeleton--panel { height: 320px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

/* ---------- Header ---------- */
.header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0; color: var(--rb-text-primary); }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 3px 0 0; }
.header-actions { display: flex; align-items: center; gap: 10px; }

.updated {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--rb-text-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline--sm { height: 30px; padding: 0 10px; font-size: 12px; border-radius: 8px; }

.btn-link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--rb-primary-text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-outline:focus-visible,
.btn-link:focus-visible,
.card__link:focus-visible,
.chart__svg:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); border-radius: 8px; }

.spin { animation: spin 0.9s linear infinite; }

@keyframes spin { to { transform: rotate(360deg); } }

.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 10px;
  background: var(--rb-surface);
  font-size: 13px;
}

.banner > :deep(.asset-icon) { color: var(--rb-accent-text); flex-shrink: 0; }
.banner__text { flex: 1; margin: 0; }

/* ---------- Sections and cards ---------- */
.section { display: flex; flex-direction: column; gap: 12px; }
.section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }

.section-title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rb-text-secondary);
}

.section-meta { font-size: 12.5px; color: var(--rb-text-secondary); }

.grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.grid-main { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 14px; align-items: start; }

.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  min-width: 0;
}

.card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }

.card__label {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rb-text-secondary);
}

.card__label--title { font-size: 12px; }
.card__value { margin: 6px 0 0; font-size: 30px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.card__sub { margin: 4px 0 0; font-size: 12.5px; line-height: 1.45; color: var(--rb-text-secondary); }
.card__note { margin: 0; font-size: 12px; color: var(--rb-text-secondary); }

.card__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-primary-text);
  text-decoration: none;
  white-space: nowrap;
}

.card__link:hover { text-decoration: underline; text-underline-offset: 3px; }

.figure { font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

/* State colour lives on the dot, never on a fill. */
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 999px; background: var(--rb-text-muted); flex-shrink: 0; }
.dot--ok { background: var(--rb-success); }
.dot--info { background: var(--rb-primary); }
.dot--warn { background: var(--rb-warning); }
.dot--crit { background: var(--rb-accent); }

.stat-list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }

.stat-list__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-top: 1px solid var(--rb-border);
  font-size: 13px;
}

.stat-list__label { display: inline-flex; align-items: center; gap: 8px; color: var(--rb-text-secondary); }
.stat-list__value { font-weight: 700; font-variant-numeric: tabular-nums; }

.stages { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }

.stage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface-alt);
}

.stage__value { font-size: 22px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
.stage__label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--rb-text-secondary); }

/* ---------- Pool ---------- */
.kpi-row { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }

.kpi {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
}

.kpi__label { display: inline-flex; align-items: center; gap: 7px; margin: 0; font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.kpi__value { margin: 0; font-size: 24px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
.kpi__hint { margin: 0; font-size: 11.5px; color: var(--rb-text-muted); }

.group-bars { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 28px; margin: 0; padding: 0; list-style: none; }

.group-bar { display: grid; grid-template-columns: 34px minmax(0, 1fr) 64px; align-items: center; gap: 10px; font-size: 13px; }
.group-bar__code { font-weight: 700; }
.group-bar__track { height: 10px; }

/* One series, so one colour; the 4px end and the square base of a bar. */
.group-bar__fill {
  display: block;
  height: 100%;
  min-width: 2px;
  border-radius: 0 4px 4px 0;
  background: var(--series-1);
}

.group-bar__count { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }

/* ---------- Trend ---------- */
.trend__tools { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.trend__more { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: var(--rb-primary-text, var(--rb-primary)); text-decoration: none; }
.trend__more:hover { text-decoration: underline; }

.legend { display: flex; gap: 14px; margin: 0; padding: 0; list-style: none; font-size: 12px; color: var(--rb-text-secondary); }
.legend li { display: inline-flex; align-items: center; gap: 6px; }
.legend__swatch { width: 10px; height: 10px; border-radius: 2px; }
.legend__swatch--s1 { background: var(--series-1); }
.legend__swatch--s2 { background: var(--series-2); }

.chart { position: relative; min-height: 220px; }
.chart__svg { display: block; overflow: visible; }

.chart__grid line { stroke: var(--rb-border); stroke-width: 1; shape-rendering: crispEdges; }
.chart__grid text,
.chart__axis text { fill: var(--rb-text-secondary); font-size: 11px; font-variant-numeric: tabular-nums; }

.chart__area { stroke: none; }
.chart__stop--top { stop-color: var(--series-1); stop-opacity: 0.28; }
.chart__stop--bottom { stop-color: var(--series-1); stop-opacity: 0; }
.chart__line { fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.chart__line--s1 { stroke: var(--series-1); }
.chart__line--s2 { stroke: var(--series-2); stroke-width: 2; stroke-dasharray: 0; }
.chart__dot { stroke: var(--rb-surface); stroke-width: 2; transition: r 0.12s ease; }
.chart__dot--s1 { fill: var(--series-1); }
.chart__dot--s2 { fill: var(--series-2); }
.chart__guide { stroke: var(--rb-border-strong, var(--rb-border)); stroke-width: 1; stroke-dasharray: 3 3; pointer-events: none; }
.chart__hit { fill: transparent; cursor: default; }

.chart__empty {
  position: absolute;
  inset: 40% 0 auto;
  margin: 0;
  text-align: center;
  font-size: 13px;
  color: var(--rb-text-secondary);
}

.tooltip {
  position: absolute;
  transform: translate(-50%, -100%);
  min-width: 128px;
  padding: 8px 10px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  box-shadow: 0 6px 20px rgba(var(--rb-shadow-rgb), 0.18);
  pointer-events: none;
  font-size: 12px;
}

.tooltip__date { margin: 0 0 4px; font-weight: 600; color: var(--rb-text-secondary); }
.tooltip__row { display: flex; align-items: center; gap: 6px; margin: 2px 0 0; color: var(--rb-text-secondary); }
.tooltip__row strong { color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.tooltip__key { width: 12px; height: 2px; border-radius: 1px; }
.tooltip__key--s1 { background: var(--series-1); }
.tooltip__key--s2 { background: var(--series-2); }

.trend-table-wrap { position: relative; max-height: 320px; overflow: auto; border: 1px solid var(--rb-border); border-radius: 10px; }
.trend-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }

.trend-table th {
  position: sticky;
  top: 0;
  padding: 8px 12px;
  background: var(--rb-surface-alt);
  border-bottom: 1px solid var(--rb-border);
  text-align: left;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rb-text-secondary);
}

.trend-table td { padding: 7px 12px; border-bottom: 1px solid var(--rb-border); }
.trend-table tr:last-child td { border-bottom: 0; }
.num { text-align: right !important; font-variant-numeric: tabular-nums; }

/* ---------- Coming up ---------- */
.days { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }

.day { display: grid; grid-template-columns: 34px 52px minmax(0, 1fr) 28px; align-items: center; gap: 8px; font-size: 13px; }
.day__name { font-weight: 700; }
.day__date { color: var(--rb-text-secondary); font-size: 12px; }
.day__track { height: 8px; }

.day__fill {
  display: block;
  height: 100%;
  min-width: 2px;
  border-radius: 0 4px 4px 0;
  background: var(--series-1);
}

.day__count { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }

.drives { display: flex; flex-direction: column; gap: 10px; padding-top: 14px; border-top: 1px solid var(--rb-border); }
.drives__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.drive-list { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.drive { padding: 10px 12px; border: 1px solid var(--rb-border); border-radius: 10px; }
.drive__name { margin: 0; font-size: 13px; font-weight: 700; overflow-wrap: anywhere; }
.drive__meta { margin: 3px 0 0; font-size: 12px; color: var(--rb-text-secondary); overflow-wrap: anywhere; }
.drive__count { margin: 6px 0 0; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }

/* ---------- Narrow screens ---------- */
@media (max-width: 1100px) {
  .grid-main { grid-template-columns: minmax(0, 1fr); }
  .kpi-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 760px) {
  .grid-2 { grid-template-columns: minmax(0, 1fr); }
  .kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stages { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .group-bars { grid-template-columns: minmax(0, 1fr); }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .spin { animation: none !important; }
  .chart__col { transition: none; }
}

/* ── The physician's screening queue ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  border-radius: 10px;
  background: var(--rb-primary);
  font-size: 13.5px;
  font-weight: 700;
  color: #fff;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 150ms ease;
}
.btn-primary:hover { background: var(--rb-primary-hover, var(--rb-primary)); }
.btn-primary:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

.queue {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
  padding: 20px 22px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.25);
  border-radius: 20px;
  background:
    radial-gradient(120% 160% at 0% 0%, rgba(var(--rb-primary-rgb), 0.10), transparent 60%),
    var(--rb-surface);
}
.queue__kicker { margin: 0; font-size: 12px; font-weight: 700; color: var(--rb-primary-text); }
.queue__title { margin: 4px 0 0; font-size: 20px; font-weight: 700; color: var(--rb-text-primary); }
.queue__title strong { font-size: 28px; font-weight: 800; color: var(--rb-primary-text); }
.queue__sub { margin: 4px 0 0; font-size: 13px; color: var(--rb-text-secondary); }
.queue__stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0; }
.queue__stats div { padding: 10px 12px; border-radius: 12px; background: var(--rb-surface-hover, #F6F8FB); }
.queue__stats dt { font-size: 12px; color: var(--rb-text-secondary); }
.queue__stats dd { margin: 2px 0 0; font-size: 20px; font-weight: 800; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.queue__warn { color: var(--rb-accent-text, #C62828) !important; }
.queue__actions { display: flex; align-items: center; }
.btn-primary--lg { height: 44px; padding: 0 20px; font-size: 14px; }
.queue__view { display: inline-flex; align-items: center; gap: 3px; margin-top: 2px; font-size: 12px; font-weight: 700; color: var(--rb-primary-text); text-decoration: none; }
.queue__view:hover { text-decoration: underline; }
.queue__view:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; border-radius: 4px; }

/* ── Shares: the day in proportion ── */
.share { display: flex; gap: 2px; height: 8px; margin: 6px 0 4px; overflow: hidden; border-radius: 999px; background: var(--rb-surface-hover, #F1F5F9); }
.share__seg { min-width: 0; flex-basis: 0; }
.share__seg--ok { background: var(--rb-success); }
.share__seg--info { background: var(--rb-primary); }
.share__seg--warn { background: var(--rb-warning); }
.share__seg--crit { background: var(--rb-accent); }
.share__seg--neutral { background: var(--rb-border-strong, #CBD5E1); }

/* Visits as a flow: Registered, then screening, then collected; deferred apart. */
.stages--flow .stage { position: relative; }
.stages--flow .stage:not(:nth-child(n+3))::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -9px;
  z-index: 1;
  width: 8px;
  height: 8px;
  border-top: 2px solid var(--rb-border-strong, #CBD5E1);
  border-right: 2px solid var(--rb-border-strong, #CBD5E1);
  transform: translateY(-50%) rotate(45deg);
}
.stage--ok .stage__value { color: var(--rb-success-text, #2E7D32); }
.stage--crit .stage__value { color: var(--rb-accent-text, #C62828); }

/* ── Short blood groups ── */
.group-bar--low .group-bar__fill { background: var(--rb-warning) !important; }
.group-bar__count { display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px; }
.group-bar__low { padding: 1px 6px; border-radius: 999px; background: rgba(245, 124, 0, 0.14); font-size: 10.5px; font-weight: 700; color: #B45309; }
html.dark .group-bar__low { color: #FFB74D; }

@media (max-width: 1200px) {
  .queue { grid-template-columns: minmax(0, 1fr); }
  .queue__actions { justify-content: flex-start; }
}

/* ===== Bento: the graphical dashboard (project owner, 2026-10-24) ===== */
.bento { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 16px; }
.bento__appts { grid-column: span 5; }
.bento__visits { grid-column: span 7; }
.bento__pool { grid-column: span 5; }
.bento__groups { grid-column: span 7; }

.dot--muted { background: var(--rb-text-muted, #94A3B8); }

/* Rings (.dial: Tailwind's ring utility owns .ring) */
.dial { position: relative; flex: none; width: 150px; height: 150px; }
.dial svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.dial__base { fill: none; stroke: rgba(var(--rb-primary-rgb), 0.08); stroke-width: 12; }
.dial__arc { fill: none; stroke: var(--rb-primary); stroke-width: 12; stroke-linecap: round; transition: stroke-dasharray 0.6s var(--rb-ease-out, ease); }
.dial__seg { fill: none; stroke-width: 12; }
.dial__seg--info { stroke: var(--rb-primary); }
.dial__seg--warn { stroke: var(--rb-warning); }
.dial__seg--ok { stroke: var(--rb-success); }
.dial__seg--muted { stroke: var(--rb-text-muted, #94A3B8); }
.dial__seg--neutral { stroke: var(--rb-border-strong, #CBD5E1); }
.dial__center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.dial__center strong { font-size: 26px; font-weight: 800; line-height: 1; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.dial__center small { margin-top: 3px; font-size: 11.5px; font-weight: 600; color: var(--rb-text-secondary); }
.dial--hero { width: 116px; height: 116px; }
.dial--hero .dial__center strong { font-size: 24px; }

.queue { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 24px; }
.queue .queue__stats { margin-top: 12px; }

.bento__appts { display: flex; flex-direction: column; }
.donut-row { display: flex; flex: 1; align-items: center; gap: 28px; padding: 8px 4px; }
.legend-list { display: flex; flex: 1; flex-direction: column; gap: 9px; margin: 0; padding: 0; list-style: none; font-size: 13px; }
.legend-list li { display: flex; align-items: center; gap: 8px; }
.legend-list__label { flex: 1; color: var(--rb-text-secondary); }
.legend-list__value { font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

/* Gauge */
.bento__pool { display: grid; grid-template-columns: 200px minmax(0, 1fr); align-items: center; gap: 20px; }
.gauge { position: relative; width: 200px; height: 118px; }
.gauge svg { width: 100%; height: 110px; }
.gauge__base, .gauge__arc { fill: none; stroke-width: 16; stroke-linecap: round; }
.gauge__base { stroke: rgba(var(--rb-primary-rgb), 0.08); }
.gauge__arc { stroke: var(--rb-success); transition: stroke-dasharray 0.6s var(--rb-ease-out, ease); }
.gauge__center { position: absolute; left: 0; right: 0; bottom: 4px; display: flex; flex-direction: column; align-items: center; }
.gauge__center strong { font-size: 28px; font-weight: 800; line-height: 1; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.gauge__center small { margin-top: 4px; font-size: 11.5px; font-weight: 600; color: var(--rb-text-secondary); }
.pool-list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; font-size: 13px; }
.pool-list li { display: flex; align-items: center; gap: 8px; }
.pool-list__label { display: flex; flex: 1; flex-direction: column; color: var(--rb-text-primary); font-weight: 600; }
.pool-list__label small { font-size: 11.5px; font-weight: 400; color: var(--rb-text-secondary); }
.pool-list__value { font-weight: 800; font-size: 15px; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

/* Capsule bars, the count above each */
.caps { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 12px; height: 200px; margin: 0; padding: 0; list-style: none; }
.caps--stages { height: 180px; }
.caps--days { height: 170px; margin-bottom: 4px; }
.cap { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
.cap__val { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 800; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.cap__tag { padding: 0 5px; border-radius: 5px; background: rgba(245, 158, 11, 0.16); font-size: 10px; font-weight: 700; color: var(--rb-warning-text, #B45309); }
.cap__track { position: relative; flex: 1; width: 100%; max-width: 44px; border-radius: 999px; background: rgba(var(--rb-primary-rgb), 0.06); overflow: hidden; }
.cap__fill { position: absolute; inset: auto 0 0; border-radius: 999px; background: var(--rb-primary); transition: height 0.5s var(--rb-ease-out, ease); }
.cap__label { display: flex; flex-direction: column; align-items: center; font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); text-align: center; white-space: nowrap; }
.cap__label small { font-size: 10.5px; font-weight: 500; color: var(--rb-text-muted); }
.cap__label--type { font-size: 13px; font-weight: 800; color: var(--rb-text-primary); }
.cap--info .cap__fill { background: var(--rb-primary); }
.cap--ok .cap__fill { background: var(--rb-success); }
.cap--warn .cap__fill { background: var(--rb-warning); }
.cap--crit .cap__fill { background: var(--rb-accent); }
.cap--neutral .cap__fill { background: rgba(var(--rb-primary-rgb), 0.35); }
.cap--low .cap__fill { background: var(--rb-warning); }

@media (prefers-reduced-motion: reduce) {
  .dial__arc, .gauge__arc, .cap__fill { transition: none; }
}
</style>
