<template>
  <div class="laboratory">
    <!--
      Rebuilt from the owner's mock-up (2026-10-22): the list on the left as
      tall as the bench, and the bench always shown — Component separation
      and the rejection — locked until a unit is picked.
    -->
    <!-- No icon, steps or card of Testing's outcome (project owner, 2026-10-22). -->
    <header class="laboratory__header">
      <h1 class="laboratory__title">Component Processing</h1>
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

        <!-- Scan a bag's barcode to open its unit; typing narrows the list (2026-10-28). -->
        <form class="scan" role="search" @submit.prevent="scanOpen">
          <AssetIcon name="scan-line" :size="16" class="scan__icon" />
          <input
            ref="scanInput"
            v-model.trim="scanQuery"
            type="search"
            class="scan__input"
            placeholder="Scan or type a barcode"
            aria-label="Scan or type a donation barcode"
            autocomplete="off"
          >
          <kbd v-if="!scanQuery" class="scan__kbd" aria-hidden="true">/</kbd>
        </form>
        <p v-if="scanMiss" class="scan__miss" role="status">No unit with barcode {{ scanMiss }}.</p>

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

        <div v-else-if="!queue.length" class="queue-empty" :class="{ 'queue-empty--clear': !statusFilter }">
          <span v-if="!statusFilter" class="queue-empty__badge" aria-hidden="true"><AssetIcon name="check-check" :size="26" /></span>
          <BagIcon v-else class="queue-empty__icon" />
          <p class="queue-empty__title">{{ statusFilter ? 'Nothing matches this filter' : 'All caught up' }}</p>
          <p class="queue-empty__text">
            <template v-if="statusFilter">Units show here once they reach this stage. Pick another filter or check back later.</template>
            <template v-else>
              No unit is waiting to be separated. New donations appear here once the counter records a collection. Processed ones are on the
              <NuxtLink to="/blood-center/processed" class="queue-empty__link">Processed list</NuxtLink>.
            </template>
          </p>
        </div>

        <p v-else-if="!shownQueue.length" class="queue-empty queue-empty--search">
          No unit on this list matches “{{ scanQuery }}”. Press Enter to look it up by barcode.
        </p>

        <ul v-else class="qlist">
          <li v-for="row in shownQueue" :key="row.id">
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
                <span v-if="!['completed', 'rejected'].includes(row.status)" class="age" :class="`age--${ageTone(row)}`" :title="`Drawn ${formatDate(drawnAt(row))}`">
                  <AssetIcon name="clock" :size="11" />
                  {{ ageText(row) }}
                </span>
                <span v-else class="pill" :class="pillClass(row.status)">{{ row.status_label }}</span>
              </span>
              <span class="qitem__meta">
                #{{ row.id }} · {{ row.volume_ml ? `${row.volume_ml} mL` : 'volume not recorded' }} · {{ formatDate(row.donation_date) }}
              </span>
              <span v-if="!['completed', 'rejected'].includes(row.status)" class="checks">
                <span class="check" :class="`check--${row.components?.length ? 'done' : 'todo'}`">
                  <AssetIcon :name="row.components?.length ? 'check' : 'circle'" :size="11" />
                  Separated
                </span>
                <span class="check" :class="`check--${testingState(row)}`">
                  <AssetIcon :name="testingState(row) === 'done' ? 'check' : testingState(row) === 'fail' ? 'x' : 'clock'" :size="11" />
                  Testing
                </span>
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
        <!-- COMPONENT SEPARATION. Ctrl+Enter records the bags added (2026-10-28). -->
        <section class="card" @keydown.ctrl.enter.prevent="recordByKey" @keydown.meta.enter.prevent="recordByKey">
          <div class="sep__head">
            <h2 class="card__title">Component separation</h2>

            <div class="picked" :class="{ 'picked--empty': !selected }">
              <span class="picked__icon"><BagIcon class="picked__bag" /></span>
              <div class="picked__text">
                <span class="picked__label">{{ selected ? 'Selected unit' : 'No unit open' }}</span>
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

          <!-- Where this unit is on the bench, in the dashboard's order (2026-10-28). -->
          <ol v-if="selected && selected.status !== 'rejected'" class="unit-steps" aria-label="This unit's steps">
            <li
              v-for="(step, i) in unitSteps"
              :key="step.key"
              class="unit-step"
              :class="`unit-step--${step.state}`"
              :aria-current="step.state === 'now' ? 'step' : undefined"
            >
              <span class="unit-step__dot" aria-hidden="true">
                <AssetIcon v-if="step.state === 'done'" name="check" :size="12" />
                <template v-else>{{ i + 1 }}</template>
              </span>
              <span class="unit-step__label">{{ step.label }}</span>
            </li>
          </ol>

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
            <!-- The usual components one click away; the list holds them all. -->
            <div v-if="components.length" class="quick" role="group" aria-label="Pick a component">
              <button
                v-for="c in components"
                :key="c.id"
                type="button"
                class="quick__chip"
                :class="[`comp--${componentTone(c.name)}`, { 'quick__chip--on': draft.component_id === c.id }]"
                :aria-pressed="draft.component_id === c.id"
                @click="pickComponent(c.id)"
              >
                <span class="quick__swatch" aria-hidden="true" />
                {{ c.name }}
              </button>
            </div>

            <div class="entry">
              <label class="field">
                <span class="field__label">Component <span class="req" aria-hidden="true">*</span></span>
                <span class="select">
                  <SelectField v-model="draft.component_id" placeholder="Select component" aria-label="Component"
                    :options="components.map(c => ({ value: c.id, label: c.name }))" />
                  <AssetIcon name="chevron-down" :size="16" class="select__chevron" />
                </span>
              </label>

              <label class="field">
                <span class="field__label">Volume (mL) <span class="req" aria-hidden="true">*</span></span>
                <input
                  ref="volumeInput"
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
            <div v-if="declaredVolume > 0" class="meter">
              <p class="card__hint">
                {{ declaredVolume }} mL across {{ componentRows.length }} bag(s)<template v-if="selected?.volume_ml">.
                  {{ selected.volume_ml }} mL was collected</template>.
              </p>
              <span v-if="selected?.volume_ml" class="meter__track" aria-hidden="true">
                <span class="meter__fill" :style="{ width: `${Math.min(100, (declaredVolume / selected.volume_ml) * 100)}%` }" />
              </span>
            </div>

            <button
              type="button"
              class="btn btn--primary btn--block"
              :disabled="busy || !validComponents"
              @click="submitComponents"
            >
              <AssetIcon name="file-text" :size="16" />
              Record components
              <kbd class="btn-kbd" aria-hidden="true">Ctrl ↵</kbd>
            </button>
          </fieldset>

          <!-- What comes next, one click away (2026-10-28). -->
          <div v-if="selected && nextUnit" class="up-next">
            <span class="up-next__label">Up next</span>
            <span class="up-next__name">{{ donorTitle(nextUnit.donor, nextUnit.collection?.donation_barcode, nextUnit.id) }}</span>
            <span class="age" :class="`age--${ageTone(nextUnit)}`"><AssetIcon name="clock" :size="11" />{{ ageText(nextUnit) }}</span>
            <button type="button" class="btn btn--sm up-next__btn" :class="{ 'btn--primary': hasComponents && !isFinal }" :disabled="busy" @click="openNext">
              Next unit
              <AssetIcon name="arrow-right" :size="14" />
            </button>
          </div>
        </section>

        <!--
          THE HAND-OVER is on the Processed list (project owner, 2026-10-19),
          where a unit waits once its breakdown is recorded, and so are its
          final labels once testing has cleared the donation (project owner,
          2026-10-22). The bench offers them too, for a unit opened from there.

          A unit that cannot be separated never reaches the Processed list, so
          it is rejected here.
        -->
        <section v-if="!hasComponents && canUpdateStatus && !isFinal" class="reject" :class="{ 'reject--open': rejecting }">
          <div class="reject__row">
            <AssetIcon name="triangle-alert" :size="16" class="reject__icon" />
            <div class="reject__body">
              <h2 class="reject__title">Cannot process this unit?</h2>
            </div>
            <button v-if="!rejecting" type="button" class="btn btn--danger-outline" :disabled="busy || !selected" @click="startReject">
              <AssetIcon name="trash-2" :size="15" />
              Reject unit
            </button>
          </div>

          <div v-if="rejecting" class="defer">
            <div class="reasons" role="group" aria-label="Common reasons">
              <button
                v-for="reason in REJECT_REASONS"
                :key="reason"
                type="button"
                class="reasons__chip"
                :class="{ 'reasons__chip--on': rejectReason === reason }"
                :aria-pressed="rejectReason === reason"
                @click="rejectReason = reason"
              >
                {{ reason }}
              </button>
            </div>
            <label class="field">
              <span class="field__label">Why is this unit not being issued?</span>
              <input ref="rejectInput" v-model="rejectReason" type="text" class="field__input" placeholder="Recorded on the donation">
            </label>
            <div class="actions">
              <button type="button" class="btn btn--danger" :disabled="busy || !rejectReason.trim()" @click="submitReject">
                {{ busy ? 'Saving…' : 'Confirm rejection' }}
              </button>
              <button type="button" class="btn" :disabled="busy" @click="rejecting = false">Cancel</button>
            </div>
          </div>
        </section>
      </section>
    </div>

    <BloodCenterBagLabelSheet />
  </div>
</template>

<script setup>
import { h, nextTick, onBeforeUnmount } from 'vue'
import SelectField from '~/components/common/SelectField.vue'
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
const rejectInput = ref(null)

// The usual reasons, one click away; the field still takes any other.
const REJECT_REASONS = ['Damaged bag', 'Hemolyzed', 'Clotted', 'Underweight unit']

function startReject() {
  rejecting.value = true
  nextTick(() => rejectInput.value?.focus())
}

// ── Scan or search the queue (2026-10-28) ──
const scanQuery = ref('')
const scanMiss = ref('')
const scanInput = ref(null)

const shownQueue = computed(() => {
  const q = scanQuery.value.toLowerCase()
  if (!q) return queue.value
  return queue.value.filter((row) => String(row.collection?.donation_barcode ?? '').toLowerCase().includes(q) || String(row.id) === q)
})

/** Enter: one match on the list opens it; otherwise the barcode is looked up at any stage. */
async function scanOpen() {
  const q = scanQuery.value
  scanMiss.value = ''
  if (!q) return
  if (shownQueue.value.length === 1) {
    await openDonation(shownQueue.value[0].id)
    scanQuery.value = ''
    return
  }
  const res = await run(() => service.laboratoryQueue({ barcode: q, per_page: 1 }))
  const hit = res?.data?.[0]
  if (hit) {
    await openDonation(hit.id)
    scanQuery.value = ''
  } else if (res) {
    scanMiss.value = q
  }
}

// "/" puts the cursor in the scan box, as at the Billing Counter.
function onSlash(e) {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable
  if (e.key === '/' && !typing) {
    e.preventDefault()
    scanInput.value?.focus()
  }
}
onMounted(() => window.addEventListener('keydown', onSlash))
onBeforeUnmount(() => window.removeEventListener('keydown', onSlash))

// ── How long a unit has waited since its draw ──
const drawnAt = (row) => row.collection?.ended_at || row.collection?.started_at || row.donation_date
function ageHours(row) {
  const at = new Date(drawnAt(row))
  return Number.isNaN(at.getTime()) ? null : (Date.now() - at.getTime()) / 3600000
}
function ageText(row) {
  const h = ageHours(row)
  if (h === null) return '—'
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`
  if (h < 48) return `${Math.floor(h)} h`
  return `${Math.floor(h / 24)} d`
}
/** Unseparated past 6 h reads amber, past 24 h red; a separated unit stays quiet. */
function ageTone(row) {
  const h = ageHours(row)
  if (h === null || row.components?.length) return 'calm'
  return h >= 24 ? 'late' : h >= 6 ? 'warn' : 'calm'
}

/** Testing's side, as the list can tell it: cleared, failed, or still with Testing. */
function testingState(row) {
  if (row.clearances?.tti && row.clearances?.immunohematology) return 'done'
  if (row.test_result && !row.test_result.clears_for_issue) return 'fail'
  return 'todo'
}

// ── The open unit's steps ──
const unitSteps = computed(() => {
  const u = selected.value
  if (!u) return []
  const separated = Boolean(u.components?.length)
  const clearedNow = Boolean(u.clearances?.tti && u.clearances?.immunohematology)
  const labelled = Boolean(u.labelled_at)
  const handed = u.status === 'completed'
  const done = [separated, clearedNow, labelled || handed, handed]
  const now = done.findIndex((d) => !d)
  return ['Separate', 'Testing clears', 'Final labels', 'Hand over'].map((label, i) => ({
    key: label,
    label,
    state: done[i] ? 'done' : i === now ? 'now' : 'later',
  }))
})

// ── The next unit on the list, opened without going back to it (2026-10-28) ──
// After a breakdown the bench stays on the unit, for its Phase 1 labels; after
// a rejection the next unit opens by itself.
const nextUnit = computed(() => {
  const open = selected.value?.id
  const waiting = queue.value.filter((row) => row.id !== open && !['completed', 'rejected'].includes(row.status))
  const here = queue.value.findIndex((row) => row.id === open)
  return waiting.find((row) => queue.value.indexOf(row) > here) ?? waiting[0] ?? null
})

async function openNext() {
  if (nextUnit.value) await openDonation(nextUnit.value.id)
}

function recordByKey() {
  if (validComponents.value && !busy.value) submitComponents()
}

// ── Component chips ──
const volumeInput = ref(null)
function pickComponent(id) {
  draft.component_id = id
  nextTick(() => volumeInput.value?.focus())
}
/** Each component's colour, as on the Processing dashboard. */
function componentTone(name) {
  const n = String(name).toLowerCase()
  if (n.includes('red') || n.includes('rbc') || n.includes('whole')) return 'red'
  if (n.includes('cryo')) return 'blue'
  if (n.includes('plasma')) return 'amber'
  if (n.includes('platelet')) return 'purple'
  return 'grey'
}

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
  const next = nextUnit.value
  const res = await run(() => service.updateLaboratoryStatus(selected.value.id, {
    status: 'rejected',
    rejection_reason: rejectReason.value.trim(),
  }))

  if (!res) return

  adopt(res.data)
  notice.value = res.message ?? null
  loadQueue()

  // Nothing more to do with a rejected unit: the next one opens (2026-10-28).
  if (next) {
    const message = notice.value
    await openDonation(next.id)
    notice.value = message
  }
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

/* ===== Refresh (project owner, 2026-10-28) ===== */
/* Scan or search. */
.scan { position: relative; margin: 0 16px 10px; }
.scan__icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--rb-text-muted); pointer-events: none; }
.scan__input { box-sizing: border-box; width: 100%; height: 40px; padding: 0 36px 0 38px; border: 1px solid var(--rb-border-strong); border-radius: 12px; background: var(--rb-surface); color: var(--rb-text-primary); font: inherit; font-size: 13px; }
.scan__input::placeholder { color: var(--rb-placeholder); }
.scan__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.scan__kbd { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); min-width: 20px; padding: 1px 6px; border: 1px solid var(--rb-border-strong); border-radius: 6px; background: var(--rb-surface-alt); font-family: var(--rb-font-mono); font-size: 11px; text-align: center; color: var(--rb-text-muted); }
.scan__miss { margin: -4px 16px 10px; font-size: 12px; font-weight: 600; color: var(--rb-warning-text); }
.queue-empty--search { padding: 24px 18px; font-size: 13px; text-align: center; color: var(--rb-text-secondary); }

/* Status chips: tighter, so they sit in two even rows at most. */
.status-chips { gap: 6px !important; }
.status-chip { padding: 4px 5px 4px 11px !important; font-size: 12.5px; }

/* Queue rows: age and the two checks. */
.age { display: inline-flex; align-items: center; gap: 4px; flex: none; padding: 2px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.age--calm { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.age--warn { background: rgba(var(--rb-warning-rgb), .14); color: var(--rb-warning-text); }
.age--late { background: rgba(var(--rb-accent-rgb), .12); color: var(--rb-accent-text); }
.checks { display: flex; gap: 6px; margin-top: 2px; }
.check { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 7px; font-size: 11.5px; font-weight: 600; }
.check--done { background: rgba(var(--rb-success-rgb), .1); color: var(--rb-success-text); }
.check--todo { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.check--fail { background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text); }

/* The open unit's steps. */
.unit-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; margin: 0 0 4px; padding: 0; list-style: none; }
.unit-step { position: relative; display: flex; align-items: center; gap: 8px; min-width: 0; padding: 4px 0; font-size: 12.5px; font-weight: 600; color: var(--rb-text-muted); }
.unit-step + .unit-step::before { content: ''; position: absolute; left: -14px; right: calc(100% + 4px); top: 50%; width: 10px; height: 2px; border-radius: 1px; background: var(--rb-border-strong); }
.unit-step__dot { display: grid; place-items: center; flex: none; width: 24px; height: 24px; border: 2px solid var(--rb-border-strong); border-radius: 50%; background: var(--rb-surface); font-size: 11.5px; font-weight: 800; }
.unit-step__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.unit-step--done { color: var(--rb-success-text); }
.unit-step--done .unit-step__dot { border-color: var(--rb-success); background: var(--rb-success); color: #fff; }
.unit-step--now { color: var(--rb-text-primary); }
.unit-step--now .unit-step__dot { border-color: var(--rb-primary); background: var(--rb-primary); color: #fff; box-shadow: 0 0 0 4px rgba(var(--rb-primary-rgb), .14); }

/* Component chips. */
.quick { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; }
.quick__chip { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 13px; border: 1px solid var(--rb-border); border-radius: 999px; background: var(--rb-surface); font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); cursor: pointer; transition: border-color .15s ease, background-color .15s ease; }
.quick__chip:hover { border-color: var(--comp); }
.quick__chip:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.quick__chip--on, .quick__chip--on:hover { border-color: var(--comp); background: color-mix(in srgb, var(--comp) 10%, var(--rb-surface)); box-shadow: inset 0 0 0 1px var(--comp); }
.quick__swatch { width: 10px; height: 10px; border-radius: 3px; background: var(--comp); }
.comp--red { --comp: rgb(var(--rb-accent-rgb)); }
.comp--amber { --comp: rgb(var(--rb-warning-rgb)); }
.comp--purple { --comp: rgb(var(--rb-purple-rgb, 124, 58, 237)); }
.comp--blue { --comp: rgb(var(--rb-primary-rgb)); }
.comp--grey { --comp: var(--rb-text-muted); }

/* Volume meter. */
.meter { display: flex; flex-direction: column; gap: 6px; }
.meter__track { display: block; height: 8px; overflow: hidden; border-radius: 999px; background: var(--rb-surface-alt); }
.meter__fill { display: block; height: 100%; border-radius: inherit; background: var(--rb-primary); transition: width .2s ease; }

/* A quieter reject: one line, opened when needed. */
.reject { display: flex !important; flex-direction: column; gap: 14px; padding: 14px 18px !important; border: 1px solid var(--rb-border) !important; border-radius: 16px; background: var(--rb-surface) !important; box-shadow: none !important; }
.reject--open { border-color: rgba(var(--rb-accent-rgb), .35) !important; }
.reject__row { display: flex; align-items: center; gap: 12px; }
.reject__icon { display: block !important; flex: none; width: auto !important; height: auto !important; border-radius: 0 !important; background: none !important; color: var(--rb-accent-text); }
.reject__body { display: block !important; flex: 1; min-width: 0; }
.reject .defer { padding: 0 !important; border: 0 !important; background: none !important; }
.reject__title { margin: 0 !important; font-size: 13.5px !important; font-weight: 700; }
.btn--danger-outline { border-color: rgba(var(--rb-accent-rgb), .4) !important; background: var(--rb-surface) !important; color: var(--rb-accent-text) !important; }
.btn--danger-outline:hover:not(:disabled) { background: rgba(var(--rb-accent-rgb), .06) !important; }
.reasons { display: flex; flex-wrap: wrap; gap: 6px; }
.reasons__chip { height: 30px; padding: 0 12px; border: 1px solid var(--rb-border); border-radius: 999px; background: var(--rb-surface); font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.reasons__chip:hover { border-color: rgba(var(--rb-accent-rgb), .4); color: var(--rb-text-primary); }
.reasons__chip--on { border-color: rgba(var(--rb-accent-rgb), .5); background: rgba(var(--rb-accent-rgb), .07); color: var(--rb-accent-text); }
.reasons__chip:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

@media (prefers-reduced-motion: reduce) {
  .meter__fill, .quick__chip { transition: none; }
}

/* Nothing open: a form that reads as locked. */
.picked--empty { border-style: dashed !important; background: transparent !important; }
.picked--empty .picked__value { display: none; }
.bags:disabled .quick, .bags:disabled .entry { opacity: .5; }
.bags:disabled .quick__chip { cursor: not-allowed; }

/* Chips a little smaller, so seven sit in fewer rows. */
.quick { gap: 6px; }
.quick__chip { height: 30px; padding: 0 11px; font-size: 12px; }

/* Nothing waiting: a calm, green "all caught up". */
.queue-empty__badge { display: grid; place-items: center; width: 64px; height: 64px; margin-bottom: 14px; border-radius: 20px; background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); box-shadow: 0 0 0 8px rgba(var(--rb-success-rgb), .05); }

/* Up next, at the foot of the bench. */
.up-next { display: flex; align-items: center; gap: 10px; margin-top: 4px; padding: 12px 14px; border-radius: 12px; background: var(--rb-surface-alt); font-size: 13px; }
.up-next__label { font-size: 12px; font-weight: 700; color: var(--rb-text-muted); }
.up-next__name { flex: 1; min-width: 0; overflow: hidden; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; color: var(--rb-text-primary); }
.up-next__btn { flex: none; gap: 6px; }
.btn-kbd { margin-left: 8px; padding: 1px 6px; border-radius: 5px; background: rgba(255, 255, 255, .2); font-family: var(--rb-font-mono); font-size: 11px; font-weight: 600; }
.btn--sm { height: 32px; padding: 0 12px; font-size: 12.5px; }
</style>
