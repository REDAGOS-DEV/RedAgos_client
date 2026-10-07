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
            Dispatch the units held for each request. Releasing them is what fulfils it, partly or fully; the
            hospital then confirms each unit arrived.
          </p>
        </div>
        <button class="btn btn-outline" :disabled="loading" @click="load">
          <AssetIcon name="refresh-cw" :size="16" :class="{ spinning: loading }" />
          Refresh
        </button>
      </header>

      <div v-if="error" class="banner banner--error">
        <AssetIcon name="triangle-alert" :size="16" />
        <span>{{ error }}</span>
        <button class="btn btn-outline btn-sm" @click="load">Retry</button>
      </div>

      <!-- TABS on the left, the three unit states on the right -->
      <div class="tabbar fade-in" style="--delay:40ms">
        <div class="tabs" role="tablist" aria-label="Fulfillment queue">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            role="tab"
            class="tab"
            :class="{ 'tab--on': activeTab === tab.value }"
            :aria-selected="activeTab === tab.value"
            @click="activeTab = tab.value"
          >
            {{ tab.label }}
            <span v-if="activeTab === tab.value && !loading" class="tab__count">{{ requests.length }}</span>
          </button>
        </div>

        <div class="legend" aria-label="Unit states">
          <span class="legend-step"><span class="dot dot--allocated" />Reserved</span>
          <AssetIcon name="chevron-right" :size="13" class="legend-arrow" />
          <span class="legend-step"><span class="dot dot--released" />Released</span>
          <AssetIcon name="chevron-right" :size="13" class="legend-arrow" />
          <span class="legend-step"><span class="dot dot--received" />Received</span>
          <span class="legend-note" title="Receipt is confirmed by the hospital, not here.">
            <AssetIcon name="info" :size="13" />
          </span>
        </div>
      </div>

      <!-- LIST -->
      <div v-if="loading" class="card">
        <div class="skeleton-wrap">
          <div v-for="n in 3" :key="n" class="skeleton skeleton--row" />
        </div>
      </div>

      <div v-else-if="requests.length === 0" class="card">
        <div class="empty">
          <span class="empty__icon"><AssetIcon :name="activeTab === 'awaiting_release' ? 'truck' : 'inbox'" :size="20" /></span>
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
          :class="{ 'request-card--stat': request.is_emergency }"
        >
          <header class="request-head">
            <div>
              <div class="request-title">
                <span class="mono">{{ request.reference_number }}</span>
                <span v-if="request.is_emergency" class="tag tag--stat">STAT</span>
                <span v-if="request.is_walk_in" class="tag tag--walk-in">Walk-in</span>
                <span
                  v-if="request.weekly_request"
                  class="tag tag--weekly"
                  title="Part of the hospital's weekly request: dispatched in one delivery, and whatever is not supplied is closed"
                >Weekly · {{ request.weekly_request.reference_number }}</span>
                <span class="status" :class="`status--${request.status}`">{{ requestStatusLabel(request) }}</span>
              </div>
              <p class="request-sub">
                <span class="request-facility">{{ request.requesting_facility?.name || 'Hospital not recorded' }}</span>
                <span class="blood-pill">{{ request.blood_type?.code || '?' }}</span>
                <span>{{ request.quantity }} unit{{ request.quantity === 1 ? '' : 's' }} requested</span>
              </p>
            </div>

            <!-- The same three states as the legend, in its colours. -->
            <div class="request-counts">
              <span class="count count--allocated">
                <span class="dot dot--allocated" />
                <strong>{{ request.allocated_count }}</strong> held
              </span>
              <span class="count count--released">
                <span class="dot dot--released" />
                <strong>{{ request.fulfilled_quantity ?? 0 }}</strong> released
              </span>
              <span class="count count--received">
                <span class="dot dot--received" />
                <strong>{{ request.received_count }}</strong> received
              </span>
            </div>
          </header>

          <!-- What was asked for beside what has been provided, per component. -->
          <RequestFulfilmentTable v-if="request.detail" :request="request.detail" class="request-fulfilment" />
          <div v-else-if="request.items?.length" class="lines">
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
                    {{ allocation.expiry_date || 'Not set' }}
                  </td>
                  <td :class="{ muted: !allocation.storage_location }">{{ allocation.storage_location || 'Not set' }}</td>
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
              <AssetIcon v-if="busyId !== request.id" name="truck" :size="14" />
              {{ busyId === request.id ? 'Working…' : 'Dispatch' }}
            </button>
          </footer>

          <footer v-else class="request-actions">
            <span class="selection-note">
              <AssetIcon name="clock" :size="13" />
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
            This issues {{ dispatchCount }} unit{{ dispatchCount === 1 ? '' : 's' }}. They leave your inventory now and
            count as fulfilled on the request. The hospital still confirms each unit's arrival.
          </p>

          <p v-if="dispatchFor.weekly_request" class="modal-warning" role="note">
            <strong>Weekly request {{ dispatchFor.weekly_request.reference_number }}</strong> goes out in one delivery.
            <template v-if="dispatchFor.outstanding_quantity > 0">
              The {{ dispatchFor.outstanding_quantity }} unit(s) you have not reserved will be closed as not supplied —
              the hospital's next request day replaces them.
            </template>
            <template v-else>Everything requested is reserved, so nothing will be closed.</template>
          </p>

          <p v-if="dispatchFor.weekly_request" class="modal-warning" role="note">
            <strong>Weekly request {{ dispatchFor.weekly_request.reference_number }}</strong> goes out in one delivery.
            <template v-if="dispatchFor.outstanding_quantity > 0">
              The {{ dispatchFor.outstanding_quantity }} unit(s) you have not reserved will be closed as not supplied —
              the hospital's next request day replaces them.
            </template>
            <template v-else>Everything requested is reserved, so nothing will be closed.</template>
          </p>

          <ul class="modal-units">
            <li v-for="unit in dispatchUnits" :key="unit.id" class="mono">
              {{ unit.unit_id }}<span class="unit-expiry"> · expires {{ unit.expiry_date || 'date not set' }}</span>
            </li>
          </ul>

          <div class="field">
            <label for="handed-to" class="field-label">
              Handed to
              <span v-if="!dispatchFor.is_walk_in" class="field-optional">optional: courier or transport</span>
            </label>
            <input
              id="handed-to"
              v-model.trim="handedTo"
              type="text"
              class="input"
              maxlength="150"
              :placeholder="dispatchFor.is_walk_in ? 'The watcher collecting the units' : 'Who is taking the units'"
            >
            <p v-if="dispatchFor.is_walk_in" class="field-hint">
              A walk-in's units usually leave with the watcher who presented the request.
            </p>
          </div>

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
            This gives up the hold and makes {{ returnCount }} unit{{ returnCount === 1 ? '' : 's' }} available to
            other requests. If nothing is left held, the request returns to Pending for review.
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
import RequestFulfilmentTable from '~/components/common/RequestFulfilmentTable.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { requestStatusLabel } from '~/types/bloodRequest'

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

    requests.value = rows.map((r) => ({ ...r, allocations: [], selected: [], loadingUnits: true, billing: null, detail: null }))

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
    // The detail projection carries every line's fulfilment figures and, for a
    // walk-in, the watcher the units are likely to be handed to.
    request.detail = review?.request ?? null
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
        ? 'Met by the government subsidy. Cleared for release.'
        : 'Statement settled. Cleared for release.',
    }
  }

  const owed = Number(billing.total_amount ?? 0) - Number(billing.collected ?? 0)
  return {
    ok: false,
    message: `₱${owed.toLocaleString(undefined, { minimumFractionDigits: 2 })} outstanding. Blood cannot be released until this is settled or subsidised.`,
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
  // omitted allocation_ids. A weekly request always goes whole: the API
  // refuses to dispatch part of one.
  return dispatchFor.value.selected.length && !dispatchFor.value.weekly_request
    ? reserved.filter((a) => dispatchFor.value.selected.includes(a.id))
    : reserved
})

const dispatchCount = computed(() => dispatchUnits.value.length)

const handedTo = ref('')

function openDispatch(request) {
  actionError.value = ''
  handedTo.value = request.detail?.walk_in?.representative?.name ?? ''
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
    const ids = request.selected.length && !request.weekly_request ? request.selected : undefined
    const response = await bloodCenterService.releaseRequest(request.id, ids, handedTo.value || null)

    const issued = response?.released_units?.length ?? dispatchCount.value
    const closedShort = (response?.closed_short ?? []).reduce((sum, line) => sum + (line.quantity ?? 0), 0)
    toast(
      'Units Dispatched',
      'success',
      `${issued} unit(s) issued to ${request.requesting_facility?.name || 'the hospital'}${response?.status_label ? ` — ${response.status_label}` : ''}.`
        + (closedShort ? ` ${closedShort} unit(s) not supplied were closed.` : ''),
    )
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
.fx-page { background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 24px var(--rb-gutter, 24px) 40px; }
.fx-inner { max-width: var(--rb-content-max, 1600px); margin: 0 auto; }

.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 72ch; }

/* tabs + legend */
.tabbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.tabs { display: inline-flex; padding: 4px; gap: 4px; border-radius: 12px; border: 1px solid var(--rb-border); background: var(--rb-surface); }
.tab {
  display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; border: 0; border-radius: 9px;
  background: transparent; color: var(--rb-text-secondary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
}
.tab:hover { color: var(--rb-text-primary); }
.tab--on { background: var(--rb-primary); color: #fff; }
.tab:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.tab__count { min-width: 20px; padding: 0 7px; border-radius: 999px; background: #fff; color: var(--rb-primary); font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; }

.legend { display: flex; align-items: center; gap: 9px; font-size: 12.5px; color: var(--rb-text-secondary); flex-wrap: wrap; }
.legend-step { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--rb-text-primary); }
.legend-arrow { color: var(--rb-text-muted); }
.legend-note { display: inline-flex; margin-left: 2px; color: var(--rb-text-secondary); cursor: help; }
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
.request-card { padding: 16px 18px; box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03); }
.request-card--stat { border-color: rgba(var(--rb-accent-rgb), 0.35); box-shadow: inset 3px 0 0 var(--rb-accent); }

.request-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.request-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.request-sub { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12.5px; color: var(--rb-text-secondary); margin: 5px 0 0; }
.request-facility { font-weight: 600; color: var(--rb-text-primary); }
.request-counts { display: flex; gap: 6px; font-size: 12px; color: var(--rb-text-secondary); }
.count { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 8px; border: 1px solid var(--rb-border); background: var(--rb-surface-alt); }
.count strong { font-size: 14px; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

.mono { font-family: var(--rb-font-mono); font-size: 12.5px; font-weight: 600; }
.tag { padding: 1px 6px; border-radius: 5px; font-size: 10px; font-weight: 700; }
.tag--stat { background: var(--rb-accent); color: #fff; }
.tag--walk-in { background: rgba(var(--rb-purple-rgb), .12); color: var(--rb-purple-text); }
.tag--weekly { background: rgba(var(--rb-primary-rgb), .12); color: var(--rb-primary-text); }
.modal-warning {
  font-size: 12.5px; line-height: 1.5; margin: 0 0 14px; padding: 10px 12px; border-radius: 9px;
  background: rgba(var(--rb-warning-rgb), .12); color: var(--rb-warning-text); border: 1px solid rgba(var(--rb-warning-rgb), .3);
}
.request-fulfilment { margin-top: 12px; }
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
.units-table td.muted { color: var(--rb-text-secondary); }
.units-table tr:last-child td { border-bottom: none; }
.units-table .pick { width: 30px; }
.units-empty { font-size: 12.5px; color: var(--rb-text-muted); margin: 0; }
.expiring { color: var(--rb-warning-text); font-weight: 600; }

.alloc { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; }
.alloc--allocated { color: var(--rb-warning-text); }
.alloc--released { color: var(--rb-primary-text); }
.alloc--cancelled { color: var(--rb-text-muted); }

.request-actions { display: flex; align-items: center; gap: 9px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--rb-border); flex-wrap: wrap; }
.selection-note { flex: 1; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--rb-text-secondary); min-width: 180px; }

.empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 40px 20px; color: var(--rb-text-secondary); }
.empty__icon { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
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
  height: 38px; padding: 0 16px; font-size: 13px; font-weight: 700; font-family: inherit;
  border-radius: 10px; cursor: pointer; white-space: nowrap; transition: background-color .15s ease, border-color .15s ease;
}
.btn:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.btn-primary { background: var(--rb-primary); color: #fff; border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: #0D47A1; }
.btn-outline { background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-sm { height: 34px; padding: 0 14px; font-size: 12.5px; }

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
.field-optional { font-weight: 400; color: var(--rb-text-secondary); }
.field-hint { font-size: 11.5px; color: var(--rb-text-secondary); margin: 0; }
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
