<template>
  <div class="ptr-page">
    <div class="ptr-inner">
      <header class="page-header">
        <NuxtLink to="/hospital/bloodrequests" class="back-link">
          <AssetIcon name="arrow-left" :size="14" />
          Back to Blood Requests
        </NuxtLink>

        <div v-if="request" class="page-header__row">
          <div>
            <p class="eyebrow">Patient Transfusion Request</p>
            <h1 class="page-title mono">{{ request.reference_number }}</h1>
            <p class="page-subtitle">
              {{ request.patient?.full_name || '—' }}
              · {{ request.blood_type?.code || '—' }}
              · <span :class="{ 'stat': request.is_emergency }">{{ PRIORITY_LABELS[request.urgency_level] || request.urgency_label }}</span>
              · {{ request.source_label }}
            </p>
          </div>
          <span class="status-chip" :class="`tone--${statusTone}`">{{ transfusionProgressLabel(request) }}</span>
        </div>
        <h1 v-else class="page-title">Patient Transfusion Request</h1>
      </header>

      <div v-if="loading" class="panel" aria-busy="true">
        <div class="skeleton" style="width:40%" />
        <div class="skeleton" style="width:75%" />
        <div class="skeleton" style="width:60%" />
      </div>

      <div v-else-if="loadError" class="panel panel--error" role="alert">
        <p>{{ loadError }}</p>
        <button type="button" class="btn" @click="load">Try again</button>
      </div>

      <template v-else-if="request">
        <div v-if="actionError" class="banner banner--error" role="alert">
          <AssetIcon name="triangle-alert" :size="16" />
          <span>{{ actionError }}</span>
        </div>

        <!-- UNITS ASKED OF NOBODY -->
        <section v-if="request.is_open && request.needs_allocation" class="panel panel--attention">
          <div class="attention">
            <AssetIcon name="circle-alert" :size="18" />
            <div class="attention__text">
              <h2 class="panel-title">
                {{ request.totals.unallocated }} unit{{ request.totals.unallocated === 1 ? '' : 's' }} still unallocated
              </h2>
              <p class="panel-hint">
                No facility has been asked for {{ request.totals.unallocated === 1 ? 'it' : 'them' }}, or a facility could
                not supply {{ request.totals.unallocated === 1 ? 'it' : 'them' }}. Search again to ask another facility.
              </p>
            </div>
            <button v-if="!allocating" type="button" class="btn btn--primary" @click="openAllocate">
              <AssetIcon name="search" :size="15" />
              Allocate remaining units
            </button>
          </div>

          <div v-if="allocating" class="allocate">
            <SourcingPanel
              v-model="split"
              :plan="plan"
              mode="remaining"
              :loading="planLoading"
              :error="planError"
              @retry="loadPlan"
            />
            <div class="allocate__actions">
              <button type="button" class="btn" :disabled="sending" @click="allocating = false">Cancel</button>
              <button
                type="button"
                class="btn btn--primary"
                :disabled="sending || !plan || splitProblems.length > 0"
                @click="sendAllocations"
              >
                <AssetIcon name="send" :size="15" />
                {{ sending ? 'Sending…' : 'Send to facilities' }}
              </button>
            </div>
          </div>
        </section>

        <p v-if="request.status === 'cancelled'" class="banner banner--muted">
          Cancelled<template v-if="request.cancelled_at"> {{ formatDateTime(request.cancelled_at) }}</template><template v-if="request.cancellation_reason"> — {{ request.cancellation_reason }}</template>
        </p>

        <!-- REQUIREMENT -->
        <section class="panel">
          <div class="panel-head">
            <div>
              <h2 class="panel-title">What the patient needs</h2>
              <p class="panel-hint">
                {{ request.totals.required }} required · {{ request.totals.approved }} approved ·
                {{ request.totals.remaining }} remaining
              </p>
            </div>
            <button v-if="canCancelTransfusion(request)" type="button" class="btn btn--quiet" @click="confirm = { kind: 'cancel' }">
              Cancel request
            </button>
          </div>

          <TransfusionRequirementTable
            :lines="request.lines"
            :totals="request.totals"
            :is-open="request.is_open"
            closable
            :busy-item-id="busyItemId"
            @close-line="closing = $event"
          />
        </section>

        <!-- ALLOCATIONS -->
        <section class="panel">
          <h2 class="panel-title">Facility allocations</h2>
          <p class="panel-hint">
            Each facility reviews its own share. Approving reserves units for this patient; a rejected or withdrawn share
            returns its units to unallocated.
          </p>

          <div v-if="request.allocations?.length" class="allocations">
            <FacilityAllocationCard
              v-for="allocation in request.allocations"
              :key="allocation.id"
              :allocation="allocation"
              :request-open="request.is_open"
              :busy="busyAllocationId === allocation.id"
              @withdraw="confirm = { kind: 'withdraw', allocation: $event }"
            />
          </div>
          <p v-else class="panel-hint">No facility has been asked yet.</p>
        </section>

        <!-- THE PATIENT'S BAGS IN THE BLOOD BANK -->
        <section class="panel">
          <div class="panel-head">
            <div>
              <h2 class="panel-title">Bags in your blood bank</h2>
              <p class="panel-hint">
                Bags received for this patient, and bags from your own stock tagged to them. Tag, crossmatch and
                transfuse them from Blood Bank Inventory.
              </p>
            </div>
            <div class="panel-head__actions">
              <NuxtLink :to="`/hospital/receiving/direct-distribution?ptr=${requestId}`" class="btn">
                <AssetIcon name="truck" :size="15" />
                Receive units
              </NuxtLink>
              <NuxtLink to="/hospital/inventory?tab=tagged" class="btn">
                <AssetIcon name="package" :size="15" />
                Blood Bank Inventory
              </NuxtLink>
            </div>
          </div>

          <p v-if="bagsError" class="panel-hint">{{ bagsError }}</p>
          <p v-else-if="!bags.length" class="panel-hint">No bag for this patient has reached your blood bank yet.</p>
          <ul v-else class="bags">
            <li v-for="bag in bags" :key="bag.id" class="bag">
              <span class="mono">{{ bag.bag_number || bag.unit_id }}</span>
              <span class="bag__meta">{{ bag.blood_type?.code || '—' }} · {{ bag.component?.name || '—' }}</span>
              <span class="status-chip status-chip--sm" :class="`tone--${HOSPITAL_UNIT_STATUS_TONES[bag.status]}`">
                {{ HOSPITAL_UNIT_STATUS_LABELS[bag.status] || bag.status_label }}
              </span>
              <span v-if="bag.active_tag" class="bag__meta">
                {{ bag.active_tag.description }} · due {{ formatDateTime(bag.active_tag.deadline_at) }}
              </span>
            </li>
          </ul>
        </section>

        <!-- WALK-IN -->
        <section v-if="request.walk_in" class="panel">
          <h2 class="panel-title">Walk-in</h2>
          <WalkInDetailsCard
            :walk-in="request.walk_in"
            :centre-name="walkInCentre"
            :recorder-name="request.recorder_name || ''"
          />
        </section>

        <!-- DETAILS -->
        <section class="panel">
          <h2 class="panel-title">Details</h2>
          <dl class="details">
            <div><dt>Requested</dt><dd>{{ formatDateTime(request.request_date) }}</dd></div>
            <div><dt>{{ request.is_walk_in ? 'Recorded by' : 'Requested by' }}</dt><dd>{{ request.requester_name || request.recorder_name || '—' }}</dd></div>
            <div>
              <dt>Own stock checked</dt>
              <dd>{{ request.internal_stock_checked_at ? formatDateTime(request.internal_stock_checked_at) : (request.is_walk_in ? 'Confirmed by phone' : '—') }}</dd>
            </div>
            <div v-if="request.fulfilled_at"><dt>Fulfilled</dt><dd>{{ formatDateTime(request.fulfilled_at) }}</dd></div>
          </dl>
        </section>

        <!-- HISTORY -->
        <section class="panel">
          <h2 class="panel-title">History</h2>
          <RequestHistoryTimeline
            :events="events"
            :loading="historyLoading"
            :error="historyError"
            show-allocation
            allocation-link-base="/hospital/bloodrequests/"
          />
        </section>
      </template>
    </div>

    <CloseLineDialog
      v-if="closing"
      :row="closingRow"
      side="requirement"
      :busy="busyItemId !== null"
      :error="dialogError"
      @confirm="closeLine"
      @close="closing = null; dialogError = ''"
    />

    <div v-if="confirm" class="dialog-backdrop" @click.self="!confirmBusy && (confirm = null)">
      <div
        ref="confirmRef"
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ptr-confirm-title"
        tabindex="-1"
        @keydown.esc="!confirmBusy && (confirm = null)"
      >
        <template v-if="confirm.kind === 'withdraw'">
          <h2 id="ptr-confirm-title" class="dialog__title">Withdraw {{ confirm.allocation.reference_number }}?</h2>
          <p class="dialog__body">
            {{ confirm.allocation.target_facility?.name || 'The facility' }} will no longer be asked for these units. They
            become unallocated again, and you can ask another facility for them.
          </p>
        </template>
        <template v-else>
          <h2 id="ptr-confirm-title" class="dialog__title">Cancel {{ request.reference_number }}?</h2>
          <p class="dialog__body">
            Every facility still reviewing its share is withdrawn. Nothing has been approved for this patient yet.
          </p>
        </template>

        <label class="field">
          <span class="field__label">Reason (optional)</span>
          <textarea v-model="confirmReason" class="field__input" rows="2" maxlength="255" />
        </label>
        <p v-if="dialogError" class="dialog__error" role="alert">{{ dialogError }}</p>

        <div class="dialog__actions">
          <button type="button" class="btn btn--danger" :disabled="confirmBusy" @click="runConfirm">
            {{ confirmBusy ? 'Working…' : (confirm.kind === 'withdraw' ? 'Withdraw' : 'Cancel request') }}
          </button>
          <button type="button" class="btn" :disabled="confirmBusy" @click="confirm = null">Keep it</button>
        </div>
      </div>
    </div>

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>
  </div>
</template>

<script setup>
/**
 * One Patient Transfusion Request: the patient's need, and every facility asked for a share of it.
 *
 * Required / approved / remaining / unallocated per component come from the
 * API, added up across every allocation. From here the hospital asks another
 * facility for whatever is unallocated, withdraws a share nobody has answered,
 * closes what the patient no longer needs, or cancels before anything is
 * approved. Receipt and the DOH form are on each allocation's own page.
 */

import AssetIcon from '~/components/common/AssetIcon.vue'
import CloseLineDialog from '~/components/common/CloseLineDialog.vue'
import RequestHistoryTimeline from '~/components/common/RequestHistoryTimeline.vue'
import WalkInDetailsCard from '~/components/common/WalkInDetailsCard.vue'
import FacilityAllocationCard from '~/components/Hospital/FacilityAllocationCard.vue'
import SourcingPanel from '~/components/Hospital/SourcingPanel.vue'
import TransfusionRequirementTable from '~/components/Hospital/TransfusionRequirementTable.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { PRIORITY_LABELS, REQUEST_STATUS_TONES } from '~/types/bloodRequest'
import { HOSPITAL_UNIT_STATUS_LABELS, HOSPITAL_UNIT_STATUS_TONES } from '~/types/hospitalInventory'
import {
  allocationProblems,
  buildAllocationShares,
  canCancelTransfusion,
  suggestedSplit,
  transfusionProgressLabel,
} from '~/utils/transfusionSourcing'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard' })

const route = useRoute()
const requestId = computed(() => route.params.id)

const request = ref(null)
const loading = ref(true)
const loadError = ref('')
const actionError = ref('')

const events = ref([])
const historyLoading = ref(false)
const historyError = ref('')

const bags = ref([])
const bagsError = ref('')

const allocating = ref(false)
const plan = ref(null)
const planLoading = ref(false)
const planError = ref('')
const split = ref({})
const sending = ref(false)

const closing = ref(null)
const busyItemId = ref(null)
const busyAllocationId = ref(null)
const dialogError = ref('')

const confirm = ref(null)
const confirmReason = ref('')
const confirmBusy = ref(false)
const confirmRef = ref(null)

const toast = ref('')
let toastTimer = null

const statusTone = computed(() => {
  if (!request.value) return 'muted'
  if (request.value.is_open && request.value.needs_allocation) return 'danger'

  return REQUEST_STATUS_TONES[request.value.status] ?? 'muted'
})

const splitProblems = computed(() => allocationProblems(plan.value, split.value))

/** The centre a walk-in was recorded at: the allocation that carries it. */
const walkInCentre = computed(() =>
  request.value?.allocations?.find((allocation) => allocation.walk_in)?.target_facility?.name ?? '',
)

/** CloseLineDialog reads a fulfilment row; give it the requirement line in that shape. */
const closingRow = computed(() => closing.value
  ? {
      component: closing.value.component?.name ?? 'component',
      allocatable: (closing.value.awaiting ?? 0) + (closing.value.unallocated ?? 0),
      reserved: Math.max(0, (closing.value.approved ?? 0) - (closing.value.fulfilled ?? 0)),
    }
  : null)

watch(confirm, (value) => {
  confirmReason.value = ''
  dialogError.value = ''
  if (value) nextTick(() => confirmRef.value?.focus())
})

onMounted(load)
onUnmounted(() => clearTimeout(toastTimer))

async function load() {
  loading.value = true
  loadError.value = ''

  try {
    const response = await hospitalService.showTransfusionRequest(requestId.value)
    request.value = response.request
    loadHistory()
    loadBags()
  } catch (err) {
    loadError.value = err?.status === 404
      ? 'This Patient Transfusion Request could not be found.'
      : (err?.message || 'Could not load this request. Please try again.')
  } finally {
    loading.value = false
  }
}

async function loadHistory() {
  historyLoading.value = true
  historyError.value = ''

  try {
    const response = await hospitalService.transfusionHistory(requestId.value)
    events.value = response.events ?? []
  } catch (err) {
    historyError.value = err?.message || 'Could not load the history.'
  } finally {
    historyLoading.value = false
  }
}

/** The patient's bags in this blood bank: received for them, or tagged to them from the shelf. */
async function loadBags() {
  bagsError.value = ''

  try {
    const response = await hospitalService.inventory({ transfusion_request_id: Number(requestId.value), per_page: 100 })
    bags.value = response.data ?? []
  } catch {
    bagsError.value = 'Could not load this patient\'s bags.'
  }
}

/** Take a fresh projection from a write's response, and refresh the history beside it. */
function applyResult(response, message) {
  if (response?.request) request.value = response.request
  actionError.value = ''
  showToast(message || response?.message || 'Updated.')
  loadHistory()
}

function showToast(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 3000)
}

async function openAllocate() {
  allocating.value = true
  await loadPlan()
}

async function loadPlan() {
  planLoading.value = true
  planError.value = ''

  try {
    plan.value = await hospitalService.transfusionSourcing(requestId.value)
    split.value = suggestedSplit(plan.value)
  } catch (err) {
    planError.value = err?.message || 'Could not search the network. Please try again.'
  } finally {
    planLoading.value = false
  }
}

async function sendAllocations() {
  if (splitProblems.value.length) return

  sending.value = true

  try {
    const response = await hospitalService.addAllocations(requestId.value, buildAllocationShares(plan.value, split.value))
    allocating.value = false
    plan.value = null
    applyResult(response)
  } catch (err) {
    planError.value = ''
    actionError.value = firstError(err) || 'Could not ask those facilities. Please try again.'
  } finally {
    sending.value = false
  }
}

async function closeLine(note) {
  const line = closing.value

  if (!line) return

  busyItemId.value = line.id
  dialogError.value = ''

  try {
    const response = await hospitalService.closeTransfusionLine(requestId.value, line.id, note)
    closing.value = null
    applyResult(response)
  } catch (err) {
    dialogError.value = firstError(err) || 'Could not close the remaining quantity.'
  } finally {
    busyItemId.value = null
  }
}

async function runConfirm() {
  const action = confirm.value

  if (!action) return

  confirmBusy.value = true
  dialogError.value = ''

  try {
    let response

    if (action.kind === 'withdraw') {
      busyAllocationId.value = action.allocation.id
      response = await hospitalService.withdrawAllocation(requestId.value, action.allocation.id, confirmReason.value.trim() || null)
    } else {
      response = await hospitalService.cancelTransfusionRequest(requestId.value, confirmReason.value.trim() || null)
    }

    confirm.value = null
    applyResult(response)
  } catch (err) {
    dialogError.value = firstError(err) || 'That could not be done. Please try again.'
  } finally {
    confirmBusy.value = false
    busyAllocationId.value = null
  }
}

/** The most specific message the API gave: a field error first, then its own message. */
function firstError(err) {
  const bag = err?.errors ?? {}
  const first = Object.values(bag)[0]

  return (Array.isArray(first) ? first[0] : first) || err?.message || ''
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css; nothing is redeclared here. */
.ptr-page {
  min-height: 100%;
  background: var(--rb-page-bg);
  font-family: var(--rb-font-sans);
  padding: 20px;
}
.ptr-inner { max-width: 1040px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

.back-link {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; color: var(--rb-text-secondary); text-decoration: none; margin-bottom: 8px;
}
.back-link:hover { color: var(--rb-primary-text); }
.page-header__row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.eyebrow { margin: 0 0 2px; font-size: 11.5px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: var(--rb-text-secondary); }
.page-title { font-size: 24px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13.5px; color: var(--rb-text-secondary); margin: 4px 0 0; }
.stat { color: var(--rb-accent-text); font-weight: 700; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.status-chip {
  padding: 0.3rem 0.8rem; border-radius: 999px;
  font-size: 13px; font-weight: 700; white-space: nowrap;
}

.panel {
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  padding: 20px;
}
.panel--attention { border-color: rgba(var(--rb-accent-rgb), .35); }
.panel--error { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--rb-accent-text); }
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.panel-head__actions { display: flex; gap: 8px; flex-wrap: wrap; }
.panel-title { font-size: 15px; font-weight: 700; color: var(--rb-text-primary); margin: 0 0 4px; }
.panel-hint { font-size: 12.5px; color: var(--rb-text-secondary); margin: 0 0 14px; max-width: 70ch; }

.attention { display: flex; align-items: flex-start; gap: 12px; color: var(--rb-accent-text); }
.attention__text { flex: 1; }
.attention__text .panel-hint { margin-bottom: 0; }
.allocate { margin-top: 16px; display: flex; flex-direction: column; gap: 14px; }
.allocate__actions { display: flex; justify-content: flex-end; gap: 10px; }

.allocations { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }

.bags { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.bag {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 10px 0; border-top: 1px solid var(--rb-surface-alt); font-size: 13px; color: var(--rb-text-primary);
}
.bag:first-child { border-top: none; }
.bag__meta { font-size: 12.5px; color: var(--rb-text-secondary); }
.status-chip--sm { padding: 0.2rem 0.6rem; font-size: 11.5px; }

.details { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin: 0; }
.details dt { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; color: var(--rb-text-secondary); }
.details dd { margin: 2px 0 0; font-size: 13.5px; color: var(--rb-text-primary); }

.banner {
  display: flex; align-items: center; gap: 8px; margin: 0;
  padding: 11px 14px; border-radius: 10px; font-size: 13px;
}
.banner--error {
  background: rgba(var(--rb-accent-rgb), 0.08);
  color: var(--rb-accent-text);
  border: 1px solid rgba(var(--rb-accent-rgb), 0.25);
}
.banner--muted { background: var(--rb-surface-alt); color: var(--rb-text-secondary); border: 1px solid var(--rb-border); }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 9px 16px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 9px; cursor: pointer; text-decoration: none; white-space: nowrap;
  background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong);
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn--primary { background: var(--rb-primary); color: #fff; border-color: var(--rb-primary); }
.btn--primary:hover:not(:disabled) { background: #10509c; }
.btn--quiet { color: var(--rb-accent-text); }
.btn--danger { background: var(--rb-accent); color: #fff; border-color: var(--rb-accent); }
.btn--danger:hover:not(:disabled) { opacity: .9; background: var(--rb-accent); }
.btn:disabled { opacity: .55; cursor: not-allowed; }

.dialog-backdrop {
  position: fixed; inset: 0; z-index: 320;
  display: grid; place-items: center; padding: 16px;
  background: var(--rb-overlay);
}
.dialog {
  width: min(460px, 100%);
  display: flex; flex-direction: column; gap: 12px;
  padding: 20px; border-radius: 14px;
  background: var(--rb-surface); border: 1px solid var(--rb-border);
}
.dialog:focus { outline: none; }
.dialog__title { margin: 0; font-size: 16px; font-weight: 700; color: var(--rb-text-primary); }
.dialog__body { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--rb-text-secondary); }
.dialog__error { margin: 0; font-size: 12.5px; color: var(--rb-accent-text); }
.dialog__actions { display: flex; gap: 10px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field__label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.field__input {
  width: 100%; padding: 9px 11px; font: inherit; font-size: 13.5px; resize: vertical;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.field__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.12); }

.toast {
  position: fixed; right: 20px; bottom: 20px; z-index: 330;
  padding: 11px 16px; border-radius: 10px;
  background: var(--rb-text-primary); color: var(--rb-surface);
  font-size: 13px; font-weight: 600;
}
.toast-enter-active, .toast-leave-active { transition: opacity .2s ease, transform .2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(6px); }

.skeleton {
  height: 13px; border-radius: 6px; margin-bottom: 10px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

.tone--success { background: rgba(var(--rb-success-rgb), 0.14); color: var(--rb-success-text); }
.tone--warning { background: rgba(var(--rb-warning-rgb), 0.16); color: var(--rb-warning-text); }
.tone--danger { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }
.tone--info { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text); }
.tone--progress { background: rgba(var(--rb-purple-rgb), 0.12); color: var(--rb-purple-text); }
.tone--muted { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .toast-enter-active, .toast-leave-active { transition: none; }
}

@media (max-width: 720px) {
  .ptr-page { padding: 14px; }
  .attention { flex-direction: column; }
  .allocate__actions { flex-direction: column-reverse; }
  .allocate__actions > * { width: 100%; }
}
</style>
