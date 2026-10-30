<template>
  <div class="dialog-backdrop" @click.self="!busy && $emit('close')">
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-unit-title"
      v-focus-trap
      @dialog-escape="!busy && $emit('close')"
    >
      <h2 id="add-unit-title" class="dialog__title">
        <AssetIcon name="plus" :size="17" />
        Add blood unit
      </h2>

      <form class="dialog__form" novalidate @submit.prevent="submit">
        <div class="field-grid">
          <div class="field">
            <label for="add-unit-number" class="field__label">Bag number <span class="req">*</span></label>
            <input
              id="add-unit-number"
              ref="numberInput"
              v-model="form.number"
              type="text"
              class="field__input mono"
              :class="{ 'field__input--error': fieldErrors.external_unit_number }"
              autocomplete="off"
              spellcheck="false"
              autocapitalize="characters"
              maxlength="60"
              placeholder="PRC-920923323"
              @blur="form.number = normalizeUnitNumber(form.number)"
            >
            <p v-if="fieldErrors.external_unit_number" class="field__error">{{ fieldErrors.external_unit_number }}</p>
            <p v-else class="field__hint">As printed on the bag by the blood service that sent it.</p>
          </div>

          <div class="field">
            <label for="add-unit-qty" class="field__label">Number of units <span class="req">*</span></label>
            <input
              id="add-unit-qty"
              v-model.number="form.quantity"
              type="number"
              inputmode="numeric"
              min="1"
              max="100"
              class="field__input"
              :class="{ 'field__input--error': fieldErrors.quantity }"
            >
            <p v-if="fieldErrors.quantity" class="field__error">{{ fieldErrors.quantity }}</p>
          </div>

          <div class="field">
            <label for="add-unit-component" class="field__label">Blood component <span class="req">*</span></label>
            <SelectField
              id="add-unit-component"
              v-model="form.component_id"
              :options="components.map((component) => ({ value: component.id, label: component.name }))"
              placeholder="Select…"
              :invalid="Boolean(fieldErrors.component_id)"
            />
            <p v-if="fieldErrors.component_id" class="field__error">{{ fieldErrors.component_id }}</p>
          </div>

          <div class="field">
            <label for="add-unit-type" class="field__label">Blood type <span class="req">*</span></label>
            <SelectField
              id="add-unit-type"
              v-model="form.blood_type_id"
              :options="bloodTypes.map((type) => ({ value: type.id, label: type.code }))"
              placeholder="Select…"
              :invalid="Boolean(fieldErrors.blood_type_id)"
            />
            <p v-if="fieldErrors.blood_type_id" class="field__error">{{ fieldErrors.blood_type_id }}</p>
          </div>

          <div class="field">
            <label for="add-unit-expiry" class="field__label">Expiration date <span class="req">*</span></label>
            <DatePicker id="add-unit-expiry" v-model="form.expiry_date" :min="todayLocal()" :invalid="Boolean(fieldErrors.expiry_date)" />
            <p v-if="fieldErrors.expiry_date" class="field__error">{{ fieldErrors.expiry_date }}</p>
          </div>

          <div class="field">
            <label for="add-unit-collected" class="field__label">Collection date <span class="optional">if on the label</span></label>
            <DatePicker id="add-unit-collected" v-model="form.collection_date" :max="todayLocal()" :invalid="Boolean(fieldErrors.collection_date)" />
            <p v-if="fieldErrors.collection_date" class="field__error">{{ fieldErrors.collection_date }}</p>
          </div>
        </div>

        <p v-if="referenceError" class="dialog__error" role="alert">{{ referenceError }}</p>
        <p v-if="submitError" class="dialog__error" role="alert">{{ submitError }}</p>

        <div class="dialog__actions">
          <button type="submit" class="btn btn--primary" :disabled="busy">
            <AssetIcon name="plus" :size="14" />
            {{ busy ? 'Adding…' : submitLabel }}
          </button>
          <button type="button" class="btn" :disabled="busy" @click="$emit('close')">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
/**
 * Add blood that came from outside RedAgos straight from Stock Intake (project
 * owner, 2026-10-30).
 *
 * The direct-distribution receipt with no request (the Direct Distribution
 * page itself is gone, project owner 2026-10-30): the sender's number is kept as is, and the bags arrive awaiting stock-in, so the page
 * lists them for a storage location like any other arrival. A RedAgos bag is
 * refused here; it is received through the request it was dispatched for.
 *
 * Only what the bag itself says is asked for: no blood service, no one it was
 * requested for, no volume and no time received, which is now (project owner,
 * 2026-10-30).
 */
import { nextTick, onMounted, reactive, ref, computed } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import SelectField from '~/components/common/SelectField.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { RECEIVING_REFUSAL_MESSAGES } from '~/types/receiving'
import { normalizeUnitNumber, UNIT_NUMBER_PATTERN } from '~/utils/receiving'

const emit = defineEmits(['added', 'close'])

const bloodTypes = ref([])
const components = ref([])
const referenceError = ref('')

const form = reactive({
  number: '',
  quantity: 1,
  component_id: null,
  blood_type_id: null,
  collection_date: '',
  expiry_date: '',
})
const fieldErrors = ref({})
const submitError = ref('')
const busy = ref(false)

const numberInput = ref(null)

const submitLabel = computed(() => {
  const count = Math.max(1, Number(form.quantity) || 1)

  return `Add ${count} unit${count === 1 ? '' : 's'}`
})

onMounted(() => {
  nextTick(() => numberInput.value?.focus())
  loadReference()
})

async function loadReference() {
  try {
    const reference = await hospitalService.referenceData()

    bloodTypes.value = reference?.blood_types ?? []
    components.value = reference?.components ?? []
  } catch (err) {
    referenceError.value = err?.message || 'The blood types and components could not be loaded.'
  }
}

function validate() {
  const errors = {}
  const number = normalizeUnitNumber(form.number)
  const quantity = Number(form.quantity)

  if (!number) errors.external_unit_number = 'Type the number printed on the bag.'
  else if (!UNIT_NUMBER_PATTERN.test(number)) errors.external_unit_number = 'Letters, numbers and dashes only, up to 50.'
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) errors.quantity = 'Enter between 1 and 100 units.'
  if (!form.component_id) errors.component_id = 'Select the component.'
  if (!form.blood_type_id) errors.blood_type_id = 'Select the blood type.'
  if (!form.expiry_date) errors.expiry_date = 'Enter the expiry date printed on the unit.'
  fieldErrors.value = errors

  return !Object.keys(errors).length
}

async function submit() {
  submitError.value = ''

  if (!validate()) {
    submitError.value = 'Check the highlighted fields.'
    return
  }

  busy.value = true

  try {
    // No source and no one it was for; received now, which the server stamps.
    const response = await hospitalService.receiveDirectDistribution({
      quantity: Number(form.quantity),
      external_unit_number: normalizeUnitNumber(form.number),
      blood_type_id: form.blood_type_id,
      component_id: form.component_id,
      collection_date: form.collection_date || null,
      expiry_date: form.expiry_date,
    })

    emit('added', response)
  } catch (err) {
    if (err?.status === 422) {
      fieldErrors.value = Object.fromEntries(Object.entries(err.errors ?? {}).map(([key, messages]) => [key, Array.isArray(messages) ? messages[0] : messages]))
      submitError.value = Object.values(fieldErrors.value)[0] || 'Check the highlighted fields.'
    } else {
      submitError.value = RECEIVING_REFUSAL_MESSAGES[err?.data?.code] || err?.data?.message || err?.message || 'The unit could not be added.'
    }
  } finally {
    busy.value = false
  }
}

function todayLocal() {
  const now = new Date()

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
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
  width: min(640px, 100%);
  max-height: calc(100vh - 32px); overflow: auto;
  display: flex; flex-direction: column; gap: 14px;
  padding: 20px; border-radius: 14px;
  background: var(--rb-surface); border: 1px solid var(--rb-border);
  color: var(--rb-text-primary); font-family: var(--rb-font-sans);
}
.dialog:focus { outline: none; }
.dialog__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; font-weight: 700; }
.dialog__form { display: flex; flex-direction: column; gap: 14px; }
.dialog__error { margin: 0; font-size: 12.5px; color: var(--rb-accent-text); }
.dialog__actions { display: flex; gap: 10px; }

.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 14px; }
.field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.field__label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); line-height: 1.2; }
.field__input {
  width: 100%; height: 42px; padding: 0 11px; font: inherit; font-size: 13.5px;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.field__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.12); }
.field__input--error { border-color: var(--rb-accent); }
.field__hint { margin: 0; font-size: 11.5px; color: var(--rb-text-secondary); }
.field__error { margin: 0; font-size: 12px; color: var(--rb-accent-text); }
.req { color: var(--rb-accent-text); }
.optional { font-weight: 400; color: var(--rb-text-secondary); }
.mono { font-family: var(--rb-font-mono); }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 9px 16px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 9px; cursor: pointer; white-space: nowrap;
  background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong);
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn--primary { background: var(--rb-primary); color: #fff; border-color: var(--rb-primary); }
.btn--primary:hover:not(:disabled) { background: var(--rb-primary-hover); }
.btn:disabled { opacity: .55; cursor: not-allowed; }

@media (max-width: 560px) {
  .field-grid { grid-template-columns: minmax(0, 1fr); }
  .dialog__actions { flex-direction: column-reverse; }
  .dialog__actions > * { width: 100%; }
}
</style>
