<template>
  <div class="pos-page">
    <div class="pos-inner">
      <!-- TOASTS -->
      <div class="toast-stack" aria-live="polite">
        <transition-group name="toast">
          <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.variant}`">
            <div class="toast-title">{{ t.title }}</div>
            <div v-if="t.message" class="toast-message">{{ t.message }}</div>
          </div>
        </transition-group>
      </div>

      <header class="page-header">
        <div>
          <h1 class="page-title">Billing Counter</h1>
          <p class="page-subtitle">
            Take a patient's payment in person: find the bill, take cash or GCash, hand over the receipt.
            <template v-if="shiftsEnabled">Cash goes into your shift's drawer, counted when you close it.</template>
          </p>
        </div>
        <div class="header-actions">
          <NuxtLink v-if="shiftsEnabled" to="/blood-center/cash-shifts" class="btn btn-outline">Shift history</NuxtLink>
          <NuxtLink to="/blood-center/billing" class="btn btn-outline">Bills &amp; statements</NuxtLink>
        </div>
      </header>

      <!-- SHIFT BAR: only when the counter works in cash shifts -->
      <section v-if="shiftsEnabled" class="shift-bar" :class="{ 'shift-bar--open': shift }" aria-label="Cash shift">
        <div v-if="shiftLoading" class="skeleton skeleton--bar" />

        <template v-else-if="shift">
          <div class="shift-main">
            <span class="shift-dot" aria-hidden="true" />
            <div>
              <strong>Shift {{ shift.session_number }} open</strong>
              <span class="shift-meta">
                {{ shift.counter_label ? `${shift.counter_label} · ` : '' }}since {{ formatTime(shift.opened_at) }}
                · {{ shift.counts?.payments ?? 0 }} payment{{ (shift.counts?.payments ?? 0) === 1 ? '' : 's' }}
              </span>
            </div>
          </div>
          <dl class="shift-figures">
            <div><dt>Float</dt><dd>{{ pesos(shift.figures?.opening_float) }}</dd></div>
            <div><dt>Cash taken</dt><dd>{{ pesos(shift.figures?.cash_collected) }}</dd></div>
            <div><dt>GCash</dt><dd>{{ pesos(Number(shift.figures?.gcash_counter ?? 0) + Number(shift.figures?.gcash_checkout ?? 0)) }}</dd></div>
            <div class="shift-expected"><dt>Expected in drawer</dt><dd>{{ pesos(shift.figures?.expected_cash) }}</dd></div>
          </dl>
          <div class="shift-actions">
            <button class="btn btn-outline btn-sm" :disabled="downloadingShift" @click="downloadShift">X reading</button>
            <button class="btn btn-outline btn-sm" @click="closingShift = true">Close shift</button>
          </div>
        </template>

        <form v-else class="shift-open" @submit.prevent="openShift">
          <div class="shift-main">
            <span class="shift-dot shift-dot--off" aria-hidden="true" />
            <div>
              <strong>No shift open</strong>
              <span class="shift-meta">Open one with the cash in the drawer before taking payments.</span>
            </div>
          </div>
          <label class="shift-field">
            <span>Opening float</span>
            <input v-model.number="openForm.opening_float" type="number" min="0" step="0.01" class="input" required>
          </label>
          <label class="shift-field">
            <span>Counter <em>(optional)</em></span>
            <input v-model.trim="openForm.counter_label" type="text" maxlength="40" class="input" placeholder="e.g. Counter 1">
          </label>
          <button type="submit" class="btn btn-primary" :disabled="openingShift">
            {{ openingShift ? 'Opening…' : 'Open shift' }}
          </button>
        </form>
        <p v-if="shiftError" class="field-error shift-error">{{ shiftError }}</p>
      </section>

      <div class="pos-grid">
        <!-- FIND A BILL -->
        <section class="panel find-panel" aria-labelledby="find-title">
          <h2 id="find-title" class="panel-title">Find the bill</h2>
          <form class="search" @submit.prevent="searchNow">
            <AssetIcon name="search" :size="16" class="search-icon" />
            <input
              ref="searchInput"
              v-model="query"
              type="search"
              class="input search-input"
              placeholder="Request or PTR reference, or patient name"
              aria-label="Find a patient bill"
              autocomplete="off"
              @input="onQuery"
            >
          </form>

          <p v-if="searchError" class="field-error">{{ searchError }}</p>

          <template v-if="query.trim().length >= 2">
            <p class="list-heading">Results</p>
            <div v-if="searching" class="skeleton skeleton--row" />
            <p v-else-if="!results.length" class="list-empty">No patient bill matches “{{ query.trim() }}”.</p>
            <ul v-else class="bill-list">
              <li v-for="b in results" :key="b.request_id">
                <button type="button" class="bill-item" :class="{ 'bill-item--on': bill?.request_id === b.request_id }" @click="selectBill(b.request_id)">
                  <span class="bill-item__ref mono">{{ b.reference_number }}</span>
                  <span class="bill-item__who">{{ b.patient_name || 'Patient' }} · {{ b.requesting_facility || '—' }}</span>
                  <span class="bill-item__owed" :class="{ 'bill-item__owed--clear': !b.takes_payment }">
                    {{ b.takes_payment ? `${pesos(b.outstanding)} due` : b.billing_status_label }}
                  </span>
                </button>
              </li>
            </ul>
          </template>

          <p class="list-heading">Awaiting payment</p>
          <div v-if="queueLoading" class="skeleton skeleton--row" />
          <p v-else-if="!queue.length" class="list-empty">No patient bill is holding blood back.</p>
          <ul v-else class="bill-list">
            <li v-for="b in queue" :key="b.request_id">
              <button type="button" class="bill-item" :class="{ 'bill-item--on': bill?.request_id === b.request_id }" @click="selectBill(b.request_id)">
                <span class="bill-item__ref mono">
                  {{ b.reference_number }}
                  <span v-if="b.is_emergency" class="tag tag--stat">STAT</span>
                </span>
                <span class="bill-item__who">{{ b.patient_name || 'Patient' }} · {{ b.requesting_facility || '—' }}</span>
                <span class="bill-item__owed">{{ pesos(b.outstanding) }} due</span>
              </button>
            </li>
          </ul>
        </section>

        <!-- THE BILL AND THE PAYMENT -->
        <section class="panel bill-panel" aria-labelledby="bill-title">
          <div v-if="billLoading" class="skeleton skeleton--doc" />

          <div v-else-if="!bill" class="empty">
            <AssetIcon name="receipt" :size="34" />
            <h3>No bill selected</h3>
            <p>Find the patient's bill, or pick one from those awaiting payment.</p>
          </div>

          <!-- DONE: the receipt to hand over -->
          <div v-else-if="done" class="done">
            <div class="done-mark"><AssetIcon name="check" :size="26" /></div>
            <h2 id="bill-title" class="done-title">Payment recorded</h2>
            <p class="done-sub">
              Receipt <strong class="mono">{{ done.receipt?.receipt_number }}</strong> for {{ pesos(done.receipt?.amount_paid) }}
              <template v-if="done.receipt?.is_partial"> — {{ pesos(done.receipt?.balance_after) }} is still due</template>.
            </p>
            <div v-if="done.change !== null" class="change-callout">
              <span>Change to give back</span>
              <strong>{{ pesos(done.change) }}</strong>
            </div>
            <div class="done-actions">
              <button class="btn btn-primary" @click="printReceipt(done.receipt)">
                <AssetIcon name="printer" :size="15" />
                Print receipt (80mm)
              </button>
              <button class="btn btn-outline" :disabled="downloadingReceipt" @click="downloadReceipt(done.receipt)">
                <AssetIcon name="download" :size="15" />
                A4 PDF
              </button>
              <button class="btn btn-outline" @click="nextCustomer">Next customer</button>
            </div>
          </div>

          <template v-else>
            <header class="bill-head">
              <div>
                <h2 id="bill-title" class="bill-title mono">{{ bill.reference_number }}</h2>
                <p class="bill-sub">
                  {{ bill.patient_name || 'Patient' }} · {{ bill.requesting_facility || '—' }}
                  <template v-if="bill.transfusion_reference"> · {{ bill.transfusion_reference }}</template>
                </p>
              </div>
              <span class="status" :class="`status--${bill.billing_status}`">{{ bill.billing_status_label }}</span>
            </header>

            <table class="lines">
              <thead>
                <tr><th scope="col">Component</th><th scope="col" class="num">Qty</th><th scope="col" class="num">Price</th><th scope="col" class="num">Total</th></tr>
              </thead>
              <tbody>
                <tr v-for="(line, i) in bill.lines" :key="i">
                  <td>{{ line.component_name }}</td>
                  <td class="num">{{ line.quantity }}</td>
                  <td class="num">{{ pesos(line.unit_price) }}</td>
                  <td class="num">{{ pesos(line.line_total) }}</td>
                </tr>
                <tr v-if="!bill.lines?.length"><td colspan="4" class="muted">No units are held for this request yet.</td></tr>
              </tbody>
            </table>

            <dl class="totals">
              <div><dt>Bill total</dt><dd>{{ pesos(bill.total_amount) }}</dd></div>
              <div><dt>Already paid</dt><dd>{{ pesos(bill.collected) }}</dd></div>
              <div class="totals-due"><dt>Amount due</dt><dd>{{ pesos(bill.outstanding) }}</dd></div>
            </dl>

            <p v-if="!bill.takes_payment" class="banner banner--ok">
              <AssetIcon name="check" :size="15" />
              <span>Nothing is due on this bill. {{ bill.clears_release ? 'Its blood can be released.' : '' }}</span>
            </p>

            <p v-else-if="shiftsEnabled && !shift" class="banner banner--warn">
              <AssetIcon name="triangle-alert" :size="15" />
              <span>Open a shift above before taking this payment.</span>
            </p>

            <template v-else>
              <div class="method-tabs" role="tablist" aria-label="Payment method">
                <button
                  v-for="m in METHODS"
                  :key="m.value"
                  role="tab"
                  class="method-tab"
                  :class="{ 'method-tab--on': method === m.value }"
                  :aria-selected="method === m.value"
                  @click="method = m.value"
                >
                  <AssetIcon :name="m.icon" :size="16" />
                  {{ m.label }}
                </button>
              </div>

              <!-- CASH -->
              <form v-if="method === 'cash'" class="pay-form" @submit.prevent="takePayment">
                <div class="pay-row">
                  <label class="field">
                    <span class="field-label">Paying now</span>
                    <input v-model.number="paying" type="number" min="0.01" step="0.01" :max="Number(bill.outstanding)" class="input input--money">
                    <span class="field-hint">Up to {{ pesos(bill.outstanding) }}. A part payment does not release blood.</span>
                  </label>
                  <label class="field">
                    <span class="field-label">Cash handed over</span>
                    <input ref="tenderedInput" v-model.number="tendered" type="number" min="0.01" step="0.01" class="input input--money" required>
                  </label>
                </div>
                <div class="quick-row" aria-label="Quick amounts">
                  <button
                    v-for="amount in quickAmounts"
                    :key="amount"
                    type="button"
                    class="quick"
                    :class="{ 'quick--on': Number(tendered) === amount }"
                    @click="tendered = amount"
                  >
                    {{ amount === Number(paying) ? 'Exact' : pesos(amount) }}
                  </button>
                </div>
                <div class="change-callout" :class="{ 'change-callout--short': change === null && tendered }">
                  <span>{{ change === null ? 'Not enough handed over' : 'Change to give back' }}</span>
                  <strong>{{ change === null ? (tendered ? `${pesos(Number(paying) - Number(tendered))} short` : '—') : pesos(change) }}</strong>
                </div>
                <label class="field">
                  <span class="field-label">Received from <span class="optional">(optional, printed on the receipt)</span></span>
                  <input v-model.trim="payerName" type="text" maxlength="120" class="input" placeholder="e.g. the patient's watcher" autocomplete="off">
                </label>
                <p v-if="payError" class="field-error">{{ payError }}</p>
                <button type="submit" class="btn btn-primary btn-lg" :disabled="recording || !canTakeCash">
                  {{ recording ? 'Recording…' : `Take ${pesos(paying)} cash` }}
                </button>
              </form>

              <!-- GCASH SHOWN ON THE PAYER'S PHONE -->
              <form v-else-if="method === 'gcash'" class="pay-form" @submit.prevent="takePayment">
                <p class="field-hint">
                  For a transfer the payer shows you on their phone; its reference is the evidence. To have the
                  payment provider confirm it instead, use GCash QR.
                </p>
                <div class="pay-row">
                  <label class="field">
                    <span class="field-label">Amount</span>
                    <input v-model.number="paying" type="number" min="0.01" step="0.01" :max="Number(bill.outstanding)" class="input input--money">
                  </label>
                  <label class="field">
                    <span class="field-label">GCash reference</span>
                    <input v-model.trim="reference" type="text" maxlength="100" class="input mono" required>
                  </label>
                </div>
                <label class="field">
                  <span class="field-label">Received from <span class="optional">(optional)</span></span>
                  <input v-model.trim="payerName" type="text" maxlength="120" class="input" autocomplete="off">
                </label>
                <p v-if="payError" class="field-error">{{ payError }}</p>
                <button type="submit" class="btn btn-primary btn-lg" :disabled="recording || !reference || !(Number(paying) > 0)">
                  {{ recording ? 'Recording…' : `Record ${pesos(paying)} GCash` }}
                </button>
              </form>

              <!-- GCASH CHECKOUT, CONFIRMED BY THE PROVIDER -->
              <div v-else class="pay-form">
                <p class="field-hint">
                  Opens a GCash checkout for {{ pesos(bill.outstanding) }}. The payer scans the QR code on their phone,
                  and this counter is told when the provider confirms it.
                </p>
                <button class="btn btn-primary btn-lg" @click="checkoutOpen = true">Show GCash QR</button>
              </div>
            </template>
          </template>
        </section>
      </div>
    </div>

    <GcashCheckoutDialog
      v-if="checkoutOpen && bill"
      :request-id="bill.request_id"
      :heading="`${bill.reference_number} · ${bill.patient_name || 'Patient'}`"
      :total="bill.total_amount"
      :collected="bill.collected"
      @close="checkoutOpen = false"
      @changed="afterCheckout"
      @notify="(n) => toast(n.title, n.variant, n.message)"
    />

    <CashCountDialog
      v-if="closingShift && shift"
      :shift="shift"
      :busy="closingBusy"
      :error="closeError"
      @close="closingShift = false"
      @confirm="closeShift"
    />
  </div>
</template>

<script setup>
/**
 * The billing counter: a cashier's shift, and taking a patient's payment in person.
 *
 * Find the bill — typed, or by a handheld scanner, which types too — take cash
 * (with the amount handed over and the change worked out) or GCash, and hand
 * over the receipt, printed on the counter's 80mm printer. Everything that
 * matters is decided by the server: what is due, whether the payment went in,
 * and whether the counter works in cash shifts at all. Off — one billing staff
 * member, the default — a payment is taken straight away. On, it needs the
 * cashier's open shift, and the shift is closed with the drawer counted.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import CashCountDialog from '~/components/BloodCenter/CashCountDialog.vue'
import GcashCheckoutDialog from '~/components/BloodCenter/GcashCheckoutDialog.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { changeDue, pesos, quickTenderAmounts, saveBlob } from '~/utils/billing'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.record_payment',
})

const route = useRoute()

const METHODS = [
  { value: 'cash', label: 'Cash', icon: 'dollar-sign' },
  { value: 'gcash', label: 'GCash reference', icon: 'smartphone' },
  { value: 'checkout', label: 'GCash QR', icon: 'qr-code' },
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

function formatTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—'
}

/* SHIFT */
// Off until the server says otherwise, so no shift bar flashes up on a counter without them.
const shiftsEnabled = ref(false)
const shift = ref(null)
const shiftLoading = ref(true)
const shiftError = ref('')
const openingShift = ref(false)
const openForm = reactive({ opening_float: 0, counter_label: '' })
const closingShift = ref(false)
const closingBusy = ref(false)
const closeError = ref('')
const downloadingShift = ref(false)

async function loadShift() {
  try {
    const response = await bloodCenterService.currentShift()
    shiftsEnabled.value = Boolean(response?.shifts_enabled)
    shift.value = response?.session ?? null
  } catch (err) {
    shiftError.value = err?.message || 'Could not read your shift.'
  } finally {
    shiftLoading.value = false
  }
}

async function openShift() {
  openingShift.value = true
  shiftError.value = ''

  try {
    const response = await bloodCenterService.openShift({
      opening_float: Number(openForm.opening_float) || 0,
      counter_label: openForm.counter_label || null,
    })
    shift.value = response.session
    toast('Shift Opened', 'success', response.message)
  } catch (err) {
    shiftError.value = err?.message || 'The shift could not be opened.'
  } finally {
    openingShift.value = false
  }
}

async function closeShift(payload) {
  closingBusy.value = true
  closeError.value = ''

  try {
    const response = await bloodCenterService.closeShift(shift.value.id, payload)
    toast('Shift Closed', 'success', response.message)
    closingShift.value = false
    const closedId = response.session?.id
    shift.value = null
    await navigateTo(`/blood-center/cash-shifts?shift=${closedId}`)
  } catch (err) {
    const first = Object.values(err?.errors ?? {})[0]
    closeError.value = (Array.isArray(first) ? first[0] : first) || err?.message || 'The shift could not be closed.'
  } finally {
    closingBusy.value = false
  }
}

async function downloadShift() {
  downloadingShift.value = true

  try {
    saveBlob(await bloodCenterService.downloadShiftReport(shift.value.id), `${shift.value.session_number}-X.pdf`)
  } catch (err) {
    toast('Download Failed', 'danger', err?.message || 'The reading could not be downloaded.')
  } finally {
    downloadingShift.value = false
  }
}

/* FIND A BILL */
const searchInput = ref(null)
const query = ref('')
const results = ref([])
const searching = ref(false)
const searchError = ref('')
const queue = ref([])
const queueLoading = ref(true)
let searchTimer = null

function onQuery() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(searchNow, 300)
}

async function searchNow() {
  const q = query.value.trim()
  searchError.value = ''

  if (q.length < 2) {
    results.value = []
    return
  }

  searching.value = true

  try {
    results.value = (await bloodCenterService.counterLookup(q))?.data ?? []

    // A scanned or typed reference that matches one bill opens it.
    if (results.value.length === 1 && results.value[0].reference_number.toLowerCase() === q.toLowerCase()) {
      await selectBill(results.value[0].request_id)
    }
  } catch (err) {
    searchError.value = err?.message || 'The search failed.'
  } finally {
    searching.value = false
  }
}

async function loadQueue() {
  try {
    queue.value = (await bloodCenterService.counterQueue())?.data ?? []
  } catch {
    queue.value = []
  } finally {
    queueLoading.value = false
  }
}

/* THE BILL */
const bill = ref(null)
const billLoading = ref(false)
const method = ref('cash')
const paying = ref(0)
const tendered = ref(null)
const reference = ref('')
const payerName = ref('')
const payError = ref('')
const recording = ref(false)
const done = ref(null)
const checkoutOpen = ref(false)
const tenderedInput = ref(null)

const change = computed(() => (tendered.value ? changeDue(tendered.value, paying.value) : null))
const quickAmounts = computed(() => quickTenderAmounts(paying.value))
const canTakeCash = computed(() => Number(paying.value) > 0 && change.value !== null)

async function selectBill(requestId) {
  billLoading.value = true
  done.value = null
  payError.value = ''

  try {
    bill.value = (await bloodCenterService.counterBill(requestId))?.bill ?? null
    resetPayment()
    await nextTick()
    tenderedInput.value?.focus()
  } catch (err) {
    toast('Bill Not Found', 'danger', err?.message || 'That bill could not be opened.')
    bill.value = null
  } finally {
    billLoading.value = false
  }
}

function resetPayment() {
  method.value = 'cash'
  paying.value = Number(bill.value?.outstanding ?? 0)
  tendered.value = null
  reference.value = ''
  payerName.value = ''
  payError.value = ''
}

async function takePayment() {
  payError.value = ''
  recording.value = true

  const cash = method.value === 'cash'

  try {
    const response = await bloodCenterService.recordPayment(bill.value.request_id, {
      amount_paid: Number(paying.value),
      payment_method: cash ? 'cash' : 'gcash',
      ...(cash ? { amount_tendered: Number(tendered.value) } : { reference_number: reference.value }),
      ...(payerName.value ? { payer_name: payerName.value } : {}),
    })

    done.value = {
      receipt: response?.receipt ?? null,
      change: cash ? Number(response?.change_given ?? 0) : null,
    }

    // The bill, the queue and the drawer have all moved.
    await Promise.all([loadShift(), loadQueue()])
  } catch (err) {
    const first = Object.values(err?.errors ?? {})[0]
    payError.value = (Array.isArray(first) ? first[0] : first) || err?.message || 'The payment could not be recorded.'

    // Opening a shift elsewhere, or closing it, changes what this counter may do.
    if (err?.data?.code === 'no_open_cash_session') await loadShift()
  } finally {
    recording.value = false
  }
}

async function afterCheckout() {
  await Promise.all([loadShift(), loadQueue()])

  if (bill.value) await selectBill(bill.value.request_id)
}

function nextCustomer() {
  done.value = null
  bill.value = null
  query.value = ''
  results.value = []
  nextTick(() => searchInput.value?.focus())
}

/* RECEIPTS */
const downloadingReceipt = ref(false)

// The 80mm receipt prints from its own page, sized for the counter's printer.
function printReceipt(receipt) {
  if (receipt?.id) window.open(`/blood-center/receipt-print/${receipt.id}?auto=1`, '_blank')
}

async function downloadReceipt(receipt) {
  if (!receipt?.id) return
  downloadingReceipt.value = true

  try {
    saveBlob(await bloodCenterService.downloadReceipt(receipt.id), `${receipt.receipt_number}.pdf`)
  } catch (err) {
    toast('Download Failed', 'danger', err?.message || 'The receipt could not be downloaded.')
  } finally {
    downloadingReceipt.value = false
  }
}

watch(method, () => {
  payError.value = ''
  if (method.value === 'checkout') paying.value = Number(bill.value?.outstanding ?? 0)
})

onMounted(async () => {
  await Promise.all([loadShift(), loadQueue()])

  // From the statements page: "Take payment" opens the bill here.
  const preset = Number(route.query.request)
  if (preset) await selectBill(preset)
  else searchInput.value?.focus()
})
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.pos-page { background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 24px var(--rb-gutter, 24px) 40px; }
.pos-inner { max-width: var(--rb-content-max, 1600px); margin: 0 auto; }

.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
.page-title { font-size: 20px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 70ch; }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.header-actions .btn { text-decoration: none; }

/* Shift bar */
.shift-bar {
  display: flex; align-items: center; gap: 18px; flex-wrap: wrap; padding: 14px 16px; margin-bottom: 16px;
  background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px;
}
.shift-bar--open { border-color: rgba(var(--rb-success-rgb), .45); }
.shift-main { display: flex; align-items: center; gap: 10px; min-width: 220px; flex: 1; }
.shift-main strong { display: block; font-size: 14px; color: var(--rb-text-primary); }
.shift-meta { font-size: 12px; color: var(--rb-text-secondary); }
.shift-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--rb-success); flex: none; box-shadow: 0 0 0 4px rgba(var(--rb-success-rgb), .15); }
.shift-dot--off { background: var(--rb-text-muted); box-shadow: none; }
.shift-figures { display: flex; gap: 18px; margin: 0; flex-wrap: wrap; }
.shift-figures div { display: flex; flex-direction: column; gap: 1px; }
.shift-figures dt { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; color: var(--rb-text-secondary); }
.shift-figures dd { margin: 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.shift-expected dd { color: var(--rb-success-text); }
.shift-actions { display: flex; gap: 6px; }
.shift-open { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; width: 100%; }
.shift-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); width: 170px; }
.shift-field em { font-style: normal; font-weight: 400; color: var(--rb-text-muted); }
.shift-error { width: 100%; }

.pos-grid { display: grid; grid-template-columns: minmax(280px, 380px) minmax(0, 1fr); gap: 16px; align-items: start; }
.panel { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; padding: 16px; }
.panel-title { font-size: 14px; font-weight: 700; margin: 0 0 10px; color: var(--rb-text-primary); }

/* Find */
.search { position: relative; margin-bottom: 8px; }
.search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--rb-text-muted); pointer-events: none; }
/* Scoped under .search so it outranks .input's padding, declared further down. */
.search .search-input { padding-left: 36px; font-size: 14px; }
.list-heading { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: var(--rb-text-secondary); margin: 14px 0 6px; }
.list-empty { font-size: 12.5px; color: var(--rb-text-muted); margin: 0; }
.bill-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.bill-item {
  width: 100%; display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; text-align: left; padding: 9px 11px;
  font-family: inherit; cursor: pointer; border-radius: 10px; background: var(--rb-surface); border: 1px solid var(--rb-border); color: var(--rb-text-primary);
}
.bill-item:hover { background: var(--rb-surface-hover); }
.bill-item--on { border-color: var(--rb-primary); box-shadow: inset 0 0 0 1px var(--rb-primary); }
.bill-item__ref { font-size: 12.5px; font-weight: 700; }
.bill-item__who { grid-column: 1; font-size: 12px; color: var(--rb-text-secondary); overflow-wrap: anywhere; }
.bill-item__owed { grid-column: 2; grid-row: 1 / span 2; align-self: center; font-size: 12.5px; font-weight: 700; color: var(--rb-accent-text); white-space: nowrap; }
.bill-item__owed--clear { color: var(--rb-success-text); }

/* Bill */
.bill-panel { min-height: 420px; }
.bill-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
.bill-title { font-size: 17px; font-weight: 800; margin: 0; color: var(--rb-text-primary); }
.bill-sub { font-size: 12.5px; color: var(--rb-text-secondary); margin: 3px 0 0; }
.lines { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 10px; }
.lines th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: var(--rb-text-secondary); padding: 7px 8px; background: var(--rb-surface-alt); }
.lines td { padding: 8px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); }
.num { text-align: right !important; white-space: nowrap; font-variant-numeric: tabular-nums; }
.muted { color: var(--rb-text-muted); }
.totals { width: min(100%, 320px); margin: 0 0 14px auto; }
.totals > div { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 8px; }
.totals dt { color: var(--rb-text-secondary); margin: 0; }
.totals dd { margin: 0; font-weight: 600; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.totals-due { background: rgba(var(--rb-accent-rgb), .07); border-radius: 8px; font-size: 15px !important; }
.totals-due dd, .totals-due dt { color: var(--rb-accent-text) !important; font-weight: 800 !important; }

.method-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-bottom: 14px; }
.method-tab {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 10px; font-family: inherit;
  font-size: 13px; font-weight: 600; cursor: pointer; border-radius: 10px;
  background: var(--rb-surface); border: 1px solid var(--rb-border-strong); color: var(--rb-text-secondary);
}
.method-tab--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), .07); color: var(--rb-primary-text); }

.pay-form { display: flex; flex-direction: column; gap: 12px; }
.pay-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.optional { color: var(--rb-text-muted); font-weight: 400; }
.field-hint { font-size: 11.5px; color: var(--rb-text-secondary); margin: 0; }
.field-error { font-size: 12px; color: var(--rb-accent-text); margin: 0; }
.input {
  width: 100%; padding: 9px 11px; font-size: 13.5px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), .12); }
.input--money { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
.mono { font-family: var(--rb-font-mono); }

.quick-row { display: flex; gap: 6px; flex-wrap: wrap; }
.quick {
  padding: 7px 12px; font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; border-radius: 999px;
  background: var(--rb-surface); border: 1px solid var(--rb-border-strong); color: var(--rb-text-primary);
}
.quick--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), .07); color: var(--rb-primary-text); }

.change-callout {
  display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px;
  background: rgba(var(--rb-success-rgb), .09); border: 1px solid rgba(var(--rb-success-rgb), .3);
}
.change-callout span { font-size: 13px; font-weight: 600; color: var(--rb-text-secondary); }
.change-callout strong { font-size: 24px; font-weight: 800; color: var(--rb-success-text); font-variant-numeric: tabular-nums; }
.change-callout--short { background: rgba(var(--rb-accent-rgb), .07); border-color: rgba(var(--rb-accent-rgb), .25); }
.change-callout--short strong { color: var(--rb-accent-text); font-size: 16px; }

.done { text-align: center; padding: 22px 8px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.done-mark { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: rgba(var(--rb-success-rgb), .14); color: var(--rb-success-text); }
.done-title { font-size: 18px; font-weight: 800; margin: 0; color: var(--rb-text-primary); }
.done-sub { font-size: 13px; color: var(--rb-text-secondary); margin: 0; }
.done .change-callout { width: min(100%, 360px); }
.done-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 6px; }

.status { padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
.status--unpaid { background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text); }
.status--partial { background: rgba(var(--rb-warning-rgb), .12); color: var(--rb-warning-text); }
.status--paid { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }
.status--subsidised { background: rgba(var(--rb-purple-rgb), .12); color: var(--rb-purple-text); }
.tag { margin-left: 6px; padding: 1px 6px; border-radius: 5px; font-size: 10px; font-weight: 700; }
.tag--stat { background: var(--rb-accent); color: #fff; }

.banner { display: flex; align-items: flex-start; gap: 9px; padding: 11px 14px; border-radius: 10px; font-size: 13px; margin: 0 0 12px; }
.banner--warn { background: rgba(var(--rb-warning-rgb), .1); color: var(--rb-warning-text); border: 1px solid rgba(var(--rb-warning-rgb), .3); }
.banner--ok { background: rgba(var(--rb-success-rgb), .1); color: var(--rb-success-text); border: 1px solid rgba(var(--rb-success-rgb), .3); }

.empty { text-align: center; padding: 70px 20px; color: var(--rb-text-secondary); }
.empty h3 { font-size: 15px; color: var(--rb-text-primary); margin: 10px 0 4px; }
.empty p { font-size: 13px; margin: 0; }

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
.btn-lg { padding: 12px 18px; font-size: 14.5px; }

.skeleton {
  border-radius: 7px; margin-bottom: 8px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
.skeleton--row { height: 44px; }
.skeleton--bar { height: 40px; width: 100%; }
.skeleton--doc { height: 360px; }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

.toast-stack { position: fixed; top: 18px; right: 18px; z-index: 120; display: flex; flex-direction: column; gap: 8px; }
.toast { background: var(--rb-surface); border: 1px solid var(--rb-border-strong); border-radius: 10px; padding: 11px 15px; min-width: 250px; box-shadow: 0 6px 20px rgba(var(--rb-shadow-rgb), .1); }
.toast--danger .toast-title { color: var(--rb-accent-text); }
.toast--success .toast-title { color: var(--rb-success-text); }
.toast-title { font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.toast-message { font-size: 12px; color: var(--rb-text-secondary); margin-top: 2px; }
.toast-enter-active, .toast-leave-active { transition: opacity .25s, transform .25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(14px); }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .toast-enter-active, .toast-leave-active { transition: none; }
}

@media (max-width: 960px) {
  .pos-grid { grid-template-columns: 1fr; }
}

@media (max-width: 560px) {
  .pay-row, .method-tabs { grid-template-columns: 1fr; }
  .shift-field { width: 100%; }
}
</style>
