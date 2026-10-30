<template>
  <div class="testing">
    <header class="testing__header">
      <div>
        <h1 class="testing__title">{{ viewCopy.title }}</h1>
        <p class="testing__note">
          <AssetIcon name="info" :size="13" />
          A passing result clears its section; a saved result changes only through an approved correction. RedAgos
          records what the medical technologist found. It does not perform or interpret any test.
        </p>
      </div>
    </header>

    <p v-if="error" class="alert alert--error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="alert alert--notice" role="status">{{ notice }}</p>

    <!--
      Workspace: the queue stays on the left while the open unit's serology
      panel and typing are recorded on the right, the same layout as Processing.
    -->
    <div class="workspace">
      <aside class="queue-panel" aria-label="Units awaiting testing">
        <div class="queue-panel__head">
          <p class="queue-panel__title">
            {{ viewCopy.queueTitle }}
            <span class="queue-panel__count">{{ loadingQueue ? '…' : visibleQueue.length }}</span>
          </p>
          <button
            type="button"
            class="icon-btn"
            :disabled="loadingQueue"
            aria-label="Refresh the queue"
            title="Refresh"
            @click="clearSearch"
          >
            <AssetIcon name="refresh-cw" :size="14" :class="{ spin: loadingQueue }" />
          </button>
        </div>

        <div class="queue-panel__tools">
          <!-- Scan the sticker on a tube to go straight to its donation. -->
          <form class="scan" @submit.prevent="findByBarcode">
            <AssetIcon name="scan-line" :size="16" class="scan__icon" />
            <input
              v-model="barcodeSearch"
              type="text"
              class="field__input mono"
              autocomplete="off"
              spellcheck="false"
              placeholder="Scan or type a barcode"
              aria-label="Donation barcode"
            >
            <button type="submit" class="btn btn--primary scan__go" :disabled="loadingQueue">
              Find
            </button>
          </form>

          <p v-if="activeBarcode" class="scan__active">
            Barcode <span class="mono">{{ activeBarcode }}</span>
            <button type="button" class="link-btn" :disabled="loadingQueue" @click="clearSearch">Show all</button>
          </p>

          <!-- Only for someone who records both; anyone else sees their own test's queue. -->
          <div v-if="canType && canSerology" class="view-switch" role="group" aria-label="Show units waiting for">
            <button
              v-for="option in viewOptions"
              :key="option.value"
              type="button"
              class="view-switch__btn"
              :class="{ 'view-switch__btn--on': testView === option.value }"
              :aria-pressed="testView === option.value"
              @click="setTestView(option.value)"
            >
              {{ option.label }}
              <span class="view-switch__count">{{ option.count }}</span>
            </button>
          </div>
        </div>

        <ul v-if="loadingQueue" class="qlist" aria-busy="true">
          <li v-for="n in 4" :key="n" class="qitem qitem--skeleton">
            <span class="skeleton skeleton--line" />
            <span class="skeleton skeleton--short" />
          </li>
        </ul>

        <div v-else-if="!visibleQueue.length" class="queue-empty">
          <AssetIcon name="flask-conical" :size="18" />
          <p v-if="activeBarcode">No unit waiting for {{ viewCopy.noun }} has barcode {{ activeBarcode }}.</p>
          <p v-else-if="testView !== 'all' && queue.length">
            Nothing is waiting for {{ viewCopy.noun }}. {{ queue.length }} unit{{ queue.length === 1 ? ' is' : 's are' }} still waiting for the other test.
          </p>
          <p v-else>No units are waiting. Donations appear here once the counter records a collection.</p>
        </div>

        <ul v-else class="qlist">
          <li v-for="row in visibleQueue" :key="row.id">
            <button
              type="button"
              class="qitem"
              :class="[`qitem--${rowTone(row)}`, { 'qitem--on': selected?.id === row.id }]"
              :aria-current="selected?.id === row.id ? 'true' : undefined"
              :disabled="busy"
              @click="openDonation(row.id)"
            >
              <span class="qitem__name">{{ donorTitle(row.donor, row.collection?.donation_barcode, row.id) }}</span>
              <span class="qitem__meta">
                #{{ row.id }}
                <template v-if="row.collection?.donation_barcode && !row.donor?.blinded"> · <span class="mono">{{ row.collection.donation_barcode }}</span></template>
                <template v-if="row.collection?.blood_bag_type_label"> · {{ row.collection.blood_bag_type_label }}</template>
                · {{ formatDate(row.collection?.ended_at || row.donation_date) }}
              </span>
              <span class="qitem__state">
                <span v-if="row.immunohematology?.clearance_hold" class="chip chip--alarm">Typing held</span>
                <span v-else class="chip" :class="row.clearances?.immunohematology ? 'chip--done' : ''">
                  <AssetIcon v-if="row.clearances?.immunohematology" name="check" :size="11" />
                  Typing
                </span>
                <span v-if="row.serology?.awaiting_verification" class="chip chip--wait" title="Saved as reactive, waiting for the Laboratory Supervisor">
                  <AssetIcon name="clock" :size="11" />
                  Serology to verify
                </span>
                <span v-else class="chip" :class="row.clearances?.tti ? 'chip--done' : ''">
                  <AssetIcon v-if="row.clearances?.tti" name="check" :size="11" />
                  Serology
                </span>
              </span>
            </button>
          </li>
        </ul>
      </aside>

      <section ref="benchRef" class="bench">
        <!--
          ONE UNIT. With none open the results card still shows, locked, and its
          Save line says to pick one. A unit is never opened for the
          technologist: they pick the tube in hand.
        -->
        <template v-if="selected">
          <section class="unit-bar">
            <div class="unit-bar__identity">
              <!-- A bag, not a person, for the roles that work blind. -->
              <span class="unit-bar__avatar">
                <AssetIcon v-if="selected.donor?.blinded" name="droplets" :size="16" />
                <template v-else>{{ initials }}</template>
              </span>
              <div>
                <p class="unit-bar__name">{{ donorTitle(selected.donor, selected.collection?.donation_barcode, selected.id) }}</p>
                <p class="unit-bar__sub">
                  Donation #{{ selected.id }} · {{ donorReference(selected.donor) }}
                  <template v-if="selected.collection?.blood_bag_type_label"> · {{ selected.collection.blood_bag_type_label }} bag</template>
                </p>
              </div>
            </div>

            <div class="fact">
              <span class="fact__label">Barcode</span>
              <span class="fact__value mono">{{ selected.collection?.donation_barcode || 'None' }}</span>
            </div>

            <div class="fact">
              <span class="fact__label">Type on file</span>
              <span class="fact__value">{{ selected.donor?.blood_type || 'Not known yet' }}</span>
            </div>

            <div class="fact">
              <span class="fact__label">Status</span>
              <span class="pill" :class="`pill--${selected.status}`">{{ selected.status_label }}</span>
            </div>

            <button type="button" class="icon-btn" :disabled="busy" aria-label="Close this unit" title="Close" @click="backToQueue">
              <AssetIcon name="x" :size="16" />
            </button>
          </section>

          <!-- Finished: nothing left for Testing to record -->
          <section v-if="isFinal" class="card">
            <div class="outcome" :class="selected.status === 'rejected' ? 'outcome--rejected' : 'outcome--success'">
              <AssetIcon :name="selected.status === 'rejected' ? 'octagon-alert' : 'circle-check-big'" :size="26" />
              <div>
                <h2 class="card__title">Donation rejected</h2>
                <p class="card__hint">
                  <template v-if="isReactive">
                    Serology was reactive. The donation has been rejected, the donor permanently deferred and added to
                    Counselling referrals. These results can no longer be changed.
                  </template>
                  <template v-else>
                    {{ selected.rejection_reason || 'No reason was recorded.' }} These results can no longer be changed.
                  </template>
                </p>
              </div>
            </div>

            <div class="actions">
              <button type="button" class="btn btn--primary" @click="backToQueue">Close this unit</button>
              <NuxtLink v-if="isReactive && canSeeReferrals" to="/blood-center/counselling-referrals" class="btn">
                Open Counselling Referrals
              </NuxtLink>
            </div>
          </section>

          <p v-else-if="selected.clearances?.tti && selected.clearances?.immunohematology" class="alert alert--notice" role="status">
            Both sections are cleared, so this unit's bags may leave quarantine. A result can still be corrected, with
            approval, until a bag has left quarantine.
          </p>
        </template>

        <!--
          One card, one Save (project owner, 2026-10-22): the typing and the
          serology panel side by side, each shown only to the role that records
          it. Save records whatever is filled in; the server still takes each
          section on its own endpoint.
        -->
        <section class="card results">
          <div
            class="results__grid"
            :class="{
              'results__grid--pair': canType && canSerology,
              'results__grid--serology-first': testView === 'serology',
            }"
          >
            <!-- IMMUNOHEMATOLOGY: recorded by the Immunohematology department. -->
            <div v-if="canType" class="results__section results__section--typing">
              <div class="card__titles">
                <h2 class="card__title">Immunohematology</h2>
                <span v-if="selected?.clearances?.immunohematology" class="pill pill--collected">Cleared</span>
                <span v-else-if="typingHold" class="pill pill--rejected">{{ typingHoldLabel }}</span>
              </div>
              <p v-if="typingHold" class="card__hint card__hint--warn">{{ typingHoldText }}</p>

              <fieldset class="exam" :disabled="locked || busy">
                <BloodCenterBloodTypePicker
                  v-model="typingForm.blood_type_id"
                  :blood-types="bloodTypes"
                  :disabled="locked || busy"
                  abo-label="ABO group"
                  rh-label="Rh typing"
                />
              </fieldset>

              <ul v-if="selected" class="references">
                <li v-if="selected.donor?.blood_type">
                  The donor's record says <strong>{{ selected.donor.blood_type }}</strong>. A different typing is refused
                  until Collection corrects the record.
                </li>
                <li v-else>This donor has no blood type on record. A cleared typing is recorded on it.</li>
                <li v-if="selected.fingerprick_blood_type">
                  Fingerprick at screening read <strong>{{ selected.fingerprick_blood_type }}</strong> — for reference
                  only.
                </li>
              </ul>

              <label class="field">
                <span class="field__label">Notes <span class="field__optional">optional</span></span>
                <textarea v-model="typingForm.notes" class="field__input" rows="2" maxlength="500" :disabled="locked" />
              </label>

              <p v-if="selected?.immunohematology" class="screened">
                Screened by {{ selected.immunohematology.recorded_by || '—' }} ·
                {{ formatDate(selected.immunohematology.recorded_at) }}
              </p>
              <p v-if="selected?.immunohematology && !isFinal" class="card__hint">
                Saved typings change only with approval: a change you save goes as a correction request.
              </p>
            </div>

            <!-- SEROLOGY: TTI Testing's section. Shown first in the Serology view. -->
            <div v-if="canSerology" class="results__section results__section--serology">
              <div class="card__titles">
                <h2 class="card__title">Serology</h2>
                <span v-if="selected?.serology?.awaiting_verification" class="pill pill--waiting">Awaiting verification</span>
                <span
                  v-else-if="selected?.serology"
                  class="pill"
                  :class="selected.serology.outcome === 'reactive' ? 'pill--rejected' : 'pill--collected'"
                >
                  {{ selected.serology.outcome_label }}
                </span>
              </div>
              <div v-if="selected?.serology?.awaiting_verification" class="held" role="status">
                <p>
                  Saved as reactive. It takes effect only when the Laboratory Supervisor verifies it against the bench
                  record. Until then the donation is not rejected, the donor is not deferred and the unit stays in
                  quarantine.
                </p>
                <NuxtLink v-if="canVerify" to="/blood-center/serology-results?outcome=awaiting_verification" class="btn btn--primary">
                  <AssetIcon name="shield-check" :size="14" />
                  Verify or return
                </NuxtLink>
              </div>
              <div class="panel-head">
                <span class="panel-head__count" :class="{ 'panel-head__count--done': readCount === markers.length }">
                  {{ readCount }} of {{ markers.length }} read
                </span>
                <!-- Most panels read clean: one click marks them all. Still only a draft; Save sends it. -->
                <button
                  type="button"
                  class="btn btn--sm panel-head__all"
                  :disabled="locked || busy || Boolean(selected?.serology)"
                  @click="markAllNonReactive"
                >
                  <AssetIcon name="check-check" :size="14" />
                  All non-reactive
                </button>
              </div>

              <div class="panel">
                <!-- Recorded once here. A saved panel is only shown: it is corrected on
                     Serology Results, and a held one changes only by the supervisor's Return. -->
                <fieldset
                  v-for="marker in markers"
                  :key="marker.value"
                  class="marker"
                  :disabled="locked || busy || Boolean(selected?.serology)"
                >
                  <legend class="marker__name">{{ marker.label }}</legend>
                  <div class="marker__choices">
                    <label
                      class="choice"
                      :class="{ 'choice--on choice--safe': readings[marker.value] === 'non_reactive' }"
                    >
                      <input v-model="readings[marker.value]" type="radio" :name="`marker-${marker.value}`" value="non_reactive" class="choice__radio" >
                      <AssetIcon name="check" :size="13" class="choice__icon" />
                      Non-reactive
                    </label>
                    <label
                      class="choice"
                      :class="{ 'choice--on choice--alarm': readings[marker.value] === 'reactive' }"
                    >
                      <input v-model="readings[marker.value]" type="radio" :name="`marker-${marker.value}`" value="reactive" class="choice__radio" >
                      <AssetIcon name="circle-alert" :size="13" class="choice__icon" />
                      Reactive
                    </label>
                  </div>
                </fieldset>
              </div>

              <p v-if="selected?.serology" class="screened">
                Screened by {{ selected.serology.recorded_by || '—' }} · {{ formatDate(selected.serology.recorded_at) }}
                <template v-if="selected.serology.verified_by && selected.serology.verified_by !== selected.serology.recorded_by">
                  · Verified by {{ selected.serology.verified_by }}
                </template>
              </p>

              <!-- Saved: view it here, change it there, where the Laboratory Supervisor approves it. -->
              <div v-if="selected?.serology && !selected.serology.awaiting_verification" class="actions">
                <NuxtLink :to="`/blood-center/serology-results?donation=${selected.id}`" class="btn">
                  <AssetIcon :name="isFinal ? 'eye' : 'pencil'" :size="14" />
                  {{ isFinal ? 'View in Serology Results' : 'View or edit in Serology Results' }}
                </NuxtLink>
                <span v-if="!isFinal" class="card__hint">
                  A saved panel changes only through a correction the Laboratory Supervisor approves there.
                </span>
              </div>
            </div>
          </div>

          <!-- The one Save. A reactive panel turns it red: it is confirmed before it goes. -->
          <div v-if="!isFinal" class="results__foot">
            <button
              type="button"
              class="btn"
              :class="reactiveToSave ? 'btn--danger' : 'btn--primary'"
              :disabled="!canSave"
              @click="submitResults"
            >
              {{ busy ? 'Saving…' : 'Save' }}
            </button>
            <span class="card__hint">{{ saveHint }}</span>
          </div>
        </section>
      </section>
    </div>

    <BloodCenterCorrectionRequestDialog
      v-if="correction && selected"
      :donation-id="selected.id"
      :subject="correction.subject"
      :changes="correction.changes"
      :previous="correction.previous"
      @close="correction = null"
      @submitted="onCorrectionSent"
    />

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
          <template v-if="canVerify">
            <p>
              Reactive for <strong>{{ pendingReactive.join(', ') }}</strong>. As the Laboratory Supervisor, your entry
              is verified as you save it. Saving this will:
            </p>
            <ul>
              <li>reject the donation, so it can never become stock;</li>
              <li>permanently defer the donor at every blood centre;</li>
              <li>add the donor to Counselling referrals, where you refer them to a doctor.</li>
            </ul>
            <p>It cannot be undone here. Check the readings against the bench record first.</p>
          </template>
          <template v-else>
            <p>
              Reactive for <strong>{{ pendingReactive.join(', ') }}</strong>. Saving this sends it to the Laboratory
              Supervisor, who checks it against the bench record. Nothing happens until they verify it. Then:
            </p>
            <ul>
              <li>the donation is rejected, so it can never become stock;</li>
              <li>the donor is permanently deferred at every blood centre;</li>
              <li>the donor is added to Counselling referrals.</li>
            </ul>
            <p>If the reading is wrong, the supervisor returns it to be entered again.</p>
          </template>
        </div>
        <div class="actions">
          <button type="button" class="btn btn--danger" :disabled="busy" @click="confirmReactive">
            {{ busy ? 'Saving…' : (canVerify ? 'Confirm reactive result' : 'Save for verification') }}
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
import BloodCenterCorrectionRequestDialog from '~/components/BloodCenter/CorrectionRequestDialog.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { donorInitials, donorReference, donorTitle, visibleDonor } from '~/utils/donorLabel'
import { aboOf, bloodTypeCodeFor } from '~/utils/bloodType'
import { normalizeBarcode } from '~/utils/phlebotomy'
import {
  SEROLOGY_MARKERS,
  blankPanel,
  panelComplete,
  reactiveMarkers,
  serologyPayload,
} from '~/utils/serology'

/**
 * The testing page: Section II's Immunohematology and Serology tables.
 *
 * The Serology Results list and the Counselling Referrals follow-up are pages
 * of their own in the sidebar (project owner, 2026-10-18).
 *
 * One page for two departments. Immunohematology records the typing and TTI
 * Testing the serology panel; each card shows only to the role that records
 * it. Saving a result that passes issues that section's clearance at once. A
 * reactive marker rejects the donation, permanently defers the donor and opens
 * a counselling referral, in one transaction, and the server refuses a
 * reactive panel that was not explicitly confirmed here. A saved result is
 * never saved over: it goes as a correction request.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  // Either laboratory section opens the page.
  requires: ['lab.record_serology', 'lab.record_immunohematology'],
})

const route = useRoute()
const { can } = useUser()

const canSeeReferrals = computed(() => can('lab.referrals'))

// Testing works blind, its head included (project owner, 2026-10-25). Every
// donation is taken in through this, so a name the server should not have
// sent is never shown either.
const canViewIdentity = computed(() => can('donors.view_identity'))
const blindFor = (donation) => (donation ? { ...donation, donor: visibleDonor(donation.donor, canViewIdentity.value) } : null)

// The sidebar counts referrals and results waiting for verification; a saved
// result can change both.
const badgeRefresh = useState('blood-center-badge-refresh', () => 0)

// Two departments, one page: TTI Testing records serology, Immunohematology
// types the unit. Each card shows only to the role that records it.
const canSerology = computed(() => can('lab.record_serology'))
// The second person on a reactive result: the Laboratory Supervisor.
const canVerify = computed(() => can('lab.verify_serology'))
const canType = computed(() => can('lab.record_immunohematology'))

// --- which test's queue is on screen (?test=typing | serology) ---
// UI only: the queue is loaded the same way; this narrows what is listed and
// which card comes first. One sidebar link serves both tests, so someone who
// records only one sees that one's queue; someone who records both starts on
// All and picks a view with the switch.
const router = useRouter()

const testView = computed(() => {
  const view = route.query.test
  if (view === 'typing' && canType.value) return 'typing'
  if (view === 'serology' && canSerology.value) return 'serology'
  if (canType.value && !canSerology.value) return 'typing'
  if (canSerology.value && !canType.value) return 'serology'
  return 'all'
})

function setTestView(view) {
  router.replace({ query: { ...route.query, test: view === 'all' ? undefined : view } })
}

const VIEW_COPY = {
  typing: {
    title: 'Immunohematology',
    queueTitle: 'Waiting for typing',
    noun: 'typing',
  },
  serology: {
    title: 'Serology (TTI)',
    queueTitle: 'Waiting for serology',
    noun: 'serology',
  },
  all: {
    title: 'Testing',
    queueTitle: 'Units awaiting testing',
    noun: 'testing',
  },
}
const viewCopy = computed(() => VIEW_COPY[testView.value])

const service = bloodCenterService

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

const needsTyping = (row) => !row.clearances?.immunohematology
const needsSerology = (row) => !row.clearances?.tti

const visibleQueue = computed(() => {
  if (testView.value === 'typing') return queue.value.filter(needsTyping)
  if (testView.value === 'serology') return queue.value.filter(needsSerology)
  return queue.value
})

const viewOptions = computed(() => [
  { value: 'typing', label: 'Typing', count: queue.value.filter(needsTyping).length },
  { value: 'serology', label: 'Serology', count: queue.value.filter(needsSerology).length },
  { value: 'all', label: 'All', count: queue.value.length },
])
const loadingQueue = ref(false)
const barcodeSearch = ref('')
const activeBarcode = ref('')

/**
 * Load the queue. Quiet after a save, with a unit open beside it: the list is
 * brought up to date without blanking to the loading placeholder.
 */
async function loadQueue({ quiet = false } = {}) {
  if (!quiet) loadingQueue.value = true

  try {
    const params = { stage: 'testing' }
    if (activeBarcode.value) params.barcode = activeBarcode.value

    const res = await service.laboratoryQueue(params)

    queue.value = (res?.data ?? []).map(blindFor)
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
async function findByBarcode() {
  error.value = null
  activeBarcode.value = normalizeBarcode(barcodeSearch.value)

  await loadQueue()

  if (activeBarcode.value && queue.value.length === 1) await openDonation(queue.value[0].id)
}

function clearSearch() {
  barcodeSearch.value = ''
  activeBarcode.value = ''
  error.value = null
  loadQueue()
}

// --- one unit ---------------------------------------------------------------

const selected = ref(null)
const benchRef = ref(null)
const readings = reactive(blankPanel())
// ABO and Rh only: no reverse group or antibody screen (project owner, 2026-10-22).
const typingForm = reactive({ blood_type_id: null, notes: '' })

// Nothing more can be recorded on a rejected donation. A cleared result is
// not final here: it can still be corrected while its bags are in quarantine,
// and the server says so if they are not.
const isFinal = computed(() => selected.value?.status === 'rejected')
// Nothing to record into: no unit open yet, or a rejected one. The forms
// still show, so the bench reads the same before a tube is scanned.
const locked = computed(() => !selected.value || isFinal.value)
const isReactive = computed(() => selected.value?.serology?.outcome === 'reactive')
const panelIsComplete = computed(() => panelComplete(readings, markers.value))
const readCount = computed(() => markers.value.filter((m) => readings[m.value]).length)

/** Every marker read as non-reactive: the usual panel, in one click, still a draft. */
function markAllNonReactive() {
  for (const marker of markers.value) readings[marker.value] = 'non_reactive'
}

/** A queue row's state, down its edge: held, waiting on the supervisor, or both cleared. */
function rowTone(row) {
  if (row.immunohematology?.clearance_hold) return 'held'
  if (row.serology?.awaiting_verification) return 'verify'
  if (row.clearances?.immunohematology && row.clearances?.tti) return 'done'
  return 'open'
}
const pendingReactive = computed(() => reactiveMarkers(readings, markers.value))

const initials = computed(() => donorInitials(selected.value?.donor) || '—')

// --- typing -------------------------------------------------------------------

const forwardGroup = computed(() => aboOf(bloodTypeCodeFor(bloodTypes.value, typingForm.blood_type_id)))
const typingComplete = computed(() => Boolean(typingForm.blood_type_id))
const typingHold = computed(() => selected.value?.immunohematology?.clearance_hold ?? null)

// Only a typing saved before the reverse group and antibody screen were dropped
// can still be held for them. Saving the confirmed ABO/Rh over it (a
// correction) records neither, and clears it.
const HOLDS = {
  abo_discrepancy: {
    label: 'ABO discrepancy',
    text: 'Held: forward and reverse grouping disagreed. Resolve it at the bench, then save the confirmed ABO/Rh as a correction.',
  },
  antibody_screen_positive: {
    label: 'Antibody screen positive',
    text: 'Held: the antibody screen was positive. Once the antibody is identified, save the confirmed ABO/Rh as a correction.',
  },
  grouping_incomplete: {
    label: 'Incomplete',
    text: 'Held: the ABO group was not recorded.',
  },
}

const typingHoldLabel = computed(() => HOLDS[typingHold.value]?.label ?? 'Held')
const typingHoldText = computed(() => HOLDS[typingHold.value]?.text ?? 'This typing is held.')

function typingPayload() {
  return {
    blood_type_id: typingForm.blood_type_id,
    forward_group: forwardGroup.value,
    notes: typingForm.notes?.trim() || null,
  }
}

/**
 * A saved typing is never saved over: a change to it becomes a correction
 * request for the Reference Laboratory Consultant.
 */
function requestTypingCorrection() {
  const saved = selected.value?.immunohematology

  if (!saved) return

  correction.value = {
    subject: 'immunohematology',
    changes: typingPayload(),
    previous: {
      blood_type_id: saved.blood_type_id,
      forward_group: saved.forward_group,
      notes: saved.notes,
    },
  }
}

/**
 * Adopt a donation from the server and seed the named forms from what it recorded.
 *
 * Saving one section re-seeds only that section. The other card may hold
 * entries not yet saved, and the response knows nothing of them — re-seeding
 * it would wipe what the technologist just typed.
 *
 * The typing is seeded only from this department's own earlier typing — never
 * from the fingerprick at screening, and never from the donor's profile.
 */
function adopt(payload, sections = ['typing', 'serology']) {
  selected.value = blindFor(payload)

  // Closed: the forms stand empty, never holding the last unit's entries.
  payload ??= {}

  if (sections.includes('typing')) {
    typingForm.blood_type_id = payload.immunohematology?.blood_type_id ?? null
    typingForm.notes = payload.immunohematology?.notes ?? ''
  }

  if (sections.includes('serology')) {
    Object.assign(readings, blankPanel(markers.value))

    for (const marker of payload.serology?.markers ?? []) {
      readings[marker.marker] = marker.result
    }
  }
}

async function openDonation(id) {
  const res = await run(() => service.laboratoryDonation(id))

  if (!res) return

  notice.value = null
  adopt(res.data ?? res)

  // Stacked on a narrow screen, the forms open below the list: bring them up.
  if (window.matchMedia('(max-width: 860px)').matches) {
    nextTick(() => benchRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
}

function backToQueue() {
  adopt(null)
  error.value = null
  notice.value = null
  confirmingReactive.value = false
  loadQueue()
}

const confirmingReactive = ref(false)
const dialogRef = ref(null)

watch(confirmingReactive, (open) => {
  if (open) nextTick(() => dialogRef.value?.focus())
})

// --- the one Save ---------------------------------------------------------------

/*
 * One Save for the card (project owner, 2026-10-22). It records whichever
 * section this person records and has filled in: a first typing, a first
 * serology panel, or both. A change to a saved typing still goes as a
 * correction request, and a saved panel is still changed on Serology Results.
 */
const serologyStarted = computed(() => markers.value.some((marker) => readings[marker.value]))

/** The form no longer matches the saved typing. */
const typingChanged = computed(() => {
  const saved = selected.value?.immunohematology

  if (!saved) return false

  return typingForm.blood_type_id !== saved.blood_type_id
    || (typingForm.notes?.trim() || null) !== (saved.notes || null)
})

const typingToRecord = computed(() => canType.value && !selected.value?.immunohematology && typingComplete.value)
const typingToCorrect = computed(() => canType.value && typingChanged.value && typingComplete.value)
const serologyToRecord = computed(() => canSerology.value && !selected.value?.serology && panelIsComplete.value)
const reactiveToSave = computed(() => serologyToRecord.value && pendingReactive.value.length > 0)

// Begun but not finished. Save waits rather than send half a panel.
const serologyUnfinished = computed(() => canSerology.value && !selected.value?.serology && serologyStarted.value && !panelIsComplete.value)

const canSave = computed(() => !locked.value && !busy.value
  && !serologyUnfinished.value
  && (typingToRecord.value || typingToCorrect.value || serologyToRecord.value))

/** One line beside Save: what it will do, or what it is waiting for. */
const saveHint = computed(() => {
  if (!selected.value) return 'Pick a unit first.'

  if (serologyUnfinished.value) return 'Record a reading for all five markers.'

  const saving = []
  if (typingToRecord.value) saving.push('the typing')
  if (serologyToRecord.value) saving.push('the serology panel')

  const lines = []
  if (saving.length) lines.push(`Saves ${saving.join(' and ')}.`)
  if (reactiveToSave.value) lines.push('You confirm the reactive result first.')
  if (typingToCorrect.value) lines.push('The typing change goes as a correction request.')

  if (lines.length) return lines.join(' ')

  const allSaved = (!canType.value || selected.value.immunohematology) && (!canSerology.value || selected.value.serology)

  return allSaved ? 'Saved.' : 'Enter the results, then save.'
})

function submitResults() {
  if (!canSave.value) return

  // A reactive panel cannot be undone from here, so it is confirmed first.
  if (reactiveToSave.value) {
    confirmingReactive.value = true
    return
  }

  saveResults(false)
}

function confirmReactive() {
  saveResults(true)
}

/**
 * Save each section that is ready, one request each, typing first. A refusal
 * stops there: what was already saved stays saved, and shows as saved.
 */
async function saveResults(confirmedReactive) {
  const typing = typingToRecord.value
  const serology = serologyToRecord.value
  const correcting = typingToCorrect.value
  const messages = []
  let refused = false

  if (typing) {
    const res = await run(() => service.recordImmunohematology(selected.value.id, typingPayload()))

    if (res) {
      adopt(res.data, ['typing'])
      if (res.message) messages.push(res.message)
    } else {
      refused = true
    }
  }

  if (serology && !refused) {
    const res = await saveSerology(confirmedReactive)

    if (res?.message) messages.push(res.message)
    if (!res) refused = true
  }

  confirmingReactive.value = false

  if (messages.length) {
    notice.value = messages.join(' ')
    loadQueue({ quiet: true })
  }

  if (correcting && !refused) requestTypingCorrection()
}

async function saveSerology(confirmed) {
  const panel = serologyPayload(readings, confirmed, markers.value)

  // Recorded once. A saved panel is corrected on Serology Results, never here.
  if (selected.value.serology) return null

  const res = await run(() => service.recordSerology(selected.value.id, panel))

  if (!res) return null

  adopt(res.data, ['serology'])
  badgeRefresh.value++

  return res
}

// --- corrections --------------------------------------------------------------

const correction = ref(null)

async function onCorrectionSent(response) {
  correction.value = null

  // A head's own correction is applied at once: show the donation as it now stands.
  if (response?.data?.status === 'approved' && selected.value) {
    await openDonation(selected.value.id)
    loadQueue({ quiet: true })
  }

  notice.value = response?.message ?? 'Correction requested.'
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
      return 'This donation is rejected, so its serology can no longer be changed.'
    case 'results_cleared':
      return 'This result is already cleared. Request a correction to change it.'
    case 'correction_required':
      return 'This result is already saved. Request a correction to change it.'
    case 'blood_type_mismatch':
      return err?.data?.message || 'This typing disagrees with the donor’s record. Collection must correct it first.'
    case 'donation_not_found':
      return 'That donation was not found at your facility.'
    case 'nothing_to_verify':
      return 'This result is no longer waiting for verification.'
    case 'verification_pending':
      return 'This reactive result is waiting for the Laboratory Supervisor, who verifies it or returns it for re-entry.'
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
  // The results and referrals were tabs here. A notification sent before they
  // moved still links to ?tab=.
  if (route.query.tab === 'results') {
    const outcome = typeof route.query.outcome === 'string' ? `?outcome=${encodeURIComponent(route.query.outcome)}` : ''
    return navigateTo(`/blood-center/serology-results${outcome}`, { replace: true })
  }
  if (route.query.tab === 'referrals') return navigateTo('/blood-center/counselling-referrals', { replace: true })

  await loadReference()
  await loadQueue()

  // Arrived from the Processing page's "Open on the Testing page".
  const linked = Number(route.query.donation)
  if (Number.isInteger(linked) && linked > 0) await openDonation(linked)
})
</script>

<style scoped>
.testing {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
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
  font-size: 11.5px;
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

.testing__facility {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--rb-border);
  border-radius: 999px;
  background: var(--rb-surface);
  font-size: 12.5px;
  color: var(--rb-text-secondary);
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

.card__titles { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }

.card__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }

.card__hint {
  margin: 0;
  max-width: 68ch;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.card__hint--warn { color: var(--rb-warning-text); font-weight: 600; }

.view-switch {
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
}
.view-switch__btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--rb-text-secondary);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.view-switch__btn:hover { color: var(--rb-text-primary); }
.view-switch__btn--on { background: var(--rb-surface); color: var(--rb-primary-text); box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.08); }
.view-switch__btn:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.view-switch__count {
  min-width: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}
.view-switch__btn--on .view-switch__count { background: rgba(var(--rb-primary-rgb), 0.12); }

/*
 * One card, two sections. The grid's 1px gap over a border-coloured
 * background draws the rule between them, whichever comes first. Side by
 * side once the bench, not the window, has room.
 */
.results { gap: 0; padding: 0; overflow: hidden; }

.results__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1px;
  background: var(--rb-border);
}

@container bench (min-width: 720px) {
  .results__grid--pair { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.results__grid--serology-first .results__section--serology { order: -1; }

.results__section {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
  padding: 1.1rem;
  background: var(--rb-surface);
}

.results__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.85rem;
  padding: 0.85rem 1.1rem;
  border-top: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
}

.results__foot .btn { min-width: 7rem; }

/* ===== Refresh (project owner, 2026-10-24) ===== */
.testing__note { display: flex; align-items: flex-start; gap: 6px; max-width: 90ch; margin: 6px 0 0; font-size: 12px; line-height: 1.5; color: var(--rb-text-muted); }
.testing__note :deep(.asset-icon) { flex: none; margin-top: 2px; }

/* Scan: the icon inside, the font of the page until a code is typed. */
.scan { position: relative; align-items: center; }
.scan__icon { position: absolute; left: 12px; color: var(--rb-primary-text); pointer-events: none; }
.scan .field__input { height: 40px; padding-left: 36px; border: 1.5px solid rgba(var(--rb-primary-rgb), 0.35); background: rgba(var(--rb-primary-rgb), 0.04); }
.scan .field__input::placeholder { font-family: var(--rb-font-sans); letter-spacing: 0; }
.scan .field__input:focus-visible { background: var(--rb-surface); }
.scan__go { height: 40px; }

/* Queue rows: their state on the edge. */
.qitem { position: relative; }
.qitem--held { box-shadow: inset 3px 0 0 var(--rb-accent); }
.qitem--verify { box-shadow: inset 3px 0 0 var(--rb-warning); }
.qitem--done { box-shadow: inset 3px 0 0 var(--rb-success); }

/* Serology head: the hint, how much is read, the shortcut. */
.panel-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px 12px; }
.panel-head__count { padding: 3px 10px; border-radius: 999px; background: var(--rb-surface-alt); font-size: 12px; font-weight: 700; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.panel-head__count--done { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.btn--sm { height: 32px; padding: 0 12px; font-size: 12.5px; }

/* Markers: the choice beside the name, as one segmented control. */
.results .panel { border: 1px solid var(--rb-border); border-radius: 12px; overflow: hidden; }
.results .panel .marker { padding: 10px 14px; justify-content: flex-start; gap: 0.5rem 1.25rem; }
.results .panel .marker:nth-child(even) { background: var(--rb-surface-alt); }
.results .panel .marker__name { min-width: 12rem; }
.results .panel .marker__choices { gap: 2px; margin-left: 0; padding: 3px; border: 1px solid var(--rb-border-strong); border-radius: 10px; background: var(--rb-surface); }
.results .panel .choice { gap: 6px; padding: 6px 14px; border: 0; border-radius: 7px; background: transparent; }
.results .panel .choice__icon { opacity: 0.45; }
.results .panel .choice--on .choice__icon { opacity: 1; }
.results .panel .choice--safe { background: var(--rb-success); color: #fff; }
.results .panel .choice--alarm { background: var(--rb-accent); color: #fff; }

/* The Save line stays in reach while a long card scrolls. */
.results__foot { position: sticky; bottom: 0; z-index: 2; border-radius: 0 0 var(--rb-radius-lg, 14px) var(--rb-radius-lg, 14px); box-shadow: 0 -10px 18px -14px rgba(var(--rb-shadow-rgb), 0.35); }

/* ---------- workspace (queue + bench), as on Processing ---------- */
.workspace {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 16px;
  /* The queue runs the full height of the bench beside it, top and bottom
     aligned, up to the height of the screen. */
  align-items: stretch;
}

.queue-panel {
  position: sticky;
  top: 80px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 100px);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
  overflow: hidden;
}
.queue-panel__head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 8px; }
.queue-panel__title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}
.queue-panel__count { padding: 1px 8px; border-radius: 999px; background: var(--rb-surface-alt); color: var(--rb-text-primary); letter-spacing: 0; }
.queue-panel__tools {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 12px 12px;
  border-bottom: 1px solid var(--rb-border);
}

.scan { display: flex; gap: 0.4rem; }
.scan .field__input { flex: 1; min-width: 0; }
.scan__active { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12px; color: var(--rb-text-secondary); }

.link-btn {
  margin-left: auto;
  padding: 0;
  border: 0;
  background: none;
  color: var(--rb-primary-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.link-btn:hover:not(:disabled) { text-decoration: underline; }
.link-btn:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

.qlist { list-style: none; margin: 0; padding: 8px; display: flex; flex-direction: column; gap: 4px; min-height: 0; overflow-y: auto; }
.qitem {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.12s ease, border-color 0.12s ease;
}
.qitem:hover:not(:disabled) { background: var(--rb-surface-hover); }
.qitem:disabled { cursor: progress; }
.qitem:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }
.qitem--on { border-color: rgba(var(--rb-primary-rgb), 0.35); background: rgba(var(--rb-primary-rgb), 0.07); box-shadow: inset 3px 0 0 var(--rb-primary); }
.qitem--skeleton { cursor: default; gap: 8px; }
.qitem__name { font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qitem__meta { font-size: 12px; color: var(--rb-text-secondary); }
.qitem__state { display: flex; flex-wrap: wrap; gap: 0.35rem; }

.queue-empty { display: flex; align-items: flex-start; gap: 10px; margin: 10px 12px 14px; padding: 12px; border-radius: 10px; background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.queue-empty p { margin: 0; font-size: 12.5px; line-height: 1.5; }

.bench {
  container: bench / inline-size;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  scroll-margin-top: 80px;
}
/* The open unit's identity reads as the bench's header, like the cards under it. */
.bench .unit-bar { padding: 14px 16px; border-color: var(--rb-border); border-radius: 14px; background: var(--rb-surface); }

.icon-btn {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--rb-text-secondary);
  cursor: pointer;
}
.icon-btn:hover:not(:disabled) { background: var(--rb-surface-hover); color: var(--rb-text-primary); }
.icon-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.icon-btn:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

.skeleton {
  display: block;
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: testing-shimmer 1.4s ease infinite;
}
.skeleton--line { width: 75%; }
.skeleton--short { width: 45%; }
@keyframes testing-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.spin { animation: testing-spin 0.9s linear infinite; }
@keyframes testing-spin { to { transform: rotate(360deg); } }

@media (max-width: 1100px) {
  .workspace { grid-template-columns: 300px minmax(0, 1fr); }
}

/* Stacked: the list first, kept short, then the open unit under it. */
@media (max-width: 860px) {
  .workspace { grid-template-columns: minmax(0, 1fr); }
  .queue-panel { position: static; max-height: 26rem; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin { animation: none; }
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px dashed var(--rb-border-strong);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
}

.chip--done {
  border-style: solid;
  border-color: transparent;
  background: rgba(var(--rb-success-rgb), 0.12);
  color: var(--rb-success-text);
}

.chip--wait {
  border-style: solid;
  border-color: transparent;
  background: rgba(var(--rb-warning-rgb), 0.14);
  color: var(--rb-warning-text);
}

.chip--alarm {
  border-style: solid;
  border-color: transparent;
  background: rgba(var(--rb-accent-rgb), 0.12);
  color: var(--rb-accent-text);
}

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
  font-size: 13px;
  font-weight: 700;
}

.unit-bar__name { margin: 0; font-weight: 700; font-size: 15px; color: var(--rb-text-primary); }
.unit-bar__sub { margin: 0.1rem 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }

.fact { display: flex; flex-direction: column; gap: 0.25rem; }

.fact__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.fact__value { font-size: 13.5px; color: var(--rb-text-primary); }

.pill {
  display: inline-block;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
  border: 1px solid var(--rb-border);
}

.pill--collected,
.pill--completed { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); border-color: transparent; }
.pill--tested { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); border-color: transparent; }
.pill--waiting { background: rgba(var(--rb-warning-rgb), 0.14); color: var(--rb-warning-text); border-color: transparent; }
.pill--rejected { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); border-color: transparent; }

/* --- sections --- */
.references {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 13px;
  line-height: 1.55;
  color: var(--rb-text-secondary);
}

.references strong { color: var(--rb-text-primary); }
.references .references__warn { color: var(--rb-warning-text); }

.screened { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }

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
  font-size: 14px;
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
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
  user-select: none;
}

fieldset:not(:disabled) .choice:hover { border-color: var(--rb-border-hover); color: var(--rb-text-primary); }

.choice__radio { position: absolute; opacity: 0; pointer-events: none; }

.choice:has(.choice__radio:focus-visible) { outline: 2px solid var(--rb-primary); outline-offset: 1px; }

.choice--safe { background: rgba(var(--rb-success-rgb), 0.12); border-color: var(--rb-success); color: var(--rb-success-text); }
.choice--alarm { background: var(--rb-accent); border-color: var(--rb-accent); color: #fff; }

fieldset:disabled .choice { cursor: not-allowed; opacity: 0.6; }

/* --- forms --- */
.field { display: flex; flex-direction: column; gap: 0.3rem; width: 100%; }
.field__label { font-size: 12px; font-weight: 600; color: var(--rb-text-primary); }
.field__optional { font-weight: 400; color: var(--rb-text-secondary); font-size: 11.5px; }

.field__input {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13.5px;
}

.field__input:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; border-color: var(--rb-primary); }
.field__input:disabled { opacity: 0.6; cursor: not-allowed; }

.mono { font-family: var(--rb-font-mono); letter-spacing: 0.02em; }

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
  font-size: 13.5px;
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
.alert { margin: 0; padding: 0.65rem 0.85rem; border-radius: 10px; font-size: 13.5px; }

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

/* --- a reactive result held for verification --- */
.held {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  border: 1px solid rgba(var(--rb-warning-rgb), 0.4);
  background: rgba(var(--rb-warning-rgb), 0.08);
  color: var(--rb-warning-text);
  font-size: 13px;
  line-height: 1.5;
}

.held p { margin: 0; flex: 1 1 18rem; }

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
  font-size: 16px;
  font-weight: 700;
  color: var(--rb-accent-text);
}

.dialog__body { font-size: 14px; line-height: 1.55; color: var(--rb-text-primary); }

.dialog__body p { margin: 0 0 0.4rem; }
.dialog__body ul { margin: 0 0 0.5rem; padding-left: 1.1rem; }

@media (max-width: 640px) {
  .testing { padding: 16px 16px 32px; }
  .marker__choices { margin-left: 0; }
}

.exam {
  border: 0;
  margin: 0;
  padding: 0;
}
</style>
