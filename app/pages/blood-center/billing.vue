<template>
  <div class="bl-page">
    <div class="bl-inner">
      <!-- Invoices only (project owner, 2026-10-25): one per billable request.
           A hospital's period summary is Statements; payments are Receipts. -->
      <PageHeader title="Invoices">
        <template #actions>
          <NuxtLink v-if="canSeeReports" to="/blood-center/financial-reports" class="ui-btn">
            <AssetIcon name="chart" :size="15" />
            Financial reports
          </NuxtLink>
          <NuxtLink v-if="canSeePayments" to="/blood-center/billing-transactions" class="ui-btn">
            <AssetIcon name="list" :size="15" />
            Transactions
          </NuxtLink>
          <button class="ui-btn btn-icon-only" :disabled="loading" aria-label="Refresh" title="Refresh" @click="refreshAll">
            <AssetIcon name="refresh-cw" :size="15" :class="{ spinning: loading }" />
            <span class="btn-label">Refresh</span>
          </button>
        </template>
      </PageHeader>

      <!--
        The invoices at a glance, each a filter on the list below (2026-10-27).
        What the counter collected is on the Billing dashboard.
      -->
      <div class="overview" role="group" aria-label="Show invoices" :aria-busy="!summary">
        <button
          v-for="card in overviewCards"
          :key="card.key"
          type="button"
          class="overview-card"
          :class="[`overview-card--${card.tone}`, { 'overview-card--on': isShowing(card), 'overview-card--zero': summary && !card.count }]"
          :aria-pressed="isShowing(card)"
          @click="show(card)"
        >
          <span class="overview-top">
            <span class="overview-icon" :class="`overview-icon--${card.tone}`"><AssetIcon :name="card.icon" :size="17" /></span>
            <span class="overview-label">{{ card.label }}</span>
            <AssetIcon name="arrow-right" :size="14" class="overview-go" />
          </span>
          <span class="overview-value">{{ summary ? card.value : '—' }}</span>
          <span class="overview-note">{{ summary ? card.note : '' }}</span>
        </button>
      </div>

      <section class="card list-card" aria-label="Invoices">
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
              <span class="category-top">
                {{ c.label }}
                <span v-if="waitingIn(c.value)" class="category-count">{{ waitingIn(c.value) }}</span>
              </span>
            </button>
          </div>

          <div class="filters">
            <div class="search">
              <AssetIcon name="search" :size="16" class="search-icon" />
              <input
                v-model="search"
                type="search"
                class="input search-input"
                :placeholder="category === 'weekly' ? 'Invoice or request number' : 'Invoice, request or patient'"
                aria-label="Search invoices"
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
          <button class="ui-btn ui-btn--sm" @click="load()">Retry</button>
        </div>

        <div v-if="loading" class="skeleton-wrap"><div v-for="n in 5" :key="n" class="skeleton" /></div>

        <!-- Says what an empty tab means: good news, nothing yet, or no match (2026-10-27). -->
        <div v-else-if="!statements.length && !error" class="inv-empty" :class="{ 'inv-empty--good': emptyState.good }">
          <span class="inv-empty__icon" aria-hidden="true"><AssetIcon :name="emptyState.icon" :size="24" /></span>
          <h2 class="inv-empty__title">{{ emptyState.title }}</h2>
          <p v-if="emptyState.text" class="inv-empty__text">{{ emptyState.text }}</p>
          <button v-if="search.trim()" type="button" class="ui-btn" @click="clearSearch">
            <AssetIcon name="x" :size="14" />
            Clear search
          </button>
          <NuxtLink v-else-if="emptyState.to" :to="emptyState.to" class="ui-btn">
            <AssetIcon :name="emptyState.actionIcon" :size="15" />
            {{ emptyState.action }}
          </NuxtLink>
        </div>

        <div v-else-if="statements.length" class="table-scroll">
          <table class="bl-table">
            <thead>
              <tr>
                <th scope="col">Invoice</th>
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
                  <NuxtLink v-if="s.invoice_number" :to="`/blood-center/invoice/${requestIdOf(s)}`" class="link mono" @click.stop>{{ s.invoice_number }}</NuxtLink>
                  <span v-else class="muted">Not issued</span>
                  <span class="sub">{{ day(s.billing_date) }}</span>
                </td>
                <td>
                  <span class="mono">{{ s.request?.reference_number || '—' }}</span>
                  <BillingBadge v-if="s.request?.is_emergency" tone="danger">STAT</BillingBadge>
                </td>
                <td>
                  <template v-if="category === 'weekly'">{{ s.request?.requesting_facility || '—' }}</template>
                  <div v-else class="who">
                    <span class="who-avatar" aria-hidden="true">{{ initialsOf(s.request?.patient_name) }}</span>
                    <div>
                      {{ s.request?.patient_name || 'Patient' }}
                      <span class="sub">{{ s.request?.requesting_facility || '—' }}</span>
                    </div>
                  </div>
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
                  <NuxtLink v-if="canSeePayments && takesPayment(s)" :to="`/blood-center/pos?request=${requestIdOf(s)}`" class="ui-btn ui-btn--primary ui-btn--sm">
                    Take payment
                  </NuxtLink>
                  <NuxtLink :to="`/blood-center/invoice/${requestIdOf(s)}`" class="ui-btn ui-btn--sm">Open</NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer v-if="!loading && meta.last_page > 1" class="pager">
          <button class="ui-btn ui-btn--sm" :disabled="meta.current_page <= 1" @click="load(meta.current_page - 1)">Previous</button>
          <span>Page {{ meta.current_page }} of {{ meta.last_page }}</span>
          <button class="ui-btn ui-btn--sm" :disabled="meta.current_page >= meta.last_page" @click="load(meta.current_page + 1)">Next</button>
        </footer>
      </section>
    </div>
  </div>
</template>

<script setup>
/**
 * Every invoice raised against this centre's requests, one per billable
 * request, in the two categories that are owed by different people and never
 * added together: patient invoices, paid at the counter, and the hospitals'
 * weekly invoices, settled outside RedAgos. A row opens its invoice, where
 * everything about it is done. Kept at /blood-center/billing, the Billing
 * department's home; the page was "Statements" until 2026-10-25.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import BillingBadge from '~/components/BloodCenter/BillingBadge.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { pesos, statementStamp, takesPayment } from '~/utils/billing'
import PageHeader from '~/components/ui/PageHeader.vue'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.view',
})

const { can } = useUser()

// Taking money, and the counter and receipts that go with it, are the Billing
// department's; billing.view alone reads the invoices.
const canSeePayments = computed(() => can('billing.record_payment'))
const canSeeReports = computed(() => can('reports.financial'))

const CATEGORIES = [
  { value: 'patient', label: 'Patient invoices' },
  { value: 'weekly', label: 'Hospital invoices' },
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

// Read from the row's own figures; the invoice page shows the server's exact balance.
function balanceOf(statement) {
  if (!statement.collects_payment) return 0
  return Math.max(Math.round((Number(statement.total_amount) - Number(statement.collected)) * 100), 0) / 100
}

function initialsOf(name) {
  return (name || 'P').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

// ── The invoices at a glance, each a filter ──
const overviewCards = computed(() => {
  const sm = summary.value ?? {}
  const month = sm.patient_bills_this_month ?? {}
  const outstanding = sm.outstanding?.count ?? 0
  const awaiting = sm.weekly_awaiting_settlement?.count ?? 0
  const subsidised = sm.subsidised_this_month?.count ?? 0
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
  return [
    { key: 'outstanding', category: 'patient', tab: 'outstanding', tone: 'amber', icon: 'receipt', label: 'Patient balances',
      count: outstanding, value: pesos(sm.outstanding?.amount),
      note: outstanding ? `${plural(outstanding, 'invoice', 'invoices')} still to be paid` : 'Every patient invoice is paid' },
    { key: 'awaiting', category: 'weekly', tab: 'statement_only', tone: 'purple', icon: 'building-2', label: 'Awaiting hospital settlement',
      count: awaiting, value: pesos(sm.weekly_awaiting_settlement?.amount),
      note: awaiting ? `${plural(awaiting, 'hospital invoice', 'hospital invoices')} to settle` : 'No hospital invoice waiting' },
    { key: 'paid', category: 'patient', tab: 'paid', tone: 'green', icon: 'check-circle', label: 'Paid this month',
      count: month.paid ?? 0, value: String(month.paid ?? 0),
      note: month.partial ? `${plural(month.partial, 'more', 'more')} partly paid` : 'Patient invoices paid in full' },
    { key: 'subsidised', category: 'patient', tab: 'subsidised', tone: 'blue', icon: 'heart', label: 'Subsidised this month',
      count: subsidised, value: pesos(sm.subsidised_this_month?.amount),
      note: plural(subsidised, 'invoice met by the subsidy', 'invoices met by the subsidy') },
  ]
})

const isShowing = card => category.value === card.category && activeTab.value === card.tab

/** Opens the list on what a card counts. */
async function show(card) {
  if (category.value !== card.category) {
    category.value = card.category
    // The category watcher resets the tab; set it once that has run.
    await nextTick()
  }
  activeTab.value = card.tab
  document.querySelector('.list-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ── An empty tab, said for what it is ──
const EMPTY = {
  'patient:outstanding': { good: true, icon: 'check-check', title: 'Every patient invoice is paid', text: 'Nothing is waiting to be collected. A new invoice appears here once Issuance reserves units for a request.', to: '/blood-center/pos', action: 'Open billing counter', actionIcon: 'philippine-peso' },
  'patient:paid': { icon: 'receipt', title: 'No paid invoices yet', text: 'Invoices paid in full at the billing counter appear here.' },
  'patient:subsidised': { icon: 'heart', title: 'No subsidised invoices', text: 'Invoices met by the government subsidy appear here, applied at the billing counter.' },
  'patient:all': { icon: 'file-text', title: 'No patient invoices yet', text: 'An invoice is raised for each patient request once Issuance reserves units for it.' },
  'weekly:statement_only': { good: true, icon: 'check-check', title: 'No hospital invoice awaiting settlement', text: 'Every released weekly order has been settled.', to: '/blood-center/statements', action: 'View statements', actionIcon: 'clipboard' },
  'weekly:settled_outside': { icon: 'building-2', title: 'No settled hospital invoices yet', text: "Once a hospital pays a weekly invoice, its settlement is recorded at the billing counter and it moves here." },
  'weekly:all': { icon: 'building-2', title: 'No hospital invoices yet', text: "A hospital's weekly replenishment order is invoiced once Issuance releases it." },
}
const emptyState = computed(() => {
  if (search.value.trim()) {
    return { icon: 'search-x', title: `Nothing matches “${search.value.trim()}”`, text: category.value === 'weekly' ? 'Check the invoice or request number.' : "Check the number, or search by the patient's name." }
  }
  return EMPTY[`${category.value}:${activeTab.value}`] ?? { icon: 'inbox', title: 'No invoices here', text: '' }
})

function clearSearch() {
  search.value = ''
  load()
}

// Beside each category tab: what is still waiting in it.
function waitingIn(value) {
  if (!summary.value) return 0
  return value === 'weekly' ? summary.value.weekly_awaiting_settlement?.count ?? 0 : summary.value.outstanding?.count ?? 0
}

function open(statement) {
  navigateTo(`/blood-center/invoice/${requestIdOf(statement)}`)
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
    error.value = err?.message || 'Could not load invoices.'
    statements.value = []
  } finally {
    loading.value = false
  }
}

async function loadSummary() {
  try {
    summary.value = await bloodCenterService.billingSummary()
  } catch {
    // The tab counts are a convenience; the list still works without them.
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

/* Four filter cards: each its own tile, its colour on the icon, the one showing outlined in blue. */
.overview { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0; }
.overview-card {
  --tone-rgb: var(--rb-primary-rgb);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 16px 18px;
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  background: var(--rb-surface);
  font: inherit;
  text-align: left;
  color: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.1s ease;
}
.overview-card--amber { --tone-rgb: var(--rb-warning-rgb); }
.overview-card--purple { --tone-rgb: var(--rb-purple-rgb); }
.overview-card--green { --tone-rgb: var(--rb-success-rgb); }
.overview-card:hover { border-color: rgba(var(--tone-rgb), 0.5); background: rgba(var(--tone-rgb), 0.04); }
.overview-card:active { transform: translateY(1px); }
.overview-card:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.overview-card--on, .overview-card--on:hover { border-color: var(--rb-primary); box-shadow: 0 0 0 1px var(--rb-primary); background: rgba(var(--rb-primary-rgb), 0.04); }
.overview-card--zero .overview-value { color: var(--rb-text-muted); }
.overview-top { display: flex; align-items: center; gap: 8px; }
.overview-label { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); }
.overview-go { flex: none; color: var(--rb-text-muted); opacity: 0; transition: opacity 0.15s ease; }
.overview-card:hover .overview-go, .overview-card--on .overview-go { opacity: 1; color: var(--rb-primary-text); }
.overview-value { font-size: 24px; font-weight: 800; line-height: 1.2; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.overview-note { min-height: 16px; font-size: 12px; color: var(--rb-text-muted); }
@media (prefers-reduced-motion: reduce) {
  .overview-card, .overview-go { transition: none; }
}
.overview-icon { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; }
.overview-icon--green { color: var(--rb-success-text); background: rgba(var(--rb-success-rgb), .1); }
.overview-icon--blue { color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .09); }
.overview-icon--amber { color: var(--rb-warning-text); background: rgba(var(--rb-warning-rgb), .13); }
.overview-icon--purple { color: var(--rb-purple-text); background: rgba(var(--rb-purple-rgb), .1); }

/* Text | actions. The actions column never wraps under the text, so the
   buttons stay on the right at every width; only the text column shrinks. */
.page-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 16px; }
.page-heading { min-width: 0; }
.page-title { font-size: 24px; font-weight: 800; letter-spacing: -0.01em; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 72ch; }
.header-actions { display: flex; gap: 8px; justify-content: flex-end; align-self: start; }

/* Category tabs on top, with search and status beneath them. */
/* The list is one white card, its tabs, filters and rows inside it, as on Payments. */
.list-card { overflow: hidden; background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 16px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
.list-head { display: flex; flex-direction: column; border-bottom: 1px solid var(--rb-border); }
.categories { display: flex; gap: 4px; padding: 0 16px; border-bottom: 1px solid var(--rb-border); }
.category {
  position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 1px; padding: 14px 14px 12px;
  border: 0; background: transparent; font-family: inherit; font-size: 13.5px; font-weight: 700;
  color: var(--rb-text-secondary); cursor: pointer; text-align: left;
}
.category::after { content: ''; position: absolute; left: 10px; right: 10px; bottom: -1px; height: 2px; border-radius: 2px 2px 0 0; background: transparent; }
.category-top { display: inline-flex; align-items: center; gap: 7px; }
.category-count { min-width: 20px; padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 800; text-align: center; color: var(--rb-text-secondary); background: var(--rb-surface-alt); border: 1px solid var(--rb-border); }
.category:hover { color: var(--rb-text-primary); }
.category:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); border-radius: 8px; }
.category--on { color: var(--rb-primary-text); }
.category--on::after { background: var(--rb-primary); }
.category--on .category-count { color: #fff; background: var(--rb-primary); border-color: var(--rb-primary); }

.filters { display: flex; justify-content: space-between; gap: 10px; align-items: center; flex-wrap: wrap; padding: 14px 16px; background: var(--rb-surface); }
.search { position: relative; flex: 1 1 320px; min-width: 0; }
.search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--rb-text-muted); pointer-events: none; }
.search .search-input { padding-left: 36px; }
.pills { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: var(--rb-surface); border: 1px solid var(--rb-border); }
.pill { padding: 6px 12px; border: 0; border-radius: 8px; background: transparent; font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.pill:hover { color: var(--rb-text-primary); }
.pill--on { background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }

.table-scroll { overflow-x: auto; }
.bl-table { width: 100%; min-width: 1040px; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.bl-table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--rb-text-secondary); background: var(--rb-surface); padding: 10px 14px; border-bottom: 1px solid var(--rb-border); white-space: nowrap; }
.bl-table td { padding: 12px 14px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); vertical-align: middle; }
.bl-table tbody tr:last-child td { border-bottom: 0; }
.row { cursor: pointer; transition: background-color .12s var(--rb-ease-out); }
.row:hover td { background: var(--rb-surface-hover); }
.sub { display: block; font-size: 11.5px; color: var(--rb-text-secondary); margin-top: 1px; }
.components { max-width: 280px; }
.type { display: inline-block; margin-right: 4px; padding: 1px 6px; border-radius: 6px; font-size: 11px; font-weight: 700; color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), .08); }
.owing { color: var(--rb-accent-text); font-weight: 700; }
.gate { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.gate--ok { color: var(--rb-success-text); background: rgba(var(--rb-success-rgb), .1); }
.gate--held { color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), .08); }
.who { display: flex; align-items: center; gap: 10px; }
.who-avatar { width: 30px; height: 30px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 800; color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .1); }
.row-actions { text-align: right; white-space: nowrap; }
.row-actions .btn + .btn { margin-left: 6px; }
.num { text-align: right !important; white-space: nowrap; }
.nowrap { white-space: nowrap; }
.strong { font-weight: 700; }
.muted { color: var(--rb-text-muted); }
.mono { font-family: var(--rb-font-mono); }
.link { color: var(--rb-primary-text); font-weight: 700; text-decoration: none; margin-right: 6px; white-space: nowrap; }
.link:hover { text-decoration: underline; text-underline-offset: 3px; }

.pager { display: flex; justify-content: center; align-items: center; gap: 12px; padding: 12px; border-top: 1px solid var(--rb-border); font-size: 12.5px; color: var(--rb-text-secondary); }

.input {
  width: 100%; padding: 9px 11px; font-size: 13.5px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.banner { display: flex; align-items: center; gap: 9px; padding: 11px 14px; border-radius: 10px; font-size: 13px; margin: 0; }
.banner--error { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .25); }
.banner--inset { margin: 12px 16px 0; }

.empty-icon { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; color: var(--rb-text-secondary); background: var(--rb-surface-alt); border: 1px solid var(--rb-border); margin-bottom: 4px; }
.empty { text-align: center; padding: 56px 20px; color: var(--rb-text-secondary); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty h2 { font-size: 15px; color: var(--rb-text-primary); margin: 4px 0 0; }
/* An empty tab, laid out as Statements' empty state: the same icon, type and wrap. */
.inv-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 24px; text-align: center; }
.inv-empty__icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); box-shadow: 0 0 0 6px rgba(var(--rb-primary-rgb), 0.04); }
.inv-empty__title { margin: 6px 0 0; font-size: 17px; font-weight: 800; color: var(--rb-text-primary); }
.inv-empty__text { max-width: 520px; margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--rb-text-secondary); text-wrap: pretty; }
.inv-empty .ui-btn { margin-top: 6px; text-decoration: none; }
/* Good news: nothing waiting. */
.inv-empty--good .inv-empty__icon { background: rgba(var(--rb-success-rgb), 0.1); color: var(--rb-success-text); box-shadow: 0 0 0 6px rgba(var(--rb-success-rgb), 0.05); }

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

/* Narrow: the subtitle gives way and Refresh becomes an icon, but the actions stay right. */
@media (max-width: 900px) {
  .overview { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .btn-icon-only .btn-label { display: none; }
  .btn-icon-only { width: 38px; padding: 0; }
}

@media (max-width: 640px) {
  .overview-card { padding: 13px; }
  .overview-value { font-size: 20px; }
  .search { width: 100%; }
}
</style>
