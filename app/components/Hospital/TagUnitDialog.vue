<template>
  <div class="dialog-backdrop" @click.self="!busy && $emit('close')">
    <form
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tag-unit-title"
      v-focus-trap
      @dialog-escape="!busy && $emit('close')"
      @submit.prevent="submit"
    >
      <div>
        <h2 id="tag-unit-title" class="dialog__title">
          <AssetIcon name="user-check" :size="17" />
          Tag bag <span class="mono">{{ unit.unit_id }}</span> to a patient
        </h2>
        <p class="dialog__body">
          {{ unit.blood_type?.code || '—' }} · {{ unit.component?.name || '—' }} · expires {{ formatDate(unit.expiry_date) }}.
          The bag stays in storage, held for this patient only, and crossmatching must be recorded within
          <strong>24 hours</strong> or the tag is released.
        </p>
      </div>

      <label class="field">
        <span class="field__label">Patient Transfusion Request (optional)</span>
        <select v-model="requirementId" class="field__input" :disabled="requirementsLoading">
          <option :value="null">No request — enter the patient below</option>
          <option v-for="option in requirementOptions" :key="option.id" :value="option.id">
            {{ option.reference_number }} · {{ option.patient?.full_name || 'Unnamed patient' }} · {{ option.blood_type?.code || '—' }}
          </option>
        </select>
        <span v-if="suggested && requirementId === suggested.id" class="field__hint">
          This bag was received for {{ suggested.reference || 'this request' }}.
        </span>
        <span v-else-if="requirementsError" class="field__hint field__hint--error">{{ requirementsError }}</span>
      </label>

      <div v-if="mismatch" class="banner banner--warning" role="status">
        <AssetIcon name="triangle-alert" :size="15" />
        <span>
          The patient's request is for {{ patientBloodType }}, but this bag is {{ unit.blood_type?.code }}. Check before
          tagging — crossmatching remains the clinical check.
        </span>
      </div>

      <fieldset class="grid">
        <legend class="sr-only">Patient</legend>
        <label class="field">
          <span class="field__label">Surname<span v-if="!requirementId" aria-hidden="true"> *</span></span>
          <input v-model.trim="form.patient_surname" class="field__input" maxlength="100" autocomplete="off" :required="!requirementId" />
          <span v-if="fieldError('patient_surname')" class="field__hint field__hint--error">{{ fieldError('patient_surname') }}</span>
        </label>
        <label class="field">
          <span class="field__label">First name<span v-if="!requirementId" aria-hidden="true"> *</span></span>
          <input v-model.trim="form.patient_first_name" class="field__input" maxlength="100" autocomplete="off" :required="!requirementId" />
          <span v-if="fieldError('patient_first_name')" class="field__hint field__hint--error">{{ fieldError('patient_first_name') }}</span>
        </label>
        <label class="field">
          <span class="field__label">Middle name</span>
          <input v-model.trim="form.patient_middle_name" class="field__input" maxlength="100" autocomplete="off" />
        </label>
        <label class="field">
          <span class="field__label">Age<span v-if="!requirementId" aria-hidden="true"> *</span></span>
          <input v-model.number="form.patient_age" type="number" min="0" max="130" class="field__input" :required="!requirementId" />
          <span v-if="fieldError('patient_age')" class="field__hint field__hint--error">{{ fieldError('patient_age') }}</span>
        </label>
        <label class="field">
          <span class="field__label">Sex<span v-if="!requirementId" aria-hidden="true"> *</span></span>
          <select v-model="form.patient_sex" class="field__input" :required="!requirementId">
            <option value="">Select</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
          <span v-if="fieldError('patient_sex')" class="field__hint field__hint--error">{{ fieldError('patient_sex') }}</span>
        </label>
        <label class="field">
          <span class="field__label">Hospital record no.</span>
          <input v-model.trim="form.patient_record_number" class="field__input" maxlength="60" autocomplete="off" />
        </label>
        <label class="field">
          <span class="field__label">Ward</span>
          <input v-model.trim="form.patient_ward" class="field__input" maxlength="100" autocomplete="off" />
        </label>
        <label class="field">
          <span class="field__label">Attending physician</span>
          <input v-model.trim="form.attending_physician" class="field__input" maxlength="150" autocomplete="off" />
        </label>
      </fieldset>

      <p v-if="error" class="dialog__error" role="alert">{{ error }}</p>

      <div class="dialog__actions">
        <button type="submit" class="btn btn--primary" :disabled="busy">
          {{ busy ? 'Tagging…' : 'Tag to patient' }}
        </button>
        <button type="button" class="btn" :disabled="busy" @click="$emit('close')">Cancel</button>
      </div>
    </form>
  </div>
</template>

<script setup>
/**
 * Tag one bag on the hospital's shelf to one patient.
 *
 * The patient is entered here, because a patient served from the hospital's
 * own stock has no Patient Transfusion Request to point at. Picking one of
 * the hospital's open requests fills the form from it; the bag a request was
 * received for preselects that request. What staff type wins over what the
 * request says, exactly as the API merges them.
 */

import { computed, onMounted, reactive, ref, watch } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { bloodTypeMismatch, suggestedRequirement } from '~/utils/tagDeadline'

const props = defineProps({
  unit: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
  fieldErrors: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['confirm', 'close'])

const requirements = ref([])
const requirementsLoading = ref(false)
const requirementsError = ref('')

const suggested = computed(() => suggestedRequirement(props.unit))
const requirementId = ref(suggested.value?.id ?? null)

const form = reactive({
  patient_surname: '',
  patient_first_name: '',
  patient_middle_name: '',
  patient_age: null,
  patient_sex: '',
  patient_record_number: '',
  patient_ward: '',
  attending_physician: '',
})

/** Open requests only: a cancelled one cannot be linked, and the API says so. */
const requirementOptions = computed(() => requirements.value.filter((request) => request.status !== 'cancelled'))

const selectedRequirement = computed(() =>
  requirements.value.find((request) => request.id === requirementId.value) ?? null,
)

const patientBloodType = computed(() => selectedRequirement.value?.blood_type?.code ?? null)

const mismatch = computed(() => bloodTypeMismatch(patientBloodType.value, props.unit.blood_type?.code))

watch(selectedRequirement, (request) => {
  if (!request?.patient) return

  form.patient_surname = request.patient.surname ?? ''
  form.patient_first_name = request.patient.first_name ?? ''
  form.patient_middle_name = request.patient.middle_name ?? ''
  form.patient_age = request.patient.age ?? null
  form.patient_sex = request.patient.sex ?? ''
})

onMounted(loadRequirements)

async function loadRequirements() {
  requirementsLoading.value = true
  requirementsError.value = ''

  try {
    const response = await hospitalService.listTransfusionRequests({ per_page: 100 })
    requirements.value = response.data ?? []

    // A suggested request that was cancelled since, or is not on this page,
    // cannot be linked; fall back to entering the patient by hand.
    if (requirementId.value && !requirementOptions.value.some((option) => option.id === requirementId.value)) {
      requirementId.value = null
    }
  } catch {
    requirementId.value = null
    requirementsError.value = 'Could not load your transfusion requests. You can still enter the patient by hand.'
  } finally {
    requirementsLoading.value = false
  }
}

function fieldError(field) {
  const messages = props.fieldErrors?.[field]

  return Array.isArray(messages) ? messages[0] : messages || ''
}

/** Send only what was entered, so the linked request fills the rest. */
function submit() {
  const payload = { transfusion_request_id: requirementId.value }

  for (const [field, value] of Object.entries(form)) {
    if (value !== '' && value !== null && value !== undefined) payload[field] = value
  }

  emit('confirm', payload)
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css; nothing is redeclared here. */
.dialog-backdrop {
  position: fixed; inset: 0; z-index: 320;
  display: grid; place-items: center; padding: 16px;
  background: var(--rb-overlay);
}
.dialog {
  width: min(620px, 100%);
  max-height: calc(100vh - 32px); overflow: auto;
  display: flex; flex-direction: column; gap: 14px;
  padding: 20px; border-radius: 14px;
  background: var(--rb-surface); border: 1px solid var(--rb-border);
  color: var(--rb-text-primary);
}
.dialog:focus { outline: none; }
.dialog__title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 0 6px; font-size: 16px; font-weight: 700; }
.dialog__body { margin: 0; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }
.dialog__error { margin: 0; font-size: 12.5px; color: var(--rb-accent-text); }
.dialog__actions { display: flex; gap: 10px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.grid {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;
  margin: 0; padding: 0; border: 0;
}
.field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.field__label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.field__hint { font-size: 12px; color: var(--rb-text-secondary); }
.field__hint--error { color: var(--rb-accent-text); }
.field__input {
  width: 100%; padding: 9px 11px; font: inherit; font-size: 13.5px;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.field__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.12); }

.banner {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 12px; border-radius: 10px; font-size: 12.5px; line-height: 1.45;
}
.banner--warning {
  background: rgba(var(--rb-warning-rgb), 0.1);
  color: var(--rb-warning-text);
  border: 1px solid rgba(var(--rb-warning-rgb), 0.3);
}

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 9px 16px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 9px; cursor: pointer; white-space: nowrap;
  background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong);
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn--primary { background: var(--rb-primary); color: #fff; border-color: var(--rb-primary); }
.btn--primary:hover:not(:disabled) { background: #10509c; }
.btn:disabled { opacity: .55; cursor: not-allowed; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

@media (max-width: 560px) {
  .grid { grid-template-columns: 1fr; }
  .dialog__actions { flex-direction: column-reverse; }
  .dialog__actions > * { width: 100%; }
}
</style>
