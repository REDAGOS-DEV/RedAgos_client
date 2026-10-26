<template>
  <div class="picker-overlay" @click.self="emitClose">
    <div ref="dialogRef" class="picker" role="dialog" aria-modal="true" aria-labelledby="picker-title" tabindex="-1" @keydown.esc.stop="emitClose">
      <div class="picker__header">
        <div>
          <h2 id="picker-title" class="picker__title">
            <AssetIcon name="package-check" :size="17" />
            Reserve units — <span class="mono">{{ request.code }}</span>
          </h2>
          <p class="picker__sub">
            {{ request.hospital }}<template v-if="request.patient"> · {{ request.patient }}</template>.
            Pick the bags to hold for this request; nothing else is reserved.
          </p>
        </div>
        <button type="button" class="picker__close" aria-label="Close" :disabled="busy" @click="emitClose">
          <AssetIcon name="x" :size="18" />
        </button>
      </div>

      <div class="picker__body">
        <div v-if="loading" class="picker__loading">
          <span v-for="n in 3" :key="n" class="skeleton" />
        </div>

        <div v-else-if="loadError" class="notice notice--error" role="alert">
          <AssetIcon name="circle-alert" :size="15" />
          <span>{{ loadError }}</span>
          <button type="button" class="link-btn" @click="load">Retry</button>
        </div>

        <template v-else>
          <section v-for="line in lines" :key="line.request_item_id" class="line">
            <header class="line__head">
              <div>
                <h3 class="line__title">
                  {{ line.component.name }}
                  <span class="code-chip">{{ line.component.code }}</span>
                  <span class="blood">{{ line.blood_type.code || '—' }}</span>
                </h3>
                <p class="line__meta">
                  <template v-if="line.allocatable > 0">
                    Pick up to {{ line.allocatable }} · <strong>{{ pickedCount(line) }}</strong> picked
                  </template>
                  <template v-else>Nothing more is needed for this component.</template>
                </p>
              </div>
              <button
                v-if="line.allocatable > 0 && line.units.length"
                type="button"
                class="btn btn--sm"
                :disabled="busy"
                @click="selectOldest(line)"
              >
                <AssetIcon name="clock" :size="13" />
                Select oldest first
              </button>
            </header>

            <!-- Type or scan the bag in hand. Typing narrows the list; Enter
                 (which a scanner sends after the code) ticks the match. -->
            <div v-if="line.allocatable > 0 && line.units.length" class="scan">
              <label class="scan__field">
                <AssetIcon name="scan-line" :size="15" class="scan__icon" />
                <span class="sr-only">Find a {{ line.component.name }} bag by number</span>
                <input
                  :ref="(el) => setScanRef(line.request_item_id, el)"
                  v-model="query[line.request_item_id]"
                  type="text"
                  class="scan__input"
                  :placeholder="`Type or scan a bag number, e.g. ${line.units[0].id}`"
                  autocomplete="off"
                  spellcheck="false"
                  :disabled="busy"
                  @keydown.enter.prevent="pickByNumber(line)"
                >
              </label>
              <p
                v-if="scanNote[line.request_item_id]"
                class="scan__note"
                :class="`scan__note--${scanNote[line.request_item_id].tone}`"
                role="status"
              >
                <AssetIcon :name="scanNote[line.request_item_id].tone === 'ok' ? 'check-circle' : 'circle-alert'" :size="13" />
                {{ scanNote[line.request_item_id].text }}
              </p>
            </div>

            <p v-if="line.allocatable > 0 && !line.units.length" class="notice">
              <AssetIcon name="package-search" :size="14" />
              <span>
                No issuable {{ line.blood_type.code }} {{ line.component.name }} on the shelf. If it cannot be supplied,
                close it as unavailable from the review so the hospital can ask elsewhere.
              </span>
            </p>

            <div v-else-if="line.allocatable > 0" class="table-box">
              <table class="units">
                <caption class="sr-only">{{ line.component.name }} {{ line.blood_type.code }} units, first-expiring first</caption>
                <thead>
                  <tr>
                    <th scope="col" class="c-pick"><span class="sr-only">Pick</span></th>
                    <th scope="col">Unit</th>
                    <th scope="col">Expires</th>
                    <th scope="col">Location</th>
                    <th scope="col" class="num">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="unit in visibleUnits(line)"
                    :key="unit.id"
                    class="unit"
                    :class="{ 'unit--on': isPicked(line, unit), 'unit--error': unitErrors[unit.id] }"
                  >
                    <td class="c-pick">
                      <input
                        :id="`pick-${unit.id}`"
                        type="checkbox"
                        :checked="isPicked(line, unit)"
                        :disabled="busy || (!isPicked(line, unit) && pickedCount(line) >= line.allocatable)"
                        @change="toggle(line, unit)"
                      >
                    </td>
                    <td>
                      <label :for="`pick-${unit.id}`" class="mono unit__id">{{ unit.id }}</label>
                      <span v-if="unitErrors[unit.id]" class="unit__error" role="alert">{{ unitErrors[unit.id] }}</span>
                    </td>
                    <td class="nowrap">
                      <span class="expiry" :class="{ 'expiry--soon': unit.days_remaining !== null && unit.days_remaining <= 3 }">
                        <span class="expiry__dot" aria-hidden="true" />
                        {{ formatDate(unit.expiry_date) }}
                      </span>
                      <span class="sub">{{ daysLabel(unit.days_remaining) }}</span>
                    </td>
                    <td>{{ unit.storage_location || '—' }}</td>
                    <td class="num">{{ unit.volume_ml ? `${unit.volume_ml} mL` : '—' }}</td>
                  </tr>
                  <tr v-if="searchTerm(line) && !visibleUnits(line).length">
                    <td colspan="5" class="units__empty">
                      No {{ line.blood_type.code }} {{ line.component.name }} bag here matches "{{ query[line.request_item_id].trim() }}".
                    </td>
                  </tr>
                </tbody>
              </table>
              <button
                v-if="!searchTerm(line) && line.units.length > PREVIEW && !expanded[line.request_item_id]"
                type="button"
                class="more-btn"
                @click="expanded = { ...expanded, [line.request_item_id]: true }"
              >
                Show all {{ line.units.length }} units
                <AssetIcon name="chevron-down" :size="13" />
              </button>
            </div>
          </section>

          <p v-if="!lines.some((l) => l.allocatable > 0)" class="notice">
            <AssetIcon name="check-circle" :size="14" />
            <span>Every unit this request still needs here is already reserved.</span>
          </p>
        </template>

        <div v-if="error" class="notice notice--error" role="alert">
          <AssetIcon name="circle-alert" :size="14" />
          <div>
            <p class="notice__text">{{ error }}</p>
            <ul v-if="orphanErrors.length" class="notice__list">
              <li v-for="item in orphanErrors" :key="item.id">{{ item.message }}</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="picker__footer">
        <span class="picker__count">{{ totalPicked }} unit{{ totalPicked === 1 ? '' : 's' }} picked</span>
        <button type="button" class="btn" :disabled="busy" @click="emitClose">Cancel</button>
        <button type="button" class="btn btn--primary" :disabled="busy || !totalPicked" @click="confirm">
          {{ busy ? 'Reserving…' : totalPicked ? `Reserve ${totalPicked} unit${totalPicked === 1 ? '' : 's'}` : 'Reserve units' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Pick the bags to reserve for one request (project owner, 2026-10-19).
 *
 * The server lists, per line, the units it would accept — this centre's,
 * available, in date, held for nobody, of the line's own blood type and
 * component — first-expiring first. Staff tick up to what each line still
 * needs; "Select oldest first" ticks the top of the list for them to check,
 * and each line's box finds a bag by its typed or scanned number.
 * The page sends the ticks; the server holds exactly those or refuses the
 * whole pick, naming each unit it could not take (shown against its row).
 */

import { computed, nextTick, onMounted, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

const props = defineProps({
  /** The list's row for the request: id, code, hospital, patient. */
  request: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
  /** Unit id → why the server would not hold it. */
  unitErrors: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['close', 'confirm'])

// Focused on open, so Escape closes the picker and not the review behind it.
const dialogRef = ref(null)
const loading = ref(true)
const loadError = ref('')
const lines = ref([])
// request_item_id → Set of picked unit ids.
const picked = ref({})
// A line lists its first few units until asked for all, so a well-stocked
// component does not push the next one out of sight.
const PREVIEW = 8
const expanded = ref({})

const totalPicked = computed(() => Object.values(picked.value).reduce((sum, set) => sum + set.size, 0))

/** Refusals for units no longer listed (taken meanwhile), which have no row to sit on. */
const orphanErrors = computed(() => {
  const listed = new Set(lines.value.flatMap((line) => line.units.map((unit) => unit.id)))
  return Object.entries(props.unitErrors).filter(([id]) => !listed.has(id)).map(([id, message]) => ({ id, message }))
})

async function load() {
  loading.value = true
  loadError.value = ''

  try {
    const response = await bloodCenterService.requestUnits(props.request.id)
    lines.value = response?.lines ?? []
    // Keep any pick still on offer, so a refusal does not wipe the rest.
    picked.value = Object.fromEntries(lines.value.map((line) => {
      const offered = new Set(line.units.map((unit) => unit.id))
      const kept = [...(picked.value[line.request_item_id] ?? [])].filter((id) => offered.has(id)).slice(0, line.allocatable)

      return [line.request_item_id, new Set(kept)]
    }))
  } catch (err) {
    loadError.value = err?.message || 'The units could not be loaded.'
  } finally {
    loading.value = false
  }

  // Ready for a scanner: the first line that can take a bag.
  const first = lines.value.find((line) => line.allocatable > 0 && line.units.length)
  if (first) nextTick(() => scanRefs.get(first.request_item_id)?.focus())
}

/*
 * Find a bag by number (project owner, 2026-10-19): the box above each line.
 * Typing narrows that line's list; Enter, which a barcode scanner sends after
 * the code, ticks the bag. A bare donation sticker finds that donation's bag
 * of this line's component (24234242 in Packed RBC → 24234242-PRBC).
 */
// request_item_id → what is typed in the line's box.
const query = ref({})
// request_item_id → { tone: 'ok' | 'warn', text } after an Enter.
const scanNote = ref({})
const scanRefs = new Map()

function setScanRef(lineId, el) {
  if (el) scanRefs.set(lineId, el)
  else scanRefs.delete(lineId)
}

function searchTerm(line) {
  return (query.value[line.request_item_id] ?? '').trim().toUpperCase()
}

function note(line, tone, text) {
  scanNote.value = { ...scanNote.value, [line.request_item_id]: { tone, text } }
}

/**
 * The units a typed or scanned number names in one line: the exact bag
 * number, or, for a bare donation sticker, that donation's bags of this
 * line's component (a second bag of the same component ends -2).
 */
function matchesIn(line, term) {
  const exact = line.units.filter((unit) => unit.id.toUpperCase() === term)
  if (exact.length) return exact

  const asSticker = `${term}-${(line.component.code ?? '').toUpperCase()}`
  return line.units.filter((unit) => {
    const id = unit.id.toUpperCase()
    return id === asSticker || id.startsWith(`${asSticker}-`)
  })
}

/** Tick the bag a typed or scanned number names, then clear the box for the next. */
function pickByNumber(line) {
  const term = searchTerm(line)
  if (!term) return

  const matches = matchesIn(line, term)

  if (!matches.length) {
    // A bag of another component on this request: tick it in its own section.
    for (const other of lines.value) {
      if (other === line || other.allocatable < 1) continue
      const found = matchesIn(other, term).find((unit) => !isPicked(other, unit))

      if (found) {
        if (pickedCount(other) >= other.allocatable) {
          note(line, 'warn', `${found.id} is ${other.component.name}, which already has ${other.allocatable} picked.`)
        } else {
          toggle(other, found)
          note(line, 'ok', `${found.id} is ${other.component.name}; picked there.`)
          clearAndFocus(line, found)
        }
        return
      }
    }

    note(line, 'warn', `${term} is not an issuable ${line.blood_type.code} ${line.component.name} bag. It may be reserved, expired, still in quarantine, or another blood type.`)
    return
  }

  const unit = matches.find((candidate) => !isPicked(line, candidate))

  if (!unit) {
    note(line, 'warn', `${matches[0].id} is already picked.`)
    return
  }

  if (pickedCount(line) >= line.allocatable) {
    note(line, 'warn', `${line.allocatable} ${line.component.name} already picked; untick one to pick ${unit.id}.`)
    return
  }

  toggle(line, unit)
  note(line, 'ok', `${unit.id} picked.`)
  clearAndFocus(line, unit)
}

/** Ready the box for the next scan, and bring the picked row into view. */
function clearAndFocus(line, unit) {
  query.value = { ...query.value, [line.request_item_id]: '' }

  nextTick(() => {
    document.getElementById(`pick-${unit.id}`)?.scrollIntoView({ block: 'nearest' })
    scanRefs.get(line.request_item_id)?.focus()
  })
}

/** While searching, the matches; otherwise the first few units, plus any picked further down, or all once expanded. */
function visibleUnits(line) {
  const term = searchTerm(line)
  if (term) return line.units.filter((unit) => unit.id.toUpperCase().includes(term))

  if (expanded.value[line.request_item_id] || line.units.length <= PREVIEW) return line.units

  return line.units.filter((unit, index) => index < PREVIEW || isPicked(line, unit))
}

function pickedCount(line) {
  return picked.value[line.request_item_id]?.size ?? 0
}

function isPicked(line, unit) {
  return picked.value[line.request_item_id]?.has(unit.id) ?? false
}

function toggle(line, unit) {
  const set = new Set(picked.value[line.request_item_id])

  if (set.has(unit.id)) set.delete(unit.id)
  else if (set.size < line.allocatable) set.add(unit.id)

  picked.value = { ...picked.value, [line.request_item_id]: set }
}

/** Tick the first-expiring units, up to what the line still needs. */
function selectOldest(line) {
  const set = new Set(line.units.slice(0, line.allocatable).map((unit) => unit.id))
  picked.value = { ...picked.value, [line.request_item_id]: set }
}

function confirm() {
  if (!totalPicked.value || props.busy) return
  emit('confirm', Object.values(picked.value).flatMap((set) => [...set]))
}

function emitClose() {
  if (props.busy) return
  emit('close')
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysLabel(days) {
  if (days === null || days === undefined) return ''
  if (days === 0) return 'expires today'
  return `in ${days} day${days === 1 ? '' : 's'}`
}

/** Reload after a refusal, so units taken meanwhile drop off the list. */
defineExpose({ reload: load })

onMounted(() => {
  nextTick(() => dialogRef.value?.focus())
  load()
})
</script>

<style scoped>
.picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--rb-overlay);
}

.picker {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 760px;
  max-height: calc(100vh - 40px);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(var(--rb-shadow-rgb), 0.28);
  color: var(--rb-text-primary);
  font-family: var(--rb-font-sans);
}

.picker:focus { outline: none; }

.picker__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--rb-border);
}

.picker__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15.5px; font-weight: 700; }
.picker__title :deep(.asset-icon) { color: var(--rb-text-secondary); }
.picker__sub { margin: 4px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }

.picker__close {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: none;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.picker__close:hover:not(:disabled) { color: var(--rb-text-primary); background: var(--rb-surface-hover); }

.picker__body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px 20px;
  overflow-y: auto;
  min-height: 0;
}

.picker__footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--rb-border);
}

.picker__count { margin-right: auto; font-size: 12.5px; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }

.picker__loading { display: flex; flex-direction: column; gap: 10px; }

.skeleton {
  display: block;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.line { display: flex; flex-direction: column; gap: 8px; }
.line__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.line__title { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 0; font-size: 13.5px; font-weight: 700; }
.line__meta { margin: 3px 0 0; font-size: 12px; color: var(--rb-text-secondary); }
.line__meta strong { color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

/* Find a bag by number: typed, or scanned with a barcode scanner. */
.scan { display: flex; flex-direction: column; gap: 5px; }
.scan__field { position: relative; display: block; }
.scan__icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--rb-text-secondary); pointer-events: none; }

.scan__input {
  width: 100%;
  height: 36px;
  padding: 0 12px 0 34px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font-family: var(--rb-font-mono);
  font-size: 12.5px;
}

.scan__input::placeholder { font-family: var(--rb-font-sans); color: var(--rb-placeholder); }
.scan__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.scan__note { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12px; }
.scan__note--ok { color: var(--rb-success-text); }
.scan__note--warn { color: var(--rb-warning-text); }
.scan__note :deep(.asset-icon) { flex-shrink: 0; }

.units__empty { padding: 14px 10px !important; text-align: center; color: var(--rb-text-secondary); }

.code-chip {
  padding: 1px 6px;
  border-radius: 6px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  font-family: var(--rb-font-mono);
  font-size: 11px;
  font-weight: 600;
}

.blood {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface-alt);
  font-size: 11px;
  font-weight: 700;
}

.table-box { position: relative; overflow-x: auto; border: 1px solid var(--rb-border); border-radius: 10px; }
.units { width: 100%; border-collapse: collapse; font-size: 12.5px; }

.units th {
  padding: 8px 10px;
  background: var(--rb-surface-alt);
  border-bottom: 1px solid var(--rb-border);
  text-align: left;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rb-text-secondary);
  white-space: nowrap;
}

.units td { padding: 9px 10px; border-bottom: 1px solid var(--rb-border); vertical-align: middle; }
.units tr:last-child td { border-bottom: 0; }
.units .num { text-align: right; font-variant-numeric: tabular-nums; }
.c-pick { width: 36px; }
.c-pick input { width: 16px; height: 16px; cursor: pointer; accent-color: var(--rb-primary); }
.c-pick input:disabled { cursor: not-allowed; }

.unit { transition: background 0.12s ease; }
.unit--on { background: rgba(var(--rb-primary-rgb), 0.06); }
.unit--error td:first-child { box-shadow: inset 3px 0 0 var(--rb-accent); }
.unit__id { font-weight: 600; cursor: pointer; }
.unit__error { display: block; margin-top: 2px; font-size: 11.5px; color: var(--rb-accent-text); }

.expiry { display: inline-flex; align-items: center; gap: 6px; }
.expiry__dot { width: 6px; height: 6px; border-radius: 999px; background: var(--rb-text-muted); }
.expiry--soon .expiry__dot { background: var(--rb-warning); }
.sub { display: block; margin-top: 1px; font-size: 11.5px; color: var(--rb-text-secondary); }
.mono { font-family: var(--rb-font-mono); }
.nowrap { white-space: nowrap; }

.notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface-alt);
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.notice :deep(.asset-icon) { flex-shrink: 0; margin-top: 2px; }
.notice--error { border-color: rgba(var(--rb-accent-rgb), 0.35); color: var(--rb-text-primary); }
.notice__text { margin: 0; }
.notice__list { margin: 4px 0 0; padding-left: 18px; }
.notice--error :deep(.asset-icon) { color: var(--rb-accent-text); }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.btn:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn--sm { height: 30px; padding: 0 10px; font-size: 12px; border-radius: 8px; gap: 5px; }
.btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); border-color: var(--rb-primary); }

.more-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-top: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  color: var(--rb-primary-text);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.more-btn:hover { background: var(--rb-surface-hover); }
.more-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.link-btn { margin-left: auto; padding: 0; border: 0; background: none; color: var(--rb-primary-text); font: inherit; font-weight: 600; cursor: pointer; }

.btn:focus-visible,
.picker__close:focus-visible,
.link-btn:focus-visible,
.c-pick input:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 640px) {
  .picker-overlay { padding: 10px; align-items: flex-end; }
  .picker { max-height: calc(100vh - 20px); }
  .line__head { flex-direction: column; align-items: flex-start; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}
</style>
