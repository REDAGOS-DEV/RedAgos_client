<template>
  <div class="intake">
    <!-- ================= HEADER: title + the two steps as tabs ================= -->
    <header class="intake__header">
      <div>
        <h1 class="intake__title">Stock Intake</h1>
        <p class="intake__subtitle">Book processed bags into quarantine, then release and label them once testing clears.</p>
      </div>

      <div class="tabs" role="tablist" aria-label="Stock intake steps">
        <button
          type="button"
          role="tab"
          class="tab"
          :class="{ 'tab--on': step === 'book' }"
          :aria-selected="step === 'book'"
          @click="step = 'book'"
        >
          <span class="tab__num">1</span>
          Book in
          <span v-if="queue.length" class="tab__count">{{ queue.length }}</span>
        </button>
        <button
          type="button"
          role="tab"
          class="tab"
          :class="{ 'tab--on': step === 'release' }"
          :aria-selected="step === 'release'"
          @click="step = 'release'"
        >
          <span class="tab__num">2</span>
          Release &amp; label
          <span v-if="released.length" class="tab__count tab__count--done">{{ released.length }}</span>
        </button>
      </div>
    </header>

    <div v-if="error" class="alert alert--error" role="alert">
      <AssetIcon name="circle-alert" :size="16" />
      <span>{{ error }}</span>
    </div>
    <div v-else-if="notice" class="alert alert--notice" role="status">
      <AssetIcon name="circle-check-big" :size="16" />
      <span>{{ notice }}</span>
      <button v-if="step === 'book'" type="button" class="alert__action" @click="step = 'release'">
        Go to Release &amp; label
      </button>
    </div>

    <!-- ================= STEP 1: QUEUE + WORKBENCH ================= -->
    <div v-show="step === 'book'" class="workspace" role="tabpanel">
      <!-- QUEUE -->
      <aside class="queue-panel" aria-label="Donations waiting to be booked in">
        <form class="scan" @submit.prevent="findByBarcode">
          <AssetIcon name="scan-line" :size="17" class="scan__icon" />
          <label class="sr-only" for="intake-scan">Donation barcode</label>
          <input
            id="intake-scan"
            ref="scanInput"
            v-model="barcodeSearch"
            type="text"
            class="scan__input mono"
            autocomplete="off"
            spellcheck="false"
            autocapitalize="characters"
            maxlength="30"
            placeholder="Scan or type a barcode"
          >
          <button type="submit" class="scan__go" :disabled="loadingQueue" aria-label="Find donation">
            <AssetIcon name="arrow-right" :size="16" />
          </button>
        </form>

        <div class="queue-panel__head">
          <p class="queue-panel__title">
            Waiting
            <span class="queue-panel__count">{{ loadingQueue ? '…' : queue.length }}</span>
          </p>
          <button
            type="button"
            class="icon-btn"
            :disabled="loadingQueue"
            :aria-label="activeBarcode ? 'Show all donations' : 'Refresh the queue'"
            :title="activeBarcode ? 'Show all' : 'Refresh'"
            @click="clearSearch"
          >
            <AssetIcon :name="activeBarcode ? 'x' : 'refresh-cw'" :size="14" :class="{ 'spin': loadingQueue }" />
          </button>
        </div>

        <p v-if="activeBarcode && !loadingQueue" class="queue-panel__filter">
          Barcode <span class="mono">{{ activeBarcode }}</span>
        </p>

        <ul v-if="loadingQueue" class="queue" aria-busy="true">
          <li v-for="n in 4" :key="n" class="queue__item queue__item--skeleton">
            <span class="skeleton skeleton--line" />
            <span class="skeleton skeleton--short" />
          </li>
        </ul>

        <div v-else-if="!queue.length" class="queue-empty">
          <AssetIcon :name="activeBarcode ? 'search-x' : 'circle-check-big'" :size="18" />
          <p>
            <template v-if="activeBarcode">No donation waiting to be booked in has this barcode.</template>
            <template v-else>All caught up. Every processed donation is on the shelf.</template>
          </p>
        </div>

        <ul v-else class="queue">
          <li v-for="row in queue" :key="row.donation_id">
            <button
              type="button"
              class="queue__item"
              :class="{ 'queue__item--on': selected?.donation_id === row.donation_id }"
              :aria-current="selected?.donation_id === row.donation_id ? 'true' : undefined"
              :disabled="busy"
              @click="openDonation(row)"
            >
              <span class="queue__top">
                <span class="queue__name">{{ donorTitle(row.donor, row.donation_barcode, row.donation_id) }}</span>
                <span class="type-pill" :class="{ 'type-pill--unknown': !row.donor?.blood_type }">
                  {{ row.donor?.blood_type || '?' }}
                </span>
              </span>
              <span class="queue__meta">#{{ row.donation_id }} · {{ formatDate(row.donation_date) }}</span>
              <span class="queue__bottom">
                <span class="bag-dots" aria-hidden="true">
                  <span
                    v-for="n in dotCount(row)"
                    :key="n"
                    class="bag-dot"
                    :class="{ 'bag-dot--in': n <= (row.recorded_units || 0) }"
                  />
                </span>
                <span class="queue__left">{{ row.outstanding_units }} bag{{ row.outstanding_units === 1 ? '' : 's' }} left</span>
              </span>
            </button>
          </li>
        </ul>
      </aside>

      <!-- WORKBENCH -->
      <section class="bench" aria-live="polite">
        <!-- Nothing open yet -->
        <div v-if="!selected" class="bench__idle">
          <span class="bench__idle-icon"><AssetIcon name="scan-line" :size="26" /></span>
          <p class="bench__idle-title">Scan or type a barcode to start</p>
          <p class="bench__idle-text">
            Scan the donation barcode sticker, type it in, or pick a donation from the list. Its bags open here,
            ready to book into quarantine.
          </p>
        </div>

        <template v-else>
          <!-- Identity -->
          <div class="bench__head">
            <span class="bench__avatar">
              <!-- A bag, not a person, for the roles that work blind. -->
              <AssetIcon v-if="selected.donor?.blinded" name="droplets" :size="18" />
              <template v-else>{{ initials }}</template>
            </span>
            <div class="bench__who">
              <p class="bench__name">
                {{ donorTitle(selected.donor, selected.donation_barcode, selected.donation_id) }}
                <span class="type-pill" :class="{ 'type-pill--unknown': !selected.donor?.blood_type }">
                  {{ selected.donor?.blood_type || 'Type unknown' }}
                </span>
              </p>
              <p class="bench__sub">
                Donation #{{ selected.donation_id }} · {{ donorReference(selected.donor) }} ·
                {{ selected.volume_ml ? `${selected.volume_ml} mL` : 'volume not recorded' }}
              </p>
            </div>
            <div class="bench__progress">
              <span class="bag-dots bag-dots--lg" aria-hidden="true">
                <span
                  v-for="n in dotCount(selected)"
                  :key="n"
                  class="bag-dot"
                  :class="{ 'bag-dot--in': n <= (selected.recorded_units || 0) }"
                />
              </span>
              <span class="bench__progress-label">{{ selected.recorded_units }} of {{ selected.declared_units }} booked in</span>
            </div>
            <button type="button" class="icon-btn" :disabled="busy" aria-label="Close this donation" title="Close" @click="backToQueue">
              <AssetIcon name="x" :size="16" />
            </button>
          </div>

          <!-- What the laboratory declared -->
          <div class="bench__section">
            <p class="section-label">Declared by the laboratory</p>
            <div class="declared">
              <div v-for="c in selected.components" :key="c.component_id" class="declared__item">
                <span class="declared__name">{{ c.component }}</span>
                <span class="declared__count">{{ c.recorded }}/{{ c.declared }}</span>
                <span v-if="!c.shelf_life_configured" class="declared__flag">
                  <AssetIcon name="circle-alert" :size="12" />
                  No shelf life
                </span>
                <span v-else class="declared__life">{{ c.shelf_life_days }}-day life</span>
              </div>
            </div>
            <p class="bench__note">Blood type comes from the donation. Only declared components can be booked in.</p>
          </div>

          <div v-if="unconfigured.length" class="alert alert--warning">
            <AssetIcon name="triangle-alert" :size="16" />
            <span>
              {{ unconfigured.join(', ') }} {{ unconfigured.length === 1 ? 'has' : 'have' }} no shelf life, so
              {{ unconfigured.length === 1 ? 'it' : 'they' }} cannot be shelved. A supervisor sets this under Blood Components.
            </span>
          </div>

          <!-- The bags -->
          <div v-if="shelvable.length" class="bench__section">
            <div class="bench__section-head">
              <p class="section-label">Bags to book into quarantine</p>
              <span class="pill">{{ unitRows.length }} of {{ MAX_PER_REQUEST }} per batch</span>
            </div>
            <p class="bench__note">
              <template v-if="barcoded">Numbered by Processing from the barcode sticker. Set each bag's expiry and shelf.</template>
              <template v-else>One row per bag. Leave the unit number blank and RedAgos allocates one.</template>
            </p>

            <div class="bags" :class="{ 'bags--manual': !barcoded }">
              <div class="bags__head" aria-hidden="true">
                <span>{{ barcoded ? 'Bag' : 'Component' }}</span>
                <span>Expiry</span>
                <span>Storage location</span>
                <span v-if="!barcoded">Unit no. <i>optional</i></span>
                <span />
              </div>

              <div v-for="(row, index) in unitRows" :key="index" class="bags__row">
                <!-- A numbered bag is booked as exactly that bag. -->
                <div v-if="row.bag_number" class="bag-fixed">
                  <span class="bag-fixed__number mono">{{ row.bag_number }}</span>
                  <span class="bag-fixed__meta">
                    {{ componentName(row.component_id) }}<template v-if="row.volume_ml"> · {{ row.volume_ml }} mL</template>
                  </span>
                </div>

                <select
                  v-else
                  v-model.number="row.component_id"
                  class="field__input"
                  :aria-label="`Bag ${index + 1} component`"
                  @change="applyExpiry(row)"
                >
                  <option :value="null" disabled>Select a component</option>
                  <option v-for="c in shelvable" :key="c.component_id" :value="c.component_id">
                    {{ c.component }} ({{ remainingFor(c.component_id) }} left)
                  </option>
                </select>

                <input v-model="row.expiry_date" type="date" class="field__input" :aria-label="`Bag ${index + 1} expiry date`">

                <select v-model="row.storage_location" class="field__input" :aria-label="`Bag ${index + 1} storage location`">
                  <option value="">Not recorded</option>
                  <option v-for="loc in storageLocations" :key="loc" :value="loc">{{ loc }}</option>
                </select>

                <input
                  v-if="!row.bag_number"
                  v-model="row.unit_id"
                  type="text"
                  class="field__input"
                  placeholder="Auto"
                  :aria-label="`Bag ${index + 1} unit number (optional)`"
                >

                <!--
                  Numbered bags are booked in the order Processing numbered them, so
                  only the last row of a batch can be left for later.
                -->
                <button
                  type="button"
                  class="icon-btn icon-btn--row"
                  :disabled="unitRows.length === 1 || (row.bag_number && !isLastOfComponent(index))"
                  aria-label="Leave this bag for a later batch"
                  title="Leave for a later batch"
                  @click="unitRows.splice(index, 1)"
                >
                  <AssetIcon name="x" :size="14" />
                </button>
              </div>
            </div>

            <ul v-if="blockers.length" class="blockers">
              <li v-for="blocker in blockers" :key="blocker">
                <AssetIcon name="circle-alert" :size="14" />
                {{ blocker }}
              </li>
            </ul>
          </div>

          <div v-else class="bench__stuck">
            <AssetIcon name="triangle-alert" :size="18" />
            <div>
              <p class="bench__stuck-title">Nothing can be shelved yet</p>
              <p class="bench__note">Every outstanding component is missing a shelf life. Ask a supervisor to set them under Blood Components.</p>
            </div>
          </div>

          <!-- Stays in reach while a long batch scrolls -->
          <div v-if="shelvable.length" class="bench__actions">
            <button v-if="!barcoded" type="button" class="btn" :disabled="!canAddRow" @click="addUnitRow">
              <AssetIcon name="plus" :size="14" />
              Add bag
            </button>
            <button type="button" class="btn btn--primary" :disabled="busy || blockers.length > 0" @click="submit">
              {{ busy ? 'Saving…' : `Book ${unitRows.length} bag${unitRows.length === 1 ? '' : 's'} into quarantine` }}
              <AssetIcon v-if="!busy" name="arrow-right" :size="14" />
            </button>
          </div>
        </template>
      </section>
    </div>

    <!-- ================= STEP 2: RELEASE AND FINAL LABELS ================= -->
    <!-- v-show keeps the panel's own state between tabs. -->
    <div v-show="step === 'release'" class="release" role="tabpanel">
      <BloodCenterQuarantinePanel allow-release @released="onReleased" />

      <section v-if="released.length" class="released">
        <p class="section-label">Released this session</p>
        <ul class="released__list">
          <li v-for="item in released" :key="item.donationId" class="released__item">
            <AssetIcon name="circle-check-big" :size="16" class="released__icon" />
            <div class="released__main">
              <p class="released__name">{{ item.barcode ? `Barcode ${item.barcode}` : `Donation #${item.donationId}` }}</p>
              <p class="released__meta">{{ item.count }} bag{{ item.count === 1 ? '' : 's' }}: <span class="mono">{{ item.units.join(', ') }}</span></p>
            </div>
            <button type="button" class="btn btn--sm" :disabled="busy" @click="reprint(item.donationId)">
              <AssetIcon name="printer" :size="14" />
              Reprint labels
            </button>
          </li>
        </ul>
      </section>
    </div>

    <!-- Hidden until labels are printed. -->
    <BloodCenterBagLabelSheet />
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import BloodCenterQuarantinePanel from '~/components/BloodCenter/QuarantinePanel.vue'
import BloodCenterBagLabelSheet from '~/components/BloodCenter/BagLabelSheet.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { donorInitials, donorReference, donorTitle } from '~/utils/donorLabel'
import { normalizeBarcode } from '~/utils/phlebotomy'
import { finalLabelsFrom } from '~/utils/bagLabels'

/**
 * Issuance's two steps with a donation's bags: book them into quarantine, then
 * release them and print their final labels.
 *
 * Booking in is the other half of Processing's hand-over. `completed` on a
 * donation only *authorises* stock entry — it does not create anything — and
 * this is where the physical bags become rows in inventory, each one still
 * pointing back at the donation it came from. A barcoded donation's bags are
 * booked as the bags Processing numbered (sticker + component), in that order,
 * so nothing is re-typed.
 *
 * Releasing is Phase 2 of labelling: once TTI Testing and Immunohematology have
 * both cleared the donation, the Inventory Control Officer releases its bags
 * and prints the final labels — verified blood type, expiry, clearance codes —
 * to affix before the bags go to the ready-for-issue shelf.
 *
 * Two things are deliberately not on this screen. The blood type, because the
 * server derives it from the donation and refuses it from the client: it is the
 * one field on a unit that can kill someone if it is wrong. And any component
 * the laboratory did not declare, because a bag that was never separated cannot
 * be shelved.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'inventory.create',
})

// The server caps one intake request at 10 units, so a donation separated into
// more than that is shelved over several batches. The queue counts what is
// already in, so stopping halfway is safe.
const MAX_PER_REQUEST = 10

// Which of the two steps is on screen while no donation is open.
const step = ref('book') // 'book' | 'release'

// Bag dots: one per declared bag, capped so a large donation stays one line.
const MAX_DOTS = 12
function dotCount(row) {
  return Math.min(Number(row?.declared_units) || 0, MAX_DOTS)
}

// The scanner types into whatever has focus, so the scan field takes it on arrival.
const scanInput = ref(null)

const service = bloodCenterService

const queue = ref([])
const selected = ref(null)
const storageLocations = ref([])

const loadingQueue = ref(false)
const busy = ref(false)
const error = ref(null)
const notice = ref(null)

const unitRows = ref([])

const barcodeSearch = ref('')
const activeBarcode = ref('')
const released = ref([])
const { print } = useLabelPrint()

/** Whether this donation's bags carry numbers from a barcode sticker. */
const barcoded = computed(() => (selected.value?.components ?? [])
  .some((c) => (c.outstanding_bags ?? []).some((bag) => bag.bag_number)))

function componentName(componentId) {
  return selected.value?.components?.find((c) => c.component_id === componentId)?.component ?? ''
}

/** Whether a row is the last one of its component in this batch — the only one that may be left out. */
function isLastOfComponent(index) {
  const componentId = unitRows.value[index]?.component_id

  return !unitRows.value.slice(index + 1).some((row) => row.component_id === componentId)
}

/** Components still owed on this donation that can actually be given an expiry. */
const shelvable = computed(() => (selected.value?.components ?? []).filter(
  (c) => c.outstanding > 0 && c.shelf_life_configured,
))

const unconfigured = computed(() => (selected.value?.components ?? [])
  .filter((c) => c.outstanding > 0 && !c.shelf_life_configured)
  .map((c) => c.component))

const canAddRow = computed(() => unitRows.value.length < MAX_PER_REQUEST
  && unitRows.value.length < (selected.value?.outstanding_units ?? 0))

const initials = computed(() => donorInitials(selected.value?.donor) || '?')

/**
 * How many of a component are still owed once this batch is counted.
 */
function remainingFor(componentId) {
  const declared = selected.value?.components?.find((c) => c.component_id === componentId)

  if (!declared) return 0

  const inBatch = unitRows.value.filter((row) => row.component_id === componentId).length

  return declared.outstanding - inBatch
}

/**
 * Refuse here for the same reasons the server would, so a batch is never sent
 * to come back as a 409 the staff member has to decode.
 */
const blockers = computed(() => {
  const list = []

  if (!unitRows.value.length) list.push('Add at least one bag.')
  if (unitRows.value.some((row) => !row.component_id)) list.push('Every bag needs a component.')
  if (unitRows.value.some((row) => !row.expiry_date)) list.push('Every bag needs an expiry date.')

  const over = (selected.value?.components ?? []).filter((c) => remainingFor(c.component_id) < 0)

  if (over.length) {
    list.push(`The laboratory declared fewer ${over[0].component} than this batch records.`)
  }

  const ids = unitRows.value.map((row) => row.unit_id?.trim()).filter(Boolean)

  if (new Set(ids).size !== ids.length) list.push('Two bags carry the same unit number.')

  return list
})

function formatDate(value) {
  if (!value) return 'date not recorded'

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? 'date not recorded' : date.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

/**
 * Expiry is derived, not typed: donation date plus the component's shelf life.
 * Left editable because a bag's own printed date wins over a computed one.
 */
function applyExpiry(row) {
  const component = shelvable.value.find((c) => c.component_id === row.component_id)

  if (!component?.shelf_life_days || !selected.value?.donation_date) return

  const date = new Date(selected.value.donation_date)

  if (Number.isNaN(date.getTime())) return

  date.setDate(date.getDate() + component.shelf_life_days)
  row.expiry_date = date.toISOString().slice(0, 10)
}

function messageFor(err) {
  const firstValidationError = Object.values(err?.data?.errors ?? {}).flat()[0]

  if (firstValidationError) return firstValidationError

  switch (err?.data?.code) {
    case 'bag_number_taken':
      return err?.data?.message || 'A bag with this number is already in stock. Check the sticker on the bag.'
    case 'not_released':
      return 'These bags have not left quarantine, so they have no final label yet.'
    case 'donation_not_completed':
      return 'The laboratory has not cleared this donation, so its blood cannot enter inventory yet.'
    case 'components_not_declared':
      return 'The laboratory has not recorded what this donation was separated into.'
    case 'exceeds_declared_quantity':
      return err?.data?.message || 'This batch records more bags than the laboratory declared.'
    case 'donor_blood_type_missing':
      return 'This donor has no blood type on file, so a unit cannot be labelled. The laboratory result records it.'
    case 'unit_id_generation_failed':
      return 'A unit number could not be allocated. Try again.'
    case 'donation_not_found':
      return 'That donation was not found at your facility.'
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
    const res = await service.inventoryIntakeQueue(activeBarcode.value ? { barcode: activeBarcode.value } : {})

    queue.value = res?.data ?? []
  } catch (err) {
    error.value = messageFor(err)
  } finally {
    loadingQueue.value = false
  }
}

/**
 * Find the donation whose bags are on the counter. One match opens it straight
 * away — the sticker was scanned because those are the bags being booked in.
 */
async function findByBarcode() {
  error.value = null
  activeBarcode.value = normalizeBarcode(barcodeSearch.value)

  await loadQueue()

  if (activeBarcode.value && queue.value.length === 1) openDonation(queue.value[0])
}

function clearSearch() {
  barcodeSearch.value = ''
  activeBarcode.value = ''
  loadQueue()
}

/**
 * Print the final labels the release returned, and remember the donation for reprints.
 */
async function onReleased(donationId, labels) {
  const printable = finalLabelsFrom(labels)

  released.value = [
    {
      donationId,
      barcode: labels?.donation_barcode ?? null,
      count: printable.length,
      units: printable.map((label) => label.unit_id),
    },
    ...released.value.filter((item) => item.donationId !== donationId),
  ]

  if (printable.length) await print(printable, 'final')
}

async function reprint(donationId) {
  const res = await run(() => service.bloodLabels(donationId))

  if (res) await print(finalLabelsFrom(res), 'final')
}

async function loadReference() {
  try {
    const res = await service.referenceData()

    storageLocations.value = res?.storage_locations ?? []
  } catch {
    // The intake still works without them: storage_location is nullable, so an
    // empty list costs a shelf label, not the ability to book a bag in.
    storageLocations.value = []
  }
}

function addUnitRow() {
  const only = shelvable.value.length === 1 ? shelvable.value[0] : null
  const row = { component_id: only?.component_id ?? null, expiry_date: '', storage_location: '', unit_id: '' }

  if (only) applyExpiry(row)

  unitRows.value.push(row)
}

function openDonation(row) {
  selected.value = row
  notice.value = null
  error.value = null
  unitRows.value = []

  // A barcoded donation: one row per numbered bag, in the order Processing
  // numbered them, which is the order the server books them in.
  if (barcoded.value) {
    for (const component of shelvable.value) {
      for (const bag of component.outstanding_bags ?? []) {
        if (unitRows.value.length >= MAX_PER_REQUEST) break

        const bagRow = {
          component_id: component.component_id,
          bag_number: bag.bag_number,
          volume_ml: bag.volume_ml,
          expiry_date: '',
          storage_location: '',
          unit_id: '',
        }

        applyExpiry(bagRow)
        unitRows.value.push(bagRow)
      }
    }

    return
  }

  // Pre-fill the batch with as many bags as are outstanding, up to the
  // per-request cap, since shelving all of them is the normal case.
  const target = Math.min(row.outstanding_units, MAX_PER_REQUEST)

  for (let i = 0; i < target && shelvable.value.length; i++) addUnitRow()

  if (!unitRows.value.length && shelvable.value.length) addUnitRow()
}

function backToQueue() {
  selected.value = null
  unitRows.value = []
  error.value = null
  loadQueue()
}

async function submit() {
  // A numbered bag never sends a unit number: the server gives it the one on
  // its Phase 1 label, and refuses any other.
  const units = unitRows.value.map((row) => ({
    component_id: row.component_id,
    expiry_date: row.expiry_date,
    ...(row.storage_location ? { storage_location: row.storage_location } : {}),
    ...(!row.bag_number && row.unit_id?.trim() ? { unit_id: row.unit_id.trim() } : {}),
  }))

  const res = await run(() => service.recordBloodUnits({
    donation_id: selected.value.donation_id,
    units,
  }))

  if (!res) return

  const ids = (res.units ?? []).map((unit) => unit.id)

  const count = ids.length || units.length
  notice.value = `${count} bag${count === 1 ? '' : 's'} booked into quarantine${ids.length ? `: ${ids.join(', ')}` : ''}. `
    + 'Release them under "Release & label" once testing clears the donation.'

  // Re-read rather than adjusting the counts here: the server is what decides
  // how much is still outstanding, and it has just changed.
  await loadQueue()

  const refreshed = queue.value.find((row) => row.donation_id === selected.value.donation_id)

  if (refreshed) openDonation(refreshed)
  else selected.value = null
}

onMounted(async () => {
  scanInput.value?.focus()
  await loadReference()
  await loadQueue()
})
</script>

<style scoped>
.intake {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--rb-text-primary);
}

/* ---------- header + tabs ---------- */
.intake__header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.intake__title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
.intake__subtitle { margin: 4px 0 0; font-size: 13px; color: var(--rb-text-secondary); }

.tabs {
  display: inline-flex;
  padding: 4px;
  gap: 4px;
  border-radius: 12px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  flex-shrink: 0;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--rb-text-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.tab:hover { color: var(--rb-text-primary); }
.tab:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.tab--on { background: var(--rb-primary); color: #fff; }
.tab__num {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
}
.tab--on .tab__num { background: rgba(255, 255, 255, 0.22); color: #fff; }
.tab__count {
  min-width: 20px;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  background: rgba(var(--rb-warning-rgb), 0.16);
  color: var(--rb-warning-text);
}
.tab--on .tab__count { background: #fff; color: var(--rb-primary); }
.tab__count--done { background: rgba(var(--rb-success-rgb), 0.14); color: var(--rb-success-text); }

/* ---------- feedback ---------- */
.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
}
.alert :deep(svg) { flex-shrink: 0; }
.alert--error { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), 0.25); }
.alert--notice { background: rgba(var(--rb-success-rgb), 0.08); color: var(--rb-success-text); border: 1px solid rgba(var(--rb-success-rgb), 0.25); }
.alert--warning { background: rgba(var(--rb-warning-rgb), 0.08); color: var(--rb-warning-text); border: 1px solid rgba(var(--rb-warning-rgb), 0.3); align-items: flex-start; }
.alert__action {
  margin-left: auto;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  white-space: nowrap;
}

/* ---------- workspace ---------- */
.workspace {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

/* queue */
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

.scan {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--rb-border);
}
.scan__icon { position: absolute; left: 24px; color: var(--rb-primary-text); pointer-events: none; }
.scan__input {
  flex: 1;
  min-width: 0;
  height: 42px;
  padding: 0 12px 0 38px;
  border: 1.5px solid rgba(var(--rb-primary-rgb), 0.35);
  border-radius: 10px;
  background: rgba(var(--rb-primary-rgb), 0.04);
  color: var(--rb-text-primary);
  font-size: 14px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}
.scan__input::placeholder { color: var(--rb-placeholder); font-family: var(--rb-font-sans); letter-spacing: 0; }
.scan__input:focus { outline: none; border-color: var(--rb-primary); background: var(--rb-surface); box-shadow: var(--rb-focus-ring); }
.scan__go {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: var(--rb-primary);
  color: #fff;
  cursor: pointer;
}
.scan__go:hover:not(:disabled) { background: #0D47A1; }
.scan__go:disabled { opacity: 0.6; cursor: not-allowed; }
.scan__go:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

.queue-panel__head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 6px; }
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
.queue-panel__count {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  color: var(--rb-text-primary);
  font-size: 11px;
  letter-spacing: 0;
}
.queue-panel__filter { margin: 0; padding: 0 14px 6px; font-size: 12px; color: var(--rb-text-secondary); }

.queue {
  list-style: none;
  margin: 0;
  padding: 4px 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.queue__item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  font: inherit;
  text-align: left;
  color: inherit;
  cursor: pointer;
  transition: background-color 0.12s ease, border-color 0.12s ease;
}
.queue__item:hover:not(:disabled) { background: var(--rb-surface-hover); }
.queue__item:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }
.queue__item--on {
  border-color: rgba(var(--rb-primary-rgb), 0.35);
  background: rgba(var(--rb-primary-rgb), 0.07);
  box-shadow: inset 3px 0 0 var(--rb-primary);
}
.queue__item--skeleton { cursor: default; gap: 8px; }

.queue__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.queue__name { font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.queue__meta { font-size: 12px; color: var(--rb-text-secondary); }
.queue__bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.queue__left { font-size: 12px; font-weight: 600; color: var(--rb-warning-text); white-space: nowrap; }

.queue-empty {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 6px 14px 14px;
  padding: 12px;
  border-radius: 10px;
  background: var(--rb-surface-alt);
  color: var(--rb-success-text);
}
.queue-empty p { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }

.type-pill {
  flex-shrink: 0;
  padding: 2px 9px;
  border-radius: 999px;
  background: rgba(var(--rb-accent-rgb), 0.1);
  color: var(--rb-accent-text);
  font-size: 12px;
  font-weight: 700;
}
.type-pill--unknown { background: var(--rb-surface-alt); color: var(--rb-text-secondary); font-weight: 600; }

/* bag dots */
.bag-dots { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 3px; }
.bag-dot { width: 10px; height: 10px; border-radius: 3px; border: 1.5px solid var(--rb-border-strong); }
.bag-dot--in { border-color: var(--rb-primary); background: var(--rb-primary); }
.bag-dots--lg { gap: 4px; }
.bag-dots--lg .bag-dot { width: 14px; height: 14px; border-radius: 4px; }

/* workbench */
.bench {
  display: flex;
  flex-direction: column;
  min-height: 420px;
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
}

.bench__idle {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 24px;
  text-align: center;
}
.bench__idle-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
}
.bench__idle-title { margin: 6px 0 0; font-size: 15px; font-weight: 700; }
.bench__idle-text { margin: 0; max-width: 42ch; font-size: 13px; line-height: 1.55; color: var(--rb-text-secondary); }

.bench__head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--rb-border);
}
.bench__avatar {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
  font-size: 13px;
  font-weight: 700;
}
.bench__who { flex: 1; min-width: 0; }
.bench__name { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; }
.bench__sub { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.bench__progress { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.bench__progress-label { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); white-space: nowrap; }

.bench__section { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; border-bottom: 1px solid var(--rb-border); }
.bench__section:last-of-type { border-bottom: 0; }
.bench__section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.bench__note { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }

.bench > .alert { margin: 14px 18px 0; }

.section-label {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.pill {
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}

/* declared components as chips */
.declared { display: flex; flex-wrap: wrap; gap: 8px; }
.declared__item {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface-alt);
  font-size: 13px;
}
.declared__name { font-weight: 600; }
.declared__count { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--rb-primary-text); }
.declared__life { font-size: 12px; color: var(--rb-text-secondary); }
.declared__flag { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--rb-warning-text); }

/* bags grid */
.bags { display: flex; flex-direction: column; gap: 6px; }
.bags__head,
.bags__row {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) 160px minmax(0, 1.2fr) 34px;
  gap: 10px;
  align-items: center;
}
.bags--manual .bags__head,
.bags--manual .bags__row { grid-template-columns: minmax(0, 1.5fr) 160px minmax(0, 1.2fr) 140px 34px; }
.bags__head {
  padding: 0 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}
.bags__head i { font-style: normal; font-weight: 500; text-transform: none; letter-spacing: 0; }
.bags__row { padding: 8px 8px 8px 12px; border: 1px solid var(--rb-border); border-radius: 10px; }
.bags__row:hover { border-color: var(--rb-border-hover); }

.bag-fixed { display: flex; flex-direction: column; min-width: 0; }
.bag-fixed__number { font-size: 14px; font-weight: 700; }
.bag-fixed__meta { font-size: 12px; color: var(--rb-text-secondary); }

.field__input {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.field__input::placeholder { color: var(--rb-placeholder); }
.field__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.blockers {
  margin: 0;
  padding: 10px 14px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-radius: 10px;
  background: rgba(var(--rb-warning-rgb), 0.08);
  font-size: 12.5px;
  color: var(--rb-warning-text);
}
.blockers li { display: flex; align-items: center; gap: 7px; }

.bench__stuck { display: flex; gap: 12px; padding: 18px; color: var(--rb-warning-text); }
.bench__stuck-title { margin: 0 0 3px; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }

.bench__actions {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 18px;
  margin-top: auto;
  border-top: 1px solid var(--rb-border);
  border-radius: 0 0 14px 14px;
  background: var(--rb-surface);
  box-shadow: 0 -10px 18px -14px rgba(var(--rb-shadow-rgb), 0.35);
}

/* ---------- buttons ---------- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.btn--sm { height: 32px; padding: 0 12px; font-size: 12.5px; }
.btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) { background: #0D47A1; border-color: #0D47A1; }

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
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.icon-btn:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.icon-btn--row:hover:not(:disabled) { color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), 0.08); }

/* ---------- release tab ---------- */
.release { display: flex; flex-direction: column; gap: 16px; }
.released { display: flex; flex-direction: column; gap: 10px; }
.released__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; border: 1px solid var(--rb-border); border-radius: 12px; background: var(--rb-surface); overflow: hidden; }
.released__item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--rb-border); }
.released__item:first-child { border-top: 0; }
.released__icon { color: var(--rb-success-text); flex-shrink: 0; }
.released__main { flex: 1; min-width: 0; }
.released__name { margin: 0; font-size: 13.5px; font-weight: 600; }
.released__meta { margin: 2px 0 0; font-size: 12px; color: var(--rb-text-secondary); }

/* ---------- misc ---------- */
.mono { font-family: var(--rb-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); letter-spacing: 0.02em; }

.skeleton {
  display: block;
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: intake-shimmer 1.4s ease infinite;
}
.skeleton--line { width: 75%; }
.skeleton--short { width: 45%; }
@keyframes intake-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.spin { animation: intake-spin 0.9s linear infinite; }
@keyframes intake-spin { to { transform: rotate(360deg); } }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 1100px) {
  .workspace { grid-template-columns: 300px minmax(0, 1fr); }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin { animation: none; }
}
</style>
