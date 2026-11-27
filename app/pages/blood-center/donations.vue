<template>
  <div class="donations-page">
    <div class="donations-inner">
      <header class="header-row">
        <div>
          <h1 class="page-title">Donations</h1>
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
                <th scope="col" class="c-actions" :style="{ width: `${actionsWidth}px` }">Actions</th>
              </tr>
            </thead>

            <tbody v-if="loading && !rows.length">
              <SkeletonRows :columns="8" :rows="6" :cell-classes="COLUMN_CLASSES" />
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
              <tr
                v-for="row in rows"
                :key="row.id"
                class="don-row"
                tabindex="0"
                :aria-label="`Open donation ${row.code}`"
                @click="openDetail(row)"
                @keydown.enter.self="openDetail(row)"
              >
                <!-- One plain value per column, as on Donor Management (project
                     owner, 2026-11-26): no avatar, donor ID, chips, pills or
                     dots. Volume, drive and paper sheet are in the record. -->
                <td class="c-id" :title="row.source === 'paper' ? `Typed from paper sheet ${row.paper_sheet?.code}` : undefined">{{ row.code }}</td>
                <td class="c-donor">
                  <span v-if="row.donor && !row.donor.blinded" class="donor-name">{{ row.donor.full_name }}</span>
                  <span v-else class="muted">Identity hidden</span>
                </td>
                <td class="c-group" :title="row.donor?.blood_type ? undefined : 'Not typed yet'">{{ row.donor?.blood_type || '—' }}</td>
                <td class="c-date">{{ formatShortDate(row.date) }} {{ row.time }}</td>
                <td class="c-bag">{{ row.bag?.barcode || (row.open ? 'Not drawn' : '—') }}</td>
                <td class="c-appt" :title="row.drive || undefined">{{ row.appointment?.code ?? 'Walk-in' }}</td>
                <td class="c-status">{{ row.status_label }}</td>
                <td class="c-actions" @click.stop>
                  <div class="row-actions">
                    <NuxtLink
                      v-if="row.open && canStartVisit && row.donor?.uuid"
                      :to="continueLink(row.donor.uuid)"
                      class="act-btn"
                      :aria-label="`Continue ${row.code} at the Donation Counter`"
                      title="Continue at the Donation Counter"
                    >
                      Continue
                      <AssetIcon name="arrow-right" :size="14" />
                    </NuxtLink>
                    <button type="button" class="icon-btn" :aria-label="`View ${row.code}`" title="View" @click="openDetail(row)">
                      <AssetIcon name="eye" :size="15" />
                    </button>
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

    <!-- ============ DETAIL ============ -->
    <CenterModal v-if="detail" :title="`Donation ${detail.code}`" eyebrow="Donation record" size="md" @close="detail = null">
      <template #meta>
        <span class="badge" :class="`badge--${donationTone(detail.status, detail.status_label)}`">
          <span class="badge__dot" aria-hidden="true" />
          {{ detail.status_label }}
        </span>
        <span v-if="detail.source === 'paper'" class="chip chip--flat">Typed from paper</span>
      </template>

      <div class="dd">
        <div class="dd-donor">
          <PersonAvatar size="lg" :name="detail.donor?.full_name" :hidden="!(detail.donor && !detail.donor.blinded)" />
          <div class="dd-donor__text">
            <p class="detail-name">{{ detail.donor && !detail.donor.blinded ? detail.donor.full_name : 'Identity hidden' }}</p>
            <p class="sub">
              <template v-if="detail.donor && !detail.donor.blinded">{{ detail.donor.donor_code }}</template>
              <template v-if="!detail.donor?.blood_type">{{ detail.donor && !detail.donor.blinded ? ' · ' : '' }}Blood group not typed</template>
            </p>
          </div>
          <span v-if="detail.donor?.blood_type" class="blood blood--lg" title="Blood group">{{ detail.donor.blood_type }}</span>
        </div>

        <section class="dd-section" aria-labelledby="dd-visit">
          <h3 id="dd-visit" class="dd-section__title">The visit</h3>
          <ol class="timeline">
            <li v-for="step in visitSteps(detail)" :key="step.key" class="tl" :class="`tl--${step.state}`">
              <span class="tl__dot" aria-hidden="true">
                <AssetIcon v-if="step.state === 'done'" name="check" :size="11" />
                <AssetIcon v-else-if="step.state === 'warn'" name="user-x" :size="11" />
                <AssetIcon v-else-if="step.state === 'stop'" name="x" :size="11" />
              </span>
              <div class="tl__body">
                <p class="tl__label">{{ step.label }}</p>
                <p v-if="step.detail" class="tl__detail">{{ step.detail }}</p>
                <p v-if="step.by" class="tl__by">by {{ step.by }}</p>
                <!-- The code for everyone here; the reason, folded, only for the clinical record's holder. -->
                <span v-if="step.key === 'screening' && (detail.screening?.deferral_code || detail.screening?.deferral_reason)" class="tl__tag">
                  <DeferralCodeTag :code="detail.screening.deferral_code" :reason="detail.screening.deferral_reason" />
                </span>
              </div>
            </li>
          </ol>
        </section>

        <dl class="facts">
          <div class="fact">
            <dt>Appointment</dt>
            <dd>{{ detail.appointment?.code ?? 'Walk-in' }}<span v-if="detail.drive" class="fact__sub">{{ detail.drive }}</span></dd>
          </div>
          <div class="fact">
            <dt>Bag</dt>
            <dd>
              <span :class="{ code: detail.bag?.barcode, 'code--bag': detail.bag?.barcode }">{{ detail.bag?.barcode ?? 'Not drawn' }}</span>
              <span v-if="detail.bag?.type" class="fact__sub">{{ detail.bag.type }}<template v-if="detail.volume_ml"> · {{ detail.volume_ml }} mL</template></span>
            </dd>
          </div>
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

      <template #actions>
        <NuxtLink
          v-if="detail.source === 'paper' && detail.paper_sheet && canRecordPaper"
          :to="`/blood-center/paper-records/${detail.paper_sheet.id}`"
          class="btn-outline"
        >
          Open the sheet
          <AssetIcon name="arrow-right" :size="14" />
        </NuxtLink>
        <button type="button" class="btn-outline" @click="detail = null">Close</button>
        <NuxtLink v-if="detail.open && canStartVisit && detail.donor?.uuid" :to="continueLink(detail.donor.uuid)" class="btn-primary">
          Continue at the counter
          <AssetIcon name="arrow-right" :size="14" />
        </NuxtLink>
      </template>
    </CenterModal>

    <!-- ============ CLOSE VISIT ============ -->
    <CenterModal v-if="closing.row" title="Close this visit?" size="sm" @close="cancelClose">
      <div class="close-form">
        <p class="modal-text">
          {{ closing.row.code }}<template v-if="closing.row.donor && !closing.row.donor.blinded"> for {{ closing.row.donor.full_name }}</template>
          was opened but no blood was drawn. Closing it frees the donor to start a new visit; nothing is collected.
        </p>
        <label class="form-label" for="close-reason">Reason <span class="form-optional">optional</span></label>
        <textarea id="close-reason" v-model="closing.reason" class="form-input form-textarea" rows="2" maxlength="255" placeholder="e.g. Left before screening" />
        <p v-if="closing.error" class="form-error" role="alert">{{ closing.error }}</p>
      </div>
      <template #actions>
        <button type="button" class="btn-outline" @click="cancelClose">Back</button>
        <button type="button" class="btn-primary btn-primary--danger" :disabled="closing.busy" @click="confirmClose">
          {{ closing.busy ? 'Closing…' : 'Close visit' }}
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
import DonorQrScanDialog from '~/components/BloodCenter/DonorQrScanDialog.vue'
import CenterModal from '~/components/ui/CenterModal.vue'
import PersonAvatar from '~/components/ui/PersonAvatar.vue'
import DateRangeFilter from '~/components/common/DateRangeFilter.vue'
import { COLLECTION_ABILITIES } from '~/composables/useBloodCenterNav'
import { DONATION_STATUS_FILTERS, donationTone } from '~/utils/donationRecords'
import { formatShortDate, orderBloodGroups } from '~/utils/donorRecords'
import { ref, reactive, computed, onMounted, onBeforeUnmount, onActivated, onDeactivated } from 'vue'
import { onPageReturn } from '~/composables/useKeptAlive'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  // Every role at the counter holds it, and no one outside the department.
  requires: 'donations.view',
  keepalive: true,
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

// The headings' classes, so the loading rows hide the same columns.
const COLUMN_CLASSES = ['c-id', 'c-donor', 'c-group', 'c-date', 'c-bag', 'c-appt', 'c-status', 'c-actions']

// Sized, as on Donor Management, for the buttons this role can see: Continue
// is worded (about 94px), View and Close are 30px icons, 6px apart, plus the
// cell's padding. Never narrower than its "Actions" heading.
// Continue and Close only show on an open visit, so their room is kept only
// when this page lists one; a page of finished donations has just the eye.
const actionsWidth = computed(() => {
  const anyOpen = rows.value.some((row) => row.open)
  const close = anyOpen && canClose.value
  const cont = anyOpen && canStartVisit.value
  const icons = 1 + (close ? 1 : 0)
  const buttons = icons + (cont ? 1 : 0)
  return Math.max(72, 34 + icons * 30 + (cont ? 94 : 0) + Math.max(0, buttons - 1) * 6)
})

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

const loading = ref(true)
const loadError = ref('')
const notice = ref(null)
useNoticeToast(notice)
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

const pageFrom = computed(() => (pager.total ? (pager.page - 1) * PER_PAGE + 1 : 0))
const pageTo = computed(() => Math.min(pager.page * PER_PAGE, pager.total))

/**
 * The visit, step by step, from what the record already holds: when it was
 * opened, how the screening went, and whether blood was drawn.
 */
function visitSteps(d) {
  const outcome = d.screening?.outcome_label ?? ''
  const deferred = /defer/i.test(outcome)
  const collected = Boolean(d.collection?.collected_at)

  return [
    { key: 'opened', label: 'Visit opened', detail: `${formatShortDate(d.date)} · ${d.time}`, state: 'done' },
    d.screening
      ? {
          key: 'screening',
          label: `Screening: ${outcome || 'recorded'}`,
          // Sent only to the clinical record's holder.
          detail: d.screening.out_of_range_reason ? `Accepted out of range: ${d.screening.out_of_range_reason}` : '',
          by: d.screening.recorded_by,
          state: deferred ? 'warn' : 'done',
        }
      : { key: 'screening', label: 'Screening', detail: 'Not screened yet', state: d.open ? 'pending' : 'skipped' },
    collected
      ? { key: 'collection', label: 'Blood collected', detail: formatDateTime(d.collection.collected_at), by: d.collection.collected_by, state: 'done' }
      : d.open
        ? { key: 'collection', label: 'Collection', detail: 'Not drawn yet', state: 'pending' }
        : { key: 'collection', label: 'No blood collected', detail: d.rejection_reason || 'The visit ended without a collection.', state: 'stop' },
  ]
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

/*
 * Kept alive. Away, Escape belongs to the page on screen, and the Scan QR
 * popup closes, which turns the camera off: left open, it would keep filming
 * behind the next page. Back, the list reloads in place.
 */
onDeactivated(() => {
  window.removeEventListener('keydown', onKeydown)
  scanning.value = false
})
onActivated(() => window.addEventListener('keydown', onKeydown))
onPageReturn(() => load(pager.page))
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
  color: var(--rb-text-primary);
  overflow: hidden;
}

.don-table th:first-child,
.don-table td:first-child { padding-left: 16px; }

.don-table th:last-child,
.don-table td:last-child { padding-right: 16px; }

.don-table tbody tr:last-child td { border-bottom: 0; }
.don-row { transition: background 0.12s ease; }
.don-row:hover { background: rgba(var(--rb-primary-rgb), 0.06); }

/* The whole row opens the record; the status says when a visit is still open. */
.don-row { cursor: pointer; }
.don-row:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }

/* Loading rows as tall as the real ones (the row's 30px buttons), so nothing jumps. */
.don-table tbody :deep(tr[aria-hidden="true"] td) { height: 53px; padding: 0 10px; border-bottom: 1px solid var(--rb-border); }
.don-table tbody :deep(tr[aria-hidden="true"] td:first-child) { padding-left: 16px; }

/* Widths include the cell's padding. Each column grows with the table, with a
   floor its longest value fits in, so the spare room spreads across all of
   them instead of pooling after the donor's name (2026-11-26). The donor
   takes what is left; the actions column is sized in the template. */
.c-id { width: max(132px, 11%); }
.c-group { width: max(76px, 8%); }
.c-date { width: max(160px, 14%); }
.c-bag { width: max(120px, 12%); }
.c-appt { width: max(110px, 11%); }
.c-status { width: max(120px, 12%); }
.don-table thead th.c-actions { text-align: right; }

/* Plain text, one line each, as on Donor Management; the donor's name may wrap. */
.don-table tbody td.c-id,
.don-table tbody td.c-group,
.don-table tbody td.c-date,
.don-table tbody td.c-bag,
.don-table tbody td.c-appt,
.don-table tbody td.c-status {
  white-space: nowrap;
  text-overflow: ellipsis;
}

.donor-name { text-transform: capitalize; overflow-wrap: anywhere; }

/* Narrow panels keep who, when and where it stands. */
@container (max-width: 980px) {
  .c-appt, .don-table tbody :deep(td.c-appt) { display: none; }
}

@container (max-width: 860px) {
  .c-bag, .don-table tbody :deep(td.c-bag) { display: none; }
}

.code { font-family: var(--rb-font-mono); font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); white-space: nowrap; }
.code--bag { color: var(--rb-text-primary); }

/* "Typed from paper" in the record dialog. */
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
.sub { display: block; margin-top: 2px; font-size: 11.5px; color: var(--rb-text-secondary); }
.muted { color: var(--rb-text-secondary); }

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

/* The record dialog's status: the colour lives on the dot, never on the badge's fill. */
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

/* Buttons start under the "Actions" heading, like every other column's value. */
.row-actions { display: flex; align-items: center; justify-content: flex-start; gap: 6px; }

/* The visit's next step, said in words: it is the row's main action. */
.act-btn {
  display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 10px; border-radius: 8px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.45); background: rgba(var(--rb-primary-rgb), 0.06);
  color: var(--rb-primary-text); font-size: 12px; font-weight: 700; text-decoration: none; white-space: nowrap;
  transition: background 0.12s ease;
}
.act-btn:hover { background: rgba(var(--rb-primary-rgb), 0.12); }
.act-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.icon-btn {
  flex-shrink: 0;
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

/* ---------- Detail ---------- */
.dd { display: flex; flex-direction: column; gap: 18px; }
.dd-donor { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--rb-border); border-radius: 12px; background: var(--rb-surface-alt); }
.dd-donor__text { flex: 1; min-width: 0; }
.dd-donor__text .sub { margin-top: 2px; }
.blood--lg { min-width: 44px; padding: 4px 10px; font-size: 13px; }
.chip--flat { margin-left: 0; }

.dd-section__title { margin: 0 0 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--rb-text-secondary); }

/* The visit as a short line of steps. */
.timeline { margin: 0; padding: 0; list-style: none; }
.tl { position: relative; display: flex; gap: 12px; padding-bottom: 14px; }
.tl:last-child { padding-bottom: 0; }
.tl:not(:last-child)::before { content: ''; position: absolute; left: 10px; top: 24px; bottom: 2px; width: 2px; border-radius: 2px; background: var(--rb-border); }
.tl__dot {
  position: relative; display: grid; flex-shrink: 0; place-items: center; width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--rb-border-strong); background: var(--rb-surface); color: #fff;
}
.tl--done .tl__dot { border-color: var(--rb-success); background: var(--rb-success); }
.tl--warn .tl__dot { border-color: var(--rb-warning); background: var(--rb-warning); }
.tl--stop .tl__dot { border-color: var(--rb-accent); background: var(--rb-accent); }
.tl--pending .tl__dot { border-style: dashed; }
.tl--skipped { opacity: 0.6; }
.tl__body { min-width: 0; padding-top: 1px; }
.tl__label { margin: 0; font-size: 13.5px; font-weight: 700; }
.tl--pending .tl__label, .tl--skipped .tl__label { color: var(--rb-text-secondary); }
.tl__detail { margin: 2px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); overflow-wrap: anywhere; }
.tl__by { margin: 1px 0 0; font-size: 12px; color: var(--rb-text-muted); }
.tl__tag { display: block; margin-top: 6px; }

.close-form { display: flex; flex-direction: column; gap: 10px; }
.modal-text { margin: 0; font-size: 13.5px; line-height: 1.55; }

.detail-name { margin: 0; font-size: 16px; font-weight: 700; text-transform: capitalize; }

.facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 18px; margin: 0; padding-top: 16px; border-top: 1px solid var(--rb-border); }
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

/* Anchored on the form: other portals ship unscoped dark .form-input rules, and the dialog is on the body. */
.close-form .form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.close-form .form-textarea { min-height: 64px; line-height: 1.5; resize: vertical; }
.close-form .form-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

@media (max-width: 760px) {
  .toolbar,
  .toolbar__filters,
  .toolbar__actions { flex-wrap: wrap; }
  .toolbar__filters { flex-basis: 100%; }
  .search { max-width: none; flex: 1 1 100%; }
  .toolbar__actions { width: 100%; }
  .facts { grid-template-columns: minmax(0, 1fr); }
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
