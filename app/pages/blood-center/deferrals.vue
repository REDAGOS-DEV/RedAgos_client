<template>
  <div class="deferrals-page">
    <div class="deferrals-inner">
      <header class="header-row">
        <h1 class="page-title">Deferrals</h1>
        <button v-if="canDefer" type="button" class="btn-primary" @click="openNew">
          <AssetIcon name="plus" :size="15" />
          New Deferral
        </button>
      </header>

      <div v-if="loadError" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ loadError }}</p>
        <button type="button" class="btn-link" @click="load(pager.page)">Retry</button>
      </div>

      <div v-if="notice" class="banner" :class="`banner--${notice.tone}`" role="status">
        <AssetIcon :name="notice.tone === 'error' ? 'circle-alert' : 'circle-check-big'" :size="16" />
        <p class="banner__text">{{ notice.text }}</p>
        <button type="button" class="btn-link" @click="notice = null">Dismiss</button>
      </div>

      <section class="panel">
        <div class="toolbar">
          <div class="toolbar__filters">
            <label class="search">
              <AssetIcon name="search" :size="15" class="search__icon" />
              <input
                v-model="search"
                type="search"
                class="search__input"
                placeholder="Search donor / code…"
                aria-label="Search by donor name or ID, deferral ID, deferral code or reason"
                @input="onSearchInput"
              >
            </label>
            <SelectField v-model="statusFilter" class="sel-filter" size="sm" aria-label="Filter by status"
              :options="[{ value: '', label: 'All statuses' }, ...DEFERRAL_STATUS_FILTERS]" @change="load()" />
          </div>

          <div class="toolbar__actions">
            <span v-if="updatedAt" class="updated">
              <AssetIcon name="clock" :size="13" />
              Updated {{ updatedAtLabel }}
            </span>
            <button type="button" class="btn-outline" :disabled="loading" @click="load(pager.page)">
              <AssetIcon name="refresh-cw" :size="14" :class="{ spin: loading }" />
              Refresh
            </button>
          </div>
        </div>

        <div class="table-wrap" :class="{ 'table-wrap--busy': loading && rows.length }">
          <table class="def-table">
            <caption class="sr-only">Deferrals recorded at this centre</caption>
            <thead>
              <tr>
                <th scope="col" class="c-id">ID</th>
                <th scope="col" class="c-donor">Donor</th>
                <th scope="col" class="c-type">Type</th>
                <th scope="col" class="c-reason">Reason</th>
                <th scope="col" class="c-from">From</th>
                <th scope="col" class="c-until">Until</th>
                <th scope="col" class="c-status">Status</th>
                <th scope="col" class="c-actions">Actions</th>
              </tr>
            </thead>

            <tbody v-if="loading && !rows.length">
              <SkeletonRows :columns="8" :rows="6" :cell-classes="['c-id', 'c-donor', 'c-type', 'c-reason', 'c-from', 'c-until', 'c-status', 'c-actions']" />
            </tbody>

            <tbody v-else-if="!rows.length">
              <tr>
                <td colspan="8" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-state__icon"><AssetIcon :name="hasFilters ? 'search-x' : 'user-x'" :size="20" /></span>
                    <p class="empty-state__title">{{ hasFilters ? 'No deferrals match' : 'No deferrals yet' }}</p>
                    <p class="empty-state__text">
                      {{ hasFilters
                        ? 'Try another donor or reason, or another status.'
                        : 'Deferrals made at the counter, from a drive\'s paper records, or recorded here. Any of them can be lifted with a reason; the visit keeps its record.' }}
                    </p>
                    <button v-if="hasFilters" type="button" class="btn-outline" @click="clearFilters">Clear filters</button>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr
                v-for="row in rows"
                :key="row.key"
                class="def-row"
                tabindex="0"
                :aria-label="`Open deferral ${row.code}`"
                @click="detail = row"
                @keydown.enter.self="detail = row"
              >
                <td class="c-id">
                  <span class="code">{{ row.code }}</span>
                  <!-- Where it was decided (project owner, 2026-10-25): the counter's and a drive's paper screenings are listed too. -->
                  <span class="sub">{{ DEFERRAL_SOURCES[row.source] ?? '' }}</span>
                </td>
                <td class="c-donor">
                  <div class="person">
                    <PersonAvatar :name="row.donor?.full_name" :hidden="!(row.donor && !row.donor.blinded)" />
                    <div class="person__text">
                      <template v-if="row.donor && !row.donor.blinded">
                        <span class="person__name">{{ row.donor.full_name }}</span>
                        <span class="sub">{{ row.donor.donor_code }}</span>
                      </template>
                      <span v-else class="person__hidden">Identity hidden</span>
                    </div>
                  </div>
                </td>
                <td class="c-type">
                  <span class="badge" :class="`badge--${deferralKindBadge(row.kind).tone}`">
                    <span class="badge__dot" aria-hidden="true" />
                    {{ deferralKindBadge(row.kind).label }}
                  </span>
                </td>
                <td class="c-reason">
                  <!-- The code; the reason only when asked, as the screen may face the donor. -->
                  <DeferralCodeTag :code="row.reason_code" :reason="row.reason" />
                </td>
                <td class="c-from nowrap">{{ formatShortDate(row.deferred_on) }}</td>
                <td class="c-until nowrap">
                  <template v-if="row.ends_on">{{ formatShortDate(row.ends_on) }}</template>
                  <span v-else class="muted" title="No end date">—</span>
                </td>
                <td class="c-status">
                  <span
                    class="badge"
                    :class="`badge--${deferralStatusBadge(row.status).tone}`"
                    :title="row.status === 'lifted' ? liftedTitle(row) : null"
                  >
                    <span class="badge__dot" aria-hidden="true" />
                    {{ deferralStatusBadge(row.status).label }}
                  </span>
                </td>
                <td class="c-actions" @click.stop>
                  <div class="row-actions">
                    <button type="button" class="icon-btn" :aria-label="`View ${row.code}`" title="View" @click="detail = row">
                      <AssetIcon name="eye" :size="15" />
                    </button>
                    <button
                      v-if="row.can?.lift"
                      type="button"
                      class="act-btn"
                      :aria-label="`Lift ${row.code}`"
                      title="Lift this deferral"
                      @click="askLift(row)"
                    >
                      <AssetIcon name="undo-2" :size="13" />
                      Lift
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer class="pager">
          <span class="pager__info">
            <template v-if="pager.total">Showing {{ pageFrom }}–{{ pageTo }} of </template>{{ pager.total }} record(s)
          </span>
          <div class="pager__btns">
            <button type="button" class="btn-outline btn-outline--sm" :disabled="pager.page <= 1 || loading" @click="load(pager.page - 1)">
              <AssetIcon name="chevron-left" :size="14" />
              Prev
            </button>
            <span class="pager__page">Page {{ pager.page }} / {{ pager.lastPage }}</span>
            <button type="button" class="btn-outline btn-outline--sm" :disabled="pager.page >= pager.lastPage || loading" @click="load(pager.page + 1)">
              Next
              <AssetIcon name="chevron-right" :size="14" />
            </button>
          </div>
        </footer>
      </section>
    </div>

    <!-- ============ NEW DEFERRAL ============ -->
    <!-- The shared form; the counter's Defer donor opens the same one. -->
    <DeferralFormDialog
      v-if="form.open"
      :saving="form.saving"
      :error="form.error"
      :errors="form.errors"
      @close="closeNew"
      @submit="submitNew"
    />

    <!-- ============ DETAIL ============ -->
    <CenterModal v-if="detail" :title="`Deferral ${detail.code}`" eyebrow="Deferral record" size="md" @close="detail = null">
      <template #meta>
        <span class="badge" :class="`badge--${deferralKindBadge(detail.kind).tone}`">
          <span class="badge__dot" aria-hidden="true" />
          {{ deferralKindBadge(detail.kind).label }}
        </span>
        <span class="badge" :class="`badge--${deferralStatusBadge(detail.status).tone}`">
          <span class="badge__dot" aria-hidden="true" />
          {{ deferralStatusBadge(detail.status).label }}
        </span>
      </template>

      <div class="dd">
        <div class="dd-donor">
          <PersonAvatar size="lg" :name="detail.donor?.full_name" :hidden="!(detail.donor && !detail.donor.blinded)" />
          <div class="dd-donor__text">
            <p class="dd-name">{{ detail.donor && !detail.donor.blinded ? detail.donor.full_name : 'Identity hidden' }}</p>
            <p v-if="detail.donor && !detail.donor.blinded" class="dd-sub">{{ detail.donor.donor_code }}</p>
          </div>
        </div>

        <dl class="facts">
          <div class="fact fact--full">
            <dt>Reason</dt>
            <!-- The code; the reason only when asked, as the screen may face the donor. -->
            <dd><DeferralCodeTag :code="detail.reason_code" :reason="detail.reason" /></dd>
          </div>
          <div class="fact">
            <dt>From</dt>
            <dd>{{ formatShortDate(detail.deferred_on) }}</dd>
          </div>
          <div class="fact">
            <dt>Until</dt>
            <dd>{{ detail.ends_on ? formatShortDate(detail.ends_on) : 'No end date' }}</dd>
          </div>
          <div class="fact">
            <dt>Decided at</dt>
            <dd>{{ DEFERRAL_SOURCES[detail.source] || '—' }}</dd>
          </div>
          <div class="fact">
            <dt>Recorded by</dt>
            <dd>{{ detail.recorded_by || '—' }}</dd>
          </div>
          <div v-if="detail.status === 'lifted'" class="fact fact--full">
            <dt>Lifted</dt>
            <dd>
              {{ detail.lifted_at ? formatShortDate(detail.lifted_at) : 'Lifted' }}<template v-if="detail.lifted_by"> by {{ detail.lifted_by }}</template>
              <span v-if="detail.lift_reason" class="fact__sub">{{ detail.lift_reason }}</span>
            </dd>
          </div>
        </dl>
      </div>

      <template #actions>
        <button type="button" class="btn-outline" @click="detail = null">Close</button>
        <button v-if="detail.can?.lift" type="button" class="btn-primary" @click="liftFromDetail">
          <AssetIcon name="undo-2" :size="14" />
          Lift deferral
        </button>
      </template>
    </CenterModal>

    <!-- ============ LIFT ============ -->
    <CenterModal v-if="lifting.row" title="Lift this deferral?" size="sm" @close="cancelLift">
      <div class="dd-form">
        <p class="dd-text">
          {{ lifting.row.code }}<template v-if="lifting.row.donor && !lifting.row.donor.blinded"> for {{ lifting.row.donor.full_name }}</template>
          ({{ deferralKindBadge(lifting.row.kind).label.toLowerCase() }}{{ lifting.row.reason_code ? `, ${lifting.row.reason_code}` : '' }}).
          Lifting it lets them donate again unless another deferral still stands. The record stays on this list<template v-if="lifting.row.source !== 'manual'">, and the visit keeps its outcome</template>.
        </p>
        <label class="form-label" for="lift-reason">Reason <span class="req">*</span></label>
        <textarea id="lift-reason" v-model="lifting.reason" class="form-input form-textarea" rows="2" maxlength="1000" placeholder="e.g. Haemoglobin back in range on recheck" />
        <p v-if="lifting.error" class="form-error" role="alert">{{ lifting.error }}</p>
      </div>
      <template #actions>
        <button type="button" class="btn-outline" @click="cancelLift">Back</button>
        <button type="button" class="btn-primary" :disabled="lifting.busy || !lifting.reason.trim()" @click="confirmLift">
          {{ lifting.busy ? 'Lifting…' : 'Lift deferral' }}
        </button>
      </template>
    </CenterModal>
  </div>
</template>

<script setup>
import SkeletonRows from '~/components/ui/SkeletonRows.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import SelectField from '~/components/common/SelectField.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import DeferralCodeTag from '~/components/BloodCenter/DeferralCodeTag.vue'
import DeferralFormDialog from '~/components/BloodCenter/DeferralFormDialog.vue'
import CenterModal from '~/components/ui/CenterModal.vue'
import PersonAvatar from '~/components/ui/PersonAvatar.vue'
import {
  DEFERRAL_STATUS_FILTERS,
  deferralKindBadge,
  deferralPayload,
  deferralStatusBadge,
} from '~/utils/deferrals'
import { formatShortDate } from '~/utils/donorRecords'
import { ref, reactive, computed, onMounted, onBeforeUnmount, onActivated, onDeactivated } from 'vue'
import { onPageReturn } from '~/composables/useKeptAlive'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  // The list carries deferral reasons: the clinical record's holder (the
  // screening physician), as the server's route demands.
  requires: 'donors.view_clinical',
  keepalive: true,
})

const { can } = useUser()
const canDefer = computed(() => can('donors.defer'))

/**
 * API SHAPE
 * -------------------------------------------------------------------------
 *  GET  /deferrals?search=&status=&page=   (donors.view_clinical)
 *       -> paginator; rows: { id, code, donor (blinded without
 *          donors.view_identity), outcome, outcome_label, kind
 *          ('temporary' | 'indefinite' | 'permanent'), reason_code, reason,
 *          deferred_on, ends_on, status ('active' | 'expired' | 'lifted'),
 *          recorded_by, lifted_at, lifted_by, lift_reason, can: { lift } }
 *  POST /deferrals { donor_uuid, outcome, deferral_code, deferred_on, ends_on }
 *       (donors.defer; ends_on only for a temporary deferral)
 *  POST /deferrals/{id}/lift { reason }                       (donors.defer)
 *  GET  /deferral-codes  the centre's codes for the picker (project owner,
 *       2026-10-24): a deferral is recorded by code, and the record shows
 *       the code; the reason stays folded in DeferralCodeTag.
 *
 * Deferrals recorded here are this centre's own. Every other screen (the
 * Donors list, the counter's notice, bookings, reminders) hears of them
 * through the donor's standing, not from this page.
 * -------------------------------------------------------------------------
 */

const PER_PAGE = 25

const loading = ref(true)
const loadError = ref('')
const notice = ref(null)
useNoticeToast(notice)
const updatedAt = ref(null)
const rows = ref([])
const pager = reactive({ page: 1, lastPage: 1, total: 0 })
const pageFrom = computed(() => (pager.total ? (pager.page - 1) * PER_PAGE + 1 : 0))
const pageTo = computed(() => Math.min(pager.page * PER_PAGE, pager.total))

/** The row whose record is open. */
const detail = ref(null)

const search = ref('')
const statusFilter = ref('')

const hasFilters = computed(() => Boolean(search.value.trim() || statusFilter.value))
const updatedAtLabel = computed(() => updatedAt.value?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) ?? '')

/** Where a deferral on this list was decided. */
const DEFERRAL_SOURCES = { manual: 'Recorded here', counter: 'Counter screening', paper: 'Paper record' }

function filterParams() {
  const params = {}
  if (search.value.trim()) params.search = search.value.trim()
  if (statusFilter.value) params.status = statusFilter.value
  return params
}

function errorMessage(err, fallback) {
  return Object.values(err?.errors ?? err?.data?.errors ?? {}).flat()[0] || err?.message || fallback
}

function liftedTitle(row) {
  const by = row.lifted_by ? ` by ${row.lifted_by}` : ''
  const on = row.lifted_at ? ` on ${formatShortDate(row.lifted_at)}` : ''
  return `Lifted${by}${on}${row.lift_reason ? `: ${row.lift_reason}` : ''}`
}

async function load(page = 1) {
  loading.value = true
  loadError.value = ''
  try {
    const res = await bloodCenterService.deferrals({ ...filterParams(), page, per_page: PER_PAGE })
    rows.value = res?.data ?? []
    Object.assign(pager, { page: res?.current_page ?? page, lastPage: Math.max(1, res?.last_page ?? 1), total: res?.total ?? rows.value.length })
    updatedAt.value = new Date()
  } catch (err) {
    loadError.value = errorMessage(err, 'Could not load deferrals.')
  } finally {
    loading.value = false
  }
}

let searchTimer = null

function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => load(), 300)
}

function clearFilters() {
  search.value = ''
  statusFilter.value = ''
  load()
}

/* ---------- new deferral ---------- */

// The form itself is DeferralFormDialog; the page records what it submits.
const form = reactive({ open: false, saving: false, error: '', errors: {} })

function openNew() {
  Object.assign(form, { open: true, saving: false, error: '', errors: {} })
}

function closeNew() {
  if (form.saving) return
  form.open = false
}

async function submitNew(choice) {
  if (form.saving) return
  form.saving = true
  form.error = ''
  form.errors = {}

  try {
    const res = await bloodCenterService.recordDeferral(deferralPayload({
      donorUuid: choice.donor.uuid,
      outcome: choice.outcome,
      code: choice.code,
      otherReason: choice.otherReason,
      from: choice.from,
      until: choice.until,
    }))
    form.saving = false
    form.open = false
    notice.value = { tone: 'success', text: `${choice.donor.name} is deferred (${res?.code ?? 'saved'}).` }
    await load(1)
  } catch (err) {
    form.errors = err?.errors ?? err?.data?.errors ?? {}
    form.error = err?.message || 'Could not record the deferral.'
  } finally {
    form.saving = false
  }
}

/* ---------- lift ---------- */

const lifting = reactive({ row: null, reason: '', busy: false, error: '' })

function askLift(row) {
  Object.assign(lifting, { row, reason: '', busy: false, error: '' })
}

function cancelLift() {
  if (lifting.busy) return
  lifting.row = null
}

async function confirmLift() {
  if (!lifting.reason.trim() || lifting.busy) return
  lifting.busy = true
  lifting.error = ''
  try {
    // A counter or paper screening's deferral is lifted by its screening's id.
    await bloodCenterService.liftDeferral(lifting.row.id, lifting.reason.trim(), lifting.row.source === 'manual' ? 'manual' : 'screening')
    notice.value = { tone: 'success', text: `${lifting.row.code} is lifted.` }
    lifting.busy = false
    lifting.row = null
    await load(pager.page)
  } catch (err) {
    lifting.error = errorMessage(err, 'Could not lift this deferral.')
    lifting.busy = false
  }
}

/* ---------- keyboard and lifecycle ---------- */

/** Lift from the record: the record closes and the lift dialog opens. */
function liftFromDetail() {
  const row = detail.value
  detail.value = null
  askLift(row)
}

function onKeydown(event) {
  if (event.key !== 'Escape') return
  if (lifting.row) cancelLift()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  load()
})

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  window.removeEventListener('keydown', onKeydown)
})

// Kept alive: away, Escape belongs to the page on screen; back, the list
// reloads in place (the skeleton shows only over an empty one).
onDeactivated(() => window.removeEventListener('keydown', onKeydown))
onActivated(() => window.addEventListener('keydown', onKeydown))
onPageReturn(() => load(pager.page))
</script>

<style scoped>
.deferrals-page {
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
}

.deferrals-inner { display: flex; flex-direction: column; gap: 16px; }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ---------- Skeletons ---------- */
.skeleton {
  display: block;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}

.skeleton-head { display: flex; flex-direction: column; gap: 8px; }
.skeleton--header { height: 28px; max-width: 200px; border-radius: 8px; }
.skeleton--sub { height: 14px; max-width: 320px; border-radius: 6px; }
.skeleton--panel { height: 420px; }
.skeleton--line { height: 16px; width: 100%; border-radius: 6px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

/* ---------- Header and buttons ---------- */
.header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0; }

.btn-primary,
.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.btn-primary { color: #fff; background: var(--rb-primary); border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

.btn-outline { color: var(--rb-text-primary); background: var(--rb-surface); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline--sm { height: 30px; padding: 0 10px; font-size: 12px; border-radius: 8px; gap: 4px; }

.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--rb-primary-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn-link:hover { text-decoration: underline; }

.btn-primary:focus-visible,
.btn-outline:focus-visible,
.btn-link:focus-visible,
.icon-btn:focus-visible {
  outline: none;
  box-shadow: var(--rb-focus-ring);
}

.spin { animation: spin 0.9s linear infinite; }

@keyframes spin { to { transform: rotate(360deg); } }

/* ---------- Banners ---------- */
.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 13px;
}

.banner > :deep(.asset-icon) { flex-shrink: 0; }
.banner__text { flex: 1; margin: 0; line-height: 1.45; }
.banner--success > :deep(.asset-icon) { color: var(--rb-success-text); }
.banner--error > :deep(.asset-icon) { color: var(--rb-accent-text); }
.banner--error { border-color: rgba(var(--rb-accent-rgb), 0.35); }

/* ---------- Panel and toolbar ---------- */
.panel {
  container-type: inline-size;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  overflow: hidden;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--rb-border);
}

.toolbar__filters,
.toolbar__actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toolbar__filters { flex: 1 1 auto; min-width: 0; }
.toolbar__actions { justify-content: flex-end; margin-left: auto; }

.updated {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: 4px;
  font-size: 12px;
  color: var(--rb-text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.search { position: relative; flex: 1 1 180px; min-width: 160px; max-width: 280px; }

.search__icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--rb-text-secondary);
  pointer-events: none;
}

.search__input,
.select {
  height: 36px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.search__input { width: 100%; padding: 0 12px 0 34px; }

/* As wide as the chosen option, not the longest one (where supported). */
.select {
  field-sizing: content;
  padding: 0 30px 0 12px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 10px 6px;
  appearance: none;
  cursor: pointer;
}

.search__input::placeholder { color: var(--rb-placeholder); }

.search__input:focus,
.select:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

/* ---------- Table ---------- */
.table-wrap { position: relative; overflow-x: auto; transition: opacity 0.15s ease; }
.table-wrap--busy { opacity: 0.55; }

.def-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 13px; }

.def-table thead th {
  padding: 10px;
  background: var(--rb-surface-alt);
  border-bottom: 1px solid var(--rb-border);
  text-align: left;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rb-text-secondary);
  white-space: nowrap;
}

.def-table tbody td {
  padding: 11px 10px;
  border-bottom: 1px solid var(--rb-border);
  vertical-align: middle;
  overflow: hidden;
}

.def-table th:first-child,
.def-table td:first-child { padding-left: 16px; }

.def-table th:last-child,
.def-table td:last-child { padding-right: 16px; }

.def-table tbody tr:last-child td { border-bottom: 0; }
.def-row { transition: background 0.12s ease; }
.def-row:hover { background: rgba(var(--rb-primary-rgb), 0.06); }

.c-id { width: 138px; }
.c-id .sub { white-space: nowrap; }
.c-type { width: 124px; }
.c-from { width: 114px; }
.c-until { width: 114px; }
.c-status { width: 108px; }
.c-actions { width: 140px; }

/* Narrow panels keep who, why, until when and where it stands. */
@container (max-width: 940px) {
  .c-from, .def-table tbody :deep(td.c-from) { display: none; }
}

@container (max-width: 780px) {
  .c-id, .def-table tbody :deep(td.c-id) { display: none; }
}

.code { font-family: var(--rb-font-mono); font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); white-space: nowrap; }
.donor__name { display: block; font-weight: 700; text-transform: capitalize; overflow-wrap: anywhere; }
.sub { display: block; margin-top: 2px; font-size: 11.5px; color: var(--rb-text-secondary); }
.muted { color: var(--rb-text-secondary); }
.nowrap { white-space: nowrap; }

/* One line, the full text on hover. */
.reason { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Type and status: the colour lives on the dot, never on the badge's fill. */
.badge {
  --tone: var(--rb-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
}

.badge__dot { width: 6px; height: 6px; border-radius: 999px; background: var(--tone); flex-shrink: 0; }
.badge--info { --tone: var(--rb-primary); }
.badge--ok { --tone: var(--rb-success); }
.badge--warn { --tone: var(--rb-warning); }
.badge--crit { --tone: var(--rb-accent); }
.badge--neutral { --tone: var(--rb-text-muted); color: var(--rb-text-secondary); }



.empty-cell { padding: 0 !important; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 24px; text-align: center; }

.empty-state__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-bottom: 6px;
  border-radius: 12px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
  color: var(--rb-text-secondary);
}

.empty-state__title { margin: 0; font-size: 14px; font-weight: 700; }
.empty-state__text { margin: 0 0 8px; max-width: 52ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

/* ---------- Pager ---------- */
.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  padding: 12px 16px;
  border-top: 1px solid var(--rb-border);
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}

.pager__btns { display: flex; align-items: center; gap: 8px; }
.pager__page { font-variant-numeric: tabular-nums; }


.form-label { font-size: 12.5px; font-weight: 600; }
.req { color: var(--rb-accent-text); }

.form-error {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-accent-text);
  font-size: 13px;
  line-height: 1.45;
}

/* Anchored on the dialog body: it is teleported, and other portals ship unscoped dark .form-input rules. */
.dd-form .form-input {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
  color-scheme: light dark;
}

.dd-form .form-input:disabled { background-color: var(--rb-surface-alt); color: var(--rb-text-secondary); cursor: not-allowed; }
.dd-form .form-input::placeholder { color: var(--rb-placeholder); }
.dd-form .form-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.dd-form .form-textarea { height: auto; min-height: 64px; padding: 10px 12px; line-height: 1.5; resize: vertical; }

@media (max-width: 760px) {
  .toolbar__filters { flex-basis: 100%; }
  .search { max-width: none; flex: 1 1 100%; }
  .toolbar__actions { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .spin { animation: none !important; }
}

/* ---------- Rows, as on Donations ---------- */
.def-row { cursor: pointer; }
.def-row:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }
.person { display: flex; align-items: center; gap: 10px; min-width: 0; }
.person__text { min-width: 0; }
.person__name { display: block; font-weight: 700; text-transform: capitalize; overflow-wrap: anywhere; }
.person__hidden { color: var(--rb-text-secondary); }
.row-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }

/* The row's next step, said in words. */
.act-btn {
  display: inline-flex; flex-shrink: 0; align-items: center; gap: 5px; height: 30px; padding: 0 10px; border-radius: 8px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.45); background: rgba(var(--rb-primary-rgb), 0.06);
  color: var(--rb-primary-text); font-family: inherit; font-size: 12px; font-weight: 700; text-decoration: none; white-space: nowrap;
  cursor: pointer; transition: background 0.12s ease;
}
.act-btn:hover:not(:disabled) { background: rgba(var(--rb-primary-rgb), 0.12); }
.act-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.act-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ---------- Record dialog ---------- */
.dd { display: flex; flex-direction: column; gap: 18px; }
.dd-donor { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--rb-border); border-radius: 12px; background: var(--rb-surface-alt); }
.dd-donor__text { flex: 1; min-width: 0; }
.dd-name { margin: 0; font-size: 16px; font-weight: 700; text-transform: capitalize; }
.dd-sub { margin: 2px 0 0; font-size: 12px; color: var(--rb-text-secondary); }
.dd-blood { min-width: 44px; padding: 4px 10px; font-size: 13px; }
.dd-note { margin: 0; padding: 12px 14px; border-radius: 10px; background: var(--rb-surface-alt); font-size: 13px; line-height: 1.55; white-space: pre-line; overflow-wrap: anywhere; }
.dd-section__title { margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--rb-text-secondary); }
.facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 18px; margin: 0; padding-top: 16px; border-top: 1px solid var(--rb-border); }
.fact { min-width: 0; }
.fact--full { grid-column: 1 / -1; }
.fact dt { margin: 0 0 3px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--rb-text-secondary); }
.fact dd { margin: 0; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
.fact__sub { display: block; font-size: 11.5px; font-weight: 500; color: var(--rb-text-secondary); }
.dd-text { margin: 0; font-size: 13.5px; line-height: 1.55; }
.dd-form { display: flex; flex-direction: column; gap: 10px; }

.icon-btn {
  display: grid; flex-shrink: 0; place-items: center; width: 30px; height: 30px; padding: 0; border-radius: 8px;
  border: 1px solid var(--rb-border-strong); background: var(--rb-surface); color: var(--rb-text-secondary);
  cursor: pointer; transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
.icon-btn:hover:not(:disabled) { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.45); background: var(--rb-surface-hover); }
.icon-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* Loading rows as tall as the real ones (measured at 1366px), so nothing jumps. */
.def-table tbody :deep(tr[aria-hidden="true"] td) { height: 65px; padding: 0 10px; border-bottom: 1px solid var(--rb-border); }
.def-table tbody :deep(tr[aria-hidden="true"] td:first-child) { padding-left: 16px; }
</style>

<style scoped>
/* The system dropdown in a toolbar: a fixed width rather than the row's. */
.sel-filter { width: 180px; flex: none; }
</style>
