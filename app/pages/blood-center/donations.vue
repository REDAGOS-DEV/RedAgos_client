<template>
  <div class="donations-page">
    <div v-if="initialLoading" class="donations-inner" aria-busy="true" aria-label="Loading donations">
      <div class="skeleton-head">
        <div class="skeleton skeleton--header" />
        <div class="skeleton skeleton--sub" />
      </div>
      <div class="skeleton skeleton--panel" />
    </div>

    <div v-else class="donations-inner">
      <header class="header-row">
        <div>
          <h1 class="page-title">Donations</h1>
          <p class="page-subtitle">{{ listSummary }}</p>
        </div>
        <div v-if="canRecordPaper || canStartVisit" class="header-actions">
          <!-- A remote drive's paper records, typed in after the drive. Up here
               so the list's toolbar fits on one line. -->
          <NuxtLink v-if="canRecordPaper" to="/blood-center/paper-records" class="btn-outline">
            <AssetIcon name="file-text" :size="14" />
            Paper Records
          </NuxtLink>
          <!-- A booked donor's visit starts here now: the counter has no scan of
               its own (project owner, 2026-10-24). -->
          <button v-if="canStartVisit" type="button" class="btn-primary" @click="scanning = true">
            <AssetIcon name="qr-code" :size="15" />
            Scan QR
          </button>
        </div>
      </header>

      <DonorQrScanDialog v-if="scanning" @close="scanning = false" />

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
                placeholder="Search donor / donation ID / bag…"
                aria-label="Search by donor name, phone or ID, donation ID or bag barcode"
                @input="onSearchInput"
              >
            </label>
            <SelectField v-model="statusFilter" class="sel-filter" size="sm" aria-label="Filter by status"
              :options="[{ value: '', label: 'All statuses' }, ...DONATION_STATUS_FILTERS]" @change="load()" />
            <SelectField v-model="bloodTypeId" class="sel-filter" size="sm" aria-label="Filter by blood group"
              :options="[{ value: '', label: 'All groups' }, ...bloodTypeOptions.map(bt => ({ value: bt.id, label: bt.code }))]" @change="load()" />
            <DateRangeFilter v-model:from="fromDate" v-model:to="toDate" @change="load()" />
          </div>

          <div class="toolbar__actions">
            <span v-if="updatedAt" class="updated">
              <AssetIcon name="clock" :size="13" />
              Updated {{ updatedAtLabel }}
            </span>
            <button type="button" class="btn-outline btn-outline--squeeze" :disabled="exporting || !pager.total" title="Export" @click="exportList">
              <AssetIcon name="download" :size="14" />
              <span class="btn-text">{{ exporting ? 'Exporting…' : 'Export' }}</span>
            </button>
            <button
              type="button"
              class="btn-outline btn-outline--squeeze"
              :disabled="loading"
              :title="updatedAt ? `Refresh · updated ${updatedAtLabel}` : 'Refresh'"
              @click="load(pager.page)"
            >
              <AssetIcon name="refresh-cw" :size="14" :class="{ spin: loading }" />
              <span class="btn-text">Refresh</span>
            </button>
          </div>
        </div>

        <div class="table-wrap" :class="{ 'table-wrap--busy': loading && rows.length }">
          <table class="don-table">
            <caption class="sr-only">Donations at this centre</caption>
            <thead>
              <tr>
                <th scope="col" class="c-id">ID</th>
                <th scope="col" class="c-donor">Donor</th>
                <th scope="col" class="c-group">Group</th>
                <th scope="col" class="c-date">Date</th>
                <th scope="col" class="c-bag">Bag</th>
                <th scope="col" class="c-appt">Appointment</th>
                <th scope="col" class="c-status">Status</th>
                <th scope="col" class="c-actions">Actions</th>
              </tr>
            </thead>

            <tbody v-if="loading && !rows.length">
              <tr v-for="n in 6" :key="'sk-' + n">
                <td colspan="8"><span class="skeleton skeleton--line" /></td>
              </tr>
            </tbody>

            <tbody v-else-if="!rows.length">
              <tr>
                <td colspan="8" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-state__icon"><AssetIcon :name="hasFilters ? 'search-x' : 'droplets'" :size="20" /></span>
                    <p class="empty-state__title">{{ hasFilters ? 'No donations match' : 'No donations yet' }}</p>
                    <p class="empty-state__text">
                      {{ hasFilters
                        ? 'Try another donor, ID or bag, or widen the dates.'
                        : "Every visit at the Donation Counter, or typed from a drive's paper records, appears here." }}
                    </p>
                    <button v-if="hasFilters" type="button" class="btn-outline" @click="clearFilters">Clear filters</button>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr v-for="row in rows" :key="row.id" class="don-row" :class="{ 'don-row--open': row.open }">
                <td class="c-id">
                  <span class="code">{{ row.code }}</span>
                  <span v-if="row.source === 'paper'" class="chip" :title="`Typed from paper sheet ${row.paper_sheet?.code}`">Paper</span>
                </td>
                <td class="c-donor">
                  <template v-if="row.donor && !row.donor.blinded">
                    <span class="donor__name">{{ row.donor.full_name }}</span>
                    <span class="sub">{{ row.donor.donor_code }}</span>
                  </template>
                  <span v-else class="muted">Identity hidden</span>
                </td>
                <td class="c-group">
                  <span v-if="row.donor?.blood_type" class="blood">{{ row.donor.blood_type }}</span>
                  <span v-else class="muted" title="Not typed yet">—</span>
                </td>
                <td class="c-date nowrap">
                  {{ formatShortDate(row.date) }}
                  <span class="sub">{{ row.time }}</span>
                </td>
                <td class="c-bag">
                  <span v-if="row.bag?.barcode" class="code code--bag">{{ row.bag.barcode }}</span>
                  <span v-else class="muted">{{ row.open ? 'Not drawn' : '—' }}</span>
                  <span v-if="row.volume_ml" class="sub">{{ row.volume_ml }} mL</span>
                </td>
                <td class="c-appt">
                  <span>{{ row.appointment?.code ?? 'Walk-in' }}</span>
                  <span v-if="row.drive" class="sub">{{ row.drive }}</span>
                </td>
                <td class="c-status">
                  <span class="badge" :class="`badge--${donationTone(row.status, row.status_label)}`">
                    <span class="badge__dot" aria-hidden="true" />
                    {{ row.status_label }}
                  </span>
                </td>
                <td class="c-actions">
                  <div class="row-actions">
                    <button type="button" class="icon-btn" :aria-label="`View ${row.code}`" title="View" @click="openDetail(row)">
                      <AssetIcon name="eye" :size="15" />
                    </button>
                    <NuxtLink
                      v-if="row.open && canStartVisit && row.donor?.uuid"
                      :to="continueLink(row.donor.uuid)"
                      class="icon-btn"
                      :aria-label="`Continue ${row.code} at the Donation Counter`"
                      title="Continue at the Donation Counter"
                    >
                      <AssetIcon name="arrow-right" :size="15" />
                    </NuxtLink>
                    <button
                      v-if="row.open && canClose"
                      type="button"
                      class="icon-btn icon-btn--danger"
                      :disabled="!row.can.close"
                      :aria-label="`Close visit ${row.code}`"
                      title="Close this visit"
                      @click="askClose(row)"
                    >
                      <AssetIcon name="x" :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer class="pager">
          <span class="pager__info">{{ pager.total }} record(s)</span>
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

    <!-- ============ DETAIL ============ -->
    <Transition name="modal">
      <div v-if="detail" class="modal-overlay" @click.self="detail = null">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="detail-title">
          <div class="modal-card__header">
            <h2 id="detail-title" class="modal-card__title">
              <AssetIcon name="droplets" :size="17" />
              Donation {{ detail.code }}
            </h2>
            <button type="button" class="modal-card__close" aria-label="Close" @click="detail = null">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>
          <div class="modal-card__body">
            <div class="detail-head">
              <div>
                <p class="detail-name">{{ detail.donor && !detail.donor.blinded ? detail.donor.full_name : 'Identity hidden' }}</p>
                <p class="sub">
                  <template v-if="detail.donor && !detail.donor.blinded">{{ detail.donor.donor_code }} · </template>{{ detail.donor?.blood_type || 'Not typed' }}
                </p>
              </div>
              <span class="badge" :class="`badge--${donationTone(detail.status, detail.status_label)}`">
                <span class="badge__dot" aria-hidden="true" />
                {{ detail.status_label }}
              </span>
            </div>

            <dl class="facts">
              <div class="fact"><dt>Opened</dt><dd>{{ formatShortDate(detail.date) }} · {{ detail.time }}</dd></div>
              <div class="fact"><dt>Appointment</dt><dd>{{ detail.appointment?.code ?? 'Walk-in' }}<span v-if="detail.drive" class="fact__sub">{{ detail.drive }}</span></dd></div>
              <div class="fact">
                <dt>Screening</dt>
                <dd>
                  {{ detail.screening?.outcome_label ?? 'Not screened yet' }}
                  <span v-if="detail.screening?.recorded_by" class="fact__sub">by {{ detail.screening.recorded_by }}</span>
                  <!-- The code for everyone here; the reason, folded, only for the clinical record's holder. -->
                  <span v-if="detail.screening?.deferral_code || detail.screening?.deferral_reason" class="fact__sub">
                    <DeferralCodeTag :code="detail.screening.deferral_code" :reason="detail.screening.deferral_reason" />
                  </span>
                </dd>
              </div>
              <div class="fact">
                <dt>Bag</dt>
                <dd>
                  {{ detail.bag?.barcode ?? 'Not drawn' }}
                  <span v-if="detail.bag?.type" class="fact__sub">{{ detail.bag.type }}<template v-if="detail.volume_ml"> · {{ detail.volume_ml }} mL</template></span>
                </dd>
              </div>
              <div class="fact">
                <dt>Collected</dt>
                <dd>
                  {{ detail.collection?.collected_at ? formatDateTime(detail.collection.collected_at) : '—' }}
                  <span v-if="detail.collection?.collected_by" class="fact__sub">by {{ detail.collection.collected_by }}</span>
                </dd>
              </div>
              <div v-if="detail.rejection_reason" class="fact fact--full"><dt>Closed because</dt><dd>{{ detail.rejection_reason }}</dd></div>
              <div v-if="detail.source === 'paper' && detail.paper_sheet" class="fact fact--full">
                <dt>Source</dt>
                <dd>
                  Paper sheet {{ detail.paper_sheet.code }}
                  <span class="fact__sub">
                    Typed in<template v-if="detail.paper_sheet.entered_by"> by {{ detail.paper_sheet.entered_by }}</template>
                    from the drive's paper record. The names above are as the paper gives them.
                  </span>
                </dd>
              </div>
            </dl>
          </div>
          <div class="modal-card__footer">
            <NuxtLink
              v-if="detail.source === 'paper' && detail.paper_sheet && canRecordPaper"
              :to="`/blood-center/paper-records/${detail.paper_sheet.id}`"
              class="btn-outline"
            >
              Open the sheet
              <AssetIcon name="arrow-right" :size="14" />
            </NuxtLink>
            <NuxtLink v-if="detail.open && canStartVisit && detail.donor?.uuid" :to="continueLink(detail.donor.uuid)" class="btn-outline">
              Continue at the counter
              <AssetIcon name="arrow-right" :size="14" />
            </NuxtLink>
            <button type="button" class="btn-outline" @click="detail = null">Close</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ============ CLOSE VISIT ============ -->
    <Transition name="modal">
      <div v-if="closing.row" class="modal-overlay" @click.self="cancelClose">
        <div class="modal-card modal-card--sm" role="alertdialog" aria-modal="true" aria-labelledby="close-title">
          <div class="modal-card__header">
            <h2 id="close-title" class="modal-card__title">
              <AssetIcon name="triangle-alert" :size="17" />
              Close this visit?
            </h2>
            <button type="button" class="modal-card__close" aria-label="Close" @click="cancelClose">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>
          <div class="modal-card__body">
            <p class="modal-text">
              {{ closing.row.code }}<template v-if="closing.row.donor && !closing.row.donor.blinded"> for {{ closing.row.donor.full_name }}</template>
              was opened but no blood was drawn. Closing it frees the donor to start a new visit; nothing is collected.
            </p>
            <label class="form-label" for="close-reason">Reason <span class="form-optional">optional</span></label>
            <textarea id="close-reason" v-model="closing.reason" class="form-input form-textarea" rows="2" maxlength="255" placeholder="e.g. Left before screening" />
            <p v-if="closing.error" class="form-error" role="alert">{{ closing.error }}</p>
          </div>
          <div class="modal-card__footer">
            <button type="button" class="btn-outline" @click="cancelClose">Back</button>
            <button type="button" class="btn-primary btn-primary--danger" :disabled="closing.busy" @click="confirmClose">
              {{ closing.busy ? 'Closing…' : 'Close visit' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import SelectField from '~/components/common/SelectField.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import DeferralCodeTag from '~/components/BloodCenter/DeferralCodeTag.vue'
import DonorQrScanDialog from '~/components/BloodCenter/DonorQrScanDialog.vue'
import DateRangeFilter from '~/components/common/DateRangeFilter.vue'
import { COLLECTION_ABILITIES } from '~/composables/useBloodCenterNav'
import { DONATION_STATUS_FILTERS, donationTone } from '~/utils/donationRecords'
import { formatShortDate, orderBloodGroups } from '~/utils/donorRecords'
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  // Every role at the counter holds it, and no one outside the department.
  requires: 'donations.view',
})

const { can } = useUser()
const canUseCounter = computed(() => can(COLLECTION_ABILITIES))

// Starting a visit (Scan QR) or carrying one on (Continue) brings the donor up
// at the counter, which is appointments.verify's (project owner, 2026-10-24).
const canStartVisit = computed(() => canUseCounter.value && can('appointments.verify'))
const scanning = ref(false)

/** The counter, with this donor and the visit already under way. */
function continueLink(donorUuid) {
  return { path: '/blood-center/donation', query: { donor: donorUuid } }
}
const canClose = computed(() => can('donations.close'))
const canRecordPaper = computed(() => can('donations.record_paper'))

/**
 * API SHAPE
 * -------------------------------------------------------------------------
 *  GET   /donation-records?search=&status=&blood_type_id=&from=&to=&page=
 *        -> paginator; rows: { id, code, date, time, status, status_label,
 *           open, donor (blinded without donors.view_identity), appointment,
 *           drive, source ('counter' | 'paper'), paper_sheet, bag, volume_ml,
 *           screening, collection, rejection_reason, can: { close } }
 *  GET   /donation-records/export?(same filters)            -> CSV
 *  PATCH /donations/{id}/status { status: 'rejected', rejection_reason }
 *        closes a visit left open (the counter's Cancel visit)
 * -------------------------------------------------------------------------
 */

const PER_PAGE = 25

const initialLoading = ref(true)
const loading = ref(false)
const loadError = ref('')
const notice = ref(null)
const updatedAt = ref(null)
const rows = ref([])
const pager = reactive({ page: 1, lastPage: 1, total: 0 })

const search = ref('')
const statusFilter = ref('')
const bloodTypeId = ref('')
const fromDate = ref('')
const toDate = ref('')
const bloodTypeOptions = ref([])

const hasFilters = computed(() => Boolean(search.value.trim() || statusFilter.value || bloodTypeId.value || fromDate.value || toDate.value))
const updatedAtLabel = computed(() => updatedAt.value?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) ?? '')
const listSummary = computed(() => (hasFilters.value
  ? `${pager.total} donation${pager.total === 1 ? '' : 's'} match the filters`
  : "Every visit at the Donation Counter or typed from a drive's paper records, newest first."))

function filterParams() {
  const params = {}
  if (search.value.trim()) params.search = search.value.trim()
  if (statusFilter.value) params.status = statusFilter.value
  if (bloodTypeId.value) params.blood_type_id = bloodTypeId.value
  if (fromDate.value) params.from = fromDate.value
  if (toDate.value) params.to = toDate.value
  return params
}

function errorMessage(err, fallback) {
  return Object.values(err?.errors ?? err?.data?.errors ?? {}).flat()[0] || err?.message || fallback
}

function formatDateTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${formatShortDate(iso)} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

async function load(page = 1) {
  loading.value = true
  loadError.value = ''
  try {
    const res = await bloodCenterService.donationRecords({ ...filterParams(), page, per_page: PER_PAGE })
    rows.value = res?.data ?? []
    Object.assign(pager, { page: res?.current_page ?? page, lastPage: Math.max(1, res?.last_page ?? 1), total: res?.total ?? rows.value.length })
    updatedAt.value = new Date()
  } catch (err) {
    loadError.value = errorMessage(err, 'Could not load donations.')
  } finally {
    loading.value = false
    initialLoading.value = false
  }
}

async function loadReference() {
  try {
    const data = await bloodCenterService.referenceData()
    bloodTypeOptions.value = orderBloodGroups((data?.blood_types ?? []).map((bt) => ({ id: bt.id, code: bt.code ?? bt.label })))
  } catch {
    bloodTypeOptions.value = []
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
  bloodTypeId.value = ''
  fromDate.value = ''
  toDate.value = ''
  load()
}

/* ---------- export ---------- */

const exporting = ref(false)

async function exportList() {
  exporting.value = true
  try {
    const blob = await bloodCenterService.exportDonationRecords(filterParams())
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `donations-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    notice.value = { tone: 'error', text: 'Could not export the donations. Please try again.' }
  } finally {
    exporting.value = false
  }
}

/* ---------- detail and close ---------- */

const detail = ref(null)

function openDetail(row) {
  detail.value = row
}

const closing = reactive({ row: null, reason: '', busy: false, error: '' })

function askClose(row) {
  Object.assign(closing, { row, reason: '', busy: false, error: '' })
}

function cancelClose() {
  if (closing.busy) return
  closing.row = null
}

/** The counter's own Cancel visit: close it as rejected, with the reason given. */
async function confirmClose() {
  closing.busy = true
  closing.error = ''
  try {
    await bloodCenterService.updateDonationStatus(closing.row.id, {
      status: 'rejected',
      rejection_reason: closing.reason.trim() || null,
    })
    notice.value = { tone: 'success', text: `${closing.row.code} is closed.` }
    closing.busy = false
    closing.row = null
    await load(pager.page)
  } catch (err) {
    closing.error = errorMessage(err, 'Could not close this visit.')
    closing.busy = false
  }
}

/* ---------- keyboard and lifecycle ---------- */

function onKeydown(event) {
  if (event.key !== 'Escape') return
  if (closing.row) cancelClose()
  else if (detail.value) detail.value = null
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  load()
  loadReference()
})

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.donations-page {
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
}

.donations-inner { display: flex; flex-direction: column; gap: 16px; }

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
.skeleton--panel { height: 480px; }
.skeleton--line { height: 16px; width: 100%; border-radius: 6px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

/* ---------- Header and buttons ---------- */
.header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 3px 0 0; }

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
.btn-primary--danger { background: var(--rb-accent); border-color: var(--rb-accent); }
.btn-primary--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-accent) 88%, #000); }

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
.icon-btn:focus-visible,
.modal-card__close:focus-visible {
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

/* A small basis, so the filters and buttons share one line until the list
   is narrow; the search is what gives way. */
.search { position: relative; flex: 1 1 180px; min-width: 140px; max-width: 280px; }

/* One row: filters on the left, actions on the right (project owner,
   2026-10-24). As the panel narrows, the search gives way first, then the
   "Updated" time (still on Refresh's tooltip), then Export's and Refresh's
   words (still read out). Only a phone's width wraps (see Narrow screens). */
.toolbar { flex-wrap: nowrap; }
.toolbar__filters { flex-wrap: nowrap; }
.toolbar__actions { flex: none; flex-wrap: nowrap; }

@container (max-width: 1240px) {
  .updated { display: none; }
}

@container (max-width: 1100px) {
  .btn-text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .btn-outline--squeeze { width: 36px; padding: 0; }
}

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

.don-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 13px; }

.don-table thead th {
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

.don-table tbody td {
  padding: 11px 10px;
  border-bottom: 1px solid var(--rb-border);
  vertical-align: middle;
  overflow: hidden;
}

.don-table th:first-child,
.don-table td:first-child { padding-left: 16px; }

.don-table th:last-child,
.don-table td:last-child { padding-right: 16px; }

.don-table tbody tr:last-child td { border-bottom: 0; }
.don-row { transition: background 0.12s ease; }
.don-row:hover { background: var(--rb-surface-hover); }

/* An open visit carries a marker on its edge, never a filled row. */
.don-row--open td:first-child { box-shadow: inset 3px 0 0 var(--rb-primary); }

.c-id { width: 124px; }
.c-group { width: 66px; }
.c-date { width: 118px; }
.c-bag { width: 128px; }
.c-appt { width: 150px; }
.c-status { width: 150px; }
.c-actions { width: 138px; }

/* Narrow panels keep who, when and where it stands. */
@container (max-width: 980px) {
  .c-appt { display: none; }
}

@container (max-width: 860px) {
  .c-bag { display: none; }
}

.code { font-family: var(--rb-font-mono); font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); white-space: nowrap; }
.code--bag { color: var(--rb-text-primary); }

/* A donation typed from a drive's paper sheet. */
.chip {
  display: inline-block;
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1.6;
  color: var(--rb-text-secondary);
  vertical-align: 1px;
}
.donor__name { display: block; font-weight: 700; text-transform: capitalize; overflow-wrap: anywhere; }
.sub { display: block; margin-top: 2px; font-size: 11.5px; color: var(--rb-text-secondary); }
.muted { color: var(--rb-text-secondary); }
.nowrap { white-space: nowrap; }

.blood {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface-alt);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

/* Status: the colour lives on the dot, never on the badge's fill. */
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

.row-actions { display: flex; gap: 6px; }

.icon-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
  text-decoration: none;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.icon-btn:hover:not(:disabled) { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.45); background: var(--rb-surface-hover); }
.icon-btn--danger:hover:not(:disabled) { color: var(--rb-accent-text); border-color: rgba(var(--rb-accent-rgb), 0.45); }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

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
.empty-state__text { margin: 0 0 8px; max-width: 46ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

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

/* ---------- Modals ---------- */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--rb-overlay);
}

.modal-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 600px;
  max-height: calc(100vh - 40px);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(var(--rb-shadow-rgb), 0.28);
}

.modal-card--sm { max-width: 440px; }

.modal-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--rb-border);
  flex-shrink: 0;
}

.modal-card__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15.5px; font-weight: 700; }
.modal-card__title :deep(.asset-icon) { color: var(--rb-text-secondary); }

.modal-card__close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: none;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.modal-card__close:hover { color: var(--rb-text-primary); background: var(--rb-surface-hover); }
.modal-card__body { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; overflow-y: auto; min-height: 0; }

.modal-card__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--rb-border);
  flex-shrink: 0;
}

.modal-text { margin: 0; font-size: 13.5px; line-height: 1.55; }

.detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid var(--rb-border); }
.detail-name { margin: 0; font-size: 16px; font-weight: 700; text-transform: capitalize; }

.facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 18px; margin: 0; }
.fact { min-width: 0; }
.fact--full { grid-column: 1 / -1; }

.fact dt {
  margin: 0 0 3px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rb-text-secondary);
}

.fact dd { margin: 0; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
.fact__sub { display: block; font-size: 11.5px; font-weight: 500; color: var(--rb-text-secondary); }

.form-label { font-size: 12.5px; font-weight: 600; }
.form-optional { margin-left: 4px; font-weight: 500; color: var(--rb-text-secondary); }

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

/* Anchored on the page root: other portals ship unscoped dark .form-input rules. */
.donations-page .form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.donations-page .form-textarea { min-height: 64px; line-height: 1.5; resize: vertical; }
.donations-page .form-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.modal-enter-active,
.modal-leave-active { transition: opacity 0.18s ease; }

.modal-enter-from,
.modal-leave-to { opacity: 0; }

@media (max-width: 760px) {
  .toolbar,
  .toolbar__filters,
  .toolbar__actions { flex-wrap: wrap; }
  .toolbar__filters { flex-basis: 100%; }
  .search { max-width: none; flex: 1 1 100%; }
  .toolbar__actions { width: 100%; }
  .facts { grid-template-columns: minmax(0, 1fr); }
  .modal-overlay { padding: 10px; align-items: flex-end; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .spin { animation: none !important; }
}
</style>

<style scoped>
/* The system dropdown in a toolbar: narrow enough for one row, and it may
   give a little more before the row runs out. */
.sel-filter { width: 140px; flex: 0 1 140px; min-width: 118px; }
</style>
