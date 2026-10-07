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
          <p class="dialog__subtitle">
            A watcher brought a patient's blood request here instead of the hospital blood bank.
          </p>
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
          <p class="step__intro">
            Start with who the blood is for. RedAgos checks whether the hospital already has a request open for this
            patient — sent here, part-filled at another center, or elsewhere.
          </p>

          <div class="grid">
            <label class="field field--wide">
              <span class="field__label">Patient's hospital blood bank *</span>
              <select v-model.number="form.hospitalId" class="field__input" :disabled="isContinuing">
                <option :value="null" disabled>Select the hospital</option>
                <option v-for="hospital in reference.hospitals" :key="hospital.id" :value="hospital.id">
                  {{ hospital.name }}
                </option>
              </select>
              <span v-if="!reference.hospitals.length" class="field__hint">
                No hospital blood bank is registered in RedAgos yet. A walk-in can only be recorded for a registered one.
              </span>
            </label>

            <label class="field">
              <span class="field__label">Patient surname *</span>
              <input v-model="form.patient.surname" class="field__input" maxlength="100" :disabled="isContinuing" autocomplete="off">
            </label>
            <label class="field">
              <span class="field__label">Patient first name *</span>
              <input v-model="form.patient.firstName" class="field__input" maxlength="100" :disabled="isContinuing" autocomplete="off">
            </label>

            <label class="field">
              <span class="field__label">Blood type</span>
              <select v-model.number="form.bloodTypeId" class="field__input" :disabled="isContinuing">
                <option :value="null">Not known yet</option>
                <option v-for="type in reference.blood_types" :key="type.id" :value="type.id">{{ type.code }}</option>
              </select>
            </label>
            <label class="field">
              <span class="field__label">Reference on the watcher's paperwork</span>
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

        <!-- STEP 2: PHONE VERIFICATION -->
        <section v-show="step === 2" class="step">
          <div class="call-card">
            <AssetIcon name="phone" :size="20" />
            <div>
              <p class="call-card__title">Call {{ selectedHospital?.name || 'the hospital blood bank' }}</p>
              <p v-if="selectedHospital?.phone" class="call-card__phone mono">{{ selectedHospital.phone }}</p>
              <p class="call-card__body">
                Confirm that {{ patientName || 'the patient' }} is admitted and that the request the watcher carries is
                genuine. Nothing is saved while you are on the call.
              </p>
            </div>
          </div>

          <div v-if="declined" class="banner banner--muted" role="status">
            <AssetIcon name="info" :size="15" />
            <span>
              The hospital did not confirm the request, so nothing was recorded. Ask the watcher to go through the
              hospital blood bank.
            </span>
          </div>

          <div v-if="!form.verification.confirmed && !declined" class="choice">
            <p class="choice__question">Did the hospital blood bank confirm this request?</p>
            <div class="choice__buttons">
              <button type="button" class="btn btn--primary" @click="confirmByPhone">
                <AssetIcon name="check" :size="15" /> Yes, they confirmed it
              </button>
              <button type="button" class="btn" @click="declined = true">
                <AssetIcon name="x" :size="15" /> No, they did not
              </button>
            </div>
          </div>

          <div v-if="form.verification.confirmed" class="grid">
            <p class="ok-text field--wide">
              <AssetIcon name="check-circle" :size="15" /> Confirmed by the hospital. Record who you spoke to.
              <button type="button" class="link-btn" @click="form.verification.confirmed = false">Change</button>
            </p>
            <label class="field">
              <span class="field__label">Confirmed by (name) *</span>
              <input v-model="form.verification.verifierName" class="field__input" maxlength="150" autocomplete="off">
            </label>
            <label class="field">
              <span class="field__label">Their position *</span>
              <input v-model="form.verification.verifierPosition" class="field__input" maxlength="100" placeholder="e.g. Blood Bank Medical Technologist" autocomplete="off">
            </label>
            <label class="field">
              <span class="field__label">Number called *</span>
              <input v-model="form.verification.verifierContact" class="field__input" maxlength="30" autocomplete="off">
            </label>
            <label class="field">
              <span class="field__label">Confirmed at *</span>
              <input v-model="form.verification.verifiedAt" type="datetime-local" class="field__input" :max="nowInput">
            </label>
            <label class="field field--wide">
              <span class="field__label">What was confirmed (optional)</span>
              <textarea v-model="form.verification.notes" class="field__input" rows="2" maxlength="500" />
            </label>
          </div>
        </section>

        <!-- STEP 3: THE REQUEST AND THE WATCHER -->
        <section v-show="step === 3" class="step">
          <h3 class="step__heading">Patient</h3>
          <div class="grid">
            <p v-if="isContinuing" class="field__hint field--wide">
              {{ patientName }} · {{ bloodTypeCode || '—' }} — taken from {{ form.transfusionReference }}.
            </p>
            <template v-else>
              <label class="field">
                <span class="field__label">Middle name</span>
                <input v-model="form.patient.middleName" class="field__input" maxlength="100" autocomplete="off">
              </label>
              <label class="field">
                <span class="field__label">Age *</span>
                <input v-model="form.patient.age" type="number" min="0" max="130" class="field__input">
              </label>
              <label class="field">
                <span class="field__label">Sex *</span>
                <select v-model="form.patient.sex" class="field__input">
                  <option value="" disabled>Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </label>
              <label class="field">
                <span class="field__label">Blood type *</span>
                <select v-model.number="form.bloodTypeId" class="field__input">
                  <option :value="null" disabled>Select</option>
                  <option v-for="type in reference.blood_types" :key="type.id" :value="type.id">{{ type.code }}</option>
                </select>
              </label>
            </template>
            <label class="field">
              <span class="field__label">Priority *</span>
              <select v-model="form.urgency" class="field__input">
                <option v-for="priority in reference.priorities" :key="priority.value" :value="priority.value">{{ priority.label }}</option>
              </select>
            </label>
            <label class="field">
              <span class="field__label">Attending physician</span>
              <input v-model="form.attendingPhysician" class="field__input" maxlength="150" autocomplete="off">
            </label>
            <label class="field">
              <span class="field__label">Ward</span>
              <input v-model="form.patientWard" class="field__input" maxlength="100" autocomplete="off">
            </label>
            <label class="field">
              <span class="field__label">Patient record no.</span>
              <input v-model="form.patientRecordNumber" class="field__input" maxlength="60" autocomplete="off">
            </label>
          </div>

          <h3 class="step__heading">Components requested</h3>
          <div class="lines">
            <div v-for="(line, index) in form.lines" :key="index" class="line">
              <label class="field">
                <span class="field__label">Component</span>
                <select v-model.number="line.componentId" class="field__input" :disabled="isContinuing" @change="line.indicationCode = ''">
                  <option :value="null" disabled>Select</option>
                  <option v-for="component in reference.components" :key="component.id" :value="component.id">{{ component.name }}</option>
                </select>
              </label>
              <label class="field field--narrow">
                <span class="field__label">Units{{ line.maxQuantity !== null ? ` (max ${line.maxQuantity})` : '' }}</span>
                <input v-model="line.quantity" type="number" min="1" :max="line.maxQuantity ?? 100" class="field__input">
              </label>
              <template v-if="!isContinuing">
                <label v-if="indicationsFor(line).length" class="field field--grow">
                  <span class="field__label">Indication</span>
                  <select v-model="line.indicationCode" class="field__input">
                    <option value="" disabled>Select the clinical indication</option>
                    <option v-for="code in indicationsFor(line)" :key="code.code" :value="code.code">
                      {{ code.label }} — {{ code.description }}
                    </option>
                  </select>
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
              <select v-model="form.representative.idType" class="field__input">
                <option value="">None</option>
                <option v-for="type in reference.id_types" :key="type.value" :value="type.value">{{ type.label }}</option>
              </select>
            </label>
            <label v-if="form.representative.idType" class="field">
              <span class="field__label">ID number *</span>
              <input v-model="form.representative.idNumber" class="field__input" maxlength="50" autocomplete="off">
            </label>
          </div>
        </section>

        <!-- STEP 4: REVIEW -->
        <section v-show="step === 4" class="step">
          <dl class="review">
            <div><dt>Hospital (requester)</dt><dd>{{ selectedHospital?.name || '—' }}</dd></div>
            <div><dt>Patient</dt><dd>{{ patientName || '—' }}</dd></div>
            <div><dt>Blood type</dt><dd>{{ bloodTypeCode || '—' }}</dd></div>
            <div><dt>Priority</dt><dd>{{ priorityLabel }}</dd></div>
            <div><dt>Confirmed by</dt><dd>{{ form.verification.verifierName }} ({{ form.verification.verifierPosition }})</dd></div>
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
        <button v-if="step > 1 && !declined" type="button" class="btn" :disabled="saving" @click="back">Back</button>
        <span class="dialog__spacer" />
        <button type="button" class="btn" :disabled="saving" @click="requestClose">{{ declined ? 'Close' : 'Cancel' }}</button>
        <button
          v-if="step < 4 && !declined"
          type="button"
          class="btn btn--primary"
          :disabled="!reference || (step === 1 && !lookupDone) || (step === 2 && !form.verification.confirmed)"
          @click="next"
        >
          Continue
        </button>
        <button v-if="step === 4" type="button" class="btn btn--primary" :disabled="saving" @click="submit">
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
 * Four steps, in the order the counter works: who the blood is for and whether
 * the hospital already has a request for them; the phone call to the hospital
 * blood bank; the request itself and the watcher; then a review. Nothing is
 * sent until the last step, and a hospital that does not confirm the request
 * ends the dialog with nothing recorded — that is the rule, not an option.
 */

import { computed, nextTick, onMounted, ref, watch } from 'vue'
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
  toLocalInputValue,
  walkInStepProblems,
} from '~/utils/requestFulfilment'

const emit = defineEmits(['close', 'created', 'open-existing'])

const STEP_LABELS = ['Patient', 'Hospital confirmation', 'Request & watcher', 'Review']
const STEP_KEYS = { 1: 'lookup', 2: 'verify', 3: 'details' }

const dialogRef = ref(null)
const step = ref(1)
const form = ref(blankWalkInForm())

const reference = ref(null)
const loadingReference = ref(true)
const referenceError = ref('')

const checking = ref(false)
const lookupDone = ref(false)
const matches = ref([])
const declined = ref(false)

const attempted = ref(false)
const saving = ref(false)
const submitError = ref('')

const nowInput = ref(toLocalInputValue(new Date()))

const isContinuing = computed(() => form.value.transfusionRequestId !== null)
const selectedHospital = computed(() => reference.value?.hospitals.find((h) => h.id === form.value.hospitalId) ?? null)
const bloodTypeCode = computed(() => reference.value?.blood_types.find((t) => t.id === form.value.bloodTypeId)?.code ?? '')
const priorityLabel = computed(() => PRIORITY_LABELS[form.value.urgency] ?? form.value.urgency)

const patientName = computed(() => {
  const { surname, firstName, middleName } = form.value.patient
  const given = [firstName, middleName].map((part) => (part ?? '').trim()).filter(Boolean).join(' ')

  if (!surname.trim()) return given

  return given ? `${surname.trim().toUpperCase()}, ${given}` : surname.trim().toUpperCase()
})

const canCheck = computed(() => Boolean(
  form.value.hospitalId
  && ((form.value.patient.surname.trim() && form.value.patient.firstName.trim()) || form.value.presentedReference.trim()),
))

const acknowledgementNeeded = computed(() => matchesNeedingAcknowledgement(matches.value, form.value.transfusionRequestId))

const problems = computed(() => {
  if (!reference.value) return []

  if (step.value === 4) {
    const all = [
      ...walkInStepProblems(form.value, 'lookup'),
      ...walkInStepProblems(form.value, 'verify'),
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
  () => [form.value.hospitalId, form.value.patient.surname, form.value.patient.firstName, form.value.bloodTypeId, form.value.presentedReference],
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
      hospital_id: form.value.hospitalId,
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

function confirmByPhone() {
  form.value.verification.confirmed = true
  nowInput.value = toLocalInputValue(new Date())
  form.value.verification.verifiedAt = nowInput.value

  if (!form.value.verification.verifierContact && selectedHospital.value?.phone) {
    form.value.verification.verifierContact = selectedHospital.value.phone
  }
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
  nowInput.value = toLocalInputValue(new Date())
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

.dialog__subtitle {
  margin: 0.25rem 0 0;
  font-size: 13.5px;
  color: var(--rb-text-secondary);
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

.step__intro {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
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

.call-card {
  display: flex;
  gap: 0.8rem;
  align-items: flex-start;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  background: rgba(var(--rb-primary-rgb), 0.08);
  color: var(--rb-primary-text);
}

.call-card__title {
  margin: 0;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.call-card__phone {
  margin: 0.15rem 0 0;
  font-size: 15px;
  font-weight: 700;
}

.call-card__body {
  margin: 0.35rem 0 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.choice {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.choice__question {
  margin: 0;
  font-weight: 700;
}

.choice__buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

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
</style>
