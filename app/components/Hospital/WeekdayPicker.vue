<template>
  <div class="weekdays" role="group" :aria-label="label">
    <button
      v-for="day in WEEKDAYS"
      :key="day"
      type="button"
      class="weekdays__day"
      :class="{ 'weekdays__day--on': selected.has(day) }"
      :aria-pressed="selected.has(day)"
      :disabled="disabled"
      @click="toggle(day)"
    >
      {{ WEEKDAY_LABELS[day] }}
    </button>
  </div>
</template>

<script setup>
/**
 * The days of the week a blood bank sends one center its weekly request.
 *
 * A row of toggles, Monday first, bound to a list of ISO weekdays
 * (1 = Monday … 7 = Sunday) — the shape the API stores.
 */
import { WEEKDAY_LABELS, WEEKDAYS } from '~/types/receiving'
import { sortedWeekdays } from '~/utils/receiving'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  label: { type: String, default: 'Request days' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const selected = computed(() => new Set(sortedWeekdays(props.modelValue)))

function toggle(day) {
  const next = new Set(selected.value)

  if (next.has(day)) next.delete(day)
  else next.add(day)

  emit('update:modelValue', sortedWeekdays([...next]))
}
</script>

<style scoped>
.weekdays { display: inline-flex; flex-wrap: wrap; gap: 6px; }
.weekdays__day {
  min-width: 46px; padding: 7px 10px; border-radius: 9px;
  font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
  background: var(--rb-surface-alt); color: var(--rb-text-secondary);
  border: 1px solid var(--rb-border-strong);
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.weekdays__day:hover:not(:disabled) { border-color: var(--rb-primary); color: var(--rb-text-primary); }
.weekdays__day:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.weekdays__day--on { background: var(--rb-primary); color: #fff; border-color: var(--rb-primary); }
.weekdays__day--on:hover:not(:disabled) { color: #fff; }
.weekdays__day:disabled { opacity: 0.55; cursor: not-allowed; }

@media (prefers-reduced-motion: reduce) {
  .weekdays__day { transition: none; }
}
</style>
