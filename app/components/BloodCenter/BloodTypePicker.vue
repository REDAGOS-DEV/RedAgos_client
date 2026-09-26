<template>
  <div class="bt-picker">
    <label class="bt-picker__field">
      <span class="bt-picker__label">{{ aboLabel }}</span>
      <select v-model="abo" class="bt-picker__input" :disabled="disabled" @change="emitChoice">
        <option value="">{{ optional ? 'Not done' : 'Select' }}</option>
        <option v-for="group in ABO_GROUPS" :key="group" :value="group">{{ group }}</option>
      </select>
    </label>

    <label class="bt-picker__field">
      <span class="bt-picker__label">{{ rhLabel }}</span>
      <select v-model="rh" class="bt-picker__input" :disabled="disabled" @change="emitChoice">
        <option value="">{{ optional ? 'Not done' : 'Select' }}</option>
        <option value="positive">Positive (+)</option>
        <option value="negative">Negative (−)</option>
      </select>
    </label>

    <p v-if="unconfigured" class="bt-picker__warn" role="alert">
      {{ chosenCode }} is not set up at this facility.
    </p>
  </div>
</template>

<script setup lang="ts">
import {
  ABO_GROUPS,
  bloodTypeCode,
  bloodTypeCodeFor,
  resolveBloodTypeId,
  splitBloodTypeCode,
  type BloodTypeOption,
} from '~/utils/bloodType'

/**
 * The form's "Blood Type" and "Rh Typing" rows, resolved to one `blood_types` id.
 *
 * Used twice: for the preliminary fingerprick reading at the screening table,
 * and for the Testing department's confirmatory typing. The two are never
 * joined — this component has no idea which one it is recording, and neither
 * pre-fills the other.
 */
const props = withDefaults(defineProps<{
  modelValue: number | null
  bloodTypes: BloodTypeOption[]
  optional?: boolean
  disabled?: boolean
  aboLabel?: string
  rhLabel?: string
}>(), {
  optional: false,
  disabled: false,
  aboLabel: 'ABO group',
  rhLabel: 'Rh typing',
})

// Emits the resolved `blood_types` id, or null until both rows resolve to one.
const emit = defineEmits(['update:modelValue'])

const abo = ref('')
const rh = ref('')

const chosenCode = computed(() => bloodTypeCode(abo.value, rh.value))

// Both rows chosen, but this centre's reference data has no such row. Said
// out loud rather than silently recording nothing.
const unconfigured = computed(() => Boolean(chosenCode.value)
  && resolveBloodTypeId(props.bloodTypes, abo.value, rh.value) === null)

function emitChoice() {
  emit('update:modelValue', resolveBloodTypeId(props.bloodTypes, abo.value, rh.value))
}

// Follow the value in from outside (a correction being loaded, or the form
// being cleared for the next donor), without fighting a half-made choice.
watch(
  () => [props.modelValue, props.bloodTypes] as const,
  ([id]) => {
    const code = bloodTypeCodeFor(props.bloodTypes, id)

    if (code) {
      const split = splitBloodTypeCode(code)
      abo.value = split.abo
      rh.value = split.rh
    } else if (id === null && resolveBloodTypeId(props.bloodTypes, abo.value, rh.value) !== null) {
      abo.value = ''
      rh.value = ''
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.bt-picker {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.bt-picker__field { display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }

.bt-picker__label { font-size: 0.75rem; font-weight: 600; color: var(--rb-text-primary); }

.bt-picker__input {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 0.85rem;
}

.bt-picker__input:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 1px;
  border-color: var(--rb-primary);
}

.bt-picker__warn {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.78rem;
  color: var(--rb-accent-text);
}
</style>
