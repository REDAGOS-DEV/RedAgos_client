<template>
  <div class="tti-results">
    <div class="note" role="note">
      <AssetIcon name="flask-conical" :size="15" />
      <p>
        Every drawn unit gets the five-marker panel: {{ markerList }}. A unit leaves quarantine only when all five are
        non-reactive and its typing is cleared. A reactive marker rejects the donation, so it can never be issued.
      </p>
    </div>

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
              :placeholder="canViewIdentity ? 'Search bag / donor…' : 'Search bag / donation ID…'"
              :aria-label="canViewIdentity ? 'Search by bag barcode, donation ID or donor' : 'Search by bag barcode or donation ID'"
              @input="onSearchInput"
            >
          </label>
          <SelectField v-model="outcome" class="sel-filter" size="sm" aria-label="Filter by result" :options="OUTCOME_FILTERS" @change="load()" />
        </div>

        <div class="toolbar__actions">
          <span v-if="updatedAt" class="updated">
            <AssetIcon name="clock" :size="13" />
            Updated {{ updatedAtLabel }}
          </span>
          <button type="button" class="btn-outline" :disabled="exporting || !pager.total" @click="exportList">
            <AssetIcon name="download" :size="14" />
            {{ exporting ? 'Exporting…' : 'Export' }}
          </button>
          <button type="button" class="btn-outline btn-outline--accent" :disabled="loading" @click="load(pager.page)">
            <AssetIcon name="refresh-cw" :size="14" :class="{ spin: loading }" />
            Refresh
          </button>
        </div>
      </div>

      <div class="table-wrap" :class="{ 'table-wrap--busy': loading && rows.length }">
        <table class="tti-table">
          <caption class="sr-only">Serology results recorded at this centre</caption>
          <thead>
            <tr>
              <th scope="col" class="c-id">ID</th>
              <th scope="col" class="c-bag">Bag</th>
              <!-- Blind roles are told the blood type on the bag, never the person. -->
              <th scope="col" class="c-donor">{{ canViewIdentity ? 'Donor' : 'Group' }}</th>
              <th v-for="marker in markers" :key="marker.value" scope="col" class="c-marker">{{ markerHeading(marker.label) }}</th>
              <th scope="col" class="c-overall" :aria-sort="sort === 'reactive_first' ? 'ascending' : 'none'">
                <button type="button" class="th-sort" title="Reactive first" @click="toggleOverallSort">
                  Overall
                  <AssetIcon name="chevron-up" :size="12" :class="{ 'th-sort__off': sort !== 'reactive_first' }" />
                </button>
              </th>
              <th scope="col" class="c-tested" :aria-sort="sort === 'reactive_first' ? 'none' : (sort === 'oldest' ? 'ascending' : 'descending')">
                <button type="button" class="th-sort" @click="toggleTestedSort">
                  Tested
                  <AssetIcon :name="sort === 'oldest' ? 'chevron-up' : 'chevron-down'" :size="12" :class="{ 'th-sort__off': sort === 'reactive_first' }" />
                </button>
              </th>
              <th scope="col" class="c-actions">Actions</th>
            </tr>
          </thead>

          <tbody v-if="loading && !rows.length">
            <tr v-for="n in 6" :key="'sk-' + n">
              <td :colspan="columnCount"><span class="skeleton skeleton--line" /></td>
            </tr>
          </tbody>

          <tbody v-else-if="!rows.length">
            <tr>
              <td :colspan="columnCount" class="empty-cell">
                <div class="empty-state">
                  <span class="empty-state__icon"><AssetIcon :name="hasFilters ? 'search-x' : 'flask-conical'" :size="20" /></span>
                  <p class="empty-state__title">{{ hasFilters ? 'No results match' : 'No serology recorded yet' }}</p>
                  <p class="empty-state__text">
                    {{ hasFilters
                      ? 'Try another bag or donation ID, or show all results.'
                      : 'Each panel recorded from the testing queue appears here.' }}
                  </p>
                  <button v-if="hasFilters" type="button" class="btn-outline" @click="clearFilters">Clear filters</button>
                </div>
              </td>
            </tr>
          </tbody>

          <tbody v-else>
            <tr v-for="row in rows" :key="row.id" class="tti-row">
              <td class="c-id"><span class="code">{{ row.code }}</span></td>
              <td class="c-bag">
                <span v-if="row.bag?.barcode" class="bag">{{ row.bag.barcode }}</span>
                <span v-else class="muted">—</span>
                <span v-if="row.bag?.type" class="sub">{{ row.bag.type }}</span>
              </td>
              <td class="c-donor">
                <template v-if="row.donor && !row.donor.blinded">
                  <span class="donor__name">{{ row.donor.full_name }}</span>
                  <span class="sub">{{ row.donor.donor_code }}</span>
                </template>
                <span v-else-if="row.donor?.blood_type" class="blood">{{ row.donor.blood_type }}</span>
                <span v-else class="muted" title="Not typed yet">—</span>
              </td>
              <td v-for="marker in markers" :key="marker.value" class="c-marker">
                <span
                  v-if="readingFor(row, marker.value)"
                  class="res"
                  :class="readingFor(row, marker.value) === 'reactive' ? 'res--reactive' : 'res--clear'"
                >
                  <span class="res__long">{{ readingFor(row, marker.value) === 'reactive' ? 'Reactive' : 'Non-reactive' }}</span>
                  <span class="res__short" aria-hidden="true">{{ readingFor(row, marker.value) === 'reactive' ? 'R' : 'NR' }}</span>
                </span>
                <span v-else class="muted">—</span>
              </td>
              <td class="c-overall">
                <!-- Saved as reactive, not yet verified: it has set nothing off. -->
                <template v-if="row.awaiting_verification">
                  <span class="overall overall--waiting" title="Reactive, waiting for the Laboratory Supervisor to verify it">
                    <AssetIcon name="clock" :size="12" />
                    Reactive
                  </span>
                  <span class="sub sub--pending">Awaiting verification</span>
                </template>
                <span v-else class="overall" :class="row.outcome === 'reactive' ? 'overall--reactive' : 'overall--clear'">
                  <AssetIcon :name="row.outcome === 'reactive' ? 'octagon-alert' : 'check'" :size="12" />
                  {{ row.outcome_label }}
                </span>
                <span v-if="row.correction_pending" class="sub sub--pending">Correction pending</span>
              </td>
              <td class="c-tested">
                {{ formatShortDate(row.recorded_at) }}
                <span v-if="row.recorded_by" class="sub">{{ row.recorded_by }}</span>
              </td>
              <td class="c-actions">
                <div class="row-actions">
                  <button
                    type="button"
                    class="icon-btn"
                    :aria-label="`View serology for ${row.code}`"
                    title="View"
                    @click="openEdit(row, 'view')"
                  >
                    <AssetIcon name="eye" :size="15" />
                  </button>
                  <!-- Edited here directly; nothing is saved until the Laboratory Supervisor approves. -->
                  <button
                    type="button"
                    class="icon-btn"
                    :disabled="!row.can?.correct"
                    :aria-label="`Edit serology for ${row.code}`"
                    :title="editTitle(row)"
                    @click="openEdit(row, 'edit')"
                  >
                    <AssetIcon name="pencil" :size="15" />
                  </button>
                  <button
                    v-if="row.can?.verify || row.correction?.can_decide"
                    type="button"
                    class="icon-btn icon-btn--review"
                    :aria-label="`Review serology for ${row.code}`"
                    :title="row.can?.verify ? 'Verify or return this reactive result' : 'Approve or reject the correction'"
                    @click="openEdit(row, 'review')"
                  >
                    <AssetIcon name="shield-check" :size="15" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="pager">
        <span class="pager__info">{{ pager.total }} result(s)</span>
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

    <!-- ============ EDIT / REVIEW / VIEW ============ -->
    <!-- One dialog for all of it: a correction is filed and decided here, with no second popup. -->
    <Transition name="modal">
      <div v-if="editing" class="modal-overlay" @click.self="closeEdit">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="tti-edit-title">
          <div class="modal-card__header">
            <h2 id="tti-edit-title" class="modal-card__title">
              <AssetIcon :name="dialogTitle.icon" :size="17" />
              {{ dialogTitle.text }} · {{ editing.row.code }}
            </h2>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeEdit">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <div class="modal-card__body">
            <div class="subject">
              <AssetIcon :name="editing.row.donor && !editing.row.donor.blinded ? 'user' : 'droplets'" :size="14" />
              <p>
                <strong>{{ editing.row.donor && !editing.row.donor.blinded ? editing.row.donor.full_name : 'Identity hidden' }}</strong>
                · Donation {{ editing.row.code }}
                <template v-if="editing.row.bag?.barcode"> · Bag <span class="mono">{{ editing.row.bag.barcode }}</span></template>
              </p>
            </div>

            <p v-if="lockReason && !verifying && !deciding" class="lock" role="note">
              <AssetIcon name="lock" :size="14" />
              {{ lockReason }}
            </p>

            <!-- A correction waiting for the Laboratory Supervisor: who asked, why, and what it changes. -->
            <div v-if="editing.row.correction" class="proposal" :class="{ 'proposal--decide': deciding }">
              <p class="proposal__title">
                <AssetIcon name="pencil" :size="14" />
                Correction requested<template v-if="editing.row.correction.requested_by"> by {{ editing.row.correction.requested_by }}</template>
                <span class="proposal__when">{{ formatDateTime(editing.row.correction.requested_at) }}</span>
              </p>
              <ul class="proposal__diff">
                <li v-for="change in proposedDiff" :key="change.marker">
                  <span class="proposal__marker">{{ change.label }}</span>
                  <span class="res" :class="change.from === 'reactive' ? 'res--reactive' : 'res--clear'">{{ readingLabel(change.from) }}</span>
                  <AssetIcon name="arrow-right" :size="12" />
                  <span class="res" :class="change.to === 'reactive' ? 'res--reactive' : 'res--clear'">{{ readingLabel(change.to) }}</span>
                </li>
                <li v-if="!proposedDiff.length" class="muted">No reading differs from what is saved.</li>
              </ul>
              <p v-if="editing.row.correction.reason" class="proposal__reason">“{{ editing.row.correction.reason }}”</p>
              <p v-if="!editing.row.correction.can_decide" class="proposal__wait">Waiting for the Laboratory Supervisor's decision. Nothing changes until then.</p>
            </div>

            <div class="form-grid">
              <label v-for="marker in markers" :key="marker.value" class="form-field">
                <span class="form-label">{{ markerHeading(marker.label) }} <span v-if="editable" class="form-required" aria-hidden="true">*</span></span>
                <SelectField
                  v-model="editing.form[marker.value]"
                  :aria-label="marker.label"
                  :invalid="editing.form[marker.value] === 'reactive'"
                  :disabled="!editable"
                  :options="[{ value: 'non_reactive', label: 'Non-reactive' }, { value: 'reactive', label: 'Reactive' }]"
                />
              </label>

              <!-- What the panel reads as the form stands: any reactive marker makes it reactive. -->
              <div class="form-field">
                <span class="form-label">Overall</span>
                <p class="form-static">
                  <span class="overall" :class="pendingReactive.length ? 'overall--reactive' : 'overall--clear'">
                    <AssetIcon :name="pendingReactive.length ? 'octagon-alert' : 'check'" :size="12" />
                    {{ pendingReactive.length ? 'Reactive' : 'Non-reactive' }}
                  </span>
                </p>
              </div>

              <div class="form-field">
                <span class="form-label">Test date</span>
                <p class="form-static">{{ formatDateTime(editing.row.recorded_at) }}</p>
              </div>

              <div class="form-field">
                <span class="form-label">Tested by</span>
                <p class="form-static">
                  {{ editing.row.recorded_by || '—' }}
                  <template v-if="editing.row.verified_by && editing.row.verified_by !== editing.row.recorded_by">
                    · verified by {{ editing.row.verified_by }}
                  </template>
                </p>
              </div>
            </div>

            <label v-if="editable" class="form-field">
              <span class="form-label">What was entered wrongly, and why <span class="form-required" aria-hidden="true">*</span></span>
              <textarea
                v-model="editing.reason"
                class="form-input form-textarea"
                rows="2"
                maxlength="1000"
                placeholder="e.g. Malaria was read from the wrong strip"
              />
            </label>

            <!-- Changing a marker to reactive has every consequence recording one has, once approved. -->
            <div v-if="editable && pendingReactive.length" class="warn" role="alert">
              <p class="warn__title">
                <AssetIcon name="octagon-alert" :size="15" />
                Reactive for {{ pendingReactive.join(', ') }}
              </p>
              <p>
                Once this correction {{ isHead ? 'is applied' : 'is approved' }}, the donation is rejected and can never
                become stock, and the donor is permanently deferred at every blood centre and added to Counselling
                referrals. {{ isHead ? 'Yours applies as you send it.' : 'The approval counts as the verification.' }}
                None of it can be undone here.
              </p>
              <label class="warn__confirm">
                <input v-model="editing.confirmed" type="checkbox">
                I have checked these readings against the bench record.
              </label>
            </div>

            <!-- The second person on a reactive result: check it against the bench record. -->
            <div v-if="verifying" class="verify" role="note">
              <p class="verify__title">
                <AssetIcon name="shield-check" :size="15" />
                Check these readings against the bench record
              </p>
              <p>
                Saved as reactive for <strong>{{ savedReactive.join(', ') }}</strong>
                <template v-if="editing.row.recorded_by"> by {{ editing.row.recorded_by }}</template>.
                Nothing has happened yet.
              </p>
              <ul>
                <li>
                  <strong>Verify</strong> if the bench record agrees. The donation is rejected and can never become
                  stock, and the donor is permanently deferred at every blood centre and added to Counselling
                  referrals, where you refer them to a doctor.
                </li>
                <li>
                  <strong>Return for re-entry</strong> if it does not. The panel is cleared and the unit goes back to
                  the testing queue.
                </li>
              </ul>
              <label class="warn__confirm">
                <input v-model="editing.confirmed" type="checkbox">
                I have checked these readings against the bench record.
              </label>
            </div>

            <template v-if="deciding">
              <div v-if="proposedReactive.length" class="warn" role="alert">
                <p class="warn__title">
                  <AssetIcon name="octagon-alert" :size="15" />
                  Approving makes it reactive for {{ proposedReactive.join(', ') }}
                </p>
                <p>
                  Your approval is the verification. The donation is rejected and can never become stock, and the donor
                  is permanently deferred at every blood centre and added to Counselling referrals. None of it can be
                  undone here.
                </p>
                <label class="warn__confirm">
                  <input v-model="editing.confirmed" type="checkbox">
                  I have checked these readings against the bench record.
                </label>
              </div>

              <label v-if="editing.rejecting" class="form-field">
                <span class="form-label">Why it is rejected <span class="form-required" aria-hidden="true">*</span></span>
                <textarea v-model="editing.note" class="form-input form-textarea" rows="2" maxlength="1000" />
              </label>
            </template>

            <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>

            <p v-if="editable" class="hint">
              A saved panel is never saved over.
              <template v-if="isHead">As the Laboratory Supervisor, your correction applies as soon as you send it.</template>
              <template v-else>Your correction goes to the Laboratory Supervisor, who approves it here. Nothing changes until they do.</template>
            </p>
          </div>

          <div class="modal-card__footer">
            <button type="button" class="btn-outline" @click="closeEdit">{{ editable || verifying || deciding ? 'Cancel' : 'Close' }}</button>
            <template v-if="editing.mode === 'view'">
              <button
                v-if="editing.row.can?.verify || editing.row.correction?.can_decide"
                type="button"
                class="btn-primary"
                @click="editing.mode = 'review'"
              >
                <AssetIcon name="shield-check" :size="14" />
                Review
              </button>
              <button v-else-if="editing.row.can?.correct" type="button" class="btn-primary" @click="editing.mode = 'edit'">
                <AssetIcon name="pencil" :size="14" />
                Edit
              </button>
            </template>
            <template v-if="deciding">
              <button
                v-if="!editing.rejecting"
                type="button"
                class="btn-outline"
                :disabled="Boolean(acting)"
                @click="editing.rejecting = true"
              >
                <AssetIcon name="x" :size="14" />
                Reject…
              </button>
              <button
                v-else
                type="button"
                class="btn-outline btn-outline--danger"
                :disabled="Boolean(acting) || !editing.note.trim()"
                @click="rejectCorrection"
              >
                <AssetIcon name="x" :size="14" />
                {{ acting === 'reject' ? 'Rejecting…' : 'Reject correction' }}
              </button>
              <button
                v-if="!editing.rejecting"
                type="button"
                class="btn-primary"
                :class="{ 'btn-primary--danger': proposedReactive.length }"
                :disabled="Boolean(acting) || (proposedReactive.length > 0 && !editing.confirmed)"
                @click="approveCorrection"
              >
                <AssetIcon name="check" :size="14" />
                {{ acting === 'approve' ? 'Approving…' : 'Approve correction' }}
              </button>
            </template>
            <template v-if="verifying">
              <button type="button" class="btn-outline" :disabled="Boolean(acting)" @click="returnPanel">
                <AssetIcon name="undo-2" :size="14" />
                {{ acting === 'return' ? 'Returning…' : 'Return for re-entry' }}
              </button>
              <button
                type="button"
                class="btn-primary btn-primary--danger"
                :disabled="Boolean(acting) || !editing.confirmed"
                @click="verifyPanel"
              >
                <AssetIcon name="shield-check" :size="14" />
                {{ acting === 'verify' ? 'Verifying…' : 'Verify reactive' }}
              </button>
            </template>
            <button
              v-if="editable"
              type="button"
              class="btn-primary"
              :class="{ 'btn-primary--danger': pendingReactive.length }"
              :disabled="!canRequest || Boolean(acting)"
              :title="changed.length ? (editing.reason.trim() ? '' : 'Say what was entered wrongly') : 'Change a reading first'"
              @click="requestCorrection"
            >
              <AssetIcon name="check" :size="14" />
              {{ acting === 'file' ? 'Sending…' : (isHead ? 'Apply correction' : 'Request correction') }}
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
import { formatShortDate } from '~/utils/donorRecords'
import { visibleDonor } from '~/utils/donorLabel'
import { SEROLOGY_MARKERS, reactiveMarkers, serologyPayload } from '~/utils/serology'
import {
  OUTCOME_FILTERS,
  changedMarkers,
  correctionDiff,
  lockText,
  markerHeading,
  readingLabel,
  readingsOf,
} from '~/utils/serologyResults'
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'

/**
 * TTI Testing's results list (project owner, 2026-10-18): every serology
 * panel recorded at this centre, marker by marker, on the Serology Results
 * page.
 *
 * Recording stays on the testing queue, where a saved panel is only shown. It
 * is changed here (project owner, 2026-10-18): Edit files a correction from
 * this one dialog, reason included, and the Laboratory Supervisor reviews and
 * approves or rejects it in the same dialog. The server says per row whether
 * a correction can still be filed (`can.correct`, `locked`) and who may
 * decide a pending one (`correction.can_decide`); a row that allows neither
 * opens read-only with the reason.
 *
 * API SHAPE
 * -------------------------------------------------------------------------
 *  GET /laboratory/serology-results?search=&outcome=&sort=&page=
 *      -> paginator; rows: { id, donation_id, code, donor (blinded without
 *         donors.view_identity), bag: { barcode, type }, outcome,
 *         outcome_label, recorded_by, recorded_at, markers: [{ marker,
 *         label, result, result_label }], donation_status,
 *         donation_status_label, correction_pending, locked, can: { correct } }
 *  GET /laboratory/serology-results/export?(same filters)    -> CSV
 * -------------------------------------------------------------------------
 */

const props = defineProps({
  markers: { type: Array, default: () => SEROLOGY_MARKERS },
  /** The result filter to open on, e.g. awaiting_verification from the supervisor's notification. */
  initialOutcome: { type: String, default: '' },
  /** A donation to open straight away: the testing queue's "Open in Serology Results". */
  initialDonation: { type: [Number, String], default: null },
})

/** `changed` after a verification, a return or a correction, so the page can recount what waits. */
const emit = defineEmits(['changed'])

const { can, user } = useUser()
const canViewIdentity = computed(() => can('donors.view_identity'))
// Testing's correction approver. Their own correction applies as it is filed.
const isHead = computed(() => (user.value?.staff_roles ?? []).includes('lab_supervisor'))

const PER_PAGE = 25

const loading = ref(false)
const loadError = ref('')
const notice = ref(null)
const updatedAt = ref(null)
const rows = ref([])
const pager = reactive({ page: 1, lastPage: 1, total: 0 })

const search = ref('')
const outcome = ref(OUTCOME_FILTERS.some((option) => option.value === props.initialOutcome) ? props.initialOutcome : '')
const sort = ref('newest')

const columnCount = computed(() => props.markers.length + 6)
const markerList = computed(() => {
  const names = props.markers.map((marker) => markerHeading(marker.label))
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names.join('')
})
const hasFilters = computed(() => Boolean(search.value.trim() || outcome.value))
const updatedAtLabel = computed(() => updatedAt.value?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) ?? '')

function filterParams() {
  const params = {}
  if (search.value.trim()) params.search = search.value.trim()
  if (outcome.value) params.outcome = outcome.value
  if (sort.value !== 'newest') params.sort = sort.value
  return params
}

function errorMessage(err, fallback) {
  return Object.values(err?.errors ?? err?.data?.errors ?? {}).flat()[0] || err?.message || fallback
}

function formatDateTime(iso) {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return '—'
  return `${formatShortDate(iso)} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

/** The pen's tooltip: where an edit goes, or why there is none. */
function editTitle(row) {
  if (!row.can?.correct) return lockText(row) ?? 'This panel cannot be edited.'
  return isHead.value
    ? 'Edit: as the Laboratory Supervisor, your correction applies as you send it'
    : 'Edit: saved only once the Laboratory Supervisor approves it'
}

/** What a row opens on when nothing says otherwise: the supervisor's review, then edit, then view. */
function defaultMode(row) {
  if (row.can?.verify || row.correction?.can_decide) return 'review'
  if (row.can?.correct) return 'edit'
  return 'view'
}

function readingFor(row, marker) {
  return row.markers?.find((entry) => entry.marker === marker)?.result ?? ''
}

async function load(page = 1) {
  loading.value = true
  loadError.value = ''
  try {
    const res = await bloodCenterService.serologyResults({ ...filterParams(), page, per_page: PER_PAGE })
    // Blind unless the viewer may know who the donor is, whatever was sent.
    rows.value = (res?.data ?? []).map((row) => ({ ...row, donor: visibleDonor(row.donor, canViewIdentity.value) }))
    Object.assign(pager, { page: res?.current_page ?? page, lastPage: Math.max(1, res?.last_page ?? 1), total: res?.total ?? rows.value.length })
    updatedAt.value = new Date()
  } catch (err) {
    loadError.value = errorMessage(err, 'Could not load the serology results.')
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
  outcome.value = ''
  load()
}

function toggleOverallSort() {
  sort.value = sort.value === 'reactive_first' ? 'newest' : 'reactive_first'
  load()
}

function toggleTestedSort() {
  sort.value = sort.value === 'newest' ? 'oldest' : 'newest'
  load()
}

/* ---------- export ---------- */

const exporting = ref(false)

async function exportList() {
  exporting.value = true
  try {
    const blob = await bloodCenterService.exportSerologyResults(filterParams())
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `serology-results-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    notice.value = { tone: 'error', text: 'Could not export the serology results. Please try again.' }
  } finally {
    exporting.value = false
  }
}

/* ---------- edit and correction ---------- */

const editing = ref(null)

// The dialog opens on the action clicked: view, edit (the pen) or review. Each
// still needs the server's say-so for the row.
const editable = computed(() => editing.value?.mode === 'edit' && Boolean(editing.value.row.can?.correct))
const verifying = computed(() => editing.value?.mode === 'review' && Boolean(editing.value.row.can?.verify))
const deciding = computed(() => editing.value?.mode === 'review' && Boolean(editing.value.row.correction?.can_decide))
const proposedDiff = computed(() => (editing.value?.row.correction
  ? correctionDiff(editing.value.saved, editing.value.row.correction.changes, props.markers)
  : []))
const proposedReactive = computed(() => (editing.value?.row.correction
  ? reactiveMarkers({ ...editing.value.saved, ...editing.value.row.correction.changes }, props.markers)
  : []))

const dialogTitle = computed(() => {
  if (verifying.value) return { icon: 'shield-check', text: 'Verify serology' }
  if (deciding.value) return { icon: 'shield-check', text: 'Review correction' }
  if (editable.value) return { icon: 'pencil', text: 'Edit serology' }
  return { icon: 'flask-conical', text: 'Serology' }
})
const savedReactive = computed(() => (editing.value ? reactiveMarkers(editing.value.saved, props.markers) : []))
const acting = ref('')
const actionError = ref('')
const lockReason = computed(() => (editing.value ? lockText(editing.value.row) : null))
const changed = computed(() => (editing.value ? changedMarkers(editing.value.saved, editing.value.form, props.markers) : []))
const pendingReactive = computed(() => (editing.value ? reactiveMarkers(editing.value.form, props.markers) : []))
const canRequest = computed(() => editable.value
  && changed.value.length > 0
  && editing.value.reason.trim().length > 0
  && (!pendingReactive.value.length || editing.value.confirmed))

function openEdit(row, mode = defaultMode(row)) {
  const saved = readingsOf(row, props.markers)
  editing.value = { row, mode, saved, form: { ...saved }, confirmed: false, reason: '', rejecting: false, note: '' }
}

function closeEdit() {
  if (acting.value) return
  editing.value = null
  actionError.value = ''
}

/** Close, say what happened, and reload: the row's state is the server's. */
async function settled(message) {
  acting.value = ''
  closeEdit()
  notice.value = { tone: 'success', text: message }
  emit('changed')
  await load(pager.page)
}

/** The supervisor's decision on a reactive panel waiting for them. */
async function decide(kind) {
  const row = editing.value?.row
  if (!row) return

  acting.value = kind
  actionError.value = ''
  try {
    const res = kind === 'verify'
      ? await bloodCenterService.verifySerology(row.donation_id)
      : await bloodCenterService.returnSerology(row.donation_id)
    acting.value = ''
    closeEdit()
    notice.value = { tone: 'success', text: res?.message ?? (kind === 'verify' ? 'Verified.' : 'Returned for re-entry.') }
    emit('changed')
    await load(pager.page)
  } catch (err) {
    actionError.value = errorMessage(err, kind === 'verify' ? 'Could not verify this result.' : 'Could not return this result.')
    acting.value = ''
  }
}

function verifyPanel() {
  if (editing.value?.confirmed) decide('verify')
}

function returnPanel() {
  decide('return')
}

/** File the correction from this dialog: the same body the queue's Serology card would send. */
async function requestCorrection() {
  if (!canRequest.value) return

  acting.value = 'file'
  actionError.value = ''
  try {
    const res = await bloodCenterService.requestCorrection(editing.value.row.donation_id, {
      subject: 'serology',
      reason: editing.value.reason.trim(),
      changes: serologyPayload(editing.value.form, Boolean(editing.value.confirmed), props.markers),
    })
    await settled(res?.message ?? 'Correction requested.')
  } catch (err) {
    actionError.value = errorMessage(err, 'The correction could not be sent.')
    acting.value = ''
  }
}

/** The Laboratory Supervisor's decision on a correction waiting for them. */
async function approveCorrection() {
  const correction = editing.value?.row.correction
  if (!correction || (proposedReactive.value.length && !editing.value.confirmed)) return

  acting.value = 'approve'
  actionError.value = ''
  try {
    const res = await bloodCenterService.approveCorrection(correction.id)
    await settled(res?.message ?? 'Correction approved and applied.')
  } catch (err) {
    actionError.value = errorMessage(err, 'The correction could not be approved.')
    acting.value = ''
  }
}

async function rejectCorrection() {
  const correction = editing.value?.row.correction
  if (!correction || !editing.value.note.trim()) return

  acting.value = 'reject'
  actionError.value = ''
  try {
    const res = await bloodCenterService.rejectCorrection(correction.id, { note: editing.value.note.trim() })
    await settled(res?.message ?? 'Correction rejected.')
  } catch (err) {
    actionError.value = errorMessage(err, 'The correction could not be rejected.')
    acting.value = ''
  }
}

/* ---------- keyboard and lifecycle ---------- */

function onKeydown(event) {
  if (event.key === 'Escape' && editing.value) closeEdit()
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)

  // Sent here for one donation: find it, and open it.
  const wanted = Number(props.initialDonation)
  if (Number.isInteger(wanted) && wanted > 0) search.value = `DON-${wanted}`

  await load()

  const row = rows.value.find((entry) => entry.donation_id === wanted)
  if (row) openEdit(row)
})

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.tti-results { display: flex; flex-direction: column; gap: 16px; color: var(--rb-text-primary); }

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

/* ---------- Note and banners ---------- */
.note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.22);
  border-left: 3px solid var(--rb-primary);
  border-radius: 10px;
  background: rgba(var(--rb-primary-rgb), 0.06);
  font-size: 13px;
  line-height: 1.5;
}

.note > :deep(.asset-icon) { flex-shrink: 0; margin-top: 2px; color: var(--rb-primary-text); }
.note p { margin: 0; }

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

/* ---------- Buttons ---------- */
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
.btn-outline--accent { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.45); }

.btn-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
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
.th-sort:focus-visible,
.modal-card__close:focus-visible {
  outline: none;
  box-shadow: var(--rb-focus-ring);
}

.spin { animation: spin 0.9s linear infinite; }

@keyframes spin { to { transform: rotate(360deg); } }

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

.search { position: relative; flex: 1 1 200px; min-width: 160px; max-width: 280px; }

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

.select,
.tti-results .form-select {
  padding: 0 30px 0 12px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 10px 6px;
  appearance: none;
  cursor: pointer;
}

.select { field-sizing: content; }

.search__input::placeholder { color: var(--rb-placeholder); }

.search__input:focus,
.select:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

/* ---------- Table ---------- */
.table-wrap { position: relative; overflow-x: auto; transition: opacity 0.15s ease; }
.table-wrap--busy { opacity: 0.55; }

.tti-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 13px; }

.tti-table thead th {
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

.tti-table tbody td {
  padding: 11px 10px;
  border-bottom: 1px solid var(--rb-border);
  vertical-align: middle;
  overflow: hidden;
}

.tti-table th:first-child,
.tti-table td:first-child { padding-left: 16px; }

.tti-table th:last-child,
.tti-table td:last-child { padding-right: 16px; }

.tti-table tbody tr:last-child td { border-bottom: 0; }
.tti-row { transition: background 0.12s ease; }
.tti-row:hover { background: var(--rb-surface-hover); }

.c-id { width: 112px; }
.c-bag { width: 132px; }
.c-marker { width: 106px; }
.c-overall { width: 128px; }
.c-tested { width: 128px; }
.c-actions { width: 132px; }

.th-sort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  color: inherit;
  cursor: pointer;
}

.th-sort:hover { color: var(--rb-text-primary); }
.th-sort__off { opacity: 0.35; }

.code { font-family: var(--rb-font-mono); font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); white-space: nowrap; }
.mono { font-family: var(--rb-font-mono); letter-spacing: 0.02em; }
.bag { display: block; font-family: var(--rb-font-mono); font-size: 12.5px; font-weight: 700; overflow-wrap: anywhere; }
.donor__name { display: block; font-weight: 700; text-transform: capitalize; overflow-wrap: break-word; }
.sub { display: block; margin-top: 2px; font-size: 11.5px; color: var(--rb-text-secondary); overflow-wrap: anywhere; }
.sub--pending { color: var(--rb-warning-text); font-weight: 600; }
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

/* One reading. Reactive is the one with consequences, so it is the one that stands out. */
.res {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
}

.res--clear { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.res--reactive { background: rgba(var(--rb-accent-rgb), 0.14); color: var(--rb-accent-text); font-weight: 700; }
.res__short { display: none; }

.overall {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.5;
  white-space: nowrap;
}

.overall--clear { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); border-color: rgba(var(--rb-success-rgb), 0.3); }
.overall--reactive { background: rgba(var(--rb-accent-rgb), 0.14); color: var(--rb-accent-text); border-color: rgba(var(--rb-accent-rgb), 0.35); }
.overall--waiting { background: rgba(var(--rb-warning-rgb), 0.14); color: var(--rb-warning-text); border-color: rgba(var(--rb-warning-rgb), 0.4); }

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
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.icon-btn:hover:not(:disabled) { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.45); background: var(--rb-surface-hover); }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* Something waits for the supervisor: the one action that stands out. */
.icon-btn--review { background: rgba(var(--rb-warning-rgb), 0.14); border-color: rgba(var(--rb-warning-rgb), 0.45); color: var(--rb-warning-text); }
.icon-btn--review:hover:not(:disabled) { background: rgba(var(--rb-warning-rgb), 0.22); color: var(--rb-warning-text); border-color: rgba(var(--rb-warning-rgb), 0.6); }

/*
 * Every column but the donor's is fixed, so the donor's takes what is left.
 * The panel narrows as the sidebar opens, and the steps below keep a name
 * readable (about 150px) all the way down. First the words give way to
 * NR / R (the full word stays for screen readers). Then the ID goes: the bag
 * and the dialog still name the donation. Below that the table scrolls
 * sideways rather than squeeze a name to a letter a line.
 */
@container (max-width: 1340px) {
  .c-marker { width: 64px; }
  /* The headings keep their full names; the cell's sides give way instead. */
  .tti-table th.c-marker,
  .tti-table td.c-marker { padding-left: 4px; padding-right: 4px; }
  .res { padding: 2px 8px; }
  .res__long {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }
  .res__short { display: inline; }
}

@container (max-width: 1120px) {
  .c-id { display: none; }
  .c-bag { width: 116px; }
  .c-tested { width: 108px; }
  .c-actions { width: 118px; }
  .row-actions { gap: 4px; }
  .tti-table { min-width: 920px; }
}

.skeleton {
  display: block;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 6px;
  animation: shimmer 1.4s ease infinite;
}

.skeleton--line { height: 16px; width: 100%; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

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

/* ---------- Modal ---------- */
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
  max-width: 620px;
  max-height: calc(100vh - 40px);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(var(--rb-shadow-rgb), 0.28);
}

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
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--rb-border);
  flex-shrink: 0;
}


.subject {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.22);
  border-left: 3px solid var(--rb-primary);
  border-radius: 10px;
  background: rgba(var(--rb-primary-rgb), 0.06);
  font-size: 13px;
}

.subject > :deep(.asset-icon) { flex-shrink: 0; color: var(--rb-primary-text); }
.subject p { margin: 0; overflow-wrap: anywhere; }

.lock {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  font-size: 13px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.lock > :deep(.asset-icon) { flex-shrink: 0; margin-top: 2px; }

.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
.form-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.form-label { font-size: 12.5px; font-weight: 600; }
.form-required { color: var(--rb-accent-text); }

/* Anchored on the root: other portals ship unscoped dark .form-input rules. */
.tti-results .form-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.tti-results .form-select { padding-right: 30px; }
.tti-results .form-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.tti-results .form-input:disabled { background-color: var(--rb-surface-alt); color: var(--rb-text-secondary); cursor: default; opacity: 1; }
.tti-results .form-select--reactive { border-color: var(--rb-accent); color: var(--rb-accent-text); font-weight: 700; }

.form-static {
  display: flex;
  align-items: center;
  min-height: 40px;
  margin: 0;
  padding: 0 12px;
  border: 1px dashed var(--rb-border);
  border-radius: 10px;
  font-size: 13px;
  color: var(--rb-text-secondary);
}

.warn {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 10px;
  background: rgba(var(--rb-accent-rgb), 0.06);
  font-size: 13px;
  line-height: 1.5;
}

.warn p { margin: 0; }
.warn__title { display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--rb-accent-text); }
.warn__confirm { display: flex; align-items: flex-start; gap: 8px; font-weight: 600; cursor: pointer; }
.warn__confirm input { margin-top: 3px; accent-color: var(--rb-accent); }

.hint { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }

.tti-results .form-textarea { height: auto; min-height: 64px; padding: 10px 12px; line-height: 1.5; resize: vertical; }

.proposal {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface-alt);
  font-size: 13px;
  line-height: 1.5;
}

.proposal--decide { border-color: rgba(var(--rb-primary-rgb), 0.35); background: rgba(var(--rb-primary-rgb), 0.05); }
.proposal p { margin: 0; }
.proposal__title { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-weight: 700; }
.proposal__when { font-weight: 500; color: var(--rb-text-secondary); }
.proposal__diff { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.proposal__diff li { display: flex; align-items: center; gap: 8px; }
.proposal__marker { min-width: 72px; font-weight: 600; }
.proposal__reason { color: var(--rb-text-primary); font-style: italic; overflow-wrap: anywhere; }
.proposal__wait { color: var(--rb-text-secondary); }

.btn-outline--danger { color: var(--rb-accent-text); border-color: rgba(var(--rb-accent-rgb), 0.45); }

.verify {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid rgba(var(--rb-warning-rgb), 0.4);
  border-radius: 10px;
  background: rgba(var(--rb-warning-rgb), 0.07);
  font-size: 13px;
  line-height: 1.5;
}

.verify p { margin: 0; }
.verify ul { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 4px; }
.verify__title { display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--rb-warning-text); }

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

.modal-enter-active,
.modal-leave-active { transition: opacity 0.18s ease; }

.modal-enter-from,
.modal-leave-to { opacity: 0; }

@media (max-width: 760px) {
  .toolbar__filters { flex-basis: 100%; }
  .search { max-width: none; flex: 1 1 100%; }
  .toolbar__actions { width: 100%; }
  .form-grid { grid-template-columns: minmax(0, 1fr); }
  .modal-overlay { padding: 10px; align-items: flex-end; }
  .modal-card__footer { flex-wrap: wrap; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .spin { animation: none !important; }
}
</style>

<style scoped>
/* The system dropdown in a toolbar: a fixed width rather than the row's. */
.sel-filter { width: 180px; flex: none; }
</style>
