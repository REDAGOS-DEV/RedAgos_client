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
        <!-- ============ TODAY AT THE COUNTER ============ -->
        <section aria-labelledby="today-title" class="section">
          <h2 id="today-title" class="section-title">Today at the counter</h2>

          <div class="grid-2">
            <article class="card">
              <div class="card__head">
                <div>
                  <p class="card__label">Appointments today</p>
                  <p class="card__value">{{ data.today.appointments.total }}</p>
                </div>
                <NuxtLink v-if="can('appointments.view')" to="/blood-center/appointments" class="card__link">
                  Appointments
                  <AssetIcon name="arrow-right" :size="13" />
                </NuxtLink>
              </div>
              <ul class="stat-list">
                <li v-for="row in appointmentRows" :key="row.key" class="stat-list__row">
                  <span class="stat-list__label">
                    <span class="dot" :class="`dot--${row.tone}`" aria-hidden="true" />
                    {{ row.label }}
                  </span>
                  <span class="stat-list__value">{{ row.value }}</span>
                </li>
              </ul>
            </article>

            <article class="card">
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
              <ol class="stages" aria-label="Where today's visits have got to">
                <li v-for="stage in stageRows" :key="stage.key" class="stage">
                  <span class="stage__value">{{ stage.value }}</span>
                  <span class="stage__label">
                    <span class="dot" :class="`dot--${stage.tone}`" aria-hidden="true" />
                    {{ stage.label }}
                  </span>
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

          <div class="kpi-row">
            <div v-for="kpi in poolKpis" :key="kpi.key" class="kpi">
              <p class="kpi__label">
                <span class="dot" :class="`dot--${kpi.tone}`" aria-hidden="true" />
                {{ kpi.label }}
              </p>
              <p class="kpi__value">{{ kpi.value }}</p>
              <p class="kpi__hint">{{ kpi.hint }}</p>
            </div>
          </div>

          <article class="card">
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

            <ul class="group-bars">
              <li v-for="row in groupRows" :key="row.code" class="group-bar">
                <span class="group-bar__code">{{ row.code }}</span>
                <span class="group-bar__track">
                  <span class="group-bar__fill" :style="{ width: groupWidth(row.count) }" />
                </span>
                <span class="group-bar__count">{{ row.count }}</span>
              </li>
            </ul>
            <p v-if="data.pool.eligible_untyped" class="card__note">
              {{ plural(data.pool.eligible_untyped, 'eligible donor') }} not yet typed.
            </p>
          </article>
        </section>

        <div class="grid-main">
          <!-- ============ DONATION TREND ============ -->
          <section aria-labelledby="trend-title" class="card trend">
            <div class="card__head">
              <div>
                <h2 id="trend-title" class="card__label card__label--title">Donations, last 30 days</h2>
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
                :aria-label="`Donations per day over the last 30 days: ${totals.donations} donations and ${totals.deferrals} deferrals. Use the left and right arrow keys to read each day.`"
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

                <g
                  v-for="(col, i) in chart.columns"
                  :key="col.date"
                  class="chart__col"
                  :class="{ 'chart__col--dim': activeIndex !== null && activeIndex !== i }"
                >
                  <path v-if="col.donationPath" :d="col.donationPath" class="chart__s1" />
                  <path v-if="col.deferralPath" :d="col.deferralPath" class="chart__s2" />
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

              <p v-if="!peak" class="chart__empty">No donations or deferrals recorded in the last 30 days.</p>
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

            <ul class="days">
              <li v-for="day in data.upcoming.days" :key="day.date" class="day">
                <span class="day__name">{{ weekday(day.date) }}</span>
                <span class="day__date">{{ dayMonth(day.date) }}</span>
                <span class="day__track">
                  <span class="day__fill" :style="{ width: dayWidth(day.appointments) }" />
                </span>
                <span class="day__count">{{ day.appointments }}</span>
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
  columnPath,
  dayMonth,
  longDate,
  niceScale,
  plural,
  trendPeak,
  trendTotals,
  weekday,
} from '~/utils/collectionDashboard'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  // Every role at the counter holds it, and nothing outside the department does.
  requires: 'donations.view',
})

const { can } = useUser()

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
    { key: 'waiting', label: 'Waiting to arrive', value: a.waiting ?? 0, tone: 'neutral' },
    { key: 'in_progress', label: 'In progress', value: a.in_progress ?? 0, tone: 'warn' },
    { key: 'collected', label: 'Collected', value: a.collected ?? 0, tone: 'ok' },
    { key: 'no_show', label: 'No-show', value: a.no_show ?? 0, tone: 'neutral' },
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
const groupMax = computed(() => Math.max(1, ...groupRows.value.map((r) => r.count)))

function groupWidth(count) {
  return `${(count / groupMax.value) * 100}%`
}

/* ---------- coming up ---------- */

const dayMax = computed(() => Math.max(1, ...(data.value?.upcoming.days ?? []).map((d) => d.appointments)))

function dayWidth(count) {
  return `${(count / dayMax.value) * 100}%`
}

/* ---------- trend chart ---------- */

const trend = computed(() => data.value?.trend ?? [])
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
const GAP = 2

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
  const barWidth = Math.max(3, Math.min(24, band * 0.62))
  const y = (v) => top + plotHeight - (v / scale.max) * plotHeight

  const columns = days.map((day, i) => {
    const bandX = left + i * band
    const x = bandX + (band - barWidth) / 2
    const donationHeight = (day.donations / scale.max) * plotHeight
    const deferralHeight = (day.deferrals / scale.max) * plotHeight
    const deferralBase = top + plotHeight - donationHeight - (day.donations > 0 && day.deferrals > 0 ? GAP : 0)

    return {
      ...day,
      bandX,
      bandWidth: band,
      center: bandX + band / 2,
      top: y(day.donations + day.deferrals),
      donationPath: columnPath(x, top + plotHeight - donationHeight, barWidth, donationHeight, day.deferrals === 0),
      deferralPath: columnPath(x, deferralBase - deferralHeight, barWidth, deferralHeight, true),
    }
  })

  // A date label every 7 days, counted back from today so today is labelled.
  const xLabels = columns
    .map((col, i) => ({ col, i }))
    .filter(({ i }) => (days.length - 1 - i) % 7 === 0)
    .map(({ col, i }) => ({
      date: col.date,
      x: col.center,
      text: i === days.length - 1 ? 'Today' : dayMonth(col.date),
      anchor: i === days.length - 1 ? 'end' : (col.center - left < 20 ? 'start' : 'middle'),
    }))

  return {
    width,
    height: CHART_HEIGHT,
    left,
    right,
    top,
    plotHeight,
    columns,
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

.group-bar { display: grid; grid-template-columns: 34px minmax(0, 1fr) 36px; align-items: center; gap: 10px; font-size: 13px; }
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

.chart__s1 { fill: var(--series-1); }
.chart__s2 { fill: var(--series-2); }
.chart__col { transition: opacity 0.12s ease; }
.chart__col--dim { opacity: 0.45; }
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
</style>
