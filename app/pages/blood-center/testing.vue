<template>
  <div class="testing">
    <header class="testing__header">
      <div>
        <p class="testing__eyebrow">Blood Center Portal / Laboratory</p>
        <h1 class="testing__title">Testing</h1>
        <p class="testing__subtitle">
          Record immunohematology and the five-marker serology panel for each unit the counter has drawn. RedAgos
          stores what the medical technologist found — it does not perform or interpret any test.
        </p>
      </div>

      <span v-if="facilityLabel" class="testing__facility">
        <AssetIcon name="building-2" :size="14" />
        {{ facilityLabel }}
      </span>
    </header>

    <div class="tabs" role="tablist" aria-label="Testing">
      <button
        type="button"
        role="tab"
        class="tab"
        :class="{ 'tab--on': tab === 'queue' }"
        :aria-selected="tab === 'queue'"
        @click="switchTab('queue')"
      >
        Testing queue
      </button>
      <button
        v-if="canSeeReferrals"
        type="button"
        role="tab"
        class="tab"
        :class="{ 'tab--on': tab === 'referrals' }"
        :aria-selected="tab === 'referrals'"
        @click="switchTab('referrals')"
      >
        Counselling referrals
        <span v-if="pendingReferrals" class="tab__badge">{{ pendingReferrals }}</span>
      </button>
    </div>

    <p v-if="error" class="alert alert--error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="alert alert--notice" role="status">{{ notice }}</p>

    <!-- ============================ TESTING QUEUE ============================ -->
    <template v-if="tab === 'queue'">
      <section v-if="!selected" class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Units awaiting testing</h2>
            <p class="card__hint">
              Every drawn donation still missing immunohematology or serology. Scan a tube's segment number to go
              straight to its donation.
            </p>
          </div>

          <div class="card__tools">
            <form class="scan" @submit.prevent="findBySegment">
              <label class="field field--scan">
                <span class="field__label">Segment number</span>
                <input
                  v-model="segmentSearch"
                  type="text"
                  class="field__input mono"
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="Scan or type"
                >
              </label>
              <button type="submit" class="btn" :disabled="loadingQueue">
                <AssetIcon name="scan-line" :size="14" />
                Find
              </button>
            </form>

            <button type="button" class="btn" :disabled="loadingQueue" @click="clearSearch">
              <AssetIcon name="refresh-cw" :size="14" />
              {{ loadingQueue ? 'Loading…' : 'Refresh' }}
            </button>
          </div>
        </div>

        <p v-if="loadingQueue" class="card__hint">Loading the queue…</p>

        <div v-else-if="!queue.length" class="empty">
          <AssetIcon name="flask-conical" :size="28" />
          <p v-if="activeSegment">No unit waiting for testing has segment {{ activeSegment }}.</p>
          <p v-else>No units are waiting. Donations appear here once the counter records a collection.</p>
        </div>

        <ul v-else class="queue">
          <li v-for="row in queue" :key="row.id" class="queue__row">
            <div class="queue__main">
              <p class="queue__name">{{ row.donor?.full_name || 'Unknown donor' }}</p>
              <p class="queue__meta">
                Donation #{{ row.id }}
                <template v-if="row.collection?.segment_number"> · Segment <span class="mono">{{ row.collection.segment_number }}</span></template>
                <template v-if="row.collection?.blood_bag_type_label"> · {{ row.collection.blood_bag_type_label }} bag</template>
                · {{ formatDate(row.collection?.ended_at || row.donation_date) }}
              </p>
            </div>

            <div class="queue__state">
              <span class="chip" :class="row.immunohematology ? 'chip--done' : ''">
                <AssetIcon v-if="row.immunohematology" name="check" :size="11" />
                Typing
              </span>
              <span class="chip" :class="row.serology ? 'chip--done' : ''">
                <AssetIcon v-if="row.serology" name="check" :size="11" />
                Serology
              </span>
            </div>

            <button type="button" class="btn" :disabled="busy" @click="openDonation(row.id)">Open</button>
          </li>
        </ul>
      </section>

      <!-- ONE UNIT -->
      <template v-else>
        <section class="unit-bar">
          <div class="unit-bar__identity">
            <span class="unit-bar__avatar">{{ initials }}</span>
            <div>
              <p class="unit-bar__name">{{ selected.donor?.full_name || 'Unknown donor' }}</p>
              <p class="unit-bar__sub">
                Donation #{{ selected.id }} · {{ selected.donor?.donor_code || '—' }}
                <template v-if="selected.collection?.blood_bag_type_label"> · {{ selected.collection.blood_bag_type_label }} bag</template>
              </p>
            </div>
          </div>

          <div class="fact">
            <span class="fact__label">Segment</span>
            <span class="fact__value mono">{{ selected.collection?.segment_number || '—' }}</span>
          </div>

          <div class="fact">
            <span class="fact__label">Type on file</span>
            <span class="fact__value">{{ selected.donor?.blood_type || 'Not known yet' }}</span>
          </div>

          <div class="fact">
            <span class="fact__label">Status</span>
            <span class="pill" :class="`pill--${selected.status}`">{{ selected.status_label }}</span>
          </div>

          <button type="button" class="btn" :disabled="busy" @click="backToQueue">Back to queue</button>
        </section>

        <!-- Finished: nothing left for Testing to record -->
        <section v-if="isFinal" class="card">
          <div class="outcome" :class="selected.status === 'rejected' ? 'outcome--rejected' : 'outcome--success'">
            <AssetIcon :name="selected.status === 'rejected' ? 'octagon-alert' : 'circle-check-big'" :size="26" />
            <div>
              <h2 class="card__title">
                {{ selected.status === 'rejected' ? 'Donation rejected' : 'Cleared for issue' }}
              </h2>
              <p class="card__hint">
                <template v-if="isReactive">
                  Serology was reactive. The donation has been rejected, the donor permanently deferred and added to
                  Counselling referrals. These results can no longer be changed.
                </template>
                <template v-else-if="selected.status === 'rejected'">
                  {{ selected.rejection_reason || 'No reason was recorded.' }} These results can no longer be changed.
                </template>
                <template v-else>
                  Processing has cleared this unit. Its test results can no longer be changed.
                </template>
              </p>
            </div>
          </div>

          <div class="actions">
            <button type="button" class="btn btn--primary" @click="backToQueue">Back to queue</button>
            <button v-if="isReactive && canSeeReferrals" type="button" class="btn" @click="switchTab('referrals')">
              Open Counselling referrals
            </button>
          </div>
        </section>

        <p v-else-if="selected.status === 'tested'" class="alert alert--notice" role="status">
          Both sections are recorded and the unit is with Processing. You can still correct either section until it is
          cleared or rejected.
        </p>

        <div class="lab-grid">
          <!-- IMMUNOHEMATOLOGY -->
          <section class="card">
            <div class="card__titles">
              <h2 class="card__title">Immunohematology</h2>
              <span v-if="selected.immunohematology" class="pill pill--collected">Recorded</span>
            </div>
            <p class="card__hint">The confirmatory ABO and Rh typing of this unit's sample.</p>

            <BloodCenterBloodTypePicker
              v-model="typingForm.blood_type_id"
              :blood-types="bloodTypes"
              :disabled="isFinal || busy"
              abo-label="Blood type (ABO)"
              rh-label="Rh typing"
            />

            <ul class="references">
              <li v-if="selected.donor?.blood_type">
                The donor's record says <strong>{{ selected.donor.blood_type }}</strong>. A different typing is refused
                until Collection corrects the record.
              </li>
              <li v-else>This donor has no blood type on record. A passed unit records this typing on it.</li>
              <li v-if="selected.fingerprick_blood_type">
                Fingerprick at screening read <strong>{{ selected.fingerprick_blood_type }}</strong> — for reference
                only.
                <strong v-if="typingCode && typingCode !== selected.fingerprick_blood_type" class="references__warn">
                  Your typing differs.
                </strong>
              </li>
            </ul>

            <label class="field">
              <span class="field__label">Notes <span class="field__optional">optional</span></span>
              <textarea v-model="typingForm.notes" class="field__input" rows="2" maxlength="500" :disabled="isFinal" />
            </label>

            <p v-if="selected.immunohematology" class="screened">
              Screened by {{ selected.immunohematology.recorded_by || '—' }} ·
              {{ formatDate(selected.immunohematology.recorded_at) }}
            </p>

            <div v-if="!isFinal" class="actions">
              <button
                type="button"
                class="btn btn--primary"
                :disabled="busy || !typingForm.blood_type_id"
                @click="submitTyping"
              >
                {{ busy ? 'Saving…' : selected.immunohematology ? 'Update typing' : 'Record typing' }}
              </button>
            </div>
          </section>

          <!-- SEROLOGY -->
          <section class="card">
            <div class="card__titles">
              <h2 class="card__title">Serology</h2>
              <span
                v-if="selected.serology"
                class="pill"
                :class="selected.serology.outcome === 'reactive' ? 'pill--rejected' : 'pill--collected'"
              >
                {{ selected.serology.outcome_label }}
              </span>
            </div>
            <p class="card__hint">
              The final reading for each marker, after any repeat testing at the bench. Every marker is required.
            </p>

            <div class="panel">
              <fieldset v-for="marker in markers" :key="marker.value" class="marker" :disabled="isFinal || busy">
                <legend class="marker__name">{{ marker.label }}</legend>
                <div class="marker__choices">
                  <label
                    class="choice"
                    :class="{ 'choice--on choice--safe': readings[marker.value] === 'non_reactive' }"
                  >
                    <input v-model="readings[marker.value]" type="radio" :name="`marker-${marker.value}`" value="non_reactive" class="choice__radio" >
                    Non-reactive
                  </label>
                  <label
                    class="choice"
                    :class="{ 'choice--on choice--alarm': readings[marker.value] === 'reactive' }"
                  >
                    <input v-model="readings[marker.value]" type="radio" :name="`marker-${marker.value}`" value="reactive" class="choice__radio" >
                    Reactive
                  </label>
                </div>
              </fieldset>
            </div>

            <p v-if="selected.serology" class="screened">
              Screened by {{ selected.serology.recorded_by || '—' }} · {{ formatDate(selected.serology.recorded_at) }}
            </p>

            <div v-if="!isFinal" class="actions">
              <button
                type="button"
                class="btn"
                :class="pendingReactive.length ? 'btn--danger' : 'btn--primary'"
                :disabled="busy || !panelIsComplete"
                @click="submitSerology"
              >
                {{ busy ? 'Saving…' : selected.serology ? 'Update serology' : 'Record serology' }}
              </button>
              <span v-if="!panelIsComplete" class="card__hint">Record a reading for all five markers.</span>
            </div>
          </section>
        </div>
      </template>
    </template>

    <!-- ========================= COUNSELLING REFERRALS ========================= -->
    <section v-else-if="tab === 'referrals'" class="card">
      <div class="confidential" role="note">
        <AssetIcon name="shield-check" :size="16" />
        <p>
          Confidential. This list names which infection each donor was reactive for. Per the donor's consent, no result
          is issued to them — contact them, refer them for counselling and further management, and record what
          happened.
        </p>
      </div>

      <div class="filters" role="group" aria-label="Filter referrals">
        <button
          v-for="option in referralFilters"
          :key="option.value"
          type="button"
          class="filter"
          :class="{ 'filter--on': referralFilter === option.value }"
          @click="setReferralFilter(option.value)"
        >
          {{ option.label }}
        </button>
      </div>

      <p v-if="loadingReferrals" class="card__hint">Loading referrals…</p>

      <div v-else-if="!referrals.length" class="empty">
        <AssetIcon name="life-buoy" :size="28" />
        <p>{{ referralFilter === 'open' ? 'No donors are waiting to be followed up.' : 'No referrals match this filter.' }}</p>
      </div>

      <ul v-else class="referrals">
        <li v-for="referral in referrals" :key="referral.id" class="referral">
          <div class="referral__head">
            <div>
              <p class="referral__name">{{ referral.donor?.full_name || 'Unknown donor' }}</p>
              <p class="referral__meta">
                {{ referral.donor?.donor_code || '—' }}
                <template v-if="referral.donor?.phone"> · {{ referral.donor.phone }}</template>
                <template v-if="referral.donor?.email"> · {{ referral.donor.email }}</template>
              </p>
              <p v-if="referral.donor?.contact_person" class="referral__meta">
                Contact person: {{ referral.donor.contact_person }}
                <template v-if="referral.donor.contact_person_number"> · {{ referral.donor.contact_person_number }}</template>
              </p>
            </div>
            <span class="pill" :class="`pill--ref-${referral.status}`">{{ referral.status_label }}</span>
          </div>

          <div class="referral__facts">
            <span v-for="marker in referral.reactive_markers" :key="marker.value" class="chip chip--alarm">
              {{ marker.label }}
            </span>
            <span class="referral__meta">
              Donation #{{ referral.donation?.id }} · {{ formatDate(referral.donation?.donation_date) }}
              <template v-if="referral.donation?.segment_number"> · Segment <span class="mono">{{ referral.donation.segment_number }}</span></template>
            </span>
            <span class="referral__meta">
              Screened by {{ referral.screened_by || '—' }} · {{ formatDate(referral.screened_at) }}
            </span>
          </div>

          <p v-if="referral.note" class="referral__note">
            {{ referral.note }}
            <span v-if="referral.updated_by" class="referral__meta">— {{ referral.updated_by }}</span>
          </p>

          <!-- Moving it on. Forward only; closing needs a note. -->
          <div v-if="referral.is_open" class="referral__actions">
            <template v-if="editing?.id === referral.id">
              <label class="field">
                <span class="field__label">
                  Note
                  <span class="field__optional">{{ editing.status === 'closed' ? 'required to close' : 'optional' }}</span>
                </span>
                <textarea v-model="editing.note" class="field__input" rows="2" maxlength="500" />
              </label>
              <div class="actions">
                <button
                  type="button"
                  class="btn btn--primary"
                  :disabled="busy || (editing.status === 'closed' && !editing.note.trim())"
                  @click="submitReferral"
                >
                  {{ busy ? 'Saving…' : `Mark ${statusLabel(editing.status).toLowerCase()}` }}
                </button>
                <button type="button" class="btn" :disabled="busy" @click="editing = null">Cancel</button>
              </div>
            </template>

            <div v-else class="actions">
              <button
                v-for="next in nextStatuses(referral.status)"
                :key="next"
                type="button"
                class="btn"
                :disabled="busy"
                @click="startReferralUpdate(referral, next)"
              >
                {{ next === 'closed' ? 'Close…' : `Mark ${statusLabel(next).toLowerCase()}` }}
              </button>
            </div>
          </div>
        </li>
      </ul>
    </section>

    <!-- A reactive panel cannot be undone from here, so it is confirmed first. -->
    <div v-if="confirmingReactive" class="dialog-backdrop" @click.self="confirmingReactive = false">
      <div
        ref="dialogRef"
        class="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reactive-title"
        aria-describedby="reactive-body"
        tabindex="-1"
        @keydown.esc="confirmingReactive = false"
      >
        <h2 id="reactive-title" class="dialog__title">
          <AssetIcon name="octagon-alert" :size="18" />
          Record a reactive result?
        </h2>
        <div id="reactive-body" class="dialog__body">
          <p>
            Reactive for <strong>{{ pendingReactive.join(', ') }}</strong>. Saving this will:
          </p>
          <ul>
            <li>reject the donation, so it can never become stock;</li>
            <li>permanently defer the donor at every blood centre;</li>
            <li>add the donor to Counselling referrals;</li>
            <li>ask the donor, without saying why, to contact the centre.</li>
          </ul>
          <p>It cannot be undone here. Check the readings against the bench record first.</p>
        </div>
        <div class="actions">
          <button type="button" class="btn btn--danger" :disabled="busy" @click="confirmReactive">
            {{ busy ? 'Saving…' : 'Confirm reactive result' }}
          </button>
          <button type="button" class="btn" :disabled="busy" @click="confirmingReactive = false">Go back</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import BloodCenterBloodTypePicker from '~/components/BloodCenter/BloodTypePicker.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { bloodTypeCodeFor } from '~/utils/bloodType'
import { normalizeSegmentNumber } from '~/utils/phlebotomy'
import {
  SEROLOGY_MARKERS,
  blankPanel,
  panelComplete,
  reactiveMarkers,
  serologyPayload,
} from '~/utils/serology'

/**
 * The Testing department's page: Section II's Immunohematology and Serology
 * tables, and the follow-up the donor consented to in Section I-C.
 *
 * Its own page, separate from Processing. The two sections are saved
 * separately so each carries its own "Screened by". When both are in and all
 * five markers are non-reactive, the donation passes to Processing. A reactive
 * marker rejects it, permanently defers the donor and opens a counselling
 * referral — the server does all of that in one transaction, and refuses a
 * reactive panel that was not explicitly confirmed here.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'lab.record_result',
})

const route = useRoute()
const { user, can } = useUser()
const facilityLabel = computed(() => user.value?.facility?.facility_name || '')
const canSeeReferrals = computed(() => can('lab.referrals'))

const service = bloodCenterService

const tab = ref('queue')
const busy = ref(false)
const error = ref(null)
const notice = ref(null)

// --- reference data ---------------------------------------------------------

const bloodTypes = ref([])
const markers = ref(SEROLOGY_MARKERS)

async function loadReference() {
  try {
    const res = await service.referenceData()

    bloodTypes.value = res?.blood_types ?? []
    if (res?.serology_markers?.length) markers.value = res.serology_markers
  } catch {
    error.value = 'Reference data could not be loaded, so blood types are unavailable.'
  }
}

// --- the queue ----------------------------------------------------------------

const queue = ref([])
const loadingQueue = ref(false)
const segmentSearch = ref('')
const activeSegment = ref('')

async function loadQueue() {
  loadingQueue.value = true

  try {
    const params = { stage: 'testing' }
    if (activeSegment.value) params.segment_number = activeSegment.value

    const res = await service.laboratoryQueue(params)

    queue.value = res?.data ?? []
  } catch (err) {
    error.value = messageFor(err)
  } finally {
    loadingQueue.value = false
  }
}

/**
 * Find the tube in hand. One match opens it straight away — the medical
 * technologist scanned it because that is the one they are about to test.
 */
async function findBySegment() {
  error.value = null
  activeSegment.value = normalizeSegmentNumber(segmentSearch.value)

  await loadQueue()

  if (activeSegment.value && queue.value.length === 1) await openDonation(queue.value[0].id)
}

function clearSearch() {
  segmentSearch.value = ''
  activeSegment.value = ''
  error.value = null
  loadQueue()
}

// --- one unit ---------------------------------------------------------------

const selected = ref(null)
const typingForm = reactive({ blood_type_id: null, notes: '' })
const readings = reactive(blankPanel())

const isFinal = computed(() => ['completed', 'rejected'].includes(selected.value?.status))
const isReactive = computed(() => selected.value?.serology?.outcome === 'reactive')
const typingCode = computed(() => bloodTypeCodeFor(bloodTypes.value, typingForm.blood_type_id))
const panelIsComplete = computed(() => panelComplete(readings, markers.value))
const pendingReactive = computed(() => reactiveMarkers(readings, markers.value))

const initials = computed(() => (selected.value?.donor?.full_name || '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '—')

/**
 * Adopt a donation from the server and seed both forms from what it recorded.
 *
 * The typing is seeded only from Testing's own earlier typing — never from the
 * fingerprick at screening, and never from the donor's profile. This is the
 * confirmatory reading; a pre-filled answer is one careless click from being
 * rubber-stamped.
 */
function adopt(payload) {
  selected.value = payload ?? null

  if (!payload) return

  typingForm.blood_type_id = payload.immunohematology?.blood_type_id ?? null
  typingForm.notes = payload.immunohematology?.notes ?? ''

  Object.assign(readings, blankPanel(markers.value))

  for (const marker of payload.serology?.markers ?? []) {
    readings[marker.marker] = marker.result
  }
}

async function openDonation(id) {
  const res = await run(() => service.laboratoryDonation(id))

  if (!res) return

  notice.value = null
  adopt(res.data ?? res)
}

function backToQueue() {
  selected.value = null
  error.value = null
  notice.value = null
  confirmingReactive.value = false
  loadQueue()
}

async function submitTyping() {
  const res = await run(() => service.recordImmunohematology(selected.value.id, {
    blood_type_id: typingForm.blood_type_id,
    notes: typingForm.notes?.trim() || null,
  }))

  if (!res) return

  adopt(res.data)
  notice.value = res.message ?? null
}

const confirmingReactive = ref(false)
const dialogRef = ref(null)

watch(confirmingReactive, (open) => {
  if (open) nextTick(() => dialogRef.value?.focus())
})

function submitSerology() {
  if (pendingReactive.value.length) {
    confirmingReactive.value = true
    return
  }

  saveSerology(false)
}

function confirmReactive() {
  saveSerology(true)
}

async function saveSerology(confirmed) {
  const res = await run(() => service.recordSerology(
    selected.value.id,
    serologyPayload(readings, confirmed, markers.value),
  ))

  confirmingReactive.value = false

  if (!res) return

  adopt(res.data)
  notice.value = res.message ?? null

  if (res.data?.status === 'rejected') loadReferrals()
}

// --- counselling referrals ---------------------------------------------------

const referrals = ref([])
const pendingReferrals = ref(0)
const loadingReferrals = ref(false)
const referralFilter = ref('open')
const editing = ref(null)

const referralFilters = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'referred', label: 'Referred' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
]

const STATUS_ORDER = ['pending', 'contacted', 'referred', 'closed']
const STATUS_LABELS = { pending: 'Pending', contacted: 'Contacted', referred: 'Referred', closed: 'Closed' }

function statusLabel(status) {
  return STATUS_LABELS[status] ?? status
}

/** Forward only, and a step may be skipped. Matches ReferralStatus::canMoveTo. */
function nextStatuses(status) {
  return STATUS_ORDER.slice(STATUS_ORDER.indexOf(status) + 1)
}

async function loadReferrals() {
  if (!canSeeReferrals.value) return

  loadingReferrals.value = true

  try {
    const res = await service.counsellingReferrals({ status: referralFilter.value })

    referrals.value = res?.data ?? []
    pendingReferrals.value = res?.pending_count ?? 0
  } catch (err) {
    error.value = messageFor(err)
  } finally {
    loadingReferrals.value = false
  }
}

function setReferralFilter(value) {
  referralFilter.value = value
  editing.value = null
  loadReferrals()
}

function startReferralUpdate(referral, status) {
  editing.value = { id: referral.id, status, note: referral.note ?? '' }
}

async function submitReferral() {
  const { id, status, note } = editing.value

  const res = await run(() => service.updateCounsellingReferral(id, {
    status,
    note: note.trim() || null,
  }))

  if (!res) return

  editing.value = null
  notice.value = res.message ?? null
  await loadReferrals()
}

function switchTab(next) {
  tab.value = next
  error.value = null
  notice.value = null

  if (next === 'referrals') loadReferrals()
}

// --- shared -------------------------------------------------------------------

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Turn a server refusal into something a medical technologist can act on.
 */
function messageFor(err) {
  const errors = err?.data?.errors

  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat()[0]
    if (first) return first
  }

  switch (err?.data?.code) {
    case 'donation_not_collected':
      return 'The counter has not finished with this donation yet.'
    case 'results_locked':
      return 'This donation is final, so its test results can no longer be changed.'
    case 'blood_type_mismatch':
      return err?.data?.message || 'This typing disagrees with the donor’s record. Collection must correct it first.'
    case 'donation_not_found':
      return 'That donation was not found at your facility.'
    case 'referral_transition_invalid':
      return err?.data?.message || 'A referral can only move forward.'
    case 'referral_closed':
      return 'This referral is closed and can no longer be changed.'
    case 'referral_not_found':
      return 'That referral was not found at your facility.'
    case 'facility_missing':
      return 'This account is not linked to a facility.'
    default:
      return err?.message || 'Something went wrong. Try again.'
  }
}

async function run(work) {
  busy.value = true
  error.value = null

  try {
    return await work()
  } catch (err) {
    error.value = messageFor(err)
    return null
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  await loadReference()
  await loadQueue()

  // Arrived from the Processing page's "Open on the Testing page".
  const linked = Number(route.query.donation)
  if (Number.isInteger(linked) && linked > 0) await openDonation(linked)

  if (canSeeReferrals.value) loadReferrals()
})
</script>

<style scoped>
.testing {
  font-family: var(--rb-font-sans);
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  background: var(--rb-page-bg);
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.testing__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.testing__eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--rb-primary-text);
}

.testing__title {
  margin: 0.15rem 0 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--rb-text-primary);
}

.testing__subtitle {
  margin: 0.3rem 0 0;
  max-width: 64ch;
  font-size: 13px;
  color: var(--rb-text-secondary);
}

.testing__facility {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--rb-border);
  border-radius: 999px;
  background: var(--rb-surface);
  font-size: 0.78rem;
  color: var(--rb-text-secondary);
}

/* --- tabs --- */
.tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--rb-border);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.85rem;
  margin-bottom: -1px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.tab:hover { color: var(--rb-text-primary); }
.tab--on { color: var(--rb-primary-text); border-bottom-color: var(--rb-primary); }

.tab:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; border-radius: 6px; }

.tab__badge {
  min-width: 1.25rem;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background: var(--rb-accent);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  text-align: center;
}

/* --- cards --- */
.card {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.1rem;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
  min-width: 0;
}

.card__head {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
  justify-content: space-between;
}

.card__titles { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }

.card__tools { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: flex-end; }

.card__title { margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--rb-text-primary); }

.card__hint {
  margin: 0;
  max-width: 68ch;
  font-size: 0.83rem;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.lab-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
}

@media (min-width: 900px) {
  .lab-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
}

.scan { display: flex; gap: 0.5rem; align-items: flex-end; }
.field--scan { width: 13rem; }

/* --- queue --- */
.queue { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }

.queue__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--rb-border);
}

.queue__row:first-child { border-top: none; }

.queue__main { flex: 1 1 18rem; min-width: 0; }
.queue__name { margin: 0; font-weight: 700; font-size: 0.9rem; color: var(--rb-text-primary); }
.queue__meta { margin: 0.15rem 0 0; font-size: 0.78rem; color: var(--rb-text-secondary); }
.queue__state { display: flex; gap: 0.4rem; }

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px dashed var(--rb-border-strong);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--rb-text-secondary);
}

.chip--done {
  border-style: solid;
  border-color: transparent;
  background: rgba(var(--rb-success-rgb), 0.12);
  color: var(--rb-success-text);
}

.chip--alarm {
  border-style: solid;
  border-color: transparent;
  background: rgba(var(--rb-accent-rgb), 0.12);
  color: var(--rb-accent-text);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1.6rem 1rem;
  text-align: center;
  color: var(--rb-text-secondary);
  font-size: 0.85rem;
}

.empty p { margin: 0; }

/* --- unit bar --- */
.unit-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem 1.3rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 12px;
  background: var(--rb-surface-alt);
}

.unit-bar__identity { display: flex; align-items: center; gap: 0.7rem; flex: 1 1 14rem; min-width: 0; }

.unit-bar__avatar {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 50%;
  background: rgba(var(--rb-primary-rgb), 0.12);
  color: var(--rb-primary-text);
  font-size: 0.8rem;
  font-weight: 700;
}

.unit-bar__name { margin: 0; font-weight: 700; font-size: 0.95rem; color: var(--rb-text-primary); }
.unit-bar__sub { margin: 0.1rem 0 0; font-size: 0.78rem; color: var(--rb-text-secondary); }

.fact { display: flex; flex-direction: column; gap: 0.25rem; }

.fact__label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.fact__value { font-size: 0.85rem; color: var(--rb-text-primary); }

.pill {
  display: inline-block;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 600;
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
  border: 1px solid var(--rb-border);
}

.pill--collected,
.pill--completed,
.pill--ref-closed { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); border-color: transparent; }
.pill--tested,
.pill--ref-contacted,
.pill--ref-referred { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); border-color: transparent; }
.pill--rejected,
.pill--ref-pending { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); border-color: transparent; }

/* --- sections --- */
.references {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.8rem;
  line-height: 1.55;
  color: var(--rb-text-secondary);
}

.references strong { color: var(--rb-text-primary); }
.references .references__warn { color: var(--rb-warning-text); }

.screened { margin: 0; font-size: 0.78rem; color: var(--rb-text-secondary); }

/*
 * Five rows, two choices each, nothing pre-selected. Reactive is the reading
 * with consequences, so once chosen it is the one that stands out.
 */
.panel { display: flex; flex-direction: column; }

.marker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  margin: 0;
  padding: 0.55rem 0;
  border: none;
  border-top: 1px solid var(--rb-border);
}

.marker:first-child { border-top: none; }

.marker__name {
  float: left;
  padding: 0;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--rb-text-primary);
}

.marker__choices { display: inline-flex; gap: 0.35rem; margin-left: auto; }

.choice {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
  user-select: none;
}

.choice:hover { border-color: var(--rb-border-hover); color: var(--rb-text-primary); }

.choice__radio { position: absolute; opacity: 0; pointer-events: none; }

.choice:has(.choice__radio:focus-visible) { outline: 2px solid var(--rb-primary); outline-offset: 1px; }

.choice--safe { background: rgba(var(--rb-success-rgb), 0.12); border-color: var(--rb-success); color: var(--rb-success-text); }
.choice--alarm { background: var(--rb-accent); border-color: var(--rb-accent); color: #fff; }

.marker:disabled .choice { cursor: default; opacity: 0.75; }

/* --- forms --- */
.field { display: flex; flex-direction: column; gap: 0.3rem; width: 100%; }
.field__label { font-size: 0.75rem; font-weight: 600; color: var(--rb-text-primary); }
.field__optional { font-weight: 400; color: var(--rb-text-secondary); font-size: 0.72rem; }

.field__input {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 0.85rem;
}

.field__input:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; border-color: var(--rb-primary); }

.mono { font-family: var(--rb-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); letter-spacing: 0.02em; }

/* --- actions --- */
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  border-radius: 10px;
  padding: 0.5rem 0.95rem;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;
}

.btn:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }

.btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--rb-primary) 88%, #000);
  border-color: color-mix(in srgb, var(--rb-primary) 88%, #000);
}

.btn--danger { background: var(--rb-accent); border-color: var(--rb-accent); color: #fff; }
.btn--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--rb-accent) 88%, #000);
  border-color: color-mix(in srgb, var(--rb-accent) 88%, #000);
}

/* --- feedback --- */
.alert { margin: 0; padding: 0.65rem 0.85rem; border-radius: 10px; font-size: 0.84rem; }

.alert--error {
  background: rgba(var(--rb-accent-rgb), 0.1);
  color: var(--rb-accent-text);
  border: 1px solid rgba(var(--rb-accent-rgb), 0.3);
}

.alert--notice {
  background: rgba(var(--rb-primary-rgb), 0.08);
  color: var(--rb-primary-text);
  border: 1px solid rgba(var(--rb-primary-rgb), 0.25);
}

.outcome { display: flex; align-items: flex-start; gap: 0.75rem; }
.outcome--success { color: var(--rb-success-text); }
.outcome--rejected { color: var(--rb-accent-text); }
.outcome .card__title { color: var(--rb-text-primary); }

/* --- referrals --- */
.confidential {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  border: 1px solid rgba(var(--rb-warning-rgb), 0.35);
  background: rgba(var(--rb-warning-rgb), 0.08);
  color: var(--rb-warning-text);
  font-size: 0.82rem;
  line-height: 1.5;
}

.confidential p { margin: 0; }

.filters { display: flex; flex-wrap: wrap; gap: 0.35rem; }

.filter {
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.filter:hover { color: var(--rb-text-primary); }
.filter--on { background: var(--rb-text-primary); border-color: var(--rb-text-primary); color: var(--rb-surface); }
.filter:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; }

.referrals { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.75rem; }

.referral {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface);
}

.referral__head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
.referral__name { margin: 0; font-weight: 700; font-size: 0.92rem; color: var(--rb-text-primary); }
.referral__meta { margin: 0.1rem 0 0; font-size: 0.78rem; color: var(--rb-text-secondary); }
.referral__facts { display: flex; flex-wrap: wrap; gap: 0.4rem 0.9rem; align-items: center; }

.referral__note {
  margin: 0;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  background: var(--rb-surface-alt);
  font-size: 0.82rem;
  color: var(--rb-text-primary);
}

.referral__actions { display: flex; flex-direction: column; gap: 0.5rem; }

/* --- confirm dialog --- */
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
}

.dialog {
  width: min(30rem, 100%);
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1.2rem;
  border-radius: 14px;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
}

.dialog:focus-visible { outline: 2px solid var(--rb-accent); outline-offset: 2px; }

.dialog__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--rb-accent-text);
}

.dialog__body { font-size: 0.86rem; line-height: 1.55; color: var(--rb-text-primary); }
.dialog__body p { margin: 0 0 0.4rem; }
.dialog__body ul { margin: 0 0 0.5rem; padding-left: 1.1rem; }

@media (max-width: 640px) {
  .testing { padding: 16px 16px 32px; }
  .scan { flex-wrap: wrap; }
  .field--scan { width: 100%; }
  .marker__choices { margin-left: 0; }
}
</style>
