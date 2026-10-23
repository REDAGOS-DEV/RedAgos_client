<template>
  <!--
    The centre's reports for a period, for the Admin and the Supervisor
    (reports.view_all), from GET /blood-center/reports/centre. Every figure is
    counted from the records, the way the department dashboards count them.
  -->
  <div class="cr">
    <header class="cr__head">
      <div>
        <h1 class="cr__title">Reports &amp; Analytics</h1>
        <p class="cr__sub">{{ facilityName }} · {{ periodLabel }}</p>
      </div>
      <!-- One toolbar, one height: the period, its dates when custom, the export. -->
      <div class="cr__tools">
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
      </div>
    </header>

    <nav class="tabs" role="tablist" aria-label="Report">
      <button v-for="t in TABS" :key="t.key" type="button" role="tab" class="tab" :class="{ 'tab--on': tab === t.key }"
        :aria-selected="tab === t.key" @click="tab = t.key">
        <AssetIcon :name="t.icon" :size="15" />
        {{ t.label }}
      </button>
    </nav>

    <p v-if="error" class="cr__error" role="alert">
      {{ error }} <button type="button" class="link" @click="load">Try again</button>
    </p>

    <div v-if="loading && !data" class="grid4" aria-busy="true">
      <span v-for="n in 4" :key="n" class="kpi kpi--skeleton" />
    </div>

    <template v-else-if="data">
      <!-- ── Centre ── -->
      <section v-if="tab === 'centre'" class="stack" aria-label="Centre">
        <div class="grid4">
          <div v-for="k in centreKpis" :key="k.label" class="kpi">
            <span class="kpi__label">{{ k.label }}</span>
            <span class="kpi__value">{{ k.value }}</span>
            <span class="kpi__note">{{ k.note }}</span>
          </div>
        </div>

        <!--
          One series at a time, picked above the chart: three bars a day over a
          month was ninety bars and no scale. Gridlines and dates give it one;
          hovering a day shows its count.
        -->
        <section class="card" aria-labelledby="daily-title">
          <header class="card__head">
            <h2 id="daily-title" class="card__title">Day by day</h2>
            <div class="series" role="radiogroup" aria-label="Show">
              <button v-for="sr in SERIES" :key="sr.key" type="button" role="radio" class="series__btn"
                :class="[`series__btn--${sr.key}`, { 'series__btn--on': series === sr.key }]"
                :aria-checked="series === sr.key" @click="series = sr.key">
                <i class="series__dot" aria-hidden="true" />
                {{ sr.label }}
                <strong>{{ seriesTotal(sr.key) }}</strong>
              </button>
            </div>
          </header>

          <div v-if="!seriesTotal(series)" class="chart-empty">
            <span class="chart-empty__icon" aria-hidden="true"><AssetIcon name="bar-chart" :size="22" /></span>
            <p class="chart-empty__title">No {{ currentSeries.label.toLowerCase() }} in this period</p>
            <p class="chart-empty__text">Try a longer period, or another figure above.</p>
          </div>

          <div v-else class="plot" :class="`plot--${series}`">
            <div class="plot__y" aria-hidden="true">
              <span>{{ yMax }}</span>
              <span>{{ Math.round(yMax / 2) }}</span>
              <span>0</span>
            </div>
            <div class="plot__area">
              <div class="plot__grid" aria-hidden="true"><span /><span /><span /></div>
              <div class="plot__bars" role="img" :aria-label="chartLabel">
                <div v-for="(day, i) in data.centre.daily" :key="day.date" class="col" :class="{ 'col--today': day.date === today }">
                  <span class="col__bar" :style="{ height: `${barHeight(day[series])}%` }" />
                  <span class="col__tip">{{ fmtDay(day.date) }} · {{ day[series] }}</span>
                  <span v-if="showTick(i)" class="col__tick" aria-hidden="true">{{ fmtDay(day.date) }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div class="grid2">
          <section class="card" aria-labelledby="req-title">
            <h2 id="req-title" class="card__title">Hospital requests</h2>
            <dl class="rows">
              <div><dt>Received</dt><dd>{{ data.centre.requests.received }}</dd></div>
              <div><dt>Emergency</dt><dd>{{ data.centre.requests.emergency }}</dd></div>
              <div><dt>Fulfilled</dt><dd>{{ data.centre.requests.fulfilled }}</dd></div>
              <div><dt>Partly fulfilled</dt><dd>{{ data.centre.requests.partial }}</dd></div>
              <div><dt>Still open</dt><dd>{{ data.centre.requests.open }}</dd></div>
              <div><dt>Declined or cancelled</dt><dd>{{ data.centre.requests.declined }}</dd></div>
            </dl>
          </section>
          <section class="card" aria-labelledby="units-title">
            <h2 id="units-title" class="card__title">Blood units</h2>
            <dl class="rows">
              <div><dt>Released to hospitals</dt><dd>{{ data.centre.units.released }}</dd></div>
              <div><dt>Expired</dt><dd>{{ data.centre.units.expired }}</dd></div>
              <div><dt>Discarded</dt><dd>{{ data.centre.units.discarded }}</dd></div>
              <div><dt>Donations collected</dt><dd>{{ data.centre.donations }}</dd></div>
              <div><dt>Donors deferred</dt><dd>{{ data.centre.deferrals }}</dd></div>
            </dl>
          </section>
        </div>
      </section>

      <!-- ── Staff & access ── -->
      <section v-else-if="tab === 'staff'" class="stack" aria-label="Staff and access">
        <div class="grid4">
          <div v-for="k in staffKpis" :key="k.label" class="kpi">
            <span class="kpi__label">{{ k.label }}</span>
            <span class="kpi__value" :class="k.warn && k.value ? 'kpi__value--warn' : ''">{{ k.value }}</span>
            <span class="kpi__note">{{ k.note }}</span>
          </div>
        </div>
        <section class="card" aria-labelledby="events-title">
          <header class="card__head">
            <h2 id="events-title" class="card__title">Account changes</h2>
            <NuxtLink to="/blood-center/audit-log" class="card__link">Audit Log <AssetIcon name="arrow-right" :size="13" /></NuxtLink>
          </header>
          <table v-if="data.staff.events.length" class="table">
            <thead><tr><th>When</th><th>Change</th><th>Account</th><th>By</th></tr></thead>
            <tbody>
              <tr v-for="e in data.staff.events" :key="e.id">
                <td>{{ fmtWhen(e.at) }}</td>
                <td>{{ e.label }}</td>
                <td>{{ e.subject || '—' }}</td>
                <td>{{ e.by }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="empty">No staff account changes in this period.</p>
        </section>
      </section>

      <!-- ── Activity ── -->
      <section v-else class="stack" aria-label="Activity">
        <div class="grid2">
          <section class="card" aria-labelledby="mod-title">
            <header class="card__head">
              <h2 id="mod-title" class="card__title">By module</h2>
              <span class="card__note">{{ data.activity.total }} recorded actions</span>
            </header>
            <ul v-if="data.activity.by_module.length" class="hbars">
              <li v-for="m in data.activity.by_module" :key="m.module" class="hbar">
                <span class="hbar__label">{{ m.module }}</span>
                <span class="hbar__track"><span :style="{ width: `${pctOf(m.count, maxModule)}%` }" /></span>
                <span class="hbar__count">{{ m.count }}</span>
              </li>
            </ul>
            <p v-else class="empty">Nothing recorded in this period.</p>
          </section>
          <section class="card" aria-labelledby="people-title">
            <h2 id="people-title" class="card__title">Most active</h2>
            <ol v-if="data.activity.top_people.length" class="people">
              <li v-for="(p, i) in data.activity.top_people" :key="i" class="person">
                <span class="person__rank">{{ i + 1 }}</span>
                <span class="person__name">{{ p.name }}</span>
                <span class="person__count">{{ p.count }} actions</span>
              </li>
            </ol>
            <p v-else class="empty">Nothing recorded in this period.</p>
          </section>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import SelectField from '~/components/common/SelectField.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

const { user } = useUser()
const facilityName = computed(() => user.value?.facility?.facility_name || 'Your blood center')

const TABS = [
  { key: 'centre', label: 'Centre', icon: 'layout-dashboard' },
  { key: 'staff', label: 'Staff & access', icon: 'users' },
  { key: 'activity', label: 'Activity', icon: 'history' },
]
const PRESETS = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'custom', label: 'Custom range' },
]

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = iso(new Date())
const daysAgo = n => iso(new Date(Date.now() - n * 86_400_000))

const tab = ref('centre')
const preset = ref('30')
const from = ref(daysAgo(29))
const to = ref(today)
const data = ref(null)
const loading = ref(false)
const error = ref('')

function choose(key) {
  preset.value = key
  if (key === '7') { from.value = daysAgo(6); to.value = today }
  if (key === '30') { from.value = daysAgo(29); to.value = today }
  if (key === 'month') { from.value = `${today.slice(0, 8)}01`; to.value = today }
}

async function load() {
  if (!from.value || !to.value) return
  loading.value = true
  error.value = ''
  try {
    data.value = await bloodCenterService.centreReport({ from: from.value, to: to.value })
  } catch (err) {
    console.error('Failed to load the report:', err)
    error.value = err?.data?.message || err?.message || 'The report could not be loaded.'
  } finally {
    loading.value = false
  }
}
watch([from, to], load)
onMounted(load)

const fmtDay = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const fmtWhen = at => (at ? new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
const periodLabel = computed(() => (data.value ? `${fmtDay(data.value.period.from)} to ${fmtDay(data.value.period.to)}, ${data.value.period.days} days` : ''))

// ── The day-by-day chart ──
const SERIES = [
  { key: 'donations', label: 'Donations' },
  { key: 'deferrals', label: 'Deferrals' },
  { key: 'requests', label: 'Requests' },
]
const series = ref('donations')
const currentSeries = computed(() => SERIES.find(x => x.key === series.value))
const seriesTotal = key => (data.value?.centre?.daily ?? []).reduce((sum, d) => sum + (d[key] ?? 0), 0)

// A round top for the scale: 1, 2, 5, 10, 20, 50...
const yMax = computed(() => {
  const top = Math.max(1, ...(data.value?.centre?.daily ?? []).map(d => d[series.value] ?? 0))
  const step = 10 ** Math.floor(Math.log10(top))
  return [1, 2, 5, 10].map(m => m * step).find(v => v >= top) ?? top
})
const barHeight = n => (n ? Math.max(2, (n / yMax.value) * 100) : 0)

// About six dates under the chart, whatever the period's length.
const showTick = (i) => {
  const n = data.value?.centre?.daily?.length ?? 0
  const every = Math.max(1, Math.ceil(n / 6))
  return i % every === 0
}
const pctOf = (n, max) => Math.round((n / Math.max(1, max)) * 100)
const maxModule = computed(() => Math.max(1, ...(data.value?.activity?.by_module ?? []).map(m => m.count)))
const chartLabel = computed(() => (data.value
  ? `${currentSeries.value.label} per day: ${seriesTotal(series.value)} in total over ${data.value.period.days} days.`
  : ''))

const centreKpis = computed(() => {
  const c = data.value.centre
  const rate = c.requests.received ? Math.round((c.requests.fulfilled / c.requests.received) * 100) : null
  return [
    { label: 'Donations collected', value: c.donations, note: `${c.deferrals} donors deferred` },
    { label: 'Requests received', value: c.requests.received, note: `${c.requests.emergency} emergency` },
    { label: 'Fulfilment rate', value: rate === null ? '—' : `${rate}%`, note: c.requests.avg_hours_to_fulfil === null ? 'No fulfilled requests' : `${c.requests.avg_hours_to_fulfil} h on average` },
    { label: 'Units released', value: c.units.released, note: `${c.units.expired} expired · ${c.units.discarded} discarded` },
  ]
})

const staffKpis = computed(() => {
  const s = data.value.staff
  return [
    { label: 'New accounts', value: s.created, note: `${s.removed} removed · ${s.restored} restored` },
    { label: 'Role changes', value: s.role_changes, note: 'Roles, privileges, levels' },
    { label: 'Status changes', value: s.status_changes, note: 'Suspended or reactivated', warn: true },
    { label: 'Sign-ins', value: s.sign_ins, note: `${s.failed_sign_ins} refused`, warn: false },
  ]
})

// The tab on screen as a CSV file: the same figures, for a spreadsheet.
function exportCsv() {
  if (!data.value) return
  const d = data.value
  const rows = [[`${facilityName.value} report`, `${d.period.from} to ${d.period.to}`], []]
  if (tab.value === 'centre') {
    rows.push(['Figure', 'Value'])
    centreKpis.value.forEach(k => rows.push([k.label, k.value]))
    Object.entries(d.centre.requests).forEach(([k, v]) => rows.push([`Requests: ${k.replace(/_/g, ' ')}`, v ?? '']))
    Object.entries(d.centre.units).forEach(([k, v]) => rows.push([`Units: ${k}`, v]))
    rows.push([], ['Date', 'Donations', 'Deferrals', 'Requests'])
    d.centre.daily.forEach(day => rows.push([day.date, day.donations, day.deferrals, day.requests]))
  } else if (tab.value === 'staff') {
    staffKpis.value.forEach(k => rows.push([k.label, k.value]))
    rows.push([], ['When', 'Change', 'Account', 'By'])
    d.staff.events.forEach(e => rows.push([e.at, e.label, e.subject ?? '', e.by]))
  } else {
    rows.push(['Module', 'Actions'])
    d.activity.by_module.forEach(m => rows.push([m.module, m.count]))
    rows.push([], ['Person', 'Actions'])
    d.activity.top_people.forEach(p => rows.push([p.name, p.count]))
  }
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([String.fromCharCode(0xFEFF) + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `redagos-${tab.value}-report-${d.period.from}-to-${d.period.to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.cr { display: flex; flex-direction: column; gap: 16px; max-width: var(--rb-content-max, 1400px); margin: 0 auto; padding: 24px 32px 40px; }
.cr__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.cr__title { margin: 0; font-size: var(--rb-fs-title, 24px); font-weight: 800; color: var(--rb-text-primary); }
.cr__sub { margin: 4px 0 0; font-size: 13.5px; color: var(--rb-text-secondary); }
.cr__tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
.cr__error { margin: 0; padding: 10px 14px; border-radius: 12px; background: rgba(211, 47, 47, 0.08); font-size: 13px; color: var(--rb-accent-text, #C62828); }
.link { border: 0; background: none; font: inherit; font-weight: 700; color: inherit; text-decoration: underline; cursor: pointer; }

.tool-period { width: 172px; flex: none; }
.tool-date { width: 172px; flex: none; }
.tool-sep { font-size: 13px; color: var(--rb-text-secondary); }

.tabs { display: flex; align-items: center; gap: 4px; border-bottom: 1px solid var(--rb-border); }
.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: -1px;
  padding: 10px 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}
.tab--on { border-bottom-color: var(--rb-primary); color: var(--rb-primary-text); }
.tab:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: -2px; }
/* The same height and corners as the period field beside it. */
.export {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--rb-border-strong, var(--rb-border));
  border-radius: 8px;
  background: var(--rb-surface);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-primary);
  cursor: pointer;
}
.export:hover:not(:disabled) { border-color: rgba(var(--rb-primary-rgb), 0.45); }
.export:disabled { opacity: 0.5; cursor: default; }

.stack { display: flex; flex-direction: column; gap: 16px; }
.grid4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }

.kpi { display: flex; flex-direction: column; gap: 4px; padding: 16px; border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface); }
.kpi--skeleton { min-height: 104px; border: 0; background: var(--rb-skeleton-a, #EEF1F5); }
.kpi__label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); }
.kpi__value { font-size: 28px; font-weight: 800; line-height: 1.1; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.kpi__value--warn { color: #B45309; }
html.dark .kpi__value--warn { color: #FFB74D; }
.kpi__note { font-size: 12.5px; color: var(--rb-text-secondary); }

.card { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; border: 1px solid var(--rb-border); border-radius: 18px; background: var(--rb-surface); }
.card__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
.card__title { margin: 0; font-size: var(--rb-fs-section, 16px); font-weight: 700; color: var(--rb-text-primary); }
.card__note { font-size: 12.5px; color: var(--rb-text-secondary); }
.card__link { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: var(--rb-primary-text); text-decoration: none; }

/* ── Day-by-day chart ── */
.series { display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 3px; border-radius: 12px; background: var(--rb-surface-hover, #F1F5F9); }
.series__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 0;
  border-radius: 9px;
  background: none;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}
.series__btn strong { font-weight: 800; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.series__btn--on { background: var(--rb-surface); color: var(--rb-text-primary); box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12); }
.series__btn:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; }
.series__dot { width: 8px; height: 8px; border-radius: 3px; background: var(--series); }
.series__btn--donations, .plot--donations { --series: var(--rb-primary); }
.series__btn--deferrals, .plot--deferrals { --series: #F59E0B; }
.series__btn--requests, .plot--requests { --series: #7C3AED; }
html.dark .series__btn--requests, html.dark .plot--requests { --series: #A78BFA; }

.plot { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 8px; }
.plot__y { display: flex; flex-direction: column; justify-content: space-between; height: 200px; font-size: 11.5px; text-align: right; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.plot__y span { transform: translateY(-50%); }
.plot__y span:last-child { transform: translateY(50%); }
.plot__area { position: relative; }
.plot__grid { position: absolute; inset: 0 0 auto; display: flex; flex-direction: column; justify-content: space-between; height: 200px; pointer-events: none; }
.plot__grid span { height: 1px; background: var(--rb-border); }
.plot__grid span:last-child { background: var(--rb-border-strong, var(--rb-border)); }
.plot__bars { position: relative; display: flex; align-items: flex-end; gap: 4px; height: 200px; padding-bottom: 26px; box-sizing: content-box; }
.col { position: relative; display: flex; flex: 1; align-items: flex-end; height: 100%; min-width: 0; }
.col__bar { width: 100%; max-width: 28px; margin: 0 auto; border-radius: 4px 4px 0 0; background: color-mix(in srgb, var(--series) 75%, transparent); transition: background-color 120ms ease; }
.col:hover .col__bar, .col--today .col__bar { background: var(--series); }
.col__tip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  z-index: 2;
  padding: 4px 8px;
  border-radius: 8px;
  background: var(--rb-text-primary);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--rb-surface);
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%);
  transition: opacity 120ms ease;
}
.col:hover .col__tip { opacity: 1; }
.col__tick { position: absolute; top: calc(100% + 8px); left: 50%; font-size: 11.5px; white-space: nowrap; color: var(--rb-text-secondary); transform: translateX(-50%); }

.chart-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 200px; text-align: center; }
.chart-empty__icon { display: flex; align-items: center; justify-content: center; width: 46px; height: 46px; margin-bottom: 6px; border-radius: 14px; background: var(--rb-surface-hover, #F1F5F9); color: var(--rb-text-secondary); }
.chart-empty__title { margin: 0; font-size: 14.5px; font-weight: 700; color: var(--rb-text-primary); }
.chart-empty__text { margin: 0; font-size: 13px; color: var(--rb-text-secondary); }

.rows { display: flex; flex-direction: column; margin: 0; }
.rows div { display: flex; justify-content: space-between; padding: 9px 0; border-top: 1px solid var(--rb-border); font-size: 14px; }
.rows div:first-child { border-top: 0; }
.rows dt { color: var(--rb-text-secondary); }
.rows dd { margin: 0; font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

.table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.table th { padding: 8px 10px; border-bottom: 1px solid var(--rb-border); font-size: 12px; font-weight: 700; text-align: left; color: var(--rb-text-secondary); }
.table td { padding: 10px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); }
.table tr:last-child td { border-bottom: 0; }

.hbars { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.hbar { display: grid; grid-template-columns: 110px minmax(0, 1fr) 40px; align-items: center; gap: 10px; font-size: 13px; }
.hbar__label { color: var(--rb-text-primary); }
.hbar__track { height: 8px; overflow: hidden; border-radius: 999px; background: var(--rb-surface-hover, #F1F5F9); }
.hbar__track span { display: block; height: 100%; border-radius: inherit; background: var(--rb-primary); }
.hbar__count { font-weight: 700; text-align: right; color: var(--rb-text-primary); }

.people { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.person { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--rb-border); }
.person:first-child { border-top: 0; }
.person__rank { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: rgba(var(--rb-primary-rgb), 0.1); font-size: 12px; font-weight: 800; color: var(--rb-primary-text); }
.person__name { flex: 1; font-size: 14px; font-weight: 600; color: var(--rb-text-primary); }
.person__count { font-size: 12.5px; color: var(--rb-text-secondary); }
.empty { margin: 0; font-size: 13px; color: var(--rb-text-secondary); }

@media (max-width: 1100px) {
  .grid4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid2 { grid-template-columns: minmax(0, 1fr); }
}
</style>
