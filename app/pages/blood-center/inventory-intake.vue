<template>
  <div class="intake">
    <header class="intake__header">
      <div>
        <p class="intake__eyebrow">Blood Center Portal / Inventory</p>
        <h1 class="intake__title">Stock Intake</h1>
        <p class="intake__subtitle">
          Book the physical bags from a cleared donation onto the shelf. One row per bag, traceable back
          to the donation it came from.
        </p>
      </div>

      <span v-if="facilityLabel" class="intake__facility">
        <AssetIcon name="building-2" :size="14" />
        {{ facilityLabel }}
      </span>
    </header>

    <p v-if="error" class="alert alert--error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="alert alert--notice" role="status">{{ notice }}</p>

    <!-- QUEUE -->
    <section v-if="!selected" class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">Cleared donations awaiting intake</h2>
          <p class="card__hint">
            A donation appears here once the laboratory clears it for issue, and leaves once every
            declared bag has been booked in.
          </p>
        </div>

        <button type="button" class="btn" :disabled="loadingQueue" @click="loadQueue">
          <AssetIcon name="refresh-cw" :size="14" />
          {{ loadingQueue ? 'Loading…' : 'Refresh' }}
        </button>
      </div>

      <p v-if="loadingQueue" class="card__hint">Loading the queue…</p>

      <div v-else-if="!queue.length" class="empty">
        <AssetIcon name="package-check" :size="28" />
        <p>Nothing is waiting to be shelved. Every cleared donation has been booked in.</p>
      </div>

      <ul v-else class="queue">
        <li v-for="row in queue" :key="row.donation_id" class="queue__row">
          <div class="queue__main">
            <p class="queue__name">{{ row.donor?.full_name || 'Unknown donor' }}</p>
            <p class="queue__meta">
              Donation #{{ row.donation_id }} · {{ row.donor?.donor_code || '—' }} ·
              {{ row.donor?.blood_type || 'type unknown' }} · {{ formatDate(row.donation_date) }}
            </p>
          </div>

          <div class="queue__state">
            <span class="pill">{{ row.recorded_units }} of {{ row.declared_units }} recorded</span>
            <span class="queue__next">{{ row.outstanding_units }} bag(s) still to shelve</span>
          </div>

          <button type="button" class="btn" :disabled="busy" @click="openDonation(row)">Open</button>
        </li>
      </ul>
    </section>

    <!-- ONE DONATION -->
    <template v-else>
      <section class="unit-bar">
        <div class="unit-bar__identity">
          <span class="unit-bar__avatar">{{ initials }}</span>
          <div class="unit-bar__names">
            <p class="unit-bar__name">{{ selected.donor?.full_name || 'Unknown donor' }}</p>
            <p class="unit-bar__sub">
              Donation #{{ selected.donation_id }} · {{ selected.donor?.donor_code || '—' }} ·
              {{ selected.volume_ml ? `${selected.volume_ml} mL` : 'volume not recorded' }}
            </p>
          </div>
        </div>

        <div class="fact">
          <span class="fact__label">Blood type</span>
          <span class="fact__value">{{ selected.donor?.blood_type || '—' }}</span>
        </div>

        <div class="fact">
          <span class="fact__label">Progress</span>
          <span class="fact__value">{{ selected.recorded_units }} of {{ selected.declared_units }}</span>
        </div>

        <button type="button" class="btn" :disabled="busy" @click="backToQueue">Back to queue</button>
      </section>

      <!-- What the laboratory declared, and what is left of it -->
      <section class="card">
        <h2 class="card__title">Declared by the laboratory</h2>
        <p class="card__hint">
          Intake is limited to this breakdown — a bag that was never separated cannot be shelved, and the
          blood type is taken from the donation rather than typed here.
        </p>

        <ul class="declared">
          <li v-for="c in selected.components" :key="c.component_id" class="declared__row">
            <span class="declared__name">{{ c.component }}</span>
            <span class="declared__count">{{ c.recorded }} of {{ c.declared }} recorded</span>
            <span v-if="!c.shelf_life_configured" class="declared__flag">
              <AssetIcon name="circle-alert" :size="13" />
              No shelf life set
            </span>
            <span v-else class="declared__shelf">{{ c.shelf_life_days }}-day shelf life</span>
          </li>
        </ul>

        <p v-if="unconfigured.length" class="alert alert--warning">
          {{ unconfigured.join(', ') }} {{ unconfigured.length === 1 ? 'has' : 'have' }} no shelf life
          configured, so no expiry date can be derived and {{ unconfigured.length === 1 ? 'it' : 'they' }}
          cannot be shelved. A platform administrator sets this once, under Blood Components.
        </p>
      </section>

      <!-- THE BAGS -->
      <section v-if="shelvable.length" class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Bags to shelve</h2>
            <p class="card__hint">
              One row per physical bag. Leave the unit number blank and RedAgos allocates one; type it if
              the bag already carries a printed label.
            </p>
          </div>
          <span class="pill">{{ unitRows.length }} of {{ MAX_PER_REQUEST }} per batch</span>
        </div>

        <div v-for="(row, index) in unitRows" :key="index" class="unit-row">
          <label class="field">
            <span class="field__label">Component</span>
            <select v-model.number="row.component_id" class="field__input" @change="applyExpiry(row)">
              <option :value="null" disabled>Select</option>
              <option v-for="c in shelvable" :key="c.component_id" :value="c.component_id">
                {{ c.component }} ({{ remainingFor(c.component_id) }} left)
              </option>
            </select>
          </label>

          <label class="field field--date">
            <span class="field__label">Expiry</span>
            <input v-model="row.expiry_date" type="date" class="field__input" >
          </label>

          <label class="field">
            <span class="field__label">Storage location</span>
            <select v-model="row.storage_location" class="field__input">
              <option value="">Not recorded</option>
              <option v-for="loc in storageLocations" :key="loc" :value="loc">{{ loc }}</option>
            </select>
          </label>

          <label class="field field--unit">
            <span class="field__label">Unit no. <span class="field__optional">optional</span></span>
            <input v-model="row.unit_id" type="text" class="field__input" placeholder="Auto" >
          </label>

          <button
            type="button"
            class="btn btn--icon"
            :disabled="unitRows.length === 1"
            aria-label="Remove this bag"
            @click="unitRows.splice(index, 1)"
          >
            <AssetIcon name="trash-2" :size="14" />
          </button>
        </div>

        <ul v-if="blockers.length" class="blockers">
          <li v-for="blocker in blockers" :key="blocker">
            <AssetIcon name="circle-alert" :size="14" />
            {{ blocker }}
          </li>
        </ul>

        <div class="actions">
          <button type="button" class="btn" :disabled="!canAddRow" @click="addUnitRow">Add bag</button>
          <button type="button" class="btn btn--primary" :disabled="busy || blockers.length > 0" @click="submit">
            {{ busy ? 'Saving…' : `Shelve ${unitRows.length} bag(s)` }}
          </button>
        </div>
      </section>

      <section v-else class="card">
        <div class="outcome outcome--warning">
          <AssetIcon name="circle-alert" :size="26" />
          <div>
            <h2 class="card__title">Nothing can be shelved yet</h2>
            <p class="card__hint">
              Every outstanding component on this donation is missing a shelf life, so no expiry date can
              be derived. Ask a platform administrator to set them under Blood Components.
            </p>
          </div>
        </div>

        <div class="actions">
          <button type="button" class="btn" @click="backToQueue">Back to queue</button>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

/**
 * Booking a cleared donation's bags onto the shelf.
 *
 * This is the other half of the laboratory's handover. `completed` on a
 * donation only *authorises* stock entry — it does not create anything — and
 * this is where the physical bags become rows in inventory, each one still
 * pointing back at the donation it came from.
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

const { user } = useUser()
const facilityLabel = computed(() => user.value?.facility?.facility_name || '')

const service = bloodCenterService

const queue = ref([])
const selected = ref(null)
const storageLocations = ref([])

const loadingQueue = ref(false)
const busy = ref(false)
const error = ref(null)
const notice = ref(null)

const unitRows = ref([])

/** Components still owed on this donation that can actually be given an expiry. */
const shelvable = computed(() => (selected.value?.components ?? []).filter(
  (c) => c.outstanding > 0 && c.shelf_life_configured,
))

const unconfigured = computed(() => (selected.value?.components ?? [])
  .filter((c) => c.outstanding > 0 && !c.shelf_life_configured)
  .map((c) => c.component))

const canAddRow = computed(() => unitRows.value.length < MAX_PER_REQUEST
  && unitRows.value.length < (selected.value?.outstanding_units ?? 0))

const initials = computed(() => {
  const name = selected.value?.donor?.full_name || ''

  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '—'
})

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
  if (!value) return '—'

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { dateStyle: 'medium' })
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
  switch (err?.data?.code) {
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
    const res = await service.inventoryIntakeQueue()

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
  const units = unitRows.value.map((row) => ({
    component_id: row.component_id,
    expiry_date: row.expiry_date,
    ...(row.storage_location ? { storage_location: row.storage_location } : {}),
    ...(row.unit_id?.trim() ? { unit_id: row.unit_id.trim() } : {}),
  }))

  const res = await run(() => service.recordBloodUnits({
    donation_id: selected.value.donation_id,
    units,
  }))

  if (!res) return

  const count = res.units?.length ?? units.length

  notice.value = `${count} bag(s) shelved against donation #${selected.value.donation_id}.`

  // Re-read rather than adjusting the counts here: the server is what decides
  // how much is still outstanding, and it has just changed.
  await loadQueue()

  const refreshed = queue.value.find((row) => row.donation_id === selected.value.donation_id)

  if (refreshed) openDonation(refreshed)
  else selected.value = null
}

onMounted(async () => {
  await loadReference()
  await loadQueue()
})
</script>

<style scoped>
.intake {
  font-family: var(--rb-font-sans);
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  background: var(--rb-page-bg);
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.intake__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.intake__eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--rb-primary-text);
}

.intake__title {
  margin: 0.15rem 0 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--rb-text-primary);
}

.intake__subtitle {
  margin: 0.3rem 0 0;
  max-width: 68ch;
  font-size: 13px;
  color: var(--rb-text-secondary);
}

.intake__facility {
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

.card__title { margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--rb-text-primary); }

.card__hint {
  margin: 0;
  max-width: 68ch;
  font-size: 0.83rem;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

@media (max-width: 640px) {
  .intake { padding: 16px 16px 32px; }
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

/* --- selected donation --- */
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

/* --- declared breakdown --- */
.declared { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.4rem; }

.declared__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: var(--rb-surface-alt);
  font-size: 0.83rem;
}

.declared__name { font-weight: 600; color: var(--rb-text-primary); flex: 1 1 10rem; }
.declared__count { color: var(--rb-text-secondary); }
.declared__shelf { color: var(--rb-text-secondary); font-size: 0.78rem; }

.declared__flag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--rb-warning-text);
  font-size: 0.78rem;
  font-weight: 600;
}

/* --- bag rows --- */
.unit-row { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: flex-end; }

.field { display: flex; flex-direction: column; gap: 0.3rem; flex: 1 1 10rem; }
.field--date { max-width: 11rem; }
.field--unit { max-width: 10rem; }

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

.btn--icon { padding: 0.5rem 0.6rem; flex: 0 0 auto; }

.btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--rb-primary) 88%, #000);
  border-color: color-mix(in srgb, var(--rb-primary) 88%, #000);
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

.alert--warning {
  background: rgba(var(--rb-warning-rgb), 0.08);
  color: var(--rb-warning-text);
  border: 1px solid rgba(var(--rb-warning-rgb), 0.3);
}

.outcome { display: flex; align-items: flex-start; gap: 0.75rem; }
.outcome--warning { color: var(--rb-warning-text); }
.outcome .card__title { color: var(--rb-text-primary); }
</style>
