<template>
  <!--
    The Testing department's reports for a period (project owner, 2026-10-24):
    what the bench recorded, counted the way the Collection report counts its
    own. GET /blood-center/reports/testing (TestingReportService). Counts
    only; no donor is named.
  -->
  <div class="tr">
    <header class="tr__head">
      <div>
        <h1 class="tr__title">Reports &amp; Analytics</h1>
      </div>
      <div class="tr__tools">
        <SelectField
          :model-value="preset"
          class="tool-period"
          size="sm"
          icon="calendar"
          aria-label="Period"
          :options="PRESETS.map(p => ({ value: p.key, label: p.label }))"
          @update:model-value="choose"
        />
        <template v-if="preset === 'custom'">
          <DatePicker v-model="from" class="tool-date" :max="to || today" aria-label="From" size="sm" />
          <span class="tool-sep" aria-hidden="true">to</span>
          <DatePicker v-model="to" class="tool-date" :min="from" :max="today" aria-label="To" size="sm" />
        </template>
        <button type="button" class="export" :disabled="!data" @click="exportCsv">
          <AssetIcon name="download" :size="15" />
          Export CSV
        </button>
        <NuxtLink v-if="can(FORECAST_ABILITIES)" to="/blood-center/forecast" class="export export--link">
          <AssetIcon name="trending-up" :size="15" />
          Demand forecast
        </NuxtLink>
      </div>
    </header>

    <p v-if="error" class="tr__error" role="alert">
      {{ error }} <button type="button" class="link" @click="load">Try again</button>
    </p>

    <div v-if="loading && !data" class="kpis" aria-busy="true">
      <span v-for="n in 5" :key="n" class="kpi kpi--skeleton" />
    </div>

    <template v-else-if="data">
      <!-- ============ HEADLINES ============ -->
      <section class="kpis" aria-label="The period at a glance">
        <div v-for="k in kpis" :key="k.key" class="kpi" :class="`kpi--${k.tone}`">
          <span class="kpi__top">
            <span class="kpi__icon"><AssetIcon :name="k.icon" :size="18" /></span>
            <!-- The period day by day, as a small curve. -->
            <svg v-if="k.spark" class="kpi__spark" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true">
              <path :d="k.spark.area" class="kpi__spark-area" />
              <path :d="k.spark.line" class="kpi__spark-line" vector-effect="non-scaling-stroke" />
            </svg>
            <!-- Time to clear: the median against a day. -->
            <svg v-else-if="k.key === 'clear'" class="kpi__ring" viewBox="0 0 40 40" aria-hidden="true">
              <circle class="kpi__ring-base" cx="20" cy="20" r="15" />
              <circle v-if="clearShare" class="kpi__ring-arc" cx="20" cy="20" r="15" :stroke-dasharray="`${(clearShare * RING15).toFixed(1)} ${RING15.toFixed(1)}`" />
            </svg>
            <!-- Referrals: the four steps, each as tall as its count. -->
            <span v-else-if="k.key === 'referrals'" class="kpi__steps" aria-hidden="true">
              <span v-for="step in REF_STEPS" :key="step.key" :class="`kpi__step kpi__step--${step.tone}`" :style="{ height: `${Math.max(8, pct(data.referrals[step.key], refMax))}%` }" />
            </span>
          </span>
          <span class="kpi__label">{{ k.label }}</span>
          <span class="kpi__value">{{ k.value }}</span>
          <span class="kpi__note">
            <span v-if="k.delta" class="delta" :class="`delta--${k.delta.tone}`">{{ k.delta.text }}</span>
            {{ k.note }}
          </span>
        </div>
      </section>

      <div class="grid">
        <!-- ============ DAY BY DAY ============ -->
        <section class="card grid__wide" aria-labelledby="tr-daily">
          <header class="card__head">
            <div>
              <h2 id="tr-daily" class="card__title">Serology panels, day by day</h2>
              <p class="card__sub">
                <strong>{{ data.serology.tested }}</strong> panels · <strong>{{ data.serology.reactive }}</strong> reactive
              </p>
            </div>
            <div class="view-toggle" role="radiogroup" aria-label="View">
              <button type="button" role="radio" class="view-toggle__btn" :class="{ 'view-toggle__btn--on': view === 'chart' }" :aria-checked="view === 'chart'" @click="view = 'chart'">
                <AssetIcon name="bar-chart" :size="14" /> Chart
              </button>
              <button type="button" role="radio" class="view-toggle__btn" :class="{ 'view-toggle__btn--on': view === 'table' }" :aria-checked="view === 'table'" @click="view = 'table'">
                <AssetIcon name="list" :size="14" /> Table
              </button>
            </div>
          </header>

          <div v-if="view === 'chart'" class="chart">
            <div class="chart__y" aria-hidden="true">
              <span v-for="t in [...scale.ticks].reverse()" :key="t">{{ t }}</span>
            </div>
            <div class="chart__plot">
              <div class="chart__grid" aria-hidden="true"><span v-for="t in scale.ticks" :key="t" /></div>
              <svg class="chart__svg" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="tr-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" class="chart__stop chart__stop--top" />
                    <stop offset="100%" class="chart__stop chart__stop--bottom" />
                  </linearGradient>
                </defs>
                <path v-if="curve.area" :d="curve.area" fill="url(#tr-fill)" />
                <path v-if="curve.line" :d="curve.line" class="chart__line" vector-effect="non-scaling-stroke" />
              </svg>
              <div class="chart__cols" role="img" :aria-label="`Serology panels per day: ${data.serology.tested} panels, ${data.serology.reactive} reactive.`">
                <div v-for="(d, i) in data.daily" :key="d.date" class="chart__col" :class="{ 'chart__col--reactive': d.reactive }">
                  <span class="chart__dot" :style="{ bottom: `${pos(d.panels)}%` }"><b v-if="d.reactive">{{ d.reactive }}</b></span>
                  <span class="chart__tip" :style="{ bottom: `calc(${pos(d.panels)}% + 16px)` }">
                    <strong>{{ fmtWeekday(d.date) }}</strong>
                    <span>{{ d.panels }} panels · {{ d.reactive }} reactive</span>
                    <span>{{ d.typings }} typings</span>
                  </span>
                  <span v-if="showTick(i)" class="chart__x">{{ fmtDay(d.date) }}</span>
                </div>
              </div>
              <p v-if="!data.serology.tested" class="chart__empty">No serology panel was recorded in this period.</p>
            </div>
          </div>

          <div v-else class="table-wrap table-wrap--scroll">
            <table class="table">
              <thead><tr><th>Date</th><th class="num">Panels</th><th class="num">Reactive</th><th class="num">Typings</th></tr></thead>
              <tbody>
                <tr v-for="d in [...data.daily].reverse()" :key="d.date">
                  <td>{{ fmtWeekday(d.date) }}</td>
                  <td class="num">{{ d.panels }}</td>
                  <td class="num" :class="{ 'is-bad': d.reactive }">{{ d.reactive }}</td>
                  <td class="num">{{ d.typings }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- ============ BY MARKER ============ -->
        <section class="card" aria-labelledby="tr-markers">
          <header class="card__head">
            <div>
              <h2 id="tr-markers" class="card__title">Reactive by marker</h2>
            </div>
          </header>
          <!-- Each marker on two lines: its name and its counts, then the bar. -->
          <ul class="bars">
            <li v-for="m in data.serology.by_marker" :key="m.marker" class="bar" :class="{ 'bar--none': !m.reactive }">
              <span class="bar__top">
                <span class="bar__label" :title="m.label">{{ m.label }}</span>
                <span class="bar__counts" :title="m.rate === null ? 'No panels in the period' : `${m.rate}% of panels reactive`">
                  <span class="bar__r">{{ m.reactive }} reactive</span>
                  <span class="bar__nr">{{ data.serology.tested - m.reactive }} non-reactive</span>
                </span>
              </span>
              <span class="bar__track"><span :style="{ width: `${pct(m.reactive, markerMax)}%` }" /></span>
            </li>
          </ul>
        </section>
      </div>

      <!-- ============ THE TESTING RECORD, MONTH BY MONTH ============ -->
      <section class="card" aria-labelledby="tr-months">
        <header class="card__head">
          <div>
            <h2 id="tr-months" class="card__title">Testing record, month by month</h2>
          </div>
        </header>
        <div class="table-wrap">
          <table class="table table--record">
            <thead>
              <tr>
                <th>Month</th>
                <th class="num">Tested</th>
                <th class="num">Reactive</th>
                <th v-for="m in data.serology.by_marker" :key="m.marker" class="num">{{ m.label }}</th>
                <th class="num">Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in recordRows" :key="row.month" :class="{ 'table__total': row.month === 'total' }">
                <td>{{ row.month === 'total' ? 'Total' : fmtMonth(row.month) }}</td>
                <td class="num strong">{{ row.tested }}</td>
                <td class="num" :class="{ 'is-bad': row.reactive }">{{ row.reactive }}</td>
                <td v-for="m in data.serology.by_marker" :key="m.marker" class="num" :class="{ 'is-bad': row.markers[m.marker] }">{{ row.markers[m.marker] }}</td>
                <td class="num muted">{{ row.tested ? `${Math.round((row.reactive / row.tested) * 1000) / 10}%` : '—' }}</td>
              </tr>
              <tr v-if="!data.months.length"><td :colspan="4 + data.serology.by_marker.length" class="muted">No panel was recorded in this period.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ============ WHO WAS TESTED ============ -->
      <section class="profile" aria-label="Who was tested">
        <article v-for="group in PROFILE_GROUPS" :key="group.key" class="card">
          <header class="card__head">
            <div>
              <h2 class="card__title">{{ group.title }}</h2>
            </div>
          </header>
          <ul class="prows">
            <li v-for="row in data.profile[group.key]" :key="row.key" class="prow" :class="{ 'prow--none': !row.tested }">
              <span class="prow__label">{{ row.label }}</span>
              <span class="prow__track" :title="`${row.tested} tested, ${row.reactive} reactive`">
                <span class="prow__tested" :style="{ width: `${pct(row.tested, profileMax(group.key))}%` }" />
                <span class="prow__reactive" :style="{ width: `${pct(row.reactive, profileMax(group.key))}%` }" />
              </span>
              <span class="prow__value">{{ row.tested }}</span>
              <span class="prow__rate" :class="{ 'is-bad': row.reactive }">{{ row.reactive ? `${row.reactive} R` : '—' }}</span>
            </li>
          </ul>
        </article>
      </section>

      <div class="grid grid--even">
        <!-- ============ TYPING ============ -->
        <section class="card" aria-labelledby="tr-typing">
          <header class="card__head">
            <div>
              <h2 id="tr-typing" class="card__title">Typings by blood group</h2>
              <p class="card__sub"><strong>{{ data.typing.typed }}</strong> typings recorded, corrections included.</p>
            </div>
          </header>
          <div class="typing">
            <div class="donut" role="img" :aria-label="data.typing.by_group.map(g => `${g.code} ${g.count}`).join(', ') || 'No typings'">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle class="donut__base" cx="60" cy="60" r="46" />
                <circle
                  v-for="seg in groupArcs"
                  :key="seg.code"
                  class="donut__seg"
                  cx="60"
                  cy="60"
                  r="46"
                  :style="{ stroke: seg.color, strokeDasharray: `${seg.length} ${RING46}`, strokeDashoffset: -seg.offset }"
                />
              </svg>
              <span class="donut__center">
                <strong>{{ data.typing.typed }}</strong>
                <small>{{ data.typing.typed === 1 ? 'typing' : 'typings' }}</small>
              </span>
            </div>
            <ul v-if="data.typing.by_group.length" class="glegend">
              <li v-for="seg in groupArcs" :key="seg.code" class="glegend__item">
                <i :style="{ background: seg.color }" aria-hidden="true" />
                <span class="glegend__code">{{ seg.code }}</span>
                <span class="glegend__count">{{ seg.count }}</span>
                <span class="glegend__pct">{{ seg.pct }}%</span>
              </li>
            </ul>
            <p v-else class="typing__empty">
              No typing was recorded in this period. Each confirmed ABO/Rh typing at the bench is counted here by blood group.
            </p>
          </div>
        </section>

        <!-- ============ REFERRALS ============ -->
        <section class="card" aria-labelledby="tr-referrals">
          <header class="card__head">
            <div>
              <h2 id="tr-referrals" class="card__title">Counselling referrals</h2>
            </div>
          </header>
          <!-- From opened to closed, each step as wide as its count. -->
          <ol class="funnel">
            <li v-for="step in REF_STEPS" :key="step.key" class="funnel__row" :class="`funnel__row--${step.tone}`">
              <span class="funnel__label">{{ step.label }}</span>
              <span class="funnel__track">
                <span class="funnel__bar" :style="{ width: `${data.referrals[step.key] ? Math.max(6, pct(data.referrals[step.key], refMax)) : 0}%` }" />
              </span>
              <span class="funnel__value">{{ data.referrals[step.key] }}</span>
            </li>
          </ol>
          <p v-if="!refMax" class="typing__empty">No referral was opened or moved in this period.</p>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import SelectField from '~/components/common/SelectField.vue'
import { FORECAST_ABILITIES } from '~/composables/useBloodCenterNav'
import { niceScale } from '~/utils/collectionDashboard'
import { smoothPath } from '~/utils/smoothPath'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

const { user, can } = useUser()
const facilityName = computed(() => user.value?.facility?.facility_name || 'Your blood center')

const PRESETS = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'last-quarter', label: 'Last quarter' },
  { key: 'custom', label: 'Custom range' },
]
const PROFILE_GROUPS = [
  { key: 'kind', title: 'Type of donor' },
  { key: 'sex', title: 'Sex' },
  { key: 'age', title: 'Age bracket' },
]
const REF_STEPS = [
  // Pending, referred to doctor, closed: there is no "contacted" step
  // (project owner, 2026-10-26).
  { key: 'opened', label: 'Opened', tone: 'crit' },
  { key: 'referred', label: 'Referred to doctor', tone: 'info' },
  { key: 'closed', label: 'Closed', tone: 'ok' },
]

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = iso(new Date())
const daysAgo = n => iso(new Date(Date.now() - n * 86_400_000))

const preset = ref('30')
const from = ref(daysAgo(29))
const to = ref(today)
const data = ref(null)
const loading = ref(false)
const error = ref('')
const view = ref('chart')

function choose(key) {
  preset.value = key
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3) * 3
  if (key === '7') { from.value = daysAgo(6); to.value = today }
  if (key === '30') { from.value = daysAgo(29); to.value = today }
  if (key === 'month') { from.value = `${today.slice(0, 8)}01`; to.value = today }
  if (key === 'last-month') {
    from.value = iso(new Date(now.getFullYear(), now.getMonth() - 1, 1))
    to.value = iso(new Date(now.getFullYear(), now.getMonth(), 0))
  }
  if (key === 'quarter') { from.value = iso(new Date(now.getFullYear(), q, 1)); to.value = today }
  if (key === 'last-quarter') {
    from.value = iso(new Date(now.getFullYear(), q - 3, 1))
    to.value = iso(new Date(now.getFullYear(), q, 0))
  }
}

async function load() {
  if (!from.value || !to.value) return
  loading.value = true
  error.value = ''
  try {
    data.value = await bloodCenterService.testingReport({ from: from.value, to: to.value })
  } catch (err) {
    error.value = err?.data?.message || err?.message || 'The report could not be loaded.'
  } finally {
    loading.value = false
  }
}
watch([from, to], load)
onMounted(load)

const fmtDay = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const fmtWeekday = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const fmtMonth = m => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
const pct = (n, max) => Math.round(((n || 0) / Math.max(1, max)) * 100)

/** The change against the period before, as long. */
function delta(now, before, { lowerIsBetter = false } = {}) {
  if (!before && !now) return null
  if (!before) return { text: 'new', tone: 'flat' }
  const change = Math.round(((now - before) / before) * 100)
  if (change === 0) return { text: 'no change', tone: 'flat' }
  const good = lowerIsBetter ? change < 0 : change > 0
  return { text: `${change > 0 ? '+' : ''}${change}%`, tone: good ? 'good' : 'bad' }
}

// A small curve of one daily figure, for a headline.
function spark(key) {
  const days = data.value?.daily ?? []
  const n = days.length
  if (n < 2) return null
  const top = Math.max(1, ...days.map(d => d[key] ?? 0))
  const points = days.map((d, i) => ({ x: (i / (n - 1)) * 120, y: 36 - ((d[key] ?? 0) / top) * 32 }))
  const line = smoothPath(points)
  return { line, area: `${line} L120,40 L0,40 Z` }
}
const vsBefore = (now, before) => (now || before ? 'vs the period before' : 'Nothing in either period')

const RING15 = 2 * Math.PI * 15
const clearShare = computed(() => Math.min(1, (data.value?.turnaround.median_hours ?? 0) / 24))
const refMax = computed(() => Math.max(0, ...REF_STEPS.map(s => data.value?.referrals[s.key] ?? 0)))

const kpis = computed(() => {
  const d = data.value
  const hours = d.turnaround.median_hours
  return [
    { key: 'tested', label: 'Panels tested', value: d.serology.tested, icon: 'flask-conical', tone: 'info', spark: spark('panels'), delta: delta(d.serology.tested, d.previous.tested), note: vsBefore(d.serology.tested, d.previous.tested) },
    { key: 'reactive', label: 'Reactive', value: d.serology.reactive, icon: 'circle-alert', tone: d.serology.reactive ? 'crit' : 'ok', spark: spark('reactive'), delta: null, note: d.serology.reactive_rate === null ? 'No panels in the period' : `${d.serology.reactive_rate}% of panels${d.serology.awaiting_verification ? `, ${d.serology.awaiting_verification} awaiting verification` : ''}` },
    { key: 'typed', label: 'Typings', value: d.typing.typed, icon: 'droplets', tone: 'info', spark: spark('typings'), delta: delta(d.typing.typed, d.previous.typed), note: vsBefore(d.typing.typed, d.previous.typed) },
    { key: 'clear', label: 'Time to clear', value: hours === null ? '—' : `${hours} h`, icon: 'clock', tone: hours === null ? 'muted' : hours >= 24 ? 'crit' : hours >= 12 ? 'warn' : 'ok', delta: null, note: d.turnaround.units ? `Median of ${d.turnaround.units} units cleared` : 'No unit cleared in the period' },
    { key: 'referrals', label: 'Referrals opened', value: d.referrals.opened, icon: 'life-buoy', tone: d.referrals.opened ? 'warn' : 'muted', delta: null, note: `${d.referrals.closed} closed in the period` },
  ]
})

// ── Day by day ──
const scale = computed(() => niceScale(Math.max(0, ...(data.value?.daily ?? []).map(d => d.panels))))
const pos = v => Math.min(100, ((v || 0) / scale.value.max) * 100)
const curve = computed(() => {
  const days = data.value?.daily ?? []
  const n = days.length
  if (n < 2) return { line: '', area: '' }
  const points = days.map((d, i) => ({ x: ((i + 0.5) / n) * 1000, y: 200 - pos(d.panels) * 2 }))
  const line = smoothPath(points)
  return { line, area: `${line} L${points[n - 1].x},200 L${points[0].x},200 Z` }
})
const showTick = (i) => {
  const n = data.value?.daily.length ?? 0
  return i % Math.max(1, Math.ceil(n / 6)) === 0
}

const markerMax = computed(() => Math.max(1, ...(data.value?.serology.by_marker ?? []).map(m => m.reactive)))
const recordRows = computed(() => (data.value?.months.length ? [...data.value.months, data.value.total] : []))
const profileMax = key => Math.max(1, ...(data.value?.profile[key] ?? []).map(r => r.tested))
// The blood groups as a ring: blues for the positives, reds for the negatives.
const GROUP_COLORS = { 'O+': '#1565C0', 'A+': '#42A5F5', 'B+': '#26A69A', 'AB+': '#7E57C2', 'O-': '#C62828', 'A-': '#EF5350', 'B-': '#FF8A65', 'AB-': '#AD1457' }
const RING46 = 2 * Math.PI * 46
const groupArcs = computed(() => {
  const groups = data.value?.typing.by_group ?? []
  const total = groups.reduce((n, g) => n + g.count, 0)
  let offset = 0
  return groups.map((g) => {
    const length = total ? (g.count / total) * RING46 : 0
    const seg = { code: g.code, count: g.count, pct: total ? Math.round((g.count / total) * 100) : 0, color: GROUP_COLORS[g.code] ?? '#94A3B8', length, offset }
    offset += length
    return seg
  })
})

// ── Export ──
function exportCsv() {
  if (!data.value) return
  const d = data.value
  const markers = d.serology.by_marker
  const rows = [
    [`${facilityName.value} Testing report`, `${d.period.from} to ${d.period.to}`],
    [],
    ['Figure', 'Value'],
    ...kpis.value.map(k => [k.label, k.value]),
    [],
    ['Month', 'Tested', 'Reactive', ...markers.map(m => m.label)],
    ...recordRows.value.map(r => [r.month === 'total' ? 'Total' : r.month, r.tested, r.reactive, ...markers.map(m => r.markers[m.marker])]),
  ]
  for (const group of PROFILE_GROUPS) {
    rows.push([], [group.title, 'Tested', 'Reactive', 'Rate (%)'])
    d.profile[group.key].forEach(r => rows.push([r.label, r.tested, r.reactive, r.rate ?? '']))
  }
  rows.push([], ['Blood group', 'Typings'], ...d.typing.by_group.map(g => [g.code, g.count]))
  rows.push([], ['Referrals', 'Count'], ...REF_STEPS.map(s => [s.label, d.referrals[s.key]]))
  rows.push([], ['Date', 'Panels', 'Reactive', 'Typings'], ...d.daily.map(x => [x.date, x.panels, x.reactive, x.typings]))

  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `redagos-testing-report-${d.period.from}-to-${d.period.to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.tr { display: flex; flex-direction: column; gap: 18px; max-width: var(--rb-content-max, 1600px); margin: 0 auto; padding: 24px var(--rb-gutter, 24px) 40px; font-family: var(--rb-font-sans); color: var(--rb-text-primary); }
.tr__head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px 20px; }
.tr__title { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
.tr__tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.tool-period { width: 190px; flex: none; }
.tool-date { width: 150px; }
.tool-sep { font-size: 12.5px; color: var(--rb-text-secondary); }
.export { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border: 1px solid var(--rb-border-strong, var(--rb-border)); border-radius: 8px; background: var(--rb-surface); font: inherit; font-size: 13px; font-weight: 600; color: var(--rb-text-primary); text-decoration: none; cursor: pointer; }
.export:hover:not(:disabled) { border-color: rgba(var(--rb-primary-rgb), 0.45); }
.export:disabled { opacity: 0.5; cursor: not-allowed; }
.export--link { color: var(--rb-primary-text); }
.tr__error { margin: 0; padding: 10px 14px; border-radius: 12px; background: rgba(var(--rb-accent-rgb), 0.08); font-size: 13px; color: var(--rb-accent-text); }
.link { border: 0; background: none; padding: 0; font: inherit; font-weight: 700; color: inherit; text-decoration: underline; cursor: pointer; }

/* Headlines */
.kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.kpi { --tone-rgb: var(--rb-primary-rgb); display: flex; flex-direction: column; gap: 4px; min-height: 140px; padding: 16px; border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface); }
.kpi--crit { --tone-rgb: var(--rb-accent-rgb); }
.kpi--warn { --tone-rgb: var(--rb-warning-rgb); }
.kpi--ok { --tone-rgb: var(--rb-success-rgb); }
.kpi--muted { --tone-rgb: 148, 163, 184; }
.kpi--skeleton { background: var(--rb-skeleton-a, #EEF1F5); border: 0; }
.kpi__icon { display: grid; place-items: center; width: 34px; height: 34px; margin-bottom: 6px; border-radius: 10px; background: rgba(var(--tone-rgb), 0.12); color: rgb(var(--tone-rgb)); }
.kpi__label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); }
.kpi__value { font-size: 28px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }
.kpi--crit .kpi__value { color: var(--rb-accent-text); }
.kpi__note { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; color: var(--rb-text-secondary); }
.delta { padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.delta--good { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.delta--bad { background: rgba(var(--rb-warning-rgb), 0.14); color: var(--rb-warning-text); }
.delta--flat { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

.grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; }
.grid--even { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.card { display: flex; flex-direction: column; gap: 14px; min-width: 0; padding: 18px 20px; border: 1px solid var(--rb-border); border-radius: 18px; background: var(--rb-surface); }
.card__head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 10px; }
.card__title { margin: 0; font-size: 15px; font-weight: 700; }
.card__sub { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.card__sub strong { color: var(--rb-text-primary); }
.muted { color: var(--rb-text-secondary); font-size: 13px; }
.is-bad { font-weight: 800; color: var(--rb-accent-text); }

.view-toggle { display: inline-flex; padding: 3px; border: 1px solid var(--rb-border); border-radius: 10px; background: var(--rb-surface-alt); }
.view-toggle__btn { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border: 0; border-radius: 7px; background: transparent; font: inherit; font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.view-toggle__btn--on { background: var(--rb-surface); color: var(--rb-primary-text); box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.1); }

/* Chart */
.chart { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 8px; }
.chart__y { display: flex; flex-direction: column; justify-content: space-between; height: 220px; font-size: 11px; text-align: right; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.chart__y span { transform: translateY(-50%); }
.chart__y span:last-child { transform: translateY(50%); }
.chart__plot { position: relative; }
.chart__grid, .chart__svg { position: absolute; inset: 0 0 auto; height: 220px; }
.chart__grid { display: flex; flex-direction: column-reverse; justify-content: space-between; pointer-events: none; }
.chart__grid span { height: 1px; background: var(--rb-border); }
.chart__svg { width: 100%; overflow: visible; pointer-events: none; }
.chart__stop--top { stop-color: var(--rb-primary); stop-opacity: 0.22; }
.chart__stop--bottom { stop-color: var(--rb-primary); stop-opacity: 0; }
.chart__line { fill: none; stroke: var(--rb-primary); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.chart__cols { position: relative; display: flex; height: 220px; padding-bottom: 24px; box-sizing: content-box; }
.chart__col { position: relative; flex: 1; height: 100%; }
.chart__col::before { content: ''; position: absolute; top: 0; bottom: 0; left: 50%; border-left: 1px dashed var(--rb-border-strong, var(--rb-border)); opacity: 0; transition: opacity 120ms ease; }
.chart__col:hover::before { opacity: 1; }
.chart__dot { position: absolute; left: 50%; width: 7px; height: 7px; border: 2px solid var(--rb-surface); border-radius: 50%; background: var(--rb-primary); opacity: 0; transform: translate(-50%, 50%); }
.chart__col:hover .chart__dot { opacity: 1; }
.chart__col--reactive .chart__dot { display: grid; place-items: center; width: 18px; height: 18px; background: var(--rb-accent); opacity: 1; }
.chart__dot b { font-size: 10px; font-weight: 800; color: #fff; }
.chart__tip { position: absolute; left: 50%; z-index: 2; display: flex; flex-direction: column; gap: 1px; padding: 6px 9px; border-radius: 8px; background: var(--rb-text-primary); font-size: 11.5px; white-space: nowrap; color: var(--rb-surface); opacity: 0; pointer-events: none; transform: translateX(-50%); transition: opacity 120ms ease; }
.chart__col:hover .chart__tip { opacity: 1; }
.chart__col:nth-child(-n + 3) .chart__tip { left: 0; transform: none; }
.chart__col:nth-last-child(-n + 3) .chart__tip { left: auto; right: 0; transform: none; }
.chart__x { position: absolute; top: calc(100% + 6px); left: 50%; font-size: 11px; white-space: nowrap; color: var(--rb-text-secondary); transform: translateX(-50%); }
.chart__empty { position: absolute; top: 90px; left: 50%; margin: 0; padding: 6px 12px; border-radius: 999px; background: var(--rb-surface); box-shadow: 0 0 0 1px var(--rb-border); font-size: 12.5px; white-space: nowrap; color: var(--rb-text-secondary); transform: translateX(-50%); }

/* Bars */
.bars, .prows { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
.bar { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.bar__top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.bar__label { overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.bar__counts { display: inline-flex; flex: none; gap: 10px; font-size: 12px; font-variant-numeric: tabular-nums; }
.bar__r { font-weight: 800; color: var(--rb-accent-text); }
.bar--none .bar__r { font-weight: 600; color: var(--rb-text-muted); }
.bar__nr { color: var(--rb-text-secondary); }
.bar__track { height: 10px; border-radius: 999px; background: var(--rb-surface-alt); box-shadow: inset 0 0 0 1px var(--rb-border); overflow: hidden; }
.bar__track > span { display: block; height: 100%; border-radius: inherit; background: var(--rb-accent); }
.bar--none { color: var(--rb-text-muted); }

/* Tables */
.table-wrap { overflow-x: auto; }
.table-wrap--scroll { max-height: 340px; overflow: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.table th { position: sticky; top: 0; padding: 9px 10px; border-bottom: 1px solid var(--rb-border); background: var(--rb-surface-alt); font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-align: left; text-transform: uppercase; color: var(--rb-text-secondary); white-space: nowrap; }
.table td { padding: 10px; border-bottom: 1px solid var(--rb-border); white-space: nowrap; }
.table .num { text-align: right; }
.table .strong { font-weight: 700; }
.table__total td { border-top: 2px solid var(--rb-border-strong, var(--rb-border)); border-bottom: 0; background: var(--rb-surface-alt); font-weight: 800; }

/* Who was tested */
.profile { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.prow { display: grid; grid-template-columns: minmax(0, 5.5rem) minmax(0, 1fr) 32px 44px; align-items: center; gap: 10px; font-size: 13px; }
.prow__label { font-weight: 600; }
.prow__track { position: relative; height: 10px; border-radius: 999px; background: var(--rb-surface-alt); box-shadow: inset 0 0 0 1px var(--rb-border); overflow: hidden; }
.prow__tested, .prow__reactive { position: absolute; inset: 0 auto 0 0; border-radius: inherit; }
.prow__tested { background: color-mix(in srgb, var(--rb-primary) 55%, transparent); }
.prow__reactive { background: var(--rb-accent); }
.prow__value { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
.prow__rate { text-align: right; font-size: 12px; color: var(--rb-text-muted); }
.prow--none { color: var(--rb-text-muted); }


/* KPI graphics */
.kpi__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
.kpi__top .kpi__icon { margin-bottom: 0; }
.kpi__spark { width: 96px; height: 34px; overflow: visible; }
.kpi__spark-area { fill: rgba(var(--tone-rgb), 0.14); }
.kpi__spark-line { fill: none; stroke: rgb(var(--tone-rgb)); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.kpi__ring { width: 38px; height: 38px; transform: rotate(-90deg); }
.kpi__ring-base { fill: none; stroke: rgba(var(--tone-rgb), 0.14); stroke-width: 5; }
.kpi__ring-arc { fill: none; stroke: rgb(var(--tone-rgb)); stroke-width: 5; stroke-linecap: round; }
.kpi__steps { display: flex; align-items: flex-end; gap: 4px; height: 34px; }
.kpi__step { width: 10px; border-radius: 3px 3px 1px 1px; background: var(--rb-primary); opacity: 0.85; }
.kpi__step--crit { background: var(--rb-accent); }
.kpi__step--ok { background: var(--rb-success); }

/* Typing: a ring and its legend */
.typing { display: flex; flex: 1; align-items: center; gap: 22px; }
.donut { position: relative; flex: none; width: 150px; height: 150px; }
.donut svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.donut__base { fill: none; stroke: var(--rb-surface-alt); stroke-width: 14; }
.donut__seg { fill: none; stroke-width: 14; transition: stroke-dasharray 0.5s ease; }
.donut__center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.donut__center strong { font-size: 24px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
.donut__center small { margin-top: 3px; font-size: 11.5px; color: var(--rb-text-secondary); }
.glegend { display: grid; flex: 1; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 18px; margin: 0; padding: 0; list-style: none; }
.glegend__item { display: grid; grid-template-columns: 10px 2.4rem 1fr auto; align-items: center; gap: 8px; font-size: 13px; }
.glegend__item i { width: 10px; height: 10px; border-radius: 3px; }
.glegend__code { font-weight: 800; }
.glegend__count { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
.glegend__pct { min-width: 2.6rem; text-align: right; font-size: 12px; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.typing__empty { flex: 1; margin: 0; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

/* Referrals: a funnel */
.funnel { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
.funnel__row { --tone: var(--rb-primary); display: grid; grid-template-columns: 5.5rem minmax(0, 1fr) 32px; align-items: center; gap: 12px; font-size: 13px; }
.funnel__row--crit { --tone: var(--rb-accent); }
.funnel__row--ok { --tone: var(--rb-success); }
.funnel__label { font-weight: 600; }
.funnel__track { height: 26px; border-radius: 8px; background: var(--rb-surface-alt); box-shadow: inset 0 0 0 1px var(--rb-border); overflow: hidden; }
.funnel__bar { display: block; height: 100%; border-radius: 8px; background: linear-gradient(90deg, var(--tone), color-mix(in srgb, var(--tone) 70%, transparent)); transition: width 0.5s ease; }
.funnel__value { text-align: right; font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }


@media (max-width: 1200px) {
  .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .profile { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 1000px) {
  .grid { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 760px) {
  .typing { flex-direction: column; align-items: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  .chart__col::before, .chart__tip, .donut__seg, .funnel__bar { transition: none; }
}
</style>
