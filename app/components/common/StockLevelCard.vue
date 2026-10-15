<template>
  <section class="st-card" :class="`st-card--${level}`" :aria-labelledby="headingId">
    <header class="st-card__head">
      <span class="st-card__icon" aria-hidden="true">
        <AssetIcon :name="level === 'par' ? 'list' : 'triangle-alert'" :size="20" />
      </span>

      <div class="st-card__titles">
        <h2 :id="headingId" class="st-card__title">{{ title }}</h2>
        <p class="st-card__desc">{{ description }}</p>
      </div>

      <div v-if="editable" class="st-card__actions">
        <span v-if="changeCount" class="st-card__unsaved">
          {{ changeCount }} unsaved {{ changeCount === 1 ? 'change' : 'changes' }}
        </span>
        <button
          v-if="changeCount"
          type="button"
          class="st-btn st-btn--ghost"
          :disabled="locked"
          @click="emit('discard')"
        >
          Discard
        </button>
        <button
          type="button"
          class="st-btn st-btn--solid"
          :disabled="locked || !changeCount || problems.length > 0"
          :aria-describedby="problems.length ? problemsId : undefined"
          @click="emit('save')"
        >
          <AssetIcon :name="saving ? 'loader' : 'check'" :size="15" :class="{ 'st-spin': saving }" />
          {{ saving ? 'Saving…' : 'Save Changes' }}
        </button>
      </div>
    </header>

    <!-- Saved, or why it was not. -->
    <p
      v-if="feedback"
      class="st-note"
      :class="`st-note--${feedback.kind}`"
      :role="feedback.kind === 'error' ? 'alert' : 'status'"
    >
      <AssetIcon :name="feedback.kind === 'success' ? 'circle-check-big' : 'circle-alert'" :size="15" />
      <span>{{ feedback.text }}</span>
    </p>

    <!-- What stops a save, said in words beside the red outlines. -->
    <div v-if="editable && problems.length" :id="problemsId" class="st-note st-note--error" role="status">
      <AssetIcon name="circle-alert" :size="15" />
      <div>
        <p class="st-note__lead">Fix {{ problems.length === 1 ? 'this' : 'these' }} before saving:</p>
        <ul class="st-note__list">
          <li v-for="problem in shownProblems" :key="problem.key">{{ problem.message }}</li>
          <li v-if="moreProblems > 0">and {{ moreProblems }} more.</li>
        </ul>
      </div>
    </div>

    <div class="st-scroll" tabindex="0" role="region" :aria-label="`${title} by blood type and component`">
      <table class="st-table" :style="{ minWidth: `${tableMinWidth}px` }">
        <caption class="st-sr">{{ title }} in units, for each blood type and component.</caption>
        <colgroup>
          <col class="st-table__type-col">
          <col v-for="component in components" :key="component.id">
        </colgroup>
        <thead>
          <tr>
            <th scope="col" class="st-table__corner">Blood Type</th>
            <th v-for="component in components" :key="component.id" scope="col" class="st-table__component">
              <span class="st-table__name">{{ component.name }}</span>
              <span class="st-table__unit">(units)</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.type.id">
            <th scope="row" class="st-table__type">{{ row.type.code }}</th>
            <td v-for="item in row.items" :key="item.key" class="st-table__cell">
              <div
                v-if="editable"
                class="st-field"
                :class="{ 'st-field--invalid': flagged.has(item.key), 'st-field--bell': level === 'critical' }"
              >
                <input
                  :value="valueOf(item.draft)"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max="9999"
                  step="1"
                  placeholder="—"
                  :aria-label="`${row.type.code} ${item.component.name} ${title}, units`"
                  :aria-invalid="flagged.has(item.key)"
                  :disabled="locked"
                  @input="emit('input', item.key, ($event.target as HTMLInputElement).value)"
                >
                <button
                  v-if="level === 'critical'"
                  type="button"
                  class="st-bell"
                  :class="{ 'st-bell--muted': !item.draft.alerts_enabled }"
                  :aria-pressed="item.draft.alerts_enabled"
                  :aria-label="`${row.type.code} ${item.component.name}: notifications ${item.draft.alerts_enabled ? 'on' : 'off'}`"
                  :title="item.draft.alerts_enabled ? 'Notifications on. Click to mute.' : 'Notifications off. Click to turn on.'"
                  :disabled="locked || minimumOf(item.draft) === null"
                  @click="emit('toggle-alerts', item.key)"
                >
                  <AssetIcon name="bell" :size="13" />
                </button>
              </div>

              <span v-else class="st-value">
                <template v-if="savedOf(item.cell) !== null">{{ savedOf(item.cell) }}</template>
                <template v-else><span aria-hidden="true">—</span><span class="st-sr">Not set</span></template>
                <span
                  v-if="level === 'critical' && item.cell.minimum_units !== null && !item.cell.alerts_enabled"
                  class="st-value__muted"
                  title="Notifications are off for this stock"
                >muted</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * One of the two level tables on the Stock Thresholds page: PAR or critical.
 *
 * Every blood type against every component, one number per cell. The table
 * only draws and reports what is typed; the panel holds the drafts, judges
 * them and saves. The critical table also carries each stock's notification
 * toggle, since notifications follow the critical level.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import type {
  StockLevelRow,
  StockThresholdCell,
  StockThresholdDraft,
  ThresholdLevel,
  ThresholdProblem,
} from '~/types/stockThreshold'
import { minimumOf } from '~/utils/stockThreshold'

const props = withDefaults(defineProps<{
  level: ThresholdLevel
  rows: StockLevelRow[]
  components: Array<{ id: number; name: string; code: string }>
  editable?: boolean
  /** This table's save is in flight. */
  saving?: boolean
  /** Any save is in flight, so nothing may change underneath it. */
  locked?: boolean
  changeCount?: number
  problems?: ThresholdProblem[]
  /** Cells to outline in red: this table's problems and any pair in conflict. */
  flagged?: Set<string>
  feedback?: { kind: 'success' | 'error'; text: string } | null
}>(), {
  editable: false,
  saving: false,
  locked: false,
  changeCount: 0,
  problems: () => [],
  flagged: () => new Set<string>(),
  feedback: null,
})

const emit = defineEmits<{
  'input': [key: string, value: string]
  'toggle-alerts': [key: string]
  'save': []
  'discard': []
}>()

const SHOWN_PROBLEMS = 3

const headingId = `st-${props.level}-heading`
const problemsId = `st-${props.level}-problems`

const title = computed(() => (props.level === 'par' ? 'PAR Level' : 'Critical Level'))

const description = computed(() => {
  if (props.level === 'par') {
    return props.editable
      ? 'Set the desired stock level for each blood type and component.'
      : 'The desired stock level for each blood type and component.'
  }

  return props.editable
    ? 'Set the minimum stock level before the system sends a low-stock alert. The bell mutes alerts for one stock.'
    : 'The minimum stock level before the system sends a low-stock alert.'
})

/** Wide enough to keep every input usable; narrower screens scroll the table, not the page. */
const tableMinWidth = computed(() => 96 + props.components.length * (props.level === 'critical' && props.editable ? 124 : 112))

const shownProblems = computed(() => props.problems.slice(0, SHOWN_PROBLEMS))
const moreProblems = computed(() => Math.max(0, props.problems.length - SHOWN_PROBLEMS))

function valueOf(draft: StockThresholdDraft): string | number {
  return props.level === 'par' ? draft.par : draft.minimum
}

function savedOf(cell: StockThresholdCell): number | null {
  return props.level === 'par' ? cell.par_units : cell.minimum_units
}
</script>

<style scoped>
.st-card {
  --st-level: var(--rb-primary);
  --st-level-rgb: var(--rb-primary-rgb);
  --st-level-text: var(--rb-primary-text);
  --st-level-hover: #0D47A1;
  --st-input-border: #CBD5E1;

  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px 20px;
  border: 1px solid var(--rb-border-strong);
  border-radius: var(--rb-radius-md);
  background: var(--rb-surface);
  box-shadow: var(--rb-shadow-sm);
  min-width: 0;
}
.st-card--critical {
  --st-level: var(--rb-accent);
  --st-level-rgb: var(--rb-accent-rgb);
  --st-level-text: var(--rb-accent-text);
  --st-level-hover: #B71C1C;
}
:global(.dark .st-card) { --st-input-border: #475569; }

/* header */
.st-card__head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.st-card__icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: var(--st-level);
  color: #fff;
}
.st-card__titles { flex: 1 1 260px; min-width: 0; }
.st-card__title { margin: 0; font-size: var(--rb-text-lg); font-weight: 700; letter-spacing: -0.01em; line-height: 1.25; color: var(--rb-text-primary); }
.st-card--critical .st-card__title { color: var(--st-level-text); }
.st-card__desc { margin: 2px 0 0; font-size: var(--rb-text-sm); line-height: 1.5; color: var(--rb-text-secondary); }

.st-card__actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-left: auto; }
.st-card__unsaved { display: inline-flex; align-items: center; gap: 6px; font-size: var(--rb-text-xs); font-weight: 700; color: var(--st-level-text); }
.st-card__unsaved::before { content: ''; width: 6px; height: 6px; border-radius: 999px; background: currentColor; }

/* buttons */
.st-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 38px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 8px;
  font: inherit;
  font-size: var(--rb-text-sm);
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.st-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.st-btn:focus-visible { outline: 2px solid var(--st-level-text); outline-offset: 2px; }
.st-btn--solid { background: var(--st-level); color: #fff; }
.st-btn--solid:hover:not(:disabled) { background: var(--st-level-hover); }
.st-btn--ghost { background: transparent; color: var(--rb-text-secondary); }
.st-btn--ghost:hover:not(:disabled) { background: var(--rb-surface-hover); color: var(--rb-text-primary); }

/* notes */
.st-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: var(--rb-text-sm);
  line-height: 1.5;
}
.st-note :deep(.asset-icon) { flex-shrink: 0; margin-top: 2px; }
.st-note--success { border: 1px solid rgba(var(--rb-success-rgb), 0.25); background: rgba(var(--rb-success-rgb), 0.08); color: var(--rb-success-text); }
.st-note--error { border: 1px solid rgba(var(--rb-accent-rgb), 0.25); background: rgba(var(--rb-accent-rgb), 0.07); color: var(--rb-accent-text); }
.st-note__lead { margin: 0; font-weight: 700; }
.st-note__list { margin: 2px 0 0; padding-left: 18px; }

/* table */
.st-scroll {
  overflow-x: auto;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
}
.st-scroll:focus-visible { outline: 2px solid var(--st-level-text); outline-offset: 2px; }

.st-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--rb-text-sm);
}
.st-table__type-col { width: 132px; }

.st-table th,
.st-table td { border-bottom: 1px solid var(--rb-border); }
.st-table tbody tr:last-child th,
.st-table tbody tr:last-child td { border-bottom: 0; }

.st-table thead th {
  padding: 10px 4px;
  background: var(--rb-surface-alt);
  border-bottom-color: var(--rb-border-strong);
  vertical-align: middle;
}
.st-table__corner {
  padding-left: 16px !important;
  text-align: left;
  font-size: var(--rb-text-sm);
  font-weight: 700;
  color: var(--rb-text-primary);
}
.st-table__component { text-align: center; }
.st-table__name { display: block; font-size: var(--rb-text-xs); font-weight: 700; line-height: 1.3; color: var(--rb-text-primary); }
.st-table__unit { display: block; margin-top: 1px; font-size: 11px; font-weight: 500; color: var(--rb-text-secondary); }

.st-table__type {
  padding: 4px 8px 4px 16px;
  text-align: left;
  font-size: var(--rb-text-sm);
  font-weight: 800;
  color: var(--rb-text-primary);
  white-space: nowrap;
}
/* The blood type stays in view while a narrow screen scrolls the levels. */
.st-table__corner,
.st-table__type {
  position: sticky;
  left: 0;
  z-index: 1;
}
.st-table__type { background: var(--rb-surface); }

.st-table__cell { padding: 4px 10px; text-align: center; vertical-align: middle; }

/* input */
.st-field {
  display: flex;
  align-items: stretch;
  width: 100%;
  max-width: 132px;
  height: 30px;
  margin: 0 auto;
  border: 1px solid var(--st-input-border);
  border-radius: 8px;
  background: var(--rb-surface);
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.st-field:hover { border-color: var(--rb-text-muted); }
.st-field:focus-within { border-color: var(--st-level); box-shadow: 0 0 0 3px rgba(var(--st-level-rgb), 0.16); }
.st-field--invalid,
.st-field--invalid:hover { border-color: var(--rb-accent); box-shadow: 0 0 0 3px rgba(var(--rb-accent-rgb), 0.12); }

.st-field input {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: var(--rb-text-primary);
  font: inherit;
  font-size: var(--rb-text-sm);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
  appearance: textfield;
  -moz-appearance: textfield;
}
.st-field input::-webkit-outer-spin-button,
.st-field input::-webkit-inner-spin-button { margin: 0; -webkit-appearance: none; }
.st-field input:focus { outline: none; }
.st-field input::placeholder { color: var(--rb-text-muted); font-weight: 500; }
.st-field input:disabled { color: var(--rb-text-secondary); cursor: not-allowed; }

/* notification toggle, a segment at the end of the critical input */
.st-bell {
  display: grid;
  place-items: center;
  flex: 0 0 30px;
  position: relative;
  border: 0;
  border-left: 1px solid var(--st-input-border);
  background: rgba(var(--st-level-rgb), 0.07);
  color: var(--st-level-text);
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.st-bell:hover:not(:disabled) { background: rgba(var(--st-level-rgb), 0.14); }
.st-bell:focus-visible { outline: 2px solid var(--st-level-text); outline-offset: -2px; }
.st-bell:disabled { opacity: 0.4; cursor: not-allowed; }
/* A slash through the bell says "off" without relying on colour alone. */
.st-bell--muted { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.st-bell--muted::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 2px;
  border-radius: 2px;
  background: currentColor;
  transform: rotate(-45deg);
}

/* read-only value */
.st-value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 30px;
  font-size: var(--rb-text-base);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--rb-text-primary);
}
.st-value__muted {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  font-size: 10.5px;
  font-weight: 700;
  color: var(--rb-text-secondary);
}

.st-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.st-spin { animation: st-spin 0.9s linear infinite; }
@keyframes st-spin { to { transform: rotate(360deg); } }

@media (max-width: 1100px) {
  .st-table__type-col { width: 100px; }
}

@media (max-width: 760px) {
  .st-card { padding: 14px 14px 16px; gap: 12px; }
  .st-card__actions { width: 100%; margin-left: 0; justify-content: flex-end; }
  .st-table__type-col { width: 72px; }
  .st-table__corner { padding-left: 12px !important; }
  .st-table__type { padding-left: 12px; }
  .st-table__cell { padding: 5px 6px; }
  /* A thumb needs more than a pointer does. */
  .st-field { height: 38px; }
}

@media (prefers-reduced-motion: reduce) {
  .st-btn, .st-field, .st-bell { transition: none; }
  .st-spin { animation: none; }
}
</style>
