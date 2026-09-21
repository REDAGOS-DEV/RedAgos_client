<template>
  <div class="fx-page">
    <div class="fx-inner">
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
          <h1 class="page-title">Fulfillment</h1>
          <p class="page-subtitle">
            Dispatch the units held for each request. A bag moves through three states and
            no more: reserved when it is held, released when it leaves, received when the
            hospital confirms it arrived.
          </p>
        </div>
        <button class="btn btn-outline" :disabled="loading" @click="load">
          <AssetIcon name="refresh-cw" :size="16" :class="{ spinning: loading }" />
          Refresh
        </button>
      </header>

      <!-- STATE LEGEND -->
      <div class="legend fade-in" style="--delay:40ms">
        <span class="legend-step"><span class="dot dot--allocated" />Reserved</span>
        <AssetIcon name="chevron-right" :size="13" class="legend-arrow" />
        <span class="legend-step"><span class="dot dot--released" />Released</span>
        <AssetIcon name="chevron-right" :size="13" class="legend-arrow" />
        <span class="legend-step"><span class="dot dot--received" />Received</span>
        <span class="legend-note">Receipt is confirmed by the hospital, not here.</span>
      </div>

      <div v-if="error" class="banner banner--error">
        <AssetIcon name="triangle-alert" :size="16" />
        <span>{{ error }}</span>
        <button class="btn btn-outline btn-sm" @click="load">Retry</button>
      </div>

      <!-- TABS -->
      <div class="pills fade-in" style="--delay:70ms">
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

      <!-- LIST -->
      <div v-if="loading" class="card">
        <div class="skeleton-wrap">
          <div v-for="n in 3" :key="n" class="skeleton skeleton--row" />
        </div>
      </div>

      <div v-else-if="requests.length === 0" class="card">
        <div class="empty">
          <AssetIcon name="inbox" :size="36" />
          <h3>{{ activeTab === 'awaiting_release' ? 'Nothing to dispatch' : 'Nothing awaiting confirmation' }}</h3>
          <p>
            {{ activeTab === 'awaiting_release'
              ? 'Approve a request on the Incoming Requests page to hold stock for it.'
              : 'Units you dispatch appear here until the hospital confirms they arrived.' }}
          </p>
        </div>
      </div>

      <div v-else class="request-list">
        <article
          v-for="request in requests"
          :key="request.id"
          class="card request-card fade-in"
        >
          <header class="request-head">
            <div>
              <div class="request-title">
                <span class="mono">{{ request.reference_number }}</span>
                <span v-if="request.is_emergency" class="tag tag--stat">STAT</span>
                <span class="status" :class="`status--${request.status}`">{{ request.status_label }}</span>
              </div>
              <p class="request-sub">
                {{ request.requesting_facility?.name || '—' }}
                · <span class="blood-pill">{{ request.blood_type?.code || '—' }}</span>
                · {{ request.quantity }} unit(s) requested
              </p>
            </div>

            <div class="request-counts">
              <span><strong>{{ request.allocated_count }}</strong> held</span>
              <span><strong>{{ request.received_count }}</strong> received</span>
            </div>
          </header>

          <div v-if="request.items?.length" class="lines">
            <span v-for="item in request.items" :key="item.id" class="line-chip">
              {{ item.component?.name }} &times;{{ item.quantity }}
            </span>
          </div>

          <!-- BILLING GATE -->
          <div
            v-if="activeTab === 'awaiting_release'"
            class="gate"
            :class="gateFor(request).ok ? 'gate--ok' : 'gate--blocked'"
          >
            <AssetIcon :name="gateFor(request).ok ? 'check' : 'octagon-alert'" :size="15" />
            <span>{{ gateFor(request).message }}</span>
            <NuxtLink v-if="!gateFor(request).ok" to="/blood-center/billing" class="gate-link">
              Go to Billing
            </NuxtLink>
          </div>

          <!-- UNITS -->
          <div class="units">
            <div v-if="request.loadingUnits" class="skeleton skeleton--row" />

            <table v-else-if="request.allocations?.length" class="units-table">
              <thead>
                <tr>
                  <th v-if="activeTab === 'awaiting_release'" scope="col" class="pick">
                    <input
                      type="checkbox"
                      :checked="allSelected(request)"
                      :aria-label="`Select every reserved unit on ${request.reference_number}`"
                      @change="toggleAll(request)"
                    >
                  </th>
                  <th scope="col">Unit</th>
                  <th scope="col">Component</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Storage</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="allocation in request.allocations" :key="allocation.id">
                  <td v-if="activeTab === 'awaiting_release'" class="pick">
                    <input
                      v-if="allocation.status === 'allocated'"
                      type="checkbox"
                      :checked="isSelected(request, allocation.id)"
                      :aria-label="`Select unit ${allocation.unit_id}`"
                      @change="toggleUnit(request, allocation.id)"
                    >
                  </td>
                  <td class="mono">{{ allocation.unit_id }}</td>
                  <td>{{ componentFor(request, allocation) }}</td>
                  <td :class="{ expiring: isExpiringSoon(allocation.expiry_date) }">
                    {{ allocation.expiry_date || '—' }}
                  </td>
                  <td>{{ allocation.storage_location || '—' }}</td>
                  <td>
                    <span class="alloc" :class="`alloc--${allocation.status}`">
                      <span class="dot" :class="`dot--${allocation.received_at ? 'received' : allocation.status}`" />
                      {{ allocation.received_at ? 'Received' : allocation.status_label }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            <p v-else class="units-empty">No units are held against this request.</p>
          </div>

          <!-- ACTIONS -->
          <footer v-if="activeTab === 'awaiting_release'" class="request-actions">
            <span class="selection-note">
              {{ selectedCount(request) > 0
                ? `${selectedCount(request)} unit(s) selected`
                : 'Nothing selected — Dispatch sends every reserved unit.' }}
            </span>
            <button
              class="btn btn-outline btn-sm"
              :disabled="busyId === request.id || reservedCount(request) === 0"
              @click="openReturn(request)"
            >
              Return to Stock
            </button>
            <button
              class="btn btn-primary btn-sm"
              :disabled="busyId === request.id || reservedCount(request) === 0 || !gateFor(request).ok"
              @click="openDispatch(request)"
            >
              {{ busyId === request.id ? 'Working…' : 'Dispatch' }}
            </button>
          </footer>

          <footer v-else class="request-actions">
            <span class="selection-note">
              Waiting on {{ request.requesting_facility?.name || 'the hospital' }} to confirm receipt.
            </span>
          </footer>
        </article>
      </div>
    </div>

    <!-- DISPATCH CONFIRM -->
    <Teleport to="body">
      <div v-if="dispatchFor" class="modal-overlay" @click.self="closeDispatch">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="dispatch-title">
          <h2 id="dispatch-title" class="modal-title">Dispatch Units</h2>
          <p class="modal-sub">{{ dispatchFor.reference_number }} · {{ dispatchFor.requesting_facility?.name }}</p>

          <p class="modal-desc">
            This issues {{ dispatchCount }} unit(s) and hands them to the hospital. The units
            leave your inventory now; the request is only fulfilled once the hospital confirms
            they arrived.
          </p>

          <ul class="modal-units">
            <li v-for="unit in dispatchUnits" :key="unit.id" class="mono">
              {{ unit.unit_id }}<span class="unit-expiry"> · expires {{ unit.expiry_date || '—' }}</span>
            </li>
          </ul>

          <p v-if="actionError" class="field-error field-error--block">{{ actionError }}</p>

          <div class="modal-actions">
            <button class="btn btn-outline" :disabled="busyId" @click="closeDispatch">Cancel</button>
            <button class="btn btn-primary" :disabled="busyId" @click="confirmDispatch">
              {{ busyId ? 'Dispatching…' : 'Dispatch' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- RETURN TO STOCK -->
    <Teleport to="body">
      <div v-if="returnFor" class="modal-overlay" @click.self="closeReturn">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="return-title">
          <h2 id="return-title" class="modal-title">Return Units to Stock</h2>
          <p class="modal-sub">{{ returnFor.reference_number }} · {{ returnFor.requesting_facility?.name }}</p>

          <p class="modal-desc">
            This gives up the hold and makes {{ returnCount }} unit(s) available to other
            requests. If nothing is left held, the request returns to Pending for review.
          </p>

          <div class="field">
            <label for="return-reason" class="field-label">Reason <span class="req">*</span></label>
            <input
              id="return-reason"
              v-model.trim="returnReason"
              type="text"
              class="input"
              maxlength="255"
              placeholder="Why are these units being released?"
            >
          </div>

          <p v-if="actionError" class="field-error field-error--block">{{ actionError }}</p>

          <div class="modal-actions">
            <button class="btn btn-outline" :disabled="busyId" @click="closeReturn">Cancel</button>
            <button class="btn btn-primary" :disabled="busyId || !returnReason" @click="confirmReturn">
              {{ busyId ? 'Returning…' : 'Return to Stock' }}
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
  requires: 'requests.release',
})

/*
 * This page used to drive an eight-stage pipeline — Preparing, Quality Check,
 * Ready for Dispatch, Dispatched, Delivered, Completed — against a mocked
 * $fetch and, with mocks off, against `/blood-center/fulfillment*` routes that
 * do not exist. None of those stages is in the schema.
 *
 * What the schema has is three states on each allocation: `allocated` when a
 * bag is held, `released` when it is issued, and a `received_at` stamp the
 * requesting hospital sets. This page works that model and nothing else.
 */

const requests = ref([])
const loading = ref(true)
const error = ref('')
const busyId = ref(null)
const actionError = ref('')
const activeTab = ref('awaiting_release')

const tabs = [
  { value: 'awaiting_release', label: 'Awaiting Dispatch' },
  { value: 'awaiting_receipt', label: 'Awaiting Confirmation' },
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

watch(activeTab, () => load())

async function load() {
  loading.value = true
  error.value = ''

  try {
    const response = await bloodCenterService.incomingRequests({ [activeTab.value]: 1, per_page: 25 })
    const rows = response?.data ?? []

    requests.value = rows.map((r) => ({ ...r, allocations: [], selected: [], loadingUnits: true, billing: null }))

    // The queue projection counts holds but does not carry the bags. Each row
    // is filled in from the review endpoint, which does — and which also
    // returns the statement the release gate reads.
    await Promise.all(requests.value.map(loadUnits))
  } catch (err) {
    error.value = err?.message || 'Could not load the dispatch queue.'
    requests.value = []
  } finally {
    loading.value = false
  }
}

async function loadUnits(request) {
  try {
    const [review, billing] = await Promise.all([
      bloodCenterService.reviewRequest(request.id),
      bloodCenterService.billingForRequest(request.id).catch(() => null),
    ])

    request.allocations = review?.request?.allocations ?? []
    request.billing = billing?.billing ?? null
  } catch {
    // One row failing to expand must not blank the queue; the card still shows
    // its counts and says nothing is loaded.
    request.allocations = []
  } finally {
    request.loadingUnits = false
  }
}

/**
 * Whether this request's statement clears its units for release.
 *
 * The server refuses the dispatch itself — this only explains the refusal
 * before somebody clicks into it.
 */
function gateFor(request) {
  const billing = request.billing

  if (!billing) {
    return { ok: false, message: 'No statement has been raised for this request yet.' }
  }

  if (billing.clears_release) {
    return {
      ok: true,
      message: billing.is_subsidised
        ? 'Met by the government subsidy — cleared for release.'
        : 'Statement settled — cleared for release.',
    }
  }

  const owed = Number(billing.total_amount ?? 0) - Number(billing.collected ?? 0)
  return {
    ok: false,
    message: `₱${owed.toLocaleString(undefined, { minimumFractionDigits: 2 })} outstanding — blood cannot be released until this is settled or subsidised.`,
  }
}

function reservedUnits(request) {
  return (request.allocations ?? []).filter((a) => a.status === 'allocated')
}

function reservedCount(request) {
  return reservedUnits(request).length
}

function componentFor(request, allocation) {
  const item = (request.items ?? []).find((i) => i.id === allocation.request_item_id)
  return item?.component?.name ?? '—'
}

/** Flags a bag close enough to expiry that a dispatcher should notice. */
function isExpiringSoon(expiry) {
  if (!expiry) return false
  const days = (new Date(expiry) - Date.now()) / 86_400_000
  return days <= 7
}

/* SELECTION */
function isSelected(request, allocationId) {
  return request.selected.includes(allocationId)
}

function selectedCount(request) {
  return request.selected.length
}

function toggleUnit(request, allocationId) {
  request.selected = isSelected(request, allocationId)
    ? request.selected.filter((id) => id !== allocationId)
    : [...request.selected, allocationId]
}

function allSelected(request) {
  const reserved = reservedUnits(request)
  return reserved.length > 0 && reserved.every((a) => isSelected(request, a.id))
}

function toggleAll(request) {
  request.selected = allSelected(request) ? [] : reservedUnits(request).map((a) => a.id)
}

/* DISPATCH */
const dispatchFor = ref(null)

const dispatchUnits = computed(() => {
  if (!dispatchFor.value) return []
  const reserved = reservedUnits(dispatchFor.value)
  // No selection means the whole hold, which is what the API does with an
  // omitted allocation_ids.
  return dispatchFor.value.selected.length
    ? reserved.filter((a) => dispatchFor.value.selected.includes(a.id))
    : reserved
})

const dispatchCount = computed(() => dispatchUnits.value.length)

function openDispatch(request) {
  actionError.value = ''
  dispatchFor.value = request
}

function closeDispatch() {
  if (busyId.value) return
  dispatchFor.value = null
}

async function confirmDispatch() {
  const request = dispatchFor.value
  if (!request) return

  busyId.value = request.id
  actionError.value = ''

  try {
    const ids = request.selected.length ? request.selected : undefined
    const response = await bloodCenterService.releaseRequest(request.id, ids)

    const issued = response?.released_units?.length ?? dispatchCount.value
    toast('Units Dispatched', 'success', `${issued} unit(s) issued to ${request.requesting_facility?.name || 'the hospital'}.`)
    dispatchFor.value = null
    await load()
  } catch (err) {
    actionError.value = err?.message || 'Those units could not be dispatched.'
  } finally {
    busyId.value = null
  }
}

/* RETURN TO STOCK */
const returnFor = ref(null)
const returnReason = ref('')

const returnCount = computed(() => {
  if (!returnFor.value) return 0
  return returnFor.value.selected.length || reservedCount(returnFor.value)
})

function openReturn(request) {
  actionError.value = ''
  returnReason.value = ''
  returnFor.value = request
}

function closeReturn() {
  if (busyId.value) return
  returnFor.value = null
}

async function confirmReturn() {
  const request = returnFor.value
  if (!request || !returnReason.value) return

  busyId.value = request.id
  actionError.value = ''

  try {
    const ids = request.selected.length ? request.selected : undefined
    await bloodCenterService.releaseHolds(request.id, returnReason.value, ids)

    toast('Units Returned', 'info', `${returnCount.value} unit(s) are available to other requests again.`)
    returnFor.value = null
    await load()
  } catch (err) {
    actionError.value = err?.message || 'Those units could not be returned.'
  } finally {
    busyId.value = null
  }
}

onMounted(load)
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.fx-page { background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 24px 32px 40px; }
.fx-inner { max-width: 1152px; margin: 0 auto; }

.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
.page-title { font-size: 23px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13.5px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 72ch; }

.legend { display: flex; align-items: center; gap: 9px; margin-bottom: 16px; font-size: 12.5px; color: var(--rb-text-secondary); flex-wrap: wrap; }
.legend-step { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--rb-text-primary); }
.legend-arrow { color: var(--rb-text-muted); }
.legend-note { margin-left: 6px; font-style: italic; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot--allocated { background: var(--rb-warning); }
.dot--released { background: var(--rb-primary); }
.dot--received { background: var(--rb-success); }
.dot--cancelled { background: var(--rb-text-muted); }

.banner { display: flex; align-items: center; gap: 9px; padding: 11px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 14px; }
.banner--error { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .25); }

.pills { display: flex; gap: 7px; margin-bottom: 14px; }
.pill {
  padding: 8px 15px; font-size: 12.5px; font-weight: 600; cursor: pointer;
  color: var(--rb-text-secondary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 999px;
}
.pill--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), .07); color: var(--rb-primary-text); }

.card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; }
.request-list { display: flex; flex-direction: column; gap: 14px; }
.request-card { padding: 16px 18px; }

.request-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.request-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.request-sub { font-size: 12.5px; color: var(--rb-text-secondary); margin: 4px 0 0; }
.request-counts { display: flex; gap: 16px; font-size: 12px; color: var(--rb-text-secondary); }
.request-counts strong { font-size: 15px; color: var(--rb-text-primary); }

.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; font-weight: 600; }
.tag { padding: 1px 6px; border-radius: 5px; font-size: 10px; font-weight: 700; }
.tag--stat { background: var(--rb-accent); color: #fff; }
.blood-pill {
  display: inline-block; padding: 1px 7px; border-radius: 6px; font-weight: 700; font-size: 11.5px;
  background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text);
}
.status { padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.status--processing { background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }
.status--partial { background: rgba(var(--rb-warning-rgb), .12); color: var(--rb-warning-text); }
.status--fulfilled { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }

.lines { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.line-chip {
  font-size: 11.5px; padding: 3px 9px; border-radius: 6px;
  background: var(--rb-surface-alt); color: var(--rb-text-secondary);
  border: 1px solid var(--rb-border);
}

.gate {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin-top: 12px; padding: 9px 12px; border-radius: 9px; font-size: 12.5px;
}
.gate--ok { background: rgba(var(--rb-success-rgb), .08); color: var(--rb-success-text); border: 1px solid rgba(var(--rb-success-rgb), .2); }
.gate--blocked { background: rgba(var(--rb-accent-rgb), .07); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .22); }
.gate-link { margin-left: auto; font-weight: 700; color: inherit; text-decoration: underline; }

.units { margin-top: 12px; }
.units-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.units-table th {
  text-align: left; font-size: 10.5px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase;
  color: var(--rb-text-secondary); padding: 0 10px 6px; border-bottom: 1px solid var(--rb-border-strong);
}
.units-table td { padding: 8px 10px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); }
.units-table tr:last-child td { border-bottom: none; }
.units-table .pick { width: 30px; }
.units-empty { font-size: 12.5px; color: var(--rb-text-muted); margin: 0; }
.expiring { color: var(--rb-warning-text); font-weight: 600; }

.alloc { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; }
.alloc--allocated { color: var(--rb-warning-text); }
.alloc--released { color: var(--rb-primary-text); }
.alloc--cancelled { color: var(--rb-text-muted); }

.request-actions { display: flex; align-items: center; gap: 9px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--rb-border); flex-wrap: wrap; }
.selection-note { flex: 1; font-size: 12px; color: var(--rb-text-secondary); min-width: 180px; }

.empty { text-align: center; padding: 46px 20px; color: var(--rb-text-secondary); }
.empty h3 { font-size: 15px; color: var(--rb-text-primary); margin: 10px 0 4px; }
.empty p { font-size: 13px; margin: 0; }

.skeleton-wrap { padding: 16px; }
.skeleton {
  border-radius: 7px; margin-bottom: 10px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
}
.skeleton--row { height: 36px; }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

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
.btn-sm { padding: 6px 12px; font-size: 12px; }

.modal-overlay {
  position: fixed; inset: 0; z-index: 90; background: var(--rb-overlay);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal {
  width: 100%; max-width: 440px; background: var(--rb-surface);
  border-radius: 15px; padding: 22px; font-family: var(--rb-font-sans);
  max-height: 90vh; overflow-y: auto;
}
.modal-title { font-size: 17px; font-weight: 700; color: var(--rb-text-primary); margin: 0 0 3px; }
.modal-sub { font-size: 12.5px; color: var(--rb-text-secondary); margin: 0 0 14px; }
.modal-desc { font-size: 13px; color: var(--rb-text-secondary); margin: 0 0 14px; }
.modal-units { list-style: none; margin: 0 0 14px; padding: 10px 12px; border: 1px solid var(--rb-border); border-radius: 9px; max-height: 160px; overflow-y: auto; }
.modal-units li { padding: 2px 0; color: var(--rb-text-primary); }
.unit-expiry { font-family: var(--rb-font-sans); font-weight: 400; color: var(--rb-text-secondary); }
.modal-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 16px; }

.field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.field-label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.req { color: var(--rb-accent-text); }
.input {
  width: 100%; padding: 9px 11px; font-size: 13.5px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), .12); }
.field-error { font-size: 11.5px; color: var(--rb-accent-text); margin: 0; }
.field-error--block { margin: 4px 0 0; }

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

@media (max-width: 760px) {
  .fx-page { padding: 16px 16px 32px; }
  .units-table { font-size: 11.5px; }
  .units-table th, .units-table td { padding: 6px 6px; }
  .request-actions { flex-direction: column; align-items: stretch; }
}
</style>
