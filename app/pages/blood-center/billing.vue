<template>
  <div class="bl-page">
    <div class="bl-inner">
      <!-- TOASTS -->
      <div class="toast-stack">
        <transition-group name="toast">
          <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.variant}`">
            <div class="toast-title">{{ t.title }}</div>
            <div v-if="t.message" class="toast-message">{{ t.message }}</div>
          </div>
        </transition-group>
      </div>

      <!-- HEADER -->
      <header class="page-header fade-in" style="--delay:0ms">
        <div>
          <h1 class="page-title">Billing &amp; Payment</h1>
          <p class="page-subtitle">
            Settle the statement raised against each request. Blood is not released until it
            is either paid or met by the government subsidy.
          </p>
        </div>
        <button class="btn btn-outline" :disabled="loading" @click="load">
          <AssetIcon name="refresh-cw" :size="16" :class="{ spinning: loading }" />
          Refresh
        </button>
      </header>

      <!-- ERROR -->
      <div v-if="error" class="banner banner--error">
        <AssetIcon name="triangle-alert" :size="16" />
        <span>{{ error }}</span>
        <button class="btn btn-outline btn-sm" @click="load">Retry</button>
      </div>

      <!-- STATS -->
      <div class="stats-grid fade-in" style="--delay:60ms">
        <div v-for="stat in stats" :key="stat.key" class="stat-card">
          <span class="stat-label">{{ stat.label }}</span>
          <span class="stat-value" :class="stat.tone && `stat-value--${stat.tone}`">{{ stat.value }}</span>
          <span class="stat-note">{{ stat.note }}</span>
        </div>
      </div>

      <!-- FILTERS -->
      <div class="toolbar fade-in" style="--delay:90ms">
        <div class="toolbar-search">
          <AssetIcon name="search" :size="16" class="search-icon" />
          <input v-model="search" type="text" placeholder="Search by reference number…" @input="onSearch">
        </div>
        <div class="pills">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            class="pill"
            :class="{ 'pill--on': activeTab === tab.value }"
            @click="activeTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- LIST -->
      <div class="card fade-in" style="--delay:120ms">
        <div v-if="loading" class="skeleton-wrap">
          <div v-for="n in 4" :key="n" class="skeleton skeleton--row" />
        </div>

        <div v-else-if="statements.length === 0" class="empty">
          <AssetIcon name="inbox" :size="36" />
          <h3>No statements</h3>
          <p>A statement is raised the moment stock is reserved for a request.</p>
        </div>

        <table v-else class="bl-table">
          <thead>
            <tr>
              <th scope="col">Reference</th>
              <th scope="col">Hospital</th>
              <th scope="col">Components</th>
              <th scope="col" class="num">Total</th>
              <th scope="col" class="num">Collected</th>
              <th scope="col">Status</th>
              <th scope="col" class="num">Release</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in statements" :key="s.id">
              <td class="mono">
                {{ s.request?.reference_number || '—' }}
                <span v-if="s.request?.is_emergency" class="tag tag--stat">STAT</span>
              </td>
              <td>{{ s.request?.requesting_facility || '—' }}</td>
              <td class="components">
                <span class="blood-pill">{{ s.request?.blood_type || '—' }}</span>
                {{ (s.request?.components || []).join(', ') || '—' }}
              </td>
              <td class="num">{{ peso(s.total_amount) }}</td>
              <td class="num">{{ s.collected > 0 ? peso(s.collected) : '—' }}</td>
              <td>
                <span class="status" :class="`status--${s.status}`">{{ s.status_label }}</span>
              </td>
              <td class="num">
                <span class="gate" :class="s.clears_release ? 'gate--ok' : 'gate--blocked'">
                  <AssetIcon :name="s.clears_release ? 'check' : 'x'" :size="12" />
                  {{ s.clears_release ? 'Cleared' : 'Blocked' }}
                </span>
              </td>
              <td class="actions">
                <button
                  v-if="!s.clears_release"
                  class="btn btn-primary btn-sm"
                  @click="openPayment(s)"
                >
                  Record Payment
                </button>
                <button
                  v-if="!s.clears_release"
                  class="btn btn-outline btn-sm"
                  @click="openSubsidy(s)"
                >
                  Apply Subsidy
                </button>
                <span v-if="s.clears_release" class="settled-note">
                  {{ s.is_subsidised ? 'Government funded' : 'Settled' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- RECORD PAYMENT -->
    <Teleport to="body">
      <div v-if="paymentFor" class="modal-overlay" @click.self="closePayment">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="pay-title">
          <h2 id="pay-title" class="modal-title">Record Payment</h2>
          <p class="modal-sub">
            {{ paymentFor.request?.reference_number }} · {{ paymentFor.request?.requesting_facility }}
          </p>

          <dl class="modal-facts">
            <div><dt>Statement total</dt><dd>{{ peso(paymentFor.total_amount) }}</dd></div>
            <div><dt>Already collected</dt><dd>{{ peso(paymentFor.collected) }}</dd></div>
            <div><dt>Outstanding</dt><dd class="owing">{{ peso(outstanding) }}</dd></div>
          </dl>

          <div class="field">
            <label for="pay-amount" class="field-label">Amount received <span class="req">*</span></label>
            <input
              id="pay-amount"
              v-model.number="payment.amount_paid"
              type="number"
              step="0.01"
              min="0.01"
              class="input"
              :class="{ 'input--error': payErrors.amount_paid }"
            >
            <p v-if="payErrors.amount_paid" class="field-error">{{ payErrors.amount_paid }}</p>
            <p v-else class="field-hint">
              A part payment is recorded, but does not release blood — the Capstone requires
              payment in full.
            </p>
          </div>

          <div class="field">
            <span class="field-label">Method <span class="req">*</span></span>
            <div class="method-row">
              <label
                v-for="method in methods"
                :key="method.value"
                class="pill"
                :class="{ 'pill--on': payment.payment_method === method.value }"
              >
                <input v-model="payment.payment_method" type="radio" name="method" :value="method.value" class="sr-only">
                {{ method.label }}
              </label>
            </div>
          </div>

          <div v-if="payment.payment_method === 'gcash'" class="field">
            <label for="pay-ref" class="field-label">GCash reference <span class="req">*</span></label>
            <input
              id="pay-ref"
              v-model.trim="payment.reference_number"
              type="text"
              class="input"
              :class="{ 'input--error': payErrors.reference_number }"
              maxlength="100"
            >
            <p v-if="payErrors.reference_number" class="field-error">{{ payErrors.reference_number }}</p>
            <p v-else class="field-hint">
              No payment gateway is connected, so this reference is the only evidence the
              money moved.
            </p>
          </div>

          <p v-if="payError" class="field-error field-error--block">{{ payError }}</p>

          <div class="modal-actions">
            <button class="btn btn-outline" :disabled="saving" @click="closePayment">Cancel</button>
            <button class="btn btn-primary" :disabled="saving" @click="submitPayment">
              {{ saving ? 'Recording…' : 'Record Payment' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- APPLY SUBSIDY -->
    <Teleport to="body">
      <div v-if="subsidyFor" class="modal-overlay" @click.self="closeSubsidy">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sub-title">
          <h2 id="sub-title" class="modal-title">Apply Government Subsidy</h2>
          <p class="modal-sub">
            {{ subsidyFor.request?.reference_number }} · {{ subsidyFor.request?.requesting_facility }}
          </p>

          <p class="modal-desc">
            This writes the statement down to zero and clears the request for release.
            No payment is recorded, because none is being taken.
          </p>

          <dl class="modal-facts">
            <div><dt>Amount to be waived</dt><dd class="owing">{{ peso(subsidyFor.total_amount) }}</dd></div>
          </dl>

          <p v-if="subsidyFor.collected > 0" class="banner banner--warn">
            <AssetIcon name="triangle-alert" :size="15" />
            <span>
              {{ peso(subsidyFor.collected) }} has already been collected against this statement.
              It stays recorded — any refund is settled outside this system.
            </span>
          </p>

          <div class="field">
            <label for="sub-reason" class="field-label">Reason <span class="optional">(optional)</span></label>
            <input
              id="sub-reason"
              v-model.trim="subsidyReason"
              type="text"
              class="input"
              maxlength="255"
              placeholder="e.g. DOH allocation"
            >
          </div>

          <p v-if="subsidyError" class="field-error field-error--block">{{ subsidyError }}</p>

          <div class="modal-actions">
            <button class="btn btn-outline" :disabled="saving" @click="closeSubsidy">Cancel</button>
            <button class="btn btn-primary" :disabled="saving" @click="submitSubsidy">
              {{ saving ? 'Applying…' : 'Apply Subsidy' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.view',
})

/*
 * This page was a 41-line placeholder wrapping a generic department dashboard.
 * The endpoints behind it — list, record payment, apply subsidy — are real, and
 * release is blocked until a statement is settled, so without this screen the
 * workflow dead-ended immediately after stock was reserved.
 */

const statements = ref([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const search = ref('')
const activeTab = ref('outstanding')

const tabs = [
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'subsidised', label: 'Subsidised' },
]

const methods = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
]

/* TOASTS */
const toasts = ref([])
let toastId = 0
function toast(title, variant = 'success', message = '') {
  const id = ++toastId
  toasts.value.push({ id, title, message, variant })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 3600)
}

function peso(value) {
  const amount = Number(value ?? 0)
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const stats = computed(() => {
  const owing = statements.value.filter((s) => !s.clears_release)
  const owed = owing.reduce((sum, s) => sum + Number(s.total_amount ?? 0) - Number(s.collected ?? 0), 0)
  const subsidised = statements.value.filter((s) => s.is_subsidised).length
  // Only statements where money actually moved. A subsidised statement cleared
  // its request without a peso changing hands and must not be counted here.
  const collected = statements.value
    .filter((s) => s.represents_collected_money)
    .reduce((sum, s) => sum + Number(s.collected ?? 0), 0)

  return [
    { key: 'blocked', label: 'Blocking Release', value: owing.length, note: 'Unsettled statements', tone: owing.length ? 'danger' : null },
    { key: 'owed', label: 'Outstanding', value: peso(owed), note: 'Still to be settled' },
    { key: 'collected', label: 'Collected', value: peso(collected), note: 'Money actually received' },
    { key: 'subsidy', label: 'Subsidised', value: subsidised, note: 'Met by government funding' },
  ]
})

const outstanding = computed(() => {
  if (!paymentFor.value) return 0
  return Math.max(0, Number(paymentFor.value.total_amount ?? 0) - Number(paymentFor.value.collected ?? 0))
})

let searchDebounce = null
function onSearch() {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(load, 400)
}

watch(activeTab, () => load())

async function load() {
  loading.value = true
  error.value = ''

  const params = {}
  if (activeTab.value === 'outstanding') params.outstanding = 1
  else if (activeTab.value !== 'all') params.status = activeTab.value
  if (search.value.trim()) params.search = search.value.trim()

  try {
    const response = await bloodCenterService.billings(params)
    statements.value = response?.data ?? []
  } catch (err) {
    error.value = err?.message || 'Could not load statements.'
    statements.value = []
  } finally {
    loading.value = false
  }
}

/* RECORD PAYMENT */
const paymentFor = ref(null)
const payError = ref('')
const payErrors = reactive({})
const payment = reactive({ amount_paid: null, payment_method: 'cash', reference_number: '' })

function openPayment(statement) {
  paymentFor.value = statement
  payError.value = ''
  Object.keys(payErrors).forEach((k) => delete payErrors[k])
  Object.assign(payment, {
    // Defaults to what is still owed, which is what a counter clerk almost
    // always takes.
    amount_paid: Math.max(0, Number(statement.total_amount ?? 0) - Number(statement.collected ?? 0)),
    payment_method: 'cash',
    reference_number: '',
  })
}

function closePayment() {
  if (saving.value) return
  paymentFor.value = null
}

async function submitPayment() {
  payError.value = ''
  Object.keys(payErrors).forEach((k) => delete payErrors[k])

  if (!payment.amount_paid || payment.amount_paid <= 0) {
    payErrors.amount_paid = 'Record the amount actually received.'
    return
  }

  if (payment.payment_method === 'gcash' && !payment.reference_number) {
    payErrors.reference_number = 'A GCash payment needs its reference number.'
    return
  }

  saving.value = true

  try {
    const response = await bloodCenterService.recordPayment(paymentFor.value.request.id, {
      amount_paid: payment.amount_paid,
      payment_method: payment.payment_method,
      ...(payment.reference_number ? { reference_number: payment.reference_number } : {}),
    })

    const settled = response?.billing?.clears_release
    toast(
      'Payment Recorded',
      'success',
      settled ? 'The statement is settled and the units can be released.' : 'Part payment recorded — the statement is still outstanding.',
    )
    paymentFor.value = null
    await load()
  } catch (err) {
    Object.entries(err?.errors ?? {}).forEach(([key, messages]) => {
      payErrors[key] = Array.isArray(messages) ? messages[0] : messages
    })
    payError.value = err?.message || 'Could not record that payment.'
  } finally {
    saving.value = false
  }
}

/* APPLY SUBSIDY */
const subsidyFor = ref(null)
const subsidyReason = ref('')
const subsidyError = ref('')

function openSubsidy(statement) {
  subsidyFor.value = statement
  subsidyReason.value = ''
  subsidyError.value = ''
}

function closeSubsidy() {
  if (saving.value) return
  subsidyFor.value = null
}

async function submitSubsidy() {
  subsidyError.value = ''
  saving.value = true

  try {
    await bloodCenterService.applySubsidy(subsidyFor.value.request.id, subsidyReason.value || undefined)
    toast('Subsidy Applied', 'success', 'The statement is met by government funding and the units can be released.')
    subsidyFor.value = null
    await load()
  } catch (err) {
    subsidyError.value = err?.message || 'Could not apply the subsidy.'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.bl-page { background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 24px 32px 40px; }
.bl-inner { max-width: 1152px; margin: 0 auto; }

.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
.page-title { font-size: 23px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13.5px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 70ch; }

.card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; overflow: hidden; }

.banner { display: flex; align-items: center; gap: 9px; padding: 11px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 14px; }
.banner--error { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .25); }
.banner--warn { background: rgba(var(--rb-warning-rgb), .1); color: var(--rb-warning-text); border: 1px solid rgba(var(--rb-warning-rgb), .3); align-items: flex-start; }

.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.stat-card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 3px; }
.stat-label { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; color: var(--rb-text-secondary); }
.stat-value { font-size: 21px; font-weight: 700; color: var(--rb-text-primary); }
.stat-value--danger { color: var(--rb-accent-text); }
.stat-note { font-size: 11.5px; color: var(--rb-text-muted); }

.toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
.toolbar-search { position: relative; flex: 1; min-width: 220px; }
.search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--rb-text-muted); }
.toolbar-search input {
  width: 100%; padding: 9px 11px 9px 34px; font-size: 13.5px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.toolbar-search input:focus { outline: none; border-color: var(--rb-primary); }
.pills { display: flex; gap: 6px; flex-wrap: wrap; }
.pill {
  padding: 8px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer;
  color: var(--rb-text-secondary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 999px;
}
.pill--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), .07); color: var(--rb-primary-text); }

.bl-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.bl-table th {
  text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase;
  color: var(--rb-text-secondary); padding: 12px 14px; border-bottom: 1px solid var(--rb-border-strong);
  background: var(--rb-surface-alt);
}
.bl-table td { padding: 12px 14px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); vertical-align: middle; }
.bl-table tr:last-child td { border-bottom: none; }
.bl-table .num { text-align: right; white-space: nowrap; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
.components { color: var(--rb-text-secondary); }
.blood-pill {
  display: inline-block; padding: 1px 7px; margin-right: 6px; border-radius: 6px;
  font-weight: 700; font-size: 11.5px;
  background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text);
}
.tag { margin-left: 6px; padding: 1px 6px; border-radius: 5px; font-size: 10px; font-weight: 700; }
.tag--stat { background: var(--rb-accent); color: #fff; }

.status { padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
.status--unpaid { background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text); }
.status--partial { background: rgba(var(--rb-warning-rgb), .12); color: var(--rb-warning-text); }
.status--paid { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }
.status--subsidised { background: rgba(var(--rb-purple-rgb), .12); color: var(--rb-purple-text); }
.status--void { background: var(--rb-surface-hover); color: var(--rb-text-muted); }

.gate { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600; }
.gate--ok { color: var(--rb-success-text); }
.gate--blocked { color: var(--rb-accent-text); }

.actions { display: flex; gap: 6px; justify-content: flex-end; }
.settled-note { font-size: 11.5px; color: var(--rb-text-muted); }

.empty { text-align: center; padding: 48px 20px; color: var(--rb-text-secondary); }
.empty h3 { font-size: 15px; color: var(--rb-text-primary); margin: 10px 0 4px; }
.empty p { font-size: 13px; margin: 0; }

.skeleton-wrap { padding: 16px; }
.skeleton {
  border-radius: 7px; margin-bottom: 10px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
.skeleton--row { height: 38px; }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

/* Buttons */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 15px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 8px; cursor: pointer; white-space: nowrap;
}
.btn-primary { background: var(--rb-primary); color: #fff; border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: #10509c; }
.btn-outline { background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-sm { padding: 6px 11px; font-size: 12px; }

/* Modals */
.modal-overlay {
  position: fixed; inset: 0; z-index: 90; background: var(--rb-overlay);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal {
  width: 100%; max-width: 460px; background: var(--rb-surface);
  border-radius: 15px; padding: 22px; font-family: var(--rb-font-sans);
  max-height: 90vh; overflow-y: auto;
}
.modal-title { font-size: 17px; font-weight: 700; color: var(--rb-text-primary); margin: 0 0 3px; }
.modal-sub { font-size: 12.5px; color: var(--rb-text-secondary); margin: 0 0 14px; }
.modal-desc { font-size: 13px; color: var(--rb-text-secondary); margin: 0 0 14px; }
.modal-facts { margin: 0 0 16px; border: 1px solid var(--rb-border); border-radius: 10px; padding: 12px 14px; }
.modal-facts > div { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
.modal-facts dt { color: var(--rb-text-secondary); margin: 0; }
.modal-facts dd { margin: 0; font-weight: 600; color: var(--rb-text-primary); }
.modal-facts .owing { color: var(--rb-accent-text); }
.modal-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 18px; }

.field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.field-label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.req { color: var(--rb-accent-text); }
.optional { color: var(--rb-text-muted); font-weight: 400; }
.input {
  width: 100%; padding: 9px 11px; font-size: 13.5px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), .12); }
.input--error { border-color: var(--rb-accent); }
.field-error { font-size: 11.5px; color: var(--rb-accent-text); margin: 0; }
.field-error--block { margin: 4px 0 0; }
.field-hint { font-size: 11.5px; color: var(--rb-text-secondary); margin: 0; }
.method-row { display: flex; gap: 8px; }
.method-row .pill { flex: 1; text-align: center; border-radius: 9px; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

/* Toasts */
.toast-stack { position: fixed; top: 18px; right: 18px; z-index: 120; display: flex; flex-direction: column; gap: 8px; }
.toast { background: var(--rb-surface); border: 1px solid var(--rb-border-strong); border-left-width: 3px; border-radius: 10px; padding: 11px 15px; min-width: 250px; }
.toast--success { border-left-color: var(--rb-success); }
.toast--danger { border-left-color: var(--rb-accent); }
.toast--info { border-left-color: var(--rb-primary); }
.toast-title { font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.toast-message { font-size: 12px; color: var(--rb-text-secondary); margin-top: 2px; }
.toast-enter-active, .toast-leave-active { transition: opacity .25s, transform .25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(14px); }

.spinning { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }

.fade-in { animation: fade-in .3s ease both; animation-delay: var(--delay, 0ms); }
@keyframes fade-in { from { opacity: 0; transform: translateY(5px) } to { opacity: 1; transform: none } }

@media (prefers-reduced-motion: reduce) {
  .fade-in, .skeleton, .spinning { animation: none; }
}

@media (max-width: 900px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .bl-table { font-size: 12px; }
  .bl-table th, .bl-table td { padding: 9px 8px; }
  .actions { flex-direction: column; }
}
</style>
