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

    <div class="pos-top">
      <!-- NEW TRANSACTION -->
      <section class="card tx" aria-labelledby="tx-title">
        <div class="card-head">
          <h2 id="tx-title" class="card-title">New Transaction</h2>
          <button v-if="bill" type="button" class="link-btn" @click="nextCustomer">
            <AssetIcon name="x" :size="13" />
            Clear
          </button>
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
            {{ c.label }}
          </button>
        </div>

        <!-- Scan or type: a handheld scanner types into this box too. -->
        <div class="search-wrap">
          <form class="search" role="search" @submit.prevent="searchNow('scan')">
            <AssetIcon name="search" :size="15" class="search-icon" />
            <input
              ref="scanInput"
              v-model="scanQuery"
              type="search"
              class="input search-input"
              :placeholder="category === 'patient' ? 'Scan or enter a request or PTR reference' : 'Enter a weekly request reference'"
              :aria-label="category === 'patient' ? 'Scan or enter a request reference' : 'Find a hospital statement'"
              autocomplete="off"
              @focus="openDropdown('scan')"
              @blur="closeDropdownSoon"
              @keydown.esc="dropdown = null"
              @input="onQuery('scan')"
            >
            <button type="button" class="scan-btn" aria-label="Ready the scanner" title="Ready the scanner" @click="focusScanner">
              <AssetIcon name="scan-line" :size="16" />
            </button>
          </form>

          <div v-if="dropdown === 'scan'" class="dropdown" role="listbox" :aria-label="dropdownHeading">
            <p class="dropdown-heading">{{ dropdownHeading }}</p>
            <div v-if="dropdownLoading" class="skeleton skeleton--row" />
            <p v-else-if="!dropdownRows.length" class="dropdown-empty">{{ dropdownEmpty }}</p>
            <button v-for="b in dropdownRows" v-else :key="b.request_id" type="button" role="option" class="dropdown-row" @mousedown.prevent="selectBill(b.request_id)">
              <span class="mono strong">{{ b.reference_number }}</span>
              <BillingBadge v-if="b.is_emergency" tone="danger">STAT</BillingBadge>
              <span class="dropdown-who">{{ b.who }}</span>
              <span class="dropdown-amount" :class="{ 'dropdown-amount--clear': !b.owing }">{{ b.owing ? `${pesos(b.amount)} ${b.amountWord}` : b.status_label }}</span>
            </button>
          </div>
        </div>
        <p v-if="searchError" class="field-error">{{ searchError }}</p>

        <!-- ITEMS: the units held for the request; nothing is added or priced at the counter -->
        <div class="items">
          <table class="grid-table">
            <colgroup>
              <col style="width: 6%">
              <col style="width: 30%">
              <col style="width: 16%">
              <col style="width: 8%">
              <col style="width: 19%">
              <col style="width: 21%">
            </colgroup>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Component</th>
                <th scope="col">Blood type</th>
                <th scope="col" class="num">Qty</th>
                <th scope="col" class="num">Unit price</th>
                <th scope="col" class="num">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="billLoading">
                <tr v-for="n in 3" :key="n"><td colspan="6"><div class="skeleton skeleton--line" /></td></tr>
              </template>
              <template v-else-if="bill && bill.lines?.length">
                <tr v-for="(line, i) in bill.lines" :key="i">
                  <td class="muted">{{ i + 1 }}</td>
                  <td class="ellipsis">{{ line.component_name }}</td>
                  <td><span v-if="line.blood_type" class="type">{{ line.blood_type }}</span><span v-else class="muted">—</span></td>
                  <td class="num">{{ line.quantity }}</td>
                  <td class="num">{{ pesos(line.unit_price) }}</td>
                  <td class="num">{{ pesos(line.line_total) }}</td>
                </tr>
              </template>
              <tr v-else class="empty-row">
                <td colspan="6">
                  {{ bill ? 'No units are held for this request yet.' : 'No items yet. Scan or enter a request reference, or search for the patient below.' }}
                  <button v-if="!bill && queue.length" type="button" class="link-btn" @click="focusScanner">
                    {{ queue.length }} {{ category === 'patient' ? 'awaiting payment' : 'awaiting settlement' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="tx-info">
          <!-- PATIENT / RECIPIENT -->
          <section class="tx-left" aria-labelledby="recipient-title">
            <h3 id="recipient-title" class="sub-title">{{ category === 'weekly' ? 'Hospital / Recipient Information' : 'Patient / Recipient Information' }}</h3>
            <div class="search-wrap">
              <div class="search search--right">
                <input
                  v-model="patientQuery"
                  type="search"
                  class="input search-input"
                  :placeholder="category === 'patient' ? 'Search patient by name' : 'Weekly bills are owed by the hospital'"
                  :disabled="category !== 'patient'"
                  aria-label="Search patient by name"
                  autocomplete="off"
                  @focus="openDropdown('patient')"
                  @blur="closeDropdownSoon"
                  @keydown.esc="dropdown = null"
                  @input="onQuery('patient')"
                >
                <AssetIcon name="search" :size="15" class="search-icon" />
              </div>
              <div v-if="dropdown === 'patient'" class="dropdown dropdown--up" role="listbox" :aria-label="dropdownHeading">
                <p class="dropdown-heading">{{ dropdownHeading }}</p>
                <div v-if="dropdownLoading" class="skeleton skeleton--row" />
                <p v-else-if="!dropdownRows.length" class="dropdown-empty">{{ dropdownEmpty }}</p>
                <button v-for="b in dropdownRows" v-else :key="b.request_id" type="button" role="option" class="dropdown-row" @mousedown.prevent="selectBill(b.request_id)">
                  <span class="mono strong">{{ b.reference_number }}</span>
                  <span class="dropdown-who">{{ b.who }}</span>
                  <span class="dropdown-amount" :class="{ 'dropdown-amount--clear': !b.owing }">{{ b.owing ? `${pesos(b.amount)} ${b.amountWord}` : b.status_label }}</span>
                </button>
              </div>
            </div>

            <div class="person" :class="{ 'person--empty': !bill }">
              <span class="avatar" aria-hidden="true"><AssetIcon :name="weekly ? 'building-2' : 'user'" :size="15" /></span>
              <div class="person-main">
                <strong>{{ recipientName }}</strong>
                <span>{{ recipientLine }}</span>
                <span v-if="bill">{{ recipientExtra }}</span>
              </div>
              <NuxtLink v-if="bill" :to="`/blood-center/statement/${bill.request_id}`" class="link-btn">View details</NuxtLink>
            </div>

            <label class="field">
              <span class="field-label">Received from <span class="optional">(Optional)</span></span>
              <input v-model.trim="payerName" type="text" maxlength="120" class="input" placeholder="Name printed on the receipt, e.g. the patient's watcher" autocomplete="off" :disabled="!canPay">
            </label>
          </section>

          <!-- TRANSACTION DETAILS -->
          <section class="tx-right" aria-labelledby="details-title">
            <h3 id="details-title" class="sub-title detail-wide">Transaction Details</h3>
            <div class="field">
              <span class="field-label">Transaction type</span>
              <span class="readout">{{ bill?.request?.purpose_label || (category === 'weekly' ? 'Blood Bank Replenishment' : 'Patient Transfusion') }}</span>
            </div>
            <div class="field">
              <span class="field-label">Priority</span>
              <span class="readout" :class="{ 'readout--empty': !bill, 'readout--stat': bill?.request?.is_emergency }">{{ bill ? (bill.request?.urgency_label || 'Routine') : '—' }}</span>
            </div>
            <div class="field detail-wide">
              <span class="field-label">{{ weekly ? 'Requested on' : 'Requesting physician / hospital' }}</span>
              <span class="readout" :class="{ 'readout--empty': !bill }">
                {{ !bill ? '—' : weekly ? day(bill.request?.request_date) : (bill.request?.attending_physician || bill.request?.requesting_facility || '—') }}
              </span>
            </div>
          </section>
        </div>

        <p class="note">
          <AssetIcon name="info" :size="14" />
          <span>
            {{ category === 'patient'
              ? 'The government subsidy may cover an eligible patient’s whole bill. Verify eligibility before applying it.'
              : 'Weekly bills are settled by the hospital outside RedAgos; record the settlement once the order closes.' }}
          </span>
        </p>
      </section>

      <!-- PAYMENT -->
      <aside class="card pay" aria-labelledby="pay-title">
        <div class="card-head">
          <h2 id="pay-title" class="card-title card-title--lg">{{ weekly ? 'Settlement' : 'Payment' }}</h2>
          <div class="txn">
            <span>Bill #</span>
            <strong class="mono">{{ bill?.request?.reference_number || '—' }}</strong>
          </div>
        </div>

        <div class="tabs" role="tablist" aria-label="Payment">
          <button
            v-for="t in payTabs"
            :key="t.value"
            role="tab"
            class="tab"
            :class="{ 'tab--on': payTab === t.value }"
            :aria-selected="payTab === t.value"
            @click="payTab = t.value"
          >
            {{ t.label }}
          </button>
        </div>

        <div class="pay-body">
          <!-- DONE: the receipt to hand over -->
          <div v-if="done" class="done">
            <div class="done-mark"><AssetIcon name="check" :size="18" /></div>
            <h3 class="done-title">{{ done.receipts.length > 1 ? `Payment recorded in ${done.receipts.length} parts` : 'Payment recorded' }}</h3>
            <p v-for="r in done.receipts" :key="r.id" class="done-sub">
              Receipt <NuxtLink :to="`/blood-center/receipt/${r.id}`" class="link mono">{{ r.receipt_number }}</NuxtLink>
              · {{ r.payment_method_label }} {{ pesos(r.amount_paid) }}
            </p>
            <div v-if="done.change !== null" class="change-row">
              <span class="field-label">Change to give back</span>
              <strong class="change-box">{{ pesos(done.change) }}</strong>
            </div>
            <button class="btn btn-primary btn-block" @click="printReceipts(done.receipts)">
              <AssetIcon name="printer" :size="15" />
              {{ done.receipts.length > 1 ? 'Print receipts (80mm)' : 'Print receipt (80mm)' }}
            </button>
            <div class="pair">
              <button class="btn btn-outline" :disabled="downloadingReceipt" @click="downloadReceipts(done.receipts)">
                <AssetIcon name="download" :size="15" />
                A4 PDF
              </button>
              <button class="btn btn-outline" @click="nextCustomer">Next customer</button>
            </div>
          </div>

          <!-- STATEMENT PREVIEW: the live bill as the next statement would show it -->
          <div v-else-if="payTab === 'preview'" class="preview">
            <template v-if="bill">
              <div class="preview-head">
                <strong>Statement of Account</strong>
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
              <NuxtLink :to="`/blood-center/statement/${bill.request_id}`" class="btn btn-outline btn-block">
                <AssetIcon name="file-text" :size="15" />
                Open statement to print or issue
              </NuxtLink>
            </template>
            <div v-else class="pay-empty">
              <AssetIcon name="file-text" :size="24" />
              <p>The statement preview appears once a bill is loaded.</p>
            </div>
          </div>

          <div v-else-if="weekly && !bill" class="pay-empty">
            <AssetIcon name="building-2" :size="24" />
            <p>Pick a weekly statement to record the hospital's settlement.</p>
          </div>

          <!-- WEEKLY: no money moves here; the hospital's settlement is recorded -->
          <template v-else-if="weekly">
            <div class="summary">
              <p class="summary-title">Settlement Summary</p>
              <dl>
                <div><dt>Total billed</dt><dd>{{ pesos(bill.total_amount) }}</dd></div>
                <div><dt>Status</dt><dd>{{ bill.status_label }}</dd></div>
                <div class="summary-due"><dt>Owed by the hospital</dt><dd>{{ pesos(bill.settlement ? 0 : bill.total_amount) }}</dd></div>
              </dl>
            </div>
            <dl v-if="bill.settlement" class="settled">
              <div><dt>Settled on</dt><dd>{{ day(bill.settlement.settled_at) }}</dd></div>
              <div><dt>Reference</dt><dd class="mono">{{ bill.settlement.reference }}</dd></div>
            </dl>
            <p v-else-if="!bill.request?.is_closed" class="quiet">The order is still open, so its total can still change. Record the settlement once it closes.</p>
            <form v-else id="settle-form" class="form" @submit.prevent="submitSettlement">
              <label class="field">
                <span class="field-label">Hospital's payment reference</span>
                <input v-model.trim="settlement.settlement_reference" type="text" maxlength="100" class="input mono" placeholder="Cheque or transfer number" required>
                <span v-if="settlementErrors.settlement_reference" class="field-error">{{ settlementErrors.settlement_reference }}</span>
              </label>
              <div class="pair">
                <label class="field">
                  <span class="field-label">Date settled</span>
                  <input v-model="settlement.settled_at" type="date" :max="todayIso" class="input" required>
                </label>
                <label class="field">
                  <span class="field-label">Note <span class="optional">(Optional)</span></span>
                  <input v-model.trim="settlement.settlement_note" type="text" maxlength="500" class="input">
                </label>
              </div>
              <span v-if="settlementErrors.settled_at" class="field-error">{{ settlementErrors.settled_at }}</span>
              <p v-if="settlementError" class="field-error">{{ settlementError }}</p>
            </form>
          </template>

          <!-- PATIENT PAYMENT: the whole form shows, disabled, until a bill is loaded -->
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

            <div class="summary">
              <p class="summary-title">Payment Summary</p>
              <dl>
                <div><dt>Total amount</dt><dd>{{ pesos(bill?.total_amount) }}</dd></div>
                <div class="subsidy-row">
                  <dt>
                    Government subsidy
                    <button v-if="canPay && !subsidyOpen" type="button" class="link-btn link-btn--inline" @click="openSubsidy">Apply</button>
                  </dt>
                  <dd>− {{ pesos(bill?.is_subsidised ? bill.total_amount : 0) }}</dd>
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
                <div class="summary-due">
                  <dt>{{ parts.length ? 'Remaining balance' : 'Amount due' }}</dt>
                  <dd>{{ pesos(parts.length ? entry.remaining : bill?.outstanding) }}</dd>
                </div>
              </dl>
            </div>

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

            <div v-else-if="bill && !takes" class="nothing-due">
              <AssetIcon name="check" :size="18" />
              <div>
                <strong>{{ bill.is_subsidised ? 'Met by the government subsidy' : 'Nothing is due on this bill' }}</strong>
                <p>{{ bill.clears_release ? 'Its blood can be released.' : bill.status_label }}</p>
              </div>
            </div>

            <p v-else-if="bill && shiftsEnabled && !shift" class="banner banner--warn">
              <AssetIcon name="triangle-alert" :size="14" />
              <span>Open a shift above before taking this payment.</span>
            </p>

            <form v-else id="pay-form" class="form" @submit.prevent="footAction === 'add' ? addPart() : takePayment()">
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
                      class="input"
                      :disabled="!canPay"
                      placeholder="0.00"
                    >
                  </div>
                  <button type="button" class="btn btn-outline" :disabled="!canPay" @click="tendered = entry.remaining">Full Amount</button>
                </div>
              </div>

              <div class="change-row">
                <span class="field-label">{{ entry.short > 0 ? 'Remaining' : 'Change' }}</span>
                <strong class="change-box" :class="{ 'change-box--due': entry.short > 0, 'change-box--short': entry.over > 0 }">
                  {{ entry.over > 0 ? `${pesos(entry.over)} more than is due` : entry.short > 0 ? `${pesos(entry.short)} by another method` : pesos(entry.change) }}
                </strong>
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
                  <label for="pay-info" class="field-label" title="Additional information (optional)">Additional information <span class="optional"></span></label>
                  <input
                    id="pay-info"
                    v-model.trim="additionalInfo"
                    type="text"
                    maxlength="100"
                    class="input"
                    placeholder=""
                    autocomplete="off"
                    :disabled="!canPay"
                  >
                </div>
              </div>

              <p v-if="payError" class="field-error">{{ payError }}</p>
            </form>
          </template>
        </div>

        <!-- The panel's action, outside the scrolling form so it never drops below the fold. -->
        <div v-if="footAction" class="pay-foot">
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
          </button>
        </div>
      </aside>
    </div>

    <div class="pos-bottom">
      <!-- RECENT TRANSACTIONS -->
      <section class="card recent" aria-labelledby="recent-title">
        <div class="card-head">
          <h2 id="recent-title" class="card-title">Recent Transactions</h2>
          <NuxtLink to="/blood-center/billing-transactions" class="link-btn">View all</NuxtLink>
        </div>
        <div class="recent-scroll">
          <table class="grid-table grid-table--recent">
            <colgroup>
              <col style="width: 15%">
              <col style="width: 14%">
              <col style="width: 18%">
              <col style="width: 10%">
              <col style="width: 14%">
              <col style="width: 10%">
              <col style="width: 11%">
              <col style="width: 8%">
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Date &amp; time</th>
                <th scope="col">Transaction #</th>
                <th scope="col">Patient / recipient</th>
                <th scope="col">Type</th>
                <th scope="col" class="num">Total amount</th>
                <th scope="col">Method</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="recentLoading">
                <tr v-for="n in 3" :key="n"><td colspan="8"><div class="skeleton skeleton--line" /></td></tr>
              </template>
              <tr v-else-if="!recent.length" class="empty-row">
                <td colspan="8">No recent transactions</td>
              </tr>
              <tr v-for="row in recent" v-else :key="row.id">
                <td class="ellipsis">{{ when(row.occurred_at) }}</td>
                <td class="mono ellipsis">{{ row.transaction_number }}</td>
                <td class="ellipsis">{{ row.request?.patient_name || row.request?.requesting_facility || '—' }}</td>
                <td class="ellipsis">{{ row.type_label }}</td>
                <td class="num">{{ journalAmount(row) }}</td>
                <td class="ellipsis">{{ row.payment_method_label || row.channel_label }}</td>
                <td><BillingBadge :tone="journalStatus(row).tone">{{ journalStatus(row).label }}</BillingBadge></td>
                <td>
                  <NuxtLink v-if="row.receipt" :to="`/blood-center/receipt/${row.receipt.id}`" class="view-btn">View</NuxtLink>
                  <NuxtLink v-else-if="row.request" :to="`/blood-center/statement/${row.request.id}`" class="view-btn">View</NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- PAYMENT STATUS OVERVIEW: this month's patient bills, parts in a fixed order -->
      <section class="card overview" aria-labelledby="overview-title">
        <h2 id="overview-title" class="card-title">Payment Status Overview</h2>
        <div class="overview-body">
          <div class="donut" role="img" :aria-label="ringLabel">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle class="donut-track" cx="60" cy="60" :r="RING_R" />
              <circle
                v-for="arc in arcs"
                :key="arc.key"
                class="donut-arc"
                :class="[`arc--${arc.key}`, { 'donut-arc--dim': hovered && hovered !== arc.key }]"
                cx="60"
                cy="60"
                :r="RING_R"
                :stroke-dasharray="`${arc.length} ${RING_C}`"
                :stroke-dashoffset="-arc.offset"
                @mouseenter="hovered = arc.key"
                @mouseleave="hovered = null"
              />
            </svg>
            <div class="donut-center">
              <strong>{{ billsTotal }}</strong>
              <span>bills<span class="donut-when"> this month</span></span>
            </div>
          </div>
          <ul class="legend">
            <li
              v-for="s in shares"
              :key="s.key"
              class="legend-row"
              :class="{ 'legend-row--on': hovered === s.key }"
              @mouseenter="hovered = s.key"
              @mouseleave="hovered = null"
            >
              <span class="swatch" :class="`arc--${s.key}`" aria-hidden="true" />
              <span class="legend-label">{{ s.label }}</span>
              <span class="legend-count">{{ s.count }} <small>({{ Math.round(s.share * 100) }}%)</small></span>
            </li>
          </ul>
        </div>
      </section>
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
 * The workspace follows the owner's POS reference (2026-10-11) inside the
 * dashboard's usual header and sidebar, which this page leaves alone: New
 * Transaction and Payment side by side, Recent Transactions and the status
 * overview beneath. It follows the chosen theme. The whole layout renders
 * before any bill is loaded, with empty and disabled states, and fits a
 * 1366×768 screen without the page scrolling; long lists scroll inside.
 *
 * Everything that matters is decided by the server: what is due, whether the
 * payment went in, and whether the counter works in cash shifts at all. Off —
 * one billing staff member, the default — a payment is taken straight away.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import BillingBadge from '~/components/BloodCenter/BillingBadge.vue'
import CashCountDialog from '~/components/BloodCenter/CashCountDialog.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import {
  billStatusShares,
  isCounterEvent,
  journalAmount,
  journalStatus,
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
  { value: 'patient', label: 'Patient Bills' },
  { value: 'weekly', label: 'Hospital Billing / Restocking' },
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

function when(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'
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

/* FIND A BILL: the scan bar and the patient search share one dropdown */
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
let blurTimer = null

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

const activeQuery = computed(() => (dropdown.value === 'patient' ? patientQuery.value : scanQuery.value).trim())
const dropdownRows = computed(() => (activeQuery.value.length >= 2 ? results.value : queue.value))
const dropdownLoading = computed(() => (activeQuery.value.length >= 2 ? searching.value : queueLoading.value))
const dropdownHeading = computed(() => {
  if (activeQuery.value.length >= 2) return 'Results'
  return category.value === 'patient' ? 'Awaiting payment' : 'Awaiting hospital settlement'
})
const dropdownEmpty = computed(() => {
  if (activeQuery.value.length >= 2) return `Nothing matches “${activeQuery.value}”.`
  return category.value === 'patient' ? 'No patient bill is holding blood back.' : 'No weekly statement is waiting for the hospital.'
})

function openDropdown(which) {
  clearTimeout(blurTimer)
  dropdown.value = which
}

// Late enough for a click on a row to land first.
function closeDropdownSoon() {
  blurTimer = setTimeout(() => { dropdown.value = null }, 150)
}

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
const weekly = computed(() => Boolean(bill.value?.is_statement_only) || category.value === 'weekly')
const takes = computed(() => (bill.value ? takesPayment(bill.value) : false))

const recipientName = computed(() => {
  if (!bill.value) return category.value === 'weekly' ? 'No hospital selected' : 'No patient selected'
  return weekly.value ? (bill.value.request?.requesting_facility || 'Hospital') : (bill.value.request?.patient_name || 'Patient')
})

const recipientLine = computed(() => {
  const r = bill.value?.request
  if (!r) return category.value === 'weekly' ? 'Enter the weekly request above' : 'Scan a request or search by name'
  return weekly.value ? `Weekly order ${r.reference_number}` : `Request ${r.reference_number}`
})

const recipientExtra = computed(() => {
  const r = bill.value?.request
  if (!r) return ''
  if (weekly.value) return r.blood_type ? `Blood types ${r.blood_type}` : 'Billed by statement'

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

  try {
    bill.value = (await bloodCenterService.billingForRequest(requestId))?.billing ?? null
    category.value = bill.value?.is_statement_only ? 'weekly' : 'patient'
    payTab.value = category.value === 'weekly' ? 'settle' : 'method'
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
  ? [{ value: 'settle', label: 'Settlement' }, { value: 'preview', label: 'Statement Preview' }]
  : [{ value: 'method', label: 'Payment Method' }, { value: 'preview', label: 'Statement Preview' }]))

// Only a loaded bill with something due can be paid; the layout shows either way.
const canPay = computed(() => Boolean(bill.value) && takes.value && !(shiftsEnabled.value && !shift.value))
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

// Which action the panel's footer offers: the payment, a part of it, the settlement, or none.
const footAction = computed(() => {
  if (done.value || payTab.value === 'preview') return null

  if (weekly.value) {
    return bill.value && !bill.value.settlement && bill.value.request?.is_closed ? 'settle' : null
  }

  if (subsidyOpen.value || (bill.value && !takes.value) || (bill.value && shiftsEnabled.value && !shift.value)) return null

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

    done.value = {
      receipts: response?.receipts ?? (response?.receipt ? [response.receipt] : []),
      change: response?.change_given == null ? null : Number(response.change_given),
    }
    parts.value = []

    // The bill, the queue, the day and the drawer have all moved.
    await Promise.all([loadShift(), loadQueue(), loadRecent(), loadSummary()])
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
    await Promise.all([selectBill(bill.value.request_id), loadQueue(), loadRecent(), loadSummary()])
  } catch (err) {
    subsidyError.value = err?.message || 'Could not apply the subsidy.'
  } finally {
    saving.value = false
  }
}

/* A WEEKLY BILL'S SETTLEMENT. No money moves through RedAgos. */
const settlement = reactive({ settlement_reference: '', settled_at: todayIso, settlement_note: '' })
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
    await Promise.all([selectBill(bill.value.request_id), loadQueue(), loadRecent(), loadSummary()])
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
// A split payment's receipts print together, one after another on the roll.
function printReceipts(receipts) {
  const [first, ...rest] = (receipts ?? []).filter((r) => r?.id)
  if (!first) return

  const also = rest.length ? `&with=${rest.map((r) => r.id).join(',')}` : ''
  window.open(`/blood-center/receipt-print/${first.id}?auto=1${also}`, '_blank')
}

async function downloadReceipts(receipts) {
  const list = (receipts ?? []).filter((r) => r?.id)
  if (!list.length) return
  downloadingReceipt.value = true

  try {
    for (const receipt of list) {
      saveBlob(await bloodCenterService.downloadReceipt(receipt.id), `${receipt.receipt_number}.pdf`)
    }
  } catch (err) {
    toast('Download Failed', 'danger', err?.message || 'The receipt could not be downloaded.')
  } finally {
    downloadingReceipt.value = false
  }
}

/* RECENT TRANSACTIONS, AND THE MONTH'S BILLS BY STATUS */
const recent = ref([])
const recentLoading = ref(true)
const summary = ref(null)
const hovered = ref(null)

const RING_R = 46
const RING_C = 2 * Math.PI * RING_R
// A surface gap between neighbouring parts, so no two colours touch.
const RING_GAP = 2

const shares = computed(() => billStatusShares(summary.value?.patient_bills_this_month))
const billsTotal = computed(() => shares.value.reduce((sum, s) => sum + s.count, 0))
const ringLabel = computed(() => `${billsTotal.value} patient bills this month: ${shares.value.map((s) => `${s.label} ${s.count}`).join(', ')}`)

const arcs = computed(() => {
  const parts = shares.value.filter((s) => s.count > 0)
  const gap = parts.length > 1 ? RING_GAP : 0
  let offset = 0

  return parts.map((s) => {
    const span = s.share * RING_C
    const arc = { key: s.key, length: Math.max(span - gap, 0.5), offset }
    offset += span
    return arc
  })
})

// The latest money events at the counter: payments, voids, subsidies, settlements.
async function loadRecent() {
  try {
    const rows = (await bloodCenterService.billingTransactions({ per_page: 30 }))?.data ?? []
    recent.value = rows.filter(isCounterEvent).slice(0, 10)
  } catch {
    recent.value = []
  } finally {
    recentLoading.value = false
  }
}

async function loadSummary() {
  try {
    summary.value = await bloodCenterService.billingSummary()
  } catch {
    // The overview is a convenience; the counter works without it.
  }
}

// Cash is counted as handed over; any other method is for what is left, unless the cashier splits it.
watch(method, (value) => {
  payError.value = ''
  tendered.value = value === 'cash' || !bill.value ? null : entry.value.remaining
})

onMounted(async () => {
  await Promise.all([loadShift(), loadQueue(), loadRecent(), loadSummary()])

  // From a statement: "Take payment" opens the bill here.
  const preset = Number(route.query.request)
  if (preset) await selectBill(preset)
  else scanInput.value?.focus()
})

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  clearTimeout(blurTimer)
})
</script>

<style scoped>
/*
 * The POS reference's composition in this system's tokens, which follow the
 * theme. Only this workspace is styled here; the header and sidebar are the
 * layout's.
 *
 * Sized for a 1366×768 screen at 100% zoom, where the browser leaves the page
 * about 600–700px of height: compact controls (--pos-ctl), tight card padding
 * and 11–12px text. A taller screen gets roomier sizes (bottom of the file).
 */
.pos {
  --pos-ctl: 28px;
  --pos-card-pad: 10px 14px;
  --pos-card-gap: 6px;
  --pos-donut: clamp(76px, 12vh, 100px);

  font-family: var(--rb-font-sans);
  padding: 10px 14px;
  display: flex; flex-direction: column; gap: 10px;
  color: var(--rb-text-primary);

  /*
   * Bill status as a chart fill, in this order: paid, subsidised, part paid,
   * unpaid. Validated for colour-blind separation of neighbours on each
   * theme's surface; always shown beside a label and a count.
   */
  --pos-chart-paid: #2E7D32;
  --pos-chart-subsidised: #7C3AED;
  --pos-chart-partial: #F57C00;
  --pos-chart-unpaid: #D32F2F;
}

/* Their own steps on the dark surface, not a flip: amber and red pulled apart in lightness. */
:global(.dark .pos) {
  --pos-chart-paid: #43A047;
  --pos-chart-subsidised: #8B5CF6;
  --pos-chart-partial: #C4830A;
  --pos-chart-unpaid: #B92727;
}

/* Shift bar, one line */
.shift-bar, .shift-open { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; }
.shift-bar { flex: none; padding: 5px 10px; background: var(--rb-surface); border: 1px solid var(--rb-border-strong); border-radius: 10px; }
.shift-bar--open { border-color: rgba(var(--rb-success-rgb), .45); }
.shift-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--rb-success); flex: none; }
.shift-dot--off { background: var(--rb-text-muted); }
.spacer { flex: 1; }
.shift-bar .input--sm { width: 130px; height: 26px; padding: 0 8px; font-size: 12px; }

/* The two rows: bill and payment (about 59/41), then the day (about 72/28). */
.pos-top { display: grid; grid-template-columns: minmax(0, 1.47fr) minmax(0, 1fr); gap: 10px; }
.pos-bottom { display: grid; grid-template-columns: minmax(0, 2.6fr) minmax(0, 1fr); gap: 10px; }

.card {
  background: var(--rb-surface); border: 1px solid var(--rb-border-strong); border-radius: 10px;
  box-shadow: var(--rb-shadow-sm); padding: var(--pos-card-pad); min-width: 0; min-height: 0;
  display: flex; flex-direction: column; gap: var(--pos-card-gap);
}
.card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex: none; }
.card-title { margin: 0; font-size: 14px; line-height: 1.3; font-weight: 700; color: var(--rb-text-primary); }
.card-title--lg { font-size: 15px; }
.sub-title { margin: 0; font-size: 12px; line-height: 1.3; font-weight: 700; color: var(--rb-text-primary); }

/* New Transaction */
.seg { display: flex; flex: none; }
.seg-btn {
  height: var(--pos-ctl); padding: 0 14px; font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
  color: var(--rb-text-secondary); background: var(--rb-surface-alt); border: 1px solid var(--rb-border-strong);
}
.seg-btn:first-child { border-radius: 7px 0 0 7px; }
.seg-btn:last-child { border-radius: 0 7px 7px 0; border-left: 0; }
.seg-btn:hover { color: var(--rb-text-primary); }
.seg-btn--on, .seg-btn--on:hover { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.seg-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); position: relative; }

.search-wrap { position: relative; flex: none; }
.search { position: relative; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--rb-text-muted); pointer-events: none; }
/* Scoped under .search so it outranks .input's padding, declared further down. */
.search .search-input { padding: 0 42px 0 32px; }
.search--right .search-input { padding: 0 32px 0 10px; }
.search--right .search-icon { left: auto; right: 10px; }
.scan-btn {
  position: absolute; right: 1px; top: 1px; bottom: 1px; width: 36px; display: grid; place-items: center;
  border: 0; border-left: 1px solid var(--rb-border-strong); border-radius: 0 6px 6px 0; background: transparent;
  color: var(--rb-text-secondary); cursor: pointer;
}
.scan-btn:hover { color: var(--rb-primary-text); background: var(--rb-surface-hover); }
.scan-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

/* A dropdown sits over what is below it; nothing above it clips. */
.dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 30; max-height: min(220px, 40vh); overflow-y: auto;
  padding: 5px; border-radius: 9px; background: var(--rb-surface); border: 1px solid var(--rb-border-strong);
  box-shadow: 0 12px 28px -8px rgba(var(--rb-shadow-rgb), .25);
}
/* Low in its panel, so it opens upward over the items rather than past the panel's edge. */
.dropdown--up { top: auto; bottom: calc(100% + 4px); }
.dropdown-heading { margin: 2px 8px 4px; font-size: 11px; font-weight: 700; color: var(--rb-text-secondary); }
.dropdown-empty { margin: 2px 8px 5px; font-size: 11.5px; color: var(--rb-text-muted); }
.dropdown-row {
  width: 100%; display: grid; grid-template-columns: auto auto 1fr auto; align-items: center; gap: 4px 10px; padding: 6px 8px;
  border: 0; border-radius: 6px; background: transparent; font-family: inherit; font-size: 12px; color: var(--rb-text-primary); text-align: left; cursor: pointer;
}
.dropdown-row:hover, .dropdown-row:focus-visible { background: var(--rb-surface-hover); outline: none; }
.dropdown-who { color: var(--rb-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.dropdown-amount { font-weight: 700; color: var(--rb-accent-text); white-space: nowrap; font-variant-numeric: tabular-nums; }
.dropdown-amount--clear { color: var(--rb-success-text); }

/* Tables: fixed columns, so nothing pushes the page sideways. */
.grid-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 11.5px; font-variant-numeric: tabular-nums; }
.grid-table th {
  position: sticky; top: 0; z-index: 1; text-align: left; font-size: 11px; font-weight: 600; color: var(--rb-text-secondary);
  background: var(--rb-surface-alt); padding: 5px 9px; border-bottom: 1px solid var(--rb-border-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.grid-table td { padding: 5px 9px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); vertical-align: middle; }
.grid-table tbody tr:last-child td { border-bottom: 0; }
.empty-row td { text-align: center; color: var(--rb-text-muted); padding: 10px 9px; white-space: normal; }
.empty-row .link-btn { margin-left: 6px; }

/* The bill's lines take whatever height the panel has left, and scroll inside it. */
.items { flex: 1 1 auto; min-height: 58px; overflow: auto; border: 1px solid var(--rb-border-strong); border-radius: 8px; }
.type { display: inline-block; min-width: 28px; text-align: center; padding: 0 5px; border-radius: 5px; font-size: 10.5px; font-weight: 700; color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), .08); }

.tx-info { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; flex: none; }
.tx-left { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.tx-right { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-content: start; gap: 5px 8px; min-width: 0; padding: 8px 10px; border: 1px solid var(--rb-border-strong); border-radius: 9px; }
.detail-wide { grid-column: 1 / -1; }

.person { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 8px; background: var(--rb-surface-alt); border: 1px solid var(--rb-border-strong); min-width: 0; }
.person--empty { border-style: dashed; }
.avatar { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; flex: none; color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .1); }
.person--empty .avatar { color: var(--rb-text-muted); background: var(--rb-surface); border: 1px solid var(--rb-border-strong); }
.person-main { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.3; }
.person-main strong { font-size: 12px; color: var(--rb-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.person--empty .person-main strong { color: var(--rb-text-secondary); font-weight: 600; }
.person-main span { font-size: 11px; color: var(--rb-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.readout {
  display: block; height: var(--pos-ctl); line-height: calc(var(--pos-ctl) - 2px); padding: 0 9px; border-radius: 7px;
  border: 1px solid var(--rb-border-strong); background: var(--rb-surface);
  font-size: 12px; color: var(--rb-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.readout--empty { color: var(--rb-text-muted); }
.readout--stat { color: var(--rb-accent-text); font-weight: 700; }

.note { display: flex; gap: 7px; align-items: center; margin: 0; padding: 5px 10px; border-radius: 8px; font-size: 11px; line-height: 1.35; color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .06); border: 1px solid rgba(var(--rb-primary-rgb), .18); flex: none; }

/* Payment */
.txn { display: flex; align-items: baseline; gap: 5px; line-height: 1.3; white-space: nowrap; }
.txn span { font-size: 10px; color: var(--rb-text-secondary); }
.txn strong { font-size: 11.5px; color: var(--rb-text-primary); }
.tabs { display: flex; border-bottom: 1px solid var(--rb-border-strong); flex: none; }
.tab {
  flex: 1; padding: 2px 4px 6px; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; background: transparent;
  font-family: inherit; font-size: 12px; font-weight: 500; color: var(--rb-text-secondary); cursor: pointer; white-space: nowrap;
}
.tab:hover { color: var(--rb-text-primary); }
.tab--on { color: var(--rb-primary-text); font-weight: 600; border-bottom-color: var(--rb-primary); }
.tab:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.pay-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.pay-foot { flex: none; }
.pay-empty { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 18px 8px; color: var(--rb-text-muted); text-align: center; }
.pay-empty p { margin: 0; font-size: 11.5px; color: var(--rb-text-secondary); }

/* Four tiles in one row. In a narrow panel a long label gives way to its short form. */
.methods { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; flex: none; container-type: inline-size; }
.method {
  display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 4px; border-radius: 8px;
  border: 1px solid var(--rb-border-strong); background: var(--rb-surface); color: var(--rb-text-primary);
  font-family: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer;
  transition: border-color .15s var(--rb-ease-out), background-color .15s var(--rb-ease-out);
}
.method:hover:not(:disabled) { border-color: rgba(var(--rb-primary-rgb), .45); }
.method--on { border-color: var(--rb-primary); background: var(--rb-primary); color: #fff; }
.method:disabled { cursor: not-allowed; color: var(--rb-text-muted); }
.method--on:disabled { background: rgba(var(--rb-primary-rgb), .12); border-color: rgba(var(--rb-primary-rgb), .35); color: var(--rb-primary-text); }
.method:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.method-label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.method-label--short { display: none; }
@container (max-width: 380px) {
  .method-label--long { display: none; }
  .method-label--short { display: block; }
}

.summary { flex: none; padding: 5px 10px; border-radius: 9px; border: 1px solid var(--rb-border-strong); font-variant-numeric: tabular-nums; }
.summary-title { margin: 0 0 1px; font-size: 12.5px; font-weight: 700; color: var(--rb-text-primary); }
.summary dl, dl.summary { margin: 0; display: flex; flex-direction: column; gap: 1px; }
.summary dl div, dl.summary div { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 11.5px; }
.summary dt { color: var(--rb-text-secondary); display: flex; align-items: center; gap: 6px; }
.summary dd { margin: 0; font-weight: 600; color: var(--rb-text-primary); }
.subsidy-row dt, .subsidy-row dd { color: var(--rb-success-text) !important; }
.summary-due { padding-top: 4px; margin-top: 1px; border-top: 1px solid var(--rb-border-strong); }
.summary-due dt { color: var(--rb-text-primary) !important; font-weight: 700; font-size: 12px; }
.summary-due dd { font-size: 14px; font-weight: 800 !important; }

.form { display: flex; flex-direction: column; gap: 6px; }
.field { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.field-label { font-size: 11.5px; font-weight: 600; color: var(--rb-text-primary); }
.optional { color: var(--rb-text-muted); font-weight: 400; }
.field-error { font-size: 11px; color: var(--rb-accent-text); margin: 0; }
.input {
  width: 100%; height: var(--pos-ctl); padding: 0 9px; font-size: 12px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 7px;
}
.input::placeholder { color: var(--rb-text-muted); }
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.input:disabled { background: var(--rb-surface-alt); color: var(--rb-text-muted); cursor: not-allowed; }
.refs { display: grid; gap: 6px; }
.refs--split { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.refs--split .field-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.received { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
.money { position: relative; }
.money span { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); font-weight: 700; font-size: 12px; color: var(--rb-text-secondary); pointer-events: none; }
.money .input { padding-left: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
.change-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex: none; }
.change-box {
  min-width: 46%; padding: 3px 10px; border-radius: 7px; text-align: right; font-size: 12.5px; font-weight: 700;
  color: var(--rb-success-text); background: rgba(var(--rb-success-rgb), .1); font-variant-numeric: tabular-nums;
}
.change-box--short { color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), .08); }
.change-box--due { color: var(--rb-warning-text); background: rgba(var(--rb-warning-rgb), .12); }
.part-row dt, .part-row dd { color: var(--rb-primary-text); }
.part-ref { margin-left: 6px; font-size: 10.5px; color: var(--rb-text-secondary); }
.part-remove {
  display: inline-grid; place-items: center; width: 16px; height: 16px; padding: 0; border: 0; border-radius: 4px;
  background: transparent; color: var(--rb-text-muted); cursor: pointer;
}
.part-remove:hover { color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), .08); }
.part-remove:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.ref { display: flex; }
.ref .input { border-radius: 7px 0 0 7px; }
.ref-copy {
  width: 32px; flex: none; display: grid; place-items: center; border: 1px solid var(--rb-border-strong); border-left: 0;
  border-radius: 0 7px 7px 0; background: var(--rb-surface); color: var(--rb-text-secondary); cursor: pointer;
}
.ref-copy:hover:not(:disabled) { color: var(--rb-primary-text); }
.ref-copy:disabled { cursor: not-allowed; color: var(--rb-text-muted); background: var(--rb-surface-alt); }
.ref-copy:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }

.subsidy-form { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border-radius: 9px; border: 1px solid rgba(var(--rb-success-rgb), .3); background: rgba(var(--rb-success-rgb), .05); }
.subsidy-title { margin: 0; font-size: 12px; font-weight: 700; color: var(--rb-success-text); }

.nothing-due { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; border-radius: 9px; color: var(--rb-success-text); background: rgba(var(--rb-success-rgb), .07); border: 1px solid rgba(var(--rb-success-rgb), .25); }
.nothing-due strong { display: block; font-size: 12px; }
.nothing-due p { margin: 2px 0 0; font-size: 11px; color: var(--rb-text-secondary); }

.settled { margin: 0; display: flex; flex-direction: column; gap: 3px; font-size: 11.5px; }
.settled div { display: flex; justify-content: space-between; gap: 12px; }
.settled dt { color: var(--rb-text-secondary); }
.settled dd { margin: 0; font-weight: 600; color: var(--rb-text-primary); }

.preview { display: flex; flex-direction: column; gap: 7px; }
.preview-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 12px; }
.preview-head span { font-size: 11px; color: var(--rb-text-secondary); }
.preview-lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; font-size: 11.5px; }
.preview-lines li { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; border-bottom: 1px dashed var(--rb-border-strong); font-variant-numeric: tabular-nums; }

.done { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; padding: 2px 0; }
.done .change-row { width: 100%; }
.done .pair { width: 100%; }
.done-mark { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: rgba(var(--rb-success-rgb), .14); color: var(--rb-success-text); }
.done-title { font-size: 14px; font-weight: 800; margin: 0; }
.done-sub { font-size: 11.5px; color: var(--rb-text-secondary); margin: 0; }

.quiet { margin: 0; font-size: 11px; line-height: 1.4; color: var(--rb-text-secondary); }

/* Recent transactions */
.recent-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; border: 1px solid var(--rb-border-strong); border-radius: 8px; }
.view-btn {
  display: inline-block; padding: 1px 8px; border-radius: 6px; border: 1px solid var(--rb-border-strong); background: var(--rb-surface);
  font-size: 11px; font-weight: 600; color: var(--rb-primary-text); text-decoration: none;
}
.view-btn:hover { background: var(--rb-surface-hover); }
.view-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

/* Overview: a ring with a surface gap between parts, and a legend that names every count. */
.overview-body { display: flex; align-items: center; gap: 12px; flex: 1 1 auto; min-height: 0; }
.donut { position: relative; width: var(--pos-donut); height: var(--pos-donut); flex: none; }
.donut svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.donut-track { fill: none; stroke: var(--rb-surface-alt); stroke-width: 15; }
.donut-arc { fill: none; stroke-width: 15; transition: opacity .15s var(--rb-ease-out); }
.donut-arc--dim { opacity: .3; }
.donut-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.donut-center strong { font-size: 18px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
.donut-center span { font-size: 9.5px; color: var(--rb-text-secondary); margin-top: 2px; max-width: 60px; line-height: 1.2; }
.arc--paid { stroke: var(--pos-chart-paid); background: var(--pos-chart-paid); }
.arc--subsidised { stroke: var(--pos-chart-subsidised); background: var(--pos-chart-subsidised); }
.arc--partial { stroke: var(--pos-chart-partial); background: var(--pos-chart-partial); }
.arc--unpaid { stroke: var(--pos-chart-unpaid); background: var(--pos-chart-unpaid); }
.legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.legend-row { display: grid; grid-template-columns: 9px 1fr auto; align-items: center; gap: 8px; padding: 2px 6px; border-radius: 6px; font-size: 11.5px; line-height: 1.35; font-variant-numeric: tabular-nums; }
.legend-row--on { background: var(--rb-surface-hover); }
.swatch { width: 8px; height: 8px; border-radius: 50%; }
.legend-label { color: var(--rb-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.legend-count { font-weight: 600; white-space: nowrap; }
.legend-count small { font-size: 10.5px; font-weight: 500; color: var(--rb-text-secondary); }

.banner { display: flex; align-items: flex-start; gap: 8px; padding: 6px 10px; border-radius: 8px; font-size: 11.5px; margin: 0; }
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
  font-size: 11.5px; font-weight: 600; color: var(--rb-primary-text); cursor: pointer; text-decoration: none; white-space: nowrap;
}
.link-btn:hover { text-decoration: underline; text-underline-offset: 3px; }
.link-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); border-radius: 4px; }
.link-btn--inline { font-size: 11px; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: var(--pos-ctl); padding: 0 10px; font-size: 12px; font-weight: 600; font-family: inherit;
  border-radius: 7px; cursor: pointer; white-space: nowrap; text-decoration: none;
  transition: background-color .15s var(--rb-ease-out);
}
.btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.btn-primary { background: var(--rb-primary); color: #fff; border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: #10509c; }
.btn-outline { background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn-sm { height: 26px; padding: 0 9px; font-size: 11.5px; }
.btn-block { width: 100%; }
.btn-cta { width: 100%; height: 34px; font-size: 13px; border-radius: 8px; flex: none; }

.skeleton {
  border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
.skeleton--row { height: var(--pos-ctl); margin: 4px; }
.skeleton--line { height: 12px; }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

.toast-stack { position: fixed; top: 76px; right: 18px; z-index: 120; display: flex; flex-direction: column; gap: 8px; }
.toast { background: var(--rb-surface); border: 1px solid var(--rb-border-strong); border-radius: 10px; padding: 10px 14px; min-width: 240px; box-shadow: 0 6px 20px rgba(var(--rb-shadow-rgb), .1); }
.toast--danger .toast-title { color: var(--rb-accent-text); }
.toast--success .toast-title { color: var(--rb-success-text); }
.toast--info .toast-title { color: var(--rb-primary-text); }
.toast-title { font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.toast-message { font-size: 12px; color: var(--rb-text-secondary); margin-top: 2px; }
.toast-enter-active, .toast-leave-active { transition: opacity .2s, transform .2s var(--rb-ease-out); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(14px); }

/*
 * Desktop: one screen, no page scroll. The page takes what the 64px bar
 * leaves. The day row takes a share of the height (20vh, within limits) and
 * the bill and payment share the rest. Only the items, the payment form and
 * the recent list scroll, inside themselves, if their content runs long.
 */
@media (min-width: 1024px) {
  .pos { height: calc(100dvh - 64px); min-height: 480px; overflow: hidden; }
  .pos-top { flex: 1 1 auto; min-height: 0; }
  .pos-bottom { flex: none; height: clamp(120px, 20vh, 172px); }
  /* A card never spills into the row below; its dropdowns open inside it. */
  .tx, .pay, .recent, .overview { overflow: hidden; }
}

/* A short window (a 1366×768 screen under a browser's bars and bookmarks): tighter still. */
@media (min-width: 1024px) and (max-height: 640px) {
  .pos {
    --pos-ctl: 26px;
    --pos-card-pad: 8px 12px;
    --pos-card-gap: 5px;
    --pos-donut: clamp(64px, 11vh, 76px);
    padding: 8px 12px; gap: 8px;
  }
  .pos-top, .pos-bottom { gap: 8px; }
  .pos-bottom { height: clamp(112px, 18vh, 124px); }
  .legend { gap: 0; }
  /* The ring is too small for the whole caption; the count keeps its noun. */
  .donut-when { display: none; }
  .legend-row { padding: 1px 6px; line-height: 1.3; }
}

/* A taller screen: roomier controls and cards, and a deeper day row. */
@media (min-width: 1024px) and (min-height: 860px) {
  .pos {
    --pos-ctl: 32px;
    --pos-card-pad: 16px 18px;
    --pos-card-gap: 12px;
    --pos-donut: 124px;
    padding: 16px 20px; gap: 14px;
  }
  .pos-top, .pos-bottom { gap: 14px; }
  .pos-bottom { height: 214px; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .toast-enter-active, .toast-leave-active, .btn, .method, .donut-arc { transition: none; }
}

/* Below desktop the page scrolls as one column, with touch-sized controls. */
@media (max-width: 1023px) {
  .pos { --pos-ctl: 34px; }
  .pos-top, .pos-bottom { grid-template-columns: 1fr; }
  .items { max-height: 260px; }
  .recent-scroll { max-height: 300px; }
}

@media (max-width: 640px) {
  .tx-info, .pair, .refs--split { grid-template-columns: 1fr; }
  .seg { width: 100%; }
  .seg-btn { flex: 1; height: auto; min-height: var(--pos-ctl); padding: 6px 8px; }
  .overview-body { flex-direction: column; align-items: stretch; }
  .donut { align-self: center; }
}
</style>
