<template>
  <div class="tdash">
    <div v-if="initialLoading" class="tdash-inner" aria-busy="true" aria-label="Loading the dashboard">
      <div class="skeleton-head">
        <div class="skeleton skeleton--header" />
        <div class="skeleton skeleton--sub" />
      </div>
      <div class="skeleton skeleton--row" />
      <div class="grid-2">
        <div class="skeleton skeleton--card" />
        <div class="skeleton skeleton--card" />
      </div>
      <div class="skeleton skeleton--panel" />
    </div>

    <div v-else class="tdash-inner">
      <header class="header-row">
        <div>
          <h1 class="page-title">Testing dashboard</h1>
          <p class="page-subtitle">Testing{{ data ? ` · ${longDate(data.today.date)}` : '' }}</p>
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
        <!-- ============ AT THE BENCH NOW ============ -->
        <section aria-labelledby="bench-title" class="section">
          <div class="section-head">
            <h2 id="bench-title" class="section-title">At the bench now</h2>
            <span class="section-meta">
              {{ plural(data.queue.total, 'unit') }} in the queue<template v-if="data.queue.oldest_drawn_at">
                · oldest drawn {{ ageLabel(data.queue.oldest_drawn_at) }} ago</template>
              <NuxtLink to="/blood-center/testing" class="card__link section-meta__link">
                Open the queue
                <AssetIcon name="arrow-right" :size="13" />
              </NuxtLink>
            </span>
          </div>

          <div class="kpi-row">
            <div v-for="kpi in queueKpis" :key="kpi.key" class="kpi">
              <p class="kpi__label">
                <span class="dot" :class="`dot--${kpi.tone}`" aria-hidden="true" />
                {{ kpi.label }}
              </p>
              <p class="kpi__value">{{ kpi.value }}</p>
              <p class="kpi__hint">{{ kpi.hint }}</p>
            </div>
          </div>
        </section>

        <!-- ============ TODAY + TIME TO CLEAR ============ -->
        <div class="grid-2">
          <article class="card">
            <div class="card__head">
              <div>
                <p class="card__label">Today at the bench</p>
                <p class="card__sub">Recorded since the start of the day</p>
              </div>
            </div>
            <ol class="stages" aria-label="Today's work">
              <li v-for="stage in todayRows" :key="stage.key" class="stage">
                <span class="stage__value">{{ stage.value }}</span>
                <span class="stage__label">
                  <span class="dot" :class="`dot--${stage.tone}`" aria-hidden="true" />
                  {{ stage.label }}
                </span>
              </li>
            </ol>
            <p class="card__note">A saved typing that was corrected today counts again.</p>
          </article>

          <article class="card">
            <div class="card__head">
              <div>
                <p class="card__label">Time to clear</p>
                <p class="card__value">{{ durationLabel(data.turnaround.median_hours) }}</p>
              </div>
            </div>
            <p class="card__sub">
              The median time from the draw to both sections cleared, over the last 30 days<template v-if="data.turnaround.units">,
                across <strong class="figure">{{ plural(data.turnaround.units, 'unit') }}</strong></template>.
            </p>
            <p v-if="!data.turnaround.units" class="card__note">No unit has been cleared at the bench in the last 30 days.</p>
          </article>
        </div>

        <div class="grid-main">
          <!-- ============ SEROLOGY TREND ============ -->
          <section aria-labelledby="trend-title" class="card trend">
            <div class="card__head">
              <div>
                <h2 id="trend-title" class="card__label card__label--title">Serology panels, last 30 days</h2>
                <p class="card__sub">
                  <strong class="figure">{{ totals.panels }}</strong> panels ·
                  <strong class="figure">{{ totals.reactive }}</strong> reactive
                </p>
              </div>
              <div class="trend__tools">
                <ul class="legend" aria-label="Legend">
                  <li><span class="legend__swatch legend__swatch--s1" aria-hidden="true" />Non-reactive</li>
                  <li><span class="legend__swatch legend__swatch--s2" aria-hidden="true" />Reactive</li>
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
                :aria-label="`Serology panels per day over the last 30 days: ${totals.panels} panels, ${totals.reactive} reactive. Use the left and right arrow keys to read each day.`"
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
                  <path v-if="col.clearPath" :d="col.clearPath" class="chart__s1" />
                  <path v-if="col.reactivePath" :d="col.reactivePath" class="chart__s2" />
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
                <p class="tooltip__row"><span class="tooltip__key tooltip__key--s1" aria-hidden="true" /><strong>{{ activeColumn.non_reactive }}</strong> non-reactive</p>
                <p class="tooltip__row"><span class="tooltip__key tooltip__key--s2" aria-hidden="true" /><strong>{{ activeColumn.reactive }}</strong> reactive</p>
              </div>

              <p v-if="!peak" class="chart__empty">No serology panels recorded in the last 30 days.</p>
            </div>

            <div v-if="showTable" class="trend-table-wrap">
              <table class="trend-table">
                <caption class="sr-only">Serology panels per day, newest first</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col" class="num">Non-reactive</th>
                    <th scope="col" class="num">Reactive</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="day in trendNewestFirst" :key="day.date">
                    <td>{{ weekday(day.date) }}, {{ dayMonth(day.date) }}</td>
                    <td class="num">{{ day.non_reactive }}</td>
                    <td class="num">{{ day.reactive }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <div class="side">
            <!-- ============ REACTIVE BY MARKER ============ -->
            <section aria-labelledby="markers-title" class="card">
              <div class="card__head">
                <div>
                  <h2 id="markers-title" class="card__label card__label--title">Reactive by marker</h2>
                  <p class="card__sub">Last 30 days. A panel reactive for two markers counts under both.</p>
                </div>
                <NuxtLink to="/blood-center/serology-results" class="card__link">
                  Results
                  <AssetIcon name="arrow-right" :size="13" />
                </NuxtLink>
              </div>

              <ul class="marker-bars">
                <li v-for="row in data.reactive_by_marker" :key="row.marker" class="marker-bar">
                  <span class="marker-bar__name">{{ row.label }}</span>
                  <span class="marker-bar__track">
                    <span v-if="row.count" class="marker-bar__fill" :style="{ width: markerWidth(row.count) }" />
                  </span>
                  <span class="marker-bar__count">{{ row.count }}</span>
                </li>
              </ul>
            </section>

            <!-- ============ FOR THE SUPERVISOR ============ -->
            <!-- Sent only to the roles that work them: verification and corrections
                 to the Laboratory Supervisor, referrals to whoever holds the list. -->
            <section v-if="data.approvals || data.referrals" aria-labelledby="supervisor-title" class="card">
              <div class="card__head">
                <div>
                  <h2 id="supervisor-title" class="card__label card__label--title">For the Laboratory Supervisor</h2>
                  <p class="card__sub">What waits for you to move it on.</p>
                </div>
              </div>

              <ul class="stat-list">
                <li v-for="row in supervisorRows" :key="row.key" class="stat-list__row">
                  <NuxtLink v-if="row.to" :to="row.to" class="stat-list__label stat-list__label--link">
                    <span class="dot" :class="`dot--${row.tone}`" aria-hidden="true" />
                    {{ row.label }}
                  </NuxtLink>
                  <span v-else class="stat-list__label">
                    <span class="dot" :class="`dot--${row.tone}`" aria-hidden="true" />
                    {{ row.label }}
                  </span>
                  <span class="stat-list__value">{{ row.value }}</span>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import TaskStrip from '~/components/BloodCenter/TaskStrip.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { columnPath, dayMonth, longDate, niceScale, plural, weekday } from '~/utils/collectionDashboard'
import { ageLabel, durationLabel, panelPeak, panelTotals } from '~/utils/testingDashboard'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

/**
 * The Testing department's dashboard (project owner, 2026-10-22): what waits
 * at the bench now, today's work, how long a unit takes to clear, and the
 * last 30 days of serology panels.
 *
 * Counts only. The technologists who read it work blind to identity, so it
 * names no donor and lists no unit.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  // As on the server: the marker split is for those who record the markers.
  requires: 'lab.record_serology',
})

const { can } = useUser()

/**
 * API SHAPE: GET /api/blood-center/laboratory/testing-dashboard
 * -------------------------------------------------------------------------
 *  { as_of, today: { date, typings, panels, reactive, cleared },
 *    queue: { total, awaiting_typing, typing_held, awaiting_serology,
 *      awaiting_verification, oldest_drawn_at },
 *    turnaround: { median_hours, units },          (last 30 days)
 *    reactive_by_marker: [{ marker, label, count }], (last 30 days)
 *    trend: [{ date, non_reactive, reactive }],      (30 days, oldest first)
 *    approvals: { corrections } | null,              (lab.verify_serology)
 *    referrals: { pending, referred, no_contact_request,
 *      closed_recently } | null }                    (lab.referrals)
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
    data.value = await bloodCenterService.testingDashboard()
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

/* ---------- at the bench ---------- */

const queueKpis = computed(() => {
  const q = data.value?.queue ?? {}
  return [
    { key: 'typing', label: 'Waiting for typing', value: q.awaiting_typing ?? 0, tone: 'info', hint: 'No ABO/Rh recorded yet' },
    { key: 'serology', label: 'Waiting for serology', value: q.awaiting_serology ?? 0, tone: 'info', hint: 'No panel recorded yet' },
    { key: 'verify', label: 'Reactive to verify', value: q.awaiting_verification ?? 0, tone: 'crit', hint: 'Held for the Laboratory Supervisor' },
    { key: 'held', label: 'Typing held', value: q.typing_held ?? 0, tone: 'warn', hint: 'Saved but not cleared' },
  ]
})

/* ---------- today ---------- */

const todayRows = computed(() => {
  const t = data.value?.today ?? {}
  return [
    { key: 'typings', label: 'Typings', value: t.typings ?? 0, tone: 'neutral' },
    { key: 'panels', label: 'Serology panels', value: t.panels ?? 0, tone: 'neutral' },
    { key: 'reactive', label: 'Reactive', value: t.reactive ?? 0, tone: 'crit' },
    { key: 'cleared', label: 'Units cleared', value: t.cleared ?? 0, tone: 'ok' },
  ]
})

/* ---------- markers ---------- */

const markerMax = computed(() => Math.max(1, ...(data.value?.reactive_by_marker ?? []).map((r) => r.count)))

function markerWidth(count) {
  return `${(count / markerMax.value) * 100}%`
}

/* ---------- supervisor ---------- */

const supervisorRows = computed(() => {
  const rows = []
  const approvals = data.value?.approvals
  const referrals = data.value?.referrals

  if (approvals) {
    rows.push(
      { key: 'verify', label: 'Reactive results to verify', value: data.value.queue.awaiting_verification, tone: 'crit', to: '/blood-center/serology-results?outcome=awaiting_verification' },
      { key: 'corrections', label: 'Corrections to decide', value: approvals.corrections, tone: 'warn', to: can('corrections.request') ? '/blood-center/corrections' : null },
    )
  }

  if (referrals) {
    const to = '/blood-center/counselling-referrals'
    rows.push(
      { key: 'no_contact', label: 'Referrals with no contact request', value: referrals.no_contact_request, tone: 'crit', to },
      { key: 'pending', label: 'Not yet referred to a doctor', value: referrals.pending, tone: 'warn', to },
      { key: 'open', label: 'Referred to doctor', value: referrals.referred, tone: 'info', to },
      { key: 'closed', label: 'Closed, last 30 days', value: referrals.closed_recently, tone: 'neutral', to: null },
    )
  }

  return rows
})

/* ---------- trend chart ---------- */

const trend = computed(() => data.value?.trend ?? [])
const totals = computed(() => panelTotals(trend.value))
const peak = computed(() => panelPeak(trend.value))
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
 * The column chart in pixels, drawn as the Collection dashboard draws its
 * own: one stacked column per day, non-reactive panels at the baseline and
 * reactive ones above, 2px of surface between, the rounded end on top.
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
    const clearHeight = (day.non_reactive / scale.max) * plotHeight
    const reactiveHeight = (day.reactive / scale.max) * plotHeight
    const reactiveBase = top + plotHeight - clearHeight - (day.non_reactive > 0 && day.reactive > 0 ? GAP : 0)

    return {
      ...day,
      bandX,
      bandWidth: band,
      center: bandX + band / 2,
      top: y(day.non_reactive + day.reactive),
      clearPath: columnPath(x, top + plotHeight - clearHeight, barWidth, clearHeight, day.reactive === 0),
      reactivePath: columnPath(x, reactiveBase - reactiveHeight, barWidth, reactiveHeight, true),
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
/* Chart colours: the Collection dashboard's categorical slots 1 and 2, so the
   two dashboards read alike. Text never takes a series colour. */
.tdash {
  --series-1: #2a78d6;
  --series-2: #eb6834;
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
}

:global(.dark .tdash) {
  --series-1: #3987e5;
  --series-2: #d95926;
}

.tdash-inner { display: flex; flex-direction: column; gap: 20px; }

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
.skeleton--row { height: 96px; }
.skeleton--card { height: 180px; }
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
.stat-list__label--link:focus-visible,
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
.section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }

.section-title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rb-text-secondary);
}

.section-meta { display: inline-flex; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; font-size: 12.5px; color: var(--rb-text-secondary); }

.grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.grid-main { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 14px; align-items: start; }
.side { display: flex; flex-direction: column; gap: 14px; min-width: 0; }

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
  gap: 12px;
  padding: 8px 0;
  border-top: 1px solid var(--rb-border);
  font-size: 13px;
}

.stat-list__row:first-child { border-top: 0; padding-top: 0; }
.stat-list__label { display: inline-flex; align-items: center; gap: 8px; color: var(--rb-text-secondary); }
.stat-list__label--link { text-decoration: none; }
.stat-list__label--link:hover { color: var(--rb-primary-text); text-decoration: underline; text-underline-offset: 3px; }
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

/* ---------- At the bench ---------- */
.kpi-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }

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

/* ---------- Markers ---------- */
.marker-bars { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }

.marker-bar { display: grid; grid-template-columns: minmax(0, 9.5rem) minmax(0, 1fr) 28px; align-items: center; gap: 10px; font-size: 13px; }
.marker-bar__name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.marker-bar__track { height: 10px; }

/* One series, the chart's reactive colour; the 4px end and the square base of a bar. */
.marker-bar__fill {
  display: block;
  height: 100%;
  min-width: 2px;
  border-radius: 0 4px 4px 0;
  background: var(--series-2);
}

.marker-bar__count { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }

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
  min-width: 140px;
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

/* ---------- Narrow screens ---------- */
@media (max-width: 1100px) {
  .grid-main { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 760px) {
  .grid-2 { grid-template-columns: minmax(0, 1fr); }
  .kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stages { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .spin { animation: none !important; }
  .chart__col { transition: none; }
}
</style>
