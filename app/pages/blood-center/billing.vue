<template>
  <div class="bl-page">
    <div class="bl-inner">
      <header class="page-header">
        <div>
          <h1 class="page-title">Statements</h1>
          <p class="page-subtitle">
            A bill is raised the moment stock is reserved for a request. Patient bills are paid at the counter and hold
            the blood until they are paid or met by the government subsidy; weekly orders are billed to the hospital
            and recorded here once it settles them.
          </p>
        </div>
        <div class="header-actions">
          <NuxtLink v-if="canSeePayments" to="/blood-center/pos" class="btn btn-primary">
            <AssetIcon name="credit-card" :size="15" />
            Billing counter
          </NuxtLink>
          <NuxtLink v-if="canSeePayments" to="/blood-center/receipts" class="btn btn-outline">Receipts</NuxtLink>
          <button class="btn btn-outline" :disabled="loading" @click="refreshAll">
            <AssetIcon name="refresh-cw" :size="15" :class="{ spinning: loading }" />
            Refresh
          </button>
        </div>
      </header>

      <!-- Documents are headed by the centre's own logo; without one, its initials. -->
      <p v-if="summary && !summary.issuer?.logo_url" class="banner banner--info">
        <AssetIcon name="info" :size="15" />
        <span>
          Statements and receipts print with your centre's initials because no logo is uploaded.
          <template v-if="can('center.configure')">
            Upload one in <NuxtLink to="/blood-center/settings" class="inline-link">Settings</NuxtLink>.
          </template>
          <template v-else>Your Blood Center Admin can upload one in Settings.</template>
        </span>
      </p>

      <!-- Counted on the server, never from the page of rows this screen holds. -->
      <dl v-if="summary" class="figures">
        <div class="figure">
          <dt>Holding blood back</dt>
          <dd :class="{ 'figure--alert': summary.outstanding.count }">{{ summary.outstanding.count }}</dd>
          <span>{{ pesos(summary.outstanding.amount) }} owed by patients</span>
        </div>
        <div class="figure">
          <dt>Collected today</dt>
          <dd>{{ pesos(summary.collected_today) }}</dd>
          <span>Cash and GCash, less voids</span>
        </div>
        <div class="figure">
          <dt>Collected this month</dt>
          <dd>{{ pesos(summary.collected_this_month) }}</dd>
          <span>{{ summary.subsidised_this_month.count }} subsidised · {{ pesos(summary.subsidised_this_month.amount) }} waived</span>
        </div>
        <div class="figure">
          <dt>Awaiting hospital settlement</dt>
          <dd>{{ summary.weekly_awaiting_settlement.count }}</dd>
          <span>{{ pesos(summary.weekly_awaiting_settlement.amount) }} in weekly statements</span>
        </div>
      </dl>

      <section class="card list-card" aria-label="Statements">
        <div class="list-head">
          <!-- Owed by different people, never added together. -->
          <div class="categories" role="tablist" aria-label="Bill category">
            <button
              v-for="c in CATEGORIES"
              :key="c.value"
              role="tab"
              class="category"
              :class="{ 'category--on': category === c.value }"
              :aria-selected="category === c.value"
              @click="category = c.value"
            >
              {{ c.label }}
              <small>{{ c.note }}</small>
            </button>
          </div>

          <div class="filters">
            <div class="search">
              <AssetIcon name="search" :size="16" class="search-icon" />
              <input
                v-model="search"
                type="search"
                class="input search-input"
                :placeholder="category === 'weekly' ? 'Request reference' : 'Request reference or patient'"
                aria-label="Search statements"
                @input="onSearch"
              >
            </div>
            <div class="pills" role="group" aria-label="Status">
              <button v-for="tab in tabs" :key="tab.value" class="pill" :class="{ 'pill--on': activeTab === tab.value }" :aria-pressed="activeTab === tab.value" @click="activeTab = tab.value">
                {{ tab.label }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="error" class="banner banner--error banner--inset">
          <AssetIcon name="triangle-alert" :size="15" />
          <span>{{ error }}</span>
          <button class="btn btn-outline btn-sm" @click="load()">Retry</button>
        </div>

        <div v-if="loading" class="skeleton-wrap"><div v-for="n in 5" :key="n" class="skeleton" /></div>

        <div v-else-if="!statements.length && !error" class="empty">
          <AssetIcon name="inbox" :size="32" />
          <h2>{{ search.trim() ? 'Nothing matches that search' : category === 'weekly' ? 'No hospital statements here' : 'No patient bills here' }}</h2>
          <p>{{ category === 'weekly' ? 'A weekly order is billed to its hospital once stock is reserved for it.' : 'A patient bill is raised once stock is reserved for a transfusion request.' }}</p>
        </div>

        <div v-else-if="statements.length" class="table-scroll">
          <table class="bl-table">
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">{{ category === 'weekly' ? 'Hospital' : 'Patient' }}</th>
                <th scope="col">Components</th>
                <th scope="col" class="num">Total</th>
                <th v-if="category === 'patient'" scope="col" class="num">Balance</th>
                <th scope="col">Status</th>
                <th v-if="category === 'patient'" scope="col">Release</th>
                <th v-else scope="col">Settled</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in statements" :key="s.id" class="row" @click="open(s)">
                <td>
                  <NuxtLink :to="`/blood-center/statement/${requestIdOf(s)}`" class="link mono" @click.stop>{{ s.request?.reference_number || '—' }}</NuxtLink>
                  <BillingBadge v-if="s.request?.is_emergency" tone="danger">STAT</BillingBadge>
                  <span class="sub">{{ day(s.billing_date) }}</span>
                </td>
                <td>
                  <template v-if="category === 'weekly'">{{ s.request?.requesting_facility || '—' }}</template>
                  <template v-else>
                    {{ s.request?.patient_name || 'Patient' }}
                    <span class="sub">{{ s.request?.requesting_facility || '—' }}</span>
                  </template>
                </td>
                <td class="components">
                  <span v-if="s.request?.blood_type" class="type">{{ s.request.blood_type }}</span>
                  {{ (s.request?.components || []).join(', ') || '—' }}
                </td>
                <td class="num strong">{{ pesos(s.total_amount) }}</td>
                <td v-if="category === 'patient'" class="num" :class="{ owing: balanceOf(s) > 0 }">{{ balanceOf(s) > 0 ? pesos(balanceOf(s)) : '—' }}</td>
                <td><BillingBadge :tone="statementStamp(s.status).tone">{{ s.status_label }}</BillingBadge></td>
                <td v-if="category === 'patient'">
                  <span class="gate" :class="s.clears_release ? 'gate--ok' : 'gate--held'">
                    <AssetIcon :name="s.clears_release ? 'check' : 'x'" :size="12" />
                    {{ s.clears_release ? 'Cleared' : 'Held' }}
                  </span>
                </td>
                <td v-else class="nowrap">
                  <template v-if="s.settlement">
                    {{ day(s.settlement.settled_at) }}
                    <span class="sub mono">{{ s.settlement.reference }}</span>
                  </template>
                  <span v-else class="muted">Awaiting the hospital</span>
                </td>
                <td class="row-actions" @click.stop>
                  <!-- Write actions only for whoever may record money; billing.view alone reads. -->
                  <NuxtLink v-if="canSeePayments && takesPayment(s)" :to="`/blood-center/pos?request=${requestIdOf(s)}`" class="btn btn-primary btn-sm">
                    Take payment
                  </NuxtLink>
                  <NuxtLink :to="`/blood-center/statement/${requestIdOf(s)}`" class="btn btn-outline btn-sm">Open</NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer v-if="!loading && meta.last_page > 1" class="pager">
          <button class="btn btn-outline btn-sm" :disabled="meta.current_page <= 1" @click="load(meta.current_page - 1)">Previous</button>
          <span>Page {{ meta.current_page }} of {{ meta.last_page }}</span>
          <button class="btn btn-outline btn-sm" :disabled="meta.current_page >= meta.last_page" @click="load(meta.current_page + 1)">Next</button>
        </footer>
      </section>
    </div>
  </div>
</template>

<script setup>
/**
 * Every statement raised against this centre's requests, in the two categories
 * that are owed by different people and never added together: patient bills,
 * paid at the counter, and the hospitals' weekly statements, settled outside
 * RedAgos. A row opens its statement, where everything about it is done.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import BillingBadge from '~/components/BloodCenter/BillingBadge.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { pesos, statementStamp, takesPayment } from '~/utils/billing'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.view',
})

const { can } = useUser()

// Taking money, and the counter and receipts that go with it, are the Billing
// department's; billing.view alone reads the statements.
const canSeePayments = computed(() => can('billing.record_payment'))

const CATEGORIES = [
  { value: 'patient', label: 'Patient bills', note: 'Paid at the counter' },
  { value: 'weekly', label: 'Hospital statements', note: 'Weekly restocking' },
]

const TABS = {
  patient: [
    { value: 'outstanding', label: 'Outstanding' },
    { value: 'paid', label: 'Paid' },
    { value: 'subsidised', label: 'Subsidised' },
    { value: 'all', label: 'All' },
  ],
  weekly: [
    { value: 'statement_only', label: 'Awaiting settlement' },
    { value: 'settled_outside', label: 'Settled' },
    { value: 'all', label: 'All' },
  ],
}

const route = useRoute()
const statements = ref([])
const meta = reactive({ current_page: 1, last_page: 1 })
const loading = ref(true)
const error = ref('')
const search = ref('')
const category = ref(route.query.category === 'weekly' ? 'weekly' : 'patient')
const activeTab = ref(TABS[category.value][0].value)
const summary = ref(null)

const tabs = computed(() => TABS[category.value])

function day(value) {
  return value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'
}

function requestIdOf(statement) {
  return statement?.request?.id ?? statement?.request_id
}

// Read from the row's own figures; the statement page shows the server's exact balance.
function balanceOf(statement) {
  if (!statement.collects_payment) return 0
  return Math.max(Math.round((Number(statement.total_amount) - Number(statement.collected)) * 100), 0) / 100
}

function open(statement) {
  navigateTo(`/blood-center/statement/${requestIdOf(statement)}`)
}

let searchDebounce = null
function onSearch() {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => load(), 350)
}

watch(category, () => {
  activeTab.value = tabs.value[0].value
  load()
})
watch(activeTab, () => load())

async function load(page = 1) {
  loading.value = true
  error.value = ''

  const params = { category: category.value, page }
  if (activeTab.value === 'outstanding') params.outstanding = 1
  else if (activeTab.value !== 'all') params.status = activeTab.value
  if (search.value.trim()) params.search = search.value.trim()

  try {
    const response = await bloodCenterService.billings(params)
    statements.value = response?.data ?? []
    meta.current_page = response?.current_page ?? 1
    meta.last_page = response?.last_page ?? 1
  } catch (err) {
    error.value = err?.message || 'Could not load statements.'
    statements.value = []
  } finally {
    loading.value = false
  }
}

async function loadSummary() {
  try {
    summary.value = await bloodCenterService.billingSummary()
  } catch {
    // The figures are a convenience; the list below still works without them.
    summary.value = null
  }
}

async function refreshAll() {
  await Promise.all([load(meta.current_page), loadSummary()])
}

onMounted(() => Promise.all([load(), loadSummary()]))
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.bl-page { background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 24px var(--rb-gutter, 24px) 40px; }
.bl-inner { max-width: var(--rb-content-max, 1600px); margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.page-title { font-size: 20px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 75ch; }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

/* One strip of figures, divided rather than boxed. */
.figures {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0;
  background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px;
}
.figure { display: flex; flex-direction: column; gap: 2px; padding: 14px 18px; border-left: 1px solid var(--rb-border); min-width: 0; }
.figure:first-child { border-left: 0; }
.figure dt { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.figure dd { margin: 0; font-size: 20px; font-weight: 800; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.figure dd.figure--alert { color: var(--rb-accent-text); }
.figure span { font-size: 12px; color: var(--rb-text-secondary); }

.card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; overflow: hidden; }
.list-head { display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; padding: 14px 16px; border-bottom: 1px solid var(--rb-border); }

.categories { display: inline-flex; gap: 4px; }
.category {
  display: flex; flex-direction: column; align-items: flex-start; gap: 1px; padding: 8px 14px; border-radius: 10px;
  border: 1px solid transparent; background: transparent; font-family: inherit; font-size: 13.5px; font-weight: 700;
  color: var(--rb-text-secondary); cursor: pointer; text-align: left;
}
.category small { font-size: 11.5px; font-weight: 500; color: var(--rb-text-muted); }
.category:hover { background: var(--rb-surface-hover); color: var(--rb-text-primary); }
.category--on { background: rgba(var(--rb-primary-rgb), .07); border-color: rgba(var(--rb-primary-rgb), .25); color: var(--rb-primary-text); }
.category--on small { color: var(--rb-text-secondary); }

.filters { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.search { position: relative; width: 280px; }
.search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--rb-text-muted); pointer-events: none; }
.search .search-input { padding-left: 36px; }
.pills { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: var(--rb-surface-alt); border: 1px solid var(--rb-border); }
.pill { padding: 6px 12px; border: 0; border-radius: 8px; background: transparent; font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.pill:hover { color: var(--rb-text-primary); }
.pill--on { background: var(--rb-surface); color: var(--rb-text-primary); box-shadow: var(--rb-shadow-sm); }

.table-scroll { overflow-x: auto; }
.bl-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.bl-table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--rb-text-secondary); background: var(--rb-surface-alt); padding: 10px 14px; border-bottom: 1px solid var(--rb-border); white-space: nowrap; }
.bl-table td { padding: 12px 14px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); vertical-align: middle; }
.bl-table tbody tr:last-child td { border-bottom: 0; }
.row { cursor: pointer; transition: background-color .12s var(--rb-ease-out); }
.row:hover td { background: var(--rb-surface-hover); }
.sub { display: block; font-size: 11.5px; color: var(--rb-text-secondary); margin-top: 1px; }
.components { max-width: 280px; }
.type { display: inline-block; margin-right: 4px; padding: 1px 6px; border-radius: 6px; font-size: 11px; font-weight: 700; color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), .08); }
.owing { color: var(--rb-accent-text); font-weight: 700; }
.gate { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; }
.gate--ok { color: var(--rb-success-text); }
.gate--held { color: var(--rb-accent-text); }
.row-actions { text-align: right; white-space: nowrap; }
.row-actions .btn + .btn { margin-left: 6px; }
.num { text-align: right !important; white-space: nowrap; }
.nowrap { white-space: nowrap; }
.strong { font-weight: 700; }
.muted { color: var(--rb-text-muted); }
.mono { font-family: var(--rb-font-mono); }
.link { color: var(--rb-primary-text); font-weight: 700; text-decoration: none; margin-right: 6px; }
.link:hover { text-decoration: underline; text-underline-offset: 3px; }

.pager { display: flex; justify-content: center; align-items: center; gap: 12px; padding: 12px; border-top: 1px solid var(--rb-border); font-size: 12.5px; color: var(--rb-text-secondary); }

.input {
  width: 100%; padding: 9px 11px; font-size: 13.5px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.banner { display: flex; align-items: center; gap: 9px; padding: 11px 14px; border-radius: 10px; font-size: 13px; margin: 0; }
.banner--info { background: rgba(var(--rb-primary-rgb), .06); color: var(--rb-primary-text); border: 1px solid rgba(var(--rb-primary-rgb), .2); }
.banner--error { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .25); }
.banner--inset { margin: 12px 16px 0; }
.inline-link { color: inherit; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }

.empty { text-align: center; padding: 56px 20px; color: var(--rb-text-secondary); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty h2 { font-size: 15px; color: var(--rb-text-primary); margin: 4px 0 0; }
.empty p { font-size: 13px; margin: 0; max-width: 52ch; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 14px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 9px; cursor: pointer; white-space: nowrap; text-decoration: none;
  transition: background-color .15s var(--rb-ease-out);
}
.btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.btn-primary { background: var(--rb-primary); color: #fff; border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: #10509c; }
.btn-outline { background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.spinning { animation: spin .9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }

.skeleton-wrap { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.skeleton {
  height: 46px; border-radius: 8px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (prefers-reduced-motion: reduce) {
  .skeleton, .spinning { animation: none; }
  .row, .btn { transition: none; }
}

@media (max-width: 1000px) {
  .figures { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .figure:nth-child(3) { border-left: 0; }
  .figure:nth-child(n + 3) { border-top: 1px solid var(--rb-border); }
}

@media (max-width: 640px) {
  .figures { grid-template-columns: 1fr; }
  .figure { border-left: 0; border-top: 1px solid var(--rb-border); }
  .figure:first-child { border-top: 0; }
  .search { width: 100%; }
  .categories { width: 100%; }
  .category { flex: 1; }
}
</style>
