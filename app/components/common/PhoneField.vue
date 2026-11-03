<template>
  <!--
    The portal's phone number field: the country (flag and calling code) on
    the left, the number on the right, spaced as it is read and cut at the
    length a Philippine number really has (utils/phone.ts). v-model is E.164,
    +639171234567, or '' for no number; a 0917…, 63… or +63… number typed or
    pasted in is read the same way.

    The country is a role="button" span rather than a <button>, so a <label>
    wrapped round the field still points at the number input; its click is
    prevented so that label does not take the focus off the open list.
  -->
  <div ref="root" class="pf" :class="[`pf--${size}`, { 'pf--open': open, 'pf--invalid': invalid, 'pf--disabled': disabled }]">
    <span
      ref="trigger"
      class="pf-country"
      role="button"
      :tabindex="disabled ? -1 : 0"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-disabled="disabled || undefined"
      :aria-label="`Country code: ${country.name} +${country.dial}`"
      @click.prevent="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="pf-flag" aria-hidden="true" v-html="FLAGS[country.code]" />
      <span class="pf-dial">+{{ country.dial }}</span>
      <AssetIcon name="chevron-down" :size="16" class="pf-chevron" />
    </span>
    <span class="pf-divider" aria-hidden="true" />
    <input
      :id="inputId"
      ref="input"
      class="pf-input"
      type="tel"
      inputmode="tel"
      :value="display"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :disabled="disabled"
      :required="required"
      :aria-invalid="invalid || undefined"
      :aria-describedby="describedby"
      :aria-label="ariaLabel"
      @input="onInput"
      @keydown="onInputKeydown"
    >

    <!-- Teleported to <body>, as SelectField's list is, so dialogs and scroll boxes cannot clip it. -->
    <Teleport to="body">
      <Transition name="pf-pop">
        <ul
          v-if="open"
          :id="listId"
          ref="list"
          class="pf-list"
          :style="listStyle"
          role="listbox"
          tabindex="-1"
          aria-label="Country code"
          :aria-activedescendant="optionId(activeIndex)"
          @keydown="onListKeydown"
        >
          <li
            v-for="(option, i) in PHONE_COUNTRIES"
            :id="optionId(i)"
            :key="option.code"
            role="option"
            class="pf-option"
            :class="{ 'pf-option--active': i === activeIndex, 'pf-option--selected': option.code === country.code }"
            :aria-selected="option.code === country.code"
            @mousemove="activeIndex = i"
            @mousedown.prevent
            @click="choose(i)"
          >
            <span class="pf-flag pf-flag--sm" aria-hidden="true" v-html="FLAGS[option.code]" />
            <span class="pf-option__name">{{ option.name }}</span>
            <span class="pf-option__dial">+{{ option.dial }}</span>
            <AssetIcon v-if="option.code === country.code" name="check" :size="15" class="pf-check" />
          </li>
        </ul>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import phFlag from '~/assets/flags/ph.svg?raw'
import {
  PHONE_COUNTRIES,
  groupNationalDigits,
  limitNationalDigits,
  nationalDigits,
  toE164,
} from '~/utils/phone'

const FLAGS: Record<string, string> = { PH: phFlag }

const props = withDefaults(defineProps<{
  modelValue: string | null | undefined
  /** Id of the number input, so a <label for="…"> points at it. */
  id?: string
  /** Also take a landline (9 digits). Account phones are mobiles only. */
  landline?: boolean
  placeholder?: string
  autocomplete?: string
  required?: boolean
  invalid?: boolean
  disabled?: boolean
  describedby?: string
  /** Names the field when no <label> points at it. */
  ariaLabel?: string
  /** sm 36px · md 42px (forms, the default). Matches SelectField. */
  size?: 'sm' | 'md'
}>(), {
  id: undefined,
  landline: false,
  placeholder: '9XX XXX XXXX',
  autocomplete: 'tel-national',
  required: false,
  invalid: false,
  disabled: false,
  describedby: undefined,
  ariaLabel: undefined,
  size: 'md',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const autoId = useId()
const inputId = computed(() => props.id ?? `pf-${autoId}`)
const listId = computed(() => `${inputId.value}-countries`)
const optionId = (i: number) => `${inputId.value}-country-${i}`

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)

const countryCode = ref(PHONE_COUNTRIES[0]!.code)
const country = computed(() => PHONE_COUNTRIES.find(c => c.code === countryCode.value) ?? PHONE_COUNTRIES[0]!)

/* ── The number ─────────────────────────────────────────────── */

const digits = ref(limitNationalDigits(nationalDigits(props.modelValue), props.landline))
const display = computed(() => groupNationalDigits(digits.value))

// A value set from outside (a form reset, a record loaded). The field's own
// edits come back here too and match, so the caret is left where it is.
watch(() => props.modelValue, (value) => {
  const next = limitNationalDigits(nationalDigits(value), props.landline)
  if (next !== digits.value) digits.value = next
})

/** The caret position just after the `count`-th digit of `text`. */
function caretAfter(text: string, count: number): number {
  if (count <= 0) return 0
  let seen = 0
  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text[i]!) && ++seen === count) return i + 1
  }
  return text.length
}

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const raw = el.value
  const caret = el.selectionStart ?? raw.length

  const parsed = nationalDigits(raw)
  const next = limitNationalDigits(parsed, props.landline)

  // Keep the caret after the same digit once the spaces move, less any
  // prefix the parse dropped (+63, the leading 0).
  const dropped = raw.replace(/\D/g, '').length - parsed.length
  const before = Math.min(next.length, Math.max(0, raw.slice(0, caret).replace(/\D/g, '').length - dropped))
  const text = groupNationalDigits(next)
  el.value = text
  const at = caretAfter(text, before)
  el.setSelectionRange(at, at)

  if (next !== digits.value) {
    digits.value = next
    emit('update:modelValue', toE164(next, country.value))
  }
}

// Backspace just after a space (or Delete just before one) takes the digit
// beyond it; the space is the field's own and would only come back.
function onInputKeydown(e: KeyboardEvent) {
  const el = e.target as HTMLInputElement
  const at = el.selectionStart
  if (at == null || at !== el.selectionEnd) return
  if (e.key === 'Backspace' && el.value[at - 1] === ' ') el.setSelectionRange(at - 1, at - 1)
  else if (e.key === 'Delete' && el.value[at] === ' ') el.setSelectionRange(at + 1, at + 1)
}

/* ── The country list ───────────────────────────────────────── */

const open = ref(false)
const activeIndex = ref(0)
const listStyle = ref<Record<string, string>>({})

// Fixed coordinates under the field, since the list lives in <body>.
function place() {
  const r = root.value?.getBoundingClientRect()
  if (!r) return
  listStyle.value = { left: `${r.left}px`, top: `${r.bottom + 6}px`, minWidth: `${Math.min(Math.max(r.width, 220), 320)}px` }
}

// Scrolling the page moves the field, so the list follows; scrolling the list itself does not.
function onScroll(e: Event) {
  if (e.target !== list.value) place()
}

async function openList() {
  if (open.value || props.disabled) return
  place()
  activeIndex.value = Math.max(0, PHONE_COUNTRIES.findIndex(c => c.code === countryCode.value))
  open.value = true
  window.addEventListener('resize', place)
  window.addEventListener('scroll', onScroll, { capture: true, passive: true })
  await nextTick()
  list.value?.focus()
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
  const option = PHONE_COUNTRIES[i]
  if (!option) return
  countryCode.value = option.code
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
  const last = PHONE_COUNTRIES.length - 1
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); activeIndex.value = Math.min(last, activeIndex.value + 1); break
    case 'ArrowUp': e.preventDefault(); activeIndex.value = Math.max(0, activeIndex.value - 1); break
    case 'Home': e.preventDefault(); activeIndex.value = 0; break
    case 'End': e.preventDefault(); activeIndex.value = last; break
    case 'Enter':
    case ' ':
      e.preventDefault()
      choose(activeIndex.value)
      break
    case 'Escape': e.preventDefault(); e.stopPropagation(); close(); break
    case 'Tab': close(false); break
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
  Tokens. The defaults are the system's form field; a page whose inputs are
  drawn differently sets these on the field (class="…" on <PhoneField>), under
  a parent class so the page's rule outranks .pf's own.
*/
.pf {
  --pf-h: 42px;
  --pf-radius: 10px;
  --pf-font: 14px;
  --pf-field: var(--rb-surface, #fff);
  --pf-border: var(--rb-border-strong, #E2E8F0);
  --pf-text: var(--rb-text-primary, #1F2937);
  --pf-muted: var(--rb-text-secondary, #64748B);
  --pf-placeholder: var(--rb-placeholder, #64748B);
  --pf-accent: var(--rb-primary, #1565C0);
  --pf-focus: var(--rb-focus-ring, 0 0 0 4px rgba(21, 101, 192, 0.14));
  --pf-hover: var(--rb-surface-hover, #F1F5F9);
  --pf-disabled-field: var(--rb-surface-alt, #FAFBFC);
  --pf-disabled-text: var(--pf-text);
  --pf-danger: #D92D20;
  --pf-flag: 22px;

  display: flex;
  align-items: center;
  width: 100%;
  height: var(--pf-h);
  border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius);
  background: var(--pf-field);
  color: var(--pf-text);
  font-size: var(--pf-font);
  transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
}
.pf--sm { --pf-h: 36px; --pf-radius: 8px; --pf-font: 13px; --pf-flag: 20px; }

.pf:hover:not(.pf--disabled):not(:focus-within) { border-color: color-mix(in srgb, var(--pf-accent) 35%, var(--pf-border)); }
.pf:focus-within,
.pf--open {
  border-color: var(--pf-accent);
  box-shadow: var(--pf-focus);
}
.pf--invalid,
.pf--invalid:hover:not(.pf--disabled) { border-color: var(--pf-danger); }
.pf--disabled { background: var(--pf-disabled-field); cursor: var(--pf-disabled-cursor, default); }

/* The country: flag, +63, chevron. */
.pf-country {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 7px;
  height: 100%;
  padding: 0 9px 0 11px;
  border-radius: calc(var(--pf-radius) - 1px) 0 0 calc(var(--pf-radius) - 1px);
  cursor: pointer;
  user-select: none;
  outline: none;
  transition: background-color 150ms ease;
}
.pf-country:hover,
.pf-country:focus-visible { background: var(--pf-hover); }
.pf--disabled .pf-country { cursor: default; background: none; }

.pf-flag {
  display: block;
  flex-shrink: 0;
  width: var(--pf-flag);
  height: var(--pf-flag);
  overflow: hidden;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.08);
}
.pf-flag :deep(svg) { display: block; width: 100%; height: 100%; }
.pf-flag--sm { --pf-flag: 20px; }

.pf-dial {
  font-variant-numeric: tabular-nums;
  color: var(--pf-text);
}
.pf-chevron {
  flex-shrink: 0;
  margin-left: -1px;
  color: var(--pf-muted);
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.pf--open .pf-chevron { transform: rotate(180deg); color: var(--pf-accent); }
.pf--disabled .pf-chevron { opacity: 0.5; }

.pf-divider {
  flex-shrink: 0;
  width: 1px;
  height: 56%;
  background: var(--pf-border);
}

/* The number. */
.pf-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 12px;
  border: 0;
  border-radius: 0 calc(var(--pf-radius) - 1px) calc(var(--pf-radius) - 1px) 0;
  background: transparent;
  color: var(--pf-text);
  font: inherit;
  font-size: var(--pf-font);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
  outline: none;
  box-shadow: none;
}
.pf-input::placeholder { color: var(--pf-placeholder); opacity: 1; }
.pf-input:disabled {
  color: var(--pf-disabled-text);
  -webkit-text-fill-color: var(--pf-disabled-text);
  opacity: 1;
  cursor: inherit;
}

/* The list: the system's dropdown (SelectField). It is teleported to <body>,
   so it carries its own copies of the tokens it uses. */
.pf-list {
  --pf-text: var(--rb-text-primary, #1F2937);
  --pf-muted: var(--rb-text-secondary, #64748B);
  --pf-accent-text: var(--rb-primary-text, #1565C0);

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
.pf-option {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--pf-text);
  cursor: pointer;
  user-select: none;
}
.pf-option + .pf-option { margin-top: 2px; }
.pf-option--active { background: var(--rb-surface-hover, #F1F5F9); }
.pf-option__name { flex: 1; min-width: 0; }
.pf-option__dial { color: var(--pf-muted); font-variant-numeric: tabular-nums; }
.pf-option--selected .pf-option__name { font-weight: 700; color: var(--pf-accent-text); }
.pf-check { flex-shrink: 0; color: var(--pf-accent-text); }

.pf-pop-enter-active,
.pf-pop-leave-active { transition: opacity 140ms ease, transform 160ms cubic-bezier(0.16, 1, 0.3, 1); }
.pf-pop-enter-from,
.pf-pop-leave-to { opacity: 0; transform: translateY(-4px); }

@media (prefers-reduced-motion: reduce) {
  .pf,
  .pf-country,
  .pf-chevron,
  .pf-pop-enter-active,
  .pf-pop-leave-active { transition: none; }
}
</style>
