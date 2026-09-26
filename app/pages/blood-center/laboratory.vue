<template>
  <div class="laboratory">
    <header class="laboratory__header">
      <div>
        <p class="laboratory__eyebrow">Blood Center Portal / Laboratory</p>
        <h1 class="laboratory__title">Processing</h1>
        <p class="laboratory__subtitle">
          Record what each unit was separated into, then clear it for issue or reject it. The Testing department
          records immunohematology and serology on its own page; its outcome appears here.
        </p>
      </div>

      <span v-if="facilityLabel" class="laboratory__facility">
        <AssetIcon name="building-2" :size="14" />
        {{ facilityLabel }}
      </span>
    </header>

    <p v-if="error" class="alert alert--error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="alert alert--notice" role="status">{{ notice }}</p>

    <!-- RECEIVE BLOOD UNIT — the queue of everything collection has handed over -->
    <section v-if="!selected" class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">Units awaiting the laboratory</h2>
          <p class="card__hint">
            Every donation the counter has finished drawing, until it is cleared for issue or rejected.
          </p>
        </div>

        <div class="card__tools">
          <label class="field field--filter">
            <span class="field__label">Show</span>
            <select v-model="statusFilter" class="field__input" @change="loadQueue">
              <option value="">Awaiting the laboratory</option>
              <option value="collected">With Testing — not yet tested</option>
              <option value="tested">Tested — ready for processing</option>
              <option value="completed">Cleared for issue</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>

          <button type="button" class="btn" :disabled="loadingQueue" @click="loadQueue">
            <AssetIcon name="refresh-cw" :size="14" />
            {{ loadingQueue ? 'Loading…' : 'Refresh' }}
          </button>
        </div>
      </div>

      <p v-if="loadingQueue" class="card__hint">Loading the queue…</p>

      <div v-else-if="!queue.length" class="empty">
        <AssetIcon name="flask-conical" :size="28" />
        <p v-if="statusFilter">Nothing matches this filter yet.</p>
        <p v-else>No units are waiting. Donations appear here once the counter records a collection.</p>
      </div>

      <ul v-else class="queue">
        <li v-for="row in queue" :key="row.id" class="queue__row">
          <div class="queue__main">
            <p class="queue__name">{{ row.donor?.full_name || 'Unknown donor' }}</p>
            <p class="queue__meta">
              Donation #{{ row.id }} · {{ row.donor?.donor_code || '—' }} ·
              {{ row.volume_ml ? `${row.volume_ml} mL` : 'volume not recorded' }} ·
              {{ formatDate(row.donation_date) }}
            </p>
          </div>

          <div class="queue__state">
            <span class="pill" :class="pillClass(row.status)">{{ row.status_label }}</span>
            <span class="queue__next">{{ nextStepFor(row) }}</span>
          </div>

          <button type="button" class="btn" :disabled="busy" @click="openDonation(row.id)">
            Open
          </button>
        </li>
      </ul>
    </section>

    <!-- ONE UNIT -->
    <template v-else>
      <section class="unit-bar">
        <div class="unit-bar__identity">
          <span class="unit-bar__avatar">{{ initials }}</span>
          <div class="unit-bar__names">
            <p class="unit-bar__name">{{ selected.donor?.full_name || 'Unknown donor' }}</p>
            <p class="unit-bar__sub">
              Donation #{{ selected.id }} · {{ selected.donor?.donor_code || '—' }} ·
              {{ selected.volume_ml ? `${selected.volume_ml} mL` : 'volume not recorded' }}
            </p>
          </div>
        </div>

        <div class="fact">
          <span class="fact__label">Type on file</span>
          <span class="fact__value">{{ selected.donor?.blood_type || 'Not known yet' }}</span>
        </div>

        <div class="fact">
          <span class="fact__label">Segment</span>
          <span class="fact__value mono">{{ selected.collection?.segment_number || '—' }}</span>
        </div>

        <div class="fact">
          <span class="fact__label">Status</span>
          <span class="pill" :class="pillClass(selected.status)">{{ selected.status_label }}</span>
        </div>

        <button type="button" class="btn" :disabled="busy" @click="backToQueue">Back to queue</button>
      </section>

      <ol class="steps" aria-label="Unit progress">
        <li v-for="step in steps" :key="step.key" class="step" :class="step.state">
          <span class="step__dot">
            <AssetIcon v-if="step.state === 'step--done'" name="check" :size="12" />
            <template v-else>{{ step.index }}</template>
          </span>
          <span class="step__label">{{ step.label }}</span>
        </li>
      </ol>

      <!-- Terminal: nothing left to record -->
      <section v-if="isFinal" class="card">
        <div class="outcome" :class="selected.status === 'completed' ? 'outcome--success' : 'outcome--rejected'">
          <AssetIcon :name="selected.status === 'completed' ? 'circle-check-big' : 'circle-alert'" :size="26" />
          <div>
            <h2 class="card__title">
              {{ selected.status === 'completed' ? 'Cleared for issue' : 'Donation rejected' }}
            </h2>
            <p class="card__hint">
              <template v-if="selected.status === 'completed'">
                Issuance may now record this unit's components as stock.
              </template>
              <template v-else>
                {{ selected.rejection_reason || 'No reason was recorded.' }}
                This unit can never become stock.
              </template>
            </p>
          </div>
        </div>

        <div class="actions">
          <button type="button" class="btn btn--primary" @click="backToQueue">Back to queue</button>
          <NuxtLink v-if="selected.status === 'completed'" to="/blood-center/inventory" class="btn">
            Go to inventory
          </NuxtLink>
        </div>
      </section>

      <template v-else>
        <!-- The two branches the technologist works in parallel -->
        <div class="lab-grid">
          <!--
            TESTING — read-only here. The Testing department records
            immunohematology and serology on its own page. Processing sees the
            outcome and the typing, never which serology marker was reactive:
            the server does not send it to this department.
          -->
          <section class="card">
            <h2 class="card__title">Testing</h2>
            <p class="card__hint">
              Recorded by the Testing department. Only a donation that passed both immunohematology and all five
              serology markers can be cleared for issue.
            </p>

            <div class="recorded">
              <div class="fact">
                <span class="fact__label">Immunohematology</span>
                <span class="fact__value">
                  {{ selected.immunohematology?.blood_type || (selected.test_result?.is_legacy ? selected.test_result.blood_type : null) || 'Not yet recorded' }}
                </span>
                <span v-if="selected.immunohematology?.recorded_by" class="fact__sub">
                  {{ selected.immunohematology.recorded_by }} · {{ formatDate(selected.immunohematology.recorded_at) }}
                </span>
              </div>

              <div class="fact">
                <span class="fact__label">Serology</span>
                <span
                  v-if="selected.serology"
                  class="pill"
                  :class="selected.serology.outcome === 'reactive' ? 'pill--rejected' : 'pill--collected'"
                >
                  {{ selected.serology.outcome_label }}
                </span>
                <span v-else class="fact__value">Not yet recorded</span>
                <span v-if="selected.serology?.recorded_by" class="fact__sub">
                  {{ selected.serology.recorded_by }} · {{ formatDate(selected.serology.recorded_at) }}
                </span>
              </div>

              <div v-if="selected.test_result" class="fact">
                <span class="fact__label">Outcome</span>
                <span class="pill" :class="selected.test_result.clears_for_issue ? 'pill--collected' : 'pill--rejected'">
                  {{ selected.test_result.result_label }}
                </span>
              </div>
            </div>

            <p v-if="selected.test_result?.is_legacy" class="card__hint card__hint--warn">
              Recorded before the five-marker panel existed ({{ selected.test_result.result_label }}). The Testing
              department must record serology before this unit can be cleared.
            </p>
            <p v-else-if="!selected.test_result" class="card__hint">
              Waiting for the Testing department to record {{ testingOutstanding }}.
            </p>

            <NuxtLink v-if="canRecordResult" :to="`/blood-center/testing?donation=${selected.id}`" class="btn btn--link">
              Open on the Testing page
            </NuxtLink>
          </section>

          <!-- PROCESSING -->
          <section class="card">
            <h2 class="card__title">Processing</h2>
            <p class="card__hint">
              Record each bag this unit was separated into, with its volume. Two bags of the same component are two
              rows. This runs alongside testing — neither waits on the other.
              <template v-if="selected.collection?.blood_bag_type_label">
                Drawn into a {{ selected.collection.blood_bag_type_label.toLowerCase() }} bag.
              </template>
            </p>

            <div v-if="selected.components?.length" class="recorded">
              <div v-for="c in selected.components" :key="c.id ?? c.component_id" class="fact">
                <span class="fact__label">{{ c.component }}</span>
                <span class="fact__value">{{ bagLabel(c) }}</span>
              </div>
            </div>

            <p v-if="!canRecordComponents" class="card__hint">
              {{ selected.components?.length ? 'Recorded by the Processing department.' : 'Waiting for the Processing department to record the breakdown.' }}
            </p>

            <template v-else>
              <div v-for="(row, index) in componentRows" :key="index" class="component-row">
                <label class="field">
                  <span class="field__label">Component</span>
                  <select v-model.number="row.component_id" class="field__input">
                    <option :value="null" disabled>Select</option>
                    <option v-for="c in components" :key="c.id" :value="c.id">{{ c.name }}</option>
                  </select>
                </label>

                <label class="field field--qty">
                  <span class="field__label">Volume (mL)</span>
                  <input
                    v-model.number="row.volume_ml"
                    type="number"
                    min="1"
                    max="1000"
                    inputmode="numeric"
                    class="field__input"
                    placeholder="mL"
                  >
                </label>

                <button
                  type="button"
                  class="btn btn--icon"
                  :disabled="componentRows.length === 1"
                  aria-label="Remove this bag"
                  @click="componentRows.splice(index, 1)"
                >
                  <AssetIcon name="trash-2" :size="14" />
                </button>
              </div>

              <!-- Information only: nothing here decides what a bag should hold. -->
              <p v-if="declaredVolume > 0" class="card__hint">
                {{ declaredVolume }} mL across {{ componentRows.filter(isCompleteBag).length }} bag(s)<template v-if="selected.volume_ml">
                  — {{ selected.volume_ml }} mL was collected</template>.
              </p>

              <div class="actions">
                <button type="button" class="btn" :disabled="componentRows.length >= 10" @click="addComponentRow">
                  Add bag
                </button>
                <button
                  type="button"
                  class="btn btn--primary"
                  :disabled="busy || !validComponents"
                  @click="submitComponents"
                >
                  {{ selected.components?.length ? 'Update breakdown' : 'Record components' }}
                </button>
              </div>
            </template>
          </section>
        </div>

        <!-- LABELING AND THE FINAL DECISION -->
        <section class="card">
          <h2 class="card__title">Labeling &amp; release</h2>
          <p class="card__hint">
            Once the unit is labelled at the bench, record where it goes. Clearing it for issue is what lets
            inventory take it as stock, so it is the last thing done and it cannot be undone here.
          </p>

          <ul v-if="blockers.length" class="blockers">
            <li v-for="blocker in blockers" :key="blocker">
              <AssetIcon name="circle-alert" :size="14" />
              {{ blocker }}
            </li>
          </ul>

          <p v-if="!canUpdateStatus" class="card__hint">
            The Processing department clears this unit for issue or rejects it.
          </p>

          <div v-else-if="rejecting" class="defer">
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
            <button type="button" class="btn btn--primary" :disabled="busy || blockers.length > 0" @click="submitRelease">
              {{ busy ? 'Saving…' : 'Clear for issue' }}
            </button>
            <button type="button" class="btn btn--danger" :disabled="busy" @click="rejecting = true">
              Reject this unit
            </button>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

/**
 * The Processing department's side of a donation.
 *
 * The counter leaves every donation at `collected`; the Testing department
 * records immunohematology and serology on its own page, and a donation that
 * passes both becomes `tested`. From there `completed` — *cleared for issue to
 * a patient* — is Processing's to set, here. Testing's work shows on this page
 * read-only, as its outcome: which serology marker was reactive never reaches
 * this department. Everything on this page is a record of what a medical
 * technologist found at the bench — nothing here performs or interprets a test.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'lab.record_components',
})

const { user, can } = useUser()
const facilityLabel = computed(() => user.value?.facility?.facility_name || '')

// Processing records the breakdown and makes the final call. A supervisor
// holds every ability, so can also jump across to the Testing page.
const canRecordResult = computed(() => can('lab.record_result'))
const canRecordComponents = computed(() => can('lab.record_components'))
const canUpdateStatus = computed(() => can('lab.update_status'))

const service = bloodCenterService

const queue = ref([])
const selected = ref(null)
const components = ref([])

// Empty means the laboratory's own working queue: collected and tested, which
// is what the endpoint returns when no status is given.
const statusFilter = ref('')
const loadingQueue = ref(false)
const busy = ref(false)
const error = ref(null)
const notice = ref(null)
const rejecting = ref(false)
const rejectReason = ref('')

// One row per bag, with its volume. Two bags of the same component are two
// rows; inventory books in exactly one unit per row.
const componentRows = ref([{ component_id: null, volume_ml: null }])

function isCompleteBag(row) {
  const volume = Number(row.volume_ml)

  return Boolean(row.component_id) && Number.isInteger(volume) && volume >= 1 && volume <= 1000
}

/** The total declared across complete rows, shown beside the collected volume. */
const declaredVolume = computed(() => componentRows.value
  .filter(isCompleteBag)
  .reduce((sum, row) => sum + Number(row.volume_ml), 0))

/** How a recorded bag reads. A breakdown from before volumes were kept shows its count. */
function bagLabel(bag) {
  if (bag.volume_ml) return `${bag.volume_ml} mL`

  return `${bag.quantity} unit${bag.quantity === 1 ? '' : 's'}`
}

// Testing is finished once the donation has an outcome under the five-marker
// panel. A legacy result — recorded before the panel existed — does not count.
const hasResult = computed(() => Boolean(selected.value?.test_result) && !selected.value?.test_result?.is_legacy)
const resultPassed = computed(() => Boolean(selected.value?.test_result?.clears_for_issue))

/** Which Testing sections are still missing, in words. */
const testingOutstanding = computed(() => {
  const missing = []

  if (!selected.value?.immunohematology) missing.push('immunohematology')
  if (!selected.value?.serology) missing.push('serology')

  return missing.length ? missing.join(' and ') : 'its outcome'
})
const hasComponents = computed(() => Boolean(selected.value?.components?.length))
const isFinal = computed(() => ['completed', 'rejected'].includes(selected.value?.status))

const initials = computed(() => {
  const name = selected.value?.donor?.full_name || ''

  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '—'
})

// Every row complete, not just one: a half-filled row would otherwise be
// dropped silently, and a bag would go unrecorded.
const validComponents = computed(() => componentRows.value.length > 0
  && componentRows.value.every(isCompleteBag))

/**
 * What still stands between this unit and issuable stock.
 *
 * Mirrors the server's guardReadyToComplete so the button is refused here for
 * the same reasons it would be refused there, with the reason on screen rather
 * than in a 409.
 */
const blockers = computed(() => {
  const list = []

  if (selected.value?.test_result?.is_legacy) {
    list.push('Serology has not been recorded under the five-marker panel. The Testing department must record it.')
  } else if (!hasResult.value) {
    list.push(`The Testing department has not recorded ${testingOutstanding.value}.`)
  } else if (!resultPassed.value) {
    list.push('This result cannot be cleared for issue. Reject the unit instead.')
  }

  if (!hasComponents.value) list.push('The component breakdown has not been recorded.')

  return list
})

const steps = computed(() => {
  const done = (ok) => (ok ? 'step--done' : '')

  return [
    { key: 'received', index: 1, label: 'Received', state: 'step--done' },
    { key: 'testing', index: 2, label: 'Testing', state: done(hasResult.value) },
    { key: 'processing', index: 3, label: 'Processing', state: done(hasComponents.value) },
    {
      key: 'release',
      index: 4,
      label: 'Labeling & release',
      state: isFinal.value ? 'step--done' : (blockers.value.length ? '' : 'step--current'),
    },
  ]
})

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
  if (row.status === 'completed') return 'Cleared for issue'
  if (row.status === 'rejected') return row.rejection_reason || 'Rejected'
  if (row.test_result?.is_legacy) return 'Needs serology from Testing'
  if (row.test_result && !row.test_result.clears_for_issue) return 'Needs rejecting'

  // Either branch may be outstanding, and in any order — neither is "next"
  // ahead of the other.
  const outstanding = []

  if (!row.test_result) outstanding.push('testing')
  if (!row.components?.length) outstanding.push('processing')

  return outstanding.length ? `Needs ${outstanding.join(' and ')}` : 'Ready to release'
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

async function loadQueue() {
  loadingQueue.value = true
  error.value = null

  try {
    const res = await service.laboratoryQueue(
      statusFilter.value ? { status: statusFilter.value } : { stage: 'processing' },
    )

    queue.value = res?.data ?? []
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

  if (!payload) return

  // A breakdown recorded before volumes were kept has a count and no
  // volume; it opens as that many rows, each waiting for its volume.
  componentRows.value = payload.components?.length
    ? payload.components.flatMap((c) => Array.from(
      { length: c.volume_ml ? 1 : Math.max(1, Number(c.quantity) || 1) },
      () => ({ component_id: c.component_id, volume_ml: c.volume_ml ?? null }),
    ))
    : [{ component_id: null, volume_ml: null }]
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
  selected.value = null
  error.value = null
  notice.value = null
  loadQueue()
}

function addComponentRow() {
  componentRows.value.push({ component_id: null, volume_ml: null })
}

async function submitComponents() {
  const payload = componentRows.value
    .filter(isCompleteBag)
    .map((row) => ({ component_id: row.component_id, volume_ml: Number(row.volume_ml) }))

  const res = await run(() => service.declareComponents(selected.value.id, { components: payload }))

  if (!res) return

  adopt(res.data)
  notice.value = res.message ?? null
}

async function submitRelease() {
  const res = await run(() => service.updateLaboratoryStatus(selected.value.id, { status: 'completed' }))

  if (!res) return

  adopt(res.data)
  notice.value = res.message ?? null
}

async function submitReject() {
  const res = await run(() => service.updateLaboratoryStatus(selected.value.id, {
    status: 'rejected',
    rejection_reason: rejectReason.value.trim(),
  }))

  if (!res) return

  adopt(res.data)
  notice.value = res.message ?? null
}

onMounted(async () => {
  await loadReference()
  await loadQueue()
})
</script>

<style scoped>
.laboratory {
  font-family: var(--rb-font-sans);
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  background: var(--rb-page-bg);
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.laboratory__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.laboratory__eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--rb-primary-text);
}

.laboratory__title {
  margin: 0.15rem 0 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--rb-text-primary);
}

.laboratory__subtitle {
  margin: 0.3rem 0 0;
  max-width: 68ch;
  font-size: 13px;
  color: var(--rb-text-secondary);
}

.laboratory__facility {
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

/* --- cards --- */
.card {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.1rem;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
}

.card__head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-start;
  justify-content: space-between;
}

.card__tools { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: flex-end; }

.card__title { margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--rb-text-primary); }

.card__hint {
  margin: 0;
  max-width: 68ch;
  font-size: 0.83rem;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

/* The two bench branches sit side by side: they are worked in parallel, and
   stacking them would suggest one waits on the other more than it does. */
.lab-grid {
  display: grid;
  gap: 1.1rem;
  grid-template-columns: minmax(0, 1fr);
}

@media (min-width: 900px) {
  .lab-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
}

@media (max-width: 640px) {
  .laboratory { padding: 16px 16px 32px; }
}

/* --- queue --- */
.empty {
  display: grid;
  place-items: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  text-align: center;
  color: var(--rb-text-secondary);
  font-size: 0.85rem;
}

.queue { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }

.queue__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.9rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface-alt);
}

.queue__main { flex: 1 1 16rem; min-width: 0; }
.queue__name { margin: 0; font-size: 0.9rem; font-weight: 600; color: var(--rb-text-primary); }
.queue__meta { margin: 0.15rem 0 0; font-size: 0.78rem; color: var(--rb-text-secondary); }

.queue__state { display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-start; }
.queue__next { font-size: 0.74rem; color: var(--rb-text-secondary); }

/* --- the selected unit --- */
.unit-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 12px;
  background: var(--rb-surface-alt);
}

.unit-bar__identity { display: flex; align-items: center; gap: 0.7rem; min-width: 0; flex: 1 1 14rem; }

.unit-bar__avatar {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.12);
  color: var(--rb-primary-text);
  font-size: 0.8rem;
  font-weight: 700;
  flex-shrink: 0;
}

.unit-bar__names { min-width: 0; }
.unit-bar__name { margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--rb-text-primary); }
.unit-bar__sub { margin: 0.15rem 0 0; font-size: 0.78rem; color: var(--rb-text-secondary); }

.fact { display: flex; flex-direction: column; gap: 0.25rem; }

.fact__label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.fact__value { font-size: 0.85rem; color: var(--rb-text-primary); }

/* Who screened a section, and when — the form's "Screened by" column. */
.fact__sub { font-size: 0.74rem; color: var(--rb-text-secondary); }

.mono {
  font-family: var(--rb-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  letter-spacing: 0.02em;
}

.card__hint--warn { color: var(--rb-warning-text); font-weight: 600; }

.btn--link { align-self: flex-start; }

.recorded {
  display: flex;
  flex-wrap: wrap;
  gap: 1.1rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface-alt);
}

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

.pill--collected { background: rgba(var(--rb-warning-rgb), 0.12); color: var(--rb-warning-text); border-color: transparent; }
.pill--tested { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); border-color: transparent; }
.pill--completed { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); border-color: transparent; }
.pill--rejected { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); border-color: transparent; }

/* --- progress --- */
.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.step { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; }

.step__dot {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
  font-size: 0.72rem;
  font-weight: 700;
}

.step--done .step__dot { background: var(--rb-success); border-color: var(--rb-success); color: #fff; }
.step--current .step__dot { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.step--done .step__label,
.step--current .step__label { color: var(--rb-text-primary); font-weight: 600; }

.step__label { color: var(--rb-text-secondary); }

/* --- forms --- */
.field { display: flex; flex-direction: column; gap: 0.3rem; width: 100%; }
.field--qty { max-width: 7rem; }
.field--filter { max-width: 15rem; }

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

.field__input:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 1px;
  border-color: var(--rb-primary);
}

.field__input:disabled { opacity: 0.55; cursor: not-allowed; }

.component-row { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: flex-end; }

.blockers {
  margin: 0;
  padding: 0.7rem 0.85rem;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  border: 1px solid rgba(var(--rb-warning-rgb), 0.35);
  border-radius: 10px;
  background: rgba(var(--rb-warning-rgb), 0.06);
  font-size: 0.82rem;
  color: var(--rb-warning-text);
}

.blockers li { display: flex; align-items: center; gap: 0.45rem; }

.defer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.8rem;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 10px;
  background: rgba(var(--rb-accent-rgb), 0.05);
}

/* --- actions --- */
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  border-radius: 10px;
  padding: 0.5rem 0.95rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;
}

.btn:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }

.btn--icon { padding: 0.5rem 0.6rem; }

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
.alert {
  margin: 0;
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  font-size: 0.84rem;
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

.outcome { display: flex; align-items: flex-start; gap: 0.75rem; }
.outcome--success { color: var(--rb-success-text); }
.outcome--rejected { color: var(--rb-accent-text); }
.outcome .card__title { color: var(--rb-text-primary); }
</style>
