<template>
  <div class="fr-page">
    <div class="fr-inner">
      <!-- Financial Reports only, in Demand Forecast's place (project owner, 2026-10-25). -->
      <PageHeader title="Financial Reports" subtitle="Review collections, subsidies, receivables and invoices for a selected period.">
        <template #actions>
          <div class="report-actions">
            <div class="period">
              <SelectField
                id="fr-period"
                class="period-select"
                :model-value="preset"
                :options="PERIOD_OPTIONS"
                icon="calendar"
                size="sm"
                aria-label="Period"
                @update:model-value="choose"
              />
              <template v-if="preset === 'custom'">
                <DatePicker id="fr-from" v-model="from" :max="to || undefined" aria-label="From" size="sm" />
                <span class="period-sep" aria-hidden="true">to</span>
                <DatePicker id="fr-to" v-model="to" :min="from || undefined" aria-label="To" size="sm" />
              </template>
            </div>
            <button type="button" class="ui-btn ui-btn--download" :disabled="!report || loading || exporting" @click="downloadPdf">
              <AssetIcon name="file-down" :size="14" />
              {{ exporting ? 'Preparing…' : 'Download PDF' }}
            </button>
          </div>
        </template>
      </PageHeader>

      <p v-if="error" class="banner banner--error" role="alert">
        <AssetIcon name="triangle-alert" :size="15" />
        <span>{{ error }}</span>
        <button class="ui-btn ui-btn--sm" @click="load">Retry</button>
      </p>

      <!-- The period in five figures, counted on the server. -->
      <dl class="figures" :aria-busy="loading">
        <div v-for="f in figures" :key="f.label" class="figure">
          <dt>{{ f.label }}</dt>
          <dd>{{ f.value }}</dd>
          <span>{{ f.note }}</span>
        </div>
      </dl>

      <div class="grid">
        <section class="card collections" aria-labelledby="fr-collections">
          <header class="card-head">
            <h2 id="fr-collections" class="card-title">Collections</h2>
            <span class="card-aside">{{ periodLabel(from, to) }}</span>
          </header>
          <div class="collections-body">
            <CollectionsChart :series="report?.collections?.series ?? emptySeries" :granularity="report?.collections?.granularity ?? 'day'" />

            <div class="methods">
              <h3 class="sub-title">By method</h3>
              <ul class="meter-list">
                <li v-for="m in methods" :key="m.method" class="meter-row">
                  <span class="meter-label">{{ m.label }}</span>
                  <span class="meter-value">{{ pesos(m.amount) }}</span>
                  <span class="meter-track" aria-hidden="true"><span class="meter-fill" :style="{ width: `${share(m.amount, methodMax)}%` }" /></span>
                  <span class="meter-note">{{ m.payments }} {{ m.payments === 1 ? 'payment' : 'payments' }}</span>
                </li>
              </ul>
              <p class="voids">
                Voided: <strong>{{ report?.collections?.voids?.count ?? 0 }}</strong> · {{ pesos(report?.collections?.voids?.amount) }}
              </p>
            </div>
          </div>
        </section>

        <section class="card receivables" aria-labelledby="fr-receivables">
          <header class="card-head">
            <h2 id="fr-receivables" class="card-title">Receivables</h2>
            <span class="card-aside">As of today</span>
          </header>
          <div class="owed">
            <div v-for="block in owed" :key="block.key" class="owed-block">
              <div class="owed-head">
                <h3 class="sub-title">{{ block.title }}</h3>
                <span class="owed-total">{{ pesos(block.data?.amount) }}</span>
              </div>
              <table class="ages">
                <thead class="sr-only">
                  <tr><th scope="col">Age</th><th scope="col">Invoices</th><th scope="col">Amount</th></tr>
                </thead>
                <tbody>
                  <tr v-for="age in block.data?.by_age ?? emptyAges" :key="age.key">
                    <th scope="row">{{ age.label }}</th>
                    <td class="num muted">{{ age.count }} {{ age.count === 1 ? 'invoice' : 'invoices' }}</td>
                    <td class="num strong">{{ pesos(age.amount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="card" aria-labelledby="fr-hospitals">
          <header class="card-head">
            <h2 id="fr-hospitals" class="card-title">By hospital</h2>
          </header>
          <div class="table-scroll">
            <table class="fr-table">
              <thead>
                <tr>
                  <th scope="col">Hospital</th>
                  <th scope="col" class="num">Invoices</th>
                  <th scope="col" class="num">Patient</th>
                  <th scope="col" class="num">Weekly</th>
                  <th scope="col" class="num">Billed</th>
                  <th scope="col" class="num">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in report?.by_hospital ?? []" :key="h.facility_id">
                  <td>{{ h.name }}</td>
                  <td class="num">{{ h.invoices }}</td>
                  <td class="num">{{ h.patient_invoices }}</td>
                  <td class="num">{{ h.weekly_invoices }}</td>
                  <td class="num strong">{{ pesos(h.billed) }}</td>
                  <td class="num" :class="{ owing: Number(h.outstanding) > 0 }">{{ pesos(h.outstanding) }}</td>
                </tr>
                <tr v-if="!(report?.by_hospital ?? []).length" class="empty-row">
                  <td colspan="6">{{ loading ? 'Loading…' : 'No invoices in this period.' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card" aria-labelledby="fr-components">
          <header class="card-head">
            <h2 id="fr-components" class="card-title">By component</h2>
          </header>
          <div class="table-scroll">
            <table class="fr-table">
              <thead>
                <tr>
                  <th scope="col">Component</th>
                  <th scope="col" class="num">Units</th>
                  <th scope="col" class="num">Billed</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in report?.by_component ?? []" :key="c.component_id">
                  <td>{{ c.name }}</td>
                  <td class="num">{{ c.units }}</td>
                  <td class="num strong">{{ pesos(c.amount) }}</td>
                </tr>
                <tr v-if="!(report?.by_component ?? []).length" class="empty-row">
                  <td colspan="3">{{ loading ? 'Loading…' : 'No invoices in this period.' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Financial Reports (project owner, 2026-10-25), in Demand Forecast's place
 * under Management: for the period chosen, what was collected and how, what
 * the government subsidy met, what patients and hospitals still owe and for
 * how long, and the period's invoices by component and by hospital.
 *
 * The Billing Supervisor's and both management levels' (reports.financial).
 * Every figure is the server's (FinancialReportService); the page adds nothing up.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import SelectField from '~/components/common/SelectField.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import CollectionsChart from '~/components/BloodCenter/CollectionsChart.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { pesos, saveBlob } from '~/utils/billing'
import { PERIOD_PRESETS, periodFor, periodLabel } from '~/utils/reportPeriod'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'reports.financial',
})

useHead({ title: 'Financial Reports · RedAgos' })

const PERIOD_OPTIONS = PERIOD_PRESETS.map((p) => ({ value: p.value, label: p.label }))

const preset = ref('month')
const from = ref(periodFor('month').from)
const to = ref(periodFor('month').to)

function choose(value) {
  preset.value = value
  const range = periodFor(value)
  if (range) {
    from.value = range.from
    to.value = range.to
  }
}

const report = ref(null)
const loading = ref(false)
const exporting = ref(false)
const error = ref('')

async function load() {
  if (!from.value || !to.value) return
  loading.value = true
  error.value = ''

  try {
    report.value = await bloodCenterService.financialReport({ from: from.value, to: to.value })
  } catch (err) {
    error.value = err?.message || 'The report could not be loaded.'
  } finally {
    loading.value = false
  }
}

async function downloadPdf() {
  if (!report.value || !from.value || !to.value) return
  exporting.value = true
  error.value = ''

  try {
    const file = await bloodCenterService.financialReportPdf({ from: from.value, to: to.value })
    saveBlob(file, `financial-report-${from.value}-to-${to.value}.pdf`)
  } catch (err) {
    error.value = err?.message || 'The PDF could not be prepared.'
  } finally {
    exporting.value = false
  }
}

watch([from, to], load)
onMounted(load)

const figures = computed(() => {
  const s = report.value?.summary
  const count = (n, one, many) => `${n ?? 0} ${(n ?? 0) === 1 ? one : many}`

  return [
    { label: 'Invoiced', value: pesos(s?.invoiced), note: count(s?.invoices, 'invoice', 'invoices') },
    { label: 'Collected', value: pesos(s?.collected), note: count(report.value?.collections?.payments, 'payment', 'payments') },
    { label: 'Subsidised', value: pesos(s?.subsidised), note: count(report.value?.subsidies?.count, 'request', 'requests') },
    { label: 'Settled by hospitals', value: pesos(s?.settled_by_hospitals), note: count(report.value?.receivables?.settlements?.count, 'settlement', 'settlements') },
    { label: 'Outstanding', value: pesos(s?.outstanding), note: 'As of today' },
  ]
})

const methods = computed(() => report.value?.collections?.by_method ?? [
  { method: 'cash', label: 'Cash', amount: '0.00', payments: 0 },
  { method: 'gcash', label: 'GCash', amount: '0.00', payments: 0 },
  { method: 'card', label: 'Card', amount: '0.00', payments: 0 },
  { method: 'bank_transfer', label: 'Bank transfer', amount: '0.00', payments: 0 },
])
const methodMax = computed(() => Math.max(0, ...methods.value.map((m) => Number(m.amount) || 0)))

const emptyAges = [
  { key: 'week', label: '0–7 days', count: 0, amount: '0.00' },
  { key: 'month', label: '8–30 days', count: 0, amount: '0.00' },
  { key: 'older', label: 'Over 30 days', count: 0, amount: '0.00' },
]
const owed = computed(() => [
  { key: 'patients', title: 'Patients', data: report.value?.receivables?.patients },
  { key: 'hospitals', title: 'Hospitals', data: report.value?.receivables?.hospitals },
])

// Before the report arrives the chart still shows its frame: the period's days, empty.
const emptySeries = computed(() => {
  const days = []
  if (!from.value || !to.value) return days
  for (let d = new Date(`${from.value}T00:00:00`); d <= new Date(`${to.value}T00:00:00`) && days.length < 62; d.setDate(d.getDate() + 1)) {
    days.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, amount: '0.00' })
  }
  return days
})

function share(amount, max) {
  return max > 0 ? Math.max((Number(amount) / max) * 100, Number(amount) > 0 ? 2 : 0) : 0
}
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.fr-page { background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 24px var(--rb-gutter, 24px) 40px; }
.fr-inner { max-width: var(--rb-content-max, 1600px); margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

.report-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.period { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.period-select { width: 180px; }
.period-sep { font-size: 12px; color: var(--rb-text-muted); }

.banner { display: flex; align-items: center; gap: 9px; margin: 0; padding: 10px 14px; border-radius: 10px; font-size: 13px; }
.banner--error { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .25); }
.banner .ui-btn { margin-left: auto; }

/* One strip of figures, divided rather than boxed. */
.figures {
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin: 0;
  background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; overflow: hidden;
}
.figure { display: flex; flex-direction: column; gap: 2px; padding: 16px 18px; border-left: 1px solid var(--rb-border); min-width: 0; }
.figure:first-child { border-left: 0; }
.figure dt { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.figure dd { margin: 0; font-size: 22px; font-weight: 800; line-height: 1.2; color: var(--rb-text-primary); }
.figure span { font-size: 12px; color: var(--rb-text-muted); }

.grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); gap: 16px; align-items: start; }

.card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; overflow: hidden; min-width: 0; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 16px 18px 0; }
.card-title { margin: 0; font-size: 15px; font-weight: 800; color: var(--rb-text-primary); }
.card-aside { font-size: 12px; color: var(--rb-text-muted); }
.sub-title { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--rb-text-secondary); }

.collections-body { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 24px; padding: 16px 18px 18px; align-items: start; }
.methods { display: flex; flex-direction: column; gap: 10px; }

/* A label, its value, and a thin bar of the same one hue: magnitude, not identity. */
.meter-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.meter-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "label value" "track track" "note note"; gap: 3px 10px; }
.meter-label { grid-area: label; font-size: 13px; color: var(--rb-text-primary); }
.meter-value { grid-area: value; font-size: 13px; font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.meter-track { grid-area: track; height: 6px; border-radius: 999px; background: var(--rb-surface-alt); overflow: hidden; }
.meter-fill { display: block; height: 100%; border-radius: 999px; background: var(--rb-primary); opacity: .85; }
.meter-note { grid-area: note; font-size: 11.5px; color: var(--rb-text-muted); }
.voids { margin: 2px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.voids strong { color: var(--rb-text-primary); }

.owed { display: grid; grid-template-columns: 1fr; gap: 0; }
.owed-block { padding: 14px 18px; border-bottom: 1px solid var(--rb-border); display: flex; flex-direction: column; gap: 8px; }
.owed-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.owed-total { font-size: 18px; font-weight: 800; color: var(--rb-text-primary); }
.owed-block:last-child { border-bottom: 0; }

/* How long ago the open invoices were billed: three short rows, no bars. */
.ages { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.ages th, .ages td { padding: 5px 0; border-top: 1px solid var(--rb-border); text-align: left; font-weight: 500; color: var(--rb-text-primary); }
.ages tr:first-child th, .ages tr:first-child td { border-top: 0; }
.ages td + td { padding-left: 12px; }
.muted { color: var(--rb-text-muted) !important; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

.table-scroll { overflow-x: auto; margin: 12px 18px 18px; border: 1px solid var(--rb-border); border-radius: 12px; }
.fr-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.fr-table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--rb-text-secondary); background: var(--rb-surface-alt); padding: 9px 14px; border-bottom: 1px solid var(--rb-border); white-space: nowrap; }
.fr-table td { padding: 10px 14px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); }
.fr-table tbody tr:last-child td { border-bottom: 0; }
.empty-row td { padding: 18px 14px; text-align: center; color: var(--rb-text-muted); }
.num { text-align: right !important; white-space: nowrap; }
.strong { font-weight: 700; }
.owing { color: var(--rb-accent-text); font-weight: 700; }

@media (max-width: 1280px) {
  .figures { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .figure:nth-child(4) { border-left: 0; }
  .figure:nth-child(n + 4) { border-top: 1px solid var(--rb-border); }
  .collections-body { grid-template-columns: 1fr; }
}

@media (max-width: 1023px) {
  .grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .figures { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .figure:nth-child(n) { border-left: 0; border-top: 1px solid var(--rb-border); }
  .figure:nth-child(even) { border-left: 1px solid var(--rb-border); }
  .figure:nth-child(-n + 2) { border-top: 0; }
  .report-actions, .period { justify-content: flex-start; }
}
</style>
