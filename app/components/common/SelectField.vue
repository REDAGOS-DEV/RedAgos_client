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
      :id="id"
      ref="trigger"
      type="button"
      class="sf-trigger"
      :class="{ 'sf-trigger--invalid': invalid }"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-describedby="describedby"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <AssetIcon v-if="icon" :name="icon" :size="16" class="sf-icon" />
      <span class="sf-value" :class="{ 'is-placeholder': !selected }">
        {{ selected ? selected.label : placeholder }}
      </span>
      <AssetIcon name="chevron-down" :size="16" class="sf-chevron" />
    </button>

    <Transition name="sf-pop">
      <ul
        v-if="open"
        :id="listId"
        ref="list"
        class="sf-list"
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
          class="sf-option"
          :class="{ 'sf-option--active': i === activeIndex, 'sf-option--selected': option.value === modelValue }"
          :aria-selected="option.value === modelValue"
          @mousemove="activeIndex = i"
          @mousedown.prevent
          @click="choose(i)"
        >
          <span class="sf-label">{{ option.label }}</span>
          <AssetIcon v-if="option.value === modelValue" name="check" :size="15" class="sf-check" />
        </li>
      </ul>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import AssetIcon from '~/components/common/AssetIcon.vue'

export interface SelectFieldOption {
  value: string
  label: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: SelectFieldOption[]
  /** Id of the trigger button, so a <label for="…"> points at it. */
  id: string
  placeholder?: string
  icon?: string
  invalid?: boolean
  disabled?: boolean
  describedby?: string
  /** sm 36px · md 42px (forms, the default). Matches DatePicker. */
  size?: 'sm' | 'md'
}>(), {
  placeholder: 'Select',
  icon: undefined,
  invalid: false,
  disabled: false,
  describedby: undefined,
  size: 'md',
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
  if (open.value || props.disabled) return
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

/* The list: the system's dropdown (ComboInput / AuthSelect) */
.sf-list {
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
  background: var(--sf-list);
  border: 1px solid var(--sf-list-border);
  border-radius: 12px;
  box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.35);
  outline: none;
}
.sf--up .sf-list { top: auto; bottom: calc(100% + 6px); }

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
.sf--icon .sf-option { padding-left: 32px; }
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
.sf--up .sf-pop-enter-from,
.sf--up .sf-pop-leave-to { transform: translateY(4px); }

@media (prefers-reduced-motion: reduce) {
  .sf-trigger,
  .sf-chevron,
  .sf-pop-enter-active,
  .sf-pop-leave-active { transition: none; }
}

/* Dark mode. The names are unique (sf-), so the global hook is safe. */
:global(.dark .sf) {
  --sf-field: #0F172A;
  --sf-border: #334155;
  --sf-text: #F1F5F9;
  --sf-muted: #94A3B8;
  --sf-list: #1E293B;
  --sf-list-border: #334155;
  --sf-hover: #263449;
}
</style>
