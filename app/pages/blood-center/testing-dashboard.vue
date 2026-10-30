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
        <!--
          Laid out as the Collection dashboard is (2026-10-24): the bench queue
          as a pipeline first, beside how long a unit takes to clear; today's
          work; the 30 days of panels as a curve beside the markers; and, for
          the Laboratory Supervisor, what waits to be moved on.
        -->
        <div class="bento">
          <!-- ============ AT THE BENCH NOW ============ -->
          <section class="card bench bento__bench" aria-labelledby="bench-title">
            <div class="card__head">
              <div>
                <h2 id="bench-title" class="card__label card__label--title">At the bench now</h2>
                <p class="bench__total">
                  <strong>{{ data.queue.total }}</strong>
                  {{ data.queue.total === 1 ? 'unit' : 'units' }} in the queue
                </p>
              </div>
              <NuxtLink to="/blood-center/testing" class="card__link">
                Open the queue
                <AssetIcon name="arrow-right" :size="13" />
              </NuxtLink>
            </div>

            <!-- Where the queue stands, stage by stage, as one bar. -->
            <div class="pipe" role="img" :aria-label="queueKpis.map(k => `${k.value} ${k.label.toLowerCase()}`).join(', ')">
              <template v-for="kpi in queueKpis" :key="kpi.key">
                <span v-if="kpi.value" class="pipe__seg" :class="`pipe__seg--${kpi.tone}`" :style="{ flexGrow: kpi.value }" />
              </template>
              <span v-if="!queueSum" class="pipe__seg pipe__seg--empty" />
            </div>

            <ul class="stages-row">
              <li v-for="kpi in queueKpis" :key="kpi.key" class="stage-cell" :class="`stage-cell--${kpi.tone}`">
                <span class="stage-cell__label"><span class="dot" :class="`dot--${kpi.tone}`" aria-hidden="true" />{{ kpi.label }}</span>
                <span class="stage-cell__value">{{ kpi.value }}</span>
              </li>
            </ul>

            <p v-if="data.queue.oldest_drawn_at" class="age" :class="`age--${oldestTone}`">
              <AssetIcon name="clock" :size="13" />
              Oldest unit drawn <strong>{{ ageLabel(data.queue.oldest_drawn_at) }}</strong> ago
            </p>
          </section>

          <!-- ============ TIME TO CLEAR ============ -->
          <section class="card clear bento__clear" aria-labelledby="clear-title">
            <h2 id="clear-title" class="card__label card__label--title">Time to clear</h2>
            <div class="clear__body">
              <div class="dial" role="img" :aria-label="`Median ${durationLabel(data.turnaround.median_hours)} from the draw to cleared`">
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle class="dial__base" cx="60" cy="60" r="50" />
                  <circle v-if="data.turnaround.units" class="dial__arc" :class="`dial__arc--${clearTone}`" cx="60" cy="60" r="50" :style="{ strokeDasharray: clearDash }" />
                </svg>
                <span class="dial__center">
                  <strong>{{ durationLabel(data.turnaround.median_hours) }}</strong>
                  <small>median</small>
                </span>
              </div>
            </div>
            <p v-if="!data.turnaround.units" class="card__note">No unit has been cleared at the bench in the last 30 days.</p>
          </section>

          <!-- ============ TODAY ============ -->
          <section class="card bento__today" aria-labelledby="today-title">
            <div class="card__head">
              <div>
                <h2 id="today-title" class="card__label card__label--title">Today at the bench</h2>
              </div>
            </div>
            <ol class="today" aria-label="Today's work">
              <li v-for="stage in todayRows" :key="stage.key" class="today__tile" :class="`today__tile--${stage.tone}`">
                <span class="today__icon"><AssetIcon :name="stage.icon" :size="18" /></span>
                <span class="today__value">{{ stage.value }}</span>
                <span class="today__label">{{ stage.label }}</span>
              </li>
            </ol>
          </section>

          <!-- ============ SEROLOGY TREND ============ -->
          <section aria-labelledby="trend-title" class="card trend bento__trend">
            <div class="card__head">
              <div>
                <h2 id="trend-title" class="card__label card__label--title">Serology panels, last 30 days</h2>
                <p class="card__sub">
                  <strong class="figure">{{ totals.panels }}</strong> panels ·
                  <strong class="figure">{{ totals.reactive }}</strong> reactive<template v-if="totals.panels">
                    (<strong class="figure">{{ reactiveRate }}%</strong>)</template>
                </p>
              </div>
              <div class="trend__tools">
                <ul class="legend" aria-label="Legend">
                  <li><span class="legend__line" aria-hidden="true" />Panels a day</li>
                  <li><span class="legend__dot" aria-hidden="true" />A day with a reactive panel</li>
                </ul>
                <button type="button" class="btn-outline btn-outline--sm" :aria-pressed="showTable" @click="showTable = !showTable">
                  <AssetIcon :name="showTable ? 'bar-chart' : 'list'" :size="13" />
                  {{ showTable ? 'Chart' : 'Table' }}
                </button>
              </div>
            </div>

            <div v-show="!showTable" class="tchart">
              <div class="tchart__y" aria-hidden="true">
                <span v-for="tick in [...trendScale.ticks].reverse()" :key="tick">{{ tick }}</span>
              </div>
              <div class="tchart__plot">
                <div class="tchart__grid" aria-hidden="true"><span v-for="tick in trendScale.ticks" :key="tick" /></div>
                <svg class="tchart__svg" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="td-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" class="tchart__stop tchart__stop--top" />
                      <stop offset="100%" class="tchart__stop tchart__stop--bottom" />
                    </linearGradient>
                  </defs>
                  <path v-if="curve.area" :d="curve.area" fill="url(#td-fill)" />
                  <path v-if="curve.line" :d="curve.line" class="tchart__line" vector-effect="non-scaling-stroke" />
                </svg>
                <div class="tchart__cols" role="img" :aria-label="`Serology panels per day over the last 30 days: ${totals.panels} panels, ${totals.reactive} reactive.`">
                  <div v-for="(day, i) in trend" :key="day.date" class="tchart__col" :class="{ 'tchart__col--reactive': day.reactive }">
                    <span class="tchart__dot" :style="{ bottom: `${pointHeight(day.non_reactive + day.reactive)}%` }">
                      <b v-if="day.reactive">{{ day.reactive }}</b>
                    </span>
                    <span class="tchart__tip" :style="{ bottom: `calc(${pointHeight(day.non_reactive + day.reactive)}% + 16px)` }">
                      <strong>{{ weekday(day.date) }}, {{ dayMonth(day.date) }}</strong>
                      <span>{{ day.non_reactive }} non-reactive</span>
                      <span>{{ day.reactive }} reactive</span>
                    </span>
                    <span v-if="(trend.length - 1 - i) % 7 === 0" class="tchart__x">{{ i === trend.length - 1 ? 'Today' : dayMonth(day.date) }}</span>
                  </div>
                </div>
                <p v-if="!peak" class="chart__empty">No serology panels recorded in the last 30 days.</p>
              </div>
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

          <!-- ============ REACTIVE BY MARKER ============ -->
          <section aria-labelledby="markers-title" class="card bento__markers">
            <div class="card__head">
              <div>
                <h2 id="markers-title" class="card__label card__label--title">Reactive by marker</h2>
              </div>
              <NuxtLink to="/blood-center/serology-results" class="card__link">
                Results
                <AssetIcon name="arrow-right" :size="13" />
              </NuxtLink>
            </div>

            <ul class="marker-bars">
              <li v-for="row in data.reactive_by_marker" :key="row.marker" class="marker-bar" :class="{ 'marker-bar--none': !row.count }">
                <span class="marker-bar__top">
                  <span class="marker-bar__name" :title="row.label">{{ row.label }}</span>
                  <span class="marker-bar__counts">
                    <span class="marker-bar__count">{{ row.count }} reactive</span>
                    <span class="marker-bar__nr">{{ Math.max(0, totals.panels - row.count) }} non-reactive</span>
                  </span>
                </span>
                <span class="marker-bar__track">
                  <span v-if="row.count" class="marker-bar__fill" :style="{ width: markerWidth(row.count) }" />
                </span>
              </li>
            </ul>
          </section>

          <!-- ============ FOR THE SUPERVISOR ============ -->
          <!-- Sent only to the roles that work them: verification and corrections
               to the Laboratory Supervisor, referrals to whoever holds the list. -->
          <section v-if="data.approvals || data.referrals" aria-labelledby="supervisor-title" class="card bento__super">
            <div class="card__head">
              <div>
                <h2 id="supervisor-title" class="card__label card__label--title">For the Laboratory Supervisor</h2>
              </div>
            </div>

            <ul class="super">
              <li v-for="row in supervisorRows" :key="row.key">
                <NuxtLink v-if="row.to" :to="row.to" class="super__tile" :class="[`super__tile--${row.tone}`, { 'super__tile--zero': !row.value }]">
                  <span class="super__value">{{ row.value }}</span>
                  <span class="super__label">{{ row.label }}</span>
                  <AssetIcon name="arrow-right" :size="13" class="super__go" />
                </NuxtLink>
                <span v-else class="super__tile" :class="[`super__tile--${row.tone}`, { 'super__tile--zero': !row.value }]">
                  <span class="super__value">{{ row.value }}</span>
                  <span class="super__label">{{ row.label }}</span>
                </span>
              </li>
            </ul>
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
import { dayMonth, niceScale, weekday } from '~/utils/collectionDashboard'
import { ageLabel, durationLabel, panelPeak, panelTotals } from '~/utils/testingDashboard'
import { smoothPath } from '~/utils/smoothPath'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

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
  }
}

/* ---------- at the bench ---------- */

const queueKpis = computed(() => {
  const q = data.value?.queue ?? {}
  return [
    { key: 'typing', label: 'Waiting for typing', value: q.awaiting_typing ?? 0, tone: 'info' },
    { key: 'serology', label: 'Waiting for serology', value: q.awaiting_serology ?? 0, tone: 'info' },
    { key: 'verify', label: 'Reactive to verify', value: q.awaiting_verification ?? 0, tone: 'crit' },
    { key: 'held', label: 'Typing held', value: q.typing_held ?? 0, tone: 'warn' },
  ]
})

const queueSum = computed(() => queueKpis.value.reduce((n, k) => n + k.value, 0))

/** How long the oldest unit has waited: amber past half a day, red past a day. */
const oldestTone = computed(() => {
  const at = data.value?.queue?.oldest_drawn_at
  if (!at) return 'ok'
  const hours = (Date.now() - new Date(at).getTime()) / 3_600_000
  return hours >= 24 ? 'crit' : hours >= 12 ? 'warn' : 'ok'
})

/* ---------- time to clear ---------- */

// The median against a day: the ring fills as a unit takes longer.
const DIAL = 2 * Math.PI * 50
const clearShare = computed(() => Math.min(1, (data.value?.turnaround?.median_hours ?? 0) / 24))
const clearDash = computed(() => `${(clearShare.value * DIAL).toFixed(1)} ${DIAL.toFixed(1)}`)
const clearTone = computed(() => (clearShare.value >= 1 ? 'crit' : clearShare.value >= 0.5 ? 'warn' : 'ok'))

/* ---------- today ---------- */

const todayRows = computed(() => {
  const t = data.value?.today ?? {}
  return [
    { key: 'typings', label: 'Typings', value: t.typings ?? 0, tone: 'info', icon: 'droplets' },
    { key: 'panels', label: 'Serology panels', value: t.panels ?? 0, tone: 'info', icon: 'flask-conical' },
    { key: 'reactive', label: 'Reactive', value: t.reactive ?? 0, tone: 'crit', icon: 'circle-alert' },
    { key: 'cleared', label: 'Units cleared', value: t.cleared ?? 0, tone: 'ok', icon: 'check-circle' },
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

const reactiveRate = computed(() => (totals.value.panels ? Math.round((totals.value.reactive / totals.value.panels) * 1000) / 10 : 0))

// Panels a day as one curve; a day with a reactive panel carries a red mark.
const trendScale = computed(() => niceScale(peak.value))
const pointHeight = (v) => Math.min(100, ((v || 0) / trendScale.value.max) * 100)
const curve = computed(() => {
  const n = trend.value.length
  if (n < 2) return { line: '', area: '' }
  const points = trend.value.map((d, i) => ({ x: ((i + 0.5) / n) * 1000, y: 200 - pointHeight(d.non_reactive + d.reactive) * 2 }))
  const line = smoothPath(points)
  return { line, area: `${line} L${points[n - 1].x},200 L${points[0].x},200 Z` }
})

/* ---------- lifecycle ---------- */

let timer = null

// Refreshes once a minute while the tab is visible, and as soon as it is shown again.
function onVisibility() {
  if (document.visibilityState === 'visible') load()
}

onMounted(async () => {
  await load()

  timer = setInterval(() => {
    if (document.visibilityState === 'visible') load()
  }, REFRESH_MS)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<style scoped>
/* Charts in the app's own colours: the primary blue for the work, red for
   what is reactive, as on the Collection dashboard. */
.tdash {
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
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
.btn-outline--sm:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); border-radius: 8px; }

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

/* ===== Bento (project owner, 2026-10-24) ===== */
.bento { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 16px; }
.bento__bench { grid-column: span 8; }
.bento__clear { grid-column: span 4; }
.bento__today { grid-column: span 12; }
.bento__trend { grid-column: span 8; }
.bento__markers { grid-column: span 4; }
.bento__super { grid-column: span 12; }

.card { border-radius: 18px; }

/* The bench */
.bench__total { margin: 6px 0 0; font-size: 14px; color: var(--rb-text-secondary); }
.bench__total strong { margin-right: 4px; font-size: 34px; font-weight: 800; line-height: 1; letter-spacing: -0.02em; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.pipe { display: flex; gap: 4px; height: 14px; margin: 4px 0; }
.pipe__seg { min-width: 10px; border-radius: 999px; }
.pipe__seg--info { background: var(--rb-primary); }
.pipe__seg--info + .pipe__seg--info { background: color-mix(in srgb, var(--rb-primary) 55%, transparent); }
.pipe__seg--warn { background: var(--rb-warning); }
.pipe__seg--crit { background: var(--rb-accent); }
.pipe__seg--empty { flex: 1; background: var(--rb-surface-alt); box-shadow: inset 0 0 0 1px var(--rb-border); }
.stages-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }
.stage-cell { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border: 1px solid var(--rb-border); border-radius: 14px; background: var(--rb-surface-alt); }
.stage-cell--crit:not(:has(.stage-cell__value:empty)) { border-color: rgba(var(--rb-accent-rgb), 0.3); background: rgba(var(--rb-accent-rgb), 0.05); }
.stage-cell__label { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.stage-cell__value { font-size: 26px; font-weight: 800; line-height: 1.05; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.age { display: inline-flex; align-self: flex-start; align-items: center; gap: 6px; margin: 0; padding: 5px 12px; border-radius: 999px; font-size: 12.5px; }
.age--ok { background: rgba(var(--rb-success-rgb), 0.1); color: var(--rb-success-text); }
.age--warn { background: rgba(var(--rb-warning-rgb), 0.12); color: var(--rb-warning-text); }
.age--crit { background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); }

/* Time to clear */
.clear__body { display: flex; flex: 1; align-items: center; gap: 18px; }
.dial { position: relative; flex: none; width: 132px; height: 132px; }
.dial svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.dial__base { fill: none; stroke: rgba(var(--rb-primary-rgb), 0.08); stroke-width: 11; }
.dial__arc { fill: none; stroke: var(--rb-success); stroke-width: 11; stroke-linecap: round; transition: stroke-dasharray 0.6s var(--rb-ease-out, ease); }
.dial__arc--warn { stroke: var(--rb-warning); }
.dial__arc--crit { stroke: var(--rb-accent); }
.dial__center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.dial__center strong { font-size: 24px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.dial__center small { margin-top: 3px; font-size: 11px; font-weight: 600; color: var(--rb-text-secondary); }

/* Today */
.today { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
.today__tile { --tone-rgb: var(--rb-primary-rgb); display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 12px; align-items: center; padding: 14px 16px; border: 1px solid var(--rb-border); border-radius: 14px; background: var(--rb-surface-alt); }
.today__tile--crit { --tone-rgb: var(--rb-accent-rgb); }
.today__tile--ok { --tone-rgb: var(--rb-success-rgb); }
.today__icon { display: grid; grid-row: span 2; place-items: center; width: 42px; height: 42px; border-radius: 12px; background: rgba(var(--tone-rgb), 0.12); color: rgb(var(--tone-rgb)); }
.today__value { font-size: 26px; font-weight: 800; line-height: 1.05; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.today__label { font-size: 12.5px; color: var(--rb-text-secondary); }

/* Trend */
.trend__tools { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.legend { display: flex; gap: 14px; margin: 0; padding: 0; list-style: none; font-size: 12px; color: var(--rb-text-secondary); }
.legend li { display: inline-flex; align-items: center; gap: 6px; }
.legend__line { width: 14px; height: 3px; border-radius: 2px; background: var(--rb-primary); }
.legend__dot { width: 9px; height: 9px; border-radius: 50%; background: var(--rb-accent); }

.tchart { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 8px; }
.tchart__y { display: flex; flex-direction: column; justify-content: space-between; height: 210px; font-size: 11px; text-align: right; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.tchart__y span { transform: translateY(-50%); }
.tchart__y span:last-child { transform: translateY(50%); }
.tchart__plot { position: relative; }
.tchart__grid, .tchart__svg { position: absolute; inset: 0 0 auto; height: 210px; }
.tchart__grid { display: flex; flex-direction: column-reverse; justify-content: space-between; pointer-events: none; }
.tchart__grid span { height: 1px; background: var(--rb-border); }
.tchart__svg { width: 100%; overflow: visible; pointer-events: none; }
.tchart__stop--top { stop-color: var(--rb-primary); stop-opacity: 0.22; }
.tchart__stop--bottom { stop-color: var(--rb-primary); stop-opacity: 0; }
.tchart__line { fill: none; stroke: var(--rb-primary); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.tchart__cols { position: relative; display: flex; height: 210px; padding-bottom: 24px; box-sizing: content-box; }
.tchart__col { position: relative; flex: 1; height: 100%; }
.tchart__col::before { content: ''; position: absolute; top: 0; bottom: 0; left: 50%; border-left: 1px dashed var(--rb-border-strong, var(--rb-border)); opacity: 0; transition: opacity 120ms ease; }
.tchart__col:hover::before { opacity: 1; }
.tchart__dot { position: absolute; left: 50%; width: 7px; height: 7px; border: 2px solid var(--rb-surface); border-radius: 50%; background: var(--rb-primary); opacity: 0; transform: translate(-50%, 50%); transition: opacity 120ms ease; }
.tchart__col:hover .tchart__dot { opacity: 1; }
/* A day with a reactive panel: a red mark with its count, always shown. */
.tchart__col--reactive .tchart__dot {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  background: var(--rb-accent);
  opacity: 1;
}
.tchart__dot b { font-size: 10px; font-weight: 800; color: #fff; }
.tchart__tip {
  position: absolute;
  left: 50%;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px 9px;
  border-radius: 8px;
  background: var(--rb-text-primary);
  font-size: 11.5px;
  white-space: nowrap;
  color: var(--rb-surface);
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%);
  transition: opacity 120ms ease;
}
.tchart__col:hover .tchart__tip { opacity: 1; }
.tchart__col:nth-child(-n + 3) .tchart__tip { left: 0; transform: none; }
.tchart__col:nth-last-child(-n + 3) .tchart__tip { left: auto; right: 0; transform: none; }
.tchart__x { position: absolute; top: calc(100% + 6px); left: 50%; font-size: 11px; white-space: nowrap; color: var(--rb-text-secondary); transform: translateX(-50%); }
.tchart__col:last-child .tchart__x { left: auto; right: 0; transform: none; }
.chart__empty { position: absolute; inset: 40% 0 auto; margin: 0; text-align: center; font-size: 13px; color: var(--rb-text-secondary); }

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

/* Markers */
.marker-bars { display: flex; flex-direction: column; gap: 14px; margin: 0; padding: 0; list-style: none; }
.marker-bar { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.marker-bar__top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.marker-bar__counts { display: inline-flex; flex: none; gap: 10px; font-size: 12px; font-variant-numeric: tabular-nums; }
.marker-bar__nr { color: var(--rb-text-secondary); }
.marker-bar__name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.marker-bar__track { height: 10px; border-radius: 999px; background: var(--rb-surface-alt); box-shadow: inset 0 0 0 1px var(--rb-border); overflow: hidden; }
.marker-bar__fill { display: block; height: 100%; border-radius: inherit; background: var(--rb-accent); }
.marker-bar__count { font-weight: 800; color: var(--rb-accent-text); }
.marker-bar--none { color: var(--rb-text-muted); }
.marker-bar--none .marker-bar__count { font-weight: 600; color: var(--rb-text-muted); }

/* Supervisor: what waits, each a tile that opens its list. */
.super { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
.super__tile {
  --tone-rgb: var(--rb-primary-rgb);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  padding: 14px 16px;
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface-alt);
  box-shadow: inset 3px 0 0 rgb(var(--tone-rgb));
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.super__tile--crit { --tone-rgb: var(--rb-accent-rgb); }
.super__tile--warn { --tone-rgb: var(--rb-warning-rgb); }
.super__tile--neutral { --tone-rgb: 148, 163, 184; }
.super__tile--zero { box-shadow: none; }
.super__tile--zero .super__value { color: var(--rb-text-muted); }
a.super__tile:hover { border-color: rgba(var(--tone-rgb), 0.5); background: rgba(var(--tone-rgb), 0.06); }
a.super__tile:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.super__value { font-size: 26px; font-weight: 800; line-height: 1.05; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.super__label { padding-right: 16px; font-size: 12.5px; line-height: 1.35; color: var(--rb-text-secondary); }
.super__go { position: absolute; top: 14px; right: 14px; color: var(--rb-text-muted); }
a.super__tile:hover .super__go { color: rgb(var(--tone-rgb)); }

/* ---------- Narrow screens ---------- */
@media (max-width: 1240px) {
  .super { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 1100px) {
  .bento__bench, .bento__clear, .bento__trend, .bento__markers { grid-column: span 12; }
}

@media (max-width: 760px) {
  .stages-row, .today { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .super { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .spin { animation: none !important; }
  .tchart__col::before, .tchart__dot, .tchart__tip, .dial__arc, .super__tile { transition: none; }
}
</style>
