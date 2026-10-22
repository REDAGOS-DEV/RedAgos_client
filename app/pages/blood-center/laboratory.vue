<template>
  <div class="laboratory">
    <!--
      Rebuilt from the owner's mock-up (2026-10-22): the list on the left as
      tall as the bench, and the bench always shown — Component separation
      and the rejection — locked until a unit is picked.
    -->
    <!-- No icon, steps or card of Testing's outcome (project owner, 2026-10-22). -->
    <header class="laboratory__header">
      <h1 class="laboratory__title">Processing</h1>
      <p class="laboratory__subtitle">
        Record component separation and prepare units for issuance. A processed unit moves to the Processed list,
        where it is handed over to Issuance.
      </p>
    </header>

    <p v-if="error" class="alert alert--error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="alert alert--notice" role="status">{{ notice }}</p>

    <div class="workspace">
      <aside class="queue-panel" aria-label="Donation units">
        <div class="queue-panel__head">
          <h2 class="queue-panel__title">
            Donation units
            <span class="count">{{ loadingQueue ? '…' : queueTotal }}</span>
          </h2>
          <button
            type="button"
            class="icon-btn"
            :disabled="loadingQueue"
            aria-label="Refresh the list"
            title="Refresh"
            @click="loadQueue"
          >
            <AssetIcon name="refresh-cw" :size="16" :class="{ spin: loadingQueue }" />
          </button>
        </div>

        <!-- The status filter as chips, each with how many units it holds. -->
        <div class="status-chips" role="group" aria-label="Show">
          <button
            v-for="option in STATUS_OPTIONS"
            :key="option.value || 'awaiting'"
            type="button"
            class="status-chip"
            :class="{ 'status-chip--on': statusFilter === option.value }"
            :aria-pressed="statusFilter === option.value"
            :title="option.title"
            @click="setStatusFilter(option.value)"
          >
            {{ option.label }}
            <span class="status-chip__count">{{ counts[option.value] ?? '·' }}</span>
          </button>
        </div>

        <ul v-if="loadingQueue" class="qlist" aria-busy="true">
          <li v-for="n in 4" :key="n" class="qitem qitem--skeleton">
            <span class="skeleton skeleton--line" />
            <span class="skeleton skeleton--short" />
          </li>
        </ul>

        <div v-else-if="!queue.length" class="queue-empty">
          <BagIcon class="queue-empty__icon" />
          <p class="queue-empty__title">{{ statusFilter ? 'Nothing matches this filter' : 'No units awaiting processing' }}</p>
          <p class="queue-empty__text">
            <template v-if="statusFilter">Units show here once they reach this stage. Pick another filter or check back later.</template>
            <template v-else>
              Donations appear here once the counter records a collection. Processed ones are on the
              <NuxtLink to="/blood-center/processed" class="queue-empty__link">Processed list</NuxtLink>.
            </template>
          </p>
        </div>

        <ul v-else class="qlist">
          <li v-for="row in queue" :key="row.id">
            <button
              type="button"
              class="qitem"
              :class="{ 'qitem--on': selected?.id === row.id }"
              :aria-current="selected?.id === row.id ? 'true' : undefined"
              :disabled="busy"
              @click="openDonation(row.id)"
            >
              <span class="qitem__top">
                <span class="qitem__name">{{ donorTitle(row.donor, row.collection?.donation_barcode, row.id) }}</span>
                <span class="pill" :class="pillClass(row.status)">{{ row.status_label }}</span>
              </span>
              <span class="qitem__meta">
                #{{ row.id }} · {{ row.volume_ml ? `${row.volume_ml} mL` : 'volume not recorded' }} · {{ formatDate(row.donation_date) }}
              </span>
              <span class="qitem__next">
                <AssetIcon name="arrow-right" :size="12" />
                {{ nextStepFor(row) }}
              </span>
            </button>
          </li>
        </ul>
      </aside>

      <section class="bench" aria-live="polite">
        <!-- COMPONENT SEPARATION -->
        <section class="card">
          <div class="sep__head">
            <h2 class="card__title">Component separation</h2>

            <div class="picked">
              <span class="picked__icon"><BagIcon class="picked__bag" /></span>
              <div class="picked__text">
                <span class="picked__label">Selected unit</span>
                <span class="picked__value">
                  {{ selected ? donorTitle(selected.donor, selected.collection?.donation_barcode, selected.id) : '—' }}
                  <span v-if="selected" class="picked__meta">
                    · #{{ selected.id }} · {{ selected.volume_ml ? `${selected.volume_ml} mL` : 'volume not recorded' }}
                  </span>
                </span>
              </div>
              <span v-if="selected" class="pill" :class="pillClass(selected.status)">{{ selected.status_label }}</span>
              <button
                v-if="selected"
                type="button"
                class="icon-btn"
                :disabled="busy"
                aria-label="Close this unit"
                title="Close"
                @click="backToQueue"
              >
                <AssetIcon name="x" :size="16" />
              </button>
            </div>
          </div>

          <!-- Terminal: nothing left to record -->
          <div v-if="isFinal" class="outcome" :class="selected.status === 'completed' ? 'outcome--success' : 'outcome--rejected'">
            <AssetIcon :name="selected.status === 'completed' ? 'circle-check-big' : 'circle-alert'" :size="24" />
            <div>
              <p class="outcome__title">{{ selected.status === 'completed' ? 'Processing complete' : 'Donation rejected' }}</p>
              <p class="card__hint">
                <template v-if="selected.status === 'completed'">
                  Handed over with its final labels. Issuance books the bags straight into stock at Stock Intake.
                </template>
                <template v-else>
                  {{ selected.rejection_reason || 'No reason was recorded.' }}
                  This unit can never become stock.
                </template>
              </p>
            </div>
          </div>

          <!--
            A saved breakdown is shown, not edited, here. It is viewed and
            corrected on the Processed list (project owner, 2026-10-19), as a
            saved serology panel is on Serology Results.
          -->
          <template v-if="hasComponents">
            <p class="bags__title">Component bags ({{ selected.components.length }})</p>
            <div class="table-wrap">
              <table class="bag-table">
                <thead>
                  <tr>
                    <th scope="col">Component</th>
                    <th scope="col" class="num">Volume (mL)</th>
                    <th scope="col" class="end">Bag number</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in selected.components" :key="c.id ?? c.component_id">
                    <td>{{ c.component }}</td>
                    <td class="num">{{ bagLabel(c) }}</td>
                    <!-- The number on the bag's Phase 1 label: the sticker plus what it holds. -->
                    <td class="end mono">{{ c.bag_number || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!--
              Phase 1 labelling: what the product is and its number. No blood
              type, no clearance. Phase 2, the final label, is Processing's too
              (project owner, 2026-10-22): once Testing has cleared the unit,
              before the hand-over.
            -->
            <div v-if="!isFinal || phaseOneLabels.length" class="actions">
              <button v-if="phaseOneLabels.length" type="button" class="btn" @click="printBaseLabels">
                <AssetIcon name="file-down" :size="14" />
                Print bag labels (Phase 1)
              </button>
              <button
                v-if="selected.status !== 'rejected'"
                type="button"
                class="btn"
                :class="{ 'btn--primary': cleared && !selected.labelled_at && !isFinal }"
                :disabled="!cleared || busy"
                :title="cleared ? '' : 'Final labels print once Testing has cleared both sections.'"
                @click="printFinal"
              >
                <AssetIcon name="printer" :size="14" />
                {{ selected.labelled_at ? 'Reprint final labels' : 'Print final labels' }}
              </button>
              <NuxtLink v-if="!isFinal" :to="`/blood-center/processed?donation=${selected.id}&open=edit`" class="btn">
                <AssetIcon name="pencil" :size="14" />
                View or edit on the Processed list
              </NuxtLink>
            </div>
            <p v-if="!isFinal" class="card__hint">
              <template v-if="selected.labelled_at">
                Final labels printed {{ formatDate(selected.labelled_at) }}<template v-if="selected.labelled_by"> by {{ selected.labelled_by }}</template>.
                Hand the bags over on the Processed list.
              </template>
              <template v-else-if="cleared">
                Testing has cleared this unit. Print and affix its final labels, then hand it over on the Processed list.
              </template>
              <template v-else>
                Final labels print once Testing has cleared both sections. Until then the bags stay with Processing.
              </template>
            </p>
            <p v-if="!isFinal" class="card__hint">
              Base labels carry the bag number, component and volume, marked "Quarantine, not for issue". A saved
              breakdown changes only through a correction the component technologist approves on the Processed list.
            </p>
          </template>

          <div v-if="isFinal" class="actions">
            <button type="button" class="btn btn--primary" @click="backToQueue">Back to queue</button>
            <!-- Processing does not read inventory (project owner, 2026-10-19): its list says what Issuance booked in. -->
            <NuxtLink v-if="selected.status === 'completed'" :to="`/blood-center/processed?donation=${selected.id}`" class="btn">
              View on the Processed list
            </NuxtLink>
          </div>

          <p v-else-if="!hasComponents && !canRecordComponents" class="card__hint">
            Waiting for the Processing department to record the breakdown.
          </p>

          <!--
            One bag per row, with its volume: two bags of the same component are
            two rows. Locked until a unit is open, so the bench reads the same
            before one is picked.
          -->
          <fieldset v-else-if="!hasComponents" class="bags" :disabled="!selected">
            <div class="entry">
              <label class="field">
                <span class="field__label">Component <span class="req" aria-hidden="true">*</span></span>
                <span class="select">
                  <select v-model.number="draft.component_id" class="field__input">
                    <option :value="null" disabled>Select component</option>
                    <option v-for="c in components" :key="c.id" :value="c.id">{{ c.name }}</option>
                  </select>
                  <AssetIcon name="chevron-down" :size="16" class="select__chevron" />
                </span>
              </label>

              <label class="field">
                <span class="field__label">Volume (mL) <span class="req" aria-hidden="true">*</span></span>
                <input
                  v-model.number="draft.volume_ml"
                  type="number"
                  min="1"
                  max="1000"
                  inputmode="numeric"
                  class="field__input"
                  placeholder="e.g. 250"
                  @keydown.enter.prevent="addBag"
                >
              </label>

              <button
                type="button"
                class="btn btn--soft entry__add"
                :disabled="!isCompleteBag(draft) || componentRows.length >= 10"
                @click="addBag"
              >
                <AssetIcon name="plus" :size="16" />
                Add component bag
              </button>
            </div>

            <p class="bags__title">Added component bags ({{ componentRows.length }})</p>
            <div class="table-wrap">
              <table class="bag-table">
                <thead>
                  <tr>
                    <th scope="col">Component</th>
                    <th scope="col" class="num">Volume (mL)</th>
                    <th scope="col" class="end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, index) in componentRows" :key="index">
                    <td>{{ componentName(row.component_id) }}</td>
                    <td class="num">{{ row.volume_ml }}</td>
                    <td class="end">
                      <button
                        type="button"
                        class="icon-btn icon-btn--danger"
                        aria-label="Remove this bag"
                        title="Remove"
                        @click="componentRows.splice(index, 1)"
                      >
                        <AssetIcon name="trash-2" :size="15" />
                      </button>
                    </td>
                  </tr>
                  <tr v-if="!componentRows.length">
                    <td colspan="3">
                      <div class="bag-table__empty">
                        <BagIcon class="bag-table__icon" />
                        <p class="bag-table__empty-title">No component bags added yet.</p>
                        <p>Add a component and volume to continue.</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Information only: nothing here decides what a bag should hold. -->
            <p v-if="declaredVolume > 0" class="card__hint">
              {{ declaredVolume }} mL across {{ componentRows.length }} bag(s)<template v-if="selected?.volume_ml">.
                {{ selected.volume_ml }} mL was collected</template>.
            </p>

            <button
              type="button"
              class="btn btn--primary btn--block"
              :disabled="busy || !validComponents"
              @click="submitComponents"
            >
              <AssetIcon name="file-text" :size="16" />
              Record components
            </button>
          </fieldset>
        </section>

        <!--
          THE HAND-OVER is on the Processed list (project owner, 2026-10-19),
          where a unit waits once its breakdown is recorded, and so are its
          final labels once testing has cleared the donation (project owner,
          2026-10-22). The bench offers them too, for a unit opened from there.

          A unit that cannot be separated never reaches the Processed list, so
          it is rejected here.
        -->
        <section v-if="!hasComponents && canUpdateStatus && !isFinal" class="card reject">
          <span class="reject__icon"><AssetIcon name="triangle-alert" :size="22" /></span>
          <div class="reject__body">
            <h2 class="reject__title">Cannot process this unit?</h2>
            <p class="reject__text">
              If the unit is damaged, hemolyzed or clotted, it cannot be separated.<br>
              It is marked as rejected and can never become stock.
            </p>

            <div v-if="rejecting" class="defer">
              <label class="field">
                <span class="field__label">Why is this unit not being issued?</span>
                <input v-model="rejectReason" type="text" class="field__input" placeholder="Recorded on the donation" >
              </label>
              <div class="actions">
                <button type="button" class="btn btn--danger" :disabled="busy || !rejectReason.trim()" @click="submitReject">
                  {{ busy ? 'Saving…' : 'Confirm rejection' }}
                </button>
                <button type="button" class="btn" :disabled="busy" @click="rejecting = false">Cancel</button>
              </div>
            </div>

            <div v-else class="actions">
              <button type="button" class="btn btn--danger" :disabled="busy || !selected" @click="rejecting = true">
                <AssetIcon name="trash-2" :size="15" />
                Reject unit
              </button>
            </div>
          </div>
        </section>
      </section>
    </div>

    <BloodCenterBagLabelSheet />
  </div>
</template>

<script setup>
import { h } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import BloodCenterBagLabelSheet from '~/components/BloodCenter/BagLabelSheet.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { donorTitle } from '~/utils/donorLabel'
import { baseLabelsFrom, finalLabelsFrom } from '~/utils/bagLabels'

/**
 * The Processing department's side of a donation.
 *
 * The counter leaves every donation at `collected`; the Testing department
 * records immunohematology and serology on its own page, and a donation that
 * passes both becomes `tested`. Processing records the breakdown here; from
 * there `completed` — handed over to Issuance — is Processing's to set, on the
 * Processed list (pages/blood-center/processed.vue, project owner
 * 2026-10-19), where a processed unit waits. Testing's results are not shown
 * here (project owner, 2026-10-22); the list's next step still says whether
 * Testing is outstanding. Everything on this page is a record of what a medical
 * technologist found at the bench — nothing here performs or interprets a test.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'lab.record_components',
})

const { can } = useUser()
const route = useRoute()

// The sidebar counts units waiting for their hand-over; recording a breakdown adds one.
const badgeRefresh = useState('blood-center-badge-refresh', () => 0)

// Processing records the breakdown and makes the final call.
const canRecordComponents = computed(() => can('lab.record_components'))
const canUpdateStatus = computed(() => can('lab.update_status'))

/** A blood bag, drawn here: the icon set has none. Sized by the class it is given. */
const BagIcon = () => h('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.6,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
}, [
  h('path', { d: 'M10 2h4M12 2v3M12 19v3' }),
  h('rect', { x: 6, y: 5, width: 12, height: 14, rx: 3 }),
  h('path', { d: 'M12 9.5c1.3 1.6 2 2.6 2 3.5a2 2 0 0 1-4 0c0-.9.7-1.9 2-3.5z' }),
])

const service = bloodCenterService

const queue = ref([])
const queueTotal = ref(0)
const selected = ref(null)
const components = ref([])

// Empty means Processing's own working queue: drawn donations with no
// breakdown yet (stage=processing). A processed one waits on the Processed list.
const statusFilter = ref('')

// The filter as chips. Picking one reloads the list.
const STATUS_OPTIONS = [
  { value: '', label: 'Awaiting', title: 'Not yet processed' },
  { value: 'collected', label: 'With testing', title: 'With Testing, not yet tested' },
  { value: 'tested', label: 'Ready', title: 'Tested, ready for processing' },
  { value: 'completed', label: 'Handed over', title: 'Handed over to Issuance' },
  { value: 'rejected', label: 'Rejected', title: 'Rejected' },
]

/** The queue's query for one chip. */
function queueParams(value) {
  return value ? { status: value } : { stage: 'processing' }
}

// How many units each chip holds, keyed by its value. Read from each list's
// paginated total, one row asked for, so the server needs no new count.
const counts = ref({})

function setStatusFilter(value) {
  if (statusFilter.value === value) return
  statusFilter.value = value
  loadQueue()
}
const loadingQueue = ref(false)
const busy = ref(false)
const error = ref(null)
const notice = ref(null)
const rejecting = ref(false)
const rejectReason = ref('')

// The bag being entered, and the bags added so far: one row per bag, with its
// volume. Two bags of the same component are two rows; inventory books in
// exactly one unit per row.
const draft = reactive({ component_id: null, volume_ml: null })
const componentRows = ref([])

function isCompleteBag(row) {
  const volume = Number(row.volume_ml)

  return Boolean(row.component_id) && Number.isInteger(volume) && volume >= 1 && volume <= 1000
}

function addBag() {
  if (!isCompleteBag(draft) || componentRows.value.length >= 10) return

  componentRows.value.push({ component_id: draft.component_id, volume_ml: Number(draft.volume_ml) })
  draft.component_id = null
  draft.volume_ml = null
}

function componentName(id) {
  return components.value.find((c) => c.id === id)?.name ?? '—'
}

/** The total declared across the added bags, shown beside the collected volume. */
const declaredVolume = computed(() => componentRows.value
  .filter(isCompleteBag)
  .reduce((sum, row) => sum + Number(row.volume_ml), 0))

/** How a recorded bag reads. A breakdown from before volumes were kept shows its count. */
function bagLabel(bag) {
  if (bag.volume_ml) return `${bag.volume_ml}`

  return `${bag.quantity} unit${bag.quantity === 1 ? '' : 's'}`
}

// Phase 1 labelling: the base label for each numbered bag. The final label,
// with the blood type, follows once testing clears the bags (printFinal).
const { print: printLabels } = useLabelPrint()
const phaseOneLabels = computed(() => baseLabelsFrom(selected.value))

function printBaseLabels() {
  printLabels(phaseOneLabels.value, 'base')
}

// Phase 2, the final label, once Testing has cleared both sections. Printing
// records who labelled the bags, which the hand-over needs, so the unit is
// read again after.
const cleared = computed(() => Boolean(selected.value?.clearances?.tti && selected.value?.clearances?.immunohematology))

async function printFinal() {
  const id = selected.value?.id
  if (!id || !cleared.value) return

  const res = await run(() => service.printFinalLabels(id))
  if (!res) return

  const labels = finalLabelsFrom(res)
  if (labels.length) await printLabels(labels, 'final')

  const fresh = await run(() => service.laboratoryDonation(id))
  if (fresh) adopt(fresh.data ?? fresh)
  notice.value = res.message ?? null
}

const hasComponents = computed(() => Boolean(selected.value?.components?.length))
const isFinal = computed(() => ['completed', 'rejected'].includes(selected.value?.status))

// Every row complete, not just one: a half-filled row would otherwise be
// dropped silently, and a bag would go unrecorded.
const validComponents = computed(() => componentRows.value.length > 0
  && componentRows.value.every(isCompleteBag))

function pillClass(status) {
  return status ? `pill--${status}` : ''
}

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * The one line a technologist scanning the queue actually needs.
 */
function nextStepFor(row) {
  if (row.status === 'completed') return 'Handed over'
  if (row.status === 'rejected') return row.rejection_reason || 'Rejected'
  if (row.test_result?.is_legacy) return 'Needs serology from Testing'
  if (row.test_result && !row.test_result.clears_for_issue) return 'Needs rejecting'

  // Either branch may be outstanding, and in any order — neither is "next"
  // ahead of the other.
  const outstanding = []

  if (!row.test_result) outstanding.push('testing')
  if (!row.components?.length) outstanding.push('processing')

  return outstanding.length ? `Needs ${outstanding.join(' and ')}` : 'Hand over on the Processed list'
}

/**
 * Turn a server refusal into something a technologist can act on.
 */
function messageFor(err) {
  switch (err?.data?.code) {
    case 'donation_not_collected':
      return 'The counter has not finished with this donation yet.'
    case 'donation_not_tested':
    case 'result_missing':
      return 'The Testing department has not finished immunohematology and serology for this unit.'
    case 'serology_not_recorded':
      return 'This unit has no five-marker serology panel. The Testing department must record it first.'
    case 'immunohematology_not_recorded':
      return 'This unit has no blood typing recorded. The Testing department must record it first.'
    case 'results_locked':
      return 'This donation is final, so its test results can no longer change.'
    case 'result_not_passed':
      return 'Only a passed result can be cleared for issue. Reject this unit instead.'
    case 'components_missing':
      return 'Record the component breakdown before clearing this unit for issue.'
    case 'units_already_recorded':
      return 'Inventory has already recorded units for this donation, so the breakdown is fixed.'
    case 'blood_type_mismatch':
      return err?.data?.message || 'This type disagrees with the donor’s profile. Collection must correct it.'
    case 'donation_already_final':
      return 'This donation has already been cleared or rejected.'
    case 'tti_not_cleared':
    case 'immunohematology_not_cleared':
      return 'Testing has not cleared both sections yet, so the bags cannot be labelled.'
    // The server's own words name the component or the fix.
    case 'shelf_life_missing':
    case 'barcode_missing':
    case 'bags_unnumbered':
    case 'donor_blood_type_missing':
      return err?.data?.message || 'These bags cannot be labelled yet.'
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

/** Each chip's count. A count that fails to load shows a dot, not a wrong number. */
async function loadCounts() {
  const results = await Promise.allSettled(
    STATUS_OPTIONS.map((option) => service.laboratoryQueue({ ...queueParams(option.value), per_page: 1 })),
  )

  const next = {}
  STATUS_OPTIONS.forEach((option, index) => {
    const total = results[index].status === 'fulfilled' ? results[index].value?.total : undefined
    if (Number.isInteger(total)) next[option.value] = total
  })

  counts.value = next
}

async function loadQueue() {
  loadingQueue.value = true
  error.value = null
  loadCounts()

  try {
    const res = await service.laboratoryQueue(queueParams(statusFilter.value))

    queue.value = res?.data ?? []
    queueTotal.value = Number.isInteger(res?.total) ? res.total : queue.value.length
  } catch (err) {
    error.value = messageFor(err)
  } finally {
    loadingQueue.value = false
  }
}

async function loadReference() {
  try {
    const res = await service.referenceData()

    components.value = res?.components ?? []
  } catch {
    // The page still works for reading the queue; the select simply stays
    // empty and the record button cannot be satisfied.
    error.value = 'Reference data could not be loaded, so components are unavailable.'
  }
}

/**
 * Adopt a donation returned by the server, and re-seed the forms from it.
 */
function adopt(payload) {
  selected.value = payload ?? null
  rejecting.value = false
  rejectReason.value = ''

  // The form is for a first breakdown only: a saved one is corrected on the
  // Processed list.
  componentRows.value = []
  draft.component_id = null
  draft.volume_ml = null
}

async function openDonation(id) {
  // GET /laboratory/donations/{id} returns the donation itself, where the
  // write endpoints return it under `data` alongside a message. Unwrapping
  // here keeps every other caller reading the same shape.
  const res = await run(() => service.laboratoryDonation(id))

  if (!res) return

  notice.value = null
  adopt(res.data ?? res)
}

function backToQueue() {
  // Clears the bags too: the locked form shows empty, not the last unit's.
  adopt(null)
  error.value = null
  notice.value = null
  loadQueue()
}

async function submitComponents() {
  const payload = componentRows.value
    .filter(isCompleteBag)
    .map((row) => ({ component_id: row.component_id, volume_ml: Number(row.volume_ml) }))

  const res = await run(() => service.declareComponents(selected.value.id, { components: payload }))

  if (!res) return

  adopt(res.data)
  notice.value = res.message ?? null

  // Processed: it leaves this queue for the Processed list, and the sidebar
  // counts one more unit waiting for its hand-over.
  badgeRefresh.value++
  loadQueue()
}

async function submitReject() {
  const res = await run(() => service.updateLaboratoryStatus(selected.value.id, {
    status: 'rejected',
    rejection_reason: rejectReason.value.trim(),
  }))

  if (!res) return

  adopt(res.data)
  notice.value = res.message ?? null
  loadQueue()
}

onMounted(async () => {
  await loadReference()
  await loadQueue()

  // ?donation= from the Processed list: a processed unit is off the queue, but
  // its breakdown is viewed and its labels reprinted here.
  const wanted = Number(route.query.donation)
  if (Number.isInteger(wanted) && wanted > 0) await openDonation(wanted)
})
</script>

<style scoped>
.laboratory {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  background: var(--rb-page-bg);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.laboratory__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--rb-text-primary);
}

.laboratory__subtitle {
  margin: 4px 0 0;
  max-width: 68ch;
  font-size: 13.5px;
  color: var(--rb-text-secondary);
}

/* ---------- workspace: the list as tall as the bench ---------- */
.workspace {
  display: grid;
  grid-template-columns: 380px minmax(0, 1fr);
  gap: 24px;
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

.queue-panel__head { display: flex; align-items: center; justify-content: space-between; padding: 18px 18px 12px; }
.queue-panel__title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.count {
  padding: 1px 9px;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.status-chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 18px 16px; border-bottom: 1px solid var(--rb-border); }
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px 5px 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 999px;
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.status-chip:hover { color: var(--rb-text-primary); border-color: var(--rb-border-hover); }
.status-chip--on { border-color: rgba(var(--rb-success-rgb), 0.55); background: rgba(var(--rb-success-rgb), 0.1); color: var(--rb-success-text); }
.status-chip:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.status-chip__count {
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  color: var(--rb-text-primary);
  font-size: 11.5px;
  text-align: center;
}
.status-chip--on .status-chip__count { background: rgba(var(--rb-success-rgb), 0.16); color: var(--rb-success-text); }

.qlist { list-style: none; margin: 0; padding: 10px; display: flex; flex-direction: column; gap: 4px; min-height: 0; overflow-y: auto; }
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
.qitem:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }
.qitem--on { border-color: rgba(var(--rb-primary-rgb), 0.35); background: rgba(var(--rb-primary-rgb), 0.07); box-shadow: inset 3px 0 0 var(--rb-primary); }
.qitem--skeleton { cursor: default; gap: 8px; }
.qitem__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.qitem__name { font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qitem__meta { font-size: 12px; color: var(--rb-text-secondary); }
.qitem__next { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--rb-primary-text); }

/* Nothing listed: centred in the panel, a little above the middle. */
.queue-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 32px 120px;
  text-align: center;
}
.queue-empty__icon { width: 72px; height: 72px; margin-bottom: 18px; color: var(--rb-text-secondary); }
.queue-empty__title { margin: 0; font-size: 16px; font-weight: 700; color: var(--rb-text-primary); }
.queue-empty__text { margin: 0; max-width: 34ch; font-size: 13px; line-height: 1.55; color: var(--rb-text-secondary); }
.queue-empty__link { color: var(--rb-primary-text); font-weight: 600; }

/* ---------- bench ---------- */
.bench {
  container: bench / inline-size;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px;
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
}

.card__head { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
.card__title { margin: 0; font-size: 17px; font-weight: 700; color: var(--rb-text-primary); }

.card__hint {
  margin: 0;
  max-width: 80ch;
  font-size: 13px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}
/* Component separation */
.sep__head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-top: -6px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--rb-border);
}

.picked {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 200px;
  min-height: 36px;
  padding: 3px 6px 3px 0;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface-alt);
}
.picked__icon { display: grid; place-items: center; align-self: stretch; padding: 0 10px; border-right: 1px solid var(--rb-border); color: var(--rb-text-secondary); }
.picked__bag { width: 20px; height: 20px; }
.picked__text { display: flex; flex-direction: column; gap: 0; min-width: 0; flex: 1; line-height: 1.3; }
.picked__label { font-size: 11px; color: var(--rb-text-secondary); }
.picked__value { font-size: 13px; font-weight: 700; color: var(--rb-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.picked__meta { font-weight: 400; font-size: 12px; color: var(--rb-text-secondary); }

/* The bag form; a fieldset so that no unit open disables all of it at once. */
.bags {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.entry {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-items: end;
}
@container bench (min-width: 720px) {
  .entry { grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr) auto; gap: 14px; }
  .entry__add { margin-left: 36px; }
}

.bags__title { margin: 2px 0 -6px; font-size: 13.5px; font-weight: 600; color: var(--rb-text-primary); }

.table-wrap { overflow-x: auto; border: 1px solid var(--rb-border); border-radius: 10px; }
.bag-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.bag-table th {
  padding: 10px 16px;
  border-bottom: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  color: var(--rb-text-secondary);
}
.bag-table td { padding: 8px 16px; border-top: 1px solid var(--rb-border); color: var(--rb-text-primary); }
.bag-table tbody tr:first-child td { border-top: 0; }
.bag-table .num { text-align: center; }
.bag-table .end { text-align: right; }
.bag-table td.end .icon-btn { margin-left: auto; }

.bag-table__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 0 4px;
  text-align: center;
  font-size: 12px;
  color: var(--rb-text-secondary);
}
.bag-table__empty p { margin: 0; }
.bag-table__icon { width: 22px; height: 22px; margin-bottom: 6px; }
.bag-table__empty-title { color: var(--rb-text-primary); }

/* Cannot process: tinted, so it never reads as part of the separation form. */
.reject {
  flex-direction: row;
  align-items: flex-start;
  gap: 18px;
  border-color: rgba(var(--rb-accent-rgb), 0.45);
  background: rgba(var(--rb-accent-rgb), 0.07);
}
.reject__icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 999px;
  background: rgba(var(--rb-accent-rgb), 0.18);
  color: var(--rb-accent-text);
  flex-shrink: 0;
}
.reject__body { display: flex; flex-direction: column; gap: 12px; min-width: 0; flex: 1; }
.reject__title { margin: 0; font-size: 16px; font-weight: 700; color: var(--rb-text-primary); }
.reject__text { margin: -6px 0 0; max-width: 80ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

.defer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 10px;
  background: var(--rb-surface);
}

.outcome { display: flex; align-items: flex-start; gap: 12px; }
.outcome--success { color: var(--rb-success-text); }
.outcome--rejected { color: var(--rb-accent-text); }
.outcome__title { margin: 0 0 2px; font-size: 14.5px; font-weight: 700; color: var(--rb-text-primary); }

/* ---------- shared bits ---------- */
.mono { font-family: var(--rb-font-mono); letter-spacing: 0.02em; }

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

.pill--collected { background: rgba(var(--rb-warning-rgb), 0.12); color: var(--rb-warning-text); border-color: transparent; }
.pill--tested { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); border-color: transparent; }
.pill--completed { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); border-color: transparent; }
.pill--rejected { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); border-color: transparent; }

.field { display: flex; flex-direction: column; gap: 6px; width: 100%; min-width: 0; }
.field__label { font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.req { color: var(--rb-accent-text); }

.field__input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13.5px;
}
.field__input:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 1px;
  border-color: var(--rb-primary);
}
.field__input:disabled { opacity: 0.6; cursor: not-allowed; }

/* A select with the set's chevron, not the browser's. */
.select { position: relative; display: block; }
.select .field__input { appearance: none; padding-right: 36px; }
.select__chevron { position: absolute; top: 50%; right: 12px; transform: translateY(-50%); pointer-events: none; color: var(--rb-text-secondary); }

.actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  border-radius: 8px;
  padding: 0 16px;
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.btn--link { align-self: flex-start; }
.btn--block { width: 100%; height: 42px; }

.btn--soft { background: var(--rb-surface-hover); border-color: var(--rb-border); }
.btn--soft:disabled { opacity: 0.75; color: var(--rb-text-secondary); }

.btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--rb-primary) 88%, #000);
  border-color: color-mix(in srgb, var(--rb-primary) 88%, #000);
}
/* Muted, not faded: a locked Record reads as waiting, as on the mock-up. */
.btn--primary:disabled {
  opacity: 1;
  background: color-mix(in srgb, var(--rb-primary) 28%, var(--rb-surface));
  border-color: transparent;
  color: var(--rb-text-secondary);
}

.btn--danger { background: var(--rb-accent); border-color: var(--rb-accent); color: #fff; }
.btn--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--rb-accent) 88%, #000);
  border-color: color-mix(in srgb, var(--rb-accent) 88%, #000);
}

.alert {
  margin: 0;
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  font-size: 13.5px;
}

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
.icon-btn--danger:hover:not(:disabled) { color: var(--rb-accent-text); }

.skeleton {
  display: block;
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: lab-shimmer 1.4s ease infinite;
}
.skeleton--line { width: 75%; }
.skeleton--short { width: 45%; }
@keyframes lab-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.spin { animation: lab-spin 0.9s linear infinite; }
@keyframes lab-spin { to { transform: rotate(360deg); } }

@media (max-width: 1280px) {
  .workspace { grid-template-columns: 330px minmax(0, 1fr); }
}

@media (max-width: 1100px) {
  .workspace { grid-template-columns: 300px minmax(0, 1fr); gap: 16px; }
}

/* Stacked: the list first, kept short, then the bench under it. */
@media (max-width: 860px) {
  .workspace { grid-template-columns: minmax(0, 1fr); }
  .queue-panel { position: static; max-height: 26rem; }
  .queue-empty { padding: 32px 24px; }
}

@media (max-width: 640px) {
  .laboratory { padding: 16px 16px 32px; }
  .reject { flex-direction: column; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin { animation: none; }
}
</style>
