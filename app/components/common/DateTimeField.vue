<template>
  <!--
    A date and a time, as <input type="datetime-local"> holds them
    ('YYYY-MM-DDTHH:mm'), drawn as the system's DatePicker beside a time box of
    the same height, so it sits with the other portal fields.
  -->
  <div class="dtf" :class="`dtf--${size}`">
    <DatePicker
      :id="id"
      :model-value="datePart"
      :min="minDate"
      :max="maxDate"
      :invalid="invalid"
      :disabled="disabled"
      :describedby="describedby"
      :aria-label="ariaLabel ? `${ariaLabel}, date` : undefined"
      :size="size"
      class="dtf-date"
      @update:model-value="setDate"
    />
    <input
      :value="timePart"
      type="time"
      class="dtf-time"
      :class="{ 'dtf-time--invalid': invalid }"
      :disabled="disabled || !datePart"
      :max="datePart && datePart === maxDate ? maxTime : undefined"
      :aria-label="ariaLabel ? `${ariaLabel}, time` : 'Time'"
      :aria-describedby="describedby"
      @input="setTime(($event.target as HTMLInputElement).value)"
    >
  </div>
</template>

<script setup lang="ts">
import DatePicker from '~/components/common/DatePicker.vue'

const props = withDefaults(defineProps<{
  /** 'YYYY-MM-DDTHH:mm', or '' when empty. Same as <input type="datetime-local">. */
  modelValue: string
  id?: string
  min?: string
  max?: string
  invalid?: boolean
  disabled?: boolean
  describedby?: string
  ariaLabel?: string
  size?: 'sm' | 'md'
}>(), {
  id: undefined,
  min: undefined,
  max: undefined,
  invalid: false,
  disabled: false,
  describedby: undefined,
  ariaLabel: undefined,
  size: 'md',
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const datePart = computed(() => (props.modelValue || '').slice(0, 10))
const timePart = computed(() => (props.modelValue || '').slice(11, 16))
const minDate = computed(() => props.min?.slice(0, 10) || undefined)
const maxDate = computed(() => props.max?.slice(0, 10) || undefined)
const maxTime = computed(() => props.max?.slice(11, 16) || undefined)

// A date with no time yet takes the start of the day, as a datetime-local
// field does once a date is typed; clearing the date clears both.
function setDate(date: string) {
  emit('update:modelValue', date ? `${date}T${timePart.value || '00:00'}` : '')
}

function setTime(time: string) {
  if (!datePart.value) return
  emit('update:modelValue', `${datePart.value}T${time || '00:00'}`)
}
</script>

<style scoped>
.dtf { display: grid; grid-template-columns: minmax(0, 1fr) 128px; gap: 8px; width: 100%; }
.dtf-time {
  height: 42px; padding: 0 10px; width: 100%;
  font: inherit; font-size: 14px; color: var(--rb-text-primary, #1F2937);
  background: var(--rb-surface, #fff); border: 1px solid var(--rb-border-strong, #E2E8F0); border-radius: 10px;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.dtf--sm .dtf-time { height: 36px; border-radius: 8px; font-size: 13px; }
.dtf-time:hover:not(:disabled) { border-color: color-mix(in srgb, var(--rb-primary, #1565C0) 35%, var(--rb-border-strong, #E2E8F0)); }
.dtf-time:focus-visible { outline: none; border-color: var(--rb-primary, #1565C0); box-shadow: 0 0 0 4px rgba(var(--rb-primary-rgb, 21, 101, 192), 0.14); }
.dtf-time--invalid { border-color: #D92D20; }
.dtf-time:disabled { opacity: .6; cursor: not-allowed; }

:global(.dark .dtf .dtf-time) { background: var(--ink-page, #0F172A); border-color: var(--ink-border, #334155); color: var(--ink-text, #F1F5F9); color-scheme: dark; }

@media (max-width: 420px) {
  .dtf { grid-template-columns: 1fr; }
}
</style>
