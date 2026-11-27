<template>
  <!--
    Other hospitals' open Blood Requests, which this blood bank may supply
    from its own near-expiry stock (project owner, 2026-11-28). No patient
    names. Bags are picked and sent in one step; nothing is billed. The
    other hospital receives them through its own Receive and Stock Intake.
  -->
  <div class="list-page">
    <div class="list-inner">
      <PageHeader title="Other Hospitals' Requests" />

      <div v-if="error" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ error }}</p>
        <button type="button" class="btn-link" @click="load(meta.current_page)">Retry</button>
      </div>

      <section class="panel" aria-labelledby="supply-title">
        <h2 id="supply-title" class="sr-only">Other hospitals' open Blood Requests</h2>

        <div class="toolbar">
          <div class="toolbar__filters">
            <label class="search">
              <AssetIcon name="search" :size="15" class="search__icon" />
              <input
                v-model="search"
                type="search"
                class="search__input"
                placeholder="Search reference or hospital"
                aria-label="Search by request reference or hospital"
                @input="onSearchInput"
              >
            </label>
          </div>
          <div class="toolbar__actions">
            <button
              type="button"
              class="btn-outline btn-outline--squeeze"
              :disabled="loading"
              aria-label="Refresh the list"
              @click="load(meta.current_page)"
            >
              <AssetIcon name="refresh-cw" :size="14" :class="{ spin: loading }" />
              <span class="btn-text">Refresh</span>
            </button>
          </div>
        </div>

        <div class="table-wrap" :class="{ 'table-wrap--busy': loading && rows.length }">
          <table class="list-table supply-table">
            <caption class="sr-only">Other hospitals' open Blood Requests</caption>
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">Received</th>
                <th scope="col">Hospital</th>
                <th scope="col">Blood Type</th>
                <th scope="col" class="num">Needed</th>
                <th scope="col" class="num">Unallocated</th>
                <th scope="col" class="num">You Can Send</th>
                <th scope="col">Status</th>
                <th scope="col" class="c-actions"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>

            <tbody v-if="loading && !rows.length">
              <SkeletonRows :columns="COLUMN_COUNT" :rows="4" />
            </tbody>

            <tbody v-else-if="!rows.length">
              <tr>
                <td :colspan="COLUMN_COUNT" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-state__icon"><AssetIcon :name="search.trim() ? 'search-x' : 'inbox'" :size="20" /></span>
                    <p class="empty-state__title">{{ search.trim() ? 'No requests match' : 'No open requests from other hospitals' }}</p>
                    <button v-if="search.trim()" type="button" class="btn-outline" @click="clearSearch">Clear search</button>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr
                v-for="row in rows"
                :key="row.id"
                class="list-row list-row--link"
                :class="{ 'supply-row--stat': row.is_emergency }"
                tabindex="0"
                :aria-label="`View ${row.reference_number}`"
                @click="viewRow(row)"
                @keydown.enter.self="viewRow(row)"
              >
                <td class="mono nowrap">{{ row.reference_number }}</td>
                <td class="nowrap">{{ row.request_date ? formatWhen(row.request_date) : '—' }}</td>
                <td>{{ row.hospital?.name || 'Not recorded' }}</td>
                <td class="nowrap">{{ row.blood_type?.code || '—' }}</td>
                <td class="num">{{ total(row, 'required') }}</td>
                <td class="num">{{ row.unallocated_quantity }}</td>
                <td class="num">{{ row.sendable_quantity }}</td>
                <td class="nowrap">{{ row.status_label }}</td>
                <td class="c-actions nowrap" @click.stop>
                  <div class="row-actions">
                    <RowViewButton :label="`View ${row.reference_number}`" @view="viewRow(row)" />
                    <button
                      v-if="row.can_supply && canSupply"
                      type="button"
                      class="supply-send"
                      :aria-label="`Send bags to ${row.reference_number}`"
                      @click="openSend(row)"
                    >
                      <AssetIcon name="send" :size="13" />
                      Send Bags
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ListPager
          v-if="rows.length"
          :page="meta.current_page"
          :last-page="meta.last_page"
          :from="meta.from"
          :to="meta.to"
          :total="meta.total"
          :busy="loading"
          @go="load"
        />
      </section>
    </div>

    <!-- Everything about the request, read only, from its row. -->
    <RecordDialog :open="Boolean(viewing)" :title="viewing?.title || 'Blood Request'" eyebrow="Blood Request" :sections="viewing?.sections || []" @close="viewing = null">
      <template #actions>
        <button v-if="viewing?.row.can_supply && canSupply" type="button" class="ui-btn ui-btn--primary" @click="sendFromView">
          <AssetIcon name="send" :size="15" />
          Send Bags
        </button>
      </template>
    </RecordDialog>

    <!-- SEND BAGS: near-expiry bags from this shelf, first-expiring ticked first. -->
    <CenterModal :open="Boolean(sending)" :title="sending ? `Send Bags · ${sending.row.reference_number}` : 'Send Bags'" size="lg" @close="closeSend">
      <template #meta>
        <span v-if="sending">{{ sending.row.hospital?.name }} · {{ sending.row.blood_type?.code }}</span>
      </template>

      <div v-if="sending?.loading" class="send-loading">
        <AssetIcon name="loader" :size="16" class="spin" />
        Loading your near-expiry bags…
      </div>

      <p v-else-if="sending?.loadError" class="send-error" role="alert">{{ sending.loadError }}</p>

      <template v-else-if="sending">
        <section v-for="line in sending.lines" :key="line.transfusion_request_item_id" class="send-line">
          <header class="send-line__head">
            <h3 class="send-line__name">{{ line.component.name }}</h3>
            <span class="send-line__count">{{ pickedIn(line) }} of {{ line.unallocated }} picked</span>
          </header>

          <p v-if="!line.units.length" class="send-none">
            No near-expiry {{ sending.row.blood_type?.code }} {{ line.component.name }} here.
          </p>

          <div v-else class="table-wrap send-table-wrap">
            <table class="list-table send-table">
              <caption class="sr-only">{{ line.component.name }} bags expiring within {{ sending.windowDays }} days, first-expiring first</caption>
              <thead>
                <tr>
                  <th scope="col" class="c-pick"><span class="sr-only">Send</span></th>
                  <th scope="col">Bag</th>
                  <th scope="col">Expires</th>
                  <th scope="col" class="num">Days Left</th>
                  <th scope="col">Location</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="unit in line.units" :key="unit.unit_id" class="list-row" :class="{ 'send-row--off': !isPicked(unit) && lineFull(line) }">
                  <td class="c-pick">
                    <input
                      type="checkbox"
                      class="send-check"
                      :checked="isPicked(unit)"
                      :disabled="sending.busy || (!isPicked(unit) && lineFull(line))"
                      :aria-label="`Send bag ${unit.bag_number}`"
                      @change="togglePick(unit)"
                    >
                  </td>
                  <td class="mono nowrap">{{ unit.bag_number }}</td>
                  <td class="nowrap">{{ unit.expiry_date ? formatDate(unit.expiry_date) : '—' }}</td>
                  <td class="num">{{ unit.days_remaining ?? '—' }}</td>
                  <td>{{ unit.storage_location || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <p class="send-note" role="note">
          {{ sending.row.hospital?.name }} is told. The bags leave your stock and wait there to be received.
        </p>

        <p v-if="sending.error" class="send-error" role="alert">{{ sending.error }}</p>
      </template>

      <template #actions>
        <button type="button" class="ui-btn" :disabled="sending?.busy" @click="closeSend">Cancel</button>
        <button
          type="button"
          class="ui-btn ui-btn--primary"
          :disabled="!sending || sending.busy || sending.loading || !pickedCount"
          @click="confirmSend"
        >
          <AssetIcon name="send" :size="14" />
          {{ sending?.busy ? 'Sending…' : `Send ${pickedCount} bag${pickedCount === 1 ? '' : 's'}` }}
        </button>
      </template>
    </CenterModal>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import ListPager from '~/components/common/ListPager.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import SkeletonRows from '~/components/ui/SkeletonRows.vue'
import CenterModal from '~/components/ui/CenterModal.vue'
import RecordDialog from '~/components/ui/RecordDialog.vue'
import RowViewButton from '~/components/ui/RowViewButton.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { onPageReturn } from '~/composables/useKeptAlive'
import { createLatest, useLiveRefresh } from '~/composables/useLiveRefresh'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.inventory.view', keepalive: true })

useHead({ title: "Other Hospitals' Requests · RedAgos" })

const COLUMN_COUNT = 9

const { can } = useUser()
// Sending is the inventory staff's and the Head's.
const canSupply = computed(() => can('hospital.inventory.supply'))
const { notify: toast } = useToast()

const rows = ref([])
const meta = ref({ current_page: 1, last_page: 1, from: 0, to: 0, total: 0 })
const loading = ref(true)
const error = ref('')
const search = ref('')

const latest = createLatest()

/** `quiet` is a background refresh: the page on screen is swapped in whole, and a failure keeps it. */
async function load(page = 1, options = {}) {
  const quiet = options?.quiet === true
  const ticket = latest.begin()
  if (!quiet) loading.value = true
  if (!quiet) error.value = ''

  const params = { page, per_page: 20 }
  if (search.value.trim()) params.search = search.value.trim()

  try {
    const response = await hospitalService.listSupplyRequests(params)
    if (!latest.isCurrent(ticket)) return

    rows.value = response?.data ?? []
    meta.value = {
      current_page: response?.current_page ?? page,
      last_page: response?.last_page ?? 1,
      from: response?.from ?? 0,
      to: response?.to ?? 0,
      total: response?.total ?? rows.value.length,
    }
  } catch (err) {
    if (!latest.isCurrent(ticket) || quiet) return
    error.value = err?.message || 'Could not load the requests.'
    rows.value = []
  } finally {
    if (latest.isCurrent(ticket)) loading.value = false
  }
}

let searchDebounce = null
function onSearchInput() {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => load(1), 300)
}

function clearSearch() {
  search.value = ''
  load(1)
}

function formatWhen(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatDate(date) {
  if (!date) return ''
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** A figure summed over every component on the request. */
function total(row, key) {
  return (row.lines ?? []).reduce((sum, line) => sum + (Number(line[key]) || 0), 0)
}

/* VIEW: one plain value a column on the row; the components and suppliers here. */
const viewing = ref(null)

function viewRow(row) {
  const suppliers = row.suppliers ?? []

  viewing.value = {
    row,
    title: row.reference_number || 'Blood Request',
    sections: [
      { title: 'Request', rows: [
        { label: 'Reference', value: row.reference_number, mono: true },
        { label: 'Status', value: row.status_label },
        { label: 'Hospital', value: row.hospital?.name },
        { label: 'Blood type', value: row.blood_type?.code },
        { label: 'Urgency', value: row.is_emergency ? 'STAT' : 'Routine' },
        { label: 'Received', value: row.request_date ? formatWhen(row.request_date) : '' },
        { label: 'Needed by', value: row.needed_by ? formatWhen(row.needed_by) : '' },
      ] },
      ...(row.lines ?? []).map((line) => ({ title: line.component?.name || 'Component', rows: [
        { label: 'Needed', value: line.required },
        { label: 'Released', value: line.fulfilled },
        { label: 'Unallocated', value: line.unallocated },
        { label: 'Near-expiry here', value: line.near_expiry_here },
      ] })),
      { title: 'Suppliers', rows: suppliers.length
        ? suppliers.map((supplier) => ({
            label: supplier.reference_number,
            value: `${supplier.name || 'Supplier'}${supplier.is_mine ? ' (you)' : ''} · ${supplier.quantity} unit${supplier.quantity === 1 ? '' : 's'} · ${supplier.status_label}`,
            wide: true,
          }))
        : [{ label: 'Suppliers', value: 'None yet', wide: true }] },
      { title: 'This blood bank', rows: [
        { label: 'Sending', value: row.supply_blocked, wide: true },
      ] },
    ],
  }
}

function sendFromView() {
  const row = viewing.value?.row
  viewing.value = null
  if (row) openSend(row)
}

/* SEND BAGS */
const sending = ref(null)

const pickedCount = computed(() => sending.value?.picked.size ?? 0)

async function openSend(row) {
  sending.value = { row, loading: true, loadError: '', lines: [], windowDays: 0, picked: new Set(), busy: false, error: '' }

  try {
    const response = await hospitalService.supplyCandidates(row.id)
    if (sending.value?.row.id !== row.id) return

    const lines = response?.lines ?? []
    // First-expiring first, up to what each line still needs: a suggestion, untick to swap.
    const picked = new Set()
    for (const line of lines) {
      line.units.slice(0, line.unallocated).forEach((unit) => picked.add(unit.unit_id))
    }

    Object.assign(sending.value, { loading: false, lines, windowDays: response?.window_days ?? 0, picked })
  } catch (err) {
    if (sending.value?.row.id !== row.id) return
    Object.assign(sending.value, { loading: false, loadError: err?.message || 'Could not load your bags.' })
  }
}

function closeSend() {
  if (sending.value?.busy) return
  sending.value = null
}

function isPicked(unit) {
  return sending.value?.picked.has(unit.unit_id) ?? false
}

function pickedIn(line) {
  return line.units.filter((unit) => isPicked(unit)).length
}

function lineFull(line) {
  return pickedIn(line) >= line.unallocated
}

function togglePick(unit) {
  const picked = new Set(sending.value.picked)
  if (picked.has(unit.unit_id)) picked.delete(unit.unit_id)
  else picked.add(unit.unit_id)
  sending.value.picked = picked
}

async function confirmSend() {
  const current = sending.value
  if (!current || current.busy || !current.picked.size) return

  current.busy = true
  current.error = ''

  try {
    const response = await hospitalService.supplyRequest(current.row.id, [...current.picked])
    const at = rows.value.findIndex((r) => r.id === current.row.id)
    if (at !== -1 && response?.request) rows.value.splice(at, 1, response.request)

    toast('Bags Sent', 'success', response?.message ?? 'The bags are on their way.')
    current.busy = false
    sending.value = null
  } catch (err) {
    const fieldError = Object.values(err?.errors ?? err?.data?.errors ?? {}).flat()[0]
    current.error = fieldError || err?.message || 'The bags could not be sent.'
    current.busy = false
  }
}

onMounted(() => load())
onBeforeUnmount(() => clearTimeout(searchDebounce))

// Kept alive: back here, the page on screen reloads quietly.
onPageReturn(() => load(meta.value.current_page, { quiet: true }))

// Kept current while open, paused while a request is viewed or bags are being picked.
useLiveRefresh(() => load(meta.value.current_page, { quiet: true }), {
  intervalMs: 30_000,
  pauseWhen: () => viewing.value !== null || sending.value !== null,
})
</script>

<style scoped src="~/assets/css/list-ui.css"></style>

<style scoped>
.supply-table { min-width: 940px; }
.list-table thead th.c-actions { text-align: right; }

/* An open STAT request, as Incoming Requests marks it: a tint, not a chip. */
.supply-row--stat td { background: rgba(var(--rb-accent-rgb), 0.04); }
.supply-row--stat:hover td { background: rgba(var(--rb-accent-rgb), 0.07); }
.list-row--link:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }

.supply-send {
  display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 10px; border-radius: 8px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.45); background: rgba(var(--rb-primary-rgb), 0.06);
  color: var(--rb-primary-text); font: inherit; font-size: 12px; font-weight: 700; white-space: nowrap; cursor: pointer;
  transition: background 0.12s ease;
}
.supply-send:hover { background: rgba(var(--rb-primary-rgb), 0.12); }
.supply-send:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.send-loading { display: flex; align-items: center; gap: 8px; padding: 8px 0; font-size: 13px; color: var(--rb-text-secondary); }
.send-line + .send-line { margin-top: 16px; }
.send-line__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.send-line__name { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.send-line__count { font-size: 12.5px; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.send-none { margin: 0; padding: 12px; border: 1px dashed var(--rb-border-strong); border-radius: 10px; font-size: 13px; color: var(--rb-text-secondary); }
.send-table-wrap { border: 1px solid var(--rb-border); border-radius: 10px; }
.send-table .c-pick { width: 44px; }
.send-check { width: 16px; height: 16px; accent-color: var(--rb-primary); cursor: pointer; }
.send-check:disabled { cursor: not-allowed; }
.send-row--off td { color: var(--rb-text-secondary); }
.send-note { margin: 16px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }
.send-error { margin: 12px 0 0; font-size: 12.5px; color: var(--rb-accent-text); }

@media (prefers-reduced-motion: reduce) {
  .supply-send { transition: none; }
}
</style>
