<template>
  <div class="combo" :class="{ 'combo--open': open && filtered.length, 'combo--disabled': disabled }">
    <input
      :id="id"
      ref="inputEl"
      :value="modelValue"
      type="text"
      class="combo__input"
      role="combobox"
      autocomplete="off"
      :aria-label="ariaLabel || undefined"
      :aria-expanded="open && filtered.length > 0"
      :aria-controls="listId"
      :aria-activedescendant="activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :disabled="disabled"
      @input="onInput"
      @focus="openList"
      @click="openList"
      @blur="onBlur"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter="onEnter"
      @keydown.esc="close"
    >
    <button
      type="button"
      class="combo__toggle"
      tabindex="-1"
      :disabled="disabled"
      aria-hidden="true"
      @mousedown.prevent="toggle"
    >
      <AssetIcon name="chevron-down" :size="15" />
    </button>

    <ul v-if="open && filtered.length" :id="listId" class="combo__list" role="listbox">
      <li
        v-for="(option, index) in filtered"
        :id="`${listId}-${index}`"
        :key="option.label"
        role="option"
        class="combo__option"
        :class="{ 'combo__option--active': index === activeIndex, 'combo__option--selected': option.label === modelValue }"
        :aria-selected="option.label === modelValue"
        @mousedown.prevent="choose(option)"
        @mouseenter="activeIndex = index"
      >
        <span class="combo__label">{{ option.label }}</span>
        <span v-if="option.hint" class="combo__hint">{{ option.hint }}</span>
        <AssetIcon v-if="option.label === modelValue" name="check" :size="14" class="combo__check" />
      </li>
    </ul>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

/**
 * A text field with a styled suggestion list: pick one, or type your own.
 *
 * Replaces <input list> + <datalist>, which the browser draws itself (white,
 * system font, no dark mode) and so never matched the rest of the form. The
 * value is still free text, exactly as it was with a datalist.
 *
 * options: strings, or { label, hint? }.
 */
const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  maxlength: { type: [Number, String], default: undefined },
  id: { type: String, default: undefined },
  ariaLabel: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const listId = `combo-${Math.random().toString(36).slice(2, 9)}`
const inputEl = ref(null)
const open = ref(false)
const activeIndex = ref(-1)
// Filter only while the person is typing; on open, show everything.
const typing = ref(false)

const normalized = computed(() =>
  props.options.map((option) => (typeof option === 'string' ? { label: option } : option))
)

const filtered = computed(() => {
  const query = (props.modelValue || '').trim().toLowerCase()
  if (!typing.value || !query) return normalized.value
  return normalized.value.filter((option) => option.label.toLowerCase().includes(query))
})

function openList() {
  if (props.disabled) return
  open.value = true
  typing.value = false
  activeIndex.value = normalized.value.findIndex((option) => option.label === props.modelValue)
}

function close() {
  open.value = false
  activeIndex.value = -1
}

function toggle() {
  if (open.value) {
    close()
  } else {
    inputEl.value?.focus()
    openList()
  }
}

function onInput(event) {
  emit('update:modelValue', event.target.value)
  typing.value = true
  open.value = true
  activeIndex.value = -1
}

function onBlur() {
  close()
}

function move(step) {
  if (!open.value) openList()
  const count = filtered.value.length
  if (!count) return
  activeIndex.value = (activeIndex.value + step + count) % count
}

function choose(option) {
  emit('update:modelValue', option.label)
  close()
}

function onEnter(event) {
  // Enter picks the highlighted suggestion; with none highlighted it does
  // nothing special, so a typed custom value (or a form submit) goes through.
  if (open.value && activeIndex.value >= 0 && filtered.value[activeIndex.value]) {
    event.preventDefault()
    choose(filtered.value[activeIndex.value])
  }
}
</script>

<style scoped>
.combo { position: relative; width: 100%; }

.combo__input {
  width: 100%;
  padding: 9px 36px 9px 12px;
  border-radius: 10px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.combo__input::placeholder { color: var(--rb-placeholder); }
.combo__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.combo__input:disabled { background: var(--rb-surface-alt); cursor: not-allowed; }

.combo__toggle {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--rb-text-secondary);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.combo--open .combo__toggle { transform: translateY(-50%) rotate(180deg); }
.combo__toggle:disabled { cursor: not-allowed; opacity: 0.5; }

.combo__list {
  position: absolute;
  z-index: 30;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  max-height: 260px;
  overflow-y: auto;
  margin: 0;
  padding: 6px;
  list-style: none;
  border: 1px solid var(--rb-border-strong);
  border-radius: 12px;
  background: var(--rb-surface);
  box-shadow: 0 12px 32px -12px rgba(var(--rb-shadow-rgb), 0.35);
}

.combo__option {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 8px 32px 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--rb-text-primary);
}
.combo__option--active { background: var(--rb-surface-hover); }
.combo__option--selected .combo__label { font-weight: 700; color: var(--rb-primary-text); }
.combo__hint { font-size: 11.5px; color: var(--rb-text-secondary); }
.combo__check { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--rb-primary-text); }

@media (prefers-reduced-motion: reduce) {
  .combo__toggle { transition: none; }
}
</style>
