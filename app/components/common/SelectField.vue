<template>
  <!--
    The system's dropdown for portal forms. Same list and keyboard behaviour
    as AuthSelect (the auth screens' version), but the closed field draws
    itself in the same shape as DatePicker, so a date and a select side by
    side look like one family:

      ↑ ↓      move          Enter / Space   choose / open
      Home End first / last  Esc / Tab       close
      a letter jumps to the next option starting with it
  -->
  <div ref="root" class="sf" :class="[`sf--${size}`, { 'sf--open': open, 'sf--up': openUp, 'sf--icon': icon }]">
    <button
      :id="triggerId"
      ref="trigger"
      type="button"
      class="sf-trigger"
      :class="{ 'sf-trigger--invalid': invalid }"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-describedby="describedby"
      :aria-label="ariaLabel ? `${ariaLabel}: ${selected ? selected.label : placeholder}` : undefined"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <AssetIcon v-if="icon" :name="icon" :size="16" class="sf-icon" />
      <span class="sf-value" :class="{ 'is-placeholder': !selected }">
        {{ selected ? selected.label : placeholder }}
      </span>
      <AssetIcon name="chevron-down" :size="16" class="sf-chevron" />
    </button>

    <!-- Teleported to <body>, as DatePicker's panel is, so dialogs and scroll boxes cannot clip it. -->
    <Teleport to="body">
      <Transition name="sf-pop">
        <ul
          v-if="open"
          :id="listId"
          ref="list"
          class="sf-list"
          :class="[`sf-list--${size}`, { 'sf-list--up': openUp, 'sf-list--icon': icon }]"
          :style="listStyle"
          role="listbox"
          tabindex="-1"
          :aria-labelledby="ariaLabel ? undefined : triggerId"
          :aria-label="ariaLabel"
          :aria-activedescendant="activeIndex >= 0 ? optionId(activeIndex) : undefined"
          @keydown="onListKeydown"
        >
          <li
            v-for="(option, i) in options"
            :id="optionId(i)"
            :key="String(option.value)"
            role="option"
            class="sf-option"
            :class="{ 'sf-option--active': i === activeIndex, 'sf-option--selected': same(option.value, modelValue), 'sf-option--disabled': option.disabled }"
            :aria-selected="same(option.value, modelValue)"
            :aria-disabled="option.disabled || undefined"
            @mousemove="option.disabled || (activeIndex = i)"
            @mousedown.prevent
            @click="choose(i)"
          >
            <span class="sf-label">{{ option.label }}</span>
            <AssetIcon v-if="same(option.value, modelValue)" name="check" :size="15" class="sf-check" />
          </li>
          <li v-if="!options.length" class="sf-empty" role="presentation">{{ emptyText }}</li>
        </ul>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import AssetIcon from '~/components/common/AssetIcon.vue'

/** A value a native <select> could carry, plus null for "nothing chosen". */
export type SelectFieldValue = string | number | boolean | null

export interface SelectFieldOption {
  value: SelectFieldValue
  label: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue: SelectFieldValue | undefined
  options: SelectFieldOption[]
  /** Id of the trigger button, so a <label for="…"> points at it. One is made up when left out. */
  id?: string
  placeholder?: string
  icon?: string
  invalid?: boolean
  disabled?: boolean
  describedby?: string
  /** Names the field when no <label> points at it (filters in a toolbar). */
  ariaLabel?: string
  /** Shown in the open list when there are no options. */
  emptyText?: string
  /** sm 36px · md 42px (forms, the default). Matches DatePicker. */
  size?: 'sm' | 'md'
}>(), {
  id: undefined,
  placeholder: 'Select',
  icon: undefined,
  invalid: false,
  disabled: false,
  describedby: undefined,
  ariaLabel: undefined,
  emptyText: 'Nothing to choose',
  size: 'md',
})

const emit = defineEmits<{
  'update:modelValue': [value: SelectFieldValue]
  /** After a choice, like a native select's change event. */
  'change': [value: SelectFieldValue]
}>()

const autoId = useId()
const triggerId = computed(() => props.id ?? `sf-${autoId}`)

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const list = ref<HTMLElement | null>(null)
const open = ref(false)
const openUp = ref(false)
const activeIndex = ref(-1)
const listStyle = ref<Record<string, string>>({})

const listId = computed(() => `${triggerId.value}-listbox`)
const optionId = (i: number) => `${triggerId.value}-option-${i}`

// A native select compares as text, so 3 and "3" are the same choice; null and
// undefined both mean nothing is chosen.
function same(a: SelectFieldValue | undefined, b: SelectFieldValue | undefined) {
  if (a === b) return true
  if (a == null || b == null) return a == null && b == null
  return String(a) === String(b)
}

const selected = computed(() => props.options.find(o => same(o.value, props.modelValue)))

// Roughly the list's maximum height; used to decide whether to open upward.
const LIST_MAX = 280

// Fixed coordinates against the trigger, since the list lives in <body>.
function place() {
  const r = trigger.value?.getBoundingClientRect()
  if (!r) return
  const vh = window.innerHeight
  openUp.value = vh - r.bottom < LIST_MAX + 16 && r.top > LIST_MAX + 16
  listStyle.value = {
    left: `${r.left}px`,
    width: `${Math.max(r.width, 180)}px`,
    ...(openUp.value ? { bottom: `${vh - r.top + 6}px` } : { top: `${r.bottom + 6}px` }),
  }
}

function firstEnabled(from: number, step: 1 | -1) {
  const n = props.options.length
  for (let i = from; i >= 0 && i < n; i += step) {
    if (!props.options[i]!.disabled) return i
  }
  return -1
}

async function openList() {
  if (open.value || props.disabled) return
  place()
  const current = props.options.findIndex(o => same(o.value, props.modelValue))
  activeIndex.value = current >= 0 ? current : firstEnabled(0, 1)
  open.value = true
  window.addEventListener('resize', place)
  window.addEventListener('scroll', onScroll, { capture: true, passive: true })
  await nextTick()
  list.value?.focus()
  scrollActiveIntoView()
}

// Scrolling the page moves the trigger, so the list follows; scrolling the list itself does not.
function onScroll(e: Event) {
  if (e.target !== list.value) place()
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', onScroll, { capture: true })
  if (returnFocus) trigger.value?.focus()
}

function toggle() {
  if (open.value) close()
  else openList()
}

function choose(i: number) {
  const option = props.options[i]
  if (!option || option.disabled) return
  const changed = !same(option.value, props.modelValue)
  emit('update:modelValue', option.value)
  if (changed) emit('change', option.value)
  close()
}

function move(to: number, step: 1 | -1) {
  const last = props.options.length - 1
  let i = Math.min(last, Math.max(0, to))
  // Step over disabled options; stay put at an end with nothing enabled beyond it.
  while (i >= 0 && i <= last && props.options[i]!.disabled) i += step
  if (i < 0 || i > last) return
  activeIndex.value = i
  scrollActiveIntoView()
}

function scrollActiveIntoView() {
  nextTick(() => {
    list.value
      ?.querySelector<HTMLElement>(`#${CSS.escape(optionId(activeIndex.value))}`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

// Type a letter to jump to the next option that starts with it.
function typeahead(key: string) {
  const k = key.toLowerCase()
  const n = props.options.length
  for (let step = 1; step <= n; step++) {
    const i = (activeIndex.value + step) % n
    const option = props.options[i]!
    if (!option.disabled && option.label.toLowerCase().startsWith(k)) {
      activeIndex.value = i
      scrollActiveIntoView()
      return
    }
  }
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
    e.preventDefault()
    openList()
  }
}

function onListKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); move(activeIndex.value + 1, 1); break
    case 'ArrowUp': e.preventDefault(); move(activeIndex.value - 1, -1); break
    case 'Home': e.preventDefault(); move(0, 1); break
    case 'End': e.preventDefault(); move(props.options.length - 1, -1); break
    case 'Enter':
    case ' ':
      e.preventDefault()
      choose(activeIndex.value)
      break
    case 'Escape': e.preventDefault(); e.stopPropagation(); close(); break
    case 'Tab': close(false); break
    default:
      if (e.key.length === 1 && /\S/.test(e.key)) typeahead(e.key)
  }
}

// Click anywhere else closes it.
function onDocumentPointer(e: PointerEvent) {
  const target = e.target as Node
  if (open.value && !root.value?.contains(target) && !list.value?.contains(target)) close(false)
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointer))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointer)
  close(false)
})
</script>

<style scoped>
/*
  Tokens, the same names and defaults as DatePicker's --dp-*, so a page that
  rethemes one rethemes both.
*/
.sf {
  --sf-field: var(--dp-field, var(--rb-surface, #fff));
  --sf-border: var(--dp-border, var(--rb-border-strong, #E2E8F0));
  --sf-text: var(--dp-text, var(--rb-text-primary, #1F2937));
  --sf-muted: var(--dp-muted, var(--rb-text-secondary, #64748B));
  --sf-accent: var(--dp-accent, var(--rb-primary, #1565C0));
  --sf-accent-text: var(--rb-primary-text, #1565C0);
  --sf-ring: rgba(var(--rb-primary-rgb, 21, 101, 192), 0.14);
  --sf-list: #fff;
  --sf-list-border: #E2E8F0;
  --sf-hover: #F1F5F9;
  --sf-h: 42px;
  --sf-radius: 10px;
  --sf-font: 14px;

  position: relative;
  width: 100%;
}
.sf--sm { --sf-h: 36px; --sf-radius: 8px; --sf-font: 13px; }

.sf-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: var(--sf-h);
  padding: 0 12px;
  border: 1px solid var(--sf-border);
  border-radius: var(--sf-radius);
  background: var(--sf-field);
  color: var(--sf-text);
  font: inherit;
  font-size: var(--sf-font);
  text-align: left;
  cursor: pointer;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.sf-trigger:hover:not(:disabled) { border-color: color-mix(in srgb, var(--sf-accent) 35%, var(--sf-border)); }
.sf-trigger:focus-visible,
.sf--open .sf-trigger {
  outline: none;
  border-color: var(--sf-accent);
  box-shadow: 0 0 0 4px var(--sf-ring);
}
.sf-trigger--invalid { border-color: #D92D20; }
.sf-trigger:disabled { opacity: 0.6; cursor: not-allowed; }

.sf-icon { flex-shrink: 0; color: var(--sf-muted); }
.sf-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sf-value.is-placeholder { color: var(--sf-muted); }
.sf-chevron {
  flex-shrink: 0;
  color: var(--sf-muted);
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.sf--open .sf-chevron { transform: rotate(180deg); color: var(--sf-accent-text); }

/* The list: the system's dropdown (ComboInput / AuthSelect). It is teleported
   to <body>, so it carries its own copies of the tokens it uses. */
.sf-list {
  --sf-text: var(--rb-text-primary, #1F2937);
  --sf-muted: var(--rb-text-secondary, #64748B);
  --sf-accent-text: var(--rb-primary-text, #1565C0);
  --sf-list: #fff;
  --sf-list-border: #E2E8F0;
  --sf-hover: #F1F5F9;
  --sf-font: 14px;

  position: fixed;
  z-index: 1000;
  max-height: 264px;
  overflow-y: auto;
  margin: 0;
  padding: 6px;
  list-style: none;
  background: var(--sf-list);
  border: 1px solid var(--sf-list-border);
  border-radius: 12px;
  box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.35);
  outline: none;
}
.sf-list--sm { --sf-font: 13px; }

/* Option text lines up with the field text: 12px field padding = 6px panel
   inset + 6px row padding; with an icon, rows indent past it. */
.sf-option {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 36px;
  padding: 8px 34px 8px 6px;
  border-radius: 8px;
  font-size: var(--sf-font);
  line-height: 1.4;
  color: var(--sf-text);
  cursor: pointer;
  user-select: none;
}
.sf-list--icon .sf-option { padding-left: 32px; }
.sf-option--disabled { color: var(--sf-muted); opacity: .55; cursor: not-allowed; }
.sf-empty { padding: 10px 8px; font-size: var(--sf-font); color: var(--sf-muted); }
.sf-option + .sf-option { margin-top: 2px; }
.sf-option--active { background: var(--sf-hover); }
.sf-option--selected .sf-label { font-weight: 700; color: var(--sf-accent-text); }
.sf-check {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--sf-accent-text);
}

.sf-pop-enter-active,
.sf-pop-leave-active { transition: opacity 140ms ease, transform 160ms cubic-bezier(0.16, 1, 0.3, 1); }
.sf-pop-enter-from,
.sf-pop-leave-to { opacity: 0; transform: translateY(-4px); }
.sf-list--up.sf-pop-enter-from,
.sf-list--up.sf-pop-leave-to { transform: translateY(4px); }

@media (prefers-reduced-motion: reduce) {
  .sf-trigger,
  .sf-chevron,
  .sf-pop-enter-active,
  .sf-pop-leave-active { transition: none; }
}

/* Dark mode. The names are unique (sf-), so the global hook is safe. */
:global(.dark .sf) {
  --sf-field: var(--ink-page, #0F172A);
  --sf-border: var(--ink-border, #334155);
  --sf-text: var(--ink-text, #F1F5F9);
  --sf-muted: var(--ink-text-2, #94A3B8);
}
:global(.dark .sf-list) {
  --sf-text: var(--ink-text, #F1F5F9);
  --sf-muted: var(--ink-text-2, #94A3B8);
  --sf-list: var(--ink-surface, #1E293B);
  --sf-list-border: var(--ink-border, #334155);
  --sf-hover: var(--ink-hover, #263449);
}
</style>
