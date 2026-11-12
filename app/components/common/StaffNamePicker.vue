<template>
  <!--
    A staff member's name picked from a list, or typed under Other (project
    owner, 2026-11-11). The v-model is the name itself, as the record keeps only
    a name: '' is the empty choice (the one signed in, or nothing written).
  -->
  <div class="snp">
    <SelectField
      :id="id"
      :model-value="choice"
      :options="options"
      :aria-label="ariaLabel"
      :disabled="disabled"
      @update:model-value="pick"
    />
    <input
      v-if="choice === OTHER"
      ref="otherInput"
      :value="modelValue"
      type="text"
      class="snp__input"
      maxlength="120"
      autocomplete="off"
      :placeholder="otherPlaceholder"
      :aria-label="`${ariaLabel}: name`"
      :disabled="disabled"
      @input="typeName($event.target.value)"
    >
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import SelectField from '~/components/common/SelectField.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  // [{ id, name, is_you }]
  staff: { type: Array, default: () => [] },
  // The empty choice's label: "Maria Cruz (you)" at the counter, "Not written" on paper.
  emptyLabel: { type: String, required: true },
  // At the counter the one signed in is the empty choice, so they are not listed twice.
  selfIsEmpty: { type: Boolean, default: false },
  otherLabel: { type: String, default: 'Other (type a name)' },
  otherPlaceholder: { type: String, default: 'Type the name' },
  ariaLabel: { type: String, default: 'Staff member' },
  id: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const OTHER = '__other'
const otherInput = ref(null)
// Other was chosen and its name not typed yet: keep the box open.
const typing = ref(false)
// Set while this picker itself changes the name, so the reset below ignores it.
let picking = false

const listed = computed(() => props.staff.filter((s) => !(props.selfIsEmpty && s.is_you)))

const options = computed(() => [
  { value: '', label: props.emptyLabel },
  ...listed.value.map((s) => ({ value: s.name, label: s.name })),
  { value: OTHER, label: props.otherLabel },
])

const choice = computed(() => {
  const name = (props.modelValue ?? '').trim()
  if (!name) return typing.value ? OTHER : ''
  return listed.value.some((s) => s.name === name) ? name : OTHER
})

function quietly(value) {
  picking = true
  emit('update:modelValue', value)
  nextTick(() => { picking = false })
}

function pick(value) {
  if (value === OTHER) {
    typing.value = true
    if (choice.value !== OTHER) quietly('')
    nextTick(() => otherInput.value?.focus())
    return
  }
  typing.value = false
  emit('update:modelValue', value ?? '')
}

// Typing in the box, emptying it included, keeps it open.
function typeName(value) {
  quietly(value)
}

// A form emptied from outside (a new donor, a saved row) closes the Other box.
watch(() => props.modelValue, (value) => {
  if (!value && !picking) typing.value = false
})
</script>

<style scoped>
.snp { display: flex; flex-direction: column; gap: 6px; min-width: 0; }

/* Its own look, the SelectField's beside it: a page's scoped input class
   never reaches inside this component. */
.snp__input {
  box-sizing: border-box; width: 100%; height: 42px; padding: 0 12px;
  border: 1px solid var(--rb-border-strong); border-radius: 10px; background: var(--rb-surface);
  font: inherit; font-size: 14px; color: var(--rb-text-primary);
}
.snp__input::placeholder { color: var(--rb-placeholder); }
.snp__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.snp__input:disabled { background: var(--rb-surface-alt); color: var(--rb-text-secondary); cursor: not-allowed; }
</style>
