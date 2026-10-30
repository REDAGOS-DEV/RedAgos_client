<template>
  <div class="bdash">
    <div v-if="initialLoading" class="bdash-inner" aria-busy="true" aria-label="Loading the dashboard">
      <div class="skeleton skeleton--header" />
      <div class="bento">
        <div class="skeleton skeleton--card bento__today" />
        <div class="skeleton skeleton--card bento__owed" />
        <div class="skeleton skeleton--panel bento__trend" />
      </div>
    </div>

    <div v-else class="bdash-inner">
      <header class="header-row">
        <div>
          <h1 class="page-title">Billing dashboard</h1>
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

      <div v-if="error" class="banner" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ error }}</p>
        <button type="button" class="btn-link" @click="load">Retry</button>
      </div>

      <div v-if="data" class="bento">
        <!-- ============ TODAY AT THE COUNTER ============ -->
        <section class="card today bento__today" aria-labelledby="today-title">
          <div class="card__head">
            <h2 id="today-title" class="card__label">Collected today</h2>
          </div>
          <p class="today__amount">{{ peso(t.collected_today) }}</p>
          <p class="today__sub">
            collected from <strong>{{ t.payments_today }}</strong> {{ t.payments_today === 1 ? 'payment' : 'payments' }}
          </p>
          <dl class="today__facts">
            <div>
              <dt>This month</dt>
              <dd>{{ peso(t.collected_this_month) }}</dd>
            </div>
            <div>
              <dt>Subsidised this month</dt>
              <dd>{{ peso(t.subsidised_this_month?.amount) }} <small>· {{ t.subsidised_this_month?.count ?? 0 }}</small></dd>
            </div>
          </dl>
          <NuxtLink to="/blood-center/pos" class="btn-primary today__go">
            <AssetIcon name="philippine-peso" :size="16" />
            Open billing counter
            <AssetIcon name="arrow-right" :size="15" />
          </NuxtLink>
        </section>

        <!-- ============ STILL OWED ============ -->
        <section class="card owed bento__owed" aria-labelledby="owed-title">
          <div class="card__head">
            <h2 id="owed-title" class="card__label">Still owed</h2>
            <NuxtLink to="/blood-center/billing" class="card__link">
              Invoices
              <AssetIcon name="arrow-right" :size="13" />
            </NuxtLink>
          </div>
          <div class="owed__body">
            <!-- The open bills by how long ago they were billed. -->
            <div class="donut" role="img" :aria-label="agingLabel">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle class="donut__base" cx="60" cy="60" r="48" />
                <circle
                  v-for="seg in agingArcs"
                  :key="seg.key"
                  class="donut__seg"
                  :class="`donut__seg--${seg.key}`"
                  cx="60"
                  cy="60"
                  r="48"
                  :style="{ strokeDasharray: `${seg.length} ${RING}`, strokeDashoffset: -seg.offset }"
                />
              </svg>
              <span class="donut__center">
                <strong>{{ pesoShort(owedTotal) }}</strong>
                <small>owed</small>
              </span>
            </div>
            <ul class="aging">
              <li v-for="age in aging" :key="age.key" class="aging__row">
                <i :class="`aging__dot aging__dot--${age.key}`" aria-hidden="true" />
                <span class="aging__label">{{ age.label }}</span>
                <span class="aging__count">{{ age.count }}</span>
                <span class="aging__amount">{{ peso(age.amount) }}</span>
              </li>
            </ul>
          </div>
          <p class="owed__note">
            <strong>{{ data.receivables.patients.count }}</strong> patient {{ data.receivables.patients.count === 1 ? 'invoice' : 'invoices' }} ·
            <strong>{{ data.receivables.hospitals.count }}</strong> hospital {{ data.receivables.hospitals.count === 1 ? 'invoice' : 'invoices' }} to settle
          </p>
        </section>

        <!-- ============ COLLECTIONS, LAST 30 DAYS ============ -->
        <section class="card bento__trend" aria-labelledby="trend-title">
          <div class="card__head">
            <div>
              <h2 id="trend-title" class="card__label">Collections, last 30 days</h2>
              <p class="card__sub"><strong>{{ peso(data.collections.total) }}</strong> from {{ data.collections.payments }} payments, net of voids</p>
            </div>
            <NuxtLink v-if="can('reports.financial')" to="/blood-center/financial-reports" class="card__link">
              Financial reports
              <AssetIcon name="arrow-right" :size="13" />
            </NuxtLink>
          </div>
          <div class="chart">
            <div class="chart__y" aria-hidden="true">
              <span v-for="tick in [...trendScale.ticks].reverse()" :key="tick">{{ pesoShort(tick) }}</span>
            </div>
            <div class="chart__plot">
              <div class="chart__grid" aria-hidden="true"><span v-for="tick in trendScale.ticks" :key="tick" /></div>
              <svg class="chart__svg" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="bd-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" class="chart__stop chart__stop--top" />
                    <stop offset="100%" class="chart__stop chart__stop--bottom" />
                  </linearGradient>
                </defs>
                <path v-if="curve.area" :d="curve.area" fill="url(#bd-fill)" />
                <path v-if="curve.line" :d="curve.line" class="chart__line" vector-effect="non-scaling-stroke" />
              </svg>
              <div class="chart__cols" role="img" :aria-label="`Collected per day over the last 30 days, ${peso(data.collections.total)} in all.`">
                <div v-for="(day, i) in trend" :key="day.key" class="chart__col">
                  <span class="chart__dot" :style="{ bottom: `${pos(day.value)}%` }" />
                  <span class="chart__tip" :style="{ bottom: `calc(${pos(day.value)}% + 14px)` }">
                    <strong>{{ fmtDay(day.key) }}</strong>
                    {{ peso(day.value) }}
                  </span>
                  <span v-if="(trend.length - 1 - i) % 7 === 0" class="chart__x">{{ i === trend.length - 1 ? 'Today' : fmtDay(day.key) }}</span>
                </div>
              </div>
              <p v-if="!Number(data.collections.total)" class="chart__empty">Nothing collected in the last 30 days.</p>
            </div>
          </div>
        </section>

        <!-- ============ BY METHOD ============ -->
        <section class="card bento__method" aria-labelledby="method-title">
          <div class="card__head">
            <h2 id="method-title" class="card__label">By payment method</h2>
          </div>
          <ul class="methods">
            <li v-for="m in methods" :key="m.method" class="method" :class="{ 'method--none': !Number(m.amount) }">
              <span class="method__top">
                <span class="method__label">{{ m.label }}</span>
                <span class="method__amount">{{ peso(m.amount) }}</span>
              </span>
              <span class="method__track"><span :style="{ width: `${share(m.amount, methodMax)}%` }" /></span>
              <span class="method__count">{{ m.payments }} {{ m.payments === 1 ? 'payment' : 'payments' }}</span>
            </li>
          </ul>
        </section>

        <!-- ============ HOSPITALS TO SETTLE ============ -->
        <section class="card bento__hospitals" aria-labelledby="hosp-title">
          <div class="card__head">
            <h2 id="hosp-title" class="card__label">Hospitals to settle</h2>
            <NuxtLink to="/blood-center/statements" class="card__link">
              Statements
              <AssetIcon name="arrow-right" :size="13" />
            </NuxtLink>
          </div>
          <ol v-if="data.top_hospitals.length" class="hospitals">
            <li v-for="h in data.top_hospitals" :key="h.facility_id ?? h.name" class="hospital">
              <span class="hospital__name">{{ h.name }}</span>
              <span class="hospital__track"><span :style="{ width: `${share(h.amount, hospitalMax)}%` }" /></span>
              <span class="hospital__amount">{{ peso(h.amount) }}</span>
              <span class="hospital__count">{{ h.invoices }} {{ h.invoices === 1 ? 'invoice' : 'invoices' }}</span>
            </li>
          </ol>
          <p v-else class="empty">
            <AssetIcon name="check-circle" :size="18" />
            No hospital invoice is waiting to be settled.
          </p>
        </section>

        <!-- ============ RECENT PAYMENTS ============ -->
        <section class="card bento__recent" aria-labelledby="recent-title">
          <div class="card__head">
            <h2 id="recent-title" class="card__label">Recent payments</h2>
            <NuxtLink to="/blood-center/receipts" class="card__link">
              Payments
              <AssetIcon name="arrow-right" :size="13" />
            </NuxtLink>
          </div>
          <ul v-if="recent.length" class="recent">
            <li v-for="r in recent" :key="r.id" class="recent__row" :class="{ 'recent__row--void': r.voided }">
              <NuxtLink :to="`/blood-center/receipt/${r.id}`" class="recent__no">{{ r.receipt_number }}</NuxtLink>
              <span class="recent__who">{{ r.payer_name || r.request?.patient_name || '—' }}</span>
              <span class="recent__amount">{{ peso(r.amount_paid) }}</span>
              <span class="recent__when">{{ fmtWhen(r.issued_at) }}</span>
            </li>
          </ul>
          <p v-else class="empty">
            <AssetIcon name="receipt" :size="18" />
            No payment recorded yet.
          </p>
        </section>

        <!-- ============ NEXT 4 WEEKS (the billing part of the forecast) ============ -->
        <section v-if="forecast" class="card ahead bento__ahead" aria-labelledby="ahead-title">
          <div class="card__head">
            <h2 id="ahead-title" class="card__label">Next {{ forecast.weeks }} weeks</h2>
            <NuxtLink to="/blood-center/forecast" class="card__link">
              Forecast
              <AssetIcon name="arrow-right" :size="13" />
            </NuxtLink>
          </div>
          <p class="ahead__amount">{{ peso(forecast.amount_horizon) }}</p>
          <p class="ahead__sub">to bill, at today's prices and the recent pace</p>
          <dl class="ahead__facts">
            <div><dt>A week</dt><dd>{{ peso(forecast.amount_per_week) }}</dd></div>
            <div><dt>Requests a week</dt><dd>{{ num(forecast.requests_per_week) }}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import TaskStrip from '~/components/BloodCenter/TaskStrip.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { niceScale } from '~/utils/collectionDashboard'
import { smoothPath } from '~/utils/smoothPath'

/**
 * The Billing department's dashboard (project owner, 2026-10-27): today at
 * the counter, what is still owed and how old, 30 days of collections by
 * method, the hospitals that owe the most, the latest payments, and the
 * billing part of the forecast. GET /blood-center/billing-dashboard
 * (BillingDashboardService); the full report stays on Financial Reports.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.record_payment',
})

const { can } = useUser()

const data = ref(null)
const recent = ref([])
const forecastData = ref(null)
const loading = ref(false)
const initialLoading = ref(true)
const error = ref('')
const updatedAt = ref(null)

const updatedAtLabel = computed(() => (updatedAt.value ? updatedAt.value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''))

async function load() {
  loading.value = true
  error.value = ''
  const [dash, receipts, ahead] = await Promise.allSettled([
    bloodCenterService.billingDashboard(),
    bloodCenterService.receipts({ per_page: 5 }),
    bloodCenterService.forecast(),
  ])
  if (dash.status === 'fulfilled') {
    data.value = dash.value
    updatedAt.value = new Date()
  } else {
    error.value = dash.reason?.message || 'Could not load the dashboard.'
  }
  // Supplementary: each card hides without its data.
  recent.value = receipts.status === 'fulfilled' ? (receipts.value?.data ?? []).slice(0, 5) : []
  forecastData.value = ahead.status === 'fulfilled' ? ahead.value : null
  loading.value = false
  initialLoading.value = false
}

let timer = null
onMounted(() => {
  load()
  timer = setInterval(() => { if (document.visibilityState === 'visible') load() }, 60_000)
})
onBeforeUnmount(() => clearInterval(timer))

const t = computed(() => data.value?.today ?? {})

const peso = v => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(Number(v) || 0)
function pesoShort(v) {
  const n = Number(v) || 0
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return `₱${Math.round(n)}`
}
const num = v => (v === null || v === undefined ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 }))
const share = (part, whole) => (Number(whole) ? Math.min(100, (Number(part) / Number(whole)) * 100) : 0)
const fmtDay = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const fmtWhen = at => (at ? new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

// ── Still owed: patients and hospitals together, by age ──
const AGE_LABELS = { week: '0-7 days', month: '8-30 days', older: 'Over 30 days' }
const aging = computed(() => {
  const r = data.value?.receivables
  if (!r) return []
  return ['week', 'month', 'older'].map((key) => {
    const p = r.patients.by_age.find(a => a.key === key) ?? { count: 0, amount: 0 }
    const h = r.hospitals.by_age.find(a => a.key === key) ?? { count: 0, amount: 0 }
    return { key, label: AGE_LABELS[key], count: p.count + h.count, amount: Number(p.amount) + Number(h.amount) }
  })
})
const owedTotal = computed(() => aging.value.reduce((n, a) => n + a.amount, 0))
const RING = 2 * Math.PI * 48
const agingArcs = computed(() => {
  let offset = 0
  return aging.value.map((a) => {
    const length = owedTotal.value ? (a.amount / owedTotal.value) * RING : 0
    const seg = { key: a.key, length, offset }
    offset += length
    return seg
  })
})
const agingLabel = computed(() => `${peso(owedTotal.value)} owed: ${aging.value.map(a => `${a.label} ${peso(a.amount)}`).join(', ')}`)

// ── Collections, day by day ──
const trend = computed(() => (data.value?.collections.series ?? []).map(d => ({ key: d.key, value: Number(d.amount) || 0 })))
const trendScale = computed(() => {
  const top = Math.max(0, ...trend.value.map(d => d.value))
  const step = top > 0 ? 10 ** Math.max(0, Math.floor(Math.log10(top)) - 0) : 1
  const scale = niceScale(top / step)
  return { max: scale.max * step, ticks: scale.ticks.map(v => v * step) }
})
const pos = v => Math.min(100, ((v || 0) / (trendScale.value.max || 1)) * 100)
const curve = computed(() => {
  const n = trend.value.length
  if (n < 2) return { line: '', area: '' }
  const points = trend.value.map((d, i) => ({ x: ((i + 0.5) / n) * 1000, y: 200 - pos(d.value) * 2 }))
  const line = smoothPath(points)
  return { line, area: `${line} L${points[n - 1].x},200 L${points[0].x},200 Z` }
})

const methods = computed(() => data.value?.collections.by_method ?? [])
const methodMax = computed(() => Math.max(0, ...methods.value.map(m => Number(m.amount) || 0)))
const hospitalMax = computed(() => Math.max(0, ...(data.value?.top_hospitals ?? []).map(h => Number(h.amount) || 0)))

// ── The billing part of the forecast ──
const forecast = computed(() => {
  const b = forecastData.value?.billing
  if (!b) return null
  return {
    weeks: forecastData.value.method?.horizon_weeks ?? 4,
    amount_horizon: b.amount_horizon,
    amount_per_week: b.amount_per_week,
    requests_per_week: b.requests?.per_week,
  }
})
</script>

<style scoped>
.bdash { max-width: var(--rb-content-max, 1600px); margin: 0 auto; padding: 24px var(--rb-gutter, 24px) 40px; font-family: var(--rb-font-sans); color: var(--rb-text-primary); background: var(--rb-page-bg); }
.bdash-inner { display: flex; flex-direction: column; gap: 20px; }

.skeleton { border-radius: 18px; background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; }
.skeleton--header { height: 44px; max-width: 280px; }
.skeleton--card { height: 240px; }
.skeleton--panel { height: 300px; }
@keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

.header-row { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
.header-actions { display: flex; align-items: center; gap: 10px; }
.updated { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--rb-text-secondary); }
.btn-outline { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border: 1px solid var(--rb-border-strong, var(--rb-border)); border-radius: 10px; background: var(--rb-surface); font: inherit; font-size: 13px; font-weight: 600; color: var(--rb-text-primary); cursor: pointer; }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn-outline:disabled { opacity: 0.5; }
.btn-link { border: 0; background: none; padding: 0; font: inherit; font-weight: 700; color: var(--rb-primary-text); cursor: pointer; text-decoration: underline; }
.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px; background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); font-size: 13px; }
.banner__text { flex: 1; margin: 0; }

/* Bento */
.bento { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 16px; }
.bento__today { grid-column: span 5; }
.bento__owed { grid-column: span 7; }
.bento__trend { grid-column: span 8; }
.bento__method { grid-column: span 4; }
.bento__hospitals { grid-column: span 5; }
.bento__recent { grid-column: span 4; }
.bento__ahead { grid-column: span 3; }
.bento:not(:has(.bento__ahead)) .bento__recent { grid-column: span 7; }

.card { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 18px; border: 1px solid var(--rb-border); border-radius: 18px; background: var(--rb-surface); }
.card__head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 10px; }
.card__label { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--rb-text-secondary); }
.card__sub { margin: 4px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.card__sub strong { color: var(--rb-text-primary); }
.card__link { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text); text-decoration: none; }
.card__link:hover { text-decoration: underline; text-underline-offset: 3px; }
.empty { display: flex; align-items: center; gap: 8px; margin: auto 0; padding: 18px 0; font-size: 13px; color: var(--rb-text-secondary); }

/* Today */
.today { background: linear-gradient(160deg, rgba(var(--rb-primary-rgb), 0.08), var(--rb-surface) 60%); }
.today__amount { margin: 2px 0 0; font-size: 38px; font-weight: 800; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.today__sub { margin: 0; font-size: 13.5px; color: var(--rb-text-secondary); }
.today__sub strong { color: var(--rb-text-primary); }
.today__facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 4px 0 0; }
.today__facts div { padding: 10px 12px; border: 1px solid var(--rb-border); border-radius: 12px; background: var(--rb-surface); }
.today__facts dt { font-size: 12px; color: var(--rb-text-secondary); }
.today__facts dd { margin: 2px 0 0; font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
.today__facts small { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 12px; background: var(--rb-primary); color: #fff; font-size: 14px; font-weight: 700; text-decoration: none; box-shadow: 0 6px 16px -8px rgba(var(--rb-primary-rgb), 0.7); }
.btn-primary:hover { background: var(--rb-primary-hover, #0D47A1); }
.today__go { margin-top: auto; }

/* Still owed */
.owed__body { display: flex; flex: 1; align-items: center; gap: 24px; }
.donut { position: relative; flex: none; width: 150px; height: 150px; }
.donut svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.donut__base { fill: none; stroke: var(--rb-surface-alt); stroke-width: 14; }
.donut__seg { fill: none; stroke-width: 14; transition: stroke-dasharray 0.5s ease; }
.donut__seg--week { stroke: var(--rb-primary); }
.donut__seg--month { stroke: var(--rb-warning); }
.donut__seg--older { stroke: var(--rb-accent); }
.donut__center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.donut__center strong { font-size: 22px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
.donut__center small { margin-top: 3px; font-size: 11.5px; color: var(--rb-text-secondary); }
.aging { display: flex; flex: 1; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.aging__row { display: grid; grid-template-columns: 10px 1fr 28px auto; align-items: center; gap: 10px; font-size: 13px; }
.aging__dot { width: 10px; height: 10px; border-radius: 3px; }
.aging__dot--week { background: var(--rb-primary); }
.aging__dot--month { background: var(--rb-warning); }
.aging__dot--older { background: var(--rb-accent); }
.aging__label { font-weight: 600; }
.aging__count { text-align: right; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.aging__amount { min-width: 96px; text-align: right; font-weight: 800; font-variant-numeric: tabular-nums; }
.owed__note { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.owed__note strong { color: var(--rb-text-primary); }

/* Trend */
.chart { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 8px; }
.chart__y { display: flex; flex-direction: column; justify-content: space-between; height: 200px; font-size: 11px; text-align: right; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.chart__y span { transform: translateY(-50%); }
.chart__y span:last-child { transform: translateY(50%); }
.chart__plot { position: relative; }
.chart__grid, .chart__svg { position: absolute; inset: 0 0 auto; height: 200px; }
.chart__grid { display: flex; flex-direction: column-reverse; justify-content: space-between; pointer-events: none; }
.chart__grid span { height: 1px; background: var(--rb-border); }
.chart__svg { width: 100%; overflow: visible; pointer-events: none; }
.chart__stop--top { stop-color: var(--rb-success); stop-opacity: 0.24; }
.chart__stop--bottom { stop-color: var(--rb-success); stop-opacity: 0; }
.chart__line { fill: none; stroke: var(--rb-success); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.chart__cols { position: relative; display: flex; height: 200px; padding-bottom: 24px; box-sizing: content-box; }
.chart__col { position: relative; flex: 1; height: 100%; }
.chart__col::before { content: ''; position: absolute; top: 0; bottom: 0; left: 50%; border-left: 1px dashed var(--rb-border-strong, var(--rb-border)); opacity: 0; transition: opacity 120ms ease; }
.chart__col:hover::before { opacity: 1; }
.chart__dot { position: absolute; left: 50%; width: 8px; height: 8px; border: 2px solid var(--rb-surface); border-radius: 50%; background: var(--rb-success); opacity: 0; transform: translate(-50%, 50%); }
.chart__col:hover .chart__dot { opacity: 1; }
.chart__tip { position: absolute; left: 50%; z-index: 2; display: flex; flex-direction: column; padding: 6px 9px; border-radius: 8px; background: var(--rb-text-primary); font-size: 11.5px; white-space: nowrap; color: var(--rb-surface); opacity: 0; pointer-events: none; transform: translateX(-50%); transition: opacity 120ms ease; }
.chart__col:hover .chart__tip { opacity: 1; }
.chart__col:nth-child(-n + 3) .chart__tip { left: 0; transform: none; }
.chart__col:nth-last-child(-n + 3) .chart__tip { left: auto; right: 0; transform: none; }
.chart__x { position: absolute; top: calc(100% + 6px); left: 50%; font-size: 11px; white-space: nowrap; color: var(--rb-text-secondary); transform: translateX(-50%); }
.chart__col:last-child .chart__x { left: auto; right: 0; transform: none; }
.chart__empty { position: absolute; top: 80px; left: 50%; margin: 0; padding: 6px 12px; border-radius: 999px; background: var(--rb-surface); box-shadow: 0 0 0 1px var(--rb-border); font-size: 12.5px; white-space: nowrap; color: var(--rb-text-secondary); transform: translateX(-50%); }

/* Methods */
.methods { display: flex; flex-direction: column; gap: 14px; margin: 0; padding: 0; list-style: none; }
.method { display: flex; flex-direction: column; gap: 5px; font-size: 13px; }
.method__top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.method__label { font-weight: 600; }
.method__amount { font-weight: 800; font-variant-numeric: tabular-nums; }
.method__track, .hospital__track { height: 8px; border-radius: 999px; background: var(--rb-surface-alt); box-shadow: inset 0 0 0 1px var(--rb-border); overflow: hidden; }
.method__track > span { display: block; height: 100%; border-radius: inherit; background: var(--rb-success); }
.method__count { font-size: 11.5px; color: var(--rb-text-secondary); }
.method--none { color: var(--rb-text-muted); }

/* Hospitals */
.hospitals { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
.hospital { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "name amount" "track track" "count count"; gap: 4px 10px; font-size: 13px; }
.hospital__name { grid-area: name; overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.hospital__amount { grid-area: amount; font-weight: 800; font-variant-numeric: tabular-nums; }
.hospital__track { grid-area: track; }
.hospital__track > span { display: block; height: 100%; border-radius: inherit; background: var(--rb-warning); }
.hospital__count { grid-area: count; font-size: 11.5px; color: var(--rb-text-secondary); }

/* Recent payments */
.recent { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.recent__row { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "no amount" "who when"; gap: 2px 10px; padding: 9px 0; border-top: 1px solid var(--rb-border); font-size: 13px; }
.recent__row:first-child { border-top: 0; padding-top: 0; }
.recent__no { grid-area: no; font-family: var(--rb-font-mono); font-size: 12px; font-weight: 700; color: var(--rb-primary-text); text-decoration: none; }
.recent__no:hover { text-decoration: underline; }
.recent__who { grid-area: who; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--rb-text-secondary); }
.recent__amount { grid-area: amount; text-align: right; font-weight: 800; font-variant-numeric: tabular-nums; }
.recent__when { grid-area: when; text-align: right; font-size: 11.5px; color: var(--rb-text-muted); }
.recent__row--void .recent__amount { text-decoration: line-through; color: var(--rb-text-muted); }

/* Next weeks */
.ahead { background: linear-gradient(160deg, rgba(var(--rb-primary-rgb), 0.06), var(--rb-surface) 70%); }
.ahead__amount { margin: 0; font-size: 26px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }
.ahead__sub { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.ahead__facts { display: grid; gap: 8px; margin: auto 0 0; }
.ahead__facts div { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
.ahead__facts dt { color: var(--rb-text-secondary); }
.ahead__facts dd { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; }

@media (max-width: 1200px) {
  .bento__today, .bento__owed, .bento__trend, .bento__method { grid-column: span 12; }
  .bento__hospitals, .bento__recent { grid-column: span 6; }
  .bento__ahead, .bento:not(:has(.bento__ahead)) .bento__recent { grid-column: span 12; }
}
@media (max-width: 760px) {
  .bento__hospitals, .bento__recent { grid-column: span 12; }
  .owed__body { flex-direction: column; align-items: stretch; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin { animation: none; }
  .donut__seg, .chart__col::before, .chart__tip { transition: none; }
}
</style>
