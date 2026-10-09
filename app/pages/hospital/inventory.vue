<template>
  <div class="hinv-page">
    <div class="hinv-inner">
      <header class="page-header">
        <div>
          <h1 class="page-title">Blood Bank Inventory</h1>
          <p class="page-subtitle">
            Bags your blood bank received — from a blood center or by direct distribution — first-expiring-first, and
            the patients they are tagged to.
          </p>
        </div>
        <button type="button" class="btn" :disabled="refreshing" @click="refresh">
          <AssetIcon name="refresh-cw" :size="14" :class="{ 'spin-icon': refreshing }" />
          {{ refreshing ? 'Refreshing…' : 'Refresh' }}
        </button>
      </header>

      <div v-if="summaryError" class="banner banner--error" role="alert">
        <AssetIcon name="triangle-alert" :size="16" />
        <span>{{ summaryError }}</span>
      </div>

      <LowStockBanner :cells="lowStock" to="/hospital/stock-thresholds" />

      <!-- A lapsed tag the sweep has not reached yet. Normally gone within a
           minute; one that lingers means the scheduler is down. -->
      <div v-if="summary?.overdue_active_tags" class="banner banner--warning" role="status">
        <AssetIcon name="clock" :size="16" />
        <span>
          {{ summary.overdue_active_tags }} tag{{ summary.overdue_active_tags === 1 ? ' has' : 's have' }} passed
          {{ summary.overdue_active_tags === 1 ? 'its' : 'their' }} 24-hour deadline and
          {{ summary.overdue_active_tags === 1 ? 'is' : 'are' }} being released.
        </span>
      </div>

      <!-- ============ SUMMARY ============ -->
      <section class="stats-grid" aria-label="Stock summary">
        <button
          v-for="card in cards"
          :key="card.label"
          type="button"
          class="stat-card"
          :class="{ 'stat-card--active': tab === card.tab && !card.shortcut }"
          :aria-pressed="tab === card.tab && !card.shortcut"
          @click="selectTab(card.tab)"
        >
          <span class="stat-card__top">
            <span class="stat-card__label">{{ card.label }}</span>
            <span class="stat-card__badge" :class="`tone--${card.tone}`"><AssetIcon :name="card.icon" :size="14" /></span>
          </span>
          <span class="stat-card__value">{{ summaryLoading ? '—' : card.value }}</span>
          <span class="stat-chip">{{ card.hint }}</span>
        </button>
      </section>

      <!-- ============ STOCK & TAGS ============ -->
      <section class="panel">
        <div class="tabs" role="tablist" aria-label="Inventory views">
          <button
            v-for="item in tabs"
            :key="item.value"
            type="button"
            role="tab"
            class="tabs__tab"
            :class="{ 'tabs__tab--active': tab === item.value }"
            :aria-selected="tab === item.value"
            @click="selectTab(item.value)"
          >
            {{ item.label }}
            <span v-if="item.count !== null" class="tabs__count">{{ item.count }}</span>
          </button>
        </div>

        <div class="toolbar">
          <div class="search-box">
            <AssetIcon name="search" :size="14" class="search-box__icon" />
            <input
              v-model="filters.search"
              type="search"
              class="search-box__input"
              :placeholder="tab === 'history' ? 'Search bag number or patient…' : 'Search bag number or tagged patient…'"
              aria-label="Search"
            />
          </div>

          <template v-if="tab !== 'history'">
            <select v-model="filters.blood_type_id" class="filter-select" aria-label="Blood type">
              <option :value="null">All blood types</option>
              <option v-for="type in reference.blood_types" :key="type.id" :value="type.id">{{ type.code }}</option>
            </select>
            <select v-model="filters.component_id" class="filter-select" aria-label="Component">
              <option :value="null">All components</option>
              <option v-for="component in reference.components" :key="component.id" :value="component.id">{{ component.name }}</option>
            </select>
          </template>

          <select v-else v-model="filters.event_status" class="filter-select" aria-label="Outcome">
            <option :value="null">All outcomes</option>
            <option value="untagged_assigned">{{ UNIT_TAG_STATUS_LABELS.untagged_assigned }}</option>
            <option value="untagged_crossmatched">{{ UNIT_TAG_STATUS_LABELS.untagged_crossmatched }}</option>
            <option value="transfused">{{ UNIT_TAG_STATUS_LABELS.transfused }}</option>
          </select>
        </div>

        <p class="tab-hint">{{ tabHint }}</p>

        <div v-if="listLoading" class="list-state" aria-busy="true">
          <div class="skeleton" style="width:70%" />
          <div class="skeleton" style="width:90%" />
          <div class="skeleton" style="width:55%" />
        </div>

        <div v-else-if="listError" class="list-state list-state--error" role="alert">
          <p>{{ listError }}</p>
          <button type="button" class="btn" @click="loadList">Try again</button>
        </div>

        <!-- ---------- HISTORY: tags that ended ---------- -->
        <template v-else-if="tab === 'history'">
          <div v-if="!events.length" class="empty-state">
            <AssetIcon name="history" :size="36" />
            <p class="empty-state__title">No ended tags yet</p>
            <p class="empty-state__desc">Untagged and transfused bags appear here, newest first.</p>
          </div>

          <div v-else class="table-wrap">
            <table class="inv-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Bag</th>
                  <th>Patient</th>
                  <th>Outcome</th>
                  <th>Reason</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="event in events" :key="event.id">
                  <td>{{ formatDateTime(event.untagged_at || event.transfused_at) }}</td>
                  <td>
                    <button type="button" class="link-btn mono" @click="historyFor = event.unit.unit_id">{{ event.unit.bag_number || event.unit.unit_id }}</button>
                    <span class="cell-sub">{{ event.unit.blood_type || '—' }} · {{ event.unit.component || '—' }}</span>
                  </td>
                  <td>
                    {{ event.patient.full_name }}
                    <span v-if="event.patient.ward || event.patient.record_number" class="cell-sub">
                      {{ [event.patient.record_number, event.patient.ward].filter(Boolean).join(' · ') }}
                    </span>
                  </td>
                  <td><span class="pill" :class="`tone--${UNIT_TAG_STATUS_TONES[event.status]}`">{{ event.status_label }}</span></td>
                  <td class="wrap-cell">
                    <template v-if="event.untag_reason">
                      {{ event.untag_reason_label }}
                      <span v-if="event.untag_note" class="cell-sub">“{{ event.untag_note }}”</span>
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td>{{ actorFor(event) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- ---------- BAGS ---------- -->
        <template v-else>
          <div v-if="!units.length" class="empty-state">
            <AssetIcon name="package" :size="36" />
            <p class="empty-state__title">{{ emptyTitle }}</p>
            <p class="empty-state__desc">{{ emptyDescription }}</p>
          </div>

          <div v-else class="table-wrap">
            <table class="inv-table">
              <thead>
                <tr>
                  <th>Bag</th>
                  <th>Type</th>
                  <th>Component</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th>Patient</th>
                  <th>Deadline</th>
                  <th class="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="unit in units"
                  :key="unit.id"
                  :class="rowClass(unit)"
                >
                  <td>
                    <button type="button" class="link-btn mono" @click="historyFor = unit.unit_id">{{ unit.bag_number || unit.unit_id }}</button>
                    <span v-if="unit.source?.transfusion_reference" class="cell-sub">for {{ unit.source.transfusion_reference }}</span>
                    <span v-else-if="unit.source?.direct_distribution" class="cell-sub">
                      from {{ unit.source.direct_distribution.source_name }}<template v-if="unit.source.direct_distribution.requested_for"> · for {{ unit.source.direct_distribution.requested_for }}</template>
                    </span>
                  </td>
                  <td><span class="type-pill">{{ unit.blood_type?.code || '—' }}</span></td>
                  <td>
                    {{ unit.component?.name || '—' }}
                    <span v-if="unit.volume_ml" class="cell-sub">{{ unit.volume_ml }} mL</span>
                  </td>
                  <td>
                    {{ formatDate(unit.expiry_date) }}
                    <span class="cell-sub" :class="{ 'cell-sub--alert': unit.bag_expired || (unit.days_remaining ?? 99) <= 3 }">
                      {{ daysRemainingLabel(unit) }}
                    </span>
                  </td>
                  <td>
                    <span class="pill" :class="`tone--${HOSPITAL_UNIT_STATUS_TONES[unit.status]}`">
                      <span class="pill__dot" />
                      {{ HOSPITAL_UNIT_STATUS_LABELS[unit.status] || unit.status_label }}
                    </span>
                    <span v-if="unit.active_tag" class="cell-sub">{{ TAG_STAGE_LABELS[unit.active_tag.status] }}</span>
                  </td>
                  <td class="wrap-cell">
                    <template v-if="unit.active_tag">
                      {{ unit.active_tag.patient.full_name }}
                      <span class="cell-sub">
                        {{ [unit.active_tag.patient.record_number, unit.active_tag.patient.ward].filter(Boolean).join(' · ') || '—' }}
                      </span>
                    </template>
                    <template v-else-if="unit.last_tag">
                      <span class="muted">Was {{ unit.last_tag.patient.full_name }}</span>
                      <span class="cell-sub">{{ unit.last_tag.untag_reason_label }}</span>
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td>
                    <template v-if="unit.active_tag">
                      <span
                        class="countdown"
                        :class="`countdown--${tierFor(unit)}`"
                        :aria-label="`${formatRemaining(remainingFor(unit))} left until the ${unit.active_tag.status === 'tag_assigned' ? 'crossmatch' : 'transfusion'} deadline`"
                      >
                        <AssetIcon name="clock" :size="12" />
                        {{ remainingFor(unit) > 0 ? formatRemaining(remainingFor(unit)) : 'Deadline passed — releasing' }}
                      </span>
                      <span class="cell-sub">by {{ formatDateTime(unit.active_tag.deadline_at) }}</span>
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td class="actions-col">
                    <div class="row-actions">
                      <button
                        v-for="action in actionsFor(unit.status, unit.bag_expired)"
                        :key="action"
                        type="button"
                        class="btn btn--sm"
                        :class="ACTION_STYLES[action]"
                        :disabled="busyUnit === unit.unit_id || (action !== 'release' && Boolean(unit.active_tag) && remainingFor(unit) <= 0)"
                        @click="startAction(action, unit)"
                      >
                        {{ ACTION_LABELS[action] }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-if="listTotal > units.length" class="list-note">
            Showing the first {{ units.length }} of {{ listTotal }} bags. Narrow the search to find the rest.
          </p>
        </template>
      </section>
    </div>

    <!-- ============ DIALOGS ============ -->
    <HospitalTagUnitDialog
      v-if="dialog?.kind === 'tag'"
      :unit="dialog.unit"
      :busy="dialogBusy"
      :error="dialogError"
      :field-errors="dialogFieldErrors"
      @confirm="runTag"
      @close="closeDialog"
    />

    <HospitalUnitReasonDialog
      v-if="dialog?.kind === 'release'"
      :title="`Release the tag on ${(dialog.unit.bag_number || dialog.unit.unit_id)}?`"
      label="Why is the tag being released?"
      confirm-label="Release tag"
      icon="user-x"
      :busy="dialogBusy"
      :error="dialogError"
      @confirm="runRelease"
      @close="closeDialog"
    >
      <template v-if="dialog.unit.status === 'tag_crossmatched'">
        The bag has already left storage for {{ dialog.unit.active_tag?.patient.full_name }}. It will be recorded as
        <strong>Untagged Crossmatched</strong> and wait as Pending Return until you confirm it is back in storage or discard it.
      </template>
      <template v-else>
        {{ dialog.unit.active_tag?.patient.full_name }} will no longer hold this bag. It will be recorded as
        <strong>Untagged Assigned</strong> and is available again at once.
      </template>
    </HospitalUnitReasonDialog>

    <HospitalUnitReasonDialog
      v-if="dialog?.kind === 'discard'"
      :title="`Discard ${(dialog.unit.bag_number || dialog.unit.unit_id)}?`"
      label="Why is the bag being discarded?"
      confirm-label="Discard bag"
      icon="trash-2"
      :busy="dialogBusy"
      :error="dialogError"
      @confirm="runDiscard"
      @close="closeDialog"
    >
      The bag leaves your stock for good. This cannot be undone.
    </HospitalUnitReasonDialog>

    <div v-if="confirmCopy" class="dialog-backdrop" @click.self="!dialogBusy && closeDialog()">
      <div
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unit-confirm-title"
        v-focus-trap
        @dialog-escape="!dialogBusy && closeDialog()"
      >
        <h2 id="unit-confirm-title" class="dialog__title">{{ confirmCopy.title }}</h2>
        <p class="dialog__body">{{ confirmCopy.body }}</p>
        <p v-if="dialogError" class="dialog__error" role="alert">{{ dialogError }}</p>
        <div class="dialog__actions">
          <button type="button" class="btn btn--primary" :disabled="dialogBusy" @click="runConfirm">
            {{ dialogBusy ? 'Working…' : confirmCopy.action }}
          </button>
          <button type="button" class="btn" :disabled="dialogBusy" @click="closeDialog">Cancel</button>
        </div>
      </div>
    </div>

    <HospitalUnitTagHistory v-if="historyFor" :unit-id="historyFor" @close="historyFor = null" />

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>
  </div>
</template>

<script setup>
/**
 * The hospital blood bank's own stock: the bags it received, and the patients they are tagged to.
 *
 * A tag is one specific bag held for one specific patient. Tag Assigned keeps
 * it in storage with 24 hours to crossmatch; Tag Crossmatched means it left
 * storage with 24 hours to transfuse. The countdowns run on the server's
 * clock (`as_of`), not the browser's, and the page never acts when one
 * reaches zero: the server's sweep releases the tag, and the page refreshes
 * to show it. Every action is re-checked by the API under lock; a refusal is
 * explained and the list reloaded, since it means the bag moved on.
 */

import AssetIcon from '~/components/common/AssetIcon.vue'
import LowStockBanner from '~/components/common/LowStockBanner.vue'
import HospitalTagUnitDialog from '~/components/Hospital/TagUnitDialog.vue'
import HospitalUnitReasonDialog from '~/components/Hospital/UnitReasonDialog.vue'
import HospitalUnitTagHistory from '~/components/Hospital/UnitTagHistory.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import {
  HOSPITAL_UNIT_STATUS_LABELS,
  HOSPITAL_UNIT_STATUS_TONES,
  TAG_STAGE_LABELS,
  UNIT_REFUSAL_MESSAGES,
  UNIT_TAG_STATUS_LABELS,
  UNIT_TAG_STATUS_TONES,
} from '~/types/hospitalInventory'
import { actionsFor, deadlineTier, formatRemaining, remainingMs, serverSkew } from '~/utils/tagDeadline'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard' })

const ACTION_LABELS = {
  tag: 'Tag to patient',
  crossmatch: 'Crossmatched',
  transfuse: 'Transfused',
  release: 'Release',
  return: 'Back in storage',
  discard: 'Discard',
}

const ACTION_STYLES = {
  tag: 'btn--primary',
  crossmatch: 'btn--primary',
  transfuse: 'btn--primary',
  release: 'btn--quiet',
  return: 'btn--primary',
  discard: 'btn--quiet',
}

/** Each bag tab and the statuses it lists. */
const TAB_STATUSES = {
  stock: ['available'],
  tagged: ['tag_assigned', 'tag_crossmatched'],
  pending: ['pending_return'],
  expired: ['expired'],
}

/** How long after a deadline passes to look again: the sweep runs every minute. */
const SWEEP_GRACE_MS = 65_000

const route = useRoute()

const tab = ref(Object.hasOwn(TAB_STATUSES, route.query.tab) || route.query.tab === 'history' ? route.query.tab : 'stock')

const summary = ref(null)
const summaryLoading = ref(true)
const summaryError = ref('')

const reference = ref({ blood_types: [], components: [] })

const units = ref([])
const events = ref([])
const listTotal = ref(0)
const listLoading = ref(true)
const listError = ref('')
const refreshing = ref(false)

const filters = reactive({ search: '', blood_type_id: null, component_id: null, event_status: null })

const dialog = ref(null)
const dialogBusy = ref(false)
const dialogError = ref('')
const dialogFieldErrors = ref({})
const busyUnit = ref(null)
const historyFor = ref(null)

const toast = ref('')

/** The local clock, ticked so countdowns move between loads. */
const now = ref(Date.now())
/** How far this browser's clock is from the server's. */
const skew = ref(0)

let ticker = null
let toastTimer = null
let searchTimer = null
let sweepTimer = null
let listSeq = 0

const totals = computed(() => summary.value?.totals ?? {})

const cards = computed(() => [
  { tab: 'stock', label: 'Available', value: totals.value.available ?? 0, tone: 'success', icon: 'package', hint: 'In storage, free to tag' },
  { tab: 'tagged', label: 'Tag Assigned', value: totals.value.tag_assigned ?? 0, tone: 'info', icon: 'user-check', hint: TAG_STAGE_LABELS.tag_assigned },
  { tab: 'tagged', label: 'Tag Crossmatched', value: totals.value.tag_crossmatched ?? 0, tone: 'progress', icon: 'flask-conical', hint: TAG_STAGE_LABELS.tag_crossmatched },
  { tab: 'pending', label: 'Pending Return', value: totals.value.pending_return ?? 0, tone: 'warning', icon: 'refresh-cw', hint: 'Out of storage, untagged' },
  // A shortcut into In stock, not a tab of its own, so it never shows as the active card.
  { tab: 'stock', label: 'Expiring in 3 days', value: summary.value?.near_expiry?.within_3_days ?? 0, tone: 'danger', icon: 'triangle-alert', hint: 'Use these first', shortcut: true },
])

const tabs = computed(() => [
  { value: 'stock', label: 'In stock', count: totals.value.available ?? null },
  { value: 'tagged', label: 'Tagged', count: summary.value ? (totals.value.tag_assigned ?? 0) + (totals.value.tag_crossmatched ?? 0) : null },
  { value: 'pending', label: 'Pending return', count: totals.value.pending_return ?? null },
  { value: 'expired', label: 'Expired', count: totals.value.expired ?? null },
  { value: 'history', label: 'History', count: null },
])

const tabHint = computed(() => ({
  stock: 'Available bags, first-expiring-first. Tag one to a patient to hold it for crossmatching.',
  tagged: 'Bags held for a patient, most urgent deadline first. Tag Assigned waits for crossmatch; Tag Crossmatched for transfusion.',
  pending: 'Bags whose crossmatched tag ended. Confirm each is back in storage, or discard it.',
  expired: 'Bags past their expiry date. They can only be discarded.',
  history: 'Tags that ended — released, lapsed, or transfused — newest first.',
}[tab.value]))

const emptyTitle = computed(() => ({
  stock: 'No bags available',
  tagged: 'No bags are tagged',
  pending: 'Nothing awaiting return',
  expired: 'No expired bags',
}[tab.value]))

const emptyDescription = computed(() => (tab.value === 'stock'
  ? 'Bags appear here when you confirm receipt of a delivery from a blood center, or record one received by direct distribution.'
  : 'Nothing matches this view right now.'))

const confirmCopy = computed(() => {
  const value = dialog.value
  const patient = value?.unit?.active_tag?.patient?.full_name ?? 'the patient'

  switch (value?.kind) {
    case 'crossmatch':
      return {
        title: `Record the crossmatch for ${(value.unit.bag_number || value.unit.unit_id)}?`,
        body: `The bag leaves storage for ${patient}, and the transfusion must be recorded within 24 hours or the tag is released.`,
        action: 'Record crossmatch',
      }
    case 'transfuse':
      return {
        title: `Record the transfusion of ${(value.unit.bag_number || value.unit.unit_id)}?`,
        body: `The bag was transfused to ${patient}. It can never return to stock.`,
        action: 'Record transfusion',
      }
    case 'return':
      return {
        title: `Is ${(value.unit.bag_number || value.unit.unit_id)} back in storage?`,
        body: 'Confirm only once the bag is back in the blood bank\'s storage. It becomes available to tag again.',
        action: 'Confirm return',
      }
    default:
      return null
  }
})

/** Whether any tag on screen has passed its deadline. */
const anyOverdue = computed(() => units.value.some((unit) => unit.active_tag && remainingFor(unit) <= 0))

watch(tab, () => {
  filters.event_status = null
  loadList()
})

watch(() => [filters.blood_type_id, filters.component_id, filters.event_status], () => loadList())

watch(() => filters.search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadList, 300)
})

// The server untags within a minute of the deadline; look again once it has.
watch(anyOverdue, (overdue) => {
  if (overdue && !sweepTimer) {
    sweepTimer = setTimeout(() => {
      sweepTimer = null
      refresh()
    }, SWEEP_GRACE_MS)
  }
})

onMounted(() => {
  ticker = setInterval(() => { now.value = Date.now() }, 30_000)
  loadReference()
  loadSummary()
  loadList()
})

onUnmounted(() => {
  clearInterval(ticker)
  clearTimeout(toastTimer)
  clearTimeout(searchTimer)
  clearTimeout(sweepTimer)
})

function selectTab(value) {
  tab.value = value
}

async function refresh() {
  refreshing.value = true

  try {
    await Promise.all([loadSummary(), loadList({ quiet: true })])
  } finally {
    refreshing.value = false
  }
}

async function loadReference() {
  try {
    const data = await hospitalService.referenceData()
    reference.value = { blood_types: data.blood_types ?? [], components: data.components ?? [] }
  } catch {
    // The filters are a convenience; the page works without them.
  }
}

// The blood bank's own minimums against its shelf. Supplementary: a failure
// leaves no banner. Loaded with the summary, so it follows every refresh and
// every tag, crossmatch, transfusion or discard that changes what is on the shelf.
const lowStock = ref([])

async function loadLowStock() {
  try {
    lowStock.value = (await hospitalService.stockThresholds()).low ?? []
  } catch {
    // The banner is a convenience; the page works without it.
  }
}

async function loadSummary() {
  summaryError.value = ''

  try {
    const data = await hospitalService.inventorySummary()
    summary.value = data
    skew.value = serverSkew(data.as_of, Date.now())
    now.value = Date.now()
    loadLowStock()
  } catch (err) {
    summaryError.value = err?.message || 'Could not load the stock summary.'
  } finally {
    summaryLoading.value = false
  }
}

/**
 * Load the current tab. A quiet load keeps the rows on screen until the new
 * ones arrive, so refreshing after an action does not flash a skeleton.
 */
async function loadList({ quiet = false } = {}) {
  // Tabs and filters can change faster than the API answers; only the latest
  // request may draw the table.
  const seq = ++listSeq

  listLoading.value = !quiet
  listError.value = ''

  const search = filters.search.trim() || undefined

  try {
    if (tab.value === 'history') {
      const response = await hospitalService.tagEvents({
        search,
        status: filters.event_status || undefined,
        per_page: 50,
      })

      if (seq !== listSeq) return

      events.value = response.data ?? []
      listTotal.value = response.total ?? events.value.length
      return
    }

    const params = {
      search,
      blood_type_id: filters.blood_type_id || undefined,
      component_id: filters.component_id || undefined,
      per_page: 100,
    }

    const pages = await Promise.all(
      TAB_STATUSES[tab.value].map((status) => hospitalService.inventory({ ...params, status })),
    )

    if (seq !== listSeq) return

    const rows = pages.flatMap((page) => page.data ?? [])
    listTotal.value = pages.reduce((sum, page) => sum + (page.total ?? 0), 0)

    // Tagged bags are ordered by the deadline that will bite first; the API
    // orders every other view first-expiring-first already.
    units.value = tab.value === 'tagged'
      ? rows.sort((a, b) => Date.parse(a.active_tag?.deadline_at ?? '') - Date.parse(b.active_tag?.deadline_at ?? ''))
      : rows
  } catch (err) {
    if (seq === listSeq) listError.value = err?.message || 'Could not load the bags. Please try again.'
  } finally {
    if (seq === listSeq) listLoading.value = false
  }
}

function remainingFor(unit) {
  return remainingMs(unit.active_tag?.deadline_at, now.value, skew.value)
}

function tierFor(unit) {
  return deadlineTier(remainingFor(unit))
}

function rowClass(unit) {
  if (unit.active_tag) {
    const tier = tierFor(unit)

    return tier === 'critical' || tier === 'overdue' ? 'row--critical' : tier === 'soon' ? 'row--soon' : ''
  }

  if (unit.status === 'available' && (unit.bag_expired || (unit.days_remaining ?? 99) <= 1)) return 'row--critical'
  if (unit.status === 'available' && (unit.days_remaining ?? 99) <= 3) return 'row--soon'

  return ''
}

function startAction(action, unit) {
  dialog.value = { kind: action, unit }
  dialogError.value = ''
  dialogFieldErrors.value = {}
}

function closeDialog() {
  dialog.value = null
  dialogError.value = ''
  dialogFieldErrors.value = {}
}

async function runTag(payload) {
  await perform((unit) => hospitalService.tagUnit(unit.unit_id, payload))
}

async function runRelease(reason) {
  await perform((unit) => hospitalService.releaseTag(unit.unit_id, reason))
}

async function runDiscard(reason) {
  await perform((unit) => hospitalService.discardUnit(unit.unit_id, reason))
}

async function runConfirm() {
  const calls = {
    crossmatch: (unit) => hospitalService.crossmatchUnit(unit.unit_id),
    transfuse: (unit) => hospitalService.transfuseUnit(unit.unit_id),
    return: (unit) => hospitalService.confirmUnitReturn(unit.unit_id),
  }

  await perform(calls[dialog.value.kind])
}

/**
 * Run one bag action from the open dialog, then reload what it changed.
 *
 * A 409 means the bag moved on since the list was drawn — tagged by somebody
 * else, a deadline passed — so the dialog closes, the reason is shown and the
 * list reloads. Validation errors stay in the dialog beside their fields.
 */
async function perform(call) {
  const unit = dialog.value?.unit

  if (!unit || !call) return

  dialogBusy.value = true
  busyUnit.value = unit.unit_id
  dialogError.value = ''
  dialogFieldErrors.value = {}

  try {
    const response = await call(unit)
    closeDialog()
    showToast(response?.message || 'Updated.')
    await refresh()
  } catch (err) {
    if (err?.status === 422) {
      dialogFieldErrors.value = err?.errors ?? {}
      dialogError.value = firstError(err) || 'Check the highlighted fields.'
    } else if (err?.status === 409 || err?.status === 404) {
      closeDialog()
      showToast(refusalMessage(err))
      await refresh()
    } else {
      dialogError.value = err?.message || 'That could not be done. Please try again.'
    }
  } finally {
    dialogBusy.value = false
    busyUnit.value = null
  }
}

/** Explain a refusal by its code, falling back to the API's own words. */
function refusalMessage(err) {
  const code = err?.data?.code

  return (code && code !== 'invalid_transition' && code !== 'unit_not_available' ? err?.data?.message : null)
    || UNIT_REFUSAL_MESSAGES[code]
    || err?.message
    || 'That could not be done.'
}

function firstError(err) {
  const first = Object.values(err?.errors ?? {})[0]

  return (Array.isArray(first) ? first[0] : first) || err?.message || ''
}

function actorFor(event) {
  if (event.status === 'transfused') return event.actors?.transfused_by || '—'

  return event.untagged_by_system ? 'Automatic' : (event.actors?.untagged_by || 'Staff')
}

function showToast(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 4000)
}

function daysRemainingLabel(unit) {
  if (unit.bag_expired) return 'Past its date'
  const days = unit.days_remaining

  if (days === null || days === undefined) return ''
  if (days === 0) return 'Expires today'

  return `${days} day${days === 1 ? '' : 's'} left`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css; nothing is redeclared here. */
.hinv-page {
  min-height: 100%;
  background: var(--rb-page-bg);
  font-family: var(--rb-font-sans);
  padding: 20px;
}
.hinv-inner { max-width: 1240px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.page-title { font-size: 24px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13.5px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 70ch; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.muted { color: var(--rb-text-secondary); }

.banner {
  display: flex; align-items: center; gap: 8px; margin: 0;
  padding: 11px 14px; border-radius: 10px; font-size: 13px;
}
.banner--error { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), 0.25); }
.banner--warning { background: rgba(var(--rb-warning-rgb), 0.1); color: var(--rb-warning-text); border: 1px solid rgba(var(--rb-warning-rgb), 0.3); }

/* Summary cards double as shortcuts to their tab. */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.stat-card {
  display: flex; flex-direction: column; gap: 8px; text-align: left; font: inherit; cursor: pointer;
  padding: 16px; border-radius: 14px;
  background: var(--rb-surface); border: 1px solid var(--rb-border);
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  transition: border-color 0.15s ease, background-color 0.2s ease;
}
.stat-card:hover { border-color: var(--rb-border-hover); }
.stat-card:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.stat-card--active { border-color: rgba(var(--rb-primary-rgb), 0.45); box-shadow: 0 0 0 1px rgba(var(--rb-primary-rgb), 0.18); }
.stat-card__top { display: flex; align-items: center; justify-content: space-between; }
.stat-card__label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rb-text-secondary); }
.stat-card__badge { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; }
.stat-card__value { font-size: 24px; font-weight: 800; color: var(--rb-text-primary); line-height: 1; font-variant-numeric: tabular-nums; }
.stat-chip { align-self: flex-start; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

.panel {
  background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03); overflow: hidden;
}

/* overflow-y is clipped as well: with overflow-x set the other axis becomes auto, and the
   tabs' -1px bottom margin (which overlaps the border) would otherwise add a vertical scrollbar. */
.tabs { display: flex; gap: 4px; padding: 10px 12px 0; border-bottom: 1px solid var(--rb-border); overflow-x: auto; overflow-y: hidden; }
.tabs__tab {
  display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
  padding: 9px 12px; margin-bottom: -1px; font: inherit; font-size: 13px; font-weight: 600;
  color: var(--rb-text-secondary); background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer;
}
.tabs__tab:hover { color: var(--rb-text-primary); }
.tabs__tab--active { color: var(--rb-primary-text); border-bottom-color: var(--rb-primary); }
.tabs__tab:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: -2px; border-radius: 6px; }
.tabs__count { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: var(--rb-surface-alt); color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }

.toolbar { display: flex; flex-wrap: wrap; gap: 10px; padding: 14px 16px 6px; }
.search-box { position: relative; flex: 1; min-width: 200px; max-width: 360px; }
.search-box__icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--rb-text-secondary); pointer-events: none; }
.search-box__input {
  width: 100%; padding: 8px 10px 8px 30px; border-radius: 10px; border: 1px solid var(--rb-border-strong);
  font: inherit; font-size: 12.5px; background: var(--rb-surface-alt); color: var(--rb-text-primary);
}
.search-box__input:focus { outline: none; border-color: var(--rb-primary); background: var(--rb-surface); }
.filter-select {
  padding: 8px 30px 8px 12px; border-radius: 10px; border: 1px solid var(--rb-border-strong);
  font: inherit; font-size: 12.5px; color: var(--rb-text-primary); cursor: pointer; appearance: none;
  background: var(--rb-surface-alt) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E") no-repeat right 12px center;
}
.filter-select:focus { outline: none; border-color: var(--rb-primary); }
.tab-hint { margin: 0; padding: 0 16px 12px; font-size: 12px; color: var(--rb-text-secondary); }

.list-state { padding: 18px 16px; }
.list-state--error { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--rb-accent-text); font-size: 13px; }
.list-note { margin: 0; padding: 10px 16px 14px; font-size: 12px; color: var(--rb-text-secondary); }

.empty-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 40px 16px; text-align: center; color: var(--rb-border-strong); }
.empty-state__title { margin: 6px 0 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.empty-state__desc { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); max-width: 46ch; }

.table-wrap { overflow-x: auto; }
.inv-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.inv-table thead th {
  text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--rb-text-secondary); padding: 10px 14px; background: var(--rb-surface-alt); white-space: nowrap;
}
.inv-table tbody td { padding: 12px 14px; border-top: 1px solid var(--rb-surface-alt); color: var(--rb-text-primary); white-space: nowrap; vertical-align: top; }
.inv-table tbody tr:hover { background: var(--rb-surface-hover); }
.wrap-cell { white-space: normal !important; min-width: 160px; max-width: 260px; }
.cell-sub { display: block; margin-top: 3px; font-size: 11.5px; color: var(--rb-text-secondary); }
.cell-sub--alert { color: var(--rb-accent-text); font-weight: 600; }
.actions-col { text-align: right; }
.row-actions { display: inline-flex; gap: 6px; justify-content: flex-end; }

/* The left edge marks urgency, never colour alone: the countdown says it in words. */
.row--critical td:first-child { box-shadow: inset 3px 0 0 var(--rb-accent); }
.row--soon td:first-child { box-shadow: inset 3px 0 0 var(--rb-warning); }

.type-pill { display: inline-flex; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); }
.pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.pill__dot { width: 6px; height: 6px; border-radius: 999px; background: currentColor; }

.countdown {
  display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px;
  font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
}
.countdown--ok { background: var(--rb-surface-alt); color: var(--rb-text-primary); }
.countdown--soon { background: rgba(var(--rb-warning-rgb), 0.14); color: var(--rb-warning-text); }
.countdown--critical, .countdown--overdue { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }

.link-btn {
  padding: 0; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text);
  background: none; border: none; cursor: pointer; text-align: left;
}
.link-btn:hover { text-decoration: underline; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 9px 16px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 9px; cursor: pointer; white-space: nowrap;
  background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong);
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn--sm { padding: 6px 11px; font-size: 12px; border-radius: 8px; }
.btn--primary { background: var(--rb-primary); color: #fff; border-color: var(--rb-primary); }
.btn--primary:hover:not(:disabled) { background: #10509c; }
.btn--quiet { color: var(--rb-accent-text); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.spin-icon { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

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

.toast {
  position: fixed; right: 20px; bottom: 20px; z-index: 330; max-width: min(420px, calc(100vw - 40px));
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
  .skeleton, .spin-icon { animation: none; }
  .toast-enter-active, .toast-leave-active { transition: none; }
}

@media (max-width: 720px) {
  .hinv-page { padding: 14px; }
  .search-box { max-width: none; }
  .dialog__actions { flex-direction: column-reverse; }
  .dialog__actions > * { width: 100%; }
}
</style>
