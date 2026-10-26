<template>
  <!--
    A styled dropdown for the auth screens. The browser's native <select>
    list cannot be styled (square, system font, system blue), so this draws
    its own while keeping the listbox semantics and keyboard behaviour of a
    real select:

      ↑ ↓      move          Enter / Space   choose / open
      Home End first / last  Esc / Tab       close
      a letter jumps to the next option starting with it
  -->
  <div ref="root" class="au-select" :class="{ open, 'open--up': openUp, 'has-icon': icon }">
    <button
      :id="id"
      ref="trigger"
      type="button"
      class="au-input au-select-trigger"
      :class="{ 'au-input--invalid': invalid }"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-describedby="describedby"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <AssetIcon v-if="icon" :name="icon" :size="18" class="au-icon" />
      <span class="au-select-value" :class="{ 'is-placeholder': !selected }">
        {{ selected ? selected.label : placeholder }}
      </span>
      <AssetIcon name="chevron-down" :size="18" class="au-select-chevron" />
    </button>

    <Transition name="au-pop">
      <ul
        v-if="open"
        :id="listId"
        ref="list"
        class="au-select-list"
        role="listbox"
        tabindex="-1"
        :aria-labelledby="id"
        :aria-activedescendant="activeIndex >= 0 ? optionId(activeIndex) : undefined"
        @keydown="onListKeydown"
      >
        <li
          v-for="(option, i) in options"
          :id="optionId(i)"
          :key="String(option.value)"
          role="option"
          class="au-select-option"
          :class="{ active: i === activeIndex, selected: option.value === modelValue }"
          :aria-selected="option.value === modelValue"
          @mousemove="activeIndex = i"
          @mousedown.prevent
          @click="choose(i)"
        >
          <span class="au-select-label">{{ option.label }}</span>
          <AssetIcon v-if="option.value === modelValue" name="check" :size="15" class="au-select-check" />
        </li>
      </ul>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import AssetIcon from '~/components/common/AssetIcon.vue'

export interface AuthSelectOption {
  value: string
  label: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: AuthSelectOption[]
  /** Id of the trigger button, so a <label for="…"> points at it. */
  id: string
  placeholder?: string
  icon?: string
  invalid?: boolean
  describedby?: string
}>(), {
  placeholder: 'Select',
  icon: undefined,
  invalid: false,
  describedby: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const list = ref<HTMLElement | null>(null)
const open = ref(false)
const openUp = ref(false)
const activeIndex = ref(-1)

const listId = computed(() => `${props.id}-listbox`)
const optionId = (i: number) => `${props.id}-option-${i}`
const selected = computed(() => props.options.find(o => o.value === props.modelValue))

// Roughly the list's maximum height; used to decide whether to open upward.
const LIST_MAX = 280

async function openList() {
  if (open.value) return
  const rect = trigger.value?.getBoundingClientRect()
  openUp.value = Boolean(rect && window.innerHeight - rect.bottom < LIST_MAX + 16 && rect.top > LIST_MAX + 16)
  activeIndex.value = Math.max(0, props.options.findIndex(o => o.value === props.modelValue))
  open.value = true
  await nextTick()
  list.value?.focus()
  scrollActiveIntoView()
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  if (returnFocus) trigger.value?.focus()
}

function toggle() {
  if (open.value) close()
  else openList()
}

function choose(i: number) {
  const option = props.options[i]
  if (option) emit('update:modelValue', option.value)
  close()
}

function move(to: number) {
  const last = props.options.length - 1
  activeIndex.value = Math.min(last, Math.max(0, to))
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
    if (props.options[i]!.label.toLowerCase().startsWith(k)) {
      move(i)
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
    case 'ArrowDown': e.preventDefault(); move(activeIndex.value + 1); break
    case 'ArrowUp': e.preventDefault(); move(activeIndex.value - 1); break
    case 'Home': e.preventDefault(); move(0); break
    case 'End': e.preventDefault(); move(props.options.length - 1); break
    case 'Enter':
    case ' ':
      e.preventDefault()
      choose(activeIndex.value)
      break
    case 'Escape': e.preventDefault(); close(); break
    case 'Tab': close(false); break
    default:
      if (e.key.length === 1 && /\S/.test(e.key)) typeahead(e.key)
  }
}

// Click anywhere else closes it.
function onDocumentPointer(e: PointerEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) close(false)
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointer))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointer))
</script>

<style scoped>
.au-select { position: relative; }

/* The trigger reuses .au-input (from AuthShell) for its look. */
.au-select-trigger {
  width: 100%;
  padding-right: 14px;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.au-select.open .au-select-trigger {
  background: var(--au-field-focus);
  border-color: var(--au-accent);
  box-shadow: 0 0 0 4px var(--au-accent-soft);
}
.au-select-trigger:focus-visible {
  outline: none;
  border-color: var(--au-accent);
  box-shadow: 0 0 0 4px var(--au-accent-soft);
}

.au-select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  color: var(--au-text);
}
.au-select-value.is-placeholder { color: var(--au-muted); }

.au-select-chevron {
  flex-shrink: 0;
  color: var(--au-muted);
  transition: transform 200ms var(--au-ease);
}
.au-select.open .au-select-chevron { transform: rotate(180deg); color: var(--au-accent-text); }

/* ── The list ──
   Matches the system's own dropdown (components/common/ComboInput.vue, used
   in Blood Center settings and staff): 12px panel with 6px inset, 8px
   option rows, a neutral grey hover, and the selected row bold in the
   primary blue with a check pinned to the right. */
.au-select-list {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  z-index: 30;
  max-height: 264px;
  overflow-y: auto;
  margin: 0;
  padding: 6px;
  list-style: none;
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.35);
  outline: none;
}
.au-select.open--up .au-select-list {
  top: auto;
  bottom: calc(100% + 6px);
}

/* Option text lines up with the text in the closed field: the field pads
   14px, so 6px panel inset + 8px row padding. With a leading icon the field
   text starts after the icon (14 + 18 + 10 = 42px), so rows indent to match. */
.au-select-option {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 38px;
  padding: 8px 34px 8px 8px;
  border-radius: 8px;
  font-size: 14.5px;
  line-height: 1.4;
  color: var(--au-text);
  cursor: pointer;
  user-select: none;
}
.au-select.has-icon .au-select-option { padding-left: 36px; }
.au-select-option + .au-select-option { margin-top: 2px; }
.au-select-option.active { background: #F1F5F9; }
.au-select-option.selected .au-select-label { font-weight: 700; color: var(--au-accent-text); }
.au-select-check {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--au-accent-text);
}

/* Open / close: a short fade and drop, from the side it opens on. */
.au-pop-enter-active,
.au-pop-leave-active { transition: opacity 140ms ease, transform 160ms var(--au-ease); }
.au-pop-enter-from,
.au-pop-leave-to { opacity: 0; transform: translateY(-4px); }
.au-select.open--up .au-pop-enter-from,
.au-select.open--up .au-pop-leave-to { transform: translateY(4px); }

@media (prefers-reduced-motion: reduce) {
  .au-select-chevron,
  .au-pop-enter-active,
  .au-pop-leave-active { transition: none; }
}
</style>
