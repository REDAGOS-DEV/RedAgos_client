<template>
  <div class="pos">
    <div class="toast-stack" aria-live="polite">
      <transition-group name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.variant}`">
          <div class="toast-title">{{ t.title }}</div>
          <div v-if="t.message" class="toast-message">{{ t.message }}</div>
        </div>
      </transition-group>
    </div>

    <!-- SHIFT BAR: only when the counter works in cash shifts (off by default) -->
    <section v-if="shiftsEnabled" class="shift-bar" :class="{ 'shift-bar--open': shift }" aria-label="Cash shift">
      <template v-if="shift">
        <span class="shift-dot" aria-hidden="true" />
        <strong>Shift {{ shift.session_number }}</strong>
        <span class="muted">since {{ formatTime(shift.opened_at) }} · expected in drawer {{ pesos(shift.figures?.expected_cash) }}</span>
        <span class="spacer" />
        <button class="btn btn-outline btn-sm" :disabled="downloadingShift" @click="downloadShift">X reading</button>
        <button class="btn btn-outline btn-sm" @click="closingShift = true">Close shift</button>
      </template>
      <form v-else class="shift-open" @submit.prevent="openShift">
        <span class="shift-dot shift-dot--off" aria-hidden="true" />
        <strong>No shift open</strong>
        <input v-model.number="openForm.opening_float" type="number" min="0" step="0.01" class="input input--sm" aria-label="Opening float" placeholder="Opening float" required>
        <input v-model.trim="openForm.counter_label" type="text" maxlength="40" class="input input--sm" aria-label="Counter" placeholder="Counter (optional)">
        <button type="submit" class="btn btn-primary btn-sm" :disabled="openingShift">{{ openingShift ? 'Opening…' : 'Open shift' }}</button>
        <span v-if="shiftError" class="field-error">{{ shiftError }}</span>
      </form>
    </section>

    <!-- The counter, left to right: who is waiting, their bill, the payment. -->
    <div class="counter">
      <!-- 1. WAITING: the queue is always in view; typing turns it into results -->
      <section class="card queue" aria-labelledby="queue-title">
        <div class="queue-head">
          <h2 id="queue-title" class="card-title">
            {{ scanQuery.trim().length >= 2 ? 'Results' : 'Waiting' }}
            <span v-if="!queueLoading && scanQuery.trim().length < 2" class="count-chip">{{ queue.length }}</span>
          </h2>
          <kbd class="kbd" title="Press / or F2 to scan">/</kbd>
        </div>

        <!-- Owed by different people: a patient at this counter, or a hospital by statement. -->
        <div class="seg" role="tablist" aria-label="Bill category">
          <button
            v-for="c in CATEGORIES"
            :key="c.value"
            role="tab"
            class="seg-btn"
            :class="{ 'seg-btn--on': category === c.value }"
            :aria-selected="category === c.value"
            @click="switchCategory(c.value)"
          >
            {{ c.short }}
          </button>
        </div>

        <!-- Scan or type: a handheld scanner types into this box too. -->
        <form class="search" role="search" @submit.prevent="searchNow('scan')">
          <AssetIcon name="search" :size="15" class="search-icon" />
          <input
            ref="scanInput"
            v-model="scanQuery"
            type="search"
            class="input search-input"
            :placeholder="category === 'patient' ? 'Reference or patient name' : 'Weekly request reference'"
            :aria-label="category === 'patient' ? 'Scan a request reference or search a patient' : 'Find a hospital invoice'"
            autocomplete="off"
            @keydown.esc="scanQuery = ''"
            @input="onQuery('scan')"
          >
          <button type="button" class="scan-btn" aria-label="Ready the scanner" title="Ready the scanner" @click="focusScanner">
            <AssetIcon name="scan-line" :size="16" />
          </button>
        </form>
        <p v-if="searchError" class="field-error">{{ searchError }}</p>

        <div class="queue-list" role="listbox" :aria-label="listHeading">
          <template v-if="listLoading">
            <div v-for="n in 4" :key="n" class="skeleton skeleton--row" />
          </template>
          <p v-else-if="!listRows.length" class="queue-empty">
            <AssetIcon :name="scanQuery.trim().length >= 2 ? 'search-x' : 'check-check'" :size="20" />
            {{ listEmpty }}
          </p>
          <button
            v-for="b in listRows"
            v-else
            :key="b.request_id"
            type="button"
            role="option"
            class="q-row"
            :class="{ 'q-row--on': bill?.request_id === b.request_id }"
            :aria-selected="bill?.request_id === b.request_id"
            @click="selectBill(b.request_id)"
          >
            <span class="q-row__top">
              <span class="mono strong">{{ b.reference_number }}</span>
              <BillingBadge v-if="b.is_emergency" tone="danger">STAT</BillingBadge>
            </span>
            <span class="q-row__who">{{ b.who }}</span>
            <span class="q-row__amount" :class="{ 'q-row__amount--clear': !b.owing }">
              {{ b.owing ? pesos(b.amount) : b.status_label }}
              <small v-if="b.owing">{{ b.amountWord }}</small>
            </span>
          </button>
        </div>
      </section>

      <!-- 2. THE BILL, step one: the request and what is held for it. Its one
           action opens the payment in its place (project owner, 2026-10-25). -->
      <section v-if="!bill || !paymentReady" class="card billcard" aria-labelledby="bill-title">
        <h2 id="bill-title" class="sr-only">Bill</h2>

        <div v-if="billLoading" class="bill-loading" aria-busy="true">
          <div class="skeleton skeleton--head" />
          <div v-for="n in 3" :key="n" class="skeleton skeleton--line" />
        </div>

        <!-- With no request picked the panel still shows, empty and locked, as
             Blood Testing's results card does; picking one fills it in. -->
        <template v-else>
          <div class="bill-head" :class="{ 'bill-head--empty': !bill }">
            <span class="avatar" aria-hidden="true"><AssetIcon :name="weekly ? 'building-2' : 'user'" :size="18" /></span>
            <div class="bill-head__main">
              <p class="bill-head__name">
                {{ recipientName }}
                <BillingBadge v-if="bill?.request?.is_emergency" tone="danger">STAT</BillingBadge>
              </p>
              <p class="bill-head__line">{{ recipientLine }}</p>
              <p v-if="recipientExtra" class="bill-head__extra">{{ recipientExtra }}</p>
            </div>
            <div v-if="bill" class="bill-head__actions">
              <NuxtLink :to="`/blood-center/invoice/${bill.request_id}`" class="link-btn">View details</NuxtLink>
              <button type="button" class="icon-btn" title="Clear (Esc)" aria-label="Clear this bill" @click="nextCustomer">
                <AssetIcon name="x" :size="15" />
              </button>
            </div>
          </div>

          <!-- ITEMS: the units held for the request; nothing is added or priced at the counter -->
          <div class="items">
            <table class="grid-table">
              <!-- The figures keep fixed widths; the component name takes the rest and wraps. -->
              <colgroup>
                <col class="col-idx">
                <col>
                <col class="col-type">
                <col class="col-qty">
                <col class="col-price">
                <col class="col-total">
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" class="idx">#</th>
                  <th scope="col">Component</th>
                  <th scope="col">Type</th>
                  <th scope="col" class="num">Qty</th>
                  <th scope="col" class="num price">Unit price</th>
                  <th scope="col" class="num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                <template v-if="bill?.lines?.length">
                  <tr v-for="(line, i) in bill.lines" :key="i">
                    <td class="muted idx">{{ i + 1 }}</td>
                    <td class="item-name">{{ line.component_name }}</td>
                    <td><span v-if="line.blood_type" class="type">{{ line.blood_type }}</span><span v-else class="muted">-</span></td>
                    <td class="num">{{ line.quantity }}</td>
                    <td class="num price">{{ pesos(line.unit_price) }}</td>
                    <td class="num strong">{{ pesos(line.line_total) }}</td>
                  </tr>
                </template>
                <tr v-else class="empty-row">
                  <td colspan="6">{{ bill ? 'No units are held for this request yet.' : 'No request picked.' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Read-only facts, as text rather than greyed-out boxes -->
          <dl class="facts">
            <div>
              <dt>Type</dt>
              <dd>{{ !bill ? '—' : bill.request?.purpose_label || (weekly ? 'Blood Bank Replenishment' : 'Patient Transfusion') }}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd :class="{ 'facts__stat': bill?.request?.is_emergency }">{{ !bill ? '—' : bill.request?.urgency_label || 'Routine' }}</dd>
            </div>
            <div>
              <dt>{{ weekly ? 'Requested on' : 'Physician / hospital' }}</dt>
              <dd>{{ !bill ? '—' : weekly ? day(bill.request?.request_date) : (bill.request?.attending_physician || bill.request?.requesting_facility || '-') }}</dd>
            </div>
          </dl>

          <div class="bill-foot">
            <p class="bill-total" :class="{ 'bill-total--empty': !bill }">
              <span>Total</span>
              <strong>{{ pesos(bill?.total_amount) }}</strong>
            </p>
            <button ref="proceedBtn" type="button" class="btn btn-primary btn-cta bill-proceed" :disabled="!bill" @click="proceedToPayment">
              {{ proceedLabel }}
              <AssetIcon name="arrow-right" :size="16" />
            </button>
          </div>
        </template>
      </section>

      <!-- 3. THE PAYMENT, step two: replaces the bill. What is due on the left,
           how it is paid on the right; stacked when the panel is narrow. -->
      <aside v-else class="card pay" aria-labelledby="pay-title">
        <div class="pay-layout">
          <section class="pay-due" aria-label="Amount due">
            <div class="pay-hero">
              <div class="pay-hero__top">
                <button v-if="!done" type="button" class="link-btn" @click="backToDetails">
                  <AssetIcon name="arrow-left" :size="14" />
                  Request details
                </button>
                <span class="txn">Bill <strong class="mono">{{ bill.request?.reference_number || '-' }}</strong></span>
              </div>
              <h2 id="pay-title" class="pay-hero__title">
                <span class="pay-hero__name">{{ recipientName }}</span>
                <BillingBadge v-if="bill.request?.is_emergency" tone="danger">STAT</BillingBadge>
              </h2>
              <p class="pay-hero__label">{{ heroLabel }}</p>
              <p class="pay-hero__amount">{{ pesos(heroAmount) }}</p>
            </div>

            <dl v-if="weekly" class="summary">
              <div><dt>Total billed</dt><dd>{{ pesos(bill.total_amount) }}</dd></div>
              <div><dt>Status</dt><dd>{{ bill.status_label }}</dd></div>
            </dl>
            <template v-else>
              <dl class="summary">
                <div><dt>Total amount</dt><dd>{{ pesos(bill.total_amount) }}</dd></div>
                <div class="subsidy-row">
                  <dt>
                    Government subsidy
                    <button v-if="canPay" type="button" class="link-btn link-btn--inline" @click="openSubsidy">Apply</button>
                  </dt>
                  <dd>− {{ pesos(bill.is_subsidised ? bill.total_amount : 0) }}</dd>
                </div>
                <div v-if="Number(bill?.collected) > 0"><dt>Already paid</dt><dd>− {{ pesos(bill.collected) }}</dd></div>
                <div v-for="(p, i) in parts" :key="i" class="part-row">
                  <dt>
                    {{ p.label }}<span v-if="p.reference" class="mono part-ref">{{ p.reference }}</span>
                    <button type="button" class="part-remove" :aria-label="`Remove the ${p.label} part`" title="Remove this part" @click="removePart(i)">
                      <AssetIcon name="x" :size="11" />
                    </button>
                  </dt>
                  <dd>− {{ pesos(p.amount) }}</dd>
                </div>
              </dl>

              <!-- The subsidy waives the whole bill; it is a decision, not a payment. -->
              <div v-if="subsidyOpen" class="subsidy-form">
                <p class="subsidy-title">Apply the government subsidy</p>
                <p class="quiet">
                  Waives the whole {{ pesos(bill.total_amount) }} and clears the blood for release. No payment is recorded.
                  <template v-if="Number(bill.collected) > 0">The {{ pesos(bill.collected) }} already paid stays on record; any refund is settled outside RedAgos.</template>
                </p>
                <input v-model.trim="subsidyReason" type="text" maxlength="255" class="input" placeholder="Reason (optional), e.g. DOH allocation" aria-label="Reason for the subsidy">
                <p v-if="subsidyError" class="field-error">{{ subsidyError }}</p>
                <div class="pair">
                  <button type="button" class="btn btn-outline" :disabled="saving" @click="subsidyOpen = false">Cancel</button>
                  <button type="button" class="btn btn-primary" :disabled="saving" @click="submitSubsidy">{{ saving ? 'Applying…' : 'Apply subsidy' }}</button>
                </div>
              </div>
            </template>
          </section>

          <section class="pay-take" :aria-label="weekly ? 'Settlement' : 'Payment'">
            <div class="tabs" role="tablist" :aria-label="weekly ? 'Settlement' : 'Payment'">
              <button
                v-for="t in payTabs"
                :key="t.value"
                role="tab"
                class="tab"
                :class="{ 'tab--on': payTab === t.value }"
                :aria-selected="payTab === t.value"
                :title="t.label"
                @click="payTab = t.value"
              >
                <span class="tab__long">{{ t.label }}</span>
                <span class="tab__short" aria-hidden="true">{{ t.short }}</span>
              </button>
            </div>

            <div class="pay-body">
              <!-- DONE: the receipt to hand over -->
              <div v-if="done" class="done">
                <div class="done-mark"><AssetIcon name="check" :size="22" /></div>
                <h3 class="done-title">{{ done.parts > 1 ? `Payment recorded in ${done.parts} parts` : 'Payment recorded' }}</h3>
                <div v-if="done.change !== null" class="done-change">
                  <span>Change to give back</span>
                  <strong>{{ pesos(done.change) }}</strong>
                </div>
                <template v-if="done.receipt">
                  <p class="done-sub">
                    Receipt <NuxtLink :to="`/blood-center/receipt/${done.receipt.id}`" class="link mono">{{ done.receipt.receipt_number }}</NuxtLink>
                    · {{ done.receipt.payment_method_label }} {{ pesos(done.receipt.amount_paid) }}
                  </p>
                  <!-- A split is one receipt; its parts are listed on it. -->
                  <p v-if="done.parts > 1" class="done-sub">
                    {{ done.receipt.tenders.map((t) => `${t.method_label} ${pesos(t.amount_paid)}`).join(' · ') }}
                  </p>
                </template>
                <button ref="printBtn" class="btn btn-primary btn-block btn-lg" :disabled="!done.receipt" @click="printReceipt(done.receipt)">
                  <AssetIcon name="printer" :size="16" />
                  Print receipt (80mm)
                </button>
                <div class="pair">
                  <button class="btn btn-outline" :disabled="downloadingReceipt || !done.receipt" @click="downloadReceipt(done.receipt)">
                    <AssetIcon name="download" :size="15" />
                    A4 PDF
                  </button>
                  <button class="btn btn-outline" @click="nextCustomer">Next customer</button>
                </div>
              </div>

              <!-- INVOICE PREVIEW: the live bill as the next invoice would show it -->
              <div v-else-if="payTab === 'preview'" class="preview">
                <div class="preview-head">
                  <strong>Invoice</strong>
                  <span class="mono">{{ bill.request?.reference_number }}</span>
                </div>
                <ul class="preview-lines">
                  <li v-for="(line, i) in bill.lines" :key="i">
                    <span>{{ line.blood_type ? `${line.blood_type} ` : '' }}{{ line.component_name }} × {{ line.quantity }}</span>
                    <span>{{ pesos(line.line_total) }}</span>
                  </li>
                  <li v-if="!bill.lines?.length" class="muted">No units held yet.</li>
                </ul>
                <dl class="summary">
                  <div><dt>Total amount</dt><dd>{{ pesos(bill.total_amount) }}</dd></div>
                  <div v-if="!weekly"><dt>Paid</dt><dd>{{ pesos(bill.collected) }}</dd></div>
                  <div class="summary-due"><dt>{{ weekly ? 'Billed to hospital' : 'Amount due' }}</dt><dd>{{ pesos(weekly ? bill.total_amount : bill.outstanding) }}</dd></div>
                </dl>
                <NuxtLink :to="`/blood-center/invoice/${bill.request_id}`" class="btn btn-outline btn-block">
                  <AssetIcon name="file-text" :size="15" />
                  Open invoice to print or issue
                </NuxtLink>
              </div>

              <!-- WEEKLY: no money moves here; the hospital's settlement is recorded -->
              <template v-else-if="weekly">
                <dl v-if="bill.settlement" class="settled">
                  <div><dt>Settled on</dt><dd>{{ day(bill.settlement.settled_at) }}</dd></div>
                  <div><dt>Reference</dt><dd class="mono">{{ bill.settlement.reference }}</dd></div>
                </dl>
                <p v-else-if="!bill.request?.is_closed" class="quiet">The order is still open, so its total can still change. Record the settlement once it closes.</p>
                <form v-else id="settle-form" class="form" @submit.prevent="submitSettlement">
                  <label class="field">
                    <span class="field-label">Hospital's payment reference</span>
                    <input ref="settleInput" v-model.trim="settlement.settlement_reference" type="text" maxlength="100" class="input mono" placeholder="Cheque or transfer number" required>
                    <span v-if="settlementErrors.settlement_reference" class="field-error">{{ settlementErrors.settlement_reference }}</span>
                  </label>
                  <div class="pair">
                    <div class="field">
                      <label class="field-label" for="settled-at">Date settled</label>
                      <DatePicker id="settled-at" v-model="settlement.settled_at" :max="todayIso" size="sm" />
                    </div>
                    <label class="field">
                      <span class="field-label">Note <span class="optional">(optional)</span></span>
                      <input v-model.trim="settlement.settlement_note" type="text" maxlength="500" class="input">
                    </label>
                  </div>
                  <span v-if="settlementErrors.settled_at" class="field-error">{{ settlementErrors.settled_at }}</span>
                  <p v-if="settlementError" class="field-error">{{ settlementError }}</p>
                </form>
              </template>

              <!-- PATIENT PAYMENT -->
              <div v-else-if="!takes" class="nothing-due">
                <AssetIcon name="check" :size="18" />
                <div>
                  <strong>{{ bill.is_subsidised ? 'Met by the government subsidy' : 'Nothing is due on this bill' }}</strong>
                  <p>{{ bill.clears_release ? 'Its blood can be released.' : bill.status_label }}</p>
                </div>
              </div>

              <p v-else-if="shiftsEnabled && !shift" class="banner banner--warn">
                <AssetIcon name="triangle-alert" :size="14" />
                <span>Open a shift above before taking this payment.</span>
              </p>

              <template v-else>
                <div class="methods" role="radiogroup" aria-label="Payment method">
                  <button
                    v-for="m in METHODS"
                    :key="m.value"
                    type="button"
                    role="radio"
                    class="method"
                    :class="{ 'method--on': method === m.value }"
                    :aria-checked="method === m.value"
                    :aria-label="m.label"
                    :title="m.value === 'cash' && hasCashPart ? 'Cash is already part of this payment' : m.label"
                    :disabled="!canPay || (m.value === 'cash' && hasCashPart)"
                    @click="method = m.value"
                  >
                    <AssetIcon :name="m.icon" :size="16" />
                    <!-- A narrow panel shows the short label; the tile's name stays whole. -->
                    <span class="method-label" :class="{ 'method-label--long': m.short }">{{ m.label }}</span>
                    <span v-if="m.short" class="method-label method-label--short" aria-hidden="true">{{ m.short }}</span>
                  </button>
                </div>

                <form id="pay-form" class="form" @submit.prevent="footAction === 'add' ? addPart() : takePayment()">
                  <div class="field">
                    <label for="pay-received" class="field-label">Amount received</label>
                    <div class="received">
                      <div class="money">
                        <span aria-hidden="true">₱</span>
                        <input
                          id="pay-received"
                          ref="tenderedInput"
                          v-model.number="tendered"
                          type="number"
                          min="0.01"
                          step="0.01"
                          class="input input--money"
                          :disabled="!canPay"
                          placeholder="0.00"
                        >
                      </div>
                      <button type="button" class="btn btn-outline" :disabled="!canPay" @click="tendered = entry.remaining">Full Amount</button>
                    </div>
                  </div>

                  <!-- Quick cash: the next round amounts above what is left -->
                  <div v-if="method === 'cash' && canPay && cashChips.length" class="cash-chips" aria-label="Quick amounts received">
                    <button
                      v-for="amount in cashChips"
                      :key="amount"
                      type="button"
                      class="cash-chip"
                      :class="{ 'cash-chip--on': Number(tendered) === amount }"
                      @click="tendered = amount"
                    >
                      {{ pesos(amount) }}
                    </button>
                  </div>

                  <!-- A card's additional information sits beside its reference, so it costs no height. -->
                  <div class="refs" :class="{ 'refs--split': method === 'card' }">
                    <div class="field">
                      <label for="pay-ref" class="field-label" :title="`Payment reference · ${referenceName(method) || 'card, GCash or bank transfer'} no.`">Payment reference <span class="optional">· {{ referenceName(method) || 'card, GCash or bank transfer' }} no.</span></label>
                      <div class="ref">
                        <input
                          id="pay-ref"
                          v-model.trim="reference"
                          type="text"
                          maxlength="100"
                          class="input mono"
                          :placeholder="methodInfo.placeholder"
                          :disabled="!canPay || !needsReference(method)"
                          :required="needsReference(method)"
                        >
                        <button type="button" class="ref-copy" :disabled="!reference" aria-label="Copy the reference" title="Copy the reference" @click="copyReference">
                          <AssetIcon name="clipboard-list" :size="15" />
                        </button>
                      </div>
                    </div>

                    <div v-if="method === 'card'" class="field">
                      <label for="pay-info" class="field-label" title="Additional information (optional)">Additional information <span class="optional">(optional)</span></label>
                      <input
                        id="pay-info"
                        v-model.trim="additionalInfo"
                        type="text"
                        maxlength="100"
                        class="input"
                        autocomplete="off"
                        :disabled="!canPay"
                      >
                    </div>
                  </div>

                  <label class="field">
                    <span class="field-label">Received from <span class="optional">(optional)</span></span>
                    <input v-model.trim="payerName" type="text" maxlength="120" class="input" placeholder="Name printed on the receipt, e.g. the patient's watcher" autocomplete="off" :disabled="!canPay">
                  </label>

                  <p v-if="payError" class="field-error">{{ payError }}</p>
                </form>
              </template>
            </div>

            <!-- The panel's action, outside the scrolling form so it never drops below the fold. -->
            <div v-if="footAction" class="pay-foot">
              <!-- The change sits by the button, so it never scrolls out of view. -->
              <div v-if="footAction !== 'settle'" class="change" :class="{ 'change--due': entry.short > 0, 'change--short': entry.over > 0 }" aria-live="polite">
                <span class="change__label">{{ entry.short > 0 ? 'Remaining' : 'Change' }}</span>
                <strong class="change__value">
                  {{ entry.over > 0 ? `${pesos(entry.over)} more than is due` : entry.short > 0 ? `${pesos(entry.short)} by another method` : pesos(entry.change) }}
                </strong>
              </div>
              <button v-if="footAction === 'add'" type="button" class="btn btn-primary btn-cta" :disabled="!canAddPart" @click="addPart">
                <AssetIcon name="circle-plus" :size="16" />
                Add {{ pesos(entry.paid) }} {{ methodInfo.label }} to the payment
              </button>
              <button v-else-if="footAction === 'settle'" type="submit" form="settle-form" class="btn btn-primary btn-cta" :disabled="saving || !settlement.settlement_reference">
                {{ saving ? 'Recording…' : 'Record Settlement' }}
              </button>
              <button v-else type="submit" form="pay-form" class="btn btn-primary btn-cta" :disabled="recording || !canComplete">
                <AssetIcon name="credit-card" :size="16" />
                {{ recording ? 'Recording…' : 'Complete Payment' }}
                <kbd class="kbd kbd--on-primary">Enter</kbd>
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>

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
 * The billing counter: find a bill, take a patient's payment in person, and
 * hand over the receipt; or record a hospital's settlement of a weekly bill.
 *
 * Two panels (project owner, 2026-10-25): who is waiting (the queue, always in
 * view; typing turns it into search results), and beside it one bill in two
 * steps. First the request and what is held for it; "Proceed to payment" then
 * puts the payment in its place, with the amount due and the change in large
 * type. Recent transactions and the month's bills are the Billing
 * Transactions and Statements pages. It follows the portal colour. The page grows with its
 * content and scrolls; long lists scroll inside. Keys: / or F2 to scan, Enter
 * to complete, Esc to clear the bill.
 *
 * Everything that matters is decided by the server: what is due, whether the
 * payment went in, and whether the counter works in cash shifts at all. Off —
 * one billing staff member, the default — a payment is taken straight away.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import BillingBadge from '~/components/BloodCenter/BillingBadge.vue'
import CashCountDialog from '~/components/BloodCenter/CashCountDialog.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import {
  needsReference,
  pesos,
  referenceName,
  saveBlob,
  splitEntry,
  takesPayment,
} from '~/utils/billing'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.record_payment',
})

const route = useRoute()

const CATEGORIES = [
  { value: 'patient', label: 'Patient Bills', short: 'Patient bills' },
  { value: 'weekly', label: 'Hospital Billing / Restocking', short: 'Hospital / restock' },
]

// Card and bank transfer are recorded from their reference, as GCash is. A
// GCash checkout (QR) is opened from the statement's own page, not here.
const METHODS = [
  { value: 'cash', label: 'Cash', icon: 'philippine-peso', placeholder: 'Not needed for cash' },
  { value: 'card', label: 'Card', icon: 'credit-card', placeholder: 'From the card terminal slip' },
  { value: 'gcash', label: 'GCash', icon: 'smartphone', placeholder: 'From the payer’s GCash app' },
  { value: 'bank_transfer', label: 'Bank Transfer', short: 'Bank', icon: 'building-2', placeholder: 'From the bank’s transfer confirmation' },
]

// The operational day is Manila's, whatever the browser's clock says.
const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

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

function day(value) {
  if (!value) return '—'
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

/* SHIFT: only when the server says the counter works in them */
// Off until the server says otherwise, so no shift bar flashes up on a counter without them.
const shiftsEnabled = ref(false)
const shift = ref(null)
const shiftError = ref('')
const openingShift = ref(false)
const openForm = reactive({ opening_float: null, counter_label: '' })
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

/* FIND A BILL: one box takes a scanned reference or a patient's name */
const category = ref('patient')
const scanInput = ref(null)
const scanQuery = ref('')
const patientQuery = ref('')
const dropdown = ref(null)
const results = ref([])
const searching = ref(false)
const searchError = ref('')
const queue = ref([])
const queueLoading = ref(true)
let searchTimer = null

// The two lists come from different places; each row is read the same way.
function fromCounter(b) {
  return {
    request_id: b.request_id,
    reference_number: b.reference_number,
    is_emergency: b.is_emergency,
    who: `${b.patient_name || 'Patient'} · ${b.requesting_facility || '—'}`,
    amount: b.outstanding,
    amountWord: 'due',
    owing: b.takes_payment,
    status_label: b.billing_status_label,
  }
}

function fromStatement(s) {
  return {
    request_id: s.request?.id ?? s.request_id,
    reference_number: s.request?.reference_number ?? '—',
    is_emergency: s.request?.is_emergency,
    who: s.request?.requesting_facility || '—',
    amount: s.total_amount,
    amountWord: 'billed',
    owing: s.status === 'statement_only',
    status_label: s.status_label,
  }
}

// The Waiting column: the queue, or the results once two letters are typed.
const typing = computed(() => scanQuery.value.trim().length >= 2)
const listRows = computed(() => (typing.value ? results.value : queue.value))
const listLoading = computed(() => (typing.value ? searching.value : queueLoading.value))
const listHeading = computed(() => {
  if (typing.value) return 'Results'
  return category.value === 'patient' ? 'Awaiting payment' : 'Awaiting hospital settlement'
})
const listEmpty = computed(() => {
  if (typing.value) return `Nothing matches “${scanQuery.value.trim()}”.`
  return category.value === 'patient' ? 'Nobody is waiting to pay.' : 'No hospital invoice is waiting for settlement.'
})

function focusScanner() {
  scanInput.value?.focus()
}

function switchCategory(value) {
  if (category.value === value) return
  category.value = value
  nextCustomer()
  loadQueue()
}

function onQuery(which) {
  dropdown.value = which
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => searchNow(which), 300)
}

async function searchNow(which) {
  const q = (which === 'patient' ? patientQuery.value : scanQuery.value).trim()
  searchError.value = ''

  if (q.length < 2) {
    results.value = []
    return
  }

  searching.value = true

  try {
    results.value = category.value === 'patient'
      ? ((await bloodCenterService.counterLookup(q))?.data ?? []).map(fromCounter)
      : ((await bloodCenterService.billings({ category: 'weekly', search: q }))?.data ?? []).map(fromStatement)

    // A scanned or typed reference that matches one bill opens it.
    if (which === 'scan' && results.value.length === 1 && results.value[0].reference_number.toLowerCase() === q.toLowerCase()) {
      await selectBill(results.value[0].request_id)
    }
  } catch (err) {
    searchError.value = err?.message || 'The search failed.'
  } finally {
    searching.value = false
  }
}

async function loadQueue() {
  queueLoading.value = true

  try {
    queue.value = category.value === 'patient'
      ? ((await bloodCenterService.counterQueue())?.data ?? []).map(fromCounter)
      : ((await bloodCenterService.billings({ category: 'weekly', status: 'statement_only' }))?.data ?? []).map(fromStatement)
  } catch {
    queue.value = []
  } finally {
    queueLoading.value = false
  }
}

/* THE BILL */
const bill = ref(null)
const billLoading = ref(false)
// The step: false shows the request and its lines, true the payment in their
// place (project owner, 2026-10-25). A newly picked bill always starts on the request.
const paymentReady = ref(false)
const proceedBtn = ref(null)
const weekly = computed(() => Boolean(bill.value?.is_statement_only) || category.value === 'weekly')
const takes = computed(() => (bill.value ? takesPayment(bill.value) : false))

const recipientName = computed(() => {
  if (!bill.value) return category.value === 'weekly' ? 'No hospital selected' : 'No patient selected'
  return weekly.value ? (bill.value.request?.requesting_facility || 'Hospital') : (bill.value.request?.patient_name || 'Patient')
})

const recipientLine = computed(() => {
  const r = bill.value?.request
  if (!r) return category.value === 'weekly' ? 'Pick a hospital invoice from the waiting list' : 'Scan a request or pick one from the waiting list'
  return weekly.value ? `Weekly order ${r.reference_number}` : `Request ${r.reference_number}`
})

const recipientExtra = computed(() => {
  const r = bill.value?.request
  if (!r) return ''
  if (weekly.value) return r.blood_type ? `Blood types ${r.blood_type}` : 'Billed by invoice'

  return [r.transfusion_reference ? `PTR ${r.transfusion_reference}` : null, r.blood_type, r.requesting_facility]
    .filter(Boolean)
    .join(' | ')
})

async function selectBill(requestId) {
  dropdown.value = null
  billLoading.value = true
  done.value = null
  payError.value = ''
  subsidyOpen.value = false
  paymentReady.value = false

  try {
    bill.value = (await bloodCenterService.billingForRequest(requestId))?.billing ?? null
    category.value = bill.value?.is_statement_only ? 'weekly' : 'patient'
    payTab.value = category.value === 'weekly' ? 'settle' : 'method'
    resetPayment()
  } catch (err) {
    toast('Bill Not Found', 'danger', err?.message || 'That bill could not be opened.')
    bill.value = null
  } finally {
    billLoading.value = false
  }

  // Enter proceeds, as it then completes the payment.
  await nextTick()
  proceedBtn.value?.focus()
}

// What the request step's button leads to: a payment, a settlement, or only a look at its status.
const proceedLabel = computed(() => {
  if (!bill.value) return weekly.value ? 'Proceed to settlement' : 'Proceed to payment'
  if (weekly.value) return bill.value && !bill.value.settlement && bill.value.request?.is_closed ? 'Proceed to settlement' : 'View settlement status'
  return takes.value ? 'Proceed to payment' : 'View payment status'
})

function proceedToPayment() {
  if (!bill.value) return

  paymentReady.value = true
  nextTick(() => (weekly.value ? settleInput.value : tenderedInput.value)?.focus())
}

function backToDetails() {
  paymentReady.value = false
  subsidyOpen.value = false
  nextTick(() => proceedBtn.value?.focus())
}

// The bill again after the subsidy or a settlement, staying on the payment step.
async function refreshBill() {
  try {
    bill.value = (await bloodCenterService.billingForRequest(bill.value.request_id))?.billing ?? bill.value
  } catch {
    // The next pick reloads it.
  }
}

/* TAKE THE PAYMENT */
const payTab = ref('method')
const method = ref('cash')
const tendered = ref(null)
const reference = ref('')
// A card payment's additional information: the cardholder's last name.
const additionalInfo = ref('')
const payerName = ref('')
const payError = ref('')
const recording = ref(false)
const done = ref(null)
const tenderedInput = ref(null)
const printBtn = ref(null)
const methodInfo = computed(() => METHODS.find((m) => m.value === method.value) ?? METHODS[0])

/*
 * A payment split across methods: the parts added so far, each an ordinary
 * payment once recorded. Less than is left, entered and added, joins them;
 * the rest is paid another way. The server takes at most four parts, one cash.
 */
const MAX_PARTS = 4
const parts = ref([])
const partsTotal = computed(() => parts.value.reduce((sum, p) => sum + p.amount, 0))
const hasCashPart = computed(() => parts.value.some((p) => p.method === 'cash'))
const entry = computed(() => splitEntry(bill.value?.outstanding, partsTotal.value, method.value, tendered.value))

const payTabs = computed(() => (category.value === 'weekly'
  ? [{ value: 'settle', label: 'Settlement', short: 'Settle' }, { value: 'preview', label: 'Invoice Preview', short: 'Preview' }]
  : [{ value: 'method', label: 'Payment Method', short: 'Pay' }, { value: 'preview', label: 'Invoice Preview', short: 'Preview' }]))

// The payment panel's big number, and what it is.
const heroAmount = computed(() => {
  if (!bill.value) return 0
  if (weekly.value) return bill.value.settlement ? 0 : bill.value.total_amount
  return parts.value.length ? entry.value.remaining : bill.value.outstanding
})
const heroLabel = computed(() => {
  if (weekly.value) return 'Owed by the hospital'
  if (parts.value.length) return 'Remaining balance'
  return 'Amount due'
})

// Quick cash: the next round amounts above what is left (₱3,250 gives ₱3,300,
// ₱3,500, ₱4,000), so the cashier taps what was handed over.
const cashChips = computed(() => {
  const left = Number(entry.value.remaining)
  if (!(left > 0)) return []
  const up = step => Math.ceil(left / step) * step
  const picks = [up(100), up(500), up(1000), up(1000) + 1000]
  return [...new Set(picks)].filter(v => v > left).slice(0, 3)
})

// Only a bill with something due can be paid, on the payment step, and not while the subsidy is being decided.
const canPay = computed(() => paymentReady.value && Boolean(bill.value) && takes.value && !subsidyOpen.value && !(shiftsEnabled.value && !shift.value))
// The amount entered meets what is left (cash may go beyond it, as change).
const canComplete = computed(() => {
  if (!canPay.value || !(entry.value.remaining > 0) || !(entry.value.paid > 0)) return false
  if (entry.value.short > 0 || entry.value.over > 0) return false
  return method.value === 'cash' || Boolean(reference.value)
})

// Less than what is left: this part joins the payment and the rest is paid another way.
const canAddPart = computed(() => canPay.value
  && entry.value.paid > 0 && entry.value.short > 0
  && parts.value.length < MAX_PARTS - 1
  && (method.value === 'cash' || Boolean(reference.value)))

// Which action the payment step's footer offers: the payment, a part of it, the settlement, or none.
const footAction = computed(() => {
  if (!bill.value || !paymentReady.value || done.value || payTab.value === 'preview') return null

  if (weekly.value) return !bill.value.settlement && bill.value.request?.is_closed ? 'settle' : null

  if (subsidyOpen.value || !takes.value || (shiftsEnabled.value && !shift.value)) return null

  return entry.value.short > 0 ? 'add' : 'pay'
})

function resetPayment() {
  method.value = 'cash'
  parts.value = []
  tendered.value = null
  reference.value = ''
  additionalInfo.value = ''
  payerName.value = ''
  payError.value = ''
  Object.assign(settlement, { settlement_reference: '', settled_at: todayIso, settlement_note: '' })
  Object.keys(settlementErrors).forEach((k) => delete settlementErrors[k])
  settlementError.value = ''
}

async function copyReference() {
  try {
    await navigator.clipboard.writeText(reference.value)
    toast('Reference Copied', 'info')
  } catch {
    // The reference is on screen to copy by hand.
  }
}

function addPart() {
  if (!canAddPart.value) return

  const cash = method.value === 'cash'
  parts.value.push({
    method: method.value,
    label: methodInfo.value.label,
    amount: entry.value.paid,
    reference: cash ? null : reference.value,
    info: additionalInfo.value,
  })
  reference.value = ''
  additionalInfo.value = ''
  payError.value = ''

  // Cash is counted once; the rest is paid another way, prefilled with what is left.
  if (cash) method.value = 'card'
  else tendered.value = entry.value.remaining
}

function removePart(index) {
  parts.value.splice(index, 1)
  payError.value = ''
}

// A part as the server records it: cash with what was handed over, the rest
// with a reference, and a card with its additional information if any.
function asPayment(part, tenderedCash = part.amount) {
  return {
    amount_paid: part.amount,
    payment_method: part.method,
    ...(part.method === 'cash' ? { amount_tendered: tenderedCash } : { reference_number: part.reference }),
    ...(part.method === 'card' && part.info ? { additional_information: part.info } : {}),
  }
}

async function takePayment() {
  if (!canComplete.value) return

  payError.value = ''
  recording.value = true

  const last = asPayment(
    { method: method.value, amount: entry.value.paid, reference: reference.value, info: additionalInfo.value },
    Number(tendered.value),
  )
  const payer = payerName.value ? { payer_name: payerName.value } : {}

  try {
    // Split: every part in one request, recorded all or none.
    const response = parts.value.length
      ? await bloodCenterService.recordSplitPayment(bill.value.request_id, { tenders: [...parts.value.map((p) => asPayment(p)), last], ...payer })
      : await bloodCenterService.recordPayment(bill.value.request_id, { ...last, ...payer })

    // One receipt, however many parts the payment was split into.
    done.value = {
      receipt: response?.receipt ?? null,
      parts: response?.receipt?.tenders?.length || 1,
      change: response?.change_given == null ? null : Number(response.change_given),
    }
    parts.value = []
    nextTick(() => printBtn.value?.focus())

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

function nextCustomer() {
  done.value = null
  bill.value = null
  paymentReady.value = false
  scanQuery.value = ''
  patientQuery.value = ''
  results.value = []
  subsidyOpen.value = false
  payTab.value = category.value === 'weekly' ? 'settle' : 'method'
  resetPayment()
  nextTick(() => scanInput.value?.focus())
}

/* THE GOVERNMENT SUBSIDY: waives the whole bill */
const saving = ref(false)
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
    await bloodCenterService.applySubsidy(bill.value.request_id, subsidyReason.value || undefined)
    toast('Subsidy Applied', 'success', 'The bill is met by government funding and the units can be released.')
    subsidyOpen.value = false
    await Promise.all([refreshBill(), loadQueue()])
  } catch (err) {
    subsidyError.value = err?.message || 'Could not apply the subsidy.'
  } finally {
    saving.value = false
  }
}

/* A WEEKLY BILL'S SETTLEMENT. No money moves through RedAgos. */
const settlement = reactive({ settlement_reference: '', settled_at: todayIso, settlement_note: '' })
const settleInput = ref(null)
const settlementErrors = reactive({})
const settlementError = ref('')

async function submitSettlement() {
  settlementError.value = ''
  Object.keys(settlementErrors).forEach((k) => delete settlementErrors[k])
  saving.value = true

  try {
    const response = await bloodCenterService.settleWeeklyBill(bill.value.request_id, {
      settlement_reference: settlement.settlement_reference,
      settled_at: settlement.settled_at,
      settlement_note: settlement.settlement_note || null,
    })
    toast('Settlement Recorded', 'success', response?.message)
    await Promise.all([refreshBill(), loadQueue()])
  } catch (err) {
    Object.entries(err?.errors ?? {}).forEach(([key, messages]) => {
      settlementErrors[key] = Array.isArray(messages) ? messages[0] : messages
    })
    settlementError.value = err?.message || 'The settlement could not be recorded.'
  } finally {
    saving.value = false
  }
}

/* RECEIPTS */
const downloadingReceipt = ref(false)

// The 80mm receipt prints from its own page, sized for the counter's printer.
function printReceipt(receipt) {
  if (!receipt?.id) return

  window.open(`/blood-center/receipt-print/${receipt.id}?auto=1`, '_blank')
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

// Cash is counted as handed over; any other method is for what is left, unless the cashier splits it.
watch(method, (value) => {
  payError.value = ''
  tendered.value = value === 'cash' || !bill.value ? null : entry.value.remaining
})

onMounted(async () => {
  await Promise.all([loadShift(), loadQueue()])

  // From a statement: "Take payment" opens the bill here.
  const preset = Number(route.query.request)
  if (preset) await selectBill(preset)
  else scanInput.value?.focus()
})

function onCounterKeys(e) {
  const typingInField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable
  if ((e.key === '/' && !typingInField) || e.key === 'F2') {
    e.preventDefault()
    focusScanner()
  } else if (e.key === 'Escape' && !typingInField && bill.value && !closingShift.value) {
    nextCustomer()
  }
}
onMounted(() => window.addEventListener('keydown', onCounterKeys))

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  window.removeEventListener('keydown', onCounterKeys)
})
</script>

<style scoped>
/*
 * The counter, two panels: who is waiting, and the bill or its payment.
 * Styled in the system tokens, so it follows the portal colour and dark mode.
 * On a desktop it fits one screen (a 1366×768 laptop included) with only the
 * lists scrolling inside themselves; below that it stacks and scrolls.
 */
.pos {
  --pos-ctl: 36px;

  font-family: var(--rb-font-sans);
  padding: 14px 18px;
  display: flex; flex-direction: column; gap: 12px;
  color: var(--rb-text-primary);
}

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* Shift bar, one line */
.shift-bar, .shift-open { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12.5px; }
.shift-bar { flex: none; padding: 7px 12px; background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; }
.shift-bar--open { border-color: rgba(var(--rb-success-rgb), .45); }
.shift-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--rb-success); flex: none; }
.shift-dot--off { background: var(--rb-text-muted); }
.spacer { flex: 1; }
.shift-bar .input--sm { width: 130px; height: 30px; padding: 0 10px; font-size: 12.5px; }

/* ── Layout ── */
.counter { display: grid; grid-template-columns: minmax(250px, 300px) minmax(0, 1fr); gap: 12px; }

.card {
  background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 18px;
  box-shadow: var(--rb-shadow-sm); padding: 14px 16px; min-width: 0; min-height: 0;
  display: flex; flex-direction: column; gap: 10px;
}
.card-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }

.kbd {
  display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 6px;
  border: 1px solid var(--rb-border-strong); border-bottom-width: 2px; border-radius: 6px; background: var(--rb-surface-alt);
  font-family: var(--rb-font-mono); font-size: 11px; font-weight: 600; color: var(--rb-text-secondary);
}
.kbd--on-primary { margin-left: 6px; border-color: rgba(255, 255, 255, .35); background: rgba(255, 255, 255, .15); color: #fff; }

/* ── 1. Waiting ── */
.queue-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex: none; }
.count-chip { padding: 1px 8px; border-radius: 999px; background: rgba(var(--rb-primary-rgb), .12); color: var(--rb-primary-text); font-size: 12px; font-weight: 700; }

.seg { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; padding: 3px; flex: none; border-radius: 12px; background: var(--rb-surface-alt); }
.seg-btn {
  height: 30px; padding: 0 8px; border: 0; border-radius: 9px; background: transparent; cursor: pointer;
  font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); white-space: nowrap;
  transition: background-color .15s var(--rb-ease-out), color .15s var(--rb-ease-out);
}
.seg-btn:hover:not(.seg-btn--on) { color: var(--rb-text-primary); }
.seg-btn--on { background: var(--rb-surface); color: var(--rb-primary-text); box-shadow: 0 1px 3px rgba(var(--rb-shadow-rgb), .14); }
.seg-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.search { position: relative; flex: none; }
.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--rb-text-muted); pointer-events: none; }
.search .search-input { padding: 0 44px 0 36px; border-radius: 12px; }
.scan-btn {
  position: absolute; right: 4px; top: 4px; bottom: 4px; width: 32px; display: grid; place-items: center;
  border: 0; border-radius: 9px; background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); cursor: pointer;
}
.scan-btn:hover { background: rgba(var(--rb-primary-rgb), .18); }
.scan-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.queue-list { flex: 1 1 auto; min-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin: 0 -4px; padding: 0 4px; }
.queue-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; margin: auto 0; padding: 20px 8px; text-align: center; font-size: 12.5px; color: var(--rb-text-secondary); }

.q-row {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "top amount" "who amount";
  align-items: center; gap: 2px 10px; width: 100%; padding: 10px 12px; text-align: left;
  border: 1px solid var(--rb-border); border-radius: 14px; background: var(--rb-surface); cursor: pointer;
  font-family: inherit; color: var(--rb-text-primary);
  transition: border-color .15s var(--rb-ease-out), background-color .15s var(--rb-ease-out);
}
.q-row:hover { border-color: rgba(var(--rb-primary-rgb), .4); }
.q-row:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.q-row--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), .07); }
.q-row__top { grid-area: top; display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 13px; }
.q-row__who { grid-area: who; overflow: hidden; font-size: 12px; color: var(--rb-text-secondary); text-overflow: ellipsis; white-space: nowrap; }
.q-row__amount { grid-area: amount; display: flex; flex-direction: column; align-items: flex-end; font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; white-space: nowrap; }
.q-row__amount small { font-size: 10.5px; font-weight: 500; color: var(--rb-text-secondary); }
.q-row__amount--clear { color: var(--rb-success-text); font-size: 12px; }

/* ── 2. The bill ── */
.bill-loading { display: flex; flex-direction: column; gap: 10px; }
.bill-head { display: flex; align-items: flex-start; gap: 12px; flex: none; }
.avatar { width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; flex: none; color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .12); }
.bill-head__main { flex: 1; min-width: 0; }
.bill-head__name { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 17px; font-weight: 800; color: var(--rb-text-primary); }
.bill-head__line { margin: 2px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.bill-head__extra { margin: 1px 0 0; overflow: hidden; font-size: 12px; color: var(--rb-text-muted); text-overflow: ellipsis; white-space: nowrap; }
.bill-head__actions { display: flex; align-items: center; gap: 10px; flex: none; }
.bill-head--empty .avatar { color: var(--rb-text-muted); background: var(--rb-surface-alt); }
.bill-head--empty .bill-head__name { color: var(--rb-text-muted); }
.icon-btn {
  display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 1px solid var(--rb-border); border-radius: 10px;
  background: var(--rb-surface); color: var(--rb-text-secondary); cursor: pointer;
}
.icon-btn:hover { background: var(--rb-surface-hover); color: var(--rb-text-primary); }
.icon-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

/* Tables: fixed columns, so nothing pushes the page sideways. */
.grid-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 12.5px; font-variant-numeric: tabular-nums; }
.grid-table th {
  position: sticky; top: 0; z-index: 1; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
  color: var(--rb-text-secondary); background: var(--rb-surface-alt); padding: 8px 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.grid-table td { padding: 8px 10px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); vertical-align: middle; }
.grid-table tbody tr:last-child td { border-bottom: 0; }
.empty-row td { text-align: center; color: var(--rb-text-muted); padding: 14px 10px; white-space: normal; }

/* The bill's lines take whatever height the panel has left, and scroll inside it. */
.items { flex: 1 1 auto; min-height: 80px; overflow: auto; border: 1px solid var(--rb-border); border-radius: 14px; }
.billcard { container-type: inline-size; }
/* The panels that scroll inside themselves keep a thin scrollbar in the theme's colours. */
.queue-list, .items, .pay-body { scrollbar-width: thin; scrollbar-color: var(--rb-border-strong) transparent; }
.col-idx { width: 34px; }
.col-type { width: 62px; }
.col-qty { width: 50px; }
.col-price { width: 92px; }
.col-total { width: 98px; }
.item-name { overflow-wrap: anywhere; }
/* A narrow bill drops the line number, then the unit price; the subtotal stays. */
@container (max-width: 480px) {
  .col-idx, .idx { display: none; }
}
@container (max-width: 400px) {
  .col-price, .price { display: none; }
}
.type { display: inline-block; min-width: 30px; text-align: center; padding: 1px 6px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #B71C1C; background: #FDECEC; }

/* Priority is always a word; the purpose and the physician get the room, and wrap rather than clip. */
.facts { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, .8fr) minmax(0, 1.3fr); gap: 1px; margin: 0; flex: none; overflow: hidden; border: 1px solid var(--rb-border); border-radius: 14px; background: var(--rb-border); }
.facts div { padding: 8px 12px; background: var(--rb-surface-alt); min-width: 0; }
.facts dt { font-size: 11px; font-weight: 600; color: var(--rb-text-secondary); }
.facts dd { margin: 2px 0 0; font-size: 13px; font-weight: 600; line-height: 1.35; color: var(--rb-text-primary); overflow-wrap: anywhere; }
.facts .facts__stat { color: var(--rb-accent-text); }

/* The request step's close: the bill's total and the way on to the payment. */
.bill-foot { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 12px; border-top: 1px solid var(--rb-border); }
.bill-total { display: flex; flex-direction: column; gap: 1px; margin: 0; }
.bill-total span { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.bill-total strong { font-size: 22px; font-weight: 800; line-height: 1.2; letter-spacing: -.01em; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.bill-total--empty strong { color: var(--rb-text-muted); }
.bill-foot .bill-proceed { width: auto; min-width: 240px; padding: 0 22px; }
@container (max-width: 480px) {
  .bill-foot { flex-direction: column; align-items: stretch; }
  .bill-foot .bill-proceed { width: 100%; min-width: 0; }
}

/* ── 3. Payment ── */
.pay { padding: 0; overflow: hidden; gap: 0; container: pay / inline-size; }
.pay-layout { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }

/* What is due: the person, the amount in large type, and how it was arrived at. */
.pay-due {
  flex: none; display: flex; flex-direction: column; gap: 12px; padding: 14px 16px;
  background:
    radial-gradient(80% 140% at 100% 0%, rgba(var(--rb-primary-rgb), .16), transparent 65%),
    var(--rb-surface-alt);
  border-bottom: 1px solid var(--rb-border);
}
.pay-due .summary { background: var(--rb-surface); border: 1px solid var(--rb-border); }

/* How it is paid: the form scrolls inside, the action stays put. */
.pay-take { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.pay-take > .tabs,
.pay-take > .pay-body,
.pay-take > .pay-foot { margin: 0 16px; }

/* A wide panel puts the two side by side. */
@container pay (min-width: 720px) {
  .pay-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); grid-template-rows: minmax(0, 1fr); }
  .pay-due { padding: 20px 24px; overflow-y: auto; border-bottom: 0; border-right: 1px solid var(--rb-border); }
  /* Centred, and no wider than a form reads well on a large screen. */
  .pay-take > .tabs,
  .pay-take > .pay-body,
  .pay-take > .pay-foot { width: min(100% - 48px, 600px); margin: 0 auto; }
  .pay-take > .tabs { margin-top: 20px !important; }
  .pay-due .pay-hero__amount { font-size: 40px; }
}

.pay-hero { flex: none; }
.pay-hero__top { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 20px; }
.pay-hero__title { display: flex; align-items: center; gap: 8px; min-width: 0; margin: 10px 0 0; font-size: 17px; font-weight: 800; color: var(--rb-text-primary); }
.pay-hero__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.txn { font-size: 11.5px; color: var(--rb-text-secondary); white-space: nowrap; }
.txn strong { margin-left: 4px; font-size: 12px; color: var(--rb-text-primary); }
.pay-hero__label { margin: 10px 0 0; font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.pay-hero__amount { margin: 0; font-size: 32px; font-weight: 800; line-height: 1.15; letter-spacing: -.02em; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

.tabs { display: flex; gap: 4px; flex: none; margin-top: 12px !important; padding: 3px; border-radius: 12px; background: var(--rb-surface-alt); }
.tab {
  flex: 1; height: 30px; padding: 0 6px; border: 0; border-radius: 9px; background: transparent;
  font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; white-space: nowrap;
}
.tab:hover:not(.tab--on) { color: var(--rb-text-primary); }
.tab--on { background: var(--rb-surface); color: var(--rb-primary-text); box-shadow: 0 1px 3px rgba(var(--rb-shadow-rgb), .14); }
.tab:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.tab__short { display: none; }
/* A narrow panel: the tabs fall back to one word each. */
@container pay (max-width: 350px) {
  .tab__long { display: none; }
  .tab__short { display: inline; }
}

.pay-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding: 12px 0; }
.pay-foot { flex: none; display: flex; flex-direction: column; gap: 8px; padding: 10px 0 14px; border-top: 1px solid var(--rb-border); }

/* Four tiles in one row. In a narrow panel a long label gives way to its short form. */
.methods { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; flex: none; container-type: inline-size; }
.method {
  display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 4px; border-radius: 12px;
  border: 1px solid var(--rb-border); background: var(--rb-surface); color: var(--rb-text-primary);
  font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
  transition: border-color .15s var(--rb-ease-out), background-color .15s var(--rb-ease-out);
}
.method:hover:not(:disabled) { border-color: rgba(var(--rb-primary-rgb), .45); }
.method--on { border-color: var(--rb-primary); background: var(--rb-primary); color: #fff; box-shadow: 0 6px 14px -8px rgba(var(--rb-primary-rgb), .8); }
.method:disabled { cursor: not-allowed; color: var(--rb-text-muted); }
.method--on:disabled { background: rgba(var(--rb-primary-rgb), .12); border-color: rgba(var(--rb-primary-rgb), .35); color: var(--rb-primary-text); box-shadow: none; }
.method:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.method-label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.method-label--short { display: none; }
@container (max-width: 380px) {
  .method-label--long { display: none; }
  .method-label--short { display: block; }
}

.summary { flex: none; padding: 8px 12px; border-radius: 12px; background: var(--rb-surface-alt); font-variant-numeric: tabular-nums; }
.summary dl, dl.summary { margin: 0; display: flex; flex-direction: column; gap: 3px; }
.summary dl div, dl.summary div { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 12.5px; }
.summary dt { color: var(--rb-text-secondary); display: flex; align-items: center; gap: 6px; }
.summary dd { margin: 0; font-weight: 600; color: var(--rb-text-primary); }
.subsidy-row dt, .subsidy-row dd { color: var(--rb-success-text) !important; }
.summary-due { padding-top: 5px; margin-top: 2px; border-top: 1px solid var(--rb-border-strong); }
.summary-due dt { color: var(--rb-text-primary) !important; font-weight: 700; }
.summary-due dd { font-size: 15px; font-weight: 800 !important; }

.form { display: flex; flex-direction: column; gap: 10px; }
.field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.field-label { font-size: 12px; font-weight: 600; color: var(--rb-text-primary); }
.optional { color: var(--rb-text-muted); font-weight: 400; }
.field-error { font-size: 12px; color: var(--rb-accent-text); margin: 0; }
.input {
  width: 100%; height: var(--pos-ctl); padding: 0 12px; font-size: 13px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 10px;
}
.input::placeholder { color: var(--rb-text-muted); }
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.input:disabled { background: var(--rb-surface-alt); color: var(--rb-text-muted); cursor: not-allowed; }
.refs { display: grid; gap: 10px; }
.refs--split { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.refs--split .field-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.received { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
.money { position: relative; }
.money span { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-weight: 700; font-size: 13px; color: var(--rb-text-secondary); pointer-events: none; }
.money .input { padding-left: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
.money .input--money { font-size: 15px; }

/* Quick cash */
.cash-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.cash-chip {
  padding: 6px 12px; border: 1px solid var(--rb-border-strong); border-radius: 999px; background: var(--rb-surface);
  font-family: inherit; font-size: 12.5px; font-weight: 700; color: var(--rb-text-primary); cursor: pointer; font-variant-numeric: tabular-nums;
}
.cash-chip:hover { border-color: rgba(var(--rb-primary-rgb), .5); color: var(--rb-primary-text); }
.cash-chip--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), .08); color: var(--rb-primary-text); }
.cash-chip:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

/* Change: big, because the cashier reads it aloud */
.change {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-radius: 14px;
  background: rgba(var(--rb-success-rgb), .1); color: var(--rb-success-text);
}
.change__label { font-size: 12.5px; font-weight: 700; }
.change__value { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; text-align: right; }
.change--due { background: rgba(var(--rb-warning-rgb), .12); color: var(--rb-warning-text); }
.change--short { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); }
.change--due .change__value,
.change--short .change__value { font-size: 14px; }

.part-row dt, .part-row dd { color: var(--rb-primary-text); }
.part-ref { margin-left: 6px; font-size: 11px; color: var(--rb-text-secondary); }
.part-remove {
  display: inline-grid; place-items: center; width: 18px; height: 18px; padding: 0; border: 0; border-radius: 5px;
  background: transparent; color: var(--rb-text-muted); cursor: pointer;
}
.part-remove:hover { color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), .08); }
.part-remove:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.ref { display: flex; }
.ref .input { border-radius: 10px 0 0 10px; }
.ref-copy {
  width: 38px; flex: none; display: grid; place-items: center; border: 1px solid var(--rb-border-strong); border-left: 0;
  border-radius: 0 10px 10px 0; background: var(--rb-surface); color: var(--rb-text-secondary); cursor: pointer;
}
.ref-copy:hover:not(:disabled) { color: var(--rb-primary-text); }
.ref-copy:disabled { cursor: not-allowed; color: var(--rb-text-muted); background: var(--rb-surface-alt); }
.ref-copy:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

.subsidy-form { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(var(--rb-success-rgb), .3); background: rgba(var(--rb-success-rgb), .05); }
.subsidy-title { margin: 0; font-size: 13px; font-weight: 700; color: var(--rb-success-text); }

.nothing-due { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 12px; color: var(--rb-success-text); background: rgba(var(--rb-success-rgb), .07); border: 1px solid rgba(var(--rb-success-rgb), .25); }
.nothing-due strong { display: block; font-size: 13px; }
.nothing-due p { margin: 2px 0 0; font-size: 12px; color: var(--rb-text-secondary); }

.settled { margin: 0; display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; }
.settled div { display: flex; justify-content: space-between; gap: 12px; }
.settled dt { color: var(--rb-text-secondary); }
.settled dd { margin: 0; font-weight: 600; color: var(--rb-text-primary); }

.preview { display: flex; flex-direction: column; gap: 8px; }
.preview-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 13px; }
.preview-head span { font-size: 11.5px; color: var(--rb-text-secondary); }
.preview-lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; font-size: 12.5px; }
.preview-lines li { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; border-bottom: 1px dashed var(--rb-border-strong); font-variant-numeric: tabular-nums; }

/* Done: the change, large, then the receipt */
.done { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 4px 0; }
.done .pair { width: 100%; }
.done-mark { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; background: rgba(var(--rb-success-rgb), .14); color: var(--rb-success-text); }
.done-title { font-size: 16px; font-weight: 800; margin: 0; }
.done-change { display: flex; flex-direction: column; align-items: center; width: 100%; padding: 12px; border-radius: 14px; background: rgba(var(--rb-success-rgb), .1); color: var(--rb-success-text); }
.done-change span { font-size: 12.5px; font-weight: 700; }
.done-change strong { font-size: 30px; font-weight: 800; line-height: 1.15; font-variant-numeric: tabular-nums; }
.done-sub { font-size: 12.5px; color: var(--rb-text-secondary); margin: 0; }

.quiet { margin: 0; font-size: 12px; line-height: 1.45; color: var(--rb-text-secondary); }

.banner { display: flex; align-items: flex-start; gap: 8px; padding: 8px 12px; border-radius: 12px; font-size: 12.5px; margin: 0; }
.banner--warn { background: rgba(var(--rb-warning-rgb), .1); color: var(--rb-warning-text); border: 1px solid rgba(var(--rb-warning-rgb), .3); }

.mono { font-family: var(--rb-font-mono); }
.num { text-align: right !important; white-space: nowrap; }
.strong { font-weight: 700; }
.muted { color: var(--rb-text-muted); }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.link { color: var(--rb-primary-text); font-weight: 600; text-decoration: none; }
.link:hover { text-decoration: underline; text-underline-offset: 3px; }
.link-btn {
  display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: transparent; font-family: inherit;
  font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text); cursor: pointer; text-decoration: none; white-space: nowrap;
}
.link-btn:hover { text-decoration: underline; text-underline-offset: 3px; }
.link-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); border-radius: 4px; }
.link-btn--inline { font-size: 11.5px; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: var(--pos-ctl); padding: 0 14px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 999px; cursor: pointer; white-space: nowrap; text-decoration: none;
  transition: background-color .15s var(--rb-ease-out), border-color .15s var(--rb-ease-out);
}
.btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.btn:active:not(:disabled) { transform: translateY(1px); }
.btn-primary { background: var(--rb-primary); color: #fff; border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: var(--rb-primary-hover); }
.btn-outline { background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn-sm { height: 30px; padding: 0 12px; font-size: 12px; }
.btn-block { width: 100%; }
.btn-lg { height: 42px; font-size: 14px; }
.btn-cta { width: 100%; height: 46px; font-size: 14.5px; font-weight: 700; flex: none; box-shadow: 0 10px 20px -12px rgba(var(--rb-primary-rgb), .9); }
.btn-cta:disabled { box-shadow: none; }

.skeleton {
  border-radius: 10px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
.skeleton--row { height: 56px; border-radius: 14px; flex: none; }
.skeleton--line { height: 14px; }
.skeleton--head { height: 46px; }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

.toast-stack { position: fixed; top: 76px; right: 18px; z-index: 120; display: flex; flex-direction: column; gap: 8px; }
.toast { background: var(--rb-surface); border: 1px solid var(--rb-border-strong); border-radius: 14px; padding: 10px 14px; min-width: 240px; box-shadow: 0 10px 28px -10px rgba(var(--rb-shadow-rgb), .3); }
.toast--danger .toast-title { color: var(--rb-accent-text); }
.toast--success .toast-title { color: var(--rb-success-text); }
.toast--info .toast-title { color: var(--rb-primary-text); }
.toast-title { font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.toast-message { font-size: 12px; color: var(--rb-text-secondary); margin-top: 2px; }
.toast-enter-active, .toast-leave-active { transition: opacity .2s, transform .2s var(--rb-ease-out); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(14px); }

/*
 * Desktop: the counter fills the screen under the 64px header, so the
 * payment's action is always in view. The queue, the bill's lines and the
 * payment form scroll inside themselves; below 560px of height the page scrolls.
 */
@media (min-width: 1024px) {
  .pos {
    display: grid;
    height: max(calc(100dvh - 4rem), 588px);
    grid-template-columns: minmax(250px, 300px) minmax(0, 1fr);
    grid-template-rows: auto minmax(560px, 1fr);
    grid-template-areas:
      "shift shift"
      "queue main";
  }
  /* No shift bar (the usual case): no empty first row. */
  .pos:not(:has(> .shift-bar)) {
    grid-template-rows: minmax(560px, 1fr);
    grid-template-areas: "queue main";
  }
  .counter { display: contents; }
  .shift-bar { grid-area: shift; }
  .queue { grid-area: queue; }
  .billcard, .pay { grid-area: main; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .toast-enter-active, .toast-leave-active, .btn, .method, .q-row, .seg-btn { transition: none; }
}

/* Below desktop the page scrolls as one column, with touch-sized controls. */
@media (max-width: 1023px) {
  .pos { --pos-ctl: 40px; }
  .counter { grid-template-columns: 1fr; }
  .queue-list { max-height: 320px; }
  .items { max-height: 280px; }
}

@media (max-width: 640px) {
  .pair, .refs--split, .facts { grid-template-columns: 1fr; }
}
</style>
