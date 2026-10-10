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
          <h1 class="page-title">Bills &amp; Statements</h1>
          <p class="page-subtitle">
            Patient bills are paid at the counter — cash, or a GCash checkout the watcher pays on
            their phone — and blood is not released until one is paid or met by the government
            subsidy. Weekly orders are billed to the hospital by statement, and recorded here once
            the hospital settles them.
          </p>
        </div>
        <div class="header-actions">
          <NuxtLink v-if="canSeePayments" to="/blood-center/pos" class="btn btn-primary">
            <AssetIcon name="credit-card" :size="16" />
            Open counter
          </NuxtLink>
          <NuxtLink v-if="canSeePayments" to="/blood-center/billing-transactions" class="btn btn-outline">
            Transactions
          </NuxtLink>
          <button class="btn btn-outline" :disabled="loading" @click="refreshAll">
            <AssetIcon name="refresh-cw" :size="16" :class="{ spinning: loading }" />
            Refresh
          </button>
        </div>
      </header>

      <!-- Documents are headed by the centre's own logo; without one, its initials. -->
      <div v-if="summary && !summary.issuer?.logo_url" class="banner banner--info">
        <AssetIcon name="info" :size="16" />
        <span>
          Your statements and receipts are printed with your centre's initials because no logo is uploaded.
          <template v-if="can('center.configure')">
            Upload one in <NuxtLink to="/blood-center/settings" class="inline-link">Settings</NuxtLink>.
          </template>
          <template v-else>A supervisor can upload one in Settings.</template>
        </span>
      </div>

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

      <!-- CATEGORY: owed by a patient at the counter, or by a hospital by statement -->
      <div class="category-switch fade-in" role="tablist" aria-label="Bill category" style="--delay:75ms">
        <button
          v-for="c in categories"
          :key="c.value"
          role="tab"
          class="category"
          :class="{ 'category--on': category === c.value }"
          :aria-selected="category === c.value"
          @click="category = c.value"
        >
          <strong>{{ c.label }}</strong>
          <span>{{ c.note }}</span>
        </button>
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
          <h3>{{ category === 'weekly' ? 'No hospital statements' : 'No patient bills' }}</h3>
          <p>A bill is raised the moment stock is reserved for a request.</p>
        </div>

        <table v-else class="bl-table">
          <thead>
            <tr>
              <th scope="col">Reference</th>
              <th scope="col">Hospital</th>
              <th scope="col">Components</th>
              <th scope="col" class="num">Total</th>
              <th v-if="category === 'patient'" scope="col" class="num">Collected</th>
              <th scope="col">Status</th>
              <th v-if="category === 'patient'" scope="col" class="num">Release</th>
              <th v-else scope="col">Settlement</th>
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
              <td v-if="category === 'patient'" class="num">{{ s.collected > 0 ? peso(s.collected) : '—' }}</td>
              <td>
                <span class="status" :class="`status--${s.status}`">{{ s.status_label }}</span>
              </td>
              <td v-if="category === 'patient'" class="num">
                <span class="gate" :class="s.clears_release ? 'gate--ok' : 'gate--blocked'">
                  <AssetIcon :name="s.clears_release ? 'check' : 'x'" :size="12" />
                  {{ s.clears_release ? 'Cleared' : 'Blocked' }}
                </span>
              </td>
              <td v-else class="settlement-cell">
                <template v-if="s.settlement">
                  {{ formatDay(s.settlement.settled_at) }}
                  <span class="mono">{{ s.settlement.reference }}</span>
                </template>
                <span v-else class="settled-note">Awaiting the hospital</span>
              </td>
              <td class="actions">
                <!-- Write actions only for whoever may record money; billing.view alone reads. -->
                <template v-if="canSeePayments && takesPayment(s)">
                  <!-- Money is taken at the counter. -->
                  <NuxtLink :to="`/blood-center/pos?request=${requestIdOf(s)}`" class="btn btn-primary btn-sm">
                    Take payment
                  </NuxtLink>
                  <button class="btn btn-outline btn-sm" @click="checkoutFor = s">
                    GCash QR
                  </button>
                  <button class="btn btn-outline btn-sm" @click="openSubsidy(s)">
                    Apply Subsidy
                  </button>
                </template>
                <button
                  v-else-if="canSeePayments && s.status === 'statement_only'"
                  class="btn btn-primary btn-sm"
                  @click="openSettlement(s)"
                >
                  Record settlement
                </button>
                <span v-else-if="s.is_statement_only" class="settled-note">
                  {{ s.is_settled_outside ? 'Settled by hospital' : 'Statement only' }}
                </span>
                <span v-else-if="s.clears_release" class="settled-note">
                  {{ s.is_subsidised ? 'Government funded' : 'Settled' }}
                </span>
                <button class="btn btn-outline btn-sm" @click="openDocuments(s)">
                  Documents
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

    <!-- RECORD A WEEKLY BILL'S SETTLEMENT. No money moves through RedAgos. -->
    <Teleport to="body">
      <div v-if="settlementFor" class="modal-overlay" @click.self="closeSettlement">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settle-title">
          <h2 id="settle-title" class="modal-title">Record Hospital Settlement</h2>
          <p class="modal-sub">
            {{ settlementFor.request?.reference_number }} · {{ settlementFor.request?.requesting_facility }}
          </p>

          <p class="modal-desc">
            The hospital settled this weekly bill outside RedAgos. Recording it closes the statement at the
            figure below; nothing is collected here.
          </p>

          <dl class="modal-facts">
            <div><dt>Amount billed</dt><dd>{{ peso(settlementFor.total_amount) }}</dd></div>
          </dl>

          <div class="field">
            <label for="settle-ref" class="field-label">Hospital's payment reference <span class="req">*</span></label>
            <input
              id="settle-ref"
              v-model.trim="settlement.settlement_reference"
              type="text"
              class="input"
              :class="{ 'input--error': settlementErrors.settlement_reference }"
              maxlength="100"
              placeholder="e.g. cheque or transfer number"
            >
            <p v-if="settlementErrors.settlement_reference" class="field-error">{{ settlementErrors.settlement_reference }}</p>
          </div>

          <div class="field">
            <label for="settle-date" class="field-label">Date settled <span class="req">*</span></label>
            <input
              id="settle-date"
              v-model="settlement.settled_at"
              type="date"
              class="input"
              :class="{ 'input--error': settlementErrors.settled_at }"
              :max="todayIso"
            >
            <p v-if="settlementErrors.settled_at" class="field-error">{{ settlementErrors.settled_at }}</p>
          </div>

          <div class="field">
            <label for="settle-note" class="field-label">Note <span class="optional">(optional)</span></label>
            <input id="settle-note" v-model.trim="settlement.settlement_note" type="text" class="input" maxlength="500">
          </div>

          <p v-if="settlementError" class="field-error field-error--block">{{ settlementError }}</p>

          <div class="modal-actions">
            <button class="btn btn-outline" :disabled="saving" @click="closeSettlement">Cancel</button>
            <button class="btn btn-primary" :disabled="saving || !settlement.settlement_reference" @click="submitSettlement">
              {{ saving ? 'Recording…' : 'Record settlement' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- REQUEST A VOID: decided by the Billing Supervisor -->
    <Teleport to="body">
      <div v-if="voidFor" class="modal-overlay" @click.self="closeVoid">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="void-title">
          <h2 id="void-title" class="modal-title">Request a Void</h2>
          <p class="modal-sub">
            {{ peso(voidFor.amount_paid) }} {{ voidFor.payment_method_label }} · {{ formatWhen(voidFor.payment_date) }}
            <template v-if="voidFor.receipt"> · Receipt {{ voidFor.receipt.receipt_number }}</template>
          </p>

          <p class="modal-desc">
            For a payment recorded in error, or money handed straight back, on the day it was taken.
            The Billing Supervisor decides. After that, money given back is a refund, settled outside RedAgos.
          </p>

          <div class="field">
            <label for="void-reason" class="field-label">Why is it being voided? <span class="req">*</span></label>
            <input id="void-reason" v-model.trim="voidReason" type="text" class="input" maxlength="1000">
          </div>

          <p v-if="voidError" class="field-error field-error--block">{{ voidError }}</p>

          <div class="modal-actions">
            <button class="btn btn-outline" :disabled="saving" @click="closeVoid">Back</button>
            <button class="btn btn-primary" :disabled="saving || voidReason.length < 3" @click="submitVoid">
              {{ saving ? 'Sending…' : 'Request void' }}
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
      <div v-if="paymentsFor && !editingPayment && !paymentCorrection && !voidFor" class="modal-overlay" @click.self="closePayments">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="payments-title">
          <h2 id="payments-title" class="modal-title">Recorded Payments</h2>
          <p class="modal-sub">
            {{ paymentsFor.request?.reference_number }} · {{ paymentsFor.request?.requesting_facility }}
          </p>

          <div v-if="paymentsLoading" class="skeleton skeleton--row" />
          <p v-else-if="paymentsError" class="field-error field-error--block">{{ paymentsError }}</p>
          <p v-else-if="!paymentList.length" class="modal-desc">No payments have been recorded against this statement.</p>

          <ul v-else class="payment-list">
            <li v-for="p in paymentList" :key="p.id" class="payment-row" :class="{ 'payment-row--voided': p.status === 'voided' }">
              <div class="payment-main">
                <strong>{{ peso(p.amount_paid) }} <span v-if="p.status === 'voided'" class="voided-tag">Voided</span></strong>
                <span class="payment-meta">{{ p.payment_method_label }} · {{ p.source_label ?? p.status_label }} · {{ formatWhen(p.payment_date) }}</span>
                <span v-if="p.amount_tendered" class="payment-meta">
                  Tendered {{ pesos(p.amount_tendered) }} · change {{ pesos(p.change_given) }}
                </span>
                <span v-if="p.cash_session" class="payment-meta mono">Shift {{ p.cash_session.session_number }}</span>
                <span v-if="p.reference_number" class="payment-meta mono">Ref {{ p.reference_number }}</span>
                <span v-if="p.receipt" class="payment-meta mono">Receipt {{ p.receipt.receipt_number }}</span>
                <span v-if="p.void_reason" class="payment-meta">Voided: {{ p.void_reason }}</span>
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
                <span v-else-if="p.pending_void" class="payment-pending">Void pending</span>
                <template v-else>
                  <button
                    v-if="canCorrectPayment && p.can_request_correction"
                    type="button"
                    class="btn btn-outline btn-sm"
                    @click="openPaymentCorrection(p)"
                  >
                    Request correction
                  </button>
                  <button
                    v-if="canVoidPayment && p.can_request_void"
                    type="button"
                    class="btn btn-outline btn-sm"
                    @click="openVoid(p)"
                  >
                    Request void
                  </button>
                </template>
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

    <!-- BILLING DOCUMENTS: each statement revision and receipt, laid out as it prints -->
    <Teleport to="body">
      <div v-if="documentsFor" class="modal-overlay" @click.self="closeDocuments">
        <div class="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="docs-title">
          <div class="docs-head">
            <div>
              <h2 id="docs-title" class="modal-title">Billing Documents</h2>
              <p class="modal-sub">
                {{ documentsFor.request?.reference_number }} · {{ documentsFor.request?.requesting_facility }}
              </p>
            </div>
            <div class="pills" role="tablist" aria-label="Document">
              <button
                role="tab"
                class="pill"
                :class="{ 'pill--on': docTab === 'statement' }"
                :aria-selected="docTab === 'statement'"
                @click="docTab = 'statement'"
              >
                Statement of Account
              </button>
              <!-- Receipts come with the payments, which only whoever may record them is served. -->
              <button
                v-if="canSeePayments"
                role="tab"
                class="pill"
                :class="{ 'pill--on': docTab === 'receipt' }"
                :aria-selected="docTab === 'receipt'"
                @click="docTab = 'receipt'"
              >
                Receipts
              </button>
            </div>
          </div>

          <!-- STATEMENT -->
          <template v-if="docTab === 'statement'">
            <div v-if="statementsLoading" class="skeleton skeleton--doc" />
            <p v-else-if="statementsError" class="field-error field-error--block">{{ statementsError }}</p>
            <div v-else-if="!statementList.length" class="empty empty--compact">
              <AssetIcon name="file-text" :size="30" />
              <h3>No statement issued yet</h3>
              <p>
                {{ documentsFor.is_statement_only
                  ? 'Issue one to send this weekly order to the hospital; it is settled outside RedAgos.'
                  : 'Issue one to give the patient or their watcher the amount payable.' }}
              </p>
            </div>
            <template v-else-if="selectedRevision">
              <div class="doc-toolbar">
                <label for="doc-revision" class="field-label">Revision</label>
                <select id="doc-revision" v-model="selectedRevisionId" class="input input--select">
                  <option v-for="r in revisionsNewestFirst" :key="r.id" :value="r.id">
                    {{ r.document_number }} · Revision {{ r.revision_number }} · {{ formatWhen(r.issued_at) }}
                  </option>
                </select>
                <p class="field-hint">
                  Each statement is frozen when it is issued. Issuing again after the bill or the balance
                  changes adds a new revision; earlier ones stay as they were.
                </p>
              </div>
              <div class="doc-metrics">
                <div v-for="m in documentMetrics" :key="m.label" class="stat-card">
                  <span class="stat-label">{{ m.label }}</span>
                  <span class="stat-value" :class="m.tone && `stat-value--${m.tone}`">{{ m.value }}</span>
                  <span class="stat-note">{{ m.note }}</span>
                </div>
              </div>
              <BillingDocument :revision="selectedRevision" />
            </template>
            <p v-if="issueError" class="field-error field-error--block">{{ issueError }}</p>
          </template>

          <!-- RECEIPTS -->
          <template v-else>
            <div v-if="receiptsLoading" class="skeleton skeleton--doc" />
            <p v-else-if="receiptsError" class="field-error field-error--block">{{ receiptsError }}</p>
            <div v-else-if="!receiptPayments.length" class="empty empty--compact">
              <AssetIcon name="receipt" :size="30" />
              <h3>No receipts yet</h3>
              <p>A receipt is issued with every payment recorded, cash or GCash.</p>
            </div>
            <template v-else-if="selectedReceiptPayment">
              <div class="doc-toolbar">
                <label for="doc-receipt" class="field-label">Receipt</label>
                <select id="doc-receipt" v-model="selectedReceiptId" class="input input--select">
                  <option v-for="p in receiptPayments" :key="p.receipt.id" :value="p.receipt.id">
                    {{ p.receipt.receipt_number }} · {{ pesos(p.receipt.amount_paid) }} · {{ formatWhen(p.receipt.issued_at) }}
                  </option>
                </select>
              </div>
              <div class="doc-metrics">
                <div v-for="m in documentMetrics" :key="m.label" class="stat-card">
                  <span class="stat-label">{{ m.label }}</span>
                  <span class="stat-value" :class="m.tone && `stat-value--${m.tone}`">{{ m.value }}</span>
                  <span class="stat-note">{{ m.note }}</span>
                </div>
              </div>
              <BillingDocument
                :receipt="selectedReceiptPayment.receipt"
                :payment-reference="selectedReceiptPayment.reference_number"
              />
            </template>
          </template>

          <div class="modal-actions">
            <button class="btn btn-outline" @click="closeDocuments">Close</button>
            <button
              v-if="docTab === 'statement' && canSeePayments"
              class="btn btn-outline"
              :disabled="issuing"
              @click="issueStatement"
            >
              {{ issuing ? 'Issuing…' : 'Issue statement' }}
            </button>
            <button class="btn btn-outline" :disabled="!currentDocument || printing" @click="printDocument">
              <AssetIcon name="printer" :size="15" />
              {{ printing ? 'Opening…' : 'Print' }}
            </button>
            <button class="btn btn-primary" :disabled="!currentDocument || downloadingId !== null" @click="downloadCurrent">
              <AssetIcon name="download" :size="15" />
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- GCASH CHECKOUT: the same dialog the counter uses -->
    <GcashCheckoutDialog
      v-if="checkoutFor"
      :request-id="requestIdOf(checkoutFor)"
      :heading="`${checkoutFor.request?.reference_number ?? ''} · ${checkoutFor.request?.requesting_facility ?? ''}`"
      :total="checkoutFor.total_amount"
      :collected="checkoutFor.collected"
      @close="checkoutFor = null"
      @changed="refreshAll"
      @notify="(n) => toast(n.title, n.variant, n.message)"
    />

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
import AssetIcon from '~/components/common/AssetIcon.vue'
import BillingDocument from '~/components/common/BillingDocument.vue'
import BloodCenterCorrectionRequestDialog from '~/components/BloodCenter/CorrectionRequestDialog.vue'
import GcashCheckoutDialog from '~/components/BloodCenter/GcashCheckoutDialog.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import {
  pesos,
  saveBlob,
  statementFigures,
  takesPayment,
} from '~/utils/billing'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.view',
})

const { can, canFile } = useUser()

// The payments, with their reference numbers, are served only to whoever may
// record them. Filing a correction to one also needs the ability to request it
// and the subject itself, which a custom role in the department lacks.
const canSeePayments = computed(() => can('billing.record_payment'))
const canCorrectPayment = computed(() => can('billing.record_payment') && can('corrections.request') && canFile('payment'))
const canVoidPayment = computed(() => can('billing.record_payment') && can('corrections.request') && canFile('payment_void'))

/*
 * The bills raised against this centre's requests, in two categories that are
 * owed by different people and never added together: patient bills, paid at
 * the counter (the POS page takes the money), and
 * the hospitals' weekly statements, settled outside RedAgos and recorded here.
 */

const statements = ref([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const search = ref('')
const category = ref('patient')
const activeTab = ref('outstanding')
const summary = ref(null)

const categories = [
  { value: 'patient', label: 'Patient bills', note: 'Paid at the counter' },
  { value: 'weekly', label: 'Hospital statements', note: 'Weekly orders, settled by the hospital' },
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

const tabs = computed(() => TABS[category.value])

// For correcting a recorded payment's method.
const methods = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
]

const todayIso = new Date().toISOString().slice(0, 10)

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

// Counted on the server from the journal and every statement, never from the
// page of rows this screen happens to hold.
const stats = computed(() => {
  const s = summary.value

  if (!s) return []

  return [
    { key: 'blocked', label: 'Blocking Release', value: s.outstanding.count, note: `${pesos(s.outstanding.amount)} still owed by patients`, tone: s.outstanding.count ? 'danger' : null },
    { key: 'today', label: 'Collected Today', value: pesos(s.collected_today), note: 'Cash and GCash, less voids' },
    { key: 'month', label: 'Collected This Month', value: pesos(s.collected_this_month), note: `${s.subsidised_this_month.count} subsidised (${pesos(s.subsidised_this_month.amount)} waived)` },
    { key: 'weekly', label: 'Awaiting Hospital Settlement', value: s.weekly_awaiting_settlement.count, note: `${pesos(s.weekly_awaiting_settlement.amount)} in weekly statements` },
  ]
})

let searchDebounce = null
function onSearch() {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(load, 400)
}

watch(category, () => {
  activeTab.value = tabs.value[0].value
  load()
})
watch(activeTab, () => load())

async function load() {
  loading.value = true
  error.value = ''

  const params = { category: category.value }
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

async function loadSummary() {
  try {
    summary.value = await bloodCenterService.billingSummary()
  } catch {
    // The cards are a convenience; the list below still works without them.
    summary.value = null
  }
}

async function refreshAll() {
  await Promise.all([load(), loadSummary()])
}

function formatDay(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'
}

/* RECORD A WEEKLY BILL'S SETTLEMENT */
const settlementFor = ref(null)
const settlementError = ref('')
const settlementErrors = reactive({})
const settlement = reactive({ settlement_reference: '', settled_at: todayIso, settlement_note: '' })

function openSettlement(statement) {
  settlementFor.value = statement
  settlementError.value = ''
  Object.keys(settlementErrors).forEach((k) => delete settlementErrors[k])
  Object.assign(settlement, { settlement_reference: '', settled_at: todayIso, settlement_note: '' })
}

function closeSettlement() {
  if (saving.value) return
  settlementFor.value = null
}

async function submitSettlement() {
  settlementError.value = ''
  Object.keys(settlementErrors).forEach((k) => delete settlementErrors[k])
  saving.value = true

  try {
    const response = await bloodCenterService.settleWeeklyBill(requestIdOf(settlementFor.value), {
      settlement_reference: settlement.settlement_reference,
      settled_at: settlement.settled_at,
      settlement_note: settlement.settlement_note || null,
    })
    toast('Settlement Recorded', 'success', response?.message)
    settlementFor.value = null
    await refreshAll()
  } catch (err) {
    Object.entries(err?.errors ?? {}).forEach(([key, messages]) => {
      settlementErrors[key] = Array.isArray(messages) ? messages[0] : messages
    })
    settlementError.value = err?.message || 'The settlement could not be recorded.'
  } finally {
    saving.value = false
  }
}

/* REQUEST A VOID, decided by the Billing Supervisor */
const voidFor = ref(null)
const voidReason = ref('')
const voidError = ref('')

function openVoid(payment) {
  voidFor.value = payment
  voidReason.value = ''
  voidError.value = ''
}

function closeVoid() {
  if (saving.value) return
  voidFor.value = null
}

async function submitVoid() {
  voidError.value = ''
  saving.value = true

  try {
    const response = await bloodCenterService.requestPaymentVoid(voidFor.value.id, voidReason.value)
    toast('Void Requested', 'success', response?.message ?? 'It is applied once the Billing Supervisor approves it.')
    voidFor.value = null

    if (paymentsFor.value) await openPayments(paymentsFor.value)
  } catch (err) {
    voidError.value = err?.message || 'The void could not be requested.'
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

/*
 * BILLING DOCUMENTS
 *
 * Every statement revision and receipt of one request, each shown as it prints
 * (the owner's billing mock-up, 2026-10-11). The PDF from the server is the
 * official copy: Print and Download both fetch it.
 */
const documentsFor = ref(null)
const docTab = ref('statement')
const statementList = ref([])
const statementsLoading = ref(false)
const statementsError = ref('')
const selectedRevisionId = ref(null)
const issuing = ref(false)
const issueError = ref('')
const receiptPayments = ref([])
const receiptsLoading = ref(false)
const receiptsError = ref('')
const selectedReceiptId = ref(null)
const printing = ref(false)

const revisionsNewestFirst = computed(() => [...statementList.value].sort((a, b) => b.revision_number - a.revision_number))
const selectedRevision = computed(() => statementList.value.find((r) => r.id === selectedRevisionId.value) ?? null)
const selectedReceiptPayment = computed(() => receiptPayments.value.find((p) => p.receipt.id === selectedReceiptId.value) ?? null)

const currentDocument = computed(() => (docTab.value === 'statement'
  ? selectedRevision.value && { kind: 'statement', id: selectedRevision.value.id, name: selectedRevision.value.document_number }
  : selectedReceiptPayment.value && { kind: 'receipt', id: selectedReceiptPayment.value.receipt.id, name: selectedReceiptPayment.value.receipt.receipt_number }))

// The three figures above the document, from its own frozen amounts.
const documentMetrics = computed(() => {
  if (docTab.value === 'statement' && selectedRevision.value) {
    const r = selectedRevision.value
    const f = statementFigures(r)

    return [
      { label: r.statement_only ? 'Amount billed' : 'Amount payable', value: pesos(f.payable), note: f.subsidy > 0 ? 'After the government subsidy' : 'Statement total' },
      { label: 'Amount received', value: pesos(f.paid), note: f.paid > 0 ? 'Before this statement' : 'No payment yet' },
      { label: 'Outstanding balance', value: pesos(f.balance), note: f.balance > 0 ? (r.statement_only ? 'Settled outside RedAgos' : 'Payment still due') : 'Nothing outstanding', tone: f.balance > 0 && !r.statement_only ? 'danger' : null },
    ]
  }

  const receipt = selectedReceiptPayment.value?.receipt
  if (!receipt) return []
  const after = Number(receipt.balance_after ?? 0)

  return [
    { label: 'Statement total', value: receipt.statement ? pesos(receipt.statement.total_amount) : '—', note: receipt.statement?.document_number ?? 'No statement on record' },
    { label: 'Amount received', value: pesos(receipt.amount_paid), note: receipt.payment?.method_label ?? receipt.payment_method_label ?? '' },
    { label: 'Remaining balance', value: pesos(Math.max(after, 0)), note: after > 0 ? 'Still due' : 'Settled by this payment', tone: after > 0 ? 'danger' : null },
  ]
})

async function loadStatements() {
  statementsError.value = ''
  statementsLoading.value = true

  try {
    const response = await bloodCenterService.billingStatements(requestIdOf(documentsFor.value))
    statementList.value = response?.statements ?? []
    selectedRevisionId.value = revisionsNewestFirst.value[0]?.id ?? null
  } catch (err) {
    statementsError.value = err?.message || 'Could not load the statements.'
  } finally {
    statementsLoading.value = false
  }
}

async function loadReceipts() {
  receiptsError.value = ''
  receiptsLoading.value = true

  try {
    const response = await bloodCenterService.billingPayments(requestIdOf(documentsFor.value))
    receiptPayments.value = (response?.payments ?? [])
      .filter((p) => p.receipt)
      .sort((a, b) => b.receipt.id - a.receipt.id)
    selectedReceiptId.value = receiptPayments.value[0]?.receipt.id ?? null
  } catch (err) {
    receiptsError.value = err?.data?.message || err?.message || 'Could not load the receipts.'
  } finally {
    receiptsLoading.value = false
  }
}

async function openDocuments(statement, tab = 'statement') {
  documentsFor.value = statement
  docTab.value = tab
  statementList.value = []
  receiptPayments.value = []
  selectedRevisionId.value = null
  selectedReceiptId.value = null
  issueError.value = ''

  await Promise.all([loadStatements(), canSeePayments.value ? loadReceipts() : null])
}

function closeDocuments() {
  if (issuing.value) return
  documentsFor.value = null
}

async function issueStatement() {
  issuing.value = true
  issueError.value = ''

  try {
    const response = await bloodCenterService.issueStatement(requestIdOf(documentsFor.value))
    toast(
      response.created ? 'Statement Issued' : 'No Changes Since Last Statement',
      response.created ? 'success' : 'info',
      response.revision?.document_number,
    )
    await loadStatements()
  } catch (err) {
    issueError.value = err?.message || 'The statement could not be issued.'
  } finally {
    issuing.value = false
  }
}

function fetchPdf(doc) {
  return doc.kind === 'statement'
    ? bloodCenterService.downloadStatement(doc.id)
    : bloodCenterService.downloadReceipt(doc.id)
}

async function downloadCurrent() {
  const doc = currentDocument.value
  if (!doc) return
  downloadingId.value = `${doc.kind}-${doc.id}`

  try {
    saveBlob(await fetchPdf(doc), `${doc.name}.pdf`)
  } catch (err) {
    toast('Download Failed', 'danger', err?.message || 'The document could not be downloaded.')
  } finally {
    downloadingId.value = null
  }
}

// Opens the server's PDF in a new tab, where the browser's viewer prints it.
async function printDocument() {
  const doc = currentDocument.value
  if (!doc) return

  // Opened before the download, while the click still counts, so the browser
  // does not take it for a pop-up.
  const tab = window.open('', '_blank')
  printing.value = true

  try {
    const blob = await fetchPdf(doc)

    if (tab) {
      const url = URL.createObjectURL(blob)
      tab.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } else {
      saveBlob(blob, `${doc.name}.pdf`)
    }
  } catch (err) {
    tab?.close()
    toast('Print Failed', 'danger', err?.message || 'The document could not be opened.')
  } finally {
    printing.value = false
  }
}

/* GCASH CHECKOUT: the shared dialog polls the server and reports back */
const checkoutFor = ref(null)

function requestIdOf(statement) {
  return statement?.request?.id ?? statement?.request_id
}

onMounted(refreshAll)
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
.status--settled_outside { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }

.banner--info { background: rgba(var(--rb-primary-rgb), .06); color: var(--rb-text-primary); border: 1px solid rgba(var(--rb-primary-rgb), .2); }
.inline-link { color: var(--rb-primary-text); font-weight: 600; }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.header-actions .btn { text-decoration: none; }
.actions .btn { text-decoration: none; }
.payment-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
.payment-row--voided .payment-main strong { text-decoration: line-through; color: var(--rb-text-muted); }
.voided-tag { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 5px; font-size: 10.5px; font-weight: 700; text-decoration: none; background: var(--rb-surface-hover); color: var(--rb-text-secondary); }

/* Category: who owes it */
.category-switch { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.category {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 12px 14px; text-align: left;
  font-family: inherit; cursor: pointer; border-radius: 12px;
  background: var(--rb-surface); border: 1px solid var(--rb-border); color: var(--rb-text-primary);
}
.category strong { font-size: 14px; }
.category span { font-size: 12px; color: var(--rb-text-secondary); }
.category--on { border-color: var(--rb-primary); box-shadow: inset 0 0 0 1px var(--rb-primary); background: rgba(var(--rb-primary-rgb), .04); }
.settlement-cell { font-size: 12.5px; display: flex; flex-direction: column; gap: 2px; }

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
.modal--wide { max-width: 980px; padding: 22px 24px; }
.docs-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; margin-bottom: 4px; }
.doc-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-bottom: 14px; }
.doc-toolbar .input--select { width: auto; min-width: 300px; max-width: 100%; }
.doc-toolbar .field-hint { flex-basis: 100%; }
.doc-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
.skeleton--doc { height: 360px; }
.empty--compact { padding: 32px 16px; }
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
.toast { background: var(--rb-surface); border: 1px solid var(--rb-border-strong); border-radius: 10px; padding: 11px 15px; min-width: 250px; box-shadow: 0 6px 20px rgba(var(--rb-shadow-rgb), .1); }
.toast-title { font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.toast--success .toast-title { color: var(--rb-success-text); }
.toast--danger .toast-title { color: var(--rb-accent-text); }
.toast--info .toast-title { color: var(--rb-primary-text); }
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

@media (max-width: 640px) {
  .doc-metrics { grid-template-columns: 1fr; }
  .doc-toolbar .input--select { min-width: 0; width: 100%; }
  .modal-actions { flex-wrap: wrap; }
}

@media (max-width: 900px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .bl-table { font-size: 12px; }
  .bl-table th, .bl-table td { padding: 9px 8px; }
  .actions { flex-direction: column; }
}
</style>
