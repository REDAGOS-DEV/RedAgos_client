<template>
  <div class="intake">
    <!--
      One step: book in. The Release tab is gone (project owner, 2026-10-22):
      Processing hands over only cleared, labelled bags, so nothing waits in
      quarantine for Issuance to release.
    -->
    <PageHeader title="Stock Intake" />

    <div v-if="error" class="alert alert--error" role="alert">
      <AssetIcon name="circle-alert" :size="16" />
      <span>{{ error }}</span>
    </div>
    <div v-else-if="notice" class="alert alert--notice" role="status">
      <AssetIcon name="circle-check-big" :size="16" />
      <span>{{ notice }}</span>
    </div>

    <!-- ================= QUEUE + WORKBENCH ================= -->
    <div class="workspace">
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
          <EmptyState
            :icon="activeBarcode ? 'search-x' : 'circle-check-big'"
            :title="activeBarcode ? 'No donation waiting to be booked in has this barcode.' : 'All caught up'"
            :description="activeBarcode ? undefined : 'Every processed donation is on the shelf.'"
            compact
          />
        </div>

        <ul v-else class="queue">
          <li v-for="row in queue" :key="row.donation_id">
            <button
              type="button"
              class="queue__item"
              :class="{ 'queue__item--on': selected?.donation_id === row.donation_id, 'queue__item--held': !row.into_stock }"
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
                <span v-if="!row.into_stock" class="queue__left queue__left--held"><AssetIcon name="clock" :size="12" /> Not ready</span>
                <span v-else class="queue__left">{{ row.outstanding_units }} bag{{ row.outstanding_units === 1 ? '' : 's' }} left</span>
              </span>
            </button>
          </li>
        </ul>
      </aside>

      <!--
        WORKBENCH. Always shown, as on Processing and Testing (project owner,
        2026-10-22): with no donation open it is locked, and its foot says to
        pick one. Nothing opens until a donation is picked or its barcode
        scanned.
      -->
      <section class="bench" :class="{ 'bench--locked': !selected }" aria-live="polite">
        <!-- Identity: the open donation, or a dash -->
        <div class="bench__head">
          <span class="bench__avatar">
            <!-- A bag, not a person, for the roles that work blind and before a donation is open. -->
            <AssetIcon v-if="!selected || selected.donor?.blinded" name="droplets" :size="18" />
            <template v-else>{{ initials }}</template>
          </span>
          <div class="bench__who">
            <p class="bench__label">Selected donation</p>
            <template v-if="selected">
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
            </template>
            <p v-else class="bench__name bench__name--none">—</p>
          </div>
          <div v-if="selected" class="bench__progress">
            <!-- How much of the donation is on the shelf already. -->
            <svg class="progress-dial" viewBox="0 0 44 44" aria-hidden="true">
              <circle class="progress-dial__track" cx="22" cy="22" r="18" />
              <circle v-if="selected.recorded_units" class="progress-dial__fill" cx="22" cy="22" r="18" :stroke-dasharray="dialDash(selected)" />
            </svg>
            <span class="bench__progress-label">
              <strong>{{ selected.recorded_units }} of {{ selected.declared_units }}</strong>
              booked in
            </span>
          </div>
          <button v-if="selected" type="button" class="icon-btn" :disabled="busy" aria-label="Close this donation" title="Close" @click="backToQueue">
            <AssetIcon name="x" :size="16" />
          </button>
        </div>

        <!-- What the laboratory declared -->
        <div class="bench__section">
          <p class="section-label">Declared by the laboratory</p>
          <div class="declared">
            <template v-if="selected">
              <div v-for="c in selected.components" :key="c.component_id" class="declared__item" :class="`declared__item--${componentTint(c.component_id)}`">
                <span class="declared__name">{{ c.component }}</span>
                <span class="declared__count">{{ c.recorded }}/{{ c.declared }}</span>
                <span v-if="!c.shelf_life_configured" class="declared__flag">
                  <AssetIcon name="circle-alert" :size="12" />
                  No shelf life
                </span>
                <span v-else class="declared__life">{{ c.shelf_life_days }}-day life</span>
              </div>
            </template>
            <span v-else class="declared__item declared__item--none">—</span>
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

        <!--
          The bags. Every one is numbered from the barcode sticker and labelled
          by Processing, so only its shelf is chosen here. No bag is entered by
          hand (project owner, 2026-10-22): a donation that can be booked in
          always has numbered bags.
        -->
        <div v-if="!selected || (selected.into_stock && barcoded && shelvable.length)" class="bench__section">
          <div class="bench__section-head">
            <p class="section-label">Bags to book into stock</p>
            <span class="pill">{{ unitRows.length }} of {{ MAX_PER_REQUEST }} per batch</span>
          </div>
          <p class="bench__note">
            <template v-if="!selected">One row per bag, with its expiry and storage location.</template>
            <template v-else>Labelled by Processing, so the expiry is the one on the label. Set each bag's shelf.</template>
          </p>

          <div class="bags">
            <div class="bags__head" aria-hidden="true">
              <span />
              <span>Bag</span>
              <span>Expiry</span>
              <span>Storage location</span>
              <span />
            </div>

            <!-- Locked: the rows a donation's bags fill in. -->
            <div v-if="!selected" class="bags__empty">
              <AssetIcon name="package" :size="22" />
              <p class="bags__empty-title">No bags listed yet.</p>
              <p>Pick a donation or scan its barcode to list its bags.</p>
            </div>

            <div
              v-for="(row, index) in unitRows"
              :key="index"
              class="bags__row"
              :class="[`bags__row--${componentTint(row.component_id)}`, { 'bags__row--ready': rowReady(row) }]"
            >
              <span class="bag-mark" :title="rowReady(row) ? 'Ready to book in' : 'Needs its shelf'">
                <AssetIcon v-if="rowReady(row)" name="check" :size="13" />
                <template v-else>{{ index + 1 }}</template>
              </span>

              <!-- A numbered bag is booked as exactly that bag. -->
              <div class="bag-fixed">
                <span class="bag-fixed__number mono">{{ row.bag_number }}</span>
                <span class="bag-fixed__meta">
                  {{ componentName(row.component_id) }}<template v-if="row.volume_ml"> · {{ row.volume_ml }} mL</template>
                </span>
                <span v-if="expiryHint(row.expiry_date)" class="bag-fixed__expiry" :class="`bag-fixed__expiry--${expiryHint(row.expiry_date).tone}`">
                  <AssetIcon name="clock" :size="11" /> {{ expiryHint(row.expiry_date).label }}
                </span>
              </div>

              <DatePicker v-model="row.expiry_date" :aria-label="`Bag ${index + 1} expiry date`" />

              <!-- Every bag goes onto a shelf (project owner, 2026-10-13): no "not recorded". -->
              <SelectField
                v-model="row.storage_location"
                :options="storageLocations.map((loc) => ({ value: loc, label: loc }))"
                placeholder="Select a location"
                :aria-label="`Bag ${index + 1} storage location`"
              />

              <!--
                Numbered bags are booked in the order Processing numbered them, so
                only the last row of a batch can be left for later.
              -->
              <button
                type="button"
                class="icon-btn icon-btn--row"
                :disabled="unitRows.length === 1 || !isLastOfComponent(index)"
                aria-label="Leave this bag for a later batch"
                title="Leave for a later batch"
                @click="unitRows.splice(index, 1)"
              >
                <AssetIcon name="x" :size="14" />
              </button>
            </div>
          </div>

          <ul v-if="selected && blockers.length" class="blockers">
            <li v-for="blocker in blockers" :key="blocker">
              <AssetIcon name="circle-alert" :size="14" />
              {{ blocker }}
            </li>
          </ul>
        </div>

        <!--
          Handed over before labelling moved to Processing: the server refuses
          it until Testing has cleared it and Processing has printed its final
          labels. There is no quarantine to book it into any more.
        -->
        <div v-else-if="!selected.into_stock" class="bench__stuck">
          <AssetIcon name="clock" :size="18" />
          <div>
            <p class="bench__stuck-title">Not ready to book in</p>
            <p class="bench__note">
              This donation was handed over before Processing started printing final labels. Its bags book in once
              Testing has cleared it and Processing has printed its labels from the Processed list.
            </p>
          </div>
        </div>

        <!-- Labelled, yet its bags carry no numbers: its barcode changed after the hand-over. -->
        <div v-else-if="!barcoded" class="bench__stuck">
          <AssetIcon name="triangle-alert" :size="18" />
          <div>
            <p class="bench__stuck-title">Its bags have no numbers</p>
            <p class="bench__note">
              This donation has no barcode, so its bags carry no numbers to book them under. Ask Processing to check
              the donation's barcode.
            </p>
          </div>
        </div>

        <div v-else class="bench__stuck">
          <AssetIcon name="triangle-alert" :size="18" />
          <div>
            <p class="bench__stuck-title">Nothing can be shelved yet</p>
            <p class="bench__note">Every outstanding component is missing a shelf life. Ask a supervisor to set them under Blood Components.</p>
          </div>
        </div>

        <!-- Stays in reach while a long batch scrolls. Locked until a donation is open. -->
        <div class="bench__actions">
          <p v-if="bookHint" class="bench__hint">{{ bookHint }}</p>
          <p v-else-if="unitRows.length" class="bench__hint bench__hint--count">
            <span class="ready-bar" aria-hidden="true"><span :style="{ width: `${(readyCount / unitRows.length) * 100}%` }" /></span>
            {{ readyCount }} of {{ unitRows.length }} bag{{ unitRows.length === 1 ? '' : 's' }} ready
          </p>
          <button type="button" class="ui-btn ui-btn--primary" :disabled="!canBook" @click="submit">
            {{ busy ? 'Saving…' : bookLabel }}
            <AssetIcon v-if="!busy" name="arrow-right" :size="14" />
          </button>
        </div>
      </section>
    </div>

  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { donorInitials, donorReference, donorTitle } from '~/utils/donorLabel'
import { normalizeBarcode } from '~/utils/phlebotomy'
import SelectField from '~/components/common/SelectField.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import EmptyState from '~/components/ui/EmptyState.vue'

/**
 * Issuance books the bags Processing hands over into stock. Processing keeps
 * them until Testing has cleared the donation and prints their final labels
 * before the hand-over (project owner, 2026-10-22), so labelled bags go
 * straight into stock (`into_stock` on the queue row) and Issuance prints no
 * labels.
 *
 * Booking in is the other half of Processing's hand-over. `completed` on a
 * donation only *authorises* stock entry — it does not create anything — and
 * this is where the physical bags become rows in inventory, each one still
 * pointing back at the donation it came from. A barcoded donation's bags are
 * booked as the bags Processing numbered (sticker + component), in that order,
 * so nothing is re-typed.
 *
 * There is no Release step (removed by the project owner, 2026-10-22). A
 * donation handed over before labelling moved to Processing is shown but not
 * ready (`into_stock` false): the server refuses it until Testing clears it and
 * Processing labels it, rather than holding it in quarantine.
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

const initials = computed(() => donorInitials(selected.value?.donor) || '?')

/**
 * Refuse here for the same reasons the server would, so a batch is never sent
 * to come back as a 409 the staff member has to decode. The rows are the bags
 * Processing numbered, so their component and count are already right.
 */
const blockers = computed(() => {
  const list = []

  if (!unitRows.value.length) list.push('Add at least one bag.')
  if (unitRows.value.some((row) => !row.expiry_date)) list.push('Every bag needs an expiry date.')

  // Every bag goes onto a shelf (project owner, 2026-10-13).
  if (!storageLocations.value.length) list.push('The storage locations could not be loaded. Reload the page to book bags in.')
  else if (unitRows.value.some((row) => !row.storage_location)) list.push('Every bag needs a storage location.')

  return list
})

const canBook = computed(() => Boolean(selected.value?.into_stock) && barcoded.value && shelvable.value.length > 0
  && !busy.value && !blockers.value.length)

const bookLabel = computed(() => {
  const count = unitRows.value.length

  return count ? `Book ${count} bag${count === 1 ? '' : 's'} into stock` : 'Book bags into stock'
})

// Beside the locked button. An open donation's blockers are listed above it.
const bookHint = computed(() => {
  if (!selected.value) return 'Pick a donation first.'
  if (!selected.value.into_stock) return 'Not ready: it needs Testing’s clearance and Processing’s final labels.'
  if (!barcoded.value) return 'Its bags have no numbers to book them under.'
  if (!shelvable.value.length) return 'Nothing on this donation can be shelved yet.'

  return ''
})

// ---- Presentation ----
const DIAL = 2 * Math.PI * 18
function dialDash(row) {
  const share = Math.min(1, (Number(row?.recorded_units) || 0) / Math.max(1, Number(row?.declared_units) || 0))
  return `${(share * DIAL).toFixed(2)} ${DIAL.toFixed(2)}`
}

/** A bag is ready once it has its expiry and its shelf. */
const rowReady = (row) => Boolean(row.expiry_date && row.storage_location)
const readyCount = computed(() => unitRows.value.filter(rowReady).length)

/** The colours bags are known by on the shelf: red cells, yellow plasma, amber platelets. */
function componentTint(componentId) {
  const name = componentName(componentId).toLowerCase()
  if (name.includes('platelet')) return 'platelet'
  if (name.includes('plasma') || name.includes('cryo')) return 'plasma'
  if (name.includes('red') || name.includes('whole')) return 'red'
  return 'other'
}

/** "Expires in 2 days": a short-lived bag says so before it is shelved. */
function expiryHint(value) {
  if (!value) return null
  const end = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(end.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((end - today) / 86400000)
  if (days < 0) return { label: 'Past its expiry', tone: 'crit' }
  if (days === 0) return { label: 'Expires today', tone: 'crit' }
  const label = `Expires in ${days} day${days === 1 ? '' : 's'}`
  if (days <= 3) return { label, tone: 'crit' }
  if (days <= 7) return { label, tone: 'warn' }
  return { label, tone: 'ok' }
}

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

  // The expiry on Processing's final label (the server's BagExpiry), so the
  // stock record agrees with the bag.
  if (component?.expiry_date) {
    row.expiry_date = component.expiry_date
    return
  }

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
    case 'donation_not_completed':
      return 'Processing has not handed this donation over yet, so its bags cannot be booked in.'
    case 'donation_not_cleared':
      return 'Testing has not cleared this donation, so its bags cannot be booked in yet.'
    case 'labels_not_printed':
      return err?.data?.message || 'Processing has not printed this donation’s final labels yet.'
    case 'components_not_declared':
      return 'The laboratory has not recorded what this donation was separated into.'
    case 'exceeds_declared_quantity':
      return err?.data?.message || 'This batch records more bags than the laboratory declared.'
    case 'donor_blood_type_missing':
      return 'This donor has no blood type on file, so a unit cannot be labelled. The laboratory result records it.'
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

async function loadReference() {
  try {
    const res = await service.referenceData()

    storageLocations.value = res?.storage_locations ?? []
  } catch {
    // Every bag needs a location, so without the list nothing can be booked
    // in; the blockers say so.
    storageLocations.value = []
  }
}

function openDonation(row) {
  selected.value = row
  notice.value = null
  error.value = null
  unitRows.value = []

  // Not ready, or no numbered bags: shown, with nothing to fill in. The
  // server would refuse it.
  if (!row.into_stock || !barcoded.value) return

  // One row per numbered bag, in the order Processing numbered them, which is
  // the order the server books them in.
  for (const component of shelvable.value) {
    for (const bag of component.outstanding_bags ?? []) {
      if (unitRows.value.length >= MAX_PER_REQUEST) break

      const bagRow = {
        component_id: component.component_id,
        bag_number: bag.bag_number,
        volume_ml: bag.volume_ml,
        expiry_date: '',
        storage_location: '',
      }

      applyExpiry(bagRow)
      unitRows.value.push(bagRow)
    }
  }
}

function backToQueue() {
  selected.value = null
  unitRows.value = []
  error.value = null
  loadQueue()
}

async function submit() {
  if (!canBook.value) return

  // No unit number is sent: the server gives each bag the one on its Phase 1
  // label, and refuses any other.
  const units = unitRows.value.map((row) => ({
    component_id: row.component_id,
    expiry_date: row.expiry_date,
    storage_location: row.storage_location,
  }))

  const res = await run(() => service.recordBloodUnits({
    donation_id: selected.value.donation_id,
    units,
  }))

  if (!res) return

  const ids = (res.units ?? []).map((unit) => unit.id)

  const count = ids.length || units.length
  notice.value = `${count} bag${count === 1 ? '' : 's'} booked into stock${ids.length ? `: ${ids.join(', ')}` : ''}.`

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

/* ---------- workspace: the list as tall as the bench, as on Processing ---------- */
.workspace {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
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
.queue__left--held { color: var(--rb-text-secondary); }

/* Nothing listed: centred in the stretched panel, a little above the middle. */
.queue-empty { flex: 1; display: grid; place-items: center; padding-bottom: 48px; }

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

.bench__head {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 92px;
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
.bench--locked .bench__avatar { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.bench__who { flex: 1; min-width: 0; }
.bench__label { margin: 0 0 2px; font-size: 11px; color: var(--rb-text-secondary); }
.bench__name { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; }
.bench__name--none { color: var(--rb-text-secondary); }
.bench__sub { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.bench__progress { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.bench__progress-label { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); white-space: nowrap; }

.bench__section { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; border-bottom: 1px solid var(--rb-border); }
/* The foot carries its own line. */
.bench__section:has(+ .bench__actions) { border-bottom: 0; }
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
.declared__item--none { min-width: 64px; justify-content: center; border-style: dashed; background: transparent; color: var(--rb-text-secondary); }

/* bags grid */
.bags { display: flex; flex-direction: column; gap: 6px; }
.bags__head,
.bags__row {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) 184px minmax(0, 1.2fr) 34px;
  gap: 10px;
  align-items: center;
}
.bags__head {
  padding: 0 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}
.bags__row { padding: 8px 8px 8px 12px; border: 1px solid var(--rb-border); border-radius: 10px; }
.bags__row:hover { border-color: var(--rb-border-hover); }

/* Locked: where the open donation's bags list. */
.bags__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 22px 16px;
  border: 1px dashed var(--rb-border-strong);
  border-radius: 10px;
  text-align: center;
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}
.bags__empty p { margin: 0; }
.bags__empty :deep(.asset-icon) { margin-bottom: 6px; }
.bags__empty-title { font-weight: 600; color: var(--rb-text-primary); }

.bag-fixed { display: flex; flex-direction: column; min-width: 0; }
.bag-fixed__number { font-size: 14px; font-weight: 700; }
.bag-fixed__meta { font-size: 12px; color: var(--rb-text-secondary); }

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
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 18px;
  margin-top: auto;
  border-top: 1px solid var(--rb-border);
  border-radius: 0 0 14px 14px;
  background: var(--rb-surface);
  box-shadow: 0 -10px 18px -14px rgba(var(--rb-shadow-rgb), 0.35);
}
.bench__hint { margin: 0 auto 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }

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

/* ---------- misc ---------- */
.mono { font-family: var(--rb-font-mono); letter-spacing: 0.02em; }

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

/* Stacked: the list first, kept short, then the bench under it. */
@media (max-width: 860px) {
  .workspace { grid-template-columns: minmax(0, 1fr); }
  .queue-panel { position: static; max-height: 26rem; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin { animation: none; }
}

/* ===== Refresh (project owner, 2026-10-24) ===== */
.queue__item--held { opacity: 0.72; }
.queue__item--held .queue__name { font-weight: 600; }
.queue__left--held { display: inline-flex; align-items: center; gap: 4px; }

.bench__label { font-weight: 600; letter-spacing: 0.02em; }
.bench__progress { flex-direction: row; align-items: center; gap: 10px; }
.bench__progress-label { display: flex; flex-direction: column; font-weight: 500; line-height: 1.3; }
.bench__progress-label strong { font-size: 14px; color: var(--rb-text-primary); }
.progress-dial { width: 44px; height: 44px; transform: rotate(-90deg); }
.progress-dial__track { fill: none; stroke: var(--rb-surface-alt); stroke-width: 5; }
.progress-dial__fill { fill: none; stroke: var(--rb-primary); stroke-width: 5; stroke-linecap: round; transition: stroke-dasharray 0.4s ease; }

/* Bags: the component's colour down the edge, a mark that ticks when ready. */
.bags__head, .bags__row { grid-template-columns: 28px minmax(0, 1.5fr) 184px minmax(0, 1.2fr) 34px; }
.bags__row { --comp: var(--rb-text-muted); position: relative; overflow: hidden; padding-left: 14px; background: var(--rb-surface); transition: border-color 0.15s ease, background-color 0.15s ease; }
.bags__row::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--comp); }
.bags__row--red { --comp: #C62828; }
.declared__item { --comp: var(--rb-text-muted); }
.bags__row--plasma, .declared__item--plasma { --comp: #EAB308; }
.bags__row--platelet, .declared__item--platelet { --comp: #F97316; }
.declared__item--red { --comp: #C62828; }
.declared__name::before { content: ''; display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 50%; background: var(--comp); vertical-align: 1px; }
.bags__row--ready { border-color: rgba(var(--rb-success-rgb), 0.35); background: rgba(var(--rb-success-rgb), 0.04); }
.bag-mark {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1.5px solid var(--rb-border-strong);
  font-size: 11.5px;
  font-weight: 700;
  color: var(--rb-text-secondary);
  font-variant-numeric: tabular-nums;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.bags__row--ready .bag-mark { border-color: var(--rb-success); background: var(--rb-success); color: #fff; }
.bag-fixed { gap: 1px; }
.bag-fixed__expiry { display: inline-flex; align-items: center; gap: 4px; margin-top: 3px; font-size: 11.5px; font-weight: 600; }
.bag-fixed__expiry--ok { color: var(--rb-text-secondary); font-weight: 500; }
.bag-fixed__expiry--warn { color: var(--rb-warning-text); }
.bag-fixed__expiry--crit { color: var(--rb-accent-text); }

.bench__hint--count { display: inline-flex; align-items: center; gap: 10px; font-weight: 600; color: var(--rb-text-primary); }
.ready-bar { position: relative; width: 120px; height: 6px; border-radius: 999px; background: var(--rb-surface-alt); overflow: hidden; }
.ready-bar span { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--rb-success); transition: width 0.3s ease; }
.bench__actions .ui-btn--primary:not(:disabled) { box-shadow: 0 4px 12px rgba(var(--rb-primary-rgb), 0.25); }

@media (prefers-reduced-motion: reduce) {
  .progress-dial__fill, .ready-bar span, .bags__row, .bag-mark { transition: none; }
}

/* Panels in the shared SectionCard's shape (2026-10-15). */
.queue-panel, .bench { border-radius: var(--rb-radius-lg); box-shadow: var(--rb-shadow-sm); }
</style>
