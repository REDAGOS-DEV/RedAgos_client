<template>
  <div class="st-page">
    <div class="st-inner">
      <div class="toast-stack" aria-live="polite">
        <transition-group name="toast">
          <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.variant}`">
            <div class="toast-title">{{ t.title }}</div>
            <div v-if="t.message" class="toast-message">{{ t.message }}</div>
          </div>
        </transition-group>
      </div>

      <nav class="crumbs">
        <NuxtLink to="/blood-center/billing">Statements</NuxtLink>
        <AssetIcon name="chevron-right" :size="14" />
        <span aria-current="page">{{ statement?.request?.reference_number || 'Statement' }}</span>
      </nav>

      <div v-if="loading" class="skeleton-stack">
        <div class="skeleton skeleton--head" />
        <div class="skeleton skeleton--facts" />
        <div class="skeleton skeleton--doc" />
      </div>

      <div v-else-if="loadError" class="empty card">
        <AssetIcon name="triangle-alert" :size="30" />
        <h2>This statement could not be opened</h2>
        <p>{{ loadError }}</p>
        <div class="empty-actions">
          <NuxtLink to="/blood-center/billing" class="ui-btn">Back to statements</NuxtLink>
          <button class="ui-btn ui-btn--primary" @click="loadAll">Try again</button>
        </div>
      </div>

      <template v-else-if="statement">
        <!-- HEADER: the document, its number and where it stands -->
        <header class="doc-header">
          <div class="doc-heading">
            <h1 class="kicker">Statement of Account</h1>
            <p class="page-title" :class="{ mono: latestRevision }">{{ latestRevision?.document_number || 'Not issued yet' }}</p>
            <div class="doc-meta">
              <BillingBadge :tone="stamp.tone">{{ statement.status_label }}</BillingBadge>
              <BillingBadge v-if="statement.request?.is_emergency" tone="danger">STAT</BillingBadge>
              <span v-if="latestRevision" class="doc-meta-text">Revision {{ latestRevision.revision_number }} · issued {{ when(latestRevision.issued_at) }}</span>
            </div>
          </div>
          <div class="header-actions">
            <button class="ui-btn" :disabled="!selectedRevision || printing" @click="printRevision">
              <AssetIcon name="printer" :size="15" />
              {{ printing ? 'Opening…' : 'Print' }}
            </button>
            <button class="ui-btn" :disabled="!selectedRevision || downloading" @click="downloadRevision">
              <AssetIcon name="download" :size="15" />
              Download PDF
            </button>
            <button v-if="canSeePayments" class="ui-btn" :disabled="issuing" @click="issueStatement">
              <AssetIcon name="file-text" :size="15" />
              {{ issuing ? 'Issuing…' : latestRevision ? 'Issue updated statement' : 'Issue statement' }}
            </button>
            <NuxtLink v-if="canSeePayments && takes" :to="`/blood-center/pos?request=${requestId}`" class="ui-btn ui-btn--primary">
              <AssetIcon name="credit-card" :size="15" />
              Take payment
            </NuxtLink>
          </div>
        </header>

        <p v-if="staleRevision" class="banner banner--warn">
          <AssetIcon name="info" :size="15" />
          <span>
            The bill has changed since {{ latestRevision.document_number }} was issued.
            <template v-if="canSeePayments">Issue an updated statement before handing one over.</template>
          </span>
        </p>
        <p v-if="issueError" class="banner banner--error">
          <AssetIcon name="triangle-alert" :size="15" />
          <span>{{ issueError }}</span>
        </p>

        <div class="view-switch" role="tablist" aria-label="View">
          <button role="tab" class="view-tab" :class="{ 'view-tab--on': view === 'details' }" :aria-selected="view === 'details'" @click="view = 'details'">
            Details
          </button>
          <button
            role="tab"
            class="view-tab"
            :class="{ 'view-tab--on': view === 'printed' }"
            :aria-selected="view === 'printed'"
            :disabled="!revisions.length"
            :title="revisions.length ? '' : 'Issue a statement to see it as it prints'"
            @click="view = 'printed'"
          >
            As printed
          </button>
        </div>

        <!-- AS PRINTED: the issued revision, frozen -->
        <section v-if="view === 'printed' && selectedRevision" class="printed">
          <div class="printed-bar">
            <label for="st-revision" class="field-label">Revision</label>
            <div class="printed-select">
              <SelectField
                id="st-revision"
                :model-value="String(selectedRevisionId ?? '')"
                :options="revisionOptions"
                icon="file-text"
                size="sm"
                @update:model-value="(v) => (selectedRevisionId = Number(v))"
              />
            </div>
          </div>
          <BillingDocument :revision="selectedRevision" />
        </section>

        <!-- DETAILS: the bill on the left, what can be done about it on the right -->
        <div v-else class="layout">
          <div class="main-col">
            <!-- WHO OWES IT, FOR WHAT, AND WHO ISSUED IT -->
            <section class="card summary" aria-labelledby="billto-title">
              <div class="summary-head">
                <p class="cap">{{ weekly ? 'Bill to' : 'Bill to / patient' }}</p>
                <h2 id="billto-title" class="summary-name">
                  {{ weekly ? (statement.request?.requesting_facility || 'Requesting hospital') : (statement.request?.patient_name || 'Patient') }}
                </h2>
                <p class="summary-sub">
                  <template v-if="weekly">Requesting hospital</template>
                  <template v-else-if="statement.request?.requesting_facility">c/o {{ statement.request.requesting_facility }}</template>
                </p>
              </div>

              <div class="summary-grid">
                <dl class="kv-list" :aria-label="weekly ? 'Bill to' : 'Bill to / patient'">
                  <div v-for="row in shown(billToRows).filter((r) => r.label !== 'Patient' && r.label !== 'Hospital')" :key="row.label" class="kv-row">
                    <dt>{{ row.label }}</dt>
                    <dd :class="{ mono: row.mono }">{{ row.value }}</dd>
                  </div>
                </dl>
                <dl class="kv-list" aria-label="Statement details">
                  <div v-for="row in shown(detailRows)" :key="row.label" class="kv-row">
                    <dt>{{ row.label }}</dt>
                    <dd :class="{ mono: row.mono }">{{ row.value }}</dd>
                  </div>
                </dl>
              </div>

              <footer class="issuer-strip" aria-label="Issued by">
                <img v-if="issuer.logo_url && !logoFailed" :src="issuer.logo_url" alt="" class="issuer-logo" @error="logoFailed = true">
                <span v-else class="monogram" aria-hidden="true">
                  <template v-if="facilityInitials(issuer.name)">{{ facilityInitials(issuer.name) }}</template>
                  <AssetIcon v-else name="building-2" :size="16" />
                </span>
                <div class="issuer-text">
                  <p><span class="issuer-label">Issued by</span> <strong>{{ issuer.name || 'Blood centre' }}</strong></p>
                  <p class="issuer-rows">
                    <span v-for="row in shown(issuerRows)" :key="row.label">{{ row.label === 'DOH licence' ? `DOH licence ${row.value}` : row.value }}</span>
                  </p>
                </div>
              </footer>
            </section>

            <section class="card" aria-labelledby="lines-title">
              <div class="card-head">
                <h2 id="lines-title" class="card-title">Blood components</h2>
                <p class="card-hint">The units held for this request, at this centre's prices.</p>
              </div>
              <BillingLines :lines="statement.lines" :totals="totalRows" />
            </section>

            <!-- PAYMENT HISTORY, or a weekly bill's settlement -->
            <section class="card" aria-labelledby="history-title">
              <div class="card-head">
                <h2 id="history-title" class="card-title">{{ weekly ? 'Settlement' : 'Payment history' }}</h2>
                <p v-if="!weekly" class="card-hint">Every payment stays on record. A mistake is corrected or voided on approval, never deleted.</p>
              </div>

              <template v-if="weekly">
                <dl v-if="statement.settlement" class="settled">
                  <div><dt>Settled on</dt><dd>{{ day(statement.settlement.settled_at) }}</dd></div>
                  <div><dt>Hospital's reference</dt><dd class="mono">{{ statement.settlement.reference }}</dd></div>
                  <div v-if="statement.settlement.note"><dt>Note</dt><dd>{{ statement.settlement.note }}</dd></div>
                </dl>
                <p v-else class="quiet">
                  Weekly orders are billed to {{ statement.request?.requesting_facility || 'the hospital' }} by statement and settled
                  outside RedAgos. Record the settlement here once the hospital pays.
                </p>
              </template>

              <template v-else-if="!canSeePayments">
                <p class="quiet">Payments carry reference numbers, so only billing staff see them. Collected so far: <strong>{{ pesos(statement.collected) }}</strong>.</p>
              </template>

              <template v-else>
                <div v-if="paymentsLoading" class="skeleton skeleton--row" />
                <p v-else-if="paymentsError" class="field-error">{{ paymentsError }}</p>
                <div v-else-if="!payments.length" class="empty empty--inline">
                  <AssetIcon name="receipt" :size="26" />
                  <p>No payment has been taken on this bill.</p>
                </div>
                <div v-else class="table-scroll">
                  <table class="history">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Method</th>
                        <th scope="col" class="num">Amount</th>
                        <th scope="col">Reference</th>
                        <th scope="col">Receipt</th>
                        <th scope="col">Status</th>
                        <th scope="col"><span class="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      <template v-for="p in payments" :key="p.id">
                        <tr :class="{ 'row--voided': p.status === 'voided' }">
                          <td>{{ when(p.payment_date) }}</td>
                          <td>
                            {{ p.payment_method_label }}
                            <span class="sub">{{ p.source_label }}</span>
                          </td>
                          <td class="num strong">{{ pesos(p.amount_paid) }}</td>
                          <td>
                            <span class="mono">{{ p.reference_number || '—' }}</span>
                            <span v-if="p.additional_information" class="sub" title="Additional information">{{ p.additional_information }}</span>
                          </td>
                          <td>
                            <NuxtLink v-if="p.receipt" :to="`/blood-center/receipt/${p.receipt.id}`" class="link mono">{{ p.receipt.receipt_number }}</NuxtLink>
                            <span v-else class="muted">—</span>
                          </td>
                          <td>
                            <BillingBadge v-if="p.status === 'voided'" tone="muted">Voided</BillingBadge>
                            <BillingBadge v-else-if="p.pending_void" tone="warning">Void pending</BillingBadge>
                            <BillingBadge v-else-if="p.pending_correction" tone="warning">Correction pending</BillingBadge>
                            <BillingBadge v-else tone="success">Completed</BillingBadge>
                          </td>
                          <td class="row-actions">
                            <button
                              v-if="canCorrectPayment && p.can_request_correction && !p.pending_correction && !p.pending_void"
                              type="button"
                              class="ui-btn ui-btn--ghost ui-btn--sm"
                              @click="openPaymentCorrection(p)"
                            >
                              Correct
                            </button>
                            <button
                              v-if="canVoidPayment && p.can_request_void && !p.pending_correction && !p.pending_void"
                              type="button"
                              class="ui-btn ui-btn--ghost ui-btn--sm btn-ghost--danger"
                              @click="openVoid(p)"
                            >
                              Void
                            </button>
                          </td>
                        </tr>

                        <!-- Correcting this payment: the change is reviewed, then decided by the Billing Supervisor. -->
                        <tr v-if="editingPayment?.id === p.id" class="row-form">
                          <td colspan="7">
                            <div class="inline-form">
                              <p class="inline-title">Correct this payment</p>
                              <div class="inline-fields">
                                <label class="field">
                                  <span class="field-label">Amount received</span>
                                  <input v-model.number="fix.amount_paid" type="number" step="0.01" min="0.01" class="input">
                                </label>
                                <div class="field">
                                  <span class="field-label">Method</span>
                                  <div class="segmented" role="radiogroup" aria-label="Method">
                                    <label v-for="m in CORRECTABLE_METHODS" :key="m.value" class="segment" :class="{ 'segment--on': fix.payment_method === m.value }">
                                      <input v-model="fix.payment_method" type="radio" :value="m.value" class="sr-only">
                                      {{ m.label }}
                                    </label>
                                  </div>
                                </div>
                                <label v-if="needsReference(fix.payment_method)" class="field">
                                  <span class="field-label">{{ referenceName(fix.payment_method) }}</span>
                                  <input v-model.trim="fix.reference_number" type="text" maxlength="100" class="input mono">
                                </label>
                              </div>
                              <p v-if="fixError" class="field-error">{{ fixError }}</p>
                              <div class="inline-actions">
                                <button type="button" class="ui-btn ui-btn--sm" @click="closePaymentCorrection">Cancel</button>
                                <button type="button" class="ui-btn ui-btn--primary ui-btn--sm" @click="reviewPaymentCorrection">Review correction</button>
                              </div>
                            </div>
                          </td>
                        </tr>

                        <!-- Voiding it: only on the day it was taken, decided by the Billing Supervisor. -->
                        <tr v-if="voidFor?.id === p.id" class="row-form">
                          <td colspan="7">
                            <div class="inline-form">
                              <p class="inline-title">Request a void</p>
                              <p class="inline-hint">
                                For a payment recorded in error, or money handed straight back, on the day it was taken.
                                After that, money given back is a refund, settled outside RedAgos.
                              </p>
                              <label class="field">
                                <span class="field-label">Why is it being voided?</span>
                                <input v-model.trim="voidReason" type="text" maxlength="1000" class="input" placeholder="e.g. Charged to the wrong patient">
                              </label>
                              <p v-if="voidError" class="field-error">{{ voidError }}</p>
                              <div class="inline-actions">
                                <button type="button" class="ui-btn ui-btn--sm" :disabled="saving" @click="voidFor = null">Cancel</button>
                                <button type="button" class="ui-btn ui-btn--danger ui-btn--sm" :disabled="saving || voidReason.length < 3" @click="submitVoid">
                                  {{ saving ? 'Sending…' : 'Request void' }}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                </div>
              </template>
            </section>
          </div>

          <aside class="rail">
            <!-- PAYMENT INFORMATION: what is owed, and what can be done about it -->
            <section class="card pay-card" aria-labelledby="pay-title">
              <h2 id="pay-title" class="card-title">{{ weekly ? 'Hospital settlement' : 'Payment information' }}</h2>

              <div class="due" :class="`due--${dueTone}`">
                <span class="due-label">{{ dueLabel }}</span>
                <strong class="due-amount">{{ pesos(weekly ? statement.total_amount : totals.balance) }}</strong>
                <small v-if="dueNote" class="due-note">{{ dueNote }}</small>
                <!-- How much of the bill is in: shown only on a patient bill with something to collect. -->
                <div v-if="paidShare !== null" class="due-meter">
                  <div class="meter" role="img" :aria-label="`${pesos(totals.paid)} of ${pesos(totals.subtotal)} paid`">
                    <span :style="{ width: `${paidShare}%` }" />
                  </div>
                  <p>{{ pesos(totals.paid) }} of {{ pesos(totals.subtotal) }} paid</p>
                </div>
              </div>

              <dl v-if="lastPayment" class="last-payment">
                <div><dt>Last payment</dt><dd>{{ pesos(lastPayment.amount_paid) }} · {{ lastPayment.payment_method_label }}</dd></div>
                <div><dt>Received</dt><dd>{{ when(lastPayment.payment_date) }}</dd></div>
                <div v-if="lastPayment.reference_number"><dt>Reference</dt><dd class="mono">{{ lastPayment.reference_number }}</dd></div>
                <div v-if="lastPayment.additional_information"><dt>Additional information</dt><dd>{{ lastPayment.additional_information }}</dd></div>
              </dl>

              <!-- Patient bill: take the money at the counter, by QR, or waive it. -->
              <template v-if="!weekly && canSeePayments && takes">
                <div class="pay-actions">
                  <NuxtLink :to="`/blood-center/pos?request=${requestId}`" class="ui-btn ui-btn--primary btn-block">
                    <AssetIcon name="credit-card" :size="15" />
                    Take payment at the counter
                  </NuxtLink>
                  <button class="ui-btn btn-block" @click="checkoutOpen = true">
                    <AssetIcon name="qr-code" :size="15" />
                    GCash QR
                  </button>
                  <button v-if="!subsidyOpen" class="ui-btn ui-btn--ghost btn-block" @click="openSubsidy">
                    Apply government subsidy
                  </button>
                </div>

                <div v-if="subsidyOpen" class="inline-form">
                  <p class="inline-title">Apply the government subsidy</p>
                  <p class="inline-hint">
                    Waives the whole {{ pesos(statement.total_amount) }} and clears the request for release. No payment is recorded.
                    <template v-if="Number(statement.collected) > 0">
                      The {{ pesos(statement.collected) }} already collected stays on record; any refund is settled outside RedAgos.
                    </template>
                  </p>
                  <label class="field">
                    <span class="field-label">Reason <span class="optional">(optional)</span></span>
                    <input v-model.trim="subsidyReason" type="text" maxlength="255" class="input" placeholder="e.g. DOH allocation">
                  </label>
                  <p v-if="subsidyError" class="field-error">{{ subsidyError }}</p>
                  <div class="inline-actions">
                    <button class="ui-btn ui-btn--sm" :disabled="saving" @click="subsidyOpen = false">Cancel</button>
                    <button class="ui-btn ui-btn--primary ui-btn--sm" :disabled="saving" @click="submitSubsidy">
                      {{ saving ? 'Applying…' : 'Apply subsidy' }}
                    </button>
                  </div>
                </div>
              </template>

              <!-- Weekly bill: record the hospital's settlement, once its total is final. -->
              <template v-else-if="weekly && canSeePayments && statement.status === 'statement_only'">
                <p v-if="!statement.request?.is_closed" class="quiet">
                  The order is still open, so its total can still change. Record the settlement once it closes.
                </p>
                <form v-else class="inline-form inline-form--flat" @submit.prevent="submitSettlement">
                  <label class="field">
                    <span class="field-label">Hospital's payment reference</span>
                    <input v-model.trim="settlement.settlement_reference" type="text" maxlength="100" class="input mono" placeholder="Cheque or transfer number" required>
                    <span v-if="settlementErrors.settlement_reference" class="field-error">{{ settlementErrors.settlement_reference }}</span>
                  </label>
                  <div class="field">
                    <label for="st-settled-at" class="field-label">Date settled</label>
                    <DatePicker id="st-settled-at" v-model="settlement.settled_at" :max="todayIso" :invalid="Boolean(settlementErrors.settled_at)" aria-label="Date settled" />
                    <span v-if="settlementErrors.settled_at" class="field-error">{{ settlementErrors.settled_at }}</span>
                  </div>
                  <label class="field">
                    <span class="field-label">Note <span class="optional">(optional)</span></span>
                    <input v-model.trim="settlement.settlement_note" type="text" maxlength="500" class="input">
                  </label>
                  <p v-if="settlementError" class="field-error">{{ settlementError }}</p>
                  <button type="submit" class="ui-btn ui-btn--primary btn-block" :disabled="saving || !settlement.settlement_reference">
                    {{ saving ? 'Recording…' : 'Record settlement' }}
                  </button>
                </form>
              </template>
            </section>

            <!-- ISSUED STATEMENTS: each revision frozen as it was handed over, newest first -->
            <section class="card" aria-labelledby="rev-title">
              <div class="card-head">
                <h2 id="rev-title" class="card-title">Issued statements</h2>
                <p class="card-hint">Each statement is frozen when it is issued. Issuing again after the bill changes adds a revision; earlier ones stay as they were.</p>
              </div>
              <div v-if="revisionsLoading" class="skeleton skeleton--row" />
              <p v-else-if="!revisions.length" class="quiet">
                No statement issued yet. {{ weekly ? 'Issue one to send this order to the hospital.' : 'Issue one to give the patient or their watcher the amount payable.' }}
              </p>
              <ol v-else class="revisions">
                <li v-for="(r, i) in revisions" :key="r.id" class="revision" :class="{ 'revision--latest': i === 0 }">
                  <span class="revision-dot" aria-hidden="true" />
                  <div class="revision-body">
                    <div class="revision-top">
                      <span class="mono strong">{{ r.document_number }}</span>
                      <span class="rev-chip">Rev. {{ r.revision_number }}</span>
                      <span v-if="i === 0" class="rev-chip rev-chip--latest">Latest</span>
                    </div>
                    <span class="sub">{{ when(r.issued_at) }}<template v-if="r.issued_by"> · {{ r.issued_by }}</template></span>
                    <div class="revision-foot">
                      <span class="revision-amount">{{ pesos(r.amount_due) }} <small>{{ r.statement_only ? 'billed' : 'due' }}</small></span>
                      <span class="revision-actions">
                        <button class="ui-btn ui-btn--ghost ui-btn--sm" @click="showRevision(r)">View</button>
                        <button class="ui-btn ui-btn--ghost ui-btn--sm" :disabled="downloading" @click="downloadRevision(r)">PDF</button>
                      </span>
                    </div>
                  </div>
                </li>
              </ol>
            </section>

            <section v-if="notes.length" class="card notes" aria-labelledby="notes-title">
              <h2 id="notes-title" class="card-title">
                <AssetIcon name="info" :size="15" />
                Notes
              </h2>
              <ul>
                <li v-for="note in notes" :key="note">{{ note }}</li>
              </ul>
            </section>
          </aside>
        </div>
      </template>
    </div>

    <GcashCheckoutDialog
      v-if="checkoutOpen && statement"
      :request-id="requestId"
      :heading="`${statement.request?.reference_number ?? ''} · ${statement.request?.patient_name || 'Patient'}`"
      :total="statement.total_amount"
      :collected="statement.collected"
      @close="checkoutOpen = false"
      @changed="loadAll"
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
/**
 * One statement, laid out as a document: who issued it, who owes it, what it
 * bills, what has been paid, and what can still be done about it.
 *
 * Laid out (2026-10-14) as the bill on the left — who owes it, the lines, the
 * payments — and, on the right, what is owed and what can be done about it,
 * with the issued revisions as a timeline beneath.
 *
 * The page reads the live statement; the issued Statements of Account are its
 * frozen revisions, shown as they print and downloaded as the server's PDF.
 * Taking money happens at the counter (or by GCash QR from here); everything
 * else that changes the bill — a subsidy, a weekly bill's settlement, a void
 * or a correction of a payment — is filed here and decided by the server.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import BillingDocument from '~/components/common/BillingDocument.vue'
import BillingBadge from '~/components/BloodCenter/BillingBadge.vue'
import BillingLines from '~/components/BloodCenter/BillingLines.vue'
import BloodCenterCorrectionRequestDialog from '~/components/BloodCenter/CorrectionRequestDialog.vue'
import GcashCheckoutDialog from '~/components/BloodCenter/GcashCheckoutDialog.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import SelectField from '~/components/common/SelectField.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { RECORDED_METHODS, facilityInitials, liveStatementTotals, needsReference, pesos, referenceName, saveBlob, statementStamp, takesPayment } from '~/utils/billing'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.view',
})

const route = useRoute()
const requestId = computed(() => Number(route.params.id))

const { can, canFile } = useUser()

// The payments, with their reference numbers, are served only to whoever may
// record them. Filing a correction to one also needs the ability to request it
// and the subject itself, which a custom role in the department lacks.
const canSeePayments = computed(() => can('billing.record_payment'))
const canCorrectPayment = computed(() => can('billing.record_payment') && can('corrections.request') && canFile('payment'))
const canVoidPayment = computed(() => can('billing.record_payment') && can('corrections.request') && canFile('payment_void'))

const CORRECTABLE_METHODS = RECORDED_METHODS

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

function when(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

function day(value) {
  if (!value) return '—'
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

/* THE STATEMENT */
const statement = ref(null)
const loading = ref(true)
const loadError = ref('')
const view = ref('details')
const issuerFallback = ref({ name: null, logo_url: null })
const logoFailed = ref(false)

const weekly = computed(() => Boolean(statement.value?.is_statement_only))
const takes = computed(() => (statement.value ? takesPayment(statement.value) : false))
const totals = computed(() => liveStatementTotals(statement.value ?? { status: 'unpaid', total_amount: 0, collected: 0, outstanding: '0' }))
const stamp = computed(() => statementStamp(statement.value?.status ?? 'unpaid'))

async function loadStatement() {
  const response = await bloodCenterService.billingForRequest(requestId.value)
  statement.value = response?.billing ?? null
}

/* ISSUED REVISIONS */
const revisions = ref([])
const revisionsLoading = ref(false)
const selectedRevisionId = ref(null)
const issuing = ref(false)
const issueError = ref('')

const latestRevision = computed(() => revisions.value[0] ?? null)
const selectedRevision = computed(() => revisions.value.find((r) => r.id === selectedRevisionId.value) ?? latestRevision.value)

// The live bill has moved on from the last statement handed over.
const staleRevision = computed(() => {
  const r = latestRevision.value
  const s = statement.value
  if (!r || !s) return false

  return Math.round(Number(r.total_amount) * 100) !== Math.round(Number(s.total_amount) * 100)
    || (!weekly.value && Math.round(Number(r.amount_due) * 100) !== Math.round(Number(s.outstanding) * 100))
})

async function loadRevisions() {
  revisionsLoading.value = true

  try {
    const response = await bloodCenterService.billingStatements(requestId.value)
    revisions.value = [...(response?.statements ?? [])].sort((a, b) => b.revision_number - a.revision_number)
    if (!revisions.value.some((r) => r.id === selectedRevisionId.value)) selectedRevisionId.value = revisions.value[0]?.id ?? null
  } finally {
    revisionsLoading.value = false
  }
}

async function issueStatement() {
  issuing.value = true
  issueError.value = ''

  try {
    const response = await bloodCenterService.issueStatement(requestId.value)
    toast(
      response.created ? 'Statement Issued' : 'No Changes Since Last Statement',
      response.created ? 'success' : 'info',
      response.revision?.document_number,
    )
    await loadRevisions()
    selectedRevisionId.value = revisions.value[0]?.id ?? null
  } catch (err) {
    issueError.value = err?.message || 'The statement could not be issued.'
  } finally {
    issuing.value = false
  }
}

// The revision picker above the printed view.
const revisionOptions = computed(() => revisions.value.map((r) => ({
  value: String(r.id),
  label: `${r.document_number} · Revision ${r.revision_number} · ${when(r.issued_at)}`,
})))

function showRevision(revision) {
  selectedRevisionId.value = revision.id
  view.value = 'printed'
}

/* PRINT AND DOWNLOAD: the server's PDF is the official copy */
const printing = ref(false)
const downloading = ref(false)

async function downloadRevision(revision = selectedRevision.value) {
  if (!revision?.id) return
  downloading.value = true

  try {
    saveBlob(await bloodCenterService.downloadStatement(revision.id), `${revision.document_number}.pdf`)
  } catch (err) {
    toast('Download Failed', 'danger', err?.message || 'The statement could not be downloaded.')
  } finally {
    downloading.value = false
  }
}

// Opens the PDF in a new tab, where the browser's viewer prints it.
async function printRevision() {
  const revision = selectedRevision.value
  if (!revision) return

  // Opened before the download, while the click still counts, so the browser
  // does not take it for a pop-up.
  const tab = window.open('', '_blank')
  printing.value = true

  try {
    const blob = await bloodCenterService.downloadStatement(revision.id)

    if (tab) {
      const url = URL.createObjectURL(blob)
      tab.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } else {
      saveBlob(blob, `${revision.document_number}.pdf`)
    }
  } catch (err) {
    tab?.close()
    toast('Print Failed', 'danger', err?.message || 'The statement could not be opened.')
  } finally {
    printing.value = false
  }
}

/* THE SUMMARY CARD: a row with no value is left out rather than shown as a dash */
function shown(rows) {
  return rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== '')
}

const issuer = computed(() => latestRevision.value?.issuer ?? issuerFallback.value)

const issuerRows = computed(() => [
  { label: 'Address', value: issuer.value?.address },
  { label: 'DOH licence', value: issuer.value?.doh_license_number },
  { label: 'Contact', value: [issuer.value?.phone, issuer.value?.email].filter(Boolean).join(' · ') },
])

const billToRows = computed(() => {
  const r = statement.value?.request

  if (weekly.value) {
    return [
      { label: 'Hospital', value: r?.requesting_facility },
      { label: 'Payable by', value: 'The hospital, by statement' },
    ]
  }

  return [
    { label: 'Patient', value: r?.patient_name || 'Patient' },
    { label: 'Hospital', value: r?.requesting_facility },
    { label: 'PTR reference', value: r?.transfusion_reference, mono: true },
    { label: 'Presented ref.', value: r?.presented_reference, mono: true },
    { label: 'Physician', value: r?.attending_physician },
    { label: 'Payable by', value: 'The patient or their watcher' },
  ]
})

const detailRows = computed(() => {
  const s = statement.value
  const r = s?.request
  const rev = latestRevision.value

  return [
    { label: 'Request', value: r?.reference_number, mono: true },
    { label: 'Type', value: r?.purpose_label },
    { label: 'Priority', value: r?.urgency_label },
    { label: 'Billed on', value: s?.billing_date ? day(s.billing_date) : null },
    { label: 'Issued', value: rev ? `${when(rev.issued_at)} · Rev. ${rev.revision_number}` : 'Not yet' },
    { label: 'Issued by', value: rev?.issued_by },
  ]
})

/* TOTALS AND THE DUE PANEL */
const totalRows = computed(() => {
  const t = totals.value

  if (weekly.value) {
    return [
      { label: 'Total billed', value: pesos(t.subtotal), emphasis: true, tone: statement.value?.is_settled_outside ? 'success' : undefined },
      ...(statement.value?.is_settled_outside ? [{ label: 'Settled by the hospital', value: day(statement.value.settlement?.settled_at) }] : []),
    ]
  }

  return [
    { label: 'Subtotal', value: pesos(t.subtotal) },
    ...(t.subsidy > 0 ? [{ label: 'Government subsidy', value: `− ${pesos(t.subsidy)}`, tone: 'purple' }] : []),
    { label: 'Paid to date', value: t.paid > 0 ? `− ${pesos(t.paid)}` : pesos(0) },
    { label: 'Balance due', value: pesos(t.balance), emphasis: true, tone: t.balance > 0 ? 'danger' : 'success' },
  ]
})

// How much of a patient bill is in, for the meter under the amount due.
const paidShare = computed(() => {
  const t = totals.value
  if (weekly.value || statement.value?.is_subsidised || !(t.subtotal > 0)) return null
  return Math.min(100, Math.round((t.paid / t.subtotal) * 100))
})

const dueTone = computed(() => {
  const s = statement.value
  if (weekly.value) return s?.is_settled_outside ? 'success' : 'info'
  if (s?.is_subsidised) return 'purple'
  return totals.value.balance > 0 ? 'danger' : 'success'
})

const dueLabel = computed(() => {
  const s = statement.value
  if (weekly.value) return s?.is_settled_outside ? 'Settled by the hospital' : 'Billed to the hospital'
  if (s?.is_subsidised) return 'Met by the government subsidy'
  return totals.value.balance > 0 ? 'Balance due' : 'Paid in full'
})

const dueNote = computed(() => {
  const s = statement.value
  if (weekly.value) return s?.is_settled_outside ? `Reference ${s.settlement?.reference ?? '—'}` : 'Settled outside RedAgos'
  if (s?.is_subsidised) return 'Nothing is collected at the counter'
  if (totals.value.balance > 0) return s?.clears_release ? 'Units already released' : 'Blood is held until it is paid'
  return s?.clears_release ? 'Cleared for release' : ''
})

const notes = computed(() => {
  const s = statement.value
  if (!s) return []
  const list = []

  if (s.is_subsidised && Number(s.collected) > 0) {
    list.push(`${pesos(s.collected)} was collected before the subsidy was applied. It stays on record; any refund is settled outside RedAgos.`)
  }
  if (s.settlement?.note) list.push(s.settlement.note)
  if (!weekly.value && canSeePayments.value) list.push('Refunds are settled outside RedAgos. A payment can be voided only on the day it was taken.')

  return list
})

/* PAYMENTS */
const payments = ref([])
const paymentsLoading = ref(false)
const paymentsError = ref('')

const lastPayment = computed(() => payments.value.find((p) => p.status !== 'voided') ?? null)

async function loadPayments() {
  if (!canSeePayments.value || weekly.value) return
  paymentsLoading.value = true
  paymentsError.value = ''

  try {
    const response = await bloodCenterService.billingPayments(requestId.value)
    payments.value = [...(response?.payments ?? [])].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
  } catch (err) {
    paymentsError.value = err?.data?.message || err?.message || 'Could not load the payments.'
  } finally {
    paymentsLoading.value = false
  }
}

/* CORRECT A PAYMENT: reviewed in the shared dialog, decided on approval */
const saving = ref(false)
const editingPayment = ref(null)
const paymentCorrection = ref(null)
const fixError = ref('')
const fix = reactive({ amount_paid: null, payment_method: 'cash', reference_number: '' })

function openPaymentCorrection(payment) {
  voidFor.value = null
  fixError.value = ''
  Object.assign(fix, {
    amount_paid: Number(payment.amount_paid),
    payment_method: payment.payment_method,
    reference_number: payment.reference_number ?? '',
  })
  editingPayment.value = payment
}

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

  if (needsReference(fix.payment_method) && !fix.reference_number) {
    fixError.value = 'A GCash, card or bank-transfer payment needs its reference number.'
    return
  }

  const changes = {
    amount_paid: Number(fix.amount_paid),
    payment_method: fix.payment_method,
    reference_number: needsReference(fix.payment_method) ? fix.reference_number : null,
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
  await loadPayments()
}

/* VOID A PAYMENT, decided by the Billing Supervisor */
const voidFor = ref(null)
const voidReason = ref('')
const voidError = ref('')

function openVoid(payment) {
  editingPayment.value = null
  voidFor.value = payment
  voidReason.value = ''
  voidError.value = ''
}

async function submitVoid() {
  voidError.value = ''
  saving.value = true

  try {
    const response = await bloodCenterService.requestPaymentVoid(voidFor.value.id, voidReason.value)
    toast('Void Requested', 'success', response?.message ?? 'It is applied once the Billing Supervisor approves it.')
    voidFor.value = null
    await loadPayments()
  } catch (err) {
    voidError.value = err?.message || 'The void could not be requested.'
  } finally {
    saving.value = false
  }
}

/* APPLY THE GOVERNMENT SUBSIDY */
const subsidyOpen = ref(false)
const subsidyReason = ref('')
const subsidyError = ref('')

function openSubsidy() {
  subsidyOpen.value = true
  subsidyReason.value = ''
  subsidyError.value = ''
}

async function submitSubsidy() {
  subsidyError.value = ''
  saving.value = true

  try {
    await bloodCenterService.applySubsidy(requestId.value, subsidyReason.value || undefined)
    toast('Subsidy Applied', 'success', 'The bill is met by government funding and the units can be released.')
    subsidyOpen.value = false
    await loadStatement()
  } catch (err) {
    subsidyError.value = err?.message || 'Could not apply the subsidy.'
  } finally {
    saving.value = false
  }
}

/* RECORD A WEEKLY BILL'S SETTLEMENT. No money moves through RedAgos. */
const settlement = reactive({ settlement_reference: '', settled_at: todayIso, settlement_note: '' })
const settlementErrors = reactive({})
const settlementError = ref('')

async function submitSettlement() {
  settlementError.value = ''
  Object.keys(settlementErrors).forEach((k) => delete settlementErrors[k])
  saving.value = true

  try {
    const response = await bloodCenterService.settleWeeklyBill(requestId.value, {
      settlement_reference: settlement.settlement_reference,
      settled_at: settlement.settled_at,
      settlement_note: settlement.settlement_note || null,
    })
    toast('Settlement Recorded', 'success', response?.message)
    await loadStatement()
  } catch (err) {
    Object.entries(err?.errors ?? {}).forEach(([key, messages]) => {
      settlementErrors[key] = Array.isArray(messages) ? messages[0] : messages
    })
    settlementError.value = err?.message || 'The settlement could not be recorded.'
  } finally {
    saving.value = false
  }
}

/* GCASH CHECKOUT: the shared dialog polls the server and reports back */
const checkoutOpen = ref(false)

async function loadIssuerFallback() {
  try {
    const summary = await bloodCenterService.billingSummary()
    issuerFallback.value = summary?.issuer ?? issuerFallback.value
  } catch {
    // The card falls back to "Blood centre"; nothing else depends on it.
  }
}

async function loadAll() {
  loading.value = !statement.value
  loadError.value = ''

  try {
    await loadStatement()
    await Promise.all([loadRevisions(), loadPayments(), latestRevision.value ? null : loadIssuerFallback()])
  } catch (err) {
    loadError.value = err?.status === 404 ? 'No statement was found for that request at this centre.' : (err?.message || 'Please try again.')
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.st-page { background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 24px var(--rb-gutter, 24px) 40px; }
.st-inner { max-width: var(--rb-content-max, 1600px); margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

.crumbs { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--rb-text-secondary); }
.crumbs a { color: var(--rb-text-secondary); text-decoration: none; }
.crumbs a:hover { color: var(--rb-primary-text); text-decoration: underline; text-underline-offset: 3px; }
.crumbs span[aria-current] { color: var(--rb-text-primary); font-weight: 600; font-family: var(--rb-font-mono); }

.doc-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.kicker { margin: 0; font-size: 11.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--rb-primary-text); }
.page-title { font-size: 24px; font-weight: 800; color: var(--rb-text-primary); margin: 4px 0 0; letter-spacing: -0.01em; }
.page-title.mono { letter-spacing: 0; }
.doc-meta { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.doc-meta-text { font-size: 12.5px; color: var(--rb-text-secondary); }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.header-actions .btn { text-decoration: none; }

.view-switch { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: var(--rb-surface-alt); border: 1px solid var(--rb-border); align-self: flex-start; }
.view-tab { padding: 6px 14px; border: 0; border-radius: 8px; background: transparent; font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.view-tab:hover:not(:disabled) { color: var(--rb-text-primary); }
.view-tab--on { background: var(--rb-surface); color: var(--rb-text-primary); box-shadow: var(--rb-shadow-sm); }
.view-tab:disabled { opacity: .5; cursor: not-allowed; }

/* The bill on the left; what is owed and what to do about it on the right. */
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 372px; gap: 16px; align-items: start; }
.main-col, .rail { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

.card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; padding: 18px; min-width: 0; }
.card-head { margin-bottom: 14px; }
.card-title { display: flex; align-items: center; gap: 7px; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.card-hint { font-size: 12.5px; color: var(--rb-text-secondary); margin: 3px 0 0; max-width: 75ch; }
.cap { margin: 0; font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--rb-text-secondary); }

/* Summary: who owes it as the headline, the details beneath, the issuer as a quiet footer. */
.summary { padding: 0; overflow: hidden; }
.summary-head { padding: 18px 20px 14px; }
.summary-name { margin: 4px 0 0; font-size: 20px; font-weight: 800; letter-spacing: -0.01em; color: var(--rb-text-primary); overflow-wrap: anywhere; }
.summary-sub { margin: 2px 0 0; font-size: 13px; color: var(--rb-text-secondary); }
.summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid var(--rb-border); }
.summary-grid .kv-list { padding: 14px 20px; }
.summary-grid .kv-list + .kv-list { border-left: 1px solid var(--rb-border); }
.kv-list { margin: 0; display: flex; flex-direction: column; gap: 7px; }
.kv-row { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 10px; font-size: 13px; }
.kv-row dt { color: var(--rb-text-secondary); }
.kv-row dd { margin: 0; color: var(--rb-text-primary); font-weight: 600; overflow-wrap: anywhere; }
.kv-row dd.mono { font-size: 12.5px; }

.issuer-strip { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-top: 1px solid var(--rb-border); background: var(--rb-surface-alt); }
.issuer-logo { width: 34px; height: 34px; object-fit: contain; border-radius: 8px; flex: none; }
.monogram {
  width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; flex: none;
  font-weight: 800; font-size: 12.5px; color: #fff; background: var(--rb-primary);
}
.issuer-text { min-width: 0; }
.issuer-text p { margin: 0; font-size: 12.5px; color: var(--rb-text-primary); }
.issuer-label { color: var(--rb-text-secondary); }
.issuer-rows { display: flex; flex-wrap: wrap; gap: 2px 14px; margin-top: 2px !important; color: var(--rb-text-secondary) !important; font-size: 12px !important; }

.table-scroll { overflow-x: auto; }
.history { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.history th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--rb-text-secondary); padding: 8px 10px; border-bottom: 1px solid var(--rb-border); white-space: nowrap; }
.history td { padding: 10px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); vertical-align: middle; }
.history tbody tr:last-child td { border-bottom: 0; }
.history .sub { display: block; font-size: 11.5px; color: var(--rb-text-secondary); }
.row--voided td { color: var(--rb-text-muted); }
.row--voided .strong { text-decoration: line-through; }
.row-actions { text-align: right; white-space: nowrap; }
.row-form td { background: var(--rb-surface-alt); }

.inline-form { display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 12px; border: 1px solid var(--rb-border-strong); background: var(--rb-surface); }
.inline-form--flat { padding: 0; border: 0; }
.inline-title { margin: 0; font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); }
.inline-hint { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); max-width: 70ch; }
.inline-fields { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
.inline-fields .field { min-width: 160px; }
.inline-actions { display: flex; justify-content: flex-end; gap: 8px; }

/* Payment rail: the amount owed is the first thing on the page's right. */
.pay-card { display: flex; flex-direction: column; gap: 14px; }
.due { display: flex; flex-direction: column; gap: 2px; padding: 16px 18px; border-radius: 12px; border: 1px solid; }
.due-label { font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.due-amount { font-size: 30px; font-weight: 800; line-height: 1.15; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.due-note { font-size: 12px; color: var(--rb-text-secondary); }
.due-meter { margin-top: 10px; }
.due-meter p { margin: 5px 0 0; font-size: 11.5px; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.meter { height: 6px; border-radius: 999px; background: rgba(var(--rb-shadow-rgb, 15, 23, 42), .08); overflow: hidden; }
.meter span { display: block; height: 100%; border-radius: inherit; background: var(--rb-success, #2E7D32); }
.due--danger { background: rgba(var(--rb-accent-rgb), .05); border-color: rgba(var(--rb-accent-rgb), .2); }
.due--danger .due-label, .due--danger .due-amount { color: var(--rb-accent-text); }
.due--success { background: rgba(var(--rb-success-rgb), .07); border-color: rgba(var(--rb-success-rgb), .25); }
.due--success .due-label { color: var(--rb-success-text); }
.due--purple { background: rgba(var(--rb-purple-rgb), .07); border-color: rgba(var(--rb-purple-rgb), .25); }
.due--purple .due-label { color: var(--rb-purple-text); }
.due--info { background: rgba(var(--rb-primary-rgb), .06); border-color: rgba(var(--rb-primary-rgb), .2); }
.due--info .due-label { color: var(--rb-primary-text); }

.last-payment, .settled { margin: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.last-payment { padding-bottom: 2px; }
.last-payment div, .settled div { display: flex; justify-content: space-between; gap: 12px; }
.last-payment dt, .settled dt { color: var(--rb-text-secondary); }
.last-payment dd, .settled dd { margin: 0; font-weight: 600; color: var(--rb-text-primary); text-align: right; }
.pay-actions { display: flex; flex-direction: column; gap: 8px; padding-top: 14px; border-top: 1px solid var(--rb-border); }

/* Issued statements as a timeline, newest on top. */
.revisions { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.revision { position: relative; display: grid; grid-template-columns: 14px minmax(0, 1fr); gap: 10px; padding-bottom: 14px; }
.revision:last-child { padding-bottom: 0; }
.revision::before { content: ''; position: absolute; left: 6px; top: 16px; bottom: 0; width: 2px; background: var(--rb-border); }
.revision:last-child::before { display: none; }
.revision-dot { width: 14px; height: 14px; margin-top: 3px; border-radius: 50%; border: 2px solid var(--rb-border-strong); background: var(--rb-surface); box-sizing: border-box; }
.revision--latest .revision-dot { border-color: var(--rb-primary); background: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), .15); }
.revision-body { min-width: 0; font-size: 13px; }
.revision-top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.rev-chip { padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 700; color: var(--rb-text-secondary); background: var(--rb-surface-alt); border: 1px solid var(--rb-border); }
.rev-chip--latest { color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .08); border-color: rgba(var(--rb-primary-rgb), .2); }
.revision .sub { display: block; font-size: 12px; color: var(--rb-text-secondary); margin-top: 2px; }
.revision-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px; }
.revision-amount { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.revision-amount small { font-weight: 500; color: var(--rb-text-secondary); }
.revision-actions { display: inline-flex; gap: 2px; }

.notes { background: var(--rb-surface-alt); }
.notes .card-title { font-size: 13.5px; color: var(--rb-text-secondary); }
.notes ul { margin: 8px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; color: var(--rb-text-secondary); }

.printed { display: flex; flex-direction: column; gap: 12px; }
.printed-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.printed-select { width: 400px; max-width: 100%; }

.quiet { margin: 0; font-size: 13px; color: var(--rb-text-secondary); max-width: 70ch; }
.quiet strong { color: var(--rb-text-primary); }
.mono { font-family: var(--rb-font-mono); }
.strong { font-weight: 700; }
.num { text-align: right !important; white-space: nowrap; }
.muted { color: var(--rb-text-muted); }
.link { color: var(--rb-primary-text); text-decoration: none; font-weight: 600; }
.link:hover { text-decoration: underline; text-underline-offset: 3px; }

.field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.optional { color: var(--rb-text-muted); font-weight: 400; }
.field-error { font-size: 12px; color: var(--rb-accent-text); margin: 0; }
.input {
  width: 100%; padding: 9px 11px; font-size: 13.5px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.segmented { display: inline-flex; gap: 2px; padding: 3px; border-radius: 9px; border: 1px solid var(--rb-border-strong); }
.segment { padding: 6px 12px; border-radius: 7px; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.segment--on { background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }
.segment:focus-within { box-shadow: var(--rb-focus-ring); }

.banner { display: flex; align-items: flex-start; gap: 9px; padding: 11px 14px; border-radius: 10px; font-size: 13px; margin: 0; }
.banner--warn { background: rgba(var(--rb-warning-rgb), .1); color: var(--rb-warning-text); border: 1px solid rgba(var(--rb-warning-rgb), .3); }
.banner--error { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .25); }

.empty { text-align: center; padding: 48px 20px; color: var(--rb-text-secondary); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty h2 { font-size: 16px; color: var(--rb-text-primary); margin: 4px 0 0; }
.empty p { font-size: 13px; margin: 0; }
.empty--inline { padding: 22px 12px; }
.empty-actions { display: flex; gap: 8px; margin-top: 8px; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 14px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 9px; cursor: pointer; white-space: nowrap; text-decoration: none;
  transition: background-color .15s var(--rb-ease-out), border-color .15s var(--rb-ease-out);
}
.btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.btn-primary { background: var(--rb-primary); color: #fff; border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: #10509c; }
.btn-outline { background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn-ghost { background: transparent; color: var(--rb-primary-text); border: 1px solid transparent; }
.btn-ghost:hover:not(:disabled) { background: rgba(var(--rb-primary-rgb), .07); }
.btn-ghost--danger { color: var(--rb-accent-text); }
.btn-ghost--danger:hover:not(:disabled) { background: rgba(var(--rb-accent-rgb), .07); }
.btn-danger { background: var(--rb-accent); color: #fff; border: 1px solid var(--rb-accent); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-block { width: 100%; }

.skeleton-stack { display: flex; flex-direction: column; gap: 12px; }
.skeleton {
  border-radius: 12px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
.skeleton--head { height: 64px; }
.skeleton--facts { height: 150px; }
.skeleton--doc { height: 320px; }
.skeleton--row { height: 44px; }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

.toast-stack { position: fixed; top: 18px; right: 18px; z-index: 120; display: flex; flex-direction: column; gap: 8px; }
.toast { background: var(--rb-surface); border: 1px solid var(--rb-border-strong); border-radius: 10px; padding: 11px 15px; min-width: 250px; box-shadow: 0 6px 20px rgba(var(--rb-shadow-rgb), .1); }
.toast-title { font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.toast--success .toast-title { color: var(--rb-success-text); }
.toast--danger .toast-title { color: var(--rb-accent-text); }
.toast--info .toast-title { color: var(--rb-primary-text); }
.toast-message { font-size: 12px; color: var(--rb-text-secondary); margin-top: 2px; }
.toast-enter-active, .toast-leave-active { transition: opacity .2s, transform .2s var(--rb-ease-out); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(14px); }

.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .toast-enter-active, .toast-leave-active, .btn { transition: none; }
}

@media (max-width: 1180px) {
  .layout { grid-template-columns: 1fr; }
}

@media (max-width: 860px) {
  .summary-grid { grid-template-columns: 1fr; }
  .summary-grid .kv-list + .kv-list { border-left: 0; border-top: 1px solid var(--rb-border); }
  .doc-header { align-items: flex-start; }
}
</style>
