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
            Settle the statement raised against each Patient Transfusion request — cash at the
            counter, or a GCash checkout the watcher pays on their phone. Blood is not released
            until it is paid or met by the government subsidy. Weekly orders are billed to the
            hospital by statement only.
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

      <!-- RECEIPT JUST ISSUED -->
      <div v-if="lastReceipt" class="banner banner--ok">
        <AssetIcon name="check" :size="16" />
        <span>
          Receipt <strong class="mono">{{ lastReceipt.receipt_number }}</strong> issued
          <template v-if="lastReceipt.is_partial">for a part payment — {{ pesos(lastReceipt.balance_after) }} is still owed</template>.
        </span>
        <button class="btn btn-outline btn-sm" :disabled="downloadingId === `ar-${lastReceipt.id}`" @click="downloadReceipt(lastReceipt)">
          Download receipt
        </button>
        <button class="btn btn-outline btn-sm" @click="lastReceipt = null">Dismiss</button>
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
                <!-- Write actions only for whoever may record money; billing.view alone reads. -->
                <template v-if="canSeePayments && takesPayment(s)">
                  <button class="btn btn-primary btn-sm" @click="openPayment(s)">
                    Record Payment
                  </button>
                  <button class="btn btn-outline btn-sm" @click="openCheckout(s)">
                    GCash QR
                  </button>
                  <button class="btn btn-outline btn-sm" @click="openSubsidy(s)">
                    Apply Subsidy
                  </button>
                </template>
                <span v-else-if="s.is_statement_only" class="settled-note">Statement only</span>
                <span v-else-if="s.clears_release" class="settled-note">
                  {{ s.is_subsidised ? 'Government funded' : 'Settled' }}
                </span>
                <button class="btn btn-outline btn-sm" @click="openStatements(s)">
                  Statements
                </button>
                <!-- The payments carry reference numbers, so they are behind the ability to record them. -->
                <button
                  v-if="canSeePayments && Number(s.collected) > 0"
                  class="btn btn-outline btn-sm"
                  @click="openPayments(s)"
                >
                  Payments
                </button>
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
              For a transfer you can see on the payer's phone; the reference is the evidence.
              For a payment they make on their own phone, close this and use GCash QR instead —
              the provider confirms that one.
            </p>
          </div>

          <div class="field">
            <label for="pay-payer" class="field-label">Received from <span class="optional">(optional)</span></label>
            <input
              id="pay-payer"
              v-model.trim="payment.payer_name"
              type="text"
              class="input"
              maxlength="120"
              placeholder="e.g. the patient's watcher"
              autocomplete="off"
            >
            <p class="field-hint">Printed on the receipt.</p>
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

    <!-- RECORDED PAYMENTS. Each modal below steps aside while the request is reviewed: its overlay sits above the dialog's. -->
    <Teleport to="body">
      <div v-if="paymentsFor && !editingPayment && !paymentCorrection" class="modal-overlay" @click.self="closePayments">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="payments-title">
          <h2 id="payments-title" class="modal-title">Recorded Payments</h2>
          <p class="modal-sub">
            {{ paymentsFor.request?.reference_number }} · {{ paymentsFor.request?.requesting_facility }}
          </p>

          <div v-if="paymentsLoading" class="skeleton skeleton--row" />
          <p v-else-if="paymentsError" class="field-error field-error--block">{{ paymentsError }}</p>
          <p v-else-if="!paymentList.length" class="modal-desc">No payments have been recorded against this statement.</p>

          <ul v-else class="payment-list">
            <li v-for="p in paymentList" :key="p.id" class="payment-row">
              <div class="payment-main">
                <strong>{{ peso(p.amount_paid) }}</strong>
                <span class="payment-meta">{{ p.payment_method_label }} · {{ p.source_label ?? p.status_label }} · {{ formatWhen(p.payment_date) }}</span>
                <span v-if="p.reference_number" class="payment-meta mono">Ref {{ p.reference_number }}</span>
                <span v-if="p.receipt" class="payment-meta mono">Receipt {{ p.receipt.receipt_number }}</span>
              </div>
              <div class="payment-actions">
                <button
                  v-if="p.receipt"
                  type="button"
                  class="btn btn-outline btn-sm"
                  :disabled="downloadingId === `ar-${p.receipt.id}`"
                  @click="downloadReceipt(p.receipt)"
                >
                  Receipt
                </button>
                <span v-if="p.pending_correction" class="payment-pending">Correction pending</span>
                <button
                  v-else-if="canCorrectPayment && p.can_request_correction"
                  type="button"
                  class="btn btn-outline btn-sm"
                  @click="openPaymentCorrection(p)"
                >
                  Request correction
                </button>
              </div>
            </li>
          </ul>

          <div class="modal-actions">
            <button class="btn btn-outline" @click="closePayments">Close</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- CORRECT A PAYMENT -->
    <Teleport to="body">
      <div v-if="editingPayment && !paymentCorrection" class="modal-overlay" @click.self="closePaymentCorrection">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="fix-title">
          <h2 id="fix-title" class="modal-title">Correct a Payment</h2>
          <p class="modal-sub">
            Recorded {{ formatWhen(editingPayment.payment_date) }} · {{ editingPayment.status_label }}
          </p>

          <p class="modal-desc">
            Change what was recorded wrongly. The statement is re-worked from what it has then collected,
            once your change is approved.
          </p>

          <div class="field">
            <label for="fix-amount" class="field-label">Amount received <span class="req">*</span></label>
            <input id="fix-amount" v-model.number="fix.amount_paid" type="number" step="0.01" min="0.01" class="input">
          </div>

          <div class="field">
            <span class="field-label">Method <span class="req">*</span></span>
            <div class="method-row">
              <label
                v-for="method in methods"
                :key="method.value"
                class="pill"
                :class="{ 'pill--on': fix.payment_method === method.value }"
              >
                <input v-model="fix.payment_method" type="radio" name="fix-method" :value="method.value" class="sr-only">
                {{ method.label }}
              </label>
            </div>
          </div>

          <div v-if="fix.payment_method === 'gcash'" class="field">
            <label for="fix-ref" class="field-label">GCash reference <span class="req">*</span></label>
            <input id="fix-ref" v-model.trim="fix.reference_number" type="text" class="input" maxlength="100">
          </div>

          <p v-if="fixError" class="field-error field-error--block">{{ fixError }}</p>

          <div class="modal-actions">
            <button class="btn btn-outline" @click="closePaymentCorrection">Back</button>
            <button class="btn btn-primary" @click="reviewPaymentCorrection">Review correction</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- STATEMENTS OF ACCOUNT -->
    <Teleport to="body">
      <div v-if="statementsFor" class="modal-overlay" @click.self="closeStatements">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="soa-title">
          <h2 id="soa-title" class="modal-title">Statements of Account</h2>
          <p class="modal-sub">
            {{ statementsFor.request?.reference_number }} · {{ statementsFor.request?.requesting_facility }}
          </p>

          <p class="modal-desc">
            <template v-if="statementsFor.is_statement_only">
              Weekly order: the statement goes to the hospital for settlement outside RedAgos.
              No payment is taken here.
            </template>
            <template v-else>
              Each statement is frozen when it is issued. Issuing again after the bill or the
              balance changes adds a new revision; the earlier ones stay as they were.
            </template>
          </p>

          <div v-if="statementsLoading" class="skeleton skeleton--row" />
          <p v-else-if="statementsError" class="field-error field-error--block">{{ statementsError }}</p>
          <p v-else-if="!statementList.length" class="modal-desc">No statement has been issued yet.</p>

          <ul v-else class="payment-list">
            <li v-for="r in statementList" :key="r.id" class="payment-row">
              <div class="payment-main">
                <strong class="mono">{{ r.document_number }}</strong>
                <span class="payment-meta">
                  Revision {{ r.revision_number }} · {{ formatWhen(r.issued_at) }} ·
                  {{ r.statement_only ? 'Billed' : 'Due' }} {{ pesos(r.amount_due) }}
                </span>
              </div>
              <button
                type="button"
                class="btn btn-outline btn-sm"
                :disabled="downloadingId === `soa-${r.id}`"
                @click="downloadStatement(r)"
              >
                PDF
              </button>
            </li>
          </ul>

          <p v-if="issueError" class="field-error field-error--block">{{ issueError }}</p>

          <div class="modal-actions">
            <button class="btn btn-outline" @click="closeStatements">Close</button>
            <button v-if="canSeePayments" class="btn btn-primary" :disabled="issuing" @click="issueStatement">
              {{ issuing ? 'Issuing…' : 'Issue statement' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- GCASH CHECKOUT -->
    <Teleport to="body">
      <div v-if="checkoutFor" class="modal-overlay" @click.self="closeCheckout">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="qr-title">
          <h2 id="qr-title" class="modal-title">GCash Checkout</h2>
          <p class="modal-sub">
            {{ checkoutFor.request?.reference_number }} · {{ checkoutFor.request?.requesting_facility }}
          </p>

          <div v-if="checkoutLoading" class="skeleton skeleton--row" />

          <!-- Nothing open yet -->
          <template v-else-if="!attempt">
            <p v-if="!checkoutAvailability?.available" class="banner banner--warn">
              <AssetIcon name="triangle-alert" :size="15" />
              <span>{{ checkoutUnavailableMessage(checkoutAvailability?.reason) }}</span>
            </p>
            <template v-else>
              <dl class="modal-facts">
                <div><dt>Statement total</dt><dd>{{ peso(checkoutFor.total_amount) }}</dd></div>
                <div><dt>Already collected</dt><dd>{{ peso(checkoutFor.collected) }}</dd></div>
                <div><dt>To be paid by GCash</dt><dd class="owing">{{ peso(outstandingOf(checkoutFor)) }}</dd></div>
              </dl>
              <div class="field">
                <label for="payer-name" class="field-label">Name of the person paying <span class="req">*</span></label>
                <input
                  id="payer-name"
                  v-model.trim="payerName"
                  type="text"
                  class="input"
                  maxlength="120"
                  autocomplete="off"
                  placeholder="As the watcher gives it"
                >
                <p class="field-hint">
                  Sent to the payment provider as the payer. Nothing from the patient's record is sent.
                </p>
              </div>
            </template>
          </template>

          <!-- A checkout exists -->
          <template v-else>
            <div class="attempt-head">
              <span class="status" :class="`tone--${attemptTone(attempt.status)}`">{{ attempt.status_label }}</span>
              <span class="payment-meta">{{ pesos(attempt.amount) }} · {{ attempt.statement_document_number }}</span>
            </div>

            <div v-if="isAttemptPayable(attempt)" class="qr-block">
              <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR code for the GCash checkout" class="qr">
              <p class="field-hint">
                Ask the payer to scan this with their phone, or send them the link. It expires
                {{ formatWhen(attempt.expires_at) }}.
              </p>
              <div class="link-row">
                <input class="input mono" :value="attempt.checkout_url" readonly aria-label="Checkout link">
                <button class="btn btn-outline btn-sm" type="button" @click="copyCheckoutLink">Copy</button>
              </div>
              <p class="field-hint">
                This updates by itself when the provider confirms the payment. The payer's phone
                saying "paid" is not a confirmation — wait for this screen.
              </p>
            </div>
            <p v-else-if="attempt.status === 'creating'" class="modal-desc">Opening the checkout with the provider…</p>
            <p v-else-if="attempt.status === 'awaiting_verification'" class="banner banner--warn">
              <AssetIcon name="triangle-alert" :size="15" />
              <span>The provider reports a payment and it is being confirmed. Do not take cash for this statement meanwhile.</span>
            </p>
            <p v-else-if="attempt.status === 'completed'" class="banner banner--ok">
              <AssetIcon name="check" :size="15" />
              <span>Payment confirmed by the provider. Its receipt is under Payments.</span>
            </p>
            <p v-else class="modal-desc">This checkout is closed ({{ attempt.status_label.toLowerCase() }}).</p>

            <p v-if="attempt.review_required" class="banner banner--error">
              <AssetIcon name="triangle-alert" :size="15" />
              <span>{{ reviewReasonMessage(attempt.review_reason) }}</span>
            </p>

            <div v-if="attemptAction" class="field">
              <label for="attempt-reason" class="field-label">
                {{ attemptAction === 'supersede' ? 'Why is the payment being taken another way?' : 'Why is this checkout being closed?' }}
                <span class="req">*</span>
              </label>
              <input id="attempt-reason" v-model.trim="attemptReason" type="text" class="input" maxlength="255">
            </div>
          </template>

          <p v-if="checkoutError" class="field-error field-error--block">{{ checkoutError }}</p>

          <div class="modal-actions">
            <button class="btn btn-outline" :disabled="checkoutBusy" @click="closeCheckout">Close</button>

            <button
              v-if="!attempt && checkoutAvailability?.available"
              class="btn btn-primary"
              :disabled="checkoutBusy || payerName.length < 2"
              @click="startCheckout"
            >
              {{ checkoutBusy ? 'Opening…' : 'Open checkout' }}
            </button>

            <template v-if="attempt && attemptAction">
              <button class="btn btn-outline" :disabled="checkoutBusy" @click="attemptAction = null">Back</button>
              <button class="btn btn-primary" :disabled="checkoutBusy || attemptReason.length < 3" @click="confirmAttemptAction">
                {{ attemptAction === 'supersede' ? 'Supersede checkout' : 'Close checkout' }}
              </button>
            </template>
            <template v-else-if="attempt">
              <button v-if="attempt.status === 'active'" class="btn btn-outline" :disabled="checkoutBusy" @click="beginAttemptAction('supersede')">
                Take payment another way
              </button>
              <template v-if="attempt.review_required && isBillingSupervisor">
                <button class="btn btn-outline" :disabled="checkoutBusy" @click="reverifyAttempt">Re-check with provider</button>
                <button class="btn btn-outline" :disabled="checkoutBusy" @click="beginAttemptAction('close')">Close checkout</button>
              </template>
            </template>
          </div>
        </div>
      </div>
    </Teleport>

    <BloodCenterCorrectionRequestDialog
      v-if="paymentCorrection"
      subject="payment"
      :target-id="paymentCorrection.paymentId"
      :changes="paymentCorrection.changes"
      :previous="paymentCorrection.previous"
      @close="paymentCorrection = null"
      @submitted="onPaymentCorrectionSent"
    />
  </div>
</template>

<script setup>
import QRCode from 'qrcode'
import AssetIcon from '~/components/common/AssetIcon.vue'
import BloodCenterCorrectionRequestDialog from '~/components/BloodCenter/CorrectionRequestDialog.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import {
  attemptTone,
  checkoutUnavailableMessage,
  isAttemptPayable,
  isAttemptSettled,
  pesos,
  reviewReasonMessage,
  saveBlob,
  takesPayment,
} from '~/utils/billing'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.view',
})

const { user, can, canFile } = useUser()

// Resolving a checkout flagged for review is the Billing Supervisor's or the
// Center Admin's; the server refuses anyone else, this only hides the buttons.
const isBillingSupervisor = computed(() => Boolean(user.value?.is_supervisor) || user.value?.staff_role === 'billing_supervisor')

// The payments, with their reference numbers, are served only to whoever may
// record them. Filing a correction to one also needs the ability to request it
// and the subject itself, which a custom role in the department lacks.
const canSeePayments = computed(() => can('billing.record_payment'))
const canCorrectPayment = computed(() => can('billing.record_payment') && can('corrections.request') && canFile('payment'))

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
  { value: 'statement_only', label: 'Weekly (statement only)' },
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
const payment = reactive({ amount_paid: null, payment_method: 'cash', reference_number: '', payer_name: '' })

function openPayment(statement) {
  paymentFor.value = statement
  payError.value = ''
  Object.keys(payErrors).forEach((k) => delete payErrors[k])
  Object.assign(payment, {
    // Defaults to what is still owed, which is what a counter clerk almost
    // always takes.
    amount_paid: outstandingOf(statement),
    payment_method: 'cash',
    reference_number: '',
    payer_name: '',
  })
}

function outstandingOf(statement) {
  return Math.max(0, Number(statement?.total_amount ?? 0) - Number(statement?.collected ?? 0))
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
      ...(payment.payer_name ? { payer_name: payment.payer_name } : {}),
    })

    const settled = response?.billing?.clears_release
    toast(
      'Payment Recorded',
      'success',
      settled ? 'The statement is settled and the units can be released.' : 'Part payment recorded — the statement is still outstanding.',
    )
    // The receipt is issued with the payment; offer it straight away.
    lastReceipt.value = response?.receipt ?? null
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

/* RECORDED PAYMENTS AND THEIR CORRECTION */
const paymentsFor = ref(null)
const paymentList = ref([])
const paymentsLoading = ref(false)
const paymentsError = ref('')

function formatWhen(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

async function openPayments(statement) {
  paymentsFor.value = statement
  paymentList.value = []
  paymentsError.value = ''
  paymentsLoading.value = true

  try {
    const response = await bloodCenterService.billingPayments(statement.request?.id ?? statement.request_id)
    paymentList.value = response?.payments ?? []
  } catch (err) {
    paymentsError.value = err?.data?.message || err?.message || 'Could not load the payments.'
  } finally {
    paymentsLoading.value = false
  }
}

function closePayments() {
  paymentsFor.value = null
  editingPayment.value = null
}

const editingPayment = ref(null)
const paymentCorrection = ref(null)
const fixError = ref('')
const fix = reactive({ amount_paid: null, payment_method: 'cash', reference_number: '' })

function openPaymentCorrection(payment) {
  fixError.value = ''
  Object.assign(fix, {
    amount_paid: Number(payment.amount_paid),
    payment_method: payment.payment_method,
    reference_number: payment.reference_number ?? '',
  })
  editingPayment.value = payment
}

// Back to the list, not out of the modal.
function closePaymentCorrection() {
  editingPayment.value = null
}

// The whole corrected payload goes to the dialog, as the original write takes
// it; the server validates it with the same rules.
function reviewPaymentCorrection() {
  const payment = editingPayment.value

  if (!fix.amount_paid || fix.amount_paid <= 0) {
    fixError.value = 'Record the amount actually received.'
    return
  }

  if (fix.payment_method === 'gcash' && !fix.reference_number) {
    fixError.value = 'A GCash payment needs its reference number.'
    return
  }

  const changes = {
    amount_paid: Number(fix.amount_paid),
    payment_method: fix.payment_method,
    reference_number: fix.payment_method === 'gcash' ? fix.reference_number : null,
  }
  const previous = {
    amount_paid: Number(payment.amount_paid),
    payment_method: payment.payment_method,
    reference_number: payment.reference_number ?? null,
  }

  if (JSON.stringify(changes) === JSON.stringify(previous)) {
    fixError.value = 'Nothing has changed yet.'
    return
  }

  fixError.value = ''
  paymentCorrection.value = { paymentId: payment.id, changes, previous }
}

async function onPaymentCorrectionSent(response) {
  paymentCorrection.value = null
  editingPayment.value = null
  toast('Correction Requested', 'success', response?.message ?? 'It is applied once it is approved.')

  // Back on the list, which now shows this payment as awaiting a decision.
  if (paymentsFor.value) await openPayments(paymentsFor.value)
}

/* RECEIPTS AND STATEMENT DOWNLOADS */
const lastReceipt = ref(null)
const downloadingId = ref(null)

async function downloadReceipt(receipt) {
  downloadingId.value = `ar-${receipt.id}`

  try {
    saveBlob(await bloodCenterService.downloadReceipt(receipt.id), `${receipt.receipt_number}.pdf`)
  } catch (err) {
    toast('Download Failed', 'danger', err?.message || 'The receipt could not be downloaded.')
  } finally {
    downloadingId.value = null
  }
}

async function downloadStatement(revision) {
  downloadingId.value = `soa-${revision.id}`

  try {
    saveBlob(await bloodCenterService.downloadStatement(revision.id), `${revision.document_number}.pdf`)
  } catch (err) {
    toast('Download Failed', 'danger', err?.message || 'The statement could not be downloaded.')
  } finally {
    downloadingId.value = null
  }
}

/* STATEMENTS OF ACCOUNT */
const statementsFor = ref(null)
const statementList = ref([])
const statementsLoading = ref(false)
const statementsError = ref('')
const issuing = ref(false)
const issueError = ref('')

async function openStatements(statement) {
  statementsFor.value = statement
  statementList.value = []
  statementsError.value = ''
  issueError.value = ''
  statementsLoading.value = true

  try {
    const response = await bloodCenterService.billingStatements(statement.request?.id ?? statement.request_id)
    statementList.value = response?.statements ?? []
  } catch (err) {
    statementsError.value = err?.message || 'Could not load the statements.'
  } finally {
    statementsLoading.value = false
  }
}

function closeStatements() {
  if (issuing.value) return
  statementsFor.value = null
}

async function issueStatement() {
  issuing.value = true
  issueError.value = ''

  try {
    const response = await bloodCenterService.issueStatement(statementsFor.value.request?.id ?? statementsFor.value.request_id)
    toast(
      response.created ? 'Statement Issued' : 'No Changes Since Last Statement',
      response.created ? 'success' : 'info',
      response.revision?.document_number,
    )
    await openStatements(statementsFor.value)
  } catch (err) {
    issueError.value = err?.message || 'The statement could not be issued.'
  } finally {
    issuing.value = false
  }
}

/* GCASH CHECKOUT */
const POLL_MS = 4000

const checkoutFor = ref(null)
const checkoutAvailability = ref(null)
const attempt = ref(null)
const checkoutLoading = ref(false)
const checkoutBusy = ref(false)
const checkoutError = ref('')
const payerName = ref('')
const qrDataUrl = ref('')
const attemptAction = ref(null)
const attemptReason = ref('')
let pollTimer = null

function requestIdOf(statement) {
  return statement?.request?.id ?? statement?.request_id
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// Polls the server, never the provider: only the server's confirmed status
// says a checkout was paid.
function startPolling() {
  stopPolling()

  if (!attempt.value || isAttemptSettled(attempt.value.status)) return

  pollTimer = setInterval(refreshAttempt, POLL_MS)
}

async function showAttempt(next) {
  const wasSettled = isAttemptSettled(attempt.value?.status)
  attempt.value = next
  qrDataUrl.value = isAttemptPayable(next)
    ? await QRCode.toDataURL(next.checkout_url, { margin: 1, width: 240 })
    : ''

  if (next && isAttemptSettled(next.status)) {
    stopPolling()

    if (!wasSettled && next.status === 'completed') {
      toast('GCash Payment Confirmed', 'success', 'The statement is updated and the receipt is issued.')
      await load()
    }
  }
}

async function openCheckout(statement) {
  checkoutFor.value = statement
  checkoutAvailability.value = null
  attempt.value = null
  qrDataUrl.value = ''
  checkoutError.value = ''
  payerName.value = ''
  attemptAction.value = null
  checkoutLoading.value = true

  try {
    const response = await bloodCenterService.billingForRequest(requestIdOf(statement))
    checkoutAvailability.value = response?.checkout ?? null

    if (response?.open_attempt) {
      await showAttempt(response.open_attempt)
      startPolling()
    }
  } catch (err) {
    checkoutError.value = err?.message || 'Could not load this statement.'
  } finally {
    checkoutLoading.value = false
  }
}

function closeCheckout() {
  if (checkoutBusy.value) return
  stopPolling()
  checkoutFor.value = null
  attempt.value = null
}

async function startCheckout() {
  checkoutBusy.value = true
  checkoutError.value = ''

  try {
    const response = await bloodCenterService.startCheckout(requestIdOf(checkoutFor.value), payerName.value)
    await showAttempt(response.attempt)
    startPolling()
  } catch (err) {
    checkoutError.value = err?.message || 'The checkout could not be opened. Take the payment in cash, or try again.'
  } finally {
    checkoutBusy.value = false
  }
}

async function refreshAttempt() {
  if (!checkoutFor.value || !attempt.value) return

  try {
    const response = await bloodCenterService.checkoutAttempts(requestIdOf(checkoutFor.value))
    const latest = (response?.attempts ?? []).find((a) => a.id === attempt.value.id)

    if (latest) await showAttempt(latest)
  } catch {
    // A missed poll is not an error worth showing; the next one tries again.
  }
}

async function copyCheckoutLink() {
  try {
    await navigator.clipboard.writeText(attempt.value.checkout_url)
    toast('Link Copied', 'info')
  } catch {
    toast('Copy Failed', 'danger', 'Select the link and copy it by hand.')
  }
}

function beginAttemptAction(action) {
  attemptAction.value = action
  attemptReason.value = ''
  checkoutError.value = ''
}

async function confirmAttemptAction() {
  checkoutBusy.value = true
  checkoutError.value = ''

  try {
    const requestId = requestIdOf(checkoutFor.value)
    const response = attemptAction.value === 'supersede'
      ? await bloodCenterService.supersedeCheckout(requestId, attempt.value.id, attemptReason.value)
      : await bloodCenterService.closeCheckout(requestId, attempt.value.id, attemptReason.value)

    attemptAction.value = null
    await showAttempt(response.attempt)
    toast(response.message ?? 'Checkout updated', 'success')
    await load()
  } catch (err) {
    checkoutError.value = err?.message || 'The checkout could not be updated.'
  } finally {
    checkoutBusy.value = false
  }
}

async function reverifyAttempt() {
  checkoutBusy.value = true
  checkoutError.value = ''

  try {
    const response = await bloodCenterService.reverifyCheckout(requestIdOf(checkoutFor.value), attempt.value.id)
    await showAttempt(response.attempt)
    startPolling()
  } catch (err) {
    checkoutError.value = err?.message || 'The provider could not be asked again.'
  } finally {
    checkoutBusy.value = false
  }
}

onMounted(load)
onBeforeUnmount(stopPolling)
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.bl-page { background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 24px var(--rb-gutter, 24px) 40px; }
.bl-inner { max-width: var(--rb-content-max, 1600px); margin: 0 auto; }

.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
.page-title { font-size: 20px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 70ch; }

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
.mono { font-family: var(--rb-font-mono); font-size: 12.5px; }
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
.status--statement_only { background: rgba(var(--rb-primary-rgb), .08); color: var(--rb-primary-text); }

/* Checkout status tones */
.tone--success { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }
.tone--warning { background: rgba(var(--rb-warning-rgb), .12); color: var(--rb-warning-text); }
.tone--danger { background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text); }
.tone--info { background: rgba(var(--rb-primary-rgb), .08); color: var(--rb-primary-text); }
.tone--muted { background: var(--rb-surface-hover); color: var(--rb-text-muted); }

.banner--ok { background: rgba(var(--rb-success-rgb), .1); color: var(--rb-success-text); border: 1px solid rgba(var(--rb-success-rgb), .3); flex-wrap: wrap; }
.attempt-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.qr-block { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 8px; }
.qr { width: 220px; height: 220px; border: 1px solid var(--rb-border); border-radius: 10px; background: #fff; padding: 8px; }
.link-row { display: flex; gap: 8px; width: 100%; }
.link-row .input { font-size: 12px; }
.payment-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

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
.payment-list { list-style: none; margin: 0 0 4px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.payment-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px solid var(--rb-border); border-radius: 9px; }
.payment-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.payment-meta { font-size: 12px; color: var(--rb-text-secondary); overflow-wrap: anywhere; }
.payment-pending { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); white-space: nowrap; }

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
