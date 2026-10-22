<template>
  <div class="pdash">
    <div v-if="initialLoading" class="pdash-inner" aria-busy="true" aria-label="Loading the dashboard">
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

    <div v-else class="pdash-inner">
      <header class="header-row">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Processing{{ data ? ` · ${longDate(data.today.date)}` : '' }}</p>
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

      <div v-if="error" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ error }}</p>
        <button type="button" class="btn-link" @click="load">Retry</button>
      </div>

      <template v-if="data">
        <!-- ============ WITH PROCESSING NOW ============ -->
        <section aria-labelledby="bench-title" class="section">
          <div class="section-head">
            <h2 id="bench-title" class="section-title">With Processing now</h2>
            <span class="section-meta">
              {{ plural(data.queue.total, 'unit') }} not yet handed over<template v-if="data.queue.oldest_unseparated_at">
                · oldest unseparated drawn {{ ageLabel(data.queue.oldest_unseparated_at) }} ago</template>
              <NuxtLink to="/blood-center/laboratory" class="card__link section-meta__link">
                Component Processing
                <AssetIcon name="arrow-right" :size="13" />
              </NuxtLink>
              <NuxtLink to="/blood-center/processed?status=awaiting_handover" class="card__link section-meta__link">
                Processed list
                <AssetIcon name="arrow-right" :size="13" />
              </NuxtLink>
            </span>
          </div>

          <!-- In bench order: separate, wait for Testing, label, hand over (2026-10-22). -->
          <ol class="kpi-row" aria-label="Units by stage">
            <li v-for="kpi in queueKpis" :key="kpi.key" class="kpi">
              <p class="kpi__label">
                <span class="dot" :class="`dot--${kpi.tone}`" aria-hidden="true" />
                {{ kpi.label }}
              </p>
              <p class="kpi__value">{{ kpi.value }}</p>
              <p class="kpi__hint">{{ kpi.hint }}</p>
            </li>
          </ol>
        </section>

        <!-- ============ TODAY + TIME TO SEPARATE ============ -->
        <div class="grid-2">
          <article class="card">
            <div class="card__head">
              <div>
                <p class="card__label">Today</p>
                <p class="card__sub">Since the start of the day</p>
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
            <p class="card__note">A unit whose final labels were reprinted today counts once.</p>
          </article>

          <article class="card">
            <div class="card__head">
              <div>
                <p class="card__label">Time to separate</p>
                <p class="card__value">{{ durationLabel(data.separation.median_hours) }}</p>
              </div>
            </div>
            <p class="card__sub">
              The median time from the draw to the recorded breakdown, over the last 30 days<template v-if="data.separation.units">,
                across <strong class="figure">{{ plural(data.separation.units, 'unit') }}</strong></template>.
            </p>
            <ul class="stat-list">
              <li class="stat-list__row">
                <span class="stat-list__label">
                  <span class="dot dot--ok" aria-hidden="true" />
                  Cleared to handed over (median)
                </span>
                <span class="stat-list__value">{{ durationLabel(data.handover.median_hours) }}</span>
              </li>
            </ul>
            <p class="card__note">
              <template v-if="data.handover.units">How long cleared bags waited for their final labels and the hand-over, across {{ plural(data.handover.units, 'unit') }}.</template>
              <template v-else>No unit has been handed over after clearing in the last 30 days.</template>
            </p>
          </article>
        </div>

        <div class="grid-main">
          <!-- ============ BAGS TREND ============ -->
          <section aria-labelledby="trend-title" class="card trend">
            <div class="card__head">
              <div>
                <h2 id="trend-title" class="card__label card__label--title">Bags separated, last 30 days</h2>
                <p class="card__sub">
                  <strong class="figure">{{ totals.bags }}</strong> bags from
                  <strong class="figure">{{ totals.units }}</strong> units ·
                  <strong class="figure">{{ perUnit }}</strong> bags per unit
                </p>
              </div>
              <div class="trend__tools">
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
                :aria-label="`Bags separated per day over the last 30 days: ${totals.bags} bags from ${totals.units} units. Use the left and right arrow keys to read each day.`"
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
                  <path v-if="col.path" :d="col.path" class="chart__s1" />
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
                <p class="tooltip__row"><span class="tooltip__key tooltip__key--s1" aria-hidden="true" /><strong>{{ activeColumn.bags }}</strong> {{ activeColumn.bags === 1 ? 'bag' : 'bags' }}</p>
                <p class="tooltip__row"><strong>{{ activeColumn.units }}</strong> {{ activeColumn.units === 1 ? 'unit' : 'units' }} separated</p>
              </div>

              <p v-if="!peak" class="chart__empty">No bags separated in the last 30 days.</p>
            </div>

            <div v-if="showTable" class="trend-table-wrap">
              <table class="trend-table">
                <caption class="sr-only">Bags separated per day, newest first</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col" class="num">Units</th>
                    <th scope="col" class="num">Bags</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="day in trendNewestFirst" :key="day.date">
                    <td>{{ weekday(day.date) }}, {{ dayMonth(day.date) }}</td>
                    <td class="num">{{ day.units }}</td>
                    <td class="num">{{ day.bags }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <div class="side">
            <!-- ============ BAGS BY COMPONENT ============ -->
            <section aria-labelledby="components-title" class="card">
              <div class="card__head">
                <div>
                  <h2 id="components-title" class="card__label card__label--title">Bags by component</h2>
                  <p class="card__sub">Last 30 days, by the breakdown as it stands.</p>
                </div>
                <NuxtLink to="/blood-center/processed" class="card__link">
                  Processed
                  <AssetIcon name="arrow-right" :size="13" />
                </NuxtLink>
              </div>

              <ul v-if="data.by_component.length" class="bars">
                <li v-for="row in data.by_component" :key="row.component" class="bar">
                  <span class="bar__name" :title="row.component">{{ row.component }}</span>
                  <span class="bar__track">
                    <span class="bar__fill" :style="{ width: componentWidth(row.bags) }" />
                  </span>
                  <span class="bar__count">{{ row.bags }}</span>
                </li>
              </ul>
              <p v-else class="card__note">Nothing separated in the last 30 days.</p>
            </section>

            <!-- ============ FOR THE COMPONENT TECHNOLOGIST ============ -->
            <!-- Sent only to the one who decides corrections and hands over (lab.update_status). -->
            <section v-if="data.technologist" aria-labelledby="technologist-title" class="card">
              <div class="card__head">
                <div>
                  <h2 id="technologist-title" class="card__label card__label--title">For the component technologist</h2>
                  <p class="card__sub">What waits for you to move it on.</p>
                </div>
              </div>

              <ul class="stat-list">
                <li v-for="row in technologistRows" :key="row.key" class="stat-list__row">
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
import AssetIcon from '~/components/common/AssetIcon.vue'
import { columnPath, dayMonth, longDate, niceScale, plural, weekday } from '~/utils/collectionDashboard'
import { ageLabel, durationLabel } from '~/utils/testingDashboard'
import { bagPeak, bagTotals, bagsPerUnit } from '~/utils/processingDashboard'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

/**
 * The Processing department's dashboard (project owner, 2026-10-22): what
 * waits with Processing now, by stage, today's work, how quickly units are
 * separated and handed over, and the last 30 days of bags.
 *
 * Counts only. Processing works blind to identity, so it names no donor and
 * lists no unit.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  // As on the server: the department that records breakdowns.
  requires: 'lab.record_components',
})

/**
 * API SHAPE: GET /api/blood-center/laboratory/processing-dashboard
 * -------------------------------------------------------------------------
 *  { as_of, today: { date, separated, bags, labelled, handed_over },
 *    queue: { total, to_separate, awaiting_testing, to_label, to_hand_over,
 *      oldest_unseparated_at },
 *    separation: { median_hours, units },           (draw to breakdown, 30 days)
 *    handover: { median_hours, units },             (cleared to hand-over, 30 days)
 *    by_component: [{ component, bags }],           (30 days, most first)
 *    trend: [{ date, bags, units }],                (30 days, oldest first)
 *    technologist: { corrections, rejected_recently } | null }  (lab.update_status)
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
    data.value = await bloodCenterService.processingDashboard()
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

/* ---------- with Processing now ---------- */

const queueKpis = computed(() => {
  const q = data.value?.queue ?? {}
  return [
    { key: 'separate', label: 'To separate', value: q.to_separate ?? 0, tone: 'info', hint: 'Drawn, no breakdown yet' },
    { key: 'testing', label: 'Awaiting testing', value: q.awaiting_testing ?? 0, tone: 'neutral', hint: 'Separated; Testing has not cleared both' },
    { key: 'label', label: 'Ready to label', value: q.to_label ?? 0, tone: 'warn', hint: 'Cleared; print the final labels' },
    { key: 'handover', label: 'Ready to hand over', value: q.to_hand_over ?? 0, tone: 'ok', hint: 'Labelled; hand over to Issuance' },
  ]
})

/* ---------- today ---------- */

const todayRows = computed(() => {
  const t = data.value?.today ?? {}
  return [
    { key: 'separated', label: 'Units separated', value: t.separated ?? 0, tone: 'neutral' },
    { key: 'bags', label: 'Bags', value: t.bags ?? 0, tone: 'neutral' },
    { key: 'labelled', label: 'Units labelled', value: t.labelled ?? 0, tone: 'warn' },
    { key: 'handed_over', label: 'Handed over', value: t.handed_over ?? 0, tone: 'ok' },
  ]
})

/* ---------- components ---------- */

const componentMax = computed(() => Math.max(1, ...(data.value?.by_component ?? []).map((r) => r.bags)))

function componentWidth(bags) {
  return `${(bags / componentMax.value) * 100}%`
}

/* ---------- component technologist ---------- */

const technologistRows = computed(() => {
  const t = data.value?.technologist
  if (!t) return []

  return [
    { key: 'corrections', label: 'Breakdown corrections to decide', value: t.corrections, tone: 'warn', to: '/blood-center/processed?status=correction_pending' },
    { key: 'handover', label: 'Ready to hand over', value: data.value.queue.to_hand_over, tone: 'ok', to: '/blood-center/processed?status=awaiting_handover' },
    { key: 'rejected', label: 'Rejected by Processing, last 30 days', value: t.rejected_recently, tone: 'crit', to: null },
  ]
})

/* ---------- trend chart ---------- */

const trend = computed(() => data.value?.trend ?? [])
const totals = computed(() => bagTotals(trend.value))
const peak = computed(() => bagPeak(trend.value))
const perUnit = computed(() => bagsPerUnit(trend.value))
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
 * One column per day, drawn as the Collection and Testing dashboards draw
 * theirs: the rounded end on top, a date every 7 days counted back from today.
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
    const height = (day.bags / scale.max) * plotHeight

    return {
      ...day,
      bandX,
      bandWidth: band,
      center: bandX + band / 2,
      top: y(day.bags),
      path: columnPath(x, top + plotHeight - height, barWidth, height, true),
    }
  })

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

// The chart's box only exists once data has loaded; follow it rather than looking once.
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
/* Chart colour: the Collection dashboard's categorical slot 1, as on the
   Testing dashboard. Text never takes a series colour. */
.pdash {
  --series-1: #2a78d6;
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
}

:global(.dark .pdash) {
  --series-1: #3987e5;
}

.pdash-inner { display: flex; flex-direction: column; gap: 20px; }

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

/* ---------- With Processing now ---------- */
.kpi-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }

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

/* ---------- Components ---------- */
.bars { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }

.bar { display: grid; grid-template-columns: minmax(0, 9.5rem) minmax(0, 1fr) 32px; align-items: center; gap: 10px; font-size: 13px; }
.bar__name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar__track { height: 10px; }

/* One series, the chart's colour; the 4px end and the square base of a bar. */
.bar__fill {
  display: block;
  height: 100%;
  min-width: 2px;
  border-radius: 0 4px 4px 0;
  background: var(--series-1);
}

.bar__count { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }

/* ---------- Trend ---------- */
.trend__tools { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }

.chart { position: relative; min-height: 220px; }
.chart__svg { display: block; overflow: visible; }

.chart__grid line { stroke: var(--rb-border); stroke-width: 1; shape-rendering: crispEdges; }
.chart__grid text,
.chart__axis text { fill: var(--rb-text-secondary); font-size: 11px; font-variant-numeric: tabular-nums; }

.chart__s1 { fill: var(--series-1); }
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
