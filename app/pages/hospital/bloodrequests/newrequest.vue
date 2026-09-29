<template>
  <div class="nr-page">
    <div class="nr-inner">
      <!-- HEADER -->
      <header class="page-header fade-in" style="--delay:0ms">
        <div>
          <NuxtLink to="/hospital/bloodrequests" class="back-link">
            <AssetIcon name="arrow-left" :size="14" />
            Back to Blood Requests
          </NuxtLink>
          <h1 class="page-title">New Blood Request</h1>
          <p class="page-subtitle">
            Each facility asked receives its own copy of the DOH Blood Request Form (Adult), which you can download from
            that facility's allocation once the request is sent.
          </p>
        </div>
      </header>

      <!-- LOADING -->
      <div v-if="loadingReference" class="panel">
        <div class="skeleton skeleton--line" style="width:40%" />
        <div class="skeleton skeleton--line" style="width:70%" />
        <div class="skeleton skeleton--line" style="width:55%" />
      </div>

      <!-- SUCCESS: PATIENT TRANSFUSION -->
      <section v-else-if="submitted?.kind === 'transfusion'" class="panel panel--success fade-in">
        <div class="success-icon"><AssetIcon name="check" :size="26" /></div>
        <h2 class="success-title">Patient Transfusion Request sent</h2>
        <p class="success-text">
          Reference <strong>{{ submitted.request.reference_number }}</strong>. Each facility below reviews its own share
          and approves or rejects it.
        </p>
        <ul class="success-list">
          <li v-for="allocation in submitted.request.allocations ?? []" :key="allocation.id">
            <strong>{{ allocation.target_facility?.name }}</strong>
            · <span class="mono">{{ allocation.reference_number }}</span>
            · {{ allocation.quantity }} unit{{ allocation.quantity === 1 ? '' : 's' }}
          </li>
        </ul>
        <p v-if="submitted.request.totals.unallocated > 0" class="success-note">
          {{ submitted.request.totals.unallocated }} unit{{ submitted.request.totals.unallocated === 1 ? ' is' : 's are' }}
          still unallocated. You can ask another facility from the request's page.
        </p>
        <div class="success-actions">
          <NuxtLink :to="`/hospital/transfusion-requests/${submitted.request.id}`" class="btn-primary">
            View request
          </NuxtLink>
          <button type="button" class="btn-secondary" @click="startAnother">Raise another</button>
        </div>
      </section>

      <!-- SUCCESS: REPLENISHMENT -->
      <section v-else-if="submitted" class="panel panel--success fade-in">
        <div class="success-icon"><AssetIcon name="check" :size="26" /></div>
        <h2 class="success-title">Request submitted</h2>
        <p class="success-text">
          Your request has been sent to <strong>{{ submitted.request.target_facility?.name }}</strong>.
          Quote reference <strong>{{ submitted.request.reference_number }}</strong> when you follow it up.
        </p>
        <div class="success-actions">
          <button type="button" class="btn-primary" :disabled="downloading" @click="downloadForm">
            <AssetIcon name="download" :size="16" />
            {{ downloading ? 'Preparing…' : 'Download Request Form' }}
          </button>
          <NuxtLink :to="`/hospital/bloodrequests/${submitted.request.id}`" class="btn-secondary">
            View request
          </NuxtLink>
          <button type="button" class="btn-secondary" @click="startAnother">Raise another</button>
        </div>
      </section>

      <form v-else class="nr-form" @submit.prevent="onSubmit">
        <!-- BANNER -->
        <div v-if="submitError" class="banner banner--error" role="alert">
          <AssetIcon name="triangle-alert" :size="16" />
          <span>{{ submitError }}</span>
        </div>

        <!-- STEPS (patient transfusion only) -->
        <ol v-if="requiresPatient" class="steps" aria-label="Request steps">
          <li
            v-for="(label, key, index) in STEPS"
            :key="key"
            class="steps__item"
            :class="{ 'steps__item--on': step === key, 'steps__item--done': stepIndex > index }"
            :aria-current="step === key ? 'step' : undefined"
          >
            <span class="steps__no">{{ index + 1 }}</span>
            {{ label }}
          </li>
        </ol>

        <template v-if="step === 'details'">
          <!-- PURPOSE -->
          <section class="panel fade-in" style="--delay:40ms">
            <h2 class="panel-title">Request purpose</h2>
            <p class="panel-hint">
              A transfusion is for a named patient and may be split across several blood centers. A replenishment
              restocks your own blood bank from one center and carries no patient details.
            </p>

            <div class="choice-grid">
              <label
                v-for="purpose in purposes"
                :key="purpose.value"
                class="choice"
                :class="{ 'choice--on': form.request_purpose === purpose.value }"
              >
                <input
                  v-model="form.request_purpose"
                  type="radio"
                  name="request_purpose"
                  :value="purpose.value"
                  class="sr-only"
                >
                <span class="choice-title">{{ purpose.label }}</span>
                <span class="choice-note">
                  {{ purpose.requires_patient
                    ? 'Blood for a specific patient who needs transfusion.'
                    : 'Restocking your hospital blood bank inventory.' }}
                </span>
              </label>
            </div>
          </section>

          <!-- OWN STOCK CHECK -->
          <section v-if="requiresPatient" class="panel fade-in" style="--delay:50ms">
            <h2 class="panel-title">Your own stock first</h2>
            <p class="panel-hint">
              Check your blood bank's own inventory before asking other facilities. Continue only if it cannot cover
              this patient.
            </p>
            <label class="check" :class="{ 'check--error': errors.stock_confirmed }">
              <input v-model="form.stock_confirmed" type="checkbox">
              <span>We checked our own inventory and it cannot cover this patient's need.</span>
            </label>
            <p v-if="errors.stock_confirmed" class="field-error">{{ errors.stock_confirmed }}</p>
          </section>

          <!-- PATIENT -->
          <section v-if="requiresPatient" class="panel fade-in" style="--delay:60ms">
            <h2 class="panel-title">Patient information</h2>

            <div class="field-grid">
              <div class="field field--wide">
                <label for="p-surname" class="field-label">Surname <span class="req">*</span></label>
                <input
                  id="p-surname"
                  v-model.trim="form.patient_surname"
                  type="text"
                  class="input"
                  :class="{ 'input--error': errors.patient_surname }"
                  maxlength="100"
                >
                <p v-if="errors.patient_surname" class="field-error">{{ errors.patient_surname }}</p>
              </div>

              <div class="field field--wide">
                <label for="p-first" class="field-label">First name <span class="req">*</span></label>
                <input
                  id="p-first"
                  v-model.trim="form.patient_first_name"
                  type="text"
                  class="input"
                  :class="{ 'input--error': errors.patient_first_name }"
                  maxlength="100"
                >
                <p v-if="errors.patient_first_name" class="field-error">{{ errors.patient_first_name }}</p>
              </div>

              <div class="field field--wide">
                <label for="p-middle" class="field-label">Middle name</label>
                <input id="p-middle" v-model.trim="form.patient_middle_name" type="text" class="input" maxlength="100">
              </div>

              <div class="field">
                <label for="p-age" class="field-label">Age <span class="req">*</span></label>
                <input
                  id="p-age"
                  v-model.number="form.patient_age"
                  type="number"
                  min="0"
                  max="130"
                  class="input"
                  :class="{ 'input--error': errors.patient_age }"
                >
                <p v-if="errors.patient_age" class="field-error">{{ errors.patient_age }}</p>
              </div>

              <div class="field">
                <label for="p-sex" class="field-label">Sex <span class="req">*</span></label>
                <select
                  id="p-sex"
                  v-model="form.patient_sex"
                  class="input"
                  :class="{ 'input--error': errors.patient_sex }"
                >
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <p v-if="errors.patient_sex" class="field-error">{{ errors.patient_sex }}</p>
              </div>
            </div>

            <!--
              A watcher may already have taken this patient's request straight to
              a blood center, which then recorded it here after you confirmed it
              by phone. Recording another would ask twice for the same need.
            -->
            <div v-if="patientMatches.length" class="dup-warning" role="status">
              <AssetIcon name="triangle-alert" :size="16" />
              <div>
                <p class="dup-warning__title">This patient already has an active request</p>
                <ul class="dup-warning__list">
                  <li v-for="match in patientMatches" :key="match.id">
                    <NuxtLink :to="`/hospital/transfusion-requests/${match.id}`" class="dup-warning__ref">{{ match.reference_number }}</NuxtLink>
                    · {{ match.facilities?.length ? match.facilities.join(', ') : 'No facility yet' }}
                    · {{ match.source_label }} · {{ match.status_label }}
                    <template v-if="match.totals?.unallocated"> · {{ match.totals.unallocated }} unallocated</template>
                  </li>
                </ul>
                <p class="dup-warning__hint">
                  Open it instead if it covers the same need. If some units are still unallocated, ask another facility
                  for them from that request's page.
                </p>
              </div>
            </div>
          </section>

          <!-- DESTINATION + BLOOD TYPE + PRIORITY -->
          <section class="panel fade-in" style="--delay:80ms">
            <h2 class="panel-title">Request details</h2>

            <div class="field-grid">
              <div v-if="!requiresPatient" class="field field--full">
                <label for="target" class="field-label">Send request to <span class="req">*</span></label>
                <select
                  id="target"
                  v-model.number="form.target_facility_id"
                  class="input"
                  :class="{ 'input--error': errors.target_facility_id }"
                >
                  <option :value="null">Select a blood centre…</option>
                  <option v-for="f in facilities" :key="f.id" :value="f.id">
                    {{ f.name }}<template v-if="f.address"> — {{ f.address }}</template>
                  </option>
                </select>
                <p v-if="errors.target_facility_id" class="field-error">{{ errors.target_facility_id }}</p>
              </div>

              <div class="field field--wide">
                <label for="btype" class="field-label">
                  {{ requiresPatient ? "Patient's blood type" : 'Blood type required' }}
                  <span class="req">*</span>
                </label>
                <select
                  id="btype"
                  v-model.number="form.blood_type_id"
                  class="input"
                  :class="{ 'input--error': errors.blood_type_id }"
                >
                  <option :value="null">Select…</option>
                  <option v-for="t in bloodTypes" :key="t.id" :value="t.id">{{ t.label }}</option>
                </select>
                <p v-if="errors.blood_type_id" class="field-error">{{ errors.blood_type_id }}</p>
              </div>

              <div class="field field--wide">
                <span class="field-label">Priority <span class="req">*</span></span>
                <div class="priority-row">
                  <label
                    v-for="p in priorities"
                    :key="p.value"
                    class="pill"
                    :class="{
                      'pill--on': form.urgency_level === p.value,
                      'pill--stat': p.value === 'emergency',
                    }"
                  >
                    <input v-model="form.urgency_level" type="radio" name="priority" :value="p.value" class="sr-only">
                    {{ p.label }}
                  </label>
                </div>
              </div>
            </div>
          </section>

          <!-- COMPONENTS -->
          <section class="panel fade-in" style="--delay:100ms">
            <div class="panel-head">
              <div>
                <h2 class="panel-title">Components needed</h2>
                <p class="panel-hint">
                  Each component carries its own indication code and unit count. A component can
                  only be listed once.
                </p>
              </div>
              <button
                type="button"
                class="btn-secondary btn-sm"
                :disabled="!canAddLine"
                @click="addLine"
              >
                <AssetIcon name="plus" :size="14" />
                Add component
              </button>
            </div>

            <p v-if="errors.items" class="field-error field-error--block">{{ errors.items }}</p>

            <div v-for="(line, index) in form.items" :key="index" class="line">
              <div class="line-head">
                <span class="line-no">Component {{ index + 1 }}</span>
                <button
                  v-if="form.items.length > 1"
                  type="button"
                  class="btn-link btn-link--danger"
                  @click="removeLine(index)"
                >
                  Remove
                </button>
              </div>

              <div class="field-grid">
                <div class="field field--wide">
                  <label :for="`c-${index}`" class="field-label">Blood component <span class="req">*</span></label>
                  <select
                    :id="`c-${index}`"
                    v-model.number="line.component_id"
                    class="input"
                    :class="{ 'input--error': lineErrors[index]?.component_id }"
                    @change="onComponentChange(line)"
                  >
                    <option :value="null">Select…</option>
                    <option
                      v-for="c in components"
                      :key="c.id"
                      :value="c.id"
                      :disabled="isComponentTaken(c.id, index)"
                    >
                      {{ c.name }}
                    </option>
                  </select>
                  <p v-if="lineErrors[index]?.component_id" class="field-error">
                    {{ lineErrors[index].component_id }}
                  </p>
                </div>

                <div class="field">
                  <label :for="`q-${index}`" class="field-label">No. of units <span class="req">*</span></label>
                  <input
                    :id="`q-${index}`"
                    v-model.number="line.quantity"
                    type="number"
                    min="1"
                    max="100"
                    class="input"
                    :class="{ 'input--error': lineErrors[index]?.quantity }"
                  >
                  <p v-if="lineErrors[index]?.quantity" class="field-error">
                    {{ lineErrors[index].quantity }}
                  </p>
                </div>

                <div class="field field--full">
                  <label :for="`i-${index}`" class="field-label">
                    Indication for transfusion
                    <span v-if="codesFor(line.component_id).length" class="req">*</span>
                  </label>
                  <select
                    :id="`i-${index}`"
                    v-model="line.indication_code"
                    class="input"
                    :class="{ 'input--error': lineErrors[index]?.indication_code }"
                    :disabled="!line.component_id || !codesFor(line.component_id).length"
                  >
                    <option :value="null">
                      {{ line.component_id ? 'Select an indication…' : 'Choose a component first' }}
                    </option>
                    <option v-for="code in codesFor(line.component_id)" :key="code.code" :value="code.code">
                      {{ code.label }} — {{ code.description }}
                    </option>
                  </select>
                  <p v-if="lineErrors[index]?.indication_code" class="field-error">
                    {{ lineErrors[index].indication_code }}
                  </p>
                </div>

                <div v-if="needsExplanation(line)" class="field field--full">
                  <label :for="`o-${index}`" class="field-label">
                    Please specify <span class="req">*</span>
                  </label>
                  <input
                    :id="`o-${index}`"
                    v-model.trim="line.indication_other"
                    type="text"
                    class="input"
                    :class="{ 'input--error': lineErrors[index]?.indication_other }"
                    maxlength="255"
                    placeholder="State the clinical indication"
                  >
                  <p class="field-hint">
                    This code automatically triggers a review of your indication.
                  </p>
                  <p v-if="lineErrors[index]?.indication_other" class="field-error">
                    {{ lineErrors[index].indication_other }}
                  </p>
                </div>
              </div>
            </div>

            <div class="total-row">
              <span>{{ requiresPatient ? 'Total units required' : 'Total units requested' }}</span>
              <strong>{{ totalUnits }}</strong>
            </div>
          </section>

          <!-- ACTIONS -->
          <div class="action-bar">
            <NuxtLink to="/hospital/bloodrequests" class="btn-secondary">Cancel</NuxtLink>
            <button v-if="requiresPatient" type="button" class="btn-primary" :disabled="planLoading" @click="findFacilities">
              <AssetIcon name="search" :size="16" />
              {{ planLoading ? 'Searching…' : 'Find facilities' }}
            </button>
            <button v-else type="submit" class="btn-primary" :disabled="submitting">
              <AssetIcon name="send" :size="16" />
              {{ submitting ? 'Submitting…' : 'Submit Request' }}
            </button>
          </div>
        </template>

        <!-- SOURCING -->
        <template v-else-if="step === 'sourcing'">
          <section class="panel fade-in">
            <h2 class="panel-title">Choose facilities</h2>
            <p class="panel-hint">
              Split the patient's need across facilities. You may ask for less than required and ask another facility
              later; you cannot ask for more.
            </p>
            <SourcingPanel
              v-model="split"
              :plan="plan"
              mode="new"
              :loading="planLoading"
              :error="planError"
              @retry="loadPlan"
            />
          </section>

          <div class="action-bar">
            <button type="button" class="btn-secondary" @click="step = 'details'">Back</button>
            <button type="button" class="btn-primary" :disabled="!plan || splitProblems.length > 0" @click="step = 'review'">
              Review request
            </button>
          </div>
        </template>

        <!-- REVIEW -->
        <template v-else>
          <section class="panel fade-in">
            <h2 class="panel-title">Review</h2>

            <dl class="review">
              <div><dt>Patient</dt><dd>{{ patientName }}, {{ form.patient_age }} · {{ form.patient_sex === 'male' ? 'Male' : 'Female' }}</dd></div>
              <div><dt>Blood type</dt><dd>{{ bloodTypeLabel }}</dd></div>
              <div><dt>Priority</dt><dd>{{ priorityLabel }}</dd></div>
            </dl>

            <h3 class="review__heading">Required, allocated and remaining</h3>
            <ul class="review__list">
              <li v-for="total in splitTotals" :key="total.componentId">
                <strong>{{ total.component }}</strong>
                — {{ total.required }} required · {{ total.allocated }} allocated
                <template v-if="total.remaining > 0"> · <span class="review__open">{{ total.remaining }} left unallocated</span></template>
              </li>
            </ul>

            <h3 class="review__heading">Facilities asked</h3>
            <ul class="review__list">
              <li v-for="share in shares" :key="share.facility_id">
                <strong>{{ facilityName(share.facility_id) }}</strong>
                — {{ share.lines.map((line) => `${componentName(line.component_id)} ${line.quantity}`).join(', ') }}
              </li>
            </ul>

            <p class="panel-hint review__hint">
              Selecting a facility is a request, not a reservation. Each facility reviews its own share and reserves units
              only when it approves.
            </p>
          </section>

          <div class="action-bar">
            <button type="button" class="btn-secondary" :disabled="submitting" @click="step = 'sourcing'">Back</button>
            <button type="submit" class="btn-primary" :disabled="submitting">
              <AssetIcon name="send" :size="16" />
              {{ submitting ? 'Sending…' : 'Send request' }}
            </button>
          </div>
        </template>
      </form>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import SourcingPanel from '~/components/Hospital/SourcingPanel.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import {
  allocationProblems,
  allocationTotals,
  buildAllocationShares,
  buildTransfusionPayload,
  suggestedSplit,
} from '~/utils/transfusionSourcing'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard' })

/*
 * Two requests start here. A replenishment is one form sent to one blood
 * centre. A patient transfusion is a Patient Transfusion Request: staff
 * confirm their own stock cannot cover the patient, record the need, split it
 * across the centres that hold matching stock (earliest expiry first, every
 * quantity editable), review, and send — one facility allocation per centre.
 */

const STEPS = { details: 'Patient & need', sourcing: 'Facilities', review: 'Review' }

const loadingReference = ref(true)
const submitting = ref(false)
const downloading = ref(false)
const submitError = ref('')
/** { kind: 'transfusion' | 'replenishment', request } once sent. */
const submitted = ref(null)

const bloodTypes = ref([])
const components = ref([])
const purposes = ref([])
const priorities = ref([])
const facilities = ref([])

const step = ref('details')
const stepIndex = computed(() => Object.keys(STEPS).indexOf(step.value))

const plan = ref(null)
const planLoading = ref(false)
const planError = ref('')
const split = ref({})

const form = reactive(blankForm())

const errors = reactive({})
const lineErrors = ref([])

function blankForm() {
  return {
    request_purpose: 'patient_transfusion',
    stock_confirmed: false,
    patient_surname: '',
    patient_first_name: '',
    patient_middle_name: '',
    patient_age: null,
    patient_sex: '',
    target_facility_id: null,
    blood_type_id: null,
    urgency_level: 'routine',
    items: [emptyLine()],
  }
}

function emptyLine() {
  return { component_id: null, quantity: 1, indication_code: null, indication_other: '' }
}

const requiresPatient = computed(() => form.request_purpose === 'patient_transfusion')

watch(() => form.request_purpose, () => {
  step.value = 'details'
})

/*
 * Active requirements this blood bank already has for the patient being typed
 * — including one a blood center recorded here after a walk-in. A warning
 * only: a second request can be legitimate, and the decision is the
 * requester's.
 */
const patientMatches = ref([])
let matchTimer = null

watch(
  () => [form.request_purpose, form.patient_surname, form.patient_first_name, form.blood_type_id],
  () => {
    clearTimeout(matchTimer)

    if (!requiresPatient.value || !form.patient_surname || !form.patient_first_name) {
      patientMatches.value = []
      return
    }

    matchTimer = setTimeout(async () => {
      try {
        const response = await hospitalService.patientMatches({
          patient_surname: form.patient_surname,
          patient_first_name: form.patient_first_name,
          blood_type_id: form.blood_type_id || null,
        })
        patientMatches.value = response?.matches ?? []
      } catch {
        // The check is advisory; a failed lookup must not block the form.
        patientMatches.value = []
      }
    }, 500)
  },
)

onUnmounted(() => clearTimeout(matchTimer))
const canAddLine = computed(() => form.items.length < components.value.length && form.items.length < 6)
const totalUnits = computed(() =>
  form.items.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0),
)

const splitTotals = computed(() => allocationTotals(plan.value, split.value))
const splitProblems = computed(() => allocationProblems(plan.value, split.value))
const shares = computed(() => buildAllocationShares(plan.value, split.value))

const patientName = computed(() => [form.patient_surname.toUpperCase() + ',', form.patient_first_name, form.patient_middle_name].filter(Boolean).join(' '))
const bloodTypeLabel = computed(() => bloodTypes.value.find((t) => t.id === form.blood_type_id)?.label ?? '—')
const priorityLabel = computed(() => priorities.value.find((p) => p.value === form.urgency_level)?.label ?? form.urgency_level)

onMounted(async () => {
  try {
    const [reference, eligible] = await Promise.all([
      hospitalService.referenceData(),
      hospitalService.eligibleFacilities(),
    ])

    bloodTypes.value = reference?.blood_types ?? []
    components.value = reference?.components ?? []
    purposes.value = reference?.purposes ?? []
    priorities.value = reference?.priorities ?? []
    facilities.value = eligible?.facilities ?? []
  } catch (err) {
    submitError.value = err?.message || 'Could not load the request form. Please reload the page.'
  } finally {
    loadingReference.value = false
  }
})

/** The indication codes the chosen component allows, straight from the API. */
function codesFor(componentId) {
  if (!componentId) return []
  return components.value.find((c) => c.id === componentId)?.indication_codes ?? []
}

/** Whether the chosen code is an "Others" one, which must be written out. */
function needsExplanation(line) {
  return Boolean(
    codesFor(line.component_id).find((c) => c.code === line.indication_code)?.requires_explanation,
  )
}

/** A component may be ticked once per form, so hide the ones already taken. */
function isComponentTaken(componentId, exceptIndex) {
  return form.items.some((line, i) => i !== exceptIndex && line.component_id === componentId)
}

/** Clear the indication when the component changes — the codes differ per component. */
function onComponentChange(line) {
  line.indication_code = null
  line.indication_other = ''
}

function addLine() {
  form.items.push(emptyLine())
}

function removeLine(index) {
  form.items.splice(index, 1)
  lineErrors.value.splice(index, 1)
}

function componentName(id) {
  return components.value.find((c) => c.id === id)?.name ?? 'Component'
}

/** A centre's name, from wherever the plan listed it. */
function facilityName(id) {
  for (const line of plan.value?.lines ?? []) {
    const found = line.facilities.find((h) => h.facility.id === id)?.facility
      ?? line.other_facilities.find((f) => f.id === id)

    if (found) return found.name
  }

  return facilities.value.find((f) => f.id === id)?.name ?? 'Facility'
}

/**
 * Check the first step before it moves on.
 *
 * Deliberately a mirror of the server's form requests rather than the only
 * guard: the server refuses the same things, and anything it rejects is shown
 * through applyServerErrors().
 */
function validate() {
  Object.keys(errors).forEach((key) => delete errors[key])
  lineErrors.value = form.items.map(() => ({}))

  if (!form.blood_type_id) errors.blood_type_id = 'Select the blood type required.'

  if (requiresPatient.value) {
    if (!form.stock_confirmed) errors.stock_confirmed = "Confirm your own stock cannot cover this patient before asking other facilities."
    if (!form.patient_surname) errors.patient_surname = 'Enter the patient surname.'
    if (!form.patient_first_name) errors.patient_first_name = 'Enter the patient first name.'
    if (form.patient_age === null || form.patient_age === '') errors.patient_age = 'Enter the patient age.'
    if (!form.patient_sex) errors.patient_sex = 'Select the patient sex.'
  } else if (!form.target_facility_id) {
    errors.target_facility_id = 'Choose the facility this request is being sent to.'
  }

  if (form.items.length === 0) errors.items = 'Add at least one blood component to this request.'

  form.items.forEach((line, index) => {
    const lineError = lineErrors.value[index]

    if (!line.component_id) lineError.component_id = 'Select the blood component required.'
    if (!line.quantity || line.quantity < 1) lineError.quantity = 'Request at least one unit.'
    if (line.quantity > 100) lineError.quantity = 'A single component cannot exceed 100 units.'

    if (line.component_id && codesFor(line.component_id).length && !line.indication_code) {
      lineError.indication_code = 'Select the indication for this component.'
    }

    if (needsExplanation(line) && !line.indication_other) {
      lineError.indication_other = 'This code requires you to specify the reason.'
    }
  })

  return (
    Object.keys(errors).length === 0 &&
    lineErrors.value.every((lineError) => Object.keys(lineError).length === 0)
  )
}

/** Surface Laravel's validation bag against the fields it names. */
function applyServerErrors(bag) {
  Object.entries(bag ?? {}).forEach(([key, messages]) => {
    const message = Array.isArray(messages) ? messages[0] : messages
    const line = key.match(/^(?:items|lines)\.(\d+)\.(\w+)$/)

    if (line) {
      const index = Number(line[1])
      lineErrors.value[index] = { ...(lineErrors.value[index] ?? {}), [line[2]]: message }
      return
    }

    errors[key === 'internal_stock_confirmed' ? 'stock_confirmed' : key] = message
  })
}

function requirementLines() {
  return form.items.map((line) => ({
    component_id: line.component_id,
    quantity: Number(line.quantity),
    indication_code: line.indication_code,
    ...(line.indication_other ? { indication_other: line.indication_other } : {}),
  }))
}

/** Plan the need across the network, then move to the facility step. */
async function findFacilities() {
  submitError.value = ''

  if (!validate()) {
    submitError.value = 'Please correct the highlighted fields.'
    return
  }

  step.value = 'sourcing'
  await loadPlan()
}

async function loadPlan() {
  planLoading.value = true
  planError.value = ''

  try {
    plan.value = await hospitalService.draftSourcing({
      blood_type_id: form.blood_type_id,
      lines: form.items.map((line) => ({ component_id: line.component_id, quantity: Number(line.quantity) })),
    })
    split.value = suggestedSplit(plan.value)
  } catch (err) {
    planError.value = err?.message || 'Could not search the network. Please try again.'
  } finally {
    planLoading.value = false
  }
}

async function onSubmit() {
  if (requiresPatient.value) {
    if (step.value === 'review') await sendTransfusion()
    return
  }

  await sendReplenishment()
}

async function sendTransfusion() {
  submitError.value = ''

  if (splitProblems.value.length) {
    step.value = 'sourcing'
    return
  }

  submitting.value = true

  try {
    const draft = {
      bloodTypeId: form.blood_type_id,
      urgency: form.urgency_level,
      patient: {
        surname: form.patient_surname,
        firstName: form.patient_first_name,
        middleName: form.patient_middle_name ?? '',
        age: form.patient_age,
        sex: form.patient_sex,
      },
      lines: requirementLines(),
    }

    const response = await hospitalService.createTransfusionRequest(buildTransfusionPayload(draft, plan.value, split.value))
    submitted.value = { kind: 'transfusion', request: response.request }
  } catch (err) {
    const bag = err?.errors ?? {}
    applyServerErrors(bag)
    submitError.value = err?.message || 'Could not send the request. Please try again.'

    // Send staff back to wherever the server found the problem.
    const keys = Object.keys(bag)
    if (keys.some((key) => key.startsWith('allocations'))) step.value = 'sourcing'
    else if (keys.length) step.value = 'details'
  } finally {
    submitting.value = false
  }
}

async function sendReplenishment() {
  submitError.value = ''

  if (!validate()) {
    submitError.value = 'Please correct the highlighted fields.'
    return
  }

  submitting.value = true

  try {
    const response = await hospitalService.createRequest({
      target_facility_id: form.target_facility_id,
      blood_type_id: form.blood_type_id,
      urgency_level: form.urgency_level,
      request_purpose: 'replenishment',
      items: requirementLines(),
    })
    submitted.value = { kind: 'replenishment', request: response.request }
  } catch (err) {
    applyServerErrors(err?.errors)
    submitError.value = err?.message || 'Could not submit the request. Please try again.'
  } finally {
    submitting.value = false
  }
}

async function downloadForm() {
  const request = submitted.value?.request

  if (!request || downloading.value) return

  downloading.value = true

  try {
    const blob = await hospitalService.downloadRequestForm(request.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `BRF-${request.reference_number}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    submitError.value = err?.message || 'Could not download the request form.'
  } finally {
    downloading.value = false
  }
}

function startAnother() {
  submitted.value = null
  submitError.value = ''
  step.value = 'details'
  plan.value = null
  split.value = {}
  Object.keys(errors).forEach((key) => delete errors[key])
  lineErrors.value = []

  Object.assign(form, blankForm())
}
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css; nothing is redeclared here. */
.nr-page {
  min-height: 100%;
  background: var(--rb-page-bg);
  font-family: var(--rb-font-sans);
  padding: 20px;
}
.nr-inner { max-width: 880px; margin: 0 auto; }

.page-header { margin-bottom: 18px; }
.back-link {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; color: var(--rb-text-secondary); text-decoration: none; margin-bottom: 8px;
}
.back-link:hover { color: var(--rb-primary-text); }
.page-title { font-size: 24px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13.5px; color: var(--rb-text-secondary); margin: 4px 0 0; max-width: 62ch; }

.nr-form { display: flex; flex-direction: column; gap: 16px; }

.panel {
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  padding: 20px;
}
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.panel-title { font-size: 15px; font-weight: 700; color: var(--rb-text-primary); margin: 0 0 4px; }
.panel-hint { font-size: 12.5px; color: var(--rb-text-secondary); margin: 0 0 14px; max-width: 64ch; }

.banner {
  display: flex; align-items: center; gap: 8px;
  padding: 11px 14px; border-radius: 10px; font-size: 13px;
}
.banner--error {
  background: rgba(var(--rb-accent-rgb), 0.08);
  color: var(--rb-accent-text);
  border: 1px solid rgba(var(--rb-accent-rgb), 0.25);
}

/* Purpose choice */
.choice-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.choice {
  display: flex; flex-direction: column; gap: 4px;
  padding: 14px; border: 1.5px solid var(--rb-border-strong);
  border-radius: 12px; cursor: pointer; transition: border-color .15s, background .15s;
}
.choice:hover { border-color: var(--rb-border-hover); background: var(--rb-surface-hover); }
.choice--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), 0.05); }
.choice-title { font-size: 13.5px; font-weight: 600; color: var(--rb-text-primary); }
.choice-note { font-size: 12px; color: var(--rb-text-secondary); }

/* Fields */
.field-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; grid-column: span 1; }
.field--wide { grid-column: span 2; }
.field--full { grid-column: 1 / -1; }
.field-label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.req { color: var(--rb-accent-text); }
.input {
  width: 100%; padding: 9px 11px; font-size: 13.5px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
  transition: border-color .15s, box-shadow .15s;
}
.input:focus {
  outline: none; border-color: var(--rb-primary);
  box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.12);
}
.input:disabled { background: var(--rb-surface-alt); color: var(--rb-text-muted); cursor: not-allowed; }
.input--error { border-color: var(--rb-accent); }
.input::placeholder { color: var(--rb-placeholder); }
.field-error { font-size: 11.5px; color: var(--rb-accent-text); margin: 0; }

.dup-warning {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(var(--rb-warning-rgb), .12);
  color: var(--rb-warning-text);
  font-size: 13px;
  line-height: 1.5;
}
.dup-warning__title { margin: 0; font-weight: 700; }
.dup-warning__list { margin: 4px 0; padding-left: 18px; color: var(--rb-text-primary); }
.dup-warning__ref { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; color: var(--rb-primary-text); }
.dup-warning__hint { margin: 0; color: var(--rb-text-secondary); }
.field-error--block { margin-bottom: 10px; }
.field-hint { font-size: 11.5px; color: var(--rb-text-secondary); margin: 0; }

/* Priority pills */
.priority-row { display: flex; gap: 8px; }
.pill {
  flex: 1; text-align: center; padding: 9px 12px; cursor: pointer;
  font-size: 13px; font-weight: 600; color: var(--rb-text-secondary);
  border: 1.5px solid var(--rb-border-strong); border-radius: 9px;
  transition: border-color .15s, background .15s, color .15s;
}
.pill:hover { border-color: var(--rb-border-hover); }
.pill--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), 0.06); color: var(--rb-primary-text); }
.pill--stat.pill--on { border-color: var(--rb-accent); background: rgba(var(--rb-accent-rgb), 0.07); color: var(--rb-accent-text); }

/* Component lines */
.line {
  border: 1px solid var(--rb-border);
  border-radius: 12px; padding: 14px; margin-bottom: 12px;
  background: var(--rb-surface-alt);
}
.line-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.line-no { font-size: 12px; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; color: var(--rb-text-secondary); }
.total-row {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: 12px; border-top: 1px dashed var(--rb-border-strong);
  font-size: 13.5px; color: var(--rb-text-secondary);
}
.total-row strong { font-size: 16px; color: var(--rb-text-primary); }

/* Buttons */
.btn-primary, .btn-secondary {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 10px 18px; font-size: 13.5px; font-weight: 600; font-family: inherit;
  border-radius: 9px; cursor: pointer; text-decoration: none;
  transition: background .15s, border-color .15s, opacity .15s;
}
.btn-primary { background: var(--rb-primary); color: #fff; border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: #10509c; }
.btn-secondary { background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong); }
.btn-secondary:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn-primary:disabled, .btn-secondary:disabled { opacity: .55; cursor: not-allowed; }
.btn-sm { padding: 7px 12px; font-size: 12.5px; }
.btn-link {
  background: none; border: none; padding: 0; cursor: pointer;
  font-size: 12.5px; font-weight: 600; font-family: inherit; color: var(--rb-text-secondary);
}
.btn-link--danger { color: var(--rb-accent-text); }

.action-bar {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 4px 0 24px;
}

/* Success */
.panel--success { text-align: center; padding: 34px 20px; }
.success-icon {
  width: 54px; height: 54px; margin: 0 auto 14px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%; color: #fff; background: var(--rb-success);
}
.success-title { font-size: 19px; font-weight: 700; color: var(--rb-text-primary); margin: 0 0 6px; }
.success-text { font-size: 13.5px; color: var(--rb-text-secondary); margin: 0 auto 18px; max-width: 52ch; }
.success-actions { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }

/* Skeletons */
.skeleton {
  height: 13px; border-radius: 6px; margin-bottom: 10px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

.fade-in { animation: fade-in .32s ease both; animation-delay: var(--delay, 0ms); }
@keyframes fade-in { from { opacity: 0; transform: translateY(5px) } to { opacity: 1; transform: none } }

@media (prefers-reduced-motion: reduce) {
  .fade-in, .skeleton { animation: none; }
}

@media (max-width: 720px) {
  .nr-page { padding: 14px; }
  .choice-grid { grid-template-columns: 1fr; }
  .field-grid { grid-template-columns: repeat(2, 1fr); }
  .field--wide, .field--full { grid-column: 1 / -1; }
  .action-bar { flex-direction: column-reverse; }
  .action-bar > * { width: 100%; }
}
/* Steps (patient transfusion) */
.steps {
  display: flex; gap: 8px; margin: 0; padding: 0; list-style: none; flex-wrap: wrap;
}
.steps__item {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 12px 6px 6px; border-radius: 999px;
  font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary);
  background: var(--rb-surface); border: 1px solid var(--rb-border);
}
.steps__no {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%;
  font-size: 11.5px; background: var(--rb-surface-alt); color: var(--rb-text-secondary);
}
.steps__item--on { color: var(--rb-primary-text); border-color: var(--rb-primary); }
.steps__item--on .steps__no { background: var(--rb-primary); color: #fff; }
.steps__item--done .steps__no { background: rgba(var(--rb-success-rgb), .16); color: var(--rb-success-text); }

/* Own stock confirmation */
.check {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 14px; border: 1.5px solid var(--rb-border-strong); border-radius: 10px;
  font-size: 13.5px; color: var(--rb-text-primary); cursor: pointer;
}
.check input { margin-top: 2px; width: 16px; height: 16px; accent-color: var(--rb-primary); }
.check--error { border-color: var(--rb-accent); }

/* Review */
.review { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 8px 0 16px; }
.review dt { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; color: var(--rb-text-secondary); }
.review dd { margin: 2px 0 0; font-size: 13.5px; color: var(--rb-text-primary); }
.review__heading { font-size: 13px; font-weight: 700; color: var(--rb-text-primary); margin: 14px 0 6px; }
.review__list { margin: 0; padding-left: 18px; font-size: 13.5px; line-height: 1.6; color: var(--rb-text-primary); }
.review__open { color: var(--rb-warning-text); font-weight: 600; }
.review__hint { margin: 14px 0 0; }

.success-list { margin: 0 auto 14px; padding: 0; list-style: none; font-size: 13.5px; line-height: 1.7; color: var(--rb-text-primary); }
.success-note { font-size: 13px; color: var(--rb-warning-text); margin: 0 auto 16px; max-width: 52ch; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

@media (max-width: 720px) {
  .review { grid-template-columns: 1fr; }
}
</style>
