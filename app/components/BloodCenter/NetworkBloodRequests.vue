<template>
  <!--
    Every hospital's Blood Requests, whoever holds the shares (project owner,
    2026-11-19). Read only: the patient's name, blood type, components,
    status and which center holds each share. The one action is adding this
    center's share of units nobody has been asked for yet.
  -->
  <div class="nbr">
    <div class="nbr-tools card">
      <label class="nbr-search">
        <AssetIcon name="search" :size="15" class="nbr-search__icon" />
        <input
          v-model="search"
          type="search"
          class="nbr-search__input"
          placeholder="Search reference, patient or hospital…"
          aria-label="Search by reference, patient or hospital"
          @input="onSearchInput"
        >
      </label>
      <div class="nbr-scope" role="group" aria-label="Show">
        <button
          v-for="option in SCOPES"
          :key="option.value"
          type="button"
          class="nbr-scope__btn"
          :class="{ 'nbr-scope__btn--on': scope === option.value }"
          :aria-pressed="scope === option.value"
          @click="setScope(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div v-if="error" class="banner banner--error">
      <AssetIcon name="triangle-alert" :size="16" />
      <span>{{ error }}</span>
      <button class="ui-btn ui-btn--sm" @click="load(meta.current_page)">Retry</button>
    </div>

    <div v-if="loading" class="card">
      <div class="skeleton-wrap">
        <SkeletonList :rows="3" />
      </div>
    </div>

    <div v-else-if="!rows.length" class="card">
      <EmptyState
        :icon="search.trim() ? 'search-x' : 'inbox'"
        :title="search.trim() ? 'No blood requests match' : (scope === 'open' ? 'No open blood requests' : 'No blood requests yet')"
      >
        <button v-if="search.trim()" type="button" class="ui-btn ui-btn--sm" @click="clearSearch">Clear search</button>
      </EmptyState>
    </div>

    <div v-else class="nbr-list">
      <article
        v-for="row in rows"
        :key="row.id"
        class="card nbr-card"
        :class="{ 'nbr-card--stat': row.is_emergency && row.is_open }"
      >
        <header class="nbr-head">
          <div class="nbr-title">
            <span class="mono">{{ row.reference_number }}</span>
            <span v-if="row.is_emergency" class="tag tag--stat">STAT</span>
            <span v-if="!row.hospital.is_registered" class="tag tag--muted">Not on RedAgos</span>
            <span class="status" :class="`status--${row.status}`">{{ requestStatusLabel(row) }}</span>
          </div>
          <span v-if="row.request_date" class="nbr-when">
            <AssetIcon name="clock" :size="13" />
            {{ formatWhen(row.request_date) }}
          </span>
        </header>

        <p class="nbr-sub">
          <span class="nbr-hospital">{{ row.hospital.name || 'Hospital not recorded' }}</span>
          <span class="blood-pill">{{ row.blood_type?.code || '?' }}</span>
          <span>{{ row.patient?.full_name || 'Patient not recorded' }}</span>
          <span v-if="row.needed_by" class="nbr-needed">Needed by {{ formatWhen(row.needed_by) }}</span>
        </p>

        <div class="nbr-body">
          <table class="nbr-table">
            <caption class="sr-only">Components for {{ row.reference_number }}</caption>
            <thead>
              <tr>
                <th scope="col">Component</th>
                <th scope="col" class="num">Needed</th>
                <th scope="col" class="num">Approved</th>
                <th scope="col" class="num">Released</th>
                <th scope="col" class="num">Unallocated</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in row.lines" :key="line.transfusion_request_item_id">
                <td>{{ line.component?.name || '—' }}</td>
                <td class="num">{{ line.required }}</td>
                <td class="num">{{ line.approved }}</td>
                <td class="num">{{ line.fulfilled }}</td>
                <td class="num" :class="{ 'num--open': line.unallocated > 0 }">{{ line.unallocated }}</td>
              </tr>
            </tbody>
          </table>

          <div class="nbr-shares">
            <h3 class="nbr-shares__title">Blood centers</h3>
            <ul v-if="row.shares.length" class="nbr-shares__list">
              <li v-for="share in row.shares" :key="share.reference_number" class="nbr-share" :class="{ 'nbr-share--mine': share.is_mine }">
                <span class="nbr-share__centre">
                  {{ share.centre || 'Blood center' }}
                  <span v-if="share.is_mine" class="tag tag--mine">This center</span>
                </span>
                <span class="nbr-share__meta">
                  <NuxtLink
                    v-if="share.is_mine && share.id"
                    :to="{ path: '/blood-center/bloodrequests', query: { request: share.id } }"
                    class="mono nbr-share__link"
                  >{{ share.reference_number }}</NuxtLink>
                  <span v-else class="mono">{{ share.reference_number }}</span>
                  · {{ share.quantity }} unit{{ share.quantity === 1 ? '' : 's' }} · {{ share.status_label }}
                </span>
              </li>
            </ul>
            <p v-else class="nbr-shares__none">No blood center yet</p>
          </div>
        </div>

        <footer v-if="row.can_add_share || row.add_share_blocked" class="nbr-actions">
          <span v-if="row.add_share_blocked" class="nbr-blocked">
            <AssetIcon name="info" :size="13" />
            {{ row.add_share_blocked }}
          </span>
          <button
            v-if="row.can_add_share && canAddShare"
            type="button"
            class="ui-btn ui-btn--primary ui-btn--sm"
            @click="openShare(row)"
          >
            <AssetIcon name="plus" :size="14" />
            Add this center's share — {{ row.unallocated_quantity }} unallocated
          </button>
        </footer>
      </article>
    </div>

    <ListPager
      v-if="!loading && rows.length"
      class="card nbr-pager"
      :page="meta.current_page"
      :last-page="meta.last_page"
      :from="meta.from"
      :to="meta.to"
      :total="meta.total"
      :busy="loading"
      @go="load"
    />

    <!-- ADD THIS CENTER'S SHARE -->
    <Teleport to="body" :disabled="pageHidden">
      <div v-if="shareFor" class="modal-overlay" @click.self="closeShare">
        <div
          v-focus-trap
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-title"
          @dialog-escape="closeShare"
        >
          <h2 id="share-title" class="modal-title">Add This Center's Share</h2>
          <p class="modal-sub">
            <span class="mono">{{ shareFor.reference_number }}</span> · {{ shareFor.hospital.name }} · {{ shareFor.patient?.full_name }} · {{ shareFor.blood_type?.code }}
          </p>

          <div class="share-lines">
            <div v-for="line in shareLines" :key="line.id" class="share-line">
              <label :for="`share-qty-${line.id}`" class="share-line__name">
                {{ line.name }}
                <span class="share-line__open">{{ line.max }} unallocated</span>
              </label>
              <input
                :id="`share-qty-${line.id}`"
                v-model.number="line.quantity"
                type="number"
                class="input share-line__qty"
                min="0"
                :max="line.max"
                step="1"
                inputmode="numeric"
              >
            </div>
          </div>

          <p class="modal-note" role="note">
            {{ shareFor.hospital.name }} is told. The share goes to this center's Incoming Requests for review.
          </p>

          <p v-if="shareError" class="field-error field-error--block">{{ shareError }}</p>

          <div class="modal-actions">
            <button class="ui-btn" :disabled="sharing" @click="closeShare">Cancel</button>
            <button class="ui-btn ui-btn--primary" :disabled="sharing || !shareTotal" @click="confirmShare">
              {{ sharing ? 'Adding…' : `Add ${shareTotal} unit${shareTotal === 1 ? '' : 's'}` }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import ListPager from '~/components/common/ListPager.vue'
import SkeletonList from '~/components/ui/SkeletonList.vue'
import EmptyState from '~/components/ui/EmptyState.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { requestStatusLabel } from '~/types/bloodRequest'
import { onPageReturn, usePageHidden } from '~/composables/useKeptAlive'
import { createLatest, useLiveRefresh } from '~/composables/useLiveRefresh'

const emit = defineEmits(['loaded'])

const SCOPES = [
  { value: 'open', label: 'Open' },
  { value: 'all', label: 'All' },
]

const { can } = useUser()
// Adding a share is a walk-in continuation's act, under the same ability.
const canAddShare = computed(() => can('requests.record'))

const { notify: toast } = useToast()
const pageHidden = usePageHidden()

const rows = ref([])
const meta = ref({ current_page: 1, last_page: 1, from: 0, to: 0, total: 0 })
const loading = ref(true)
const error = ref('')
const search = ref('')
const scope = ref('open')

const latest = createLatest()

/**
 * `quiet` is a background refresh: the page on screen is swapped in whole,
 * with no skeleton, and a failure keeps it.
 */
async function load(page = 1, options = {}) {
  const quiet = options?.quiet === true
  const ticket = latest.begin()
  if (!quiet) loading.value = true
  if (!quiet) error.value = ''

  const params = { scope: scope.value, page, per_page: 20 }
  if (search.value.trim()) params.search = search.value.trim()

  try {
    const response = await bloodCenterService.networkBloodRequests(params)
    if (!latest.isCurrent(ticket)) return

    rows.value = response?.data ?? []
    meta.value = {
      current_page: response?.current_page ?? page,
      last_page: response?.last_page ?? 1,
      from: response?.from ?? 0,
      to: response?.to ?? 0,
      total: response?.total ?? rows.value.length,
    }
    emit('loaded', meta.value.total)
  } catch (err) {
    if (!latest.isCurrent(ticket) || quiet) return
    error.value = err?.message || 'Could not load the blood requests.'
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

function setScope(value) {
  if (scope.value === value) return
  scope.value = value
  load(1)
}

function formatWhen(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/* ADD THIS CENTER'S SHARE */
const shareFor = ref(null)
const shareLines = ref([])
const shareError = ref('')
const sharing = ref(false)

const shareTotal = computed(() => shareLines.value.reduce((sum, line) => {
  const quantity = Number(line.quantity)
  return sum + (Number.isInteger(quantity) && quantity > 0 ? quantity : 0)
}, 0))

function openShare(row) {
  shareFor.value = row
  shareError.value = ''
  // Every unallocated unit, by default: what the watcher or hospital still needs.
  shareLines.value = row.lines
    .filter((line) => line.unallocated > 0)
    .map((line) => ({
      id: line.transfusion_request_item_id,
      name: line.component?.name || 'Component',
      max: line.unallocated,
      quantity: line.unallocated,
    }))
}

function closeShare() {
  if (sharing.value) return
  shareFor.value = null
}

async function confirmShare() {
  const row = shareFor.value
  if (!row) return

  const over = shareLines.value.find((line) => Number(line.quantity) > line.max)
  if (over) {
    shareError.value = `Only ${over.max} unit${over.max === 1 ? '' : 's'} of ${over.name} ${over.max === 1 ? 'is' : 'are'} unallocated.`
    return
  }

  sharing.value = true
  shareError.value = ''

  try {
    const response = await bloodCenterService.addBloodRequestShare(row.id, shareLines.value.map((line) => ({
      transfusion_request_item_id: line.id,
      quantity: Math.max(0, Math.floor(Number(line.quantity) || 0)),
    })))

    const at = rows.value.findIndex((r) => r.id === row.id)
    if (at !== -1 && response?.request) rows.value.splice(at, 1, response.request)

    toast('Share Added', 'success', response?.message ?? 'Added to this center\'s Incoming Requests.')
    sharing.value = false
    shareFor.value = null
  } catch (err) {
    shareError.value = err?.message || 'The share could not be added.'
    sharing.value = false
  }
}

onMounted(() => load())
onBeforeUnmount(() => clearTimeout(searchDebounce))

// Kept alive with the page: back here, the page on screen reloads quietly.
onPageReturn(() => load(meta.value.current_page, { quiet: true }))

/*
 * Kept current while it is open: every 30 seconds while this tab and the
 * browser tab are in view. Paused while the share dialog is open.
 */
useLiveRefresh(() => load(meta.value.current_page, { quiet: true }), {
  intervalMs: 30_000,
  pauseWhen: () => shareFor.value !== null || sharing.value,
})

defineExpose({ refresh: () => load(meta.value.current_page) })
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css; shapes follow FulfillmentBoard.vue. */
.nbr { display: flex; flex-direction: column; gap: 14px; }
.card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: var(--rb-radius-lg); box-shadow: var(--rb-shadow-sm); }

.nbr-tools { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 14px; }
.nbr-search { position: relative; flex: 1 1 260px; max-width: 440px; }
.nbr-search__icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--rb-text-secondary); pointer-events: none; }
.nbr-search__input {
  width: 100%; height: 36px; padding: 0 12px 0 34px; border: 1px solid var(--rb-border-strong); border-radius: 10px;
  background: var(--rb-surface); color: var(--rb-text-primary); font: inherit; font-size: 13px;
}
.nbr-search__input::placeholder { color: var(--rb-placeholder); }
.nbr-search__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.nbr-scope { display: inline-flex; gap: 4px; padding: 3px; margin-left: auto; border: 1px solid var(--rb-border); border-radius: 10px; background: var(--rb-surface-alt); }
.nbr-scope__btn {
  height: 28px; padding: 0 12px; border: 0; border-radius: 7px; background: transparent; color: var(--rb-text-secondary);
  font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.nbr-scope__btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.nbr-scope__btn--on { background: var(--rb-surface); color: var(--rb-primary-text); box-shadow: var(--rb-shadow-sm); }

.banner { display: flex; align-items: center; gap: 9px; padding: 11px 14px; border-radius: 10px; font-size: 13px; }
.banner--error { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), .25); }
.skeleton-wrap { padding: 16px; }

.nbr-list { display: flex; flex-direction: column; gap: 14px; }
.nbr-card { padding: 16px 18px; }
.nbr-card--stat { border-color: rgba(var(--rb-accent-rgb), 0.35); }

.nbr-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.nbr-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.nbr-when { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--rb-text-secondary); }
.nbr-sub { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12.5px; color: var(--rb-text-secondary); margin: 5px 0 0; }
.nbr-hospital { font-weight: 600; color: var(--rb-text-primary); }
.nbr-needed { color: var(--rb-warning-text); font-weight: 600; }

.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.mono { font-family: var(--rb-font-mono); font-size: 12.5px; font-weight: 600; }
.tag { padding: 1px 6px; border-radius: 5px; font-size: 10px; font-weight: 700; }
.tag--stat { background: var(--rb-accent); color: #fff; }
.tag--muted { background: var(--rb-surface-alt); color: var(--rb-text-secondary); border: 1px solid var(--rb-border); }
.tag--mine { background: rgba(var(--rb-primary-rgb), .12); color: var(--rb-primary-text); }
.blood-pill {
  display: inline-block; padding: 1px 7px; border-radius: 6px; font-weight: 700; font-size: 11.5px;
  background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text);
}
.status { padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.status--pending { background: rgba(var(--rb-warning-rgb), .12); color: var(--rb-warning-text); }
.status--processing { background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }
.status--partial { background: rgba(var(--rb-warning-rgb), .12); color: var(--rb-warning-text); }
.status--fulfilled { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }

.nbr-body { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 16px; margin-top: 12px; }
.nbr-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.nbr-table th {
  padding: 7px 8px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase;
  color: var(--rb-text-secondary); border-bottom: 1px solid var(--rb-border); background: var(--rb-surface-alt);
}
.nbr-table td { padding: 7px 8px; color: var(--rb-text-primary); border-bottom: 1px solid var(--rb-border); }
.nbr-table tr:last-child td { border-bottom: 0; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.num--open { color: var(--rb-primary-text); font-weight: 700; }

.nbr-shares__title { margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; color: var(--rb-text-secondary); }
.nbr-shares__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.nbr-share { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border: 1px solid var(--rb-border); border-radius: 9px; }
.nbr-share--mine { border-color: rgba(var(--rb-primary-rgb), .35); background: rgba(var(--rb-primary-rgb), .04); }
.nbr-share__centre { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.nbr-share__meta { font-size: 12px; color: var(--rb-text-secondary); }
.nbr-share__link { color: var(--rb-primary-text); text-decoration: underline; text-underline-offset: 2px; }
.nbr-shares__none { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }

.nbr-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--rb-border); }
.nbr-blocked { flex: 1; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--rb-text-secondary); min-width: 180px; }
.nbr-pager { overflow: hidden; }

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
.modal-note { font-size: 12.5px; line-height: 1.5; margin: 14px 0 0; color: var(--rb-text-secondary); }
.modal-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 16px; }
.share-lines { display: flex; flex-direction: column; gap: 8px; }
.share-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 10px; border: 1px solid var(--rb-border); border-radius: 9px; }
.share-line__name { display: flex; flex-direction: column; gap: 2px; font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.share-line__open { font-size: 12px; font-weight: 400; color: var(--rb-text-secondary); }
.share-line__qty { width: 84px; text-align: right; }
.input {
  padding: 8px 10px; font-size: 13.5px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), .12); }
.field-error { font-size: 11.5px; color: var(--rb-accent-text); margin: 0; }
.field-error--block { margin: 10px 0 0; }

@media (max-width: 860px) {
  .nbr-body { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .nbr-card { padding: 14px; }
  .nbr-scope { margin-left: 0; }
  .nbr-actions { flex-direction: column; align-items: stretch; }
}
</style>
