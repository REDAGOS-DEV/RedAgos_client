<template>
  <div class="drf">
    <button
      ref="triggerEl"
      type="button"
      class="drf__trigger"
      :class="{ 'drf__trigger--set': from || to }"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="open ? panelId : undefined"
      :aria-label="`${ariaLabel}: ${label}`"
      @click="toggle"
    >
      <AssetIcon name="calendar" :size="14" class="drf__icon" />
      <span class="drf__label">{{ label }}</span>
    </button>

    <!-- On the body, so the list panel's overflow does not clip it. -->
    <Teleport to="body">
      <div
        v-if="open"
        :id="panelId"
        ref="panelEl"
        class="drf-panel"
        role="dialog"
        :aria-label="ariaLabel"
        :style="panelStyle"
        @keydown.esc.stop="close(true)"
        @focusout="onFocusOut"
      >
        <div class="drf-panel__fields">
          <!-- The system's DatePicker, as on every other date field. -->
          <div class="drf-panel__field">
            <span :id="`${panelId}-from`" class="drf-panel__label">From</span>
            <DatePicker
              :model-value="from"
              :max="to || undefined"
              size="sm"
              placeholder="Any date"
              :describedby="`${panelId}-from`"
              aria-label="From"
              @update:model-value="setFrom"
            />
          </div>
          <div class="drf-panel__field">
            <span :id="`${panelId}-to`" class="drf-panel__label">To</span>
            <DatePicker
              :model-value="to"
              :min="from || undefined"
              size="sm"
              placeholder="Any date"
              :describedby="`${panelId}-to`"
              aria-label="To"
              @update:model-value="setTo"
            />
          </div>
        </div>

        <div class="drf-panel__foot">
          <button type="button" class="drf-panel__clear" :disabled="!from && !to" @click="clear">Clear</button>
          <button type="button" class="drf-panel__done" @click="close(true)">Done</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import { dateRangeLabel } from '~/utils/dateRange'
import { ref, computed, nextTick, onBeforeUnmount, useId } from 'vue'

/**
 * A list toolbar's From/To filter as one compact control: a button showing
 * the range ("All dates", "1–17 Oct") that opens both date fields.
 *
 * Two bare date inputs took ~300px, which pushed the toolbar's buttons onto
 * a second line. Each change is emitted as it happens, as the inputs did.
 */

defineProps({
  ariaLabel: { type: String, default: 'Filter by date' },
})

const from = defineModel('from', { type: String, default: '' })
const to = defineModel('to', { type: String, default: '' })
const emit = defineEmits(['change'])

const panelId = `drf-${useId()}`
const triggerEl = ref(null)
const panelEl = ref(null)
// The From field's button, for focus on opening and after Clear.
const focusFrom = () => panelEl.value?.querySelector('.dp-trigger')?.focus()
const open = ref(false)
const panelStyle = ref({})

const label = computed(() => dateRangeLabel(from.value, to.value))

function setFrom(value) {
  from.value = value
  emit('change')
}

function setTo(value) {
  to.value = value
  emit('change')
}

function clear() {
  from.value = ''
  to.value = ''
  emit('change')
  focusFrom()
}

// Under the button, kept inside the window.
function place() {
  const rect = triggerEl.value?.getBoundingClientRect()
  if (!rect) return
  const width = panelEl.value?.offsetWidth ?? 0
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  panelStyle.value = { top: `${rect.bottom + 6}px`, left: `${left}px` }
}

// A date picker's calendar sits on <body>, outside this panel, but is part of it.
const inCalendar = (el) => !!el?.closest?.('.dp-panel')

function onPointerDown(event) {
  const target = event.target
  if (triggerEl.value?.contains(target) || panelEl.value?.contains(target) || inCalendar(target)) return
  close(false)
}

// Tabbing out of the panel closes it, like a click elsewhere.
function onFocusOut(event) {
  const next = event.relatedTarget
  if (!next || panelEl.value?.contains(next) || triggerEl.value?.contains(next) || inCalendar(next)) return
  close(false)
}

function listen(on) {
  const method = on ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onPointerDown, true)
  window[method]('resize', place)
  window[method]('scroll', place, true)
}

async function show() {
  open.value = true
  await nextTick()
  place()
  listen(true)
  focusFrom()
}

function close(returnFocus) {
  if (!open.value) return
  open.value = false
  listen(false)
  if (returnFocus) triggerEl.value?.focus()
}

function toggle() {
  if (open.value) close(true)
  else show()
}

onBeforeUnmount(() => listen(false))
</script>

<style scoped>
.drf { display: inline-flex; flex-shrink: 0; min-width: 0; }

/* Drawn like the toolbar's selects, chevron included. */
.drf__trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  max-width: 240px;
  padding: 0 30px 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 10px 6px;
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
  white-space: nowrap;
  cursor: pointer;
}

.drf__icon { flex-shrink: 0; color: var(--rb-text-secondary); }
.drf__trigger--set .drf__icon { color: var(--rb-primary-text); }
.drf__label { overflow: hidden; text-overflow: ellipsis; }

.drf__trigger:hover { border-color: var(--rb-border-hover); }

.drf__trigger:focus-visible,
.drf__trigger[aria-expanded='true'] {
  outline: none;
  border-color: var(--rb-primary);
  box-shadow: var(--rb-focus-ring);
}

.drf-panel {
  position: fixed;
  z-index: 90;
  padding: 14px;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong);
  border-radius: 12px;
  box-shadow: 0 16px 40px -12px rgba(var(--rb-shadow-rgb), 0.35);
  font-family: var(--rb-font-sans);
}

.drf-panel__fields { display: grid; grid-template-columns: repeat(2, 168px); gap: 10px; }
.drf-panel__field { display: flex; flex-direction: column; gap: 6px; }
.drf-panel__label { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }



.drf-panel__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
}

.drf-panel__clear {
  background: none;
  border: none;
  padding: 0;
  color: var(--rb-primary-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.drf-panel__clear:hover:not(:disabled) { text-decoration: underline; }
.drf-panel__clear:disabled { color: var(--rb-text-muted); cursor: default; }

.drf-panel__done {
  height: 30px;
  padding: 0 14px;
  border: 1px solid var(--rb-primary);
  border-radius: 8px;
  background: var(--rb-primary);
  color: #fff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.drf-panel__done:hover { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }

.drf-panel__clear:focus-visible,
.drf-panel__done:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
</style>
