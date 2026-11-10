<template>
  <!--
    The portal's ID number field. For the ID types utils/validId.ts knows, the
    number is hyphenated as the card prints it while it is typed, takes only
    the characters it can hold and stops at its length; v-model is the number
    alone (1234567890123456), however it was typed or pasted. Other types take
    the number as printed.

    With `type-picker`, the ID type is chosen in the field itself, on the left
    as PhoneField's country is (v-model:id-type); without it, the type comes
    from a picker beside the field (:id-type). The type is a role="button"
    span rather than a <button>, so a <label> wrapped round the field still
    points at the number input.

    A number of the wrong shape gets a tooltip under the field saying what the
    number is, with an example. Not while it is first typed: once the field is
    left (or `reveal` is set, on a submit), or when a number arrives already
    filled in, and from then on as it is corrected.
  -->
  <div ref="root" class="idf" :class="[`idf--${size}`, { 'idf--open': open, 'idf--invalid': invalid || showProblem, 'idf--disabled': disabled }]">
    <div class="idf-box">
      <template v-if="typePicker">
        <span
          ref="trigger"
          class="idf-type"
          :class="{ 'idf-type--empty': !typeOption }"
          role="button"
          :tabindex="disabled ? -1 : 0"
          aria-haspopup="listbox"
          :aria-expanded="open"
          :aria-controls="listId"
          :aria-disabled="disabled || undefined"
          :aria-label="`ID type: ${typeOption ? typeOption.label : 'not chosen'}`"
          @click.prevent="toggle"
          @keydown="onTriggerKeydown"
        >
          <span class="idf-type__label">{{ typeOption ? (typeOption.short ?? typeOption.label) : typePlaceholder }}</span>
          <AssetIcon name="chevron-down" :size="16" class="idf-chevron" />
        </span>
        <span class="idf-divider" aria-hidden="true" />
      </template>

      <input
        :id="inputId"
        ref="input"
        class="idf-input"
        type="text"
        :inputmode="spec && !spec.letters ? 'numeric' : 'text'"
        :autocapitalize="spec ? 'characters' : 'off'"
        autocomplete="off"
        spellcheck="false"
        :value="display"
        :placeholder="spec ? spec.mask : placeholder"
        :maxlength="spec ? undefined : maxlength"
        :disabled="disabled"
        :required="required"
        :aria-invalid="invalid || showProblem || undefined"
        :aria-describedby="describedBy"
        :aria-label="ariaLabel"
        @input="onInput"
        @compositionend="onInput"
        @keydown="onKeydown"
        @blur="onBlur"
      >
    </div>

    <Transition name="idf-tip">
      <div v-if="showProblem && spec" :id="tipId" class="idf-tip" role="alert">
        <span class="idf-tip__rule">{{ spec.name }}: {{ spec.rule }}</span>
        <span class="idf-tip__example">
          e.g.
          <template v-for="(example, i) in spec.examples" :key="example">
            <template v-if="i"> or </template><span class="idf-tip__number">{{ example }}</span>
          </template>
        </span>
      </div>
    </Transition>

    <!-- Teleported to <body>, as PhoneField's list is, so dialogs and scroll boxes cannot clip it. -->
    <Teleport v-if="typePicker" to="body" :disabled="pageHidden">
      <Transition name="idf-pop">
        <ul
          v-if="open"
          :id="listId"
          ref="list"
          class="idf-list"
          :style="listStyle"
          role="listbox"
          tabindex="-1"
          aria-label="ID type"
          :aria-activedescendant="optionId(activeIndex)"
          @keydown="onListKeydown"
        >
          <li
            v-for="(option, i) in VALID_ID_TYPE_OPTIONS"
            :id="optionId(i)"
            :key="option.value"
            role="option"
            class="idf-option"
            :class="{ 'idf-option--active': i === activeIndex, 'idf-option--selected': option.value === idType }"
            :aria-selected="option.value === idType"
            @mousemove="activeIndex = i"
            @mousedown.prevent
            @click="choose(i)"
          >
            <span class="idf-option__name">{{ option.label }}</span>
            <AssetIcon v-if="option.value === idType" name="check" :size="15" class="idf-check" />
          </li>
        </ul>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { usePageHidden } from '~/composables/useKeptAlive'
import {
  VALID_ID_TYPE_OPTIONS,
  cleanIdNumber,
  formatIdNumber,
  idNumberFormat,
  idNumberProblem,
} from '~/utils/validId'

const props = withDefaults(defineProps<{
  modelValue: string | null | undefined
  /** The ID type (the server's ValidIdType value), which says the number's format. */
  idType?: string | null
  /** Choose the ID type in the field itself, on the left (v-model:id-type). */
  typePicker?: boolean
  /** What the type shows before one is chosen. */
  typePlaceholder?: string
  /** Id of the input, so a <label for="…"> points at it. */
  id?: string
  /** For a type with no format; one with a format shows its own mask. */
  placeholder?: string
  /** For a type with no format; one with a format stops at its own length. */
  maxlength?: number
  required?: boolean
  /** Marks the field (a server error, say) without the tooltip. */
  invalid?: boolean
  /** Shows the tooltip now, left or not: set once a submit is tried. */
  reveal?: boolean
  disabled?: boolean
  describedby?: string
  /** Names the field when no <label> points at it. */
  ariaLabel?: string
  /** sm 36px · md 42px (forms, the default). Matches SelectField. */
  size?: 'sm' | 'md'
}>(), {
  idType: null,
  typePicker: false,
  typePlaceholder: 'ID type',
  id: undefined,
  placeholder: 'As printed on the card',
  maxlength: 50,
  required: false,
  invalid: false,
  reveal: false,
  disabled: false,
  describedby: undefined,
  ariaLabel: undefined,
  size: 'md',
})

const pageHidden = usePageHidden()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:idType': [value: string]
}>()

const autoId = useId()
const inputId = computed(() => props.id ?? `idf-${autoId}`)
const tipId = computed(() => `${inputId.value}-format`)
const listId = computed(() => `${inputId.value}-types`)
const optionId = (i: number) => `${inputId.value}-type-${i}`

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)

const spec = computed(() => idNumberFormat(props.idType))
const number = computed(() => cleanIdNumber(props.idType, props.modelValue))
const display = computed(() => formatIdNumber(props.idType, number.value))
const typeOption = computed(() => VALID_ID_TYPE_OPTIONS.find(option => option.value === props.idType) ?? null)

/* ── The tooltip ────────────────────────────────────────────── */

const left = ref(false)
const problem = computed(() => idNumberProblem(props.idType, number.value))
const showProblem = computed(() => Boolean(problem.value) && (left.value || props.reveal))

const describedBy = computed(() =>
  [props.describedby, showProblem.value ? tipId.value : null].filter(Boolean).join(' ') || undefined)

function onBlur() {
  if (number.value) left.value = true
}

/* ── The number ─────────────────────────────────────────────── */

let sent: string | null = null

function send(value: string) {
  sent = value
  emit('update:modelValue', value)
}

// A number set from outside (a record loaded, a form reset) shows its problem
// at once, as nobody is typing it; a type changed under a number keeps what
// of it the new type can hold. Either way the model is left as the field
// keeps it, so what is sent is what is shown.
watch([() => props.modelValue, () => props.idType], ([value], [before]) => {
  if (value !== before && value !== sent) left.value = Boolean(number.value)
  if (number.value !== (value ?? '')) send(number.value)
}, { immediate: true })

/** The caret position just after the `count`-th letter or digit of `text`. */
function caretAfter(text: string, count: number): number {
  if (count <= 0) return 0
  let seen = 0
  for (let i = 0; i < text.length; i++) {
    if (/[A-Z0-9]/i.test(text[i]!) && ++seen === count) return i + 1
  }
  return text.length
}

function onInput(e: Event) {
  // A phone keyboard composing a word: wait for the word, which compositionend brings.
  if ((e as InputEvent).isComposing) return

  const el = e.target as HTMLInputElement
  if (!spec.value) {
    if (el.value !== (props.modelValue ?? '')) send(el.value)
    return
  }

  const raw = el.value
  const caret = el.selectionStart ?? raw.length
  const next = cleanIdNumber(props.idType, raw)

  // Keep the caret after the same character once the hyphens move.
  const before = Math.min(next.length, cleanIdNumber(props.idType, raw.slice(0, caret)).length)
  const text = formatIdNumber(props.idType, next)
  el.value = text
  const at = caretAfter(text, before)
  el.setSelectionRange(at, at)

  if (next !== number.value) send(next)
}

// Backspace just after a hyphen (or Delete just before one) takes the
// character beyond it; the hyphen is the field's own and would only come back.
function onKeydown(e: KeyboardEvent) {
  const el = e.target as HTMLInputElement
  const at = el.selectionStart
  if (!spec.value || at == null || at !== el.selectionEnd) return
  if (e.key === 'Backspace' && el.value[at - 1] === '-') el.setSelectionRange(at - 1, at - 1)
  else if (e.key === 'Delete' && el.value[at] === '-') el.setSelectionRange(at + 1, at + 1)
}

/* ── The type list ──────────────────────────────────────────── */

const LIST_MAX_HEIGHT = 264

const open = ref(false)
const activeIndex = ref(0)
const listStyle = ref<Record<string, string>>({})

// Fixed coordinates under the field, since the list lives in <body>; above it
// when the space below is too short and there is more above.
function place() {
  const r = root.value?.querySelector('.idf-box')?.getBoundingClientRect()
  if (!r) return
  const below = window.innerHeight - r.bottom
  const style: Record<string, string> = { left: `${r.left}px`, minWidth: `${Math.min(Math.max(r.width, 220), 320)}px` }
  if (below < LIST_MAX_HEIGHT + 12 && r.top > below) style.bottom = `${window.innerHeight - r.top + 6}px`
  else style.top = `${r.bottom + 6}px`
  listStyle.value = style
}

// Scrolling the page moves the field, so the list follows; scrolling the list itself does not.
function onScroll(e: Event) {
  if (e.target !== list.value) place()
}

// Click anywhere else closes it.
function onDocumentPointer(e: PointerEvent) {
  const target = e.target as Node
  if (!root.value?.contains(target) && !list.value?.contains(target)) close(false)
}

function moveTo(i: number) {
  activeIndex.value = i
  nextTick(() => document.getElementById(optionId(i))?.scrollIntoView({ block: 'nearest' }))
}

async function openList() {
  if (open.value || props.disabled) return
  place()
  open.value = true
  window.addEventListener('resize', place)
  window.addEventListener('scroll', onScroll, { capture: true, passive: true })
  document.addEventListener('pointerdown', onDocumentPointer)
  await nextTick()
  moveTo(Math.max(0, VALID_ID_TYPE_OPTIONS.findIndex(option => option.value === props.idType)))
  list.value?.focus()
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', onScroll, { capture: true })
  document.removeEventListener('pointerdown', onDocumentPointer)
  if (returnFocus) trigger.value?.focus()
}

function toggle() {
  if (open.value) close()
  else openList()
}

function choose(i: number) {
  const option = VALID_ID_TYPE_OPTIONS[i]
  if (!option) return
  if (option.value !== props.idType) emit('update:idType', option.value)
  close(false)
  input.value?.focus()
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
    e.preventDefault()
    openList()
  }
}

function onListKeydown(e: KeyboardEvent) {
  const last = VALID_ID_TYPE_OPTIONS.length - 1
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); moveTo(Math.min(last, activeIndex.value + 1)); break
    case 'ArrowUp': e.preventDefault(); moveTo(Math.max(0, activeIndex.value - 1)); break
    case 'Home': e.preventDefault(); moveTo(0); break
    case 'End': e.preventDefault(); moveTo(last); break
    case 'Enter':
    case ' ':
      e.preventDefault()
      choose(activeIndex.value)
      break
    case 'Escape': e.preventDefault(); e.stopPropagation(); close(); break
    case 'Tab': close(false); break
    default: {
      // A letter jumps to the next type starting with it, as SelectField's list does.
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      const letter = e.key.toLowerCase()
      const count = VALID_ID_TYPE_OPTIONS.length
      for (let step = 1; step <= count; step++) {
        const i = (activeIndex.value + step) % count
        if (VALID_ID_TYPE_OPTIONS[i]!.label.toLowerCase().startsWith(letter)) {
          moveTo(i)
          break
        }
      }
    }
  }
}

onBeforeUnmount(() => close(false))
</script>

<style scoped>
/*
  Tokens. The defaults are the system's form field, as PhoneField's are; a
  page whose inputs are drawn differently sets these on the field
  (class="…" on <IdNumberField>), under a parent class so the page's rule
  outranks .idf's own.
*/
.idf {
  --idf-h: 42px;
  --idf-radius: 10px;
  --idf-font: 14px;
  --idf-pad: 12px;
  --idf-field: var(--rb-surface, #fff);
  --idf-border: var(--rb-border-strong, #E2E8F0);
  --idf-text: var(--rb-text-primary, #1F2937);
  --idf-muted: var(--rb-text-secondary, #64748B);
  --idf-placeholder: var(--rb-placeholder, #64748B);
  --idf-accent: var(--rb-primary, #1565C0);
  --idf-focus: var(--rb-focus-ring, 0 0 0 4px rgba(21, 101, 192, 0.14));
  --idf-hover: var(--rb-surface-hover, #F1F5F9);
  --idf-disabled-field: var(--rb-surface-alt, #FAFBFC);
  --idf-disabled-text: var(--idf-text);
  --idf-danger: #D92D20;
  --idf-tip-field: #FEF3F2;
  --idf-tip-border: #FECDCA;
  --idf-tip-text: #B42318;
  --idf-tip-number: #7A271A;

  position: relative;
  width: 100%;
}
.idf--sm { --idf-h: 36px; --idf-radius: 8px; --idf-font: 13px; }

/* The box: the type (when picked here) and the number. */
.idf-box {
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--idf-h);
  border: 1px solid var(--idf-border);
  border-radius: var(--idf-radius);
  background: var(--idf-field);
  color: var(--idf-text);
  font-size: var(--idf-font);
  transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
}
.idf:not(.idf--disabled) .idf-box:hover:not(:focus-within) { border-color: color-mix(in srgb, var(--idf-accent) 35%, var(--idf-border)); }
.idf-box:focus-within,
.idf--open .idf-box {
  border-color: var(--idf-accent);
  box-shadow: var(--idf-focus);
}
.idf--invalid .idf-box,
.idf--invalid .idf-box:hover { border-color: var(--idf-danger); }
.idf--disabled .idf-box { background: var(--idf-disabled-field); cursor: var(--idf-disabled-cursor, default); }

/* The type: its name and a chevron. */
.idf-type {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  height: 100%;
  max-width: 58%;
  padding: 0 9px 0 var(--idf-pad);
  border-radius: calc(var(--idf-radius) - 1px) 0 0 calc(var(--idf-radius) - 1px);
  cursor: pointer;
  user-select: none;
  outline: none;
  transition: background-color 150ms ease;
}
.idf-type:hover,
.idf-type:focus-visible { background: var(--idf-hover); }
.idf--disabled .idf-type { cursor: inherit; background: none; }
.idf-type__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.idf-type--empty .idf-type__label { color: var(--idf-placeholder); }
.idf--disabled .idf-type__label { color: var(--idf-disabled-text); }
.idf-chevron {
  flex-shrink: 0;
  color: var(--idf-muted);
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.idf--open .idf-chevron { transform: rotate(180deg); color: var(--idf-accent); }
.idf--disabled .idf-chevron { opacity: 0.5; }

.idf-divider {
  flex-shrink: 0;
  width: 1px;
  height: 56%;
  background: var(--idf-border);
}

/* The number. */
.idf-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  margin: 0;
  padding: 0 var(--idf-pad);
  border: 0;
  border-radius: var(--idf-radius);
  background: transparent;
  color: var(--idf-text);
  font: inherit;
  font-size: var(--idf-font);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  outline: none;
  box-shadow: none;
}
.idf-input::placeholder { color: var(--idf-placeholder); opacity: 1; letter-spacing: 0.02em; }
.idf-input:disabled {
  color: var(--idf-disabled-text);
  -webkit-text-fill-color: var(--idf-disabled-text);
  opacity: 1;
  cursor: inherit;
}

/* The tooltip: under the field, pointing up at it. */
.idf-tip {
  position: absolute;
  z-index: 30;
  top: calc(100% + 8px);
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: max-content;
  max-width: max(100%, 240px);
  padding: 8px 11px;
  border: 1px solid var(--idf-tip-border);
  border-radius: 8px;
  background: var(--idf-tip-field);
  color: var(--idf-tip-text);
  font-size: 12.5px;
  line-height: 1.4;
  box-shadow: 0 8px 20px -10px rgba(15, 23, 42, 0.3);
}
.idf-tip::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 16px;
  width: 10px;
  height: 10px;
  border-top: 1px solid var(--idf-tip-border);
  border-left: 1px solid var(--idf-tip-border);
  background: var(--idf-tip-field);
  transform: rotate(45deg);
}
.idf-tip__rule { font-weight: 600; }
.idf-tip__number {
  font-family: var(--rb-font-mono, ui-monospace, monospace);
  font-weight: 600;
  color: var(--idf-tip-number);
  letter-spacing: 0.02em;
}

/* The list: the system's dropdown (SelectField, PhoneField). It is teleported
   to <body>, so it carries its own copies of the tokens it uses. */
.idf-list {
  --idf-text: var(--rb-text-primary, #1F2937);
  --idf-accent-text: var(--rb-primary-text, #1565C0);

  position: fixed;
  z-index: 1000;
  max-height: 264px;
  overflow-y: auto;
  margin: 0;
  padding: 6px;
  list-style: none;
  background: var(--rb-surface, #fff);
  border: 1px solid var(--rb-border-strong, #E2E8F0);
  border-radius: 12px;
  box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.35);
  outline: none;
}
.idf-option {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--idf-text);
  cursor: pointer;
  user-select: none;
}
.idf-option + .idf-option { margin-top: 2px; }
.idf-option--active { background: var(--rb-surface-hover, #F1F5F9); }
.idf-option__name { flex: 1; min-width: 0; }
.idf-option--selected .idf-option__name { font-weight: 700; color: var(--idf-accent-text); }
.idf-check { flex-shrink: 0; color: var(--idf-accent-text); }

.idf-tip-enter-active,
.idf-tip-leave-active,
.idf-pop-enter-active,
.idf-pop-leave-active { transition: opacity 140ms ease, transform 160ms cubic-bezier(0.16, 1, 0.3, 1); }
.idf-tip-enter-from,
.idf-tip-leave-to { opacity: 0; transform: translateY(-3px); }
.idf-pop-enter-from,
.idf-pop-leave-to { opacity: 0; transform: translateY(-4px); }

@media (prefers-reduced-motion: reduce) {
  .idf-box,
  .idf-type,
  .idf-chevron,
  .idf-tip-enter-active,
  .idf-tip-leave-active,
  .idf-pop-enter-active,
  .idf-pop-leave-active { transition: none; }
}
</style>
