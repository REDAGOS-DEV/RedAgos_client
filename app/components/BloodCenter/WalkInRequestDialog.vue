<template>
  <div class="dialog-backdrop" @click.self="requestClose">
    <div
      ref="dialogRef"
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="walk-in-title"
      tabindex="-1"
      @keydown.esc="requestClose"
    >
      <header class="dialog__header">
        <div>
          <h2 id="walk-in-title" class="dialog__title">
            <AssetIcon name="clipboard-plus" :size="18" />
            New walk-in request
          </h2>
        </div>
        <button type="button" class="icon-btn" aria-label="Close" :disabled="saving" @click="requestClose">
          <AssetIcon name="x" :size="18" />
        </button>
      </header>

      <ol class="steps" aria-label="Progress">
        <li
          v-for="(label, index) in STEP_LABELS"
          :key="label"
          class="steps__item"
          :class="{ 'is-current': step === index + 1, 'is-done': step > index + 1 }"
          :aria-current="step === index + 1 ? 'step' : undefined"
        >
          <span class="steps__num">{{ index + 1 }}</span>
          <span class="steps__label">{{ label }}</span>
        </li>
      </ol>

      <div v-if="loadingReference" class="dialog__loading">Loading the request form…</div>
      <p v-else-if="referenceError" class="dialog__error" role="alert">{{ referenceError }}</p>

      <template v-else-if="reference">
        <!-- STEP 1: WHO IS THIS FOR — AND DO THEY ALREADY HAVE A REQUEST? -->
        <section v-show="step === 1" class="step">
          <div class="grid">
            <label class="field field--wide">
              <span class="field__label">Choose hospital blood bank *</span>
              <SelectField
                v-model="hospitalChoice"
                :options="[
                  ...reference.hospitals.map((hospital) => ({
                    value: hospital.id,
                    label: hospital.registered === false ? `${hospital.name} (not on RedAgos)` : hospital.name,
                  })),
                  { value: NEW_HOSPITAL, label: 'Not in the list — type its name…' },
                ]"
                placeholder="Select the hospital"
                :disabled="isContinuing"
              />
            </label>

            <!-- A hospital not on RedAgos (project owner, 2026-10-19): its name only. -->
            <label v-if="typingHospital" class="field field--wide">
              <span class="field__label">Hospital name *</span>
              <input v-model="form.hospitalName" class="field__input" maxlength="150" placeholder="e.g. St. Jude Hospital" autocomplete="off" :disabled="isContinuing">
            </label>
            <p v-if="hospitalNotOnRedAgos" class="field__hint field--wide">
              This hospital is not on RedAgos: it will not be notified and cannot follow the request. The watcher takes
              the units, and a referral slip if this center cannot supply everything.
            </p>

            <!-- The whole patient on this step (project owner, 2026-10-31): what was on
                 step 2 is here, the ward is no longer asked, the physician optional. -->
            <label class="field">
              <span class="field__label">Surname *</span>
              <input v-model="form.patient.surname" class="field__input" maxlength="100" :disabled="isContinuing" autocomplete="off">
            </label>
            <label class="field">
              <span class="field__label">First name *</span>
              <input v-model="form.patient.firstName" class="field__input" maxlength="100" :disabled="isContinuing" autocomplete="off">
            </label>
            <label v-if="!isContinuing" class="field">
              <span class="field__label">Middle name <span class="field__optional">(optional)</span></span>
              <input v-model="form.patient.middleName" class="field__input" maxlength="100" autocomplete="off">
            </label>
            <label v-if="!isContinuing" class="field">
              <span class="field__label">Age *</span>
              <input v-model="form.patient.age" type="number" min="0" max="130" class="field__input">
            </label>
            <label v-if="!isContinuing" class="field">
              <span class="field__label">Sex *</span>
              <SelectField
                v-model="form.patient.sex"
                :options="[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]"
                placeholder="Select"
              />
            </label>

            <label class="field">
              <span class="field__label">Blood type *</span>
              <SelectField
                v-model="form.bloodTypeId"
                :options="reference.blood_types.map((type) => ({ value: type.id, label: type.code }))"
                placeholder="Select the blood type"
                :disabled="isContinuing"
              />
            </label>
            <label class="field">
              <span class="field__label">Priority *</span>
              <SelectField
                v-model="form.urgency"
                :options="reference.priorities.map((priority) => ({ value: priority.value, label: priority.label }))"
              />
            </label>
            <label class="field">
              <span class="field__label">Attending physician <span class="field__optional">(optional)</span></span>
              <input v-model="form.attendingPhysician" class="field__input" maxlength="150" autocomplete="off">
            </label>
            <label class="field">
              <span class="field__label">Patient record no. <span class="field__optional">(optional)</span></span>
              <input v-model="form.patientRecordNumber" class="field__input" maxlength="60" autocomplete="off">
            </label>
            <label class="field">
              <span class="field__label">Reference on the watcher's paperwork <span class="field__optional">(optional)</span></span>
              <input v-model="form.presentedReference" class="field__input" maxlength="60" placeholder="e.g. RQ-4-0012" autocomplete="off">
            </label>
          </div>

          <div class="step__actions-inline">
            <button type="button" class="btn" :disabled="checking || !canCheck" @click="checkDuplicates">
              <AssetIcon name="search" :size="14" />
              {{ checking ? 'Checking…' : lookupDone ? 'Check again' : 'Check for existing requests' }}
            </button>
            <span v-if="lookupDone && !matches.length" class="ok-text">
              <AssetIcon name="check" :size="14" /> No active request found for this patient.
            </span>
          </div>

          <div v-if="isContinuing" class="banner banner--info">
            <AssetIcon name="route" :size="15" />
            <span>
              Adding this center's share to <strong class="mono">{{ form.transfusionReference }}</strong>. The patient,
              blood type and components come from that request; only its unallocated units can be asked for here.
            </span>
            <button type="button" class="link-btn" @click="undoContinuation">Record separately instead</button>
          </div>

          <ul v-if="matches.length" class="matches">
            <li v-for="match in matches" :key="match.id" class="match" :class="`match--${match.relation}`">
              <div class="match__head">
                <span class="mono match__ref">{{ match.reference_number }}</span>
                <span class="chip">{{ DUPLICATE_RELATION_LABELS[match.relation] }}</span>
                <span class="chip chip--muted">{{ requestStatusLabel(match) }}</span>
              </div>
              <p class="match__meta">
                {{ match.patient.full_name || '—' }} · {{ match.blood_type?.code || '—' }}
                · {{ match.facilities?.length ? match.facilities.join(', ') : 'No facility yet' }} · {{ match.source_label }}
                · {{ formatDate(match.request_date) }}
              </p>
              <p class="match__lines">
                <span v-for="line in match.lines" :key="line.transfusion_request_item_id">
                  {{ line.component.name }} {{ line.approved }}/{{ line.required }} approved<template v-if="line.unallocated"> ({{ line.unallocated }} unallocated)</template>
                </span>
              </p>
              <div class="match__actions">
                <button
                  v-if="match.relation === 'here' && match.allocation"
                  type="button"
                  class="btn btn--primary btn--sm"
                  @click="$emit('open-existing', match.allocation.id)"
                >
                  Open {{ match.allocation.reference_number }} instead
                </button>
                <button
                  v-if="match.relation === 'continue' && form.transfusionRequestId !== match.id"
                  type="button"
                  class="btn btn--primary btn--sm"
                  @click="useAsContinuation(match)"
                >
                  Add this center's share — {{ match.unallocated_quantity }} unallocated unit{{ match.unallocated_quantity === 1 ? '' : 's' }}
                </button>
                <span v-if="form.transfusionRequestId === match.id" class="ok-text">
                  <AssetIcon name="check" :size="14" /> Adding to this request
                </span>
              </div>
            </li>
          </ul>

          <p v-if="acknowledgementNeeded.length" class="field__hint">
            To record a separate request anyway, you will be asked why on the last step.
          </p>
        </section>

        <!-- STEP 2: THE REQUEST AND THE WATCHER -->
        <section v-show="step === 2" class="step">
          <h3 class="step__heading">Components requested</h3>
          <div class="lines">
            <div v-for="(line, index) in form.lines" :key="index" class="line">
              <label class="field">
                <span class="field__label">Component</span>
                <SelectField
                  v-model="line.componentId"
                  :options="reference.components.map((component) => ({ value: component.id, label: component.name }))"
                  placeholder="Select"
                  :disabled="isContinuing"
                  @change="line.indicationCode = ''"
                />
              </label>
              <label class="field field--narrow">
                <span class="field__label">Units{{ line.maxQuantity !== null ? ` (max ${line.maxQuantity})` : '' }}</span>
                <input v-model="line.quantity" type="number" min="1" :max="line.maxQuantity ?? 100" class="field__input">
              </label>
              <template v-if="!isContinuing">
                <label v-if="indicationsFor(line).length" class="field field--grow">
                  <span class="field__label">Indication</span>
                  <SelectField
                    v-model="line.indicationCode"
                    :options="indicationsFor(line).map((code) => ({ value: code.code, label: `${code.label} — ${code.description}` }))"
                    placeholder="Select the clinical indication"
                  />
                </label>
                <label v-if="needsExplanation(line)" class="field field--grow">
                  <span class="field__label">Specify</span>
                  <input v-model="line.indicationOther" class="field__input" maxlength="255">
                </label>
              </template>
              <!-- A continuing watcher may carry only some of what is unallocated. -->
              <button
                v-if="form.lines.length > 1"
                type="button"
                class="icon-btn line__remove"
                :aria-label="`Remove line ${index + 1}`"
                @click="form.lines.splice(index, 1)"
              >
                <AssetIcon name="trash-2" :size="15" />
              </button>
            </div>
            <button
              v-if="!isContinuing && form.lines.length < reference.components.length && form.lines.length < 6"
              type="button"
              class="link-btn"
              @click="form.lines.push(blankLine())"
            >
              <AssetIcon name="plus" :size="14" /> Add another component
            </button>
          </div>

          <h3 class="step__heading">Watcher presenting the request</h3>
          <p class="field__hint">Recorded as the representative who brought it. The hospital remains the requester.</p>
          <div class="grid">
            <label class="field">
              <span class="field__label">Full name *</span>
              <input v-model="form.representative.name" class="field__input" maxlength="150" autocomplete="off">
            </label>
            <label class="field">
              <span class="field__label">Relationship to patient *</span>
              <input v-model="form.representative.relationship" class="field__input" maxlength="60" placeholder="e.g. Son, Spouse" autocomplete="off">
            </label>
            <label class="field">
              <span class="field__label">Contact number *</span>
              <input v-model="form.representative.contact" class="field__input" maxlength="30" autocomplete="off">
            </label>
            <label class="field">
              <span class="field__label">ID presented</span>
              <SelectField
                v-model="form.representative.idType"
                :options="[{ value: '', label: 'None' }, ...reference.id_types.map((type) => ({ value: type.value, label: type.label }))]"
              />
            </label>
            <label v-if="form.representative.idType" class="field">
              <span class="field__label">ID number *</span>
              <!-- The chosen card's sample number and where it is, as on Register (2026-10-31). -->
              <input
                v-model="form.representative.idNumber"
                class="field__input"
                maxlength="50"
                autocomplete="off"
                :placeholder="watcherIdFormat.placeholder"
                aria-describedby="watcher-id-hint"
              >
            </label>
            <!-- Under the row, so the ID fields stay level (2026-10-31). -->
            <p v-if="form.representative.idType && watcherIdFormat.hint" id="watcher-id-hint" class="field__hint field--wide id-hint">
              <AssetIcon name="id-card" :size="14" />
              {{ watcherIdFormat.hint }}
            </p>
          </div>
        </section>

        <!-- STEP 3: REVIEW -->
        <section v-show="step === 3" class="step">
          <dl class="review">
            <div>
              <dt>Hospital (requester)</dt>
              <dd>{{ hospitalLabel || '—' }}<template v-if="hospitalNotOnRedAgos"> · not on RedAgos</template></dd>
            </div>
            <div><dt>Patient</dt><dd>{{ patientName || '—' }}</dd></div>
            <div><dt>Blood type</dt><dd>{{ bloodTypeCode || '—' }}</dd></div>
            <div><dt>Priority</dt><dd>{{ priorityLabel }}</dd></div>
            <div><dt>Presented by</dt><dd>{{ form.representative.name }} · {{ form.representative.relationship }}</dd></div>
            <div v-if="isContinuing" class="review__wide"><dt>Added to</dt><dd class="mono">{{ form.transfusionReference }}</dd></div>
            <div class="review__wide">
              <dt>Components</dt>
              <dd>
                <span v-for="(line, index) in form.lines" :key="index" class="chip">
                  {{ componentName(line.componentId) }} × {{ line.quantity }}
                </span>
              </dd>
            </div>
          </dl>

          <label v-if="acknowledgementNeeded.length" class="field">
            <span class="field__label">
              Why a separate request is needed * — {{ acknowledgementNeeded.map((match) => match.reference_number).join(', ') }}
              {{ acknowledgementNeeded.length === 1 ? 'is' : 'are' }} already open for this patient
            </span>
            <textarea v-model="form.duplicateAcknowledgement" class="field__input" rows="2" maxlength="255" />
          </label>
        </section>

        <ul v-if="problems.length && attempted" class="problems" role="alert">
          <li v-for="problem in problems" :key="problem">{{ problem }}</li>
        </ul>
        <p v-if="submitError" class="dialog__error" role="alert">{{ submitError }}</p>
      </template>

      <footer class="dialog__footer">
        <button v-if="step > 1" type="button" class="btn" :disabled="saving" @click="back">Back</button>
        <span class="dialog__spacer" />
        <button type="button" class="btn" :disabled="saving" @click="requestClose">Cancel</button>
        <button
          v-if="step < 3"
          type="button"
          class="btn btn--primary"
          :disabled="!reference || (step === 1 && !lookupDone)"
          @click="next"
        >
          Continue
        </button>
        <button v-if="step === 3" type="button" class="btn btn--primary" :disabled="saving" @click="submit">
          {{ saving ? 'Recording…' : 'Record request' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
/**
 * Record a Patient Transfusion request a watcher brought to the blood centre.
 *
 * Three steps, in the order the counter works: who the blood is for and whether
 * the hospital already has a request for them; the request itself and the
 * watcher; then a review. Nothing is sent until the last step.
 *
 * The phone call to the hospital blood bank that came second was removed by the
 * project owner on 2026-10-19, and with it the rule that nothing was recorded
 * until the hospital confirmed. Step one needs the hospital, the patient's
 * surname and first name, and the blood type; the reference on the watcher's
 * paperwork is optional. Since 2026-10-31 it holds the whole patient (age,
 * sex, priority; physician and record number optional, no ward), and step two
 * the components and the watcher.
 */

import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { validIdFormat } from '~/utils/validIdTypes'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { PRIORITY_LABELS, requestStatusLabel } from '~/types/bloodRequest'
import {
  DUPLICATE_RELATION_LABELS,
  applyContinueMatch,
  blankLine,
  blankWalkInForm,
  buildWalkInPayload,
  clearContinuation,
  matchesNeedingAcknowledgement,
  walkInStepProblems,
} from '~/utils/requestFulfilment'
import SelectField from '~/components/common/SelectField.vue'

const emit = defineEmits(['close', 'created', 'open-existing'])

const STEP_LABELS = ['Patient', 'Request & watcher', 'Review']

// The watcher's ID: the chosen card's sample number and where it is.
const watcherIdFormat = computed(() => validIdFormat(form.value.representative.idType))
const STEP_KEYS = { 1: 'lookup', 2: 'details' }

const dialogRef = ref(null)
const step = ref(1)
const form = ref(blankWalkInForm())

const reference = ref(null)
const loadingReference = ref(true)
const referenceError = ref('')

const checking = ref(false)
const lookupDone = ref(false)
const matches = ref([])

const attempted = ref(false)
const saving = ref(false)
const submitError = ref('')

const isContinuing = computed(() => form.value.transfusionRequestId !== null)
const selectedHospital = computed(() => reference.value?.hospitals.find((h) => h.id === form.value.hospitalId) ?? null)

// The hospital select: an id from the list, or NEW_HOSPITAL to type the name
// of one not on RedAgos (project owner, 2026-10-19).
const NEW_HOSPITAL = 'new'
const typingHospital = ref(false)
const hospitalChoice = computed({
  get: () => (typingHospital.value ? NEW_HOSPITAL : form.value.hospitalId),
  set: (value) => {
    typingHospital.value = value === NEW_HOSPITAL
    form.value.hospitalId = typingHospital.value || value === null ? null : Number(value)
    if (!typingHospital.value) form.value.hospitalName = ''
  },
})
// Typed by hand, or one an earlier walk-in named.
const hospitalNotOnRedAgos = computed(() => (typingHospital.value && Boolean(form.value.hospitalName.trim())) || selectedHospital.value?.registered === false)
const hospitalLabel = computed(() => selectedHospital.value?.name || form.value.hospitalName.trim())
const bloodTypeCode = computed(() => reference.value?.blood_types.find((t) => t.id === form.value.bloodTypeId)?.code ?? '')
const priorityLabel = computed(() => PRIORITY_LABELS[form.value.urgency] ?? form.value.urgency)

const patientName = computed(() => {
  const { surname, firstName, middleName } = form.value.patient
  const given = [firstName, middleName].map((part) => (part ?? '').trim()).filter(Boolean).join(' ')

  if (!surname.trim()) return given

  return given ? `${surname.trim().toUpperCase()}, ${given}` : surname.trim().toUpperCase()
})

// The four step one requires; the reference narrows the lookup when given.
const canCheck = computed(() => Boolean(
  (form.value.hospitalId || form.value.hospitalName.trim())
  && form.value.patient.surname.trim()
  && form.value.patient.firstName.trim()
  && form.value.bloodTypeId,
))

const acknowledgementNeeded = computed(() => matchesNeedingAcknowledgement(matches.value, form.value.transfusionRequestId))

const problems = computed(() => {
  if (!reference.value) return []

  if (step.value === 3) {
    const all = [
      ...walkInStepProblems(form.value, 'lookup'),
      ...walkInStepProblems(form.value, 'details', reference.value.components),
    ]

    if (acknowledgementNeeded.value.length && form.value.duplicateAcknowledgement.trim().length < 5) {
      all.push('Say why a separate request is needed for this patient.')
    }

    return all
  }

  return walkInStepProblems(form.value, STEP_KEYS[step.value], reference.value.components)
})

// A different patient or hospital is a different lookup. A continuation fills
// these in itself from the requirement, so it is not a reason to re-check.
watch(
  () => [form.value.hospitalId, form.value.hospitalName, form.value.patient.surname, form.value.patient.firstName, form.value.bloodTypeId, form.value.presentedReference],
  () => {
    if (!isContinuing.value) {
      lookupDone.value = false
      matches.value = []
    }
  },
)

onMounted(async () => {
  nextTick(() => dialogRef.value?.focus())

  try {
    reference.value = await bloodCenterService.walkInReference()
  } catch (err) {
    referenceError.value = err?.message || 'The walk-in form could not be loaded.'
  } finally {
    loadingReference.value = false
  }
})

async function checkDuplicates() {
  if (!canCheck.value) return

  checking.value = true
  submitError.value = ''

  try {
    const response = await bloodCenterService.checkWalkInDuplicates({
      ...(form.value.hospitalId ? { hospital_id: form.value.hospitalId } : { hospital_name: form.value.hospitalName.trim() }),
      patient_surname: form.value.patient.surname.trim() || null,
      patient_first_name: form.value.patient.firstName.trim() || null,
      blood_type_id: form.value.bloodTypeId || null,
      presented_reference: form.value.presentedReference.trim() || null,
    })

    matches.value = response?.matches ?? []
    lookupDone.value = true
  } catch (err) {
    submitError.value = firstError(err) || 'Could not check for existing requests.'
  } finally {
    checking.value = false
  }
}

function useAsContinuation(match) {
  form.value = applyContinueMatch(form.value, match)
}

function undoContinuation() {
  form.value = clearContinuation(form.value)
}

function indicationsFor(line) {
  return reference.value?.components.find((component) => component.id === line.componentId)?.indication_codes ?? []
}

function needsExplanation(line) {
  return indicationsFor(line).find((code) => code.code === line.indicationCode)?.requires_explanation ?? false
}

function componentName(id) {
  return reference.value?.components.find((component) => component.id === id)?.name ?? '—'
}

function next() {
  attempted.value = true
  if (problems.value.length) return

  attempted.value = false
  step.value += 1
}

function back() {
  attempted.value = false
  submitError.value = ''
  step.value = Math.max(1, step.value - 1)
}

async function submit() {
  attempted.value = true
  submitError.value = ''
  if (problems.value.length) return

  saving.value = true

  try {
    const response = await bloodCenterService.createWalkInRequest(buildWalkInPayload(form.value))
    emit('created', response)
  } catch (err) {
    // Someone may have recorded the same patient at another counter since the
    // lookup: the server re-checks under a lock and sends the matches back.
    if (err?.data?.code === 'possible_duplicate') {
      matches.value = err.data.matches ?? []
      lookupDone.value = true
    }

    submitError.value = firstError(err) || 'The request could not be recorded.'
  } finally {
    saving.value = false
  }
}

function requestClose() {
  if (saving.value) return
  emit('close')
}

function firstError(err) {
  const errors = err?.data?.errors
  const first = errors && typeof errors === 'object' ? Object.values(errors).flat()[0] : null

  return first || err?.message || ''
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 310;
  display: grid;
  place-items: center;
  padding: 16px;
  background: var(--rb-overlay);
}

.dialog {
  width: min(760px, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: 1.25rem 1.35rem;
  border-radius: 14px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  outline: none;
}

.dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.dialog__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 16px;
}

.dialog__loading {
  font-size: 14px;
  color: var(--rb-text-secondary);
}

.dialog__error {
  margin: 0;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  background: rgba(var(--rb-accent-rgb), 0.12);
  color: var(--rb-accent-text);
  font-size: 13.5px;
}

.dialog__footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding-top: 0.25rem;
  border-top: 1px solid var(--rb-border);
}

.dialog__spacer {
  flex: 1;
}

.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.4rem;
}

.steps__item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.5rem;
  border-radius: 8px;
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
  font-size: 12px;
  font-weight: 600;
  min-width: 0;
}

.steps__num {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--rb-border);
  font-size: 11.5px;
}

.steps__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.steps__item.is-current {
  background: rgba(var(--rb-primary-rgb), 0.12);
  color: var(--rb-primary-text);
}

.steps__item.is-current .steps__num {
  background: var(--rb-primary);
  color: #fff;
}

.steps__item.is-done .steps__num {
  background: var(--rb-success);
  color: #fff;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.step__heading {
  margin: 0.25rem 0 0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--rb-text-secondary);
}

.step__actions-inline {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.field--wide {
  grid-column: 1 / -1;
}

.field--narrow {
  max-width: 120px;
}

.field--grow {
  flex: 1;
  min-width: 200px;
}

.field__label {
  font-size: 12.5px;
  font-weight: 600;
}

.field__hint {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--rb-text-secondary);
}

.field__input {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 14px;
}

.field__input:disabled {
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
}

.lines {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.line {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.6rem;
  padding: 0.65rem;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
}

.line > .field:first-child {
  min-width: 180px;
}

.line__remove {
  margin-bottom: 0.2rem;
}

.matches {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.match {
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

/* The relation is named in the chip; the tint only groups it at a glance. */
.match--here { background: rgba(var(--rb-primary-rgb), 0.05); border-color: rgba(var(--rb-primary-rgb), 0.25); }
.match--continue { background: rgba(var(--rb-success-rgb), 0.06); border-color: rgba(var(--rb-success-rgb), 0.3); }
.match--duplicate { background: rgba(var(--rb-warning-rgb), 0.07); border-color: rgba(var(--rb-warning-rgb), 0.35); }

.match__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.match__ref {
  font-weight: 700;
}

.match__meta,
.match__lines {
  margin: 0;
  font-size: 13px;
  color: var(--rb-text-secondary);
}

.match__lines {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
}

.match__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

/* The one field on step one that may be left empty. */
.field__optional { font-weight: 400; color: var(--rb-text-secondary); }

.banner {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.65rem 0.8rem;
  border-radius: 10px;
  font-size: 13.5px;
  line-height: 1.45;
}

.banner > span {
  flex: 1;
  min-width: 200px;
}

.banner--info {
  background: rgba(var(--rb-success-rgb), 0.1);
  color: var(--rb-text-primary);
}

.banner--muted {
  background: var(--rb-surface-alt);
  color: var(--rb-text-primary);
}

.review {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.6rem 1rem;
}

.review__wide {
  grid-column: 1 / -1;
}

.review dt {
  font-size: 12px;
  color: var(--rb-text-secondary);
}

.review dd {
  margin: 0.15rem 0 0;
  font-weight: 600;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.problems {
  margin: 0;
  padding: 0.6rem 0.8rem 0.6rem 1.8rem;
  border-radius: 8px;
  background: rgba(var(--rb-accent-rgb), 0.1);
  color: var(--rb-accent-text);
  font-size: 13px;
  line-height: 1.5;
}

.chip {
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.12);
  color: var(--rb-primary-text);
  font-size: 12px;
  font-weight: 600;
}

.chip--muted {
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
}

.ok-text {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-success-text);
}

.mono {
  font-family: var(--rb-font-mono);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.95rem;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: transparent;
  color: var(--rb-text-primary);
  font: inherit;
  font-weight: 600;
  font-size: 13.5px;
  cursor: pointer;
}

.btn--sm {
  padding: 0.35rem 0.7rem;
  font-size: 12.5px;
}

.btn--primary {
  border-color: transparent;
  background: var(--rb-primary);
  color: #fff;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-btn {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: transparent;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0;
  border: none;
  background: none;
  color: var(--rb-primary-text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 560px) {
  .steps {
    grid-template-columns: repeat(4, auto);
  }

  .steps__label {
    display: none;
  }

  .steps__item.is-current .steps__label {
    display: inline;
  }
}
.id-hint { display: flex; align-items: center; gap: 6px; margin: -4px 0 0; }
.id-hint :deep(svg) { flex: none; }
</style>
