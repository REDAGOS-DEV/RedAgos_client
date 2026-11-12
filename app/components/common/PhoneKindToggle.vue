<template>
  <!--
    Personal or Shared, paired with a donor's phone box wherever staff type it
    (project owner, 2026-11-12). In remote areas one phone serves a whole
    household: a Shared number may be on several donors, a Personal one on
    this donor's alone. v-model is true for Shared.

    A radio group of two buttons, as Component Prices' Charge / No charge:
    one tab stop, the arrow keys move between the two.
  -->
  <div class="pk" :class="`pk--${size}`" role="radiogroup" :aria-label="ariaLabel">
    <button
      v-for="option in OPTIONS"
      :key="option.label"
      ref="buttons"
      type="button"
      role="radio"
      class="pk__btn"
      :class="{ 'pk__btn--on': modelValue === option.shared }"
      :aria-checked="modelValue === option.shared ? 'true' : 'false'"
      :tabindex="modelValue === option.shared ? 0 : -1"
      :disabled="disabled"
      @click="choose(option.shared)"
      @keydown="onKeydown"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'

const OPTIONS = [
  { label: 'Personal', shared: false },
  { label: 'Shared', shared: true },
] as const

const props = withDefaults(defineProps<{
  /** true: the household's Shared number; false: the donor's Personal one. */
  modelValue: boolean
  disabled?: boolean
  /** sm for compact forms, md beside a form label (the default). */
  size?: 'sm' | 'md'
  ariaLabel?: string
}>(), {
  disabled: false,
  size: 'md',
  ariaLabel: 'Phone number type',
})

const emit = defineEmits<{
  'update:modelValue': [shared: boolean]
}>()

const buttons = ref<HTMLButtonElement[]>([])

function choose(shared: boolean) {
  if (props.disabled || shared === props.modelValue) return
  emit('update:modelValue', shared)
}

const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])

/** Two options: any arrow key moves to the other one and picks it. */
async function onKeydown(event: KeyboardEvent) {
  if (!ARROWS.has(event.key) || props.disabled) return
  event.preventDefault()

  const next = !props.modelValue
  emit('update:modelValue', next)
  await nextTick()
  buttons.value[OPTIONS.findIndex(option => option.shared === next)]?.focus()
}
</script>

<style scoped>
.pk {
  display: inline-flex;
  flex-shrink: 0;
  padding: 2px;
  border-radius: 9px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
}

.pk__btn {
  height: 24px;
  padding: 0 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
  white-space: nowrap;
}

.pk--sm .pk__btn {
  height: 22px;
  padding: 0 8px;
  font-size: 11.5px;
}

.pk__btn:hover:not(:disabled):not(.pk__btn--on) { color: var(--rb-text-primary); }

.pk__btn--on {
  background: var(--rb-surface);
  font-weight: 700;
  color: var(--rb-primary-text);
  box-shadow: 0 0 0 1px rgba(var(--rb-primary-rgb), 0.35), 0 1px 2px rgba(var(--rb-shadow-rgb), 0.12);
}

.pk__btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.pk__btn:disabled { cursor: not-allowed; opacity: 0.6; }
</style>
