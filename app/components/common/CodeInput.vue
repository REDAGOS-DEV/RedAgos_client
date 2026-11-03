<template>
  <!--
    Six boxes for a verification code. One real input lies over the row, so
    typing, pasting "123 456", backspace and the phone's one-time-code autofill
    all behave as a single field; the boxes only draw what it holds.
  -->
  <div
    class="code-input"
    :class="{ 'is-invalid': invalid, 'is-focused': focused, 'is-disabled': disabled }"
    :style="{ '--ci-count': length }"
  >
    <input
      :id="id"
      ref="field"
      class="code-input__field"
      :value="modelValue"
      type="text"
      inputmode="numeric"
      autocomplete="one-time-code"
      pattern="[0-9]*"
      spellcheck="false"
      :disabled="disabled"
      :aria-label="ariaLabel"
      :aria-invalid="invalid || undefined"
      @input="onInput"
      @focus="onFocus"
      @blur="focused = false"
      @click="toEnd"
      @keyup="toEnd"
    >
    <span
      v-for="(digit, index) in digits"
      :key="index"
      class="code-input__slot"
      :class="{ 'is-filled': digit, 'is-active': focused && index === activeIndex }"
      aria-hidden="true"
    >{{ digit }}</span>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: String, default: '' },
  length: { type: Number, default: 6 },
  id: { type: String, default: undefined },
  ariaLabel: { type: String, default: 'Verification code' },
  invalid: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'complete'])

const field = ref(null)
const focused = ref(false)

const digits = computed(() => Array.from({ length: props.length }, (_, i) => props.modelValue[i] ?? ''))
const activeIndex = computed(() => Math.min(props.modelValue.length, props.length - 1))

function onInput(event) {
  const value = event.target.value.replace(/\D/g, '').slice(0, props.length)
  // Keep the field in step: a letter or a space would otherwise sit in it
  // while the boxes show something else.
  event.target.value = value
  emit('update:modelValue', value)
  if (value.length === props.length) emit('complete', value)
}

// The field's own text is invisible, so the caret is held at the end: a digit
// typed always lands in the next box, and backspace takes the last.
function toEnd() {
  const el = field.value
  if (el) el.setSelectionRange(el.value.length, el.value.length)
}

function onFocus() {
  focused.value = true
  toEnd()
}

function focus() {
  field.value?.focus()
}

defineExpose({ focus })
</script>

<style scoped>
/*
  Themed by the page through --ci-* variables. Each has its fallback where it
  is used rather than a declaration here, so a parent's value always wins.
*/
.code-input {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--ci-count), minmax(0, var(--ci-size, 52px)));
  justify-content: center;
  gap: var(--ci-gap, 10px);
}

.code-input__field {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: transparent;
  caret-color: transparent;
  /* 16px so iOS Safari does not zoom in on focus. */
  font-size: 16px;
  outline: none;
  cursor: text;
}
.code-input__field::selection { background: transparent; }
.code-input.is-disabled .code-input__field { cursor: not-allowed; }

.code-input__slot {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 5 / 6;
  border: 1.5px solid var(--ci-border, #DCE5F0);
  border-radius: var(--ci-radius, 12px);
  background: var(--ci-bg, #F8FAFD);
  color: var(--ci-text, #0B1F3A);
  font-size: var(--ci-font, 24px);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
}
.code-input__slot.is-filled { border-color: color-mix(in srgb, var(--ci-text, #0B1F3A) 28%, var(--ci-border, #DCE5F0)); }
.code-input__slot.is-active {
  border-color: var(--ci-accent, #1565C0);
  background: var(--ci-bg-active, #FFFFFF);
  box-shadow: 0 0 0 4px var(--ci-ring, rgba(21, 101, 192, 0.14));
}
/* A caret in the empty box that takes the next digit. */
.code-input__slot.is-active:not(.is-filled)::after {
  content: '';
  width: 2px;
  height: 40%;
  border-radius: 1px;
  background: var(--ci-accent, #1565C0);
  animation: code-input-blink 1s steps(1) infinite;
}

.code-input.is-invalid .code-input__slot { border-color: var(--ci-danger, #B42318); }
.code-input.is-invalid .code-input__slot.is-active {
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ci-danger, #B42318) 14%, transparent);
}
.code-input.is-disabled .code-input__slot { opacity: 0.6; }

@keyframes code-input-blink {
  50% { opacity: 0; }
}

@media (max-width: 380px) {
  .code-input { gap: var(--ci-gap, 6px); }
  .code-input__slot { font-size: var(--ci-font, 20px); }
}

@media (prefers-reduced-motion: reduce) {
  .code-input__slot { transition: none; }
  .code-input__slot.is-active:not(.is-filled)::after { animation: none; }
}
</style>
