<template>
  <section class="grid-card">
    <div class="grid-scroll" tabindex="0" role="region" aria-label="Stock against minimum, by blood type and component">
      <table class="grid">
        <caption class="sr-only">
          Issuable units now, against the minimum set for each blood type and component.
        </caption>
        <thead>
          <tr>
            <th scope="col" class="grid__corner">Blood type</th>
            <th v-for="component in status.components" :key="component.id" scope="col" class="grid__component">
              {{ component.name }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in matrix" :key="row.type.id">
            <th scope="row" class="grid__type">{{ row.type.code }}</th>
            <td
              v-for="item in row.items"
              :key="item.component.id"
              class="cell"
              :class="`cell--${item.cell.status}`"
            >
              <div class="cell__stock">
                <span class="cell__available">{{ item.cell.available }}</span>
                <span v-if="item.cell.status !== 'unmonitored'" class="cell__badge" :title="shortTitle(item.cell)">
                  <AssetIcon :name="item.cell.status === 'ok' ? 'check' : 'triangle-alert'" :size="11" />
                  {{ stockStatusLabel(item.cell.status) }}
                </span>
              </div>

              <!-- Editing: the minimum, and whether to be notified about it. -->
              <div v-if="editable && item.draft" class="cell__edit">
                <label class="min-input" :class="{ 'min-input--invalid': !isValidMinimum(item.draft) }">
                  <span class="sr-only">{{ row.type.code }} {{ item.component.name }} minimum units</span>
                  <input
                    v-model="item.draft.minimum"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    max="9999"
                    step="1"
                    placeholder="Min"
                    :aria-invalid="!isValidMinimum(item.draft)"
                    :disabled="saving"
                  >
                </label>
                <button
                  type="button"
                  class="bell"
                  :class="{ 'bell--muted': !item.draft.alerts_enabled }"
                  :aria-pressed="item.draft.alerts_enabled"
                  :aria-label="`${row.type.code} ${item.component.name}: notifications ${item.draft.alerts_enabled ? 'on' : 'off'}`"
                  :title="item.draft.alerts_enabled ? 'Notifications on. Click to mute.' : 'Notifications off. Click to turn on.'"
                  :disabled="saving || minimumOf(item.draft) === null"
                  @click="item.draft.alerts_enabled = !item.draft.alerts_enabled"
                >
                  <AssetIcon name="bell" :size="14" />
                </button>
              </div>

              <!-- Reading: the saved minimum, and whether it is muted. -->
              <div v-else class="cell__min">
                <template v-if="item.cell.minimum_units !== null">
                  Min {{ item.cell.minimum_units }}
                  <span v-if="!item.cell.alerts_enabled" class="cell__muted" title="Notifications are off for this stock">
                    muted
                  </span>
                </template>
                <span v-else class="cell__none">No minimum</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer class="grid-foot">
      <ul class="legend" aria-label="Legend">
        <li class="legend__item"><span class="legend__swatch legend__swatch--ok" />Healthy</li>
        <li class="legend__item"><span class="legend__swatch legend__swatch--low" />Below minimum</li>
        <li class="legend__item"><span class="legend__swatch legend__swatch--critical" />Out of stock</li>
        <li class="legend__item"><span class="legend__swatch legend__swatch--unmonitored" />No minimum set</li>
      </ul>

      <div v-if="editable" class="actions">
        <span v-if="changes.length" class="unsaved">
          {{ changes.length }} unsaved {{ changes.length === 1 ? 'change' : 'changes' }}
        </span>
        <span v-if="invalidCount" class="problem" role="status">
          {{ invalidCount }} {{ invalidCount === 1 ? 'minimum needs' : 'minimums need' }} a whole number from 1 to 9999
        </span>
        <button type="button" class="btn btn--ghost" :disabled="saving || !changes.length" @click="discard">
          Discard
        </button>
        <button
          type="button"
          class="btn btn--primary"
          :disabled="saving || !changes.length || invalidCount > 0"
          @click="emit('save', { thresholds: changes })"
        >
          {{ saving ? 'Saving…' : 'Save thresholds' }}
        </button>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
/**
 * Every blood type against every component: the stock now, and the minimum.
 *
 * Read-only for staff who may only look; editable for those who set minimums.
 * Edits are held as drafts and sent together, changed cells only. The server
 * judges every status, so nothing here compares a count to a minimum.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import type {
  SaveStockThresholdsPayload,
  StockThresholdCell,
  StockThresholdDraft,
  StockThresholdStatus,
} from '~/types/stockThreshold'
import {
  cellKey,
  diffDrafts,
  draftFor,
  isValidMinimum,
  minimumOf,
  orderBloodTypes,
  stockStatusLabel,
} from '~/utils/stockThreshold'

const props = withDefaults(defineProps<{
  status: StockThresholdStatus
  editable?: boolean
  saving?: boolean
}>(), {
  editable: false,
  saving: false,
})

const emit = defineEmits<{
  save: [payload: SaveStockThresholdsPayload]
  dirty: [value: boolean]
}>()

const drafts = reactive<Record<string, StockThresholdDraft>>({})

const byKey = computed(() => new Map(
  props.status.cells.map((cell) => [cellKey(cell.blood_type_id, cell.component_id), cell] as const),
))

/** One row per blood type, one item per component, each holding its cell and its draft. */
const matrix = computed(() =>
  orderBloodTypes(props.status.blood_types).map((type) => ({
    type,
    items: props.status.components.flatMap((component) => {
      const key = cellKey(type.id, component.id)
      const cell = byKey.value.get(key)

      return cell ? [{ component, cell, draft: drafts[key] }] : []
    }),
  })),
)

const changes = computed(() => diffDrafts(props.status.cells, drafts))

const invalidCount = computed(() =>
  Object.values(drafts).filter((draft) => !isValidMinimum(draft)).length,
)

function shortTitle(cell: StockThresholdCell): string {
  return cell.shortfall > 0 ? `Short by ${cell.shortfall} unit${cell.shortfall === 1 ? '' : 's'}` : stockStatusLabel(cell.status)
}

/**
 * Start every draft from what is saved.
 *
 * With `keepEdits`, a cell the user has already changed keeps its draft, so a
 * refresh that lands mid-edit does not wipe their typing.
 */
function seed(keepEdits: boolean): void {
  const dirty = new Set(keepEdits ? changes.value.map((c) => cellKey(c.blood_type_id, c.component_id)) : [])

  for (const cell of props.status.cells) {
    const key = cellKey(cell.blood_type_id, cell.component_id)

    if (!dirty.has(key)) drafts[key] = draftFor(cell)
  }
}

function discard(): void {
  seed(false)
}

watch(() => props.status.cells, () => seed(true), { immediate: true })
watch(() => changes.value.length > 0, (dirty) => emit('dirty', dirty), { immediate: true })
</script>

<style scoped>
.grid-card {
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
}

.grid-scroll { overflow-x: auto; }
.grid-scroll:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }

.grid { width: 100%; min-width: max-content; border-collapse: separate; border-spacing: 0; font-size: 13px; }

.grid th {
  padding: 10px 14px;
  background: var(--rb-surface-alt);
  border-bottom: 1px solid var(--rb-border);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
  text-align: left;
  white-space: nowrap;
}
.grid__component { text-align: center !important; min-width: 150px; }
.grid__corner,
.grid__type {
  position: sticky;
  left: 0;
  z-index: 1;
  border-right: 1px solid var(--rb-border);
}
.grid__type {
  background: var(--rb-surface) !important;
  font-size: 15px !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
  color: var(--rb-text-primary) !important;
}

.cell {
  padding: 10px 12px;
  border-bottom: 1px solid var(--rb-border);
  text-align: center;
  vertical-align: middle;
}
tbody tr:last-child .cell,
tbody tr:last-child .grid__type { border-bottom: 0; }

/* A shortage is tinted; the badge, icon and number say the same in words, so
   the state never rests on colour alone. */
.cell--low { background: rgba(var(--rb-warning-rgb), 0.08); }
.cell--critical { background: rgba(var(--rb-accent-rgb), 0.08); }

.cell__stock { display: flex; align-items: center; justify-content: center; gap: 8px; }
.cell__available { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.cell--critical .cell__available { color: var(--rb-accent-text); }
.cell--low .cell__available { color: var(--rb-warning-text); }

.cell__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 700;
  white-space: nowrap;
}
.cell--ok .cell__badge { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.cell--low .cell__badge { background: rgba(var(--rb-warning-rgb), 0.16); color: var(--rb-warning-text); }
.cell--critical .cell__badge { background: rgba(var(--rb-accent-rgb), 0.14); color: var(--rb-accent-text); }

.cell__min { margin-top: 4px; font-size: 12px; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.cell__none { color: var(--rb-text-muted, var(--rb-text-secondary)); }
.cell__muted {
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  font-size: 10.5px;
  font-weight: 700;
}

/* editing */
.cell__edit { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 6px; }

.min-input {
  display: inline-flex;
  width: 76px;
  height: 32px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.min-input:focus-within { border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.min-input--invalid { border-color: var(--rb-accent); }
.min-input input {
  width: 100%;
  min-width: 0;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.min-input input:focus { outline: none; }
.min-input input::placeholder { color: var(--rb-placeholder); }

.bell {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: rgba(var(--rb-primary-rgb), 0.08);
  color: var(--rb-primary-text);
  cursor: pointer;
  position: relative;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.bell:hover:not(:disabled) { border-color: var(--rb-border-hover); }
.bell:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.bell:disabled { opacity: 0.4; cursor: not-allowed; }
/* A slash through the bell says "off" without relying on colour alone. */
.bell--muted { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.bell--muted::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 2px;
  border-radius: 2px;
  background: currentColor;
  transform: rotate(-45deg);
}

/* footer */
.grid-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  flex-wrap: wrap;
  padding: 12px 16px;
  border-top: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
}

.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0; padding: 0; list-style: none; }
.legend__item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--rb-text-secondary); }
.legend__swatch { width: 10px; height: 10px; border-radius: 3px; background: var(--rb-border-strong); }
.legend__swatch--ok { background: var(--rb-success); }
.legend__swatch--low { background: var(--rb-warning); }
.legend__swatch--critical { background: var(--rb-accent); }

.actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.unsaved { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--rb-primary-text); }
.unsaved::before { content: ''; width: 6px; height: 6px; border-radius: 999px; background: currentColor; }
.problem { font-size: 12px; font-weight: 600; color: var(--rb-accent-text); }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 16px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.btn--ghost { border-color: transparent; background: transparent; color: var(--rb-text-secondary); }
.btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) { background: #0D47A1; border-color: #0D47A1; }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (prefers-reduced-motion: reduce) {
  .min-input, .bell, .btn { transition: none; }
}
</style>
