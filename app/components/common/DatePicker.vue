<template>
  <!--
    A styled date field for the whole system. Drop-in for
    <input type="date">: v-model is the same 'YYYY-MM-DD' string ('' when
    empty), and min / max take the same format.

    The browser's own calendar popup cannot be styled, so it never matched
    RedAgos. This draws its own, in the system tokens (--rb-*), with dark
    mode, a year/month jump (for birth dates), and full keyboard support:

      ← → ↑ ↓   day / week     PageUp PageDown   month
      Home End  week start/end Enter             choose
      Esc       close
  -->
  <div ref="root" class="dp" :class="[`dp--${size}`, { 'dp--open': open, 'dp--disabled': disabled }]">
    <button
      :id="id"
      ref="trigger"
      type="button"
      class="dp-trigger"
      :class="{ 'dp-trigger--invalid': invalid }"
      :disabled="disabled"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-label="ariaLabel ? `${ariaLabel}: ${displayValue || placeholder}` : undefined"
      :aria-describedby="describedby"
      @click="toggle"
      @keydown.down.prevent="openPicker"
    >
      <AssetIcon name="calendar" :size="iconSize" class="dp-trigger-icon" />
      <span class="dp-trigger-value" :class="{ 'is-placeholder': !modelValue }">
        {{ displayValue || placeholder }}
      </span>
      <AssetIcon name="chevron-down" :size="iconSize" class="dp-trigger-chevron" />
    </button>

    <Teleport to="body">
      <Transition name="dp-pop">
        <div
          v-if="open"
          ref="panel"
          class="dp-panel"
          :class="[{ 'dp-panel--light': theme === 'light', 'dp-panel--up': openUp }]"
          :style="panelStyle"
          role="dialog"
          aria-modal="false"
          :aria-label="ariaLabel || 'Choose a date'"
          @keydown.esc.prevent.stop="close()"
        >
          <!-- Header: title switches view; arrows page by month / year range -->
          <div class="dp-head">
            <button type="button" class="dp-title" :aria-label="titleLabel" @click="cycleView">
              {{ title }}
              <AssetIcon name="chevron-down" :size="14" class="dp-title-chevron" :class="{ flipped: view !== 'days' }" />
            </button>
            <div class="dp-nav">
              <button type="button" class="dp-nav-btn" :aria-label="prevLabel" @click="page(-1)">
                <AssetIcon name="chevron-left" :size="16" />
              </button>
              <button type="button" class="dp-nav-btn" :aria-label="nextLabel" @click="page(1)">
                <AssetIcon name="chevron-right" :size="16" />
              </button>
            </div>
          </div>

          <!-- Days -->
          <div v-if="view === 'days'" class="dp-days" role="grid" :aria-label="title" @keydown="onGridKeydown">
            <div class="dp-week dp-weekdays" role="row">
              <span v-for="d in WEEKDAYS" :key="d.full" class="dp-weekday" role="columnheader" :aria-label="d.full">
                {{ d.short }}
              </span>
            </div>
            <div v-for="(week, w) in weeks" :key="w" class="dp-week" role="row">
              <template v-for="(cell, c) in week" :key="c">
                <span v-if="!cell" class="dp-day dp-day--blank" role="gridcell" />
                <span v-else role="gridcell">
                  <button
                    :ref="(el) => setDayRef(cell.iso, el)"
                    type="button"
                    class="dp-day"
                    :class="{
                      'is-today': cell.iso === todayIso,
                      'is-selected': cell.iso === modelValue,
                    }"
                    :disabled="cell.disabled"
                    :tabindex="cell.iso === focusIso ? 0 : -1"
                    :aria-label="cell.label"
                    :aria-pressed="cell.iso === modelValue"
                    :aria-current="cell.iso === todayIso ? 'date' : undefined"
                    @click="choose(cell.iso)"
                  >
                    {{ cell.day }}
                  </button>
                </span>
              </template>
            </div>
          </div>

          <!-- Months -->
          <div v-else-if="view === 'months'" class="dp-grid">
            <button
              v-for="(m, i) in MONTHS"
              :key="m"
              type="button"
              class="dp-cell"
              :class="{ 'is-selected': i === viewMonth && viewYear === selectedParts?.y }"
              :disabled="monthDisabled(i)"
              @click="pickMonth(i)"
            >
              {{ m.slice(0, 3) }}
            </button>
          </div>

          <!-- Years -->
          <div v-else class="dp-grid">
            <button
              v-for="y in yearPage"
              :key="y"
              type="button"
              class="dp-cell"
              :class="{ 'is-selected': y === selectedParts?.y, 'is-today': y === todayParts.y }"
              :disabled="yearDisabled(y)"
              @click="pickYear(y)"
            >
              {{ y }}
            </button>
          </div>

          <div class="dp-foot">
            <button type="button" class="dp-foot-btn dp-foot-btn--ghost" :disabled="!modelValue" @click="clear">
              Clear
            </button>
            <button type="button" class="dp-foot-btn" :disabled="isDisabled(todayIso)" @click="choose(todayIso)">
              Today
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import AssetIcon from '~/components/common/AssetIcon.vue'

const props = withDefaults(defineProps<{
  /** 'YYYY-MM-DD', or '' when empty. Same as <input type="date">. */
  modelValue: string
  id?: string
  min?: string
  max?: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  ariaLabel?: string
  describedby?: string
  /** sm 36px (filters, toolbars) · md 42px (forms) · lg 50px (auth screens). */
  size?: 'sm' | 'md' | 'lg'
  /** 'light' keeps the popup light even in dark mode (the auth screens). */
  theme?: 'auto' | 'light'
}>(), {
  id: undefined,
  min: undefined,
  max: undefined,
  placeholder: 'Select a date',
  disabled: false,
  invalid: false,
  ariaLabel: undefined,
  describedby: undefined,
  size: 'md',
  theme: 'auto',
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// ── Date helpers (local time; a bare 'YYYY-MM-DD' through new Date() is
//    UTC and shows the previous day west of Greenwich) ──
type Parts = { y: number, m: number, d: number }
const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
function parse(iso?: string): Parts | null {
  const match = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? { y: +match[1]!, m: +match[2]! - 1, d: +match[3]! } : null
}
function shift(iso: string, days: number): string {
  const p = parse(iso)!
  const dt = new Date(p.y, p.m, p.d + days)
  return toIso(dt.getFullYear(), dt.getMonth(), dt.getDate())
}
function shiftMonth(iso: string, months: number): string {
  const p = parse(iso)!
  const last = new Date(p.y, p.m + months + 1, 0).getDate()
  const dt = new Date(p.y, p.m + months, Math.min(p.d, last))
  return toIso(dt.getFullYear(), dt.getMonth(), dt.getDate())
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']
// Sunday first, as on Philippine wall calendars.
const WEEKDAYS = [
  { short: 'Su', full: 'Sunday' }, { short: 'Mo', full: 'Monday' }, { short: 'Tu', full: 'Tuesday' },
  { short: 'We', full: 'Wednesday' }, { short: 'Th', full: 'Thursday' }, { short: 'Fr', full: 'Friday' },
  { short: 'Sa', full: 'Saturday' },
]

const now = new Date()
const todayIso = toIso(now.getFullYear(), now.getMonth(), now.getDate())
const todayParts = parse(todayIso)!

const selectedParts = computed(() => parse(props.modelValue))
const displayValue = computed(() => {
  const p = selectedParts.value
  return p
    ? new Date(p.y, p.m, p.d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''
})

const isDisabled = (iso: string) =>
  Boolean((props.min && iso < props.min) || (props.max && iso > props.max))

// ── View state ──
const view = ref<'days' | 'months' | 'years'>('days')
const viewYear = ref(todayParts.y)
const viewMonth = ref(todayParts.m)
const focusIso = ref(todayIso)

const title = computed(() => {
  if (view.value === 'days') return `${MONTHS[viewMonth.value]} ${viewYear.value}`
  if (view.value === 'months') return String(viewYear.value)
  const first = yearPage.value[0]
  return `${first} - ${first! + 11}`
})
const titleLabel = computed(() => view.value === 'days'
  ? `${title.value}. Choose month and year`
  : view.value === 'months' ? `${title.value}. Choose year` : `${title.value}. Back to days`)
const prevLabel = computed(() => ({ days: 'Previous month', months: 'Previous year', years: 'Previous years' })[view.value])
const nextLabel = computed(() => ({ days: 'Next month', months: 'Next year', years: 'Next years' })[view.value])

const yearPage = computed(() => {
  const start = viewYear.value - (((viewYear.value % 12) + 12) % 12)
  return Array.from({ length: 12 }, (_, i) => start + i)
})

const weeks = computed(() => {
  const y = viewYear.value
  const m = viewMonth.value
  const lead = new Date(y, m, 1).getDay()
  const days = new Date(y, m + 1, 0).getDate()
  const cells: Array<null | { iso: string, day: number, disabled: boolean, label: string }> = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= days; d++) {
    const iso = toIso(y, m, d)
    cells.push({
      iso,
      day: d,
      disabled: isDisabled(iso),
      label: new Date(y, m, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    })
  }
  while (cells.length % 7) cells.push(null)
  const out = []
  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7))
  return out
})

const monthDisabled = (m: number) => {
  const first = toIso(viewYear.value, m, 1)
  const last = toIso(viewYear.value, m, new Date(viewYear.value, m + 1, 0).getDate())
  return Boolean((props.max && first > props.max) || (props.min && last < props.min))
}
const yearDisabled = (y: number) =>
  Boolean((props.max && `${y}-01-01` > props.max) || (props.min && `${y}-12-31` < props.min))

function cycleView() {
  view.value = view.value === 'days' ? 'years' : view.value === 'years' ? 'days' : 'years'
}
function page(dir: number) {
  if (view.value === 'days') {
    const dt = new Date(viewYear.value, viewMonth.value + dir, 1)
    viewYear.value = dt.getFullYear()
    viewMonth.value = dt.getMonth()
  } else {
    viewYear.value += dir * (view.value === 'years' ? 12 : 1)
  }
}
function pickYear(y: number) {
  viewYear.value = y
  view.value = 'months'
}
function pickMonth(m: number) {
  viewMonth.value = m
  view.value = 'days'
  focusIso.value = toIso(viewYear.value, m, 1)
}

// ── Open / close / choose ──
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const open = ref(false)
const openUp = ref(false)
const panelStyle = ref<Record<string, string>>({})
const PANEL_W = 272
const PANEL_H = 352

const dayRefs = new Map<string, HTMLButtonElement>()
function setDayRef(iso: string, el: unknown) {
  if (el) dayRefs.set(iso, el as HTMLButtonElement)
  else dayRefs.delete(iso)
}

// The panel is teleported to <body> (so modals and scroll boxes cannot clip
// it) and positioned against the trigger with fixed coordinates.
function place() {
  const r = trigger.value?.getBoundingClientRect()
  if (!r) return
  const vw = window.innerWidth
  const vh = window.innerHeight
  // Touch screens use 36px day cells (see the styles), so the panel widens.
  const panelW = window.matchMedia('(pointer: coarse)').matches ? 296 : PANEL_W
  openUp.value = vh - r.bottom < PANEL_H + 12 && r.top > PANEL_H + 12
  const left = Math.min(Math.max(8, r.left), vw - panelW - 8)
  panelStyle.value = {
    left: `${left}px`,
    width: `${Math.min(panelW, vw - 16)}px`,
    ...(openUp.value ? { bottom: `${vh - r.top + 6}px` } : { top: `${r.bottom + 6}px` }),
  }
}

async function openPicker() {
  if (open.value || props.disabled) return
  const start = selectedParts.value
    ?? parse(props.max && todayIso > props.max ? props.max : props.min && todayIso < props.min ? props.min : todayIso)!
  viewYear.value = start.y
  viewMonth.value = start.m
  view.value = 'days'
  focusIso.value = toIso(start.y, start.m, start.d)
  place()
  open.value = true
  window.addEventListener('resize', place)
  window.addEventListener('scroll', place, { capture: true, passive: true })
  await nextTick()
  dayRefs.get(focusIso.value)?.focus()
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', place, { capture: true })
  if (returnFocus) trigger.value?.focus()
}

function toggle() {
  if (open.value) close()
  else openPicker()
}

function choose(iso: string) {
  if (isDisabled(iso)) return
  emit('update:modelValue', iso)
  close()
}

function clear() {
  emit('update:modelValue', '')
  close()
}

// ── Keyboard in the day grid ──
async function moveFocus(iso: string) {
  if (isDisabled(iso)) return
  const p = parse(iso)!
  viewYear.value = p.y
  viewMonth.value = p.m
  focusIso.value = iso
  await nextTick()
  dayRefs.get(iso)?.focus()
}

function onGridKeydown(e: KeyboardEvent) {
  const f = focusIso.value
  const dow = parse(f) ? new Date(parse(f)!.y, parse(f)!.m, parse(f)!.d).getDay() : 0
  const map: Record<string, () => string> = {
    ArrowLeft: () => shift(f, -1),
    ArrowRight: () => shift(f, 1),
    ArrowUp: () => shift(f, -7),
    ArrowDown: () => shift(f, 7),
    PageUp: () => shiftMonth(f, e.shiftKey ? -12 : -1),
    PageDown: () => shiftMonth(f, e.shiftKey ? 12 : 1),
    Home: () => shift(f, -dow),
    End: () => shift(f, 6 - dow),
  }
  const next = map[e.key]
  if (next) {
    e.preventDefault()
    moveFocus(next())
  }
}

// Click anywhere outside the field and the panel closes it.
function onDocumentPointer(e: PointerEvent) {
  const t = e.target as Node
  if (open.value && !root.value?.contains(t) && !panel.value?.contains(t)) close(false)
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointer))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointer)
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', place, { capture: true })
})

const iconSize = computed(() => (props.size === 'sm' ? 15 : 17))
</script>

<style scoped>
/*
  Tokens. Everything reads --dp-*, which default to the system's --rb-*
  tokens (so dashboards get dark mode for free). A page can retheme the
  field by setting --dp-* on an ancestor; the auth screens do this.
*/
.dp {
  --dp-field: var(--rb-surface, #fff);
  --dp-border: var(--rb-border-strong, #E2E8F0);
  --dp-text: var(--rb-text-primary, #1F2937);
  --dp-muted: var(--rb-text-secondary, #64748B);
  --dp-accent: var(--rb-primary, #1565C0);
  --dp-ring: rgba(var(--rb-primary-rgb, 21, 101, 192), 0.14);
  --dp-radius: 10px;
  --dp-h: 42px;
  --dp-font: 14px;

  position: relative;
  width: 100%;
  font-family: var(--rb-font-sans, inherit);
}
.dp--sm { --dp-h: 36px; --dp-font: 13px; --dp-radius: 8px; }
.dp--lg { --dp-h: 50px; --dp-font: 15px; --dp-radius: 12px; }

.dp-trigger {
  width: 100%;
  height: var(--dp-h);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border: 1px solid var(--dp-border);
  border-radius: var(--dp-radius);
  background: var(--dp-field);
  color: var(--dp-text);
  font: inherit;
  font-size: var(--dp-font);
  text-align: left;
  cursor: pointer;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.dp--lg .dp-trigger { padding: 0 14px; }
.dp-trigger:hover { border-color: color-mix(in srgb, var(--dp-accent) 35%, var(--dp-border)); }
.dp-trigger:focus-visible,
.dp--open .dp-trigger {
  outline: none;
  border-color: var(--dp-accent);
  box-shadow: 0 0 0 4px var(--dp-ring);
}
.dp-trigger--invalid { border-color: #D92D20; }
.dp-trigger:disabled { opacity: 0.6; cursor: not-allowed; }

.dp-trigger-icon { flex-shrink: 0; color: var(--dp-muted); }
.dp--open .dp-trigger-icon { color: var(--dp-accent); }
.dp-trigger-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dp-trigger-value.is-placeholder { color: var(--dp-muted); }
.dp-trigger-chevron {
  flex-shrink: 0;
  color: var(--dp-muted);
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.dp--open .dp-trigger-chevron { transform: rotate(180deg); color: var(--dp-accent); }

@media (prefers-reduced-motion: reduce) {
  .dp-trigger,
  .dp-trigger-chevron { transition: none; }
}
</style>

<!--
  The panel is teleported to <body>, outside this component's tree, so its
  styles are global (prefixed .dp-panel) and its tokens are declared on the
  panel itself. In dark mode they follow html.dark; .dp-panel--light pins
  them light for the auth screens.
-->
<style>
.dp-panel {
  --dpp-surface: #FFFFFF;
  --dpp-text: #1F2937;
  --dpp-muted: #64748B;
  --dpp-faint: #94A3B8;
  --dpp-border: #E2E8F0;
  --dpp-hover: #F1F5F9;
  --dpp-accent: #1565C0;
  --dpp-accent-hover: #0D47A1;
  --dpp-accent-soft: rgba(21, 101, 192, 0.1);
  --dpp-accent-text: #1565C0;
  --dpp-shadow: 0 2px 4px rgba(15, 23, 42, 0.04), 0 20px 44px -16px rgba(15, 23, 42, 0.35);

  /* Day cell size. Compact for a mouse; touch screens get 36px below. */
  --dpp-cell: 32px;

  position: fixed;
  z-index: 1000;
  box-sizing: border-box;
  padding: 12px;
  background: var(--dpp-surface);
  border: 1px solid var(--dpp-border);
  border-radius: 14px;
  box-shadow: var(--dpp-shadow);
  color: var(--dpp-text);
  font-family: var(--rb-font-sans, ui-sans-serif, system-ui, sans-serif);
  -webkit-font-smoothing: antialiased;
}
html.dark .dp-panel:not(.dp-panel--light) {
  --dpp-surface: #1E293B;
  --dpp-text: #F1F5F9;
  --dpp-muted: #94A3B8;
  --dpp-faint: #64748B;
  --dpp-border: #334155;
  --dpp-hover: #263449;
  --dpp-accent-soft: rgba(100, 181, 246, 0.14);
  --dpp-accent-text: #64B5F6;
  --dpp-shadow: 0 20px 44px -16px rgba(0, 0, 0, 0.7);
  color-scheme: dark;
}
.dp-panel--light { color-scheme: light; }
.dp-panel *,
.dp-panel *::before,
.dp-panel *::after { box-sizing: border-box; }

.dp-panel button {
  font: inherit;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
}
.dp-panel button:focus-visible {
  outline: 2px solid var(--dpp-accent);
  outline-offset: 2px;
}
.dp-panel button:disabled { cursor: not-allowed; }

/* ── Header ── */
.dp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.dp-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  margin-left: -6px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.dp-title:hover { background: var(--dpp-hover); }
.dp-title-chevron { color: var(--dpp-muted); transition: transform 200ms ease; }
.dp-title-chevron.flipped { transform: rotate(180deg); }
.dp-nav { display: flex; gap: 4px; }
.dp-nav-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--dpp-muted);
}
.dp-nav-btn:hover { background: var(--dpp-hover); color: var(--dpp-text); }

/* ── Day grid ── */
.dp-days { display: grid; gap: 1px; }
.dp-week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  justify-items: center;
}
.dp-weekdays { margin-bottom: 2px; }
.dp-weekday {
  width: var(--dpp-cell);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  color: var(--dpp-muted);
}
.dp-day {
  width: var(--dpp-cell);
  height: var(--dpp-cell);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  transition: background-color 120ms ease, color 120ms ease;
}
.dp-day--blank { display: block; }
.dp-day:hover:not(:disabled):not(.is-selected) { background: var(--dpp-hover); }
.dp-day.is-today:not(.is-selected) {
  color: var(--dpp-accent-text);
  box-shadow: inset 0 0 0 1.5px var(--dpp-accent);
}
.dp-day.is-selected {
  background: var(--dpp-accent);
  color: #fff;
  box-shadow: 0 6px 14px -6px rgba(21, 101, 192, 0.8);
}
.dp-day:disabled { color: var(--dpp-faint); opacity: 0.55; }

/* ── Month / year grids ── */
.dp-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding: 2px 0;
}
.dp-cell {
  height: 38px;
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 600;
}
.dp-cell:hover:not(:disabled):not(.is-selected) { background: var(--dpp-hover); }
.dp-cell.is-today:not(.is-selected) { color: var(--dpp-accent-text); }
.dp-cell.is-selected { background: var(--dpp-accent); color: #fff; }
.dp-cell:disabled { color: var(--dpp-faint); opacity: 0.55; }

/* ── Footer ── */
.dp-foot {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--dpp-border);
}
.dp-panel .dp-foot-btn {
  height: 32px;
  border-radius: 999px;
  background: var(--dpp-accent);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  transition: background-color 150ms ease;
}
.dp-panel .dp-foot-btn:hover:not(:disabled) { background: var(--dpp-accent-hover); }
.dp-panel .dp-foot-btn--ghost {
  background: var(--dpp-hover);
  color: var(--dpp-text);
}
.dp-panel .dp-foot-btn--ghost:hover:not(:disabled) { background: var(--dpp-border); }
.dp-panel .dp-foot-btn:disabled { opacity: 0.45; }

/* Touch screens keep bigger targets: fingers need ~36px, a mouse does not. */
@media (pointer: coarse) {
  .dp-panel { --dpp-cell: 36px; padding: 14px; }
  .dp-panel .dp-foot-btn { height: 38px; }
}

/* ── Open / close ── */
.dp-pop-enter-active,
.dp-pop-leave-active { transition: opacity 140ms ease, transform 180ms cubic-bezier(0.16, 1, 0.3, 1); }
.dp-pop-enter-from,
.dp-pop-leave-to { opacity: 0; transform: translateY(-6px) scale(0.98); }
.dp-panel--up.dp-pop-enter-from,
.dp-panel--up.dp-pop-leave-to { transform: translateY(6px) scale(0.98); }

@media (prefers-reduced-motion: reduce) {
  .dp-pop-enter-active,
  .dp-pop-leave-active,
  .dp-day,
  .dp-title-chevron { transition: none; }
}
</style>
