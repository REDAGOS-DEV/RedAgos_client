<template>
  <div class="bl-page">
    <div class="bl-inner">
      <!-- Two columns, so the actions stay on the right at every width. -->
      <!-- The shared header keeps the actions on the right at every width. -->
      <PageHeader title="Statements" subtitle="A bill is raised when stock is reserved. Patient bills are paid at the counter; weekly orders are billed to the hospital.">
        <template #actions>
          <NuxtLink v-if="canSeePayments" to="/blood-center/pos" class="ui-btn ui-btn--primary">
            <AssetIcon name="credit-card" :size="15" />
            Billing counter
          </NuxtLink>
          <NuxtLink v-if="canSeePayments" to="/blood-center/receipts" class="ui-btn">
            <AssetIcon name="receipt" :size="15" />
            Receipts
          </NuxtLink>
          <button class="ui-btn btn-icon-only" :disabled="loading" aria-label="Refresh" title="Refresh" @click="refreshAll">
            <AssetIcon name="refresh-cw" :size="15" :class="{ spinning: loading }" />
            <span class="btn-label">Refresh</span>
          </button>
        </template>
      </PageHeader>

      <!-- Documents are headed by the centre's own logo; without one, its initials. -->
      <p v-if="summary && !summary.issuer?.logo_url" class="banner banner--info">
        <AssetIcon name="info" :size="15" />
        <span>
          Statements and receipts print with your centre's initials because no logo is uploaded.
          <template v-if="can('center.configure')">
            Upload one in <NuxtLink to="/blood-center/settings" class="inline-link">Settings</NuxtLink>.
          </template>
          <template v-else>A supervisor can upload one in Settings.</template>
        </span>
      </p>

      <!-- Counted on the server, never from the page of rows this screen holds. -->
      <dl v-if="summary" class="figures">
        <div class="figure" :class="{ 'figure--alert': summary.outstanding.count }">
          <span class="figure-icon figure-icon--red" aria-hidden="true"><AssetIcon name="lock" :size="16" /></span>
          <div class="figure-body">
            <dt>Holding blood back</dt>
            <dd>{{ summary.outstanding.count }}</dd>
            <span>{{ pesos(summary.outstanding.amount) }} owed by patients</span>
          </div>
        </div>
        <div class="figure">
          <span class="figure-icon figure-icon--green" aria-hidden="true"><AssetIcon name="dollar-sign" :size="16" /></span>
          <div class="figure-body">
            <dt>Collected today</dt>
            <dd>{{ pesos(summary.collected_today) }}</dd>
            <span>Cash and GCash, less voids</span>
          </div>
        </div>
        <div class="figure">
          <span class="figure-icon figure-icon--blue" aria-hidden="true"><AssetIcon name="trending-up" :size="16" /></span>
          <div class="figure-body">
            <dt>Collected this month</dt>
            <dd>{{ pesos(summary.collected_this_month) }}</dd>
            <span>{{ summary.subsidised_this_month.count }} subsidised · {{ pesos(summary.subsidised_this_month.amount) }} waived</span>
          </div>
        </div>
        <div class="figure">
          <span class="figure-icon figure-icon--amber" aria-hidden="true"><AssetIcon name="building-2" :size="16" /></span>
          <div class="figure-body">
            <dt>Awaiting hospital settlement</dt>
            <dd>{{ summary.weekly_awaiting_settlement.count }}</dd>
            <span>{{ pesos(summary.weekly_awaiting_settlement.amount) }} in weekly statements</span>
          </div>
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
              <span class="category-top">
                {{ c.label }}
                <span v-if="waitingIn(c.value)" class="category-count">{{ waitingIn(c.value) }}</span>
              </span>
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
          <button class="ui-btn ui-btn--sm" @click="load()">Retry</button>
        </div>

        <div v-if="loading" class="skeleton-wrap"><div v-for="n in 5" :key="n" class="skeleton" /></div>

        <div v-else-if="!statements.length && !error" class="empty">
          <span class="empty-icon" aria-hidden="true"><AssetIcon name="inbox" :size="26" /></span>
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
                  <NuxtLink :to="`/blood-center/statement/${requestIdOf(s)}`" class="ui-btn ui-btn--sm">Open</NuxtLink>
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
 * Every statement raised against this centre's requests, in the two categories
 * that are owed by different people and never added together: patient bills,
 * paid at the counter, and the hospitals' weekly statements, settled outside
 * RedAgos. A row opens its statement, where everything about it is done.
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

function initialsOf(name) {
  return (name || 'P').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

// The figure strip's counts, beside each category tab: what is still waiting in it.
function waitingIn(value) {
  if (!summary.value) return 0
  return value === 'weekly' ? summary.value.weekly_awaiting_settlement?.count ?? 0 : summary.value.outstanding?.count ?? 0
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

/* Text | actions. The actions column never wraps under the text, so the
   buttons stay on the right at every width; only the text column shrinks. */
.page-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 16px; }
.page-heading { min-width: 0; }
.page-title { font-size: 24px; font-weight: 800; letter-spacing: -0.01em; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 72ch; }
.header-actions { display: flex; gap: 8px; justify-content: flex-end; align-self: start; }

/* One strip of figures, divided rather than boxed, each with its own tone. */
.figures {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0;
  background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px;
}
.figure { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px; border-left: 1px solid var(--rb-border); min-width: 0; }
.figure:first-child { border-left: 0; }
.figure-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.figure-icon { width: 34px; height: 34px; flex: none; border-radius: 10px; display: grid; place-items: center; }
.figure-icon--red { color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), .09); }
.figure-icon--green { color: var(--rb-success-text); background: rgba(var(--rb-success-rgb), .1); }
.figure-icon--blue { color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .1); }
.figure-icon--amber { color: var(--rb-warning-text); background: rgba(var(--rb-warning-rgb), .14); }
.figure dt { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.figure dd { margin: 0; font-size: 22px; font-weight: 800; line-height: 1.2; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.figure--alert dd { color: var(--rb-accent-text); }
.figure-body > span { font-size: 12px; color: var(--rb-text-secondary); }

.card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; overflow: hidden; }

/* Category tabs on top, with search and status beneath them. */
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
.category small { font-size: 11.5px; font-weight: 500; color: var(--rb-text-muted); }
.category:hover { color: var(--rb-text-primary); }
.category:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); border-radius: 8px; }
.category--on { color: var(--rb-primary-text); }
.category--on::after { background: var(--rb-primary); }
.category--on .category-count { color: #fff; background: var(--rb-primary); border-color: var(--rb-primary); }

.filters { display: flex; justify-content: space-between; gap: 10px; align-items: center; flex-wrap: wrap; padding: 12px 16px; background: var(--rb-surface-alt); }
.search { position: relative; width: 320px; max-width: 100%; }
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
.banner--info { background: rgba(var(--rb-primary-rgb), .06); color: var(--rb-primary-text); border: 1px solid rgba(var(--rb-primary-rgb), .2); }
.banner--error { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .25); }
.banner--inset { margin: 12px 16px 0; }
.inline-link { color: inherit; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }

.empty-icon { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .08); margin-bottom: 4px; }
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

@media (max-width: 1100px) {
  .figures { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .figure:nth-child(3) { border-left: 0; }
  .figure:nth-child(n + 3) { border-top: 1px solid var(--rb-border); }
}

/* Narrow: the subtitle gives way and Refresh becomes an icon, but the actions stay right. */
@media (max-width: 900px) {
  .btn-icon-only .btn-label { display: none; }
  .btn-icon-only { width: 38px; padding: 0; }
}

@media (max-width: 640px) {
  .figures { grid-template-columns: 1fr; }
  .figure { border-left: 0; border-top: 1px solid var(--rb-border); }
  .figure:first-child { border-top: 0; }
  .search { width: 100%; }
}
</style>
