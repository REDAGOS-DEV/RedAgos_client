<template>
  <div class="rcv-page">
    <div class="rcv-inner">
      <header class="page-header">
        <div>
          <h1 class="page-title">Direct Distribution</h1>
          <p class="page-subtitle">
            Receive blood delivered from outside RedAgos, under the identifier its sender gave it — such as
            <span class="mono">PRC-920923323</span>. RedAgos keeps that identifier as is and does not issue a barcode of its own.
          </p>
        </div>
      </header>

      <div class="modes" role="tablist" aria-label="How the blood is being received">
        <button
          type="button"
          role="tab"
          class="modes__tab"
          :class="{ 'modes__tab--on': mode === 'ptr' }"
          :aria-selected="mode === 'ptr'"
          @click="setMode('ptr')"
        >
          <AssetIcon name="scan-line" :size="15" />
          <span>
            <strong>For a patient transfusion request</strong>
            <small>Scan or type each unit</small>
          </span>
        </button>
        <button
          type="button"
          role="tab"
          class="modes__tab"
          :class="{ 'modes__tab--on': mode === 'batch' }"
          :aria-selected="mode === 'batch'"
          @click="setMode('batch')"
        >
          <AssetIcon name="pencil" :size="15" />
          <span>
            <strong>Without a request</strong>
            <small>Type the identifier and how many units</small>
          </span>
        </button>
      </div>

      <template v-if="mode === 'ptr'">
      <!-- ============ 1. THE PATIENT'S REQUEST ============ -->
      <section class="panel panel--pad" aria-labelledby="ptr-title">
        <h2 id="ptr-title" class="panel__title">1. Patient transfusion request</h2>

        <div class="ptr-pick">
          <div class="search-box">
            <AssetIcon name="search" :size="14" class="search-box__icon" />
            <input
              v-model="ptrSearch"
              type="search"
              class="search-box__input"
              placeholder="Search PTR number or patient…"
              aria-label="Search patient transfusion requests"
            >
          </div>
          <select v-model.number="ptrId" class="input" aria-label="Patient transfusion request" :disabled="ptrLoading">
            <option :value="null">{{ ptrLoading ? 'Loading…' : openRequests.length ? 'Choose a request…' : 'No open requests' }}</option>
            <option v-for="ptr in openRequests" :key="ptr.id" :value="ptr.id">
              {{ ptr.reference_number }} — {{ ptr.patient?.full_name || 'Patient' }} · {{ ptr.blood_type?.code }}
            </option>
          </select>
        </div>
        <p v-if="ptrError" class="field-error" role="alert">{{ ptrError }}</p>

        <dl v-if="ptr" class="facts">
          <div class="fact"><dt>Patient</dt><dd>{{ ptr.patient?.full_name || '—' }}</dd></div>
          <div class="fact"><dt>Blood type</dt><dd>{{ ptr.blood_type?.code || '—' }}</dd></div>
          <div class="fact"><dt>Needs</dt><dd>{{ needsLabel }}</dd></div>
          <div class="fact">
            <dt>Dispatched, not received</dt>
            <dd>{{ awaiting.length }} bag{{ awaiting.length === 1 ? '' : 's' }}</dd>
          </div>
        </dl>
      </section>

      <!-- ============ 2. IDENTIFY THE BLOOD UNIT ============ -->
      <section class="panel panel--pad" :class="{ 'panel--off': !ptr }" aria-labelledby="scan-title">
        <h2 id="scan-title" class="panel__title">2. Blood unit</h2>

        <div class="scan">
          <button type="button" class="btn btn--primary scan__button" :disabled="!ptr || busy" @click="armScanner">
            <AssetIcon name="scan-line" :size="16" />
            Scan Blood Unit
          </button>
          <p class="scan__state" :class="{ 'scan__state--ready': scannerArmed }" role="status">
            <span class="scan__dot" />
            {{ scannerArmed ? 'Ready — scan the unit now' : 'Press to scan with the barcode scanner' }}
          </p>
        </div>

        <p class="or"><span>OR</span></p>

        <form class="manual" @submit.prevent="identify">
          <div class="field field--grow">
            <label for="dd-number" class="field-label">External unit identifier</label>
            <input
              id="dd-number"
              ref="numberInput"
              v-model="entry"
              type="text"
              class="input mono"
              autocomplete="off"
              spellcheck="false"
              autocapitalize="characters"
              maxlength="60"
              placeholder="PRC-920923323"
              :disabled="!ptr || busy"
              @focus="scannerArmed = true"
              @blur="scannerArmed = false"
            >
          </div>
          <button type="submit" class="btn" :disabled="!ptr || busy || !entry.trim()">Receive</button>
        </form>
        <p class="field-hint">Typing is optional — use it only when a unit cannot be scanned.</p>

        <p v-if="notice" class="notice" :class="`notice--${notice.tone}`" role="status">
          <AssetIcon :name="notice.tone === 'success' ? 'circle-check-big' : 'triangle-alert'" :size="14" />
          {{ notice.text }}
        </p>
      </section>

      </template>

      <!-- ============ DETAILS OF AN EXTERNAL UNIT, OR A TYPED BATCH ============ -->
      <section v-if="mode === 'batch' || pending" class="panel panel--pad" :class="{ 'panel--accent': mode === 'ptr' }" aria-labelledby="ext-title">
        <template v-if="mode === 'ptr'">
          <h2 id="ext-title" class="panel__title">3. External unit details</h2>
          <p class="panel__hint">
            <span class="mono">{{ pending }}</span> is not a RedAgos bag dispatched for this patient. Record where it came from and what is on its label.
          </p>
        </template>
        <template v-else>
          <h2 id="ext-title" class="panel__title">Receive without a request</h2>
          <p class="panel__hint">
            No scanner and no patient transfusion request: type the identifier the sender gave, how many units arrived
            under it, and who requested them. Each unit goes into your blood bank's stock.
          </p>

          <div class="field-grid">
            <div class="field field--wide">
              <label for="batch-number" class="field-label">External unit identifier <span class="req">*</span></label>
              <input
                id="batch-number"
                v-model="batch.number"
                type="text"
                class="input mono"
                :class="{ 'input--error': fieldErrors.external_unit_number }"
                autocomplete="off"
                spellcheck="false"
                autocapitalize="characters"
                maxlength="60"
                placeholder="PRC-920923323"
                @blur="batch.number = normalizeUnitNumber(batch.number)"
              >
              <p v-if="fieldErrors.external_unit_number" class="field-error">{{ fieldErrors.external_unit_number }}</p>
            </div>

            <div class="field">
              <label for="batch-qty" class="field-label">Number of units received <span class="req">*</span></label>
              <input
                id="batch-qty"
                v-model.number="batch.quantity"
                type="number"
                inputmode="numeric"
                min="1"
                max="100"
                class="input"
                :class="{ 'input--error': fieldErrors.quantity }"
              >
              <p v-if="fieldErrors.quantity" class="field-error">{{ fieldErrors.quantity }}</p>
            </div>

            <div class="field">
              <label for="batch-for" class="field-label">Requested by / patient <span class="req">*</span></label>
              <input
                id="batch-for"
                v-model.trim="batch.requested_for"
                type="text"
                class="input"
                :class="{ 'input--error': fieldErrors.requested_for }"
                maxlength="150"
                placeholder="Patient, ward or physician"
              >
              <p v-if="fieldErrors.requested_for" class="field-error">{{ fieldErrors.requested_for }}</p>
            </div>
          </div>
        </template>

        <div class="field-grid">
          <div class="field">
            <label for="ext-source" class="field-label">Source facility <span class="req">*</span></label>
            <select id="ext-source" v-model.number="form.external_blood_source_id" class="input" :class="{ 'input--error': fieldErrors.external_blood_source_id }">
              <option :value="null">Select a blood service…</option>
              <option v-for="source in sources" :key="source.id" :value="source.id">{{ source.name }}</option>
            </select>
            <button type="button" class="link-btn" @click="addingSource = !addingSource">
              {{ addingSource ? 'Cancel' : 'Source not listed? Add it' }}
            </button>
            <p v-if="fieldErrors.external_blood_source_id" class="field-error">{{ fieldErrors.external_blood_source_id }}</p>
          </div>

          <div class="field">
            <label for="ext-comp" class="field-label">Blood component <span class="req">*</span></label>
            <select id="ext-comp" v-model.number="form.component_id" class="input" :class="{ 'input--error': fieldErrors.component_id }">
              <option :value="null">Select…</option>
              <option v-for="component in components" :key="component.id" :value="component.id">{{ component.name }}</option>
            </select>
            <p v-if="fieldErrors.component_id" class="field-error">{{ fieldErrors.component_id }}</p>
          </div>

          <div class="field">
            <label for="ext-type" class="field-label">Blood type <span class="req">*</span></label>
            <select id="ext-type" v-model.number="form.blood_type_id" class="input" :class="{ 'input--error': fieldErrors.blood_type_id }">
              <option :value="null">Select…</option>
              <option v-for="type in bloodTypes" :key="type.id" :value="type.id">{{ type.code }}</option>
            </select>
            <p v-if="fieldErrors.blood_type_id" class="field-error">{{ fieldErrors.blood_type_id }}</p>
          </div>

          <div class="field">
            <label for="ext-vol" class="field-label">Volume (mL) <span class="optional">optional</span></label>
            <input id="ext-vol" v-model.number="form.volume_ml" type="number" inputmode="numeric" min="1" max="1000" class="input" :class="{ 'input--error': fieldErrors.volume_ml }">
            <p v-if="fieldErrors.volume_ml" class="field-error">{{ fieldErrors.volume_ml }}</p>
          </div>

          <div class="field">
            <label for="ext-coll" class="field-label">Collection date <span class="optional">if on the label</span></label>
            <input id="ext-coll" v-model="form.collection_date" type="date" class="input" :max="todayLocal()" :class="{ 'input--error': fieldErrors.collection_date }">
            <p v-if="fieldErrors.collection_date" class="field-error">{{ fieldErrors.collection_date }}</p>
          </div>

          <div class="field">
            <label for="ext-exp" class="field-label">Expiration date <span class="req">*</span></label>
            <input id="ext-exp" v-model="form.expiry_date" type="date" class="input" :min="todayLocal()" :class="{ 'input--error': fieldErrors.expiry_date }">
            <p v-if="fieldErrors.expiry_date" class="field-error">{{ fieldErrors.expiry_date }}</p>
          </div>

          <div class="field">
            <label for="ext-at" class="field-label">Date / time received</label>
            <input id="ext-at" v-model="form.received_at" type="datetime-local" class="input" :max="nowLocal()" :class="{ 'input--error': fieldErrors.received_at }">
            <p v-if="fieldErrors.received_at" class="field-error">{{ fieldErrors.received_at }}</p>
          </div>

          <div class="field">
            <label for="ext-staff" class="field-label">Receiving staff</label>
            <input id="ext-staff" type="text" class="input" :value="staffName" readonly aria-readonly="true">
          </div>
        </div>

        <form v-if="addingSource" class="add-source" @submit.prevent="addSource">
          <input v-model.trim="newSource.name" type="text" class="input" maxlength="150" placeholder="Name of the blood service" aria-label="New blood service name">
          <input v-model.trim="newSource.code" type="text" class="input input--code mono" maxlength="20" placeholder="Code" aria-label="Code, optional">
          <button type="submit" class="btn" :disabled="savingSource || !newSource.name">{{ savingSource ? 'Adding…' : 'Add source' }}</button>
          <p v-if="sourceError" class="field-error">{{ sourceError }}</p>
        </form>

        <div v-if="submitError" class="banner banner--error" role="alert">
          <AssetIcon name="triangle-alert" :size="16" />
          <span>{{ submitError }}</span>
        </div>

        <div class="form-actions">
          <button v-if="mode === 'ptr'" type="button" class="btn" :disabled="busy" @click="cancelPending">Cancel</button>
          <button type="button" class="btn btn--primary" :disabled="busy" @click="receiveExternal">
            <AssetIcon name="package-check" :size="14" />
            {{ busy ? 'Receiving…' : receiveLabel }}
          </button>
        </div>
      </section>

      <!-- ============ RECEIVED FOR THIS PATIENT ============ -->
      <section v-if="mode === 'ptr' && ptr" class="panel" aria-labelledby="got-title">
        <div class="panel__head">
          <div>
            <h2 id="got-title" class="panel__title">Received for this patient</h2>
            <p class="panel__hint">Bags in your blood bank for {{ ptr.reference_number }}, from a blood center or from outside RedAgos.</p>
          </div>
          <NuxtLink :to="`/hospital/transfusion-requests/${ptr.id}`" class="link-btn">Open the request</NuxtLink>
        </div>

        <div v-if="!bags.length" class="empty-state">
          <AssetIcon name="package" :size="32" />
          <p class="empty-state__title">No bags received yet</p>
        </div>

        <div v-else class="table-wrap">
          <table class="rcv-table">
            <thead>
              <tr><th>Unit number</th><th>Type</th><th>Component</th><th>Expiry</th><th>From</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr v-for="bag in bags" :key="bag.id">
                <td class="mono strong">{{ bag.bag_number || bag.unit_id }}</td>
                <td><span class="type-pill">{{ bag.blood_type?.code || '—' }}</span></td>
                <td>{{ bag.component?.name || '—' }}</td>
                <td>{{ formatDate(bag.expiry_date) }}</td>
                <td>{{ bag.source?.direct_distribution?.source_name || bag.source?.reference_number || 'Blood center' }}</td>
                <td>
                  <span class="pill" :class="`tone--${HOSPITAL_UNIT_STATUS_TONES[bag.status] || 'muted'}`">
                    {{ HOSPITAL_UNIT_STATUS_LABELS[bag.status] || bag.status_label }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ============ RECENT ============ -->
      <section class="panel" aria-labelledby="recent-title">
        <div class="panel__head">
          <div>
            <h2 id="recent-title" class="panel__title">Recent external receipts</h2>
            <p class="panel__hint">Bags received from outside RedAgos, newest first.</p>
          </div>
        </div>

        <div v-if="!recent.length" class="empty-state">
          <AssetIcon name="truck" :size="32" />
          <p class="empty-state__title">Nothing received from outside RedAgos yet</p>
        </div>

        <div v-else class="table-wrap">
          <table class="rcv-table">
            <thead>
              <tr><th>Identifier</th><th class="num">Units</th><th>Source</th><th>For</th><th>Type</th><th>Component</th><th>Received</th><th>By</th></tr>
            </thead>
            <tbody>
              <tr v-for="row in recent" :key="row.id">
                <td class="mono strong">{{ row.external_unit_number }}</td>
                <td class="num">{{ row.quantity }}</td>
                <td>{{ row.source?.name || '—' }}</td>
                <td>
                  <NuxtLink v-if="row.transfusion_request" :to="`/hospital/transfusion-requests/${row.transfusion_request.id}`" class="link-btn mono">
                    {{ row.transfusion_request.reference_number }}
                  </NuxtLink>
                  <template v-else>{{ row.requested_for || '—' }}</template>
                </td>
                <td><span class="type-pill">{{ row.blood_type?.code || '—' }}</span></td>
                <td>{{ row.component?.name || '—' }}</td>
                <td>{{ formatDateTime(row.received_at) }}</td>
                <td>{{ row.received_by || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>
  </div>
</template>

<script setup>
/**
 * Direct Distribution: receiving blood for one patient's transfusion request.
 *
 * Staff pick the request, then identify the blood unit by scanning it or, as a
 * fallback, typing the number printed on it. A unit that is one of the
 * request's dispatched RedAgos bags is confirmed received through its own
 * request, never booked a second time. Anything else is an external unit
 * (the Philippine Red Cross, say): its sender's number is kept as is, no
 * barcode of RedAgos's own is issued, and it joins the blood bank's stock
 * linked to the patient's request.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { useUser } from '~/composables/useUser'
import { HOSPITAL_UNIT_STATUS_LABELS, HOSPITAL_UNIT_STATUS_TONES } from '~/types/hospitalInventory'
import { RECEIVING_REFUSAL_MESSAGES } from '~/types/receiving'
import { awaitingBagsFor, matchScannedBag, normalizeUnitNumber, UNIT_NUMBER_PATTERN } from '~/utils/receiving'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard' })

const route = useRoute()
const { user } = useUser()

const ptrSearch = ref('')
const ptrList = ref([])
const ptrLoading = ref(true)
const ptrError = ref('')
const ptrId = ref(route.query.ptr ? Number(route.query.ptr) : null)
const ptr = ref(null)

const bloodTypes = ref([])
const components = ref([])
const sources = ref([])

const bags = ref([])
const recent = ref([])

const entry = ref('')
const numberInput = ref(null)
const scannerArmed = ref(false)
const notice = ref(null)
const busy = ref(false)

/**
 * How the blood is being received: for a patient's request, a unit at a time by
 * scan or typing; or without one, typed by hand as an identifier and a count.
 */
const mode = ref(route.query.mode === 'batch' ? 'batch' : 'ptr')
const batch = reactive({ number: '', quantity: 1, requested_for: '' })

/** The identifier waiting for its external-unit details. */
const pending = ref('')
const form = reactive(blankForm())
const fieldErrors = ref({})
const submitError = ref('')

const addingSource = ref(false)
const newSource = reactive({ name: '', code: '' })
const savingSource = ref(false)
const sourceError = ref('')

const toast = ref('')
let toastTimer = null
let searchTimer = null

const receiveLabel = computed(() => {
  if (mode.value === 'ptr') return 'Receive unit'
  const count = Math.max(1, Number(batch.quantity) || 1)

  return `Receive ${count} unit${count === 1 ? '' : 's'}`
})

const openRequests = computed(() => ptrList.value.filter((request) => request.is_open !== false))
const awaiting = computed(() => awaitingBagsFor(ptr.value?.allocations))
const staffName = computed(() => user.value?.full_name || [user.value?.first_name, user.value?.last_name].filter(Boolean).join(' ') || '—')

const needsLabel = computed(() => (ptr.value?.lines ?? [])
  .map((line) => `${line.quantity} ${line.component?.name ?? 'unit'}`)
  .join(', ') || '—')

watch(ptrSearch, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadRequests, 300)
})

watch(ptrId, (id) => {
  resetEntry()
  if (id) loadPatient(id)
  else { ptr.value = null; bags.value = [] }
})

onMounted(async () => {
  loadRecent()
  loadReference()
  await loadRequests()
  if (ptrId.value) loadPatient(ptrId.value)
})

onUnmounted(() => {
  clearTimeout(toastTimer)
  clearTimeout(searchTimer)
})

function blankForm() {
  return {
    external_blood_source_id: null,
    component_id: null,
    blood_type_id: null,
    volume_ml: null,
    collection_date: '',
    expiry_date: '',
    received_at: nowLocal(),
  }
}

async function loadReference() {
  try {
    const [reference, list] = await Promise.all([hospitalService.referenceData(), hospitalService.externalBloodSources()])

    bloodTypes.value = reference?.blood_types ?? []
    components.value = reference?.components ?? []
    sources.value = list?.sources ?? []
    form.external_blood_source_id ??= sources.value.find((source) => source.code === 'PRC')?.id ?? null
  } catch {
    // The details form needs these; the scan itself does not.
  }
}

async function loadRequests() {
  ptrLoading.value = true
  ptrError.value = ''

  try {
    const response = await hospitalService.listTransfusionRequests({ search: ptrSearch.value.trim() || undefined, per_page: 50 })
    ptrList.value = response.data ?? []
  } catch (err) {
    ptrError.value = err?.message || 'Could not load the patient requests.'
  } finally {
    ptrLoading.value = false
  }
}

async function loadPatient(id) {
  try {
    ptr.value = (await hospitalService.showTransfusionRequest(id)).request
    form.blood_type_id = ptr.value.blood_type?.id ?? null
    await loadBags()
  } catch (err) {
    ptr.value = null
    ptrError.value = RECEIVING_REFUSAL_MESSAGES[err?.data?.code] || err?.message || 'Could not load that request.'
  }
}

async function loadBags() {
  if (!ptr.value) return

  try {
    bags.value = (await hospitalService.inventory({ transfusion_request_id: ptr.value.id, per_page: 100 })).data ?? []
  } catch {
    bags.value = []
  }
}

async function loadRecent() {
  try {
    recent.value = (await hospitalService.directDistributions({ per_page: 10 })).data ?? []
  } catch {
    recent.value = []
  }
}

function armScanner() {
  notice.value = null
  numberInput.value?.focus()
}

function resetEntry() {
  entry.value = ''
  notice.value = null
  cancelPending()
}

function cancelPending() {
  pending.value = ''
  fieldErrors.value = {}
  submitError.value = ''
  addingSource.value = false
}

/**
 * A scanned or typed identifier: a RedAgos bag dispatched for this patient is
 * received through its request; anything else needs its external details.
 */
async function identify() {
  const number = normalizeUnitNumber(entry.value)
  entry.value = ''

  if (!number || !ptr.value) return

  if (!UNIT_NUMBER_PATTERN.test(number)) {
    notice.value = { tone: 'danger', text: 'A unit number may contain only letters, numbers and dashes, up to 50.' }
    return
  }

  const match = matchScannedBag(awaiting.value, new Set(), number)

  if (match.kind === 'matched') {
    await receiveRedAgosBag(match.bag)
    return
  }

  notice.value = null
  pending.value = number
  form.expiry_date = ''
  form.collection_date = ''
  form.received_at = nowLocal()
  fieldErrors.value = {}
  submitError.value = ''
}

async function receiveRedAgosBag(bag) {
  busy.value = true

  try {
    await hospitalService.confirmReceipt(bag.request_id, [bag.allocation_id])
    notice.value = { tone: 'success', text: `${bag.unit_id} received into your blood bank.` }
    await Promise.all([loadPatient(ptr.value.id), loadRecent()])
  } catch (err) {
    notice.value = { tone: 'danger', text: RECEIVING_REFUSAL_MESSAGES[err?.data?.code] || err?.message || 'That bag could not be received.' }
  } finally {
    busy.value = false
  }
}

function setMode(value) {
  if (mode.value === value) return

  mode.value = value
  notice.value = null
  cancelPending()
  // A patient's blood type prefilled for the request mode means nothing without one.
  form.blood_type_id = value === 'ptr' ? (ptr.value?.blood_type?.id ?? null) : null
}

function validate() {
  const errors = {}

  if (mode.value === 'batch') {
    const number = normalizeUnitNumber(batch.number)
    const quantity = Number(batch.quantity)

    if (!number) errors.external_unit_number = 'Type the identifier the sender gave the units.'
    else if (!UNIT_NUMBER_PATTERN.test(number)) errors.external_unit_number = 'Letters, numbers and dashes only, up to 50.'
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) errors.quantity = 'Enter between 1 and 100 units.'
    if (!batch.requested_for) errors.requested_for = 'Say who requested the units — the patient, ward or physician.'
  }

  if (!form.external_blood_source_id) errors.external_blood_source_id = 'Choose the blood service that sent the unit.'
  if (!form.component_id) errors.component_id = 'Select the component.'
  if (!form.blood_type_id) errors.blood_type_id = 'Select the blood type.'
  if (!form.expiry_date) errors.expiry_date = 'Enter the expiry date printed on the unit.'
  fieldErrors.value = errors

  return !Object.keys(errors).length
}

async function receiveExternal() {
  submitError.value = ''

  if (!validate()) {
    submitError.value = 'Check the highlighted fields.'
    return
  }

  busy.value = true

  try {
    const target = mode.value === 'batch'
      ? {
          requested_for: batch.requested_for,
          quantity: Number(batch.quantity),
          external_unit_number: normalizeUnitNumber(batch.number),
        }
      : { transfusion_request_id: ptr.value.id, external_unit_number: pending.value }

    const response = await hospitalService.receiveDirectDistribution({
      ...target,
      external_blood_source_id: form.external_blood_source_id,
      blood_type_id: form.blood_type_id,
      component_id: form.component_id,
      volume_ml: form.volume_ml || null,
      collection_date: form.collection_date || null,
      expiry_date: form.expiry_date,
      // The browser's local time, sent with its offset.
      received_at: form.received_at ? new Date(form.received_at).toISOString() : null,
    })

    showToast(response?.message || 'Received.')

    if (mode.value === 'batch') {
      // Ready for the next delivery; the source and the label details often repeat.
      batch.number = ''
      batch.quantity = 1
      batch.requested_for = ''
      fieldErrors.value = {}
      await loadRecent()
      return
    }

    notice.value = { tone: 'success', text: `${pending.value} received for ${ptr.value.reference_number}.` }
    cancelPending()
    await Promise.all([loadBags(), loadRecent(), loadPatient(ptr.value.id)])
    armScanner()
  } catch (err) {
    if (err?.status === 422) {
      fieldErrors.value = Object.fromEntries(Object.entries(err.errors ?? {}).map(([key, messages]) => [key, Array.isArray(messages) ? messages[0] : messages]))
      submitError.value = Object.values(fieldErrors.value)[0] || 'Check the highlighted fields.'
    } else {
      submitError.value = RECEIVING_REFUSAL_MESSAGES[err?.data?.code] || err?.data?.message || err?.message || 'The unit could not be received.'
    }
  } finally {
    busy.value = false
  }
}

async function addSource() {
  savingSource.value = true
  sourceError.value = ''

  try {
    const response = await hospitalService.addExternalBloodSource({ name: newSource.name, code: newSource.code || null })
    sources.value = [...sources.value, response.source].sort((a, b) => a.name.localeCompare(b.name))
    form.external_blood_source_id = response.source.id
    newSource.name = ''
    newSource.code = ''
    addingSource.value = false
  } catch (err) {
    const first = Object.values(err?.errors ?? {})[0]
    sourceError.value = (Array.isArray(first) ? first[0] : first) || err?.message || 'That source could not be added.'
  } finally {
    savingSource.value = false
  }
}

function showToast(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 4500)
}

function todayLocal() {
  const now = new Date()

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function nowLocal() {
  const now = new Date()

  return `${todayLocal()}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)

  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css; nothing is redeclared here. */
.rcv-page { min-height: 100%; background: var(--rb-page-bg); font-family: var(--rb-font-sans); padding: 20px; }
.rcv-inner { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

.page-title { font-size: 24px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13.5px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 78ch; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.panel {
  background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03); overflow: hidden;
}
.panel--pad { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.panel--off { opacity: 0.55; }
.panel--accent { border-color: rgba(var(--rb-primary-rgb), 0.4); }
.panel__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 16px 16px 10px; }
.panel__title { margin: 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
.panel__hint { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }

.modes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.modes__tab {
  display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; text-align: left; cursor: pointer;
  font: inherit; border-radius: 12px; border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface); color: var(--rb-text-secondary);
}
.modes__tab span { display: flex; flex-direction: column; gap: 2px; }
.modes__tab strong { font-size: 13.5px; color: var(--rb-text-primary); }
.modes__tab small { font-size: 12px; }
.modes__tab:hover { border-color: var(--rb-border-hover); }
.modes__tab:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.modes__tab--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.field--wide { grid-column: span 2; }
.rcv-table .num, .rcv-table thead .num { text-align: right; font-variant-numeric: tabular-nums; }

.ptr-pick { display: flex; gap: 10px; flex-wrap: wrap; }
.ptr-pick .input { flex: 2; min-width: 260px; }
.search-box { position: relative; flex: 1; min-width: 220px; }
.search-box__icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--rb-text-secondary); pointer-events: none; }
.search-box__input {
  width: 100%; height: 38px; padding: 0 10px 0 30px; border-radius: 9px; border: 1px solid var(--rb-border-strong);
  font: inherit; font-size: 13px; background: var(--rb-surface-alt); color: var(--rb-text-primary);
}
.search-box__input:focus { outline: none; border-color: var(--rb-primary); background: var(--rb-surface); }

.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px 18px; margin: 0; }
.fact { display: flex; flex-direction: column; gap: 3px; }
.fact dt { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rb-text-secondary); }
.fact dd { margin: 0; font-size: 13.5px; color: var(--rb-text-primary); }

.scan { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.scan__button { padding: 12px 22px; font-size: 14px; }
.scan__state { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.scan__dot { width: 8px; height: 8px; border-radius: 999px; background: var(--rb-border-strong); }
.scan__state--ready { color: var(--rb-success-text); font-weight: 600; }
.scan__state--ready .scan__dot { background: var(--rb-success); }

.or { display: flex; align-items: center; gap: 12px; margin: 2px 0; color: var(--rb-text-secondary); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; }
.or::before, .or::after { content: ''; flex: 1; height: 1px; background: var(--rb-border); }
.or span { flex: none; }

.manual { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
.field-hint { margin: 0; font-size: 11.5px; color: var(--rb-text-secondary); }

.notice { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12.5px; font-weight: 600; }
.notice--success { color: var(--rb-success-text); }
.notice--danger { color: var(--rb-accent-text); }

.panel__hint .mono { color: var(--rb-text-primary); font-weight: 600; }
.field-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px 14px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field--grow { flex: 1; min-width: 260px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--rb-text-primary); line-height: 1.2; }
.optional { font-weight: 400; color: var(--rb-text-secondary); }
.req { color: var(--rb-accent-text); }
.input {
  width: 100%; height: 38px; padding: 0 10px; font-size: 13px; font-family: inherit; border-radius: 9px;
  border: 1px solid var(--rb-border-strong); background: var(--rb-surface-alt); color: var(--rb-text-primary);
}
.input[readonly] { color: var(--rb-text-secondary); cursor: default; }
.input:focus { outline: none; border-color: var(--rb-primary); background: var(--rb-surface); }
.input:disabled { opacity: 0.6; }
.input--error { border-color: var(--rb-accent); }
.input--code { max-width: 120px; }
.field-error { margin: 0; font-size: 12px; color: var(--rb-accent-text); }
.add-source { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; padding: 12px; border-radius: 10px; background: var(--rb-surface-alt); }
.add-source .input:first-child { flex: 1; min-width: 220px; }

.banner { display: flex; align-items: center; gap: 8px; margin: 0; padding: 11px 14px; border-radius: 10px; font-size: 13px; }
.banner--error { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), 0.25); }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }

.table-wrap { overflow-x: auto; }
.rcv-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rcv-table thead th {
  text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--rb-text-secondary); padding: 10px 14px; background: var(--rb-surface-alt); white-space: nowrap;
}
.rcv-table tbody td { padding: 11px 14px; border-top: 1px solid var(--rb-surface-alt); color: var(--rb-text-primary); white-space: nowrap; }
.rcv-table tbody tr:hover { background: var(--rb-surface-hover); }
.strong { font-weight: 700; }

.empty-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 28px 16px; text-align: center; color: var(--rb-border-strong); }
.empty-state__title { margin: 4px 0 0; font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); }

.type-pill { display: inline-flex; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); }
.pill { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }

.link-btn {
  padding: 0; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text);
  background: none; border: none; cursor: pointer; text-align: left; text-decoration: none; align-self: flex-start;
}
.link-btn:hover { text-decoration: underline; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 38px;
  padding: 0 16px; font-size: 13px; font-weight: 600; font-family: inherit; text-decoration: none;
  border-radius: 9px; cursor: pointer; white-space: nowrap;
  background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong);
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn--primary { background: var(--rb-primary); color: #fff; border-color: var(--rb-primary); }
.btn--primary:hover:not(:disabled) { background: #10509c; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.scan__button { height: auto; }

.toast {
  position: fixed; right: 20px; bottom: 20px; z-index: 330; max-width: min(420px, calc(100vw - 40px));
  padding: 11px 16px; border-radius: 10px; background: var(--rb-text-primary); color: var(--rb-surface);
  font-size: 13px; font-weight: 600;
}
.toast-enter-active, .toast-leave-active { transition: opacity .2s ease, transform .2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(6px); }

.tone--success { background: rgba(var(--rb-success-rgb), 0.14); color: var(--rb-success-text); }
.tone--warning { background: rgba(var(--rb-warning-rgb), 0.16); color: var(--rb-warning-text); }
.tone--danger { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }
.tone--info { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text); }
.tone--progress { background: rgba(var(--rb-purple-rgb), 0.12); color: var(--rb-purple-text); }
.tone--muted { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active, .toast-leave-active { transition: none; }
}

@media (max-width: 900px) {
  .field-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
  .rcv-page { padding: 14px; }
  .field-grid { grid-template-columns: 1fr; }
  .field--wide { grid-column: auto; }
  .modes { grid-template-columns: 1fr; }
  .form-actions > .btn, .scan__button { flex: 1; }
  .ptr-pick .input, .search-box { min-width: 0; width: 100%; }
}
</style>
