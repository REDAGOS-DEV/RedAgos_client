<template>
  <div class="panel">
    <header class="page-head">
      <div class="page-head__text">
        <h1 class="page-head__title">Stock Thresholds</h1>
        <p class="page-head__subtitle">
          Set the PAR and critical levels for each blood type and component the {{ facilityNoun }} keeps. They help
          restock on time and warn staff before a shelf runs out.
        </p>

        <div class="scope">
          <span v-if="status" class="scope__item">
            <AssetIcon name="building-2" :size="14" />
            Levels for <strong>{{ status.facility.name }}</strong> only.
          </span>
          <span v-if="status && !editable" class="scope__item scope__item--note">
            <AssetIcon name="eye" :size="14" />
            {{ readOnlyNote }}
          </span>
        </div>
      </div>

      <!-- Refresh at the top right, as on the other pages (2026-10-31). -->
      <div class="page-head__actions">
        <button type="button" class="refresh" :disabled="busy || savingLevel !== null" @click="loadStatus(false)">
          <AssetIcon name="refresh-cw" :size="14" :class="{ spin: busy }" />
          {{ busy ? 'Loading…' : 'Refresh' }}
        </button>
      </div>

      <aside class="guide" aria-label="What the levels mean">
        <span class="guide__icon" aria-hidden="true"><AssetIcon name="info" :size="18" /></span>
        <dl class="guide__list">
          <div>
            <dt>PAR Level</dt>
            <dd>The target stock level to keep for smooth operations.</dd>
          </div>
          <div>
            <dt>Critical Level</dt>
            <dd>The minimum stock level before a low-stock alert is sent.</dd>
          </div>
        </dl>
      </aside>
    </header>

    <div v-if="loadError" class="alert" role="alert">
      <AssetIcon name="circle-alert" :size="16" />
      <span>{{ loadError }}</span>
      <button type="button" class="alert__retry" :disabled="busy" @click="loadStatus(false)">Try again</button>
    </div>

    <template v-if="status">
      <LowStockBanner :cells="status.low" />

      <p v-if="!anyLevelSet" class="callout">
        <AssetIcon name="info" :size="15" />
        <span>
          No levels are set yet, so nothing is being watched.
          {{ editable ? 'Type a level into any cell, then save that table.' : 'Until one is set, stock is shown without a target.' }}
        </span>
      </p>

      <p v-if="!status.components.length" class="empty">No blood components are defined.</p>

      <template v-else>
        <!--
          One view at a time (2026-10-24): the stock now, or one of the two
          level tables. The tables still save apart, and a draft survives a
          switch; each tab says how many changes wait in it.
        -->
        <div class="views" role="tablist" aria-label="Stock thresholds">
          <button
            v-for="v in VIEWS"
            :key="v.value"
            type="button"
            role="tab"
            class="views__tab"
            :class="[`views__tab--${v.value}`, { 'views__tab--on': view === v.value }]"
            :aria-selected="view === v.value"
            @click="view = v.value"
          >
            <AssetIcon :name="v.icon" :size="15" />
            {{ v.label }}
            <span v-if="badgeOf(v.value)" class="views__badge" :class="`views__badge--${badgeOf(v.value)!.tone}`" :title="badgeOf(v.value)!.title">
              {{ badgeOf(v.value)!.count }}
            </span>
          </button>
        </div>

        <StockThresholdGrid v-show="view === 'stock'" :status="status" @set-levels="(level) => (view = level)" />

        <StockLevelCard
          v-for="level in LEVELS"
          v-show="view === level"
          :key="level"
          :level="level"
          :rows="rows"
          :components="components"
          :editable="editable"
          :saving="savingLevel === level"
          :locked="savingLevel !== null"
          :change-count="changes[level].length"
          :problems="problems[level]"
          :flagged="flagged[level]"
          :feedback="feedback[level]"
          @input="(key, value) => edit(level, key, value)"
          @toggle-alerts="toggleAlerts"
          @save="save(level)"
          @discard="discard(level)"
        />

      </template>

      <p class="footnote">
        <AssetIcon name="info" :size="14" />
        <span>
          Counts are issuable units only: available and not past their date. An alert goes out when stock falls below a
          critical level; PAR is a target and never alerts. Muting a stock's bell stops its notifications, but the
          colours and the banner still show its true level.
        </span>
      </p>
    </template>

    <!-- First load -->
    <div v-else-if="busy" class="skeletons" aria-hidden="true">
      <span v-for="n in 2" :key="n" class="skeleton" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The stock-threshold screen, for either portal.
 *
 * A blood centre and a hospital blood bank show the same thing: every blood
 * type against every component, in a PAR table and a critical table, then the
 * stock now against both. Both pages are a thin wrapper that supplies how to
 * fetch, how to save, and whether the signed-in account may edit. The server
 * decides every status and re-checks every rule on save.
 *
 * The two tables save apart. One set of drafts holds both levels of a cell, so
 * the critical-above-PAR rule can be checked against what is on screen, and a
 * save in one table re-seeds only that table's side: unsaved edits in the
 * other survive it.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import LowStockBanner from '~/components/common/LowStockBanner.vue'
import StockLevelCard from '~/components/common/StockLevelCard.vue'
import StockThresholdGrid from '~/components/common/StockThresholdGrid.vue'
import type {
  SaveStockThresholdsPayload,
  StockLevelRow,
  StockThresholdDraft,
  StockThresholdStatus,
  ThresholdLevel,
} from '~/types/stockThreshold'
import {
  cellKey,
  diffCritical,
  diffPar,
  draftFor,
  levelConflict,
  orderBloodTypes,
  orderComponents,
  thresholdProblems,
} from '~/utils/stockThreshold'

type Feedback = { kind: 'success' | 'error'; text: string }

const POLL_MS = 60_000
const LEVELS: ThresholdLevel[] = ['par', 'critical']
type View = 'stock' | ThresholdLevel
const VIEWS: Array<{ value: View; label: string; icon: string }> = [
  { value: 'stock', label: 'Current stock', icon: 'activity' },
  { value: 'par', label: 'PAR level', icon: 'list' },
  { value: 'critical', label: 'Critical level', icon: 'triangle-alert' },
]
const view = ref<View>('stock')

/** What a tab carries: shortages on the stock, unsaved changes or problems on a table. */
function badgeOf(v: View): { count: number; tone: 'crit' | 'info'; title: string } | null {
  if (v === 'stock') {
    const short = (status.value?.totals.low ?? 0) + (status.value?.totals.critical ?? 0)
    return short ? { count: short, tone: 'crit', title: `${short} below the critical level` } : null
  }
  if (problems.value[v].length) return { count: problems.value[v].length, tone: 'crit', title: 'To fix before saving' }
  const pending = changes.value[v].length
  return pending ? { count: pending, tone: 'info', title: `${pending} unsaved` } : null
}

const LEVEL_NAMES: Record<ThresholdLevel, string> = { par: 'PAR levels', critical: 'critical levels' }

const props = withDefaults(defineProps<{
  /** How to read the status. Named apart from `loadStatus` below so the two cannot be confused. */
  fetchStatus: () => Promise<StockThresholdStatus>
  /** How to save, answering with the fresh status. */
  saveStatus: (_payload: SaveStockThresholdsPayload) => Promise<StockThresholdStatus>
  editable?: boolean
  /** "centre" or "blood bank", for the sentence that says whose shelf this is. */
  facilityNoun?: string
  readOnlyNote?: string
}>(), {
  editable: false,
  facilityNoun: 'facility',
  readOnlyNote: 'You can see the levels and the stock against them, but not change them.',
})

const status = ref<StockThresholdStatus | null>(null)
const drafts = reactive<Record<string, StockThresholdDraft>>({})
const busy = ref(false)
const loadError = ref('')
const savingLevel = ref<ThresholdLevel | null>(null)
const feedback = reactive<Record<ThresholdLevel, Feedback | null>>({ par: null, critical: null })

const cells = computed(() => status.value?.cells ?? [])
const components = computed(() => orderComponents(status.value?.components ?? []))

const byKey = computed(() => new Map(
  cells.value.map((cell) => [cellKey(cell.blood_type_id, cell.component_id), cell] as const),
))

/** One row per blood type, one item per component, each holding its cell and its draft. */
const rows = computed<StockLevelRow[]>(() =>
  orderBloodTypes(status.value?.blood_types ?? []).map((type) => ({
    type,
    items: components.value.flatMap((component) => {
      const key = cellKey(type.id, component.id)
      const cell = byKey.value.get(key)
      const draft = drafts[key]

      return cell && draft ? [{ key, component, cell, draft }] : []
    }),
  })),
)

const changes = computed(() => ({
  par: diffPar(cells.value, drafts),
  critical: diffCritical(cells.value, drafts),
}))

const problems = computed(() => ({
  par: thresholdProblems('par', cells.value, drafts),
  critical: thresholdProblems('critical', cells.value, drafts),
}))

/**
 * Cells to outline in each table: its own problems, and any pair on screen
 * with the critical level above PAR, in both tables, so the two numbers read
 * as the pair they are.
 */
const flagged = computed(() => {
  const conflicts = Object.keys(drafts).filter((key) => byKey.value.has(key) && levelConflict(drafts[key]!))
  const of = (level: ThresholdLevel) => new Set([...problems.value[level].map((p) => p.key), ...conflicts])

  return { par: of('par'), critical: of('critical') }
})

const dirty = computed(() => changes.value.par.length > 0 || changes.value.critical.length > 0)

const anyLevelSet = computed(() => cells.value.some((cell) => cell.minimum_units !== null || cell.par_units !== null))

function keysOf(level: ThresholdLevel): Set<string> {
  return new Set([
    ...changes.value[level].map((change) => cellKey(change.blood_type_id, change.component_id)),
    ...problems.value[level].map((problem) => problem.key),
  ])
}

/**
 * Start each level of each draft from what is saved.
 *
 * `keep` names the levels whose unsaved edits survive. A refresh keeps both,
 * so a poll or a save in one table never wipes typing in the other; a save
 * or a discard re-seeds only its own table.
 */
function seed(keep: ThresholdLevel[]): void {
  const keepPar = keep.includes('par') ? keysOf('par') : new Set<string>()
  const keepCritical = keep.includes('critical') ? keysOf('critical') : new Set<string>()

  for (const cell of cells.value) {
    const key = cellKey(cell.blood_type_id, cell.component_id)
    const saved = draftFor(cell)
    const draft = drafts[key]

    drafts[key] = draft
      ? {
          par: keepPar.has(key) ? draft.par : saved.par,
          minimum: keepCritical.has(key) ? draft.minimum : saved.minimum,
          alerts_enabled: keepCritical.has(key) ? draft.alerts_enabled : saved.alerts_enabled,
        }
      : saved
  }
}

function edit(level: ThresholdLevel, key: string, value: string): void {
  const draft = drafts[key]

  if (!draft) return

  if (level === 'par') draft.par = value
  else draft.minimum = value

  feedback[level] = null
}

function toggleAlerts(key: string): void {
  const draft = drafts[key]

  if (!draft) return

  draft.alerts_enabled = !draft.alerts_enabled
  feedback.critical = null
}

function discard(level: ThresholdLevel): void {
  seed(LEVELS.filter((other) => other !== level))
  feedback[level] = null
}

function failure(err: any, fallback: string): string {
  return err?.data?.message || (Object.values(err?.data?.errors ?? {}).flat() as string[])[0] || fallback
}

/**
 * Load the status.
 *
 * A quiet refresh keeps what is on screen and swallows a failure: a missed
 * poll is not worth an error banner, and the next one retries.
 */
async function loadStatus(quiet: boolean): Promise<void> {
  busy.value = !quiet
  if (!quiet) loadError.value = ''

  try {
    status.value = await props.fetchStatus()
  } catch (err) {
    if (!quiet) loadError.value = failure(err, 'The stock thresholds could not be loaded.')
  } finally {
    busy.value = false
  }
}

/**
 * Save one table's changes, and only that table's.
 *
 * On failure the drafts stay as typed, so nothing is lost and the user can
 * retry. On success the fresh status re-seeds this table; the other keeps
 * its unsaved edits.
 */
async function save(level: ThresholdLevel): Promise<void> {
  const thresholds = changes.value[level]

  if (!thresholds.length || problems.value[level].length || savingLevel.value !== null) return

  savingLevel.value = level
  feedback[level] = null

  try {
    // The watch below re-seeds from the fresh status: this table's drafts now
    // match what is saved, and the other table's edits are kept.
    status.value = await props.saveStatus({ thresholds })

    const count = thresholds.length
    feedback[level] = { kind: 'success', text: `Saved ${count} change${count === 1 ? '' : 's'} to the ${LEVEL_NAMES[level]}.` }
  } catch (err) {
    feedback[level] = {
      kind: 'error',
      text: `${failure(err, `The ${LEVEL_NAMES[level]} could not be saved.`)} Your changes are still here; try again.`,
    }
  } finally {
    savingLevel.value = null
  }
}

// A new status from a load or a poll keeps every unsaved edit.
watch(() => status.value?.cells, () => seed(LEVELS), { immediate: true })

let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  void loadStatus(false)

  // Keep the counts current, but never while there are unsaved edits or a save
  // in flight: the tables would be re-seeded underneath the person typing.
  timer = setInterval(() => {
    if (!dirty.value && savingLevel.value === null && !busy.value) void loadStatus(true)
  }, POLL_MS)
})

onBeforeUnmount(() => {
  if (timer !== null) clearInterval(timer)
})
</script>

<style scoped>
.panel {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  background: var(--rb-page-bg);
  display: flex;
  flex-direction: column;
  gap: 18px;
  color: var(--rb-text-primary);
  min-width: 0;
}

/* heading and the guide beside it */
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px 24px; }
.page-head__text { flex: 1 1 auto; min-width: 0; }
.page-head__title { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; }
.page-head__subtitle { margin: 6px 0 0; max-width: 66ch; font-size: var(--rb-text-base); line-height: 1.6; color: var(--rb-text-secondary); }

.scope { display: flex; align-items: center; gap: 8px 14px; flex-wrap: wrap; margin-top: 12px; }
.scope__item { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--rb-text-secondary); }
.scope__item strong { color: var(--rb-text-primary); }
.scope__item--note { padding: 3px 11px; border-radius: 999px; background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); font-weight: 600; }

.refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
  font: inherit;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.refresh:hover:not(:disabled) { color: var(--rb-text-primary); border-color: var(--rb-border-hover); }
.refresh:disabled { opacity: 0.45; cursor: not-allowed; }
.refresh:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

.guide {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 0 1 460px;
  padding: 14px 18px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.28);
  border-radius: var(--rb-radius-md);
  background: rgba(var(--rb-primary-rgb), 0.06);
}
.guide__icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: var(--rb-primary);
  color: #fff;
}
.guide__list { display: grid; gap: 10px; margin: 0; }
.guide__list dt { font-size: var(--rb-text-base); font-weight: 700; color: var(--rb-primary-text); }
.guide__list dd { margin: 1px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }

.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 11px 14px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.25);
  border-radius: 10px;
  background: rgba(var(--rb-accent-rgb), 0.08);
  color: var(--rb-accent-text);
  font-size: 13px;
  line-height: 1.5;
}
.alert :deep(.asset-icon) { flex-shrink: 0; }

.callout {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 11px 14px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.25);
  border-radius: 10px;
  background: rgba(var(--rb-primary-rgb), 0.07);
  color: var(--rb-primary-text);
  font-size: 13px;
  line-height: 1.5;
}
.callout :deep(.asset-icon) { flex-shrink: 0; margin-top: 2px; }

.empty { margin: 0; padding: 32px 16px; text-align: center; color: var(--rb-text-secondary); }

/* The view switch */
.views { display: inline-flex; flex-wrap: wrap; align-self: flex-start; gap: 4px; padding: 4px; border: 1px solid var(--rb-border); border-radius: 12px; background: var(--rb-surface); }
.views__tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 16px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--rb-text-secondary);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.views__tab:hover { color: var(--rb-text-primary); background: var(--rb-surface-hover); }
.views__tab--on, .views__tab--on:hover { background: var(--rb-primary); color: #fff; }
.views__tab:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.views__badge { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; font-size: 11px; font-weight: 800; }
.views__badge--crit { background: rgba(var(--rb-accent-rgb), 0.14); color: var(--rb-accent-text); }
.views__badge--info { background: rgba(var(--rb-primary-rgb), 0.14); color: var(--rb-primary-text); }
.views__tab--on .views__badge { background: #fff; color: var(--rb-primary); }
@media (prefers-reduced-motion: reduce) {
  .views__tab { transition: none; }
}

.footnote {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 0;
  max-width: 100ch;
  font-size: 12px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}
.footnote :deep(.asset-icon) { flex-shrink: 0; margin-top: 2px; }

.skeletons { display: grid; gap: 18px; }
.skeleton {
  display: block;
  height: 280px;
  border-radius: var(--rb-radius-md);
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: panel-shimmer 1.4s ease infinite;
}
@keyframes panel-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.spin { animation: panel-spin 0.9s linear infinite; }
@keyframes panel-spin { to { transform: rotate(360deg); } }

@media (max-width: 1100px) {
  .page-head { flex-direction: column; }
  .guide { flex-basis: auto; width: 100%; max-width: 640px; }
}

@media (max-width: 760px) {
  .panel { padding: 16px 16px 32px; gap: 14px; }
  .page-head__title { font-size: 22px; }
  .page-head__subtitle { font-size: var(--rb-text-sm); }
  .guide { padding: 12px 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin { animation: none; }
  .refresh { transition: none; }
}

/* Refresh at the top right of the heading. */
.page-head__actions { flex: none; display: flex; align-items: center; }
.page-head__actions .refresh { height: 38px; padding: 0 14px; }
.alert__retry { margin-left: auto; border: 0; background: none; font: inherit; font-weight: 600; color: inherit; text-decoration: underline; cursor: pointer; }
</style>
